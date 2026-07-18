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
