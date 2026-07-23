// lobby-drop-surface (sweep red 3, helper #2448): a lobby client reconnects on a
// raw drop (Part C), swallowing a server-going-away close and leaving the room
// stale ("waiting for the host to start…"). Server half: close lobby sockets with
// a DETERMINISTIC reason (code 1001 + 'lobbyConnectionLost') so the client can
// distinguish "server gone — surface it, stop reconnecting" from a transient drop.
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const RULESET = require('./ruleset.js');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(m));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  function expect(match, ms) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms || 3000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } }); });
  }
  return new Promise(resolve => ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect })));
}

test('a lobby socket gets a clean lobbyConnectionLost close (code 1001) on server close', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 11, civs: 2, humans: 2, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  const host = await client(s.port);
  host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 2, size: 'xsmall' } });
  const created = await host.expect(m => m.t === 'created');
  const joiner = await client(s.port);
  joiner.send({ t: 'join', name: 'Bo', joinCode: created.joinCode });
  await joiner.expect(m => m.t === 'joinedLobby'); // a LOBBY conn: seat bound, no playerId

  // the joiner's close event carries the deterministic reason
  const closed = new Promise(res => joiner.ws.on('close', (code, reason) => res({ code, reason: Buffer.from(reason).toString() })));
  await s.close(); // every lobby socket dies (the sweep's own.close() scenario)
  const ci = await closed;
  assert.strictEqual(ci.code, 1001, 'going-away code (not an abrupt 1006) — the client keys off it');
  assert.strictEqual(ci.reason, 'lobbyConnectionLost', 'the reason contract for the client half');
});

test('a STARTED-game socket is not lobby-framed on close (unaffected by the lobby signal)', async () => {
  const { startServer } = await import('../server/index.js');
  // the boot game is a started game; a joined player there is NOT a lobby conn
  const s = await startServer({ ruleset: RULESET, seed: 11, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  const player = await client(s.port);
  player.send({ t: 'join', name: 'Ada' });
  await player.expect(m => m.t === 'joined');
  const closed = new Promise(res => player.ws.on('close', (code, reason) => res({ code, reason: Buffer.from(reason).toString() })));
  await s.close();
  const ci = await closed;
  assert.notStrictEqual(ci.reason, 'lobbyConnectionLost', 'started-game sockets are not given the lobby reason');
});
