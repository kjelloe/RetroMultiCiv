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

test('#1732 busy-tolerant heartbeat: a loop-block round grants grace, does not reap a would-be-missed client', async () => {
  const { startServer } = await import('../server/index.js');
  // heartbeatMs 1000 so the block threshold (1.5x = 1500ms) is easy to cross
  // with injected timestamps; misses 2 so two normal ticks arm a reap.
  const s = await startServer(base({ gameId: 'hbb', heartbeatMs: 1000, heartbeatMisses: 2 }));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const c = await connect(s.port);
  try {
    c.ws._socket.pause(); // stop pongs from being processed — models queued-during-block
    // Two NORMAL ticks (in-cadence) arm the reap: missedPongs 0->1->2 (== misses).
    s.heartbeatTick(1000);
    s.heartbeatTick(2000);
    // The NEXT tick fires 60s late = the event loop was blocked (a turn-2623
    // synchronous AI chain). Busy-tolerant: it must take a grace round and NOT
    // terminate, even though missedPongs is already at the threshold.
    s.heartbeatTick(62000);
    await sleep(60);
    c.ws._socket.resume();
    const stillOpen = await new Promise(res => {
      if (c.ws.readyState !== 1) return res(false);
      c.ws.on('close', () => res(false));
      setTimeout(() => res(c.ws.readyState === 1), 300);
    });
    assert.strictEqual(stillOpen, true, 'blocked-round grace spared the socket the false reap');
  } finally { c.close(); await s.close(); }
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

test('Slice 3a: per-IP connect-rate refuses excess handshakes (pre-allocation)', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const s = await startServer(base({ gameId: '3a', limits: { connectsPerSec: 1, connectBurst: 3 } }));
  const tryOpen = () => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
    ws.on('open', () => res({ opened: true, ws })); ws.on('error', () => res({ opened: false }));
  });
  try {
    const rs = [];
    for (let i = 0; i < 8; i++) rs.push(await tryOpen());
    const opened = rs.filter(r => r.opened).length;
    assert.ok(opened >= 1 && opened <= 4, `some allowed, excess refused (opened=${opened})`);
    assert.ok(rs.some(r => !r.opened), 'at least one handshake refused at the connect-rate gate');
    for (const r of rs) if (r.ws) r.ws.close();
  } finally { await s.close(); }
});

test('Slice 3a: with --trust-proxy, per-IP limits key off X-Forwarded-For (not the shared proxy peer)', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const s = await startServer(base({ gameId: '3ap', trustProxyHops: 1, limits: { connectsPerSec: 1, connectBurst: 2 } }));
  const tryOpen = xff => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`, { headers: { 'x-forwarded-for': xff } });
    ws.on('open', () => res({ opened: true, ws })); ws.on('error', () => res({ opened: false }));
  });
  try {
    const a = [];
    for (let i = 0; i < 5; i++) a.push(await tryOpen('9.9.9.9'));
    assert.ok(a.some(r => !r.opened), 'one forwarded client is rate-limited on its OWN ip (loopback peer is trusted)');
    const other = await tryOpen('8.8.8.8');
    assert.strictEqual(other.opened, true, 'a different forwarded IP is independent');
    for (const r of a.concat(other)) if (r.ws) r.ws.close();
  } finally { await s.close(); }
});

test('Slice 3b: Origin allow-list refuses a disallowed origin at the handshake; allows a listed one', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const s = await startServer(base({ gameId: '3b', originAllowlist: ['https://allowed.example'] }));
  const dies = origin => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`, { origin });
    ws.on('open', () => { ws.close(); res(false); }); ws.on('error', () => res(true));
  });
  try {
    assert.strictEqual(await dies('https://evil.example'), true, 'disallowed origin refused at handshake');
    const joined = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`, { origin: 'https://allowed.example' });
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: 'Kjell' })));
      ws.on('message', raw => { const m = JSON.parse(raw); if (m.t === 'joined') { ws.close(); resolve(m); } });
      ws.on('error', reject);
    });
    assert.strictEqual(joined.playerId, 'p1', 'allowed origin joins');
  } finally { await s.close(); }
});

test('Slice 3b: static responses carry nosniff + revalidating cache; an overlong URL is 414', async () => {
  const { startServer } = await import('../server/index.js');
  const http = require('http');
  const s = await startServer(base({ gameId: '3bh' }));
  const get = p => new Promise(res => http.get({ host: '127.0.0.1', port: s.port, path: p }, r => { r.resume(); res(r); }));
  try {
    const idx = await get('/client/?server=1'); // bare /client/ now 302s (see below)
    assert.strictEqual(idx.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(idx.headers['x-frame-options'], 'DENY'); // v2: anti-clickjacking
    assert.match(idx.headers['cache-control'], /no-cache/);
    const long = await get('/client/' + 'a'.repeat(3000));
    assert.strictEqual(long.statusCode, 414);
  } finally { await s.close(); }
});

test('a bare /client/ on the server redirects to the server game; any query is served as-is', async () => {
  const { startServer } = await import('../server/index.js');
  const http = require('http');
  const s = await startServer(base({ gameId: 'redir' }));
  const get = p => new Promise(res => http.get({ host: '127.0.0.1', port: s.port, path: p }, r => { r.resume(); res(r); }));
  try {
    const bare = await get('/client/');
    assert.strictEqual(bare.statusCode, 302, 'bare /client/ redirects');
    assert.strictEqual(bare.headers.location, '/client/?server=1');
    assert.strictEqual((await get('/client/?server=1')).statusCode, 200, 'server URL served');
    assert.strictEqual((await get('/client/?local=1')).statusCode, 200, 'local escape hatch served');
    assert.strictEqual((await get('/client/?seed=5')).statusCode, 200, 'power-user URL untouched');
    const noSlash = await get('/client');
    assert.strictEqual(noSlash.statusCode, 302, '/client still 302s to /client/');
    assert.strictEqual(noSlash.headers.location, '/client/');
  } finally { await s.close(); }
});

test('Slice 3c: a silent squatter is closed; an active socket is spared', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const s = await startServer(base({ gameId: '3cs', unauthTimeoutMs: 200, heartbeatMisses: 100000 }));
  const dies = make => new Promise(res => {
    const ws = make(new WebSocket(`ws://127.0.0.1:${s.port}/ws`));
    ws.on('close', () => res(true)); ws.on('error', () => res(true));
    setTimeout(() => res(false), 2000);
  });
  try {
    assert.strictEqual(await dies(ws => ws), true, 'silent squatter (sent nothing) closed after the window');
    const spared = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'list' }))); // any message sets sawMessage
      ws.on('close', () => reject(new Error('active socket was closed')));
      ws.on('error', reject);
      setTimeout(() => { ws.close(); resolve(true); }, 700);
    });
    assert.strictEqual(spared, true, 'active (browsing) socket spared');
  } finally { await s.close(); }
});

test('Slice 3c: SIGTERM shuts the server down cleanly (exit 0)', async () => {
  const { spawn } = require('node:child_process');
  const path = require('path');
  const child = spawn('node', [path.join(__dirname, '..', 'server', 'index.js'), '--port', '0', '--no-save', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  try {
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('server never booted')), 8000);
      child.stdout.on('data', d => { if (String(d).includes('WebSocket: ws://')) { clearTimeout(to); resolve(); } });
      child.on('exit', () => { clearTimeout(to); reject(new Error('exited before boot')); });
    });
    const exited = new Promise(resolve => child.on('exit', (code, sig) => resolve({ code, sig })));
    child.kill('SIGTERM');
    const res = await Promise.race([exited, new Promise((_, r) => setTimeout(() => r(new Error('did not exit on SIGTERM')), 6000))]);
    assert.strictEqual(res.code, 0, `clean exit (got code=${res.code} sig=${res.sig})`);
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
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
