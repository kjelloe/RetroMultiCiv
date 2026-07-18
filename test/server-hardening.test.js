// Hardening lane regression guards (docs/17), over a real socket. Slice 1:
// the malformed-frame crash fix + the kick-path budget preserve. Later slices
// add their own rows here.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
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
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), ms || 3000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() }));
    ws.on('error', reject);
  });
}
const base = extra => Object.assign({
  ruleset: RULESET, seed: 1, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1'
}, extra);

test('Slice 1: a malformed/oversized frame battery does not crash the server; it stays responsive', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const s = await startServer(base({ gameId: 'h5' }));
  try {
    const raw = [
      'not json{', '[]', '123', 'null', '"str"', '{}',
      JSON.stringify({ t: 123 }), JSON.stringify({ t: 'unknownType' }),
      JSON.stringify({ t: 'cmd' }), JSON.stringify({ t: 'cmd', token: 'x', commandId: 'nope' }),
      JSON.stringify({ t: 'join' }), JSON.stringify({ t: 'join', name: '' }),
      JSON.stringify({ t: 'join', name: 'x'.repeat(100) }),
      JSON.stringify({ t: 'chat', text: 'y'.repeat(500) }),
      JSON.stringify({ t: 'cmd', token: 'forged', commandId: 1, cmd: { type: 'foundCity' } }),
      'x'.repeat(70 * 1024) // oversized -> maxPayload closes it; must NOT crash the server
    ];
    await new Promise(resolve => {
      const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
      ws.on('error', () => {}); // the oversized frame closes this socket — expected
      ws.on('open', () => { for (const f of raw) { try { ws.send(f); } catch (e) {} } setTimeout(() => { try { ws.close(); } catch (e) {} resolve(); }, 150); });
    });
    // the server survived; a fresh client still plays end-to-end
    const c = await connect(s.port);
    c.send({ t: 'join', name: 'Canary' });
    const j = await c.expect(m => m.t === 'joined');
    assert.strictEqual(j.playerId, 'p1', 'a real client still joins after the battery');
    c.send({ t: 'ping' });
    assert.ok(await c.expect(m => m.t === 'pong'), 'server still responds');
    c.send({ t: 'endTurn', token: j.token, commandId: 1 });
    assert.ok(await c.expect(m => m.t === 'applied' && m.commandId === 1), 'game logic still works');
    c.close();
  } finally { await s.close(); }
});

test('Slice 1: kick preserves the command budget (a kicked-then-flooding socket still rate-limits)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 'k1', limits: { cmdBurst: 3, cmdRefillPerSec: 1 } }));
  const host = await connect(s.port), ada = await connect(s.port);
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 7 } });
    const created = await host.expect(m => m.t === 'created');
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    await ada.expect(m => m.t === 'joinedLobby');
    host.send({ t: 'kick', seat: 'p2' });
    await ada.expect(m => m.t === 'kicked');
    // the kicked socket floods commands; the preserved budget must still fire
    // (without the fix its budget record is dropped and every frame waves past)
    for (let i = 0; i < 20; i++) ada.send({ t: 'cmd', token: 'x', commandId: i, cmd: { type: 'wait', unitId: 'u', playerId: 'p1' } });
    const rl = await ada.expect(m => m.t === 'rejected' && m.code === 'rateLimited');
    assert.strictEqual(rl.code, 'rateLimited', 'budget survives the kick');
  } finally { host.close(); ada.close(); await s.close(); }
});
