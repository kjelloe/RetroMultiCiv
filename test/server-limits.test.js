const test = require('node:test');
const assert = require('node:assert');

async function load() {
  return await import('../server/limits.js');
}

// A mutable clock so windows can be advanced by hand — no sleeps.
function clock(start) {
  let t = start || 0;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('global + per-IP connection caps', async () => {
  const { createLimiter } = await load();
  const lim = createLimiter({ limits: { maxConns: 3, maxConnsPerIp: 2 } });
  assert.ok(lim.onConnect('a').ok);
  assert.ok(lim.onConnect('a').ok);
  assert.strictEqual(lim.onConnect('a').reason, 'tooManyConns', 'per-IP cap');
  assert.ok(lim.onConnect('b').ok, 'a different IP still has room');
  // total is now 3 (a,a,b) → global cap hit for anyone
  assert.strictEqual(lim.onConnect('c').reason, 'serverFull', 'global cap');
  // freeing one of a's slots lets a reconnect (still under per-IP), but global
  // is the binding cap until someone leaves
  lim.onDisconnect('a');
  assert.ok(lim.onConnect('a').ok, 'slot freed');
});

test('onDisconnect never underflows', async () => {
  const { createLimiter } = await load();
  const lim = createLimiter({ limits: { maxConns: 10, maxConnsPerIp: 2 } });
  lim.onDisconnect('ghost'); // no prior connect — must not push totalConns negative
  assert.strictEqual(lim.stats().totalConns, 0, 'ghost disconnect did not underflow');
  assert.ok(lim.onConnect('x').ok);
  assert.ok(lim.onConnect('x').ok);
  assert.strictEqual(lim.onConnect('x').reason, 'tooManyConns', 'per-IP cap binds under a high global cap');
});

test('create rate: per-IP per-hour sliding window', async () => {
  const { createLimiter } = await load();
  const c = clock(1000);
  const lim = createLimiter({ now: c.now, limits: { createsPerHour: 2 } });
  assert.ok(lim.allow('a', 'create').ok);
  assert.ok(lim.allow('a', 'create').ok);
  assert.strictEqual(lim.allow('a', 'create').reason, 'rateLimited', 'third in the hour');
  assert.ok(lim.allow('b', 'create').ok, 'a different IP is independent');
  c.advance(3600001); // past the hour
  assert.ok(lim.allow('a', 'create').ok, 'window slid — a can create again');
});

test('join + chat rate windows are per-IP per-minute', async () => {
  const { createLimiter } = await load();
  const c = clock(0);
  const lim = createLimiter({ now: c.now, limits: { joinsPerMin: 2, chatPerMin: 1 } });
  assert.ok(lim.allow('a', 'join').ok);
  assert.ok(lim.allow('a', 'join').ok);
  assert.strictEqual(lim.allow('a', 'join').reason, 'rateLimited');
  assert.ok(lim.allow('a', 'chat').ok);
  assert.strictEqual(lim.allow('a', 'chat').reason, 'rateLimited');
  c.advance(60001);
  assert.ok(lim.allow('a', 'join').ok, 'minute window slid');
  assert.ok(lim.allow('a', 'chat').ok);
});

test('unknown action is unthrottled', async () => {
  const { createLimiter } = await load();
  const lim = createLimiter({ limits: { joinsPerMin: 1 } });
  for (let i = 0; i < 100; i++) assert.ok(lim.allow('a', 'ping').ok);
});

test('global game cap', async () => {
  const { createLimiter } = await load();
  const lim = createLimiter({ limits: { maxGames: 2 } });
  assert.ok(lim.canCreateGame(0).ok);
  assert.ok(lim.canCreateGame(1).ok);
  assert.strictEqual(lim.canCreateGame(2).reason, 'tooManyGames');
});

test('sweep GCs expired windows so memory stays bounded', async () => {
  const { createLimiter } = await load();
  const c = clock(0);
  const lim = createLimiter({ now: c.now, limits: { joinsPerMin: 5 } });
  lim.allow('a', 'join'); lim.allow('b', 'join');
  assert.strictEqual(lim.stats().windows, 2);
  c.advance(60001);
  lim.sweep();
  assert.strictEqual(lim.stats().windows, 0, 'expired windows dropped');
});

test('per-connection command budget: token-bucket bursts, cheap-rejects, then refills', async () => {
  const { createCommandBudget } = await load();
  const c = clock(0);
  const b = createCommandBudget({ now: c.now, limits: { cmdBurst: 3, cmdRefillPerSec: 2 } });
  assert.ok(b.take().ok); assert.ok(b.take().ok); assert.ok(b.take().ok); // the burst
  assert.strictEqual(b.take().reason, 'rateLimited', 'over budget → cheap reject');
  c.advance(500); // 0.5s × 2/sec = 1 token back
  assert.ok(b.take().ok, 'one token refilled');
  assert.strictEqual(b.take().reason, 'rateLimited', 'only one refilled');
  c.advance(10000); // a long idle refills to capacity, never beyond
  assert.ok(b.take().ok); assert.ok(b.take().ok); assert.ok(b.take().ok);
  assert.strictEqual(b.take().reason, 'rateLimited', 'capacity capped at cmdBurst (no overflow)');
});

test('command budget defaults are LAN-safe (fast legit play never trips)', async () => {
  const { createCommandBudget, DEFAULT_LIMITS } = await load();
  assert.ok(DEFAULT_LIMITS.cmdBurst >= 20, 'a burst covers a busy turn');
  assert.ok(DEFAULT_LIMITS.cmdRefillPerSec >= 8, 'sustained legit play headroom');
  const c = clock(0);
  const b = createCommandBudget({ now: c.now });
  // a brisk human turn — 25 commands over ~2.5s (moving a full stack, founding) stays ok
  for (let i = 0; i < 25; i++) { assert.ok(b.take().ok, `legit cmd ${i}`); c.advance(100); }
});

test('defaults are LAN-safe (a normal game never trips them)', async () => {
  const { createLimiter, DEFAULT_LIMITS } = await load();
  const lim = createLimiter({});
  assert.ok(DEFAULT_LIMITS.maxConnsPerIp >= 8);
  assert.ok(DEFAULT_LIMITS.joinsPerMin >= 20);
  // a full 14-seat lobby's worth of joins from one host machine is fine
  for (let i = 0; i < 14; i++) assert.ok(lim.allow('host', 'join').ok);
});

test('clientIpFrom: XFF trusted ONLY from a private peer + only when opted in (spoof-bypass)', async () => {
  const { clientIpFrom, isPrivatePeer } = await load();
  const req = (peer, xff) => ({ socket: { remoteAddress: peer }, headers: xff ? { 'x-forwarded-for': xff } : {} });
  assert.strictEqual(clientIpFrom(req('127.0.0.1', '9.9.9.9'), 0), '127.0.0.1');        // hops=0: peer, XFF ignored
  assert.strictEqual(clientIpFrom(req('127.0.0.1', '203.0.113.7'), 1), '203.0.113.7');  // behind a loopback proxy
  assert.strictEqual(clientIpFrom(req('203.0.113.7', '10.0.0.1'), 1), '203.0.113.7');   // SPOOF-BYPASS: direct client's forged XFF ignored
  assert.strictEqual(clientIpFrom(req('127.0.0.1', ''), 1), '127.0.0.1');               // no XFF: peer
  assert.strictEqual(clientIpFrom(req('10.0.0.2', '203.0.113.7, 10.0.0.1'), 2), '203.0.113.7'); // two hops
  assert.strictEqual(clientIpFrom(req('::ffff:127.0.0.1', '203.0.113.7'), 1), '203.0.113.7');   // v4-mapped loopback = private
  assert.ok(isPrivatePeer('192.168.1.5') && isPrivatePeer('::1') && isPrivatePeer('10.0.0.1') && !isPrivatePeer('8.8.8.8'));
});

test('originAllowed: permissive when unset, exact match when set, missing Origin rejected', async () => {
  const { originAllowed } = await load();
  assert.ok(originAllowed('https://evil.example', []) && originAllowed(undefined, [])); // no list = permissive
  const list = ['https://civ.example.com'];
  assert.ok(originAllowed('https://civ.example.com', list));
  assert.strictEqual(originAllowed('https://evil.example', list), false);
  assert.strictEqual(originAllowed('https://civ.example.com.evil.com', list), false);  // no substring match
  assert.strictEqual(originAllowed(undefined, list), false);                           // missing rejected when set
});

test('inviteAllowed: open when unset, exact code required when set', async () => {
  const { inviteAllowed } = await load();
  // no codes = OPEN (a public host is world-joinable by default)
  assert.ok(inviteAllowed('/ws', []) && inviteAllowed('/ws?invite=anything', []));
  const codes = ['friday22', 'weekend'];
  assert.ok(inviteAllowed('/ws?invite=friday22', codes));
  assert.ok(inviteAllowed('/ws?token=x&invite=weekend', codes), 'finds invite among other params');
  assert.strictEqual(inviteAllowed('/ws?invite=nope', codes), false); // wrong code
  assert.strictEqual(inviteAllowed('/ws', codes), false);             // missing code rejected when set
  assert.strictEqual(inviteAllowed('/ws?invite=', codes), false);     // empty code rejected
  assert.strictEqual(inviteAllowed(undefined, codes), false);         // no url rejected when set
  assert.strictEqual(inviteAllowed('/ws?invite=friday22%', codes), false); // malformed URL -> rejected, not a throw
});

test('allowConnect: per-IP connect-rate burst then refill', async () => {
  const { createLimiter } = await load();
  const c = clock(0);
  const lim = createLimiter({ now: c.now, limits: { connectBurst: 3, connectsPerSec: 1 } });
  for (let i = 0; i < 3; i++) assert.ok(lim.allowConnect('1.2.3.4').ok, `burst ${i}`);
  const r = lim.allowConnect('1.2.3.4');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'connectRateLimited');
  assert.ok(lim.allowConnect('5.6.7.8').ok, 'a different IP is independent');
  c.advance(1000);
  assert.ok(lim.allowConnect('1.2.3.4').ok, 'refilled one token');
  assert.strictEqual(lim.counters().connectRejected, 1);
});

test('createBudgets: seat bucket keyed by SEAT (shared, not per-call), endTurn separate, per-conn message, cleanup', async () => {
  const { createBudgets } = await load();
  const c = clock(0);
  const b = createBudgets({ now: c.now, limits: {
    seatCmdBurst: 3, seatCmdRefillPerSec: 1, endTurnBurst: 2, endTurnRefillPerSec: 1, msgBurst: 2, msgRefillPerSec: 1
  } });
  for (let i = 0; i < 3; i++) assert.ok(b.seatCmd('g1', 'p1', 'cmd').ok, `seat burst ${i}`);
  assert.strictEqual(b.seatCmd('g1', 'p1', 'cmd').ok, false, 'the seat bucket is one bucket (shared) — burst spent');
  assert.ok(b.seatCmd('g1', 'p2', 'cmd').ok, 'a different seat is independent');
  assert.ok(b.seatCmd('g1', 'p1', 'endTurn').ok, 'endTurn is a separate bucket for the same seat');
  assert.ok(b.message('c1').ok && b.message('c1').ok);
  assert.strictEqual(b.message('c1').ok, false, 'per-connection message burst spent');
  assert.ok(b.message('c2').ok, 'a different connection is independent');
  b.dropGame('g1'); b.dropConn('c1');
  c.advance(60001); b.sweep();
  assert.ok(b.counters().budgetRejected >= 2, 'aggregate reject counter');
});
