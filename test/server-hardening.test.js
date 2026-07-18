// Hardening lane regression guards (docs/17), over a real socket.
// Slice 1: malformed-frame crash fix + kick-path budget preserve.
// Slice 2: the layered budget — per-seat command bucket (shared across a seat's
//   sockets), the per-connection all-message cap, and endTurn's tighter bucket.
// Later slices add their own rows here.
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

test('Slice 2: the per-seat command bucket binds and is SHARED across two sockets on one seat', async () => {
  const { startServer } = await import('../server/index.js');
  // seat bucket is the binding layer; the per-connection backstop is set high
  const s = await startServer(base({ gameId: 's2a', limits: {
    seatCmdBurst: 4, seatCmdRefillPerSec: 1, cmdBurst: 1000, cmdRefillPerSec: 1000, msgBurst: 1000, msgRefillPerSec: 1000
  } }));
  const a = await connect(s.port), b = await connect(s.port);
  try {
    a.send({ t: 'join', name: 'Seat' });
    const j = await a.expect(m => m.t === 'joined');
    // second socket reconnects onto the SAME seat with the same token
    b.send({ t: 'join', name: 'Seat', token: j.token });
    const j2 = await b.expect(m => m.t === 'joined');
    assert.strictEqual(j2.playerId, j.playerId, 'both sockets share the seat');
    // the two sockets TOGETHER exceed the shared seat burst (4): the per-seat
    // bucket rate-limits the combined rate, which a per-connection guard misses
    const cmd = (c, n) => c.send({ t: 'cmd', token: j.token, commandId: n, cmd: { type: 'wait', unitId: 'u', playerId: j.playerId } });
    for (let i = 0; i < 4; i++) { cmd(a, i); cmd(b, i); }
    const rl = await Promise.race([
      a.expect(m => m.t === 'rejected' && m.code === 'rateLimited'),
      b.expect(m => m.t === 'rejected' && m.code === 'rateLimited')
    ]);
    assert.strictEqual(rl.code, 'rateLimited', 'shared seat bucket rate-limits the combined multi-socket flood');
  } finally { a.close(); b.close(); await s.close(); }
});

test('Slice 2: the per-connection all-message cap bounds every frame (a ping flood is rate-limited)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 's2b', limits: { msgBurst: 3, msgRefillPerSec: 1 } }));
  const c = await connect(s.port);
  try {
    for (let i = 0; i < 20; i++) c.send({ t: 'ping' }); // ping is not command-budgeted; the all-message cap catches it
    const rl = await c.expect(m => m.t === 'rejected' && m.code === 'rateLimited');
    assert.strictEqual(rl.code, 'rateLimited');
  } finally { c.close(); await s.close(); }
});

test('Slice 2: endTurn draws its own tighter per-seat bucket', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 's2c', limits: {
    endTurnBurst: 2, endTurnRefillPerSec: 1, seatCmdBurst: 1000, seatCmdRefillPerSec: 1000, cmdBurst: 1000, cmdRefillPerSec: 1000
  } }));
  const c = await connect(s.port);
  try {
    c.send({ t: 'join', name: 'Ender' });
    const j = await c.expect(m => m.t === 'joined');
    for (let i = 0; i < 10; i++) c.send({ t: 'endTurn', token: j.token, commandId: i });
    const rl = await c.expect(m => m.t === 'rejected' && m.code === 'rateLimited');
    assert.strictEqual(rl.code, 'rateLimited', 'endTurn burst is tighter than cmd');
  } finally { c.close(); await s.close(); }
});

test('Slice 2.5 A: heartbeat terminates a socket that stops ponging; a live one is never reaped', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 'hb', heartbeatMisses: 2 })); // drive ticks manually, no 15s wait
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dead = await connect(s.port), live = await connect(s.port);
  try {
    dead.ws._socket.pause(); // half-open: never receives pings -> never pongs
    // round1 missed 0->1, round2 1->2, round3 >=2 -> terminate. Spaced so the
    // LIVE socket's auto-pong lands between rounds and resets its miss counter.
    for (let i = 0; i < 3; i++) { s.heartbeatTick(); await sleep(60); }
    dead.ws._socket.resume(); // surface the server-side terminate as a close
    const deadClosed = await new Promise(res => {
      if (dead.ws.readyState !== 1) return res(true);
      dead.ws.on('close', () => res(true)); setTimeout(() => res(dead.ws.readyState !== 1), 800);
    });
    assert.strictEqual(deadClosed, true, 'half-open socket terminated by heartbeat');
    live.send({ t: 'ping' });
    assert.ok(await live.expect(m => m.t === 'pong'), 'live socket pongs each round -> never reaped, still responds');
  } finally { dead.close(); live.close(); await s.close(); }
});

test('Slice 2.5 B: a dropped lobby seat is HELD (grace) and reclaimed by its reconnect id', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 'b1', seatGraceMs: 5000 }));
  const host = await connect(s.port);
  const ada = await connect(s.port);
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 7 } });
    const created = await host.expect(m => m.t === 'created');
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    const jl = await ada.expect(m => m.t === 'joinedLobby');
    assert.ok(typeof jl.reconnectId === 'string' && jl.reconnectId.length > 0, 'joinedLobby carries a reconnect id');
    const seat = jl.seat;
    ada.close(); // the phone's socket drops
    // the seat is HELD disconnected-reclaimable, NOT freed
    const held = await host.expect(m => m.t === 'lobby' && m.lobby.seats.some(x => x.seat === seat && x.reserved && x.disconnected));
    assert.ok(held, 'seat held disconnected, not released');
    // reconnect with the id within the window -> keeps the same seat
    const ada2 = await connect(s.port);
    ada2.send({ t: 'join', joinCode: created.joinCode, name: 'Ada', lobbyReconnect: jl.reconnectId });
    const jl2 = await ada2.expect(m => m.t === 'joinedLobby');
    assert.strictEqual(jl2.seat, seat, 'reclaimed the same seat');
    ada2.close();
  } finally { host.close(); await s.close(); }
});

test('Slice 2.5 B: an unreclaimed lobby seat is released after the grace window', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 'b2', seatGraceMs: 150 }));
  const host = await connect(s.port);
  const ada = await connect(s.port);
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 8 } });
    const created = await host.expect(m => m.t === 'created');
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    const jl = await ada.expect(m => m.t === 'joinedLobby');
    const seat = jl.seat;
    ada.close();
    // past the grace window the seat frees (roster shows it unreserved)
    const freed = await host.expect(m => m.t === 'lobby' && m.lobby.seats.some(x => x.seat === seat && x.reserved === false), 2000);
    assert.ok(freed, 'seat released after grace expiry');
  } finally { host.close(); await s.close(); }
});

test('Slice 2.5 B: a LIVE seat cannot be reclaimed even with its id (no hijack of a connected player)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer(base({ gameId: 'b3', seatGraceMs: 5000 }));
  const host = await connect(s.port), ada = await connect(s.port), mal = await connect(s.port);
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 9 } });
    const created = await host.expect(m => m.t === 'created');
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    const jl = await ada.expect(m => m.t === 'joinedLobby'); // ada STAYS connected on jl.seat
    // a third party presents ada's (still-LIVE) reconnectId — reclaim must NOT
    // match a live seat; it falls through to a fresh reserve (a different seat)
    mal.send({ t: 'join', joinCode: created.joinCode, name: 'Mal', lobbyReconnect: jl.reconnectId });
    const mjl = await mal.expect(m => m.t === 'joinedLobby' || m.t === 'rejected');
    if (mjl.t === 'joinedLobby') {
      assert.notStrictEqual(mjl.seat, jl.seat, 'a live seat is never handed to a reclaim attempt');
    } else {
      assert.strictEqual(mjl.code, 'gameFull', 'or the lobby was full — either way ada keeps her seat');
    }
  } finally { host.close(); ada.close(); mal.close(); await s.close(); }
});
