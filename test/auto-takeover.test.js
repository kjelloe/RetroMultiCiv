// XIV §30: "Auto AI takeover" host option. In a STARTED game, a seat that stays
// disconnected for the seat-grace window is handed to the AI (regency, option
// ON — the default) or has its turn auto-skipped (option OFF), so a dropped
// player never stalls the game. Drives real ws clients through the lobby.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(msg));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 5000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: msg => ws.send(JSON.stringify(msg)), expect, inbox, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

// host creates a 2-human game, guest takes p2, host starts it; returns both.
async function twoHumanGame(port, extraOptions) {
  const host = await connect(port);
  host.send({ t: 'create', name: 'Kjell', options: Object.assign({ civs: 2, humans: 2, size: 'xsmall', seed: 424242 }, extraOptions || {}) });
  const created = await host.expect(m => m.t === 'created', 'created');
  const guest = await connect(port);
  guest.send({ t: 'join', joinCode: created.joinCode, name: 'Ada', seat: 'p2' });
  await guest.expect(m => m.t === 'joinedLobby', 'joinedLobby');
  await host.expect(m => m.t === 'lobby', 'lobby');
  host.send({ t: 'start' });
  await host.expect(m => m.t === 'joined', 'host joined');
  await guest.expect(m => m.t === 'joined', 'guest joined');
  await host.expect(m => m.t === 'started', 'started');
  return { host, guest };
}

test('XIV §30 ON (default): a disconnected seat is handed to the AI (regency)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, seatGraceMs: 150,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) });
  try {
    const { host, guest } = await twoHumanGame(s.port); // autoTakeover defaults ON
    guest.close(); // p2 drops
    // after the grace window the server hands p2 to the AI and broadcasts it
    const pres = await host.expect(m => m.t === 'presence' && m.regents && m.regents.p2 === true, 'p2 under regency');
    assert.ok(pres.regents.p2, 'the disconnected seat is now AI-driven');
    host.close();
  } finally { await s.close(); }
});

test('XIV §30 OFF: a disconnected ACTIVE seat is auto-skipped, not AI-driven', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, seatGraceMs: 150,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) });
  try {
    const { host, guest } = await twoHumanGame(s.port, { autoTakeover: false });
    // p1 (host) is active first; host drops → OFF policy skips its turn
    host.close();
    const skipped = await guest.expect(m => m.t === 'turnSkipped' && m.playerId === 'p1', 'p1 turn skipped');
    assert.strictEqual(skipped.playerId, 'p1', 'the dropped active seat is skipped');
    // and it was NOT put under regency (that is the ON behavior)
    const noRegent = guest.inbox.every(m => !(m.t === 'presence' && m.regents && m.regents.p1 === true));
    assert.ok(noRegent, 'OFF never drives the seat with the AI');
    guest.close();
  } finally { await s.close(); }
});

test('XIV §30: a server flag flips the per-game default (--no-auto-takeover)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, seatGraceMs: 150,
    autoTakeover: false, lobbyGameIdFn: (n => () => 'g' + (++n))(0) });
  try {
    // a game created WITHOUT specifying the option inherits the server default (OFF here)
    const { host, guest } = await twoHumanGame(s.port);
    host.close(); // p1 active drops → default OFF → skip
    const skipped = await guest.expect(m => m.t === 'turnSkipped' && m.playerId === 'p1', 'default-OFF skip');
    assert.strictEqual(skipped.playerId, 'p1');
    guest.close();
  } finally { await s.close(); }
});
