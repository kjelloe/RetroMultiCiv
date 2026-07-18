// Part C (mobile-resilience.md) — the pure wake-reconnect decision logic that
// lobby.js's openLobbySocket drives. The live half-open shape can't be
// synthesized in the harness (a field check); this pins the LOGIC that decides
// when to reconnect, what frame to send, and the backoff.
const test = require('node:test');
const assert = require('node:assert');

let R;
test.before(async () => { R = await import('../shared/lobby-reconnect.js'); });

test('shouldReconnect: only a seat-holding, pre-boot socket with a reclaim id', () => {
  const base = { canReconnect: true, reconnectId: 'rc', booted: false, deadShown: false, attempts: 0 };
  assert.strictEqual(R.shouldReconnect(base), true, 'the normal reconnectable case');
  assert.strictEqual(R.shouldReconnect({ ...base, canReconnect: false }), false, 'a query socket never reconnects');
  assert.strictEqual(R.shouldReconnect({ ...base, reconnectId: null }), false, 'no seat reserved yet → no reclaim');
  assert.strictEqual(R.shouldReconnect({ ...base, booted: true }), false, 'the game already booted');
  assert.strictEqual(R.shouldReconnect({ ...base, deadShown: true }), false, 'the truth screen is already up');
  assert.strictEqual(R.shouldReconnect({ ...base, attempts: R.MAX_RECONNECT }), false, 'the cap falls through to the truth screen');
  assert.strictEqual(R.shouldReconnect({ ...base, attempts: R.MAX_RECONNECT - 1 }), true, 'one below the cap still tries');
});

test('reconnectFrame: the original join frame plus the reclaim id, non-mutating', () => {
  const frame = { t: 'join', joinCode: 'Q7F2M', name: 'Ada', seat: 'p3' };
  const out = R.reconnectFrame(frame, 'rc123');
  assert.deepStrictEqual(out, { t: 'join', joinCode: 'Q7F2M', name: 'Ada', seat: 'p3', lobbyReconnect: 'rc123' });
  assert.strictEqual(frame.lobbyReconnect, undefined, 'the base frame is not mutated');
});

test('backoffDelay: exponential from base, capped', () => {
  assert.strictEqual(R.backoffDelay(1), R.RECONNECT_BASE, 'first try = base');
  assert.strictEqual(R.backoffDelay(2), R.RECONNECT_BASE * 2);
  assert.strictEqual(R.backoffDelay(3), R.RECONNECT_BASE * 4);
  assert.ok(R.backoffDelay(20) <= R.RECONNECT_CAP, 'never exceeds the cap');
  assert.strictEqual(R.backoffDelay(0), R.RECONNECT_BASE, 'attempt 0 clamps to base, no negative exponent');
});

test('wakeIsSuspect: an OPEN socket hidden past the threshold is worth a proactive reconnect', () => {
  const now = 1000000;
  assert.strictEqual(R.wakeIsSuspect(0, now), false, 'never hidden → not suspect');
  assert.strictEqual(R.wakeIsSuspect(now - (R.SUSPECT_MS - 1), now), false, 'a quick tab-switch is left alone');
  assert.strictEqual(R.wakeIsSuspect(now - R.SUSPECT_MS, now), true, 'a screen-lock-length hide is suspect');
  assert.strictEqual(R.wakeIsSuspect(now - 60000, now), true, 'a long sleep is suspect');
});
