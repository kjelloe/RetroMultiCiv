// specs/late-join-pause.md §3 takeover selection + §7 eviction ranking (pure).
const test = require('node:test');
const assert = require('node:assert');

async function load() { return await import('../server/late-join.js'); }

// minimal state: playerOrder + players{ alive?, human? }
function stateOf(players) {
  return { playerOrder: Object.keys(players), players };
}
const scores = m => pid => m[pid];

test('takeover selection: >=3 candidates -> SECOND-STRONGEST (drop top + bottom)', async () => {
  const { selectTakeoverSeat } = await load();
  const s = stateOf({ a: {}, b: {}, c: {}, d: {} });
  // scores a=10 b=8 c=5 d=2 -> ranked [a,b,c,d]; drop a + d; strongest remaining = b
  assert.strictEqual(selectTakeoverSeat(s, scores({ a: 10, b: 8, c: 5, d: 2 })), 'b');
});

test('takeover selection: 2 candidates -> the WEAKER; 1 -> that one; 0 -> null', async () => {
  const { selectTakeoverSeat } = await load();
  assert.strictEqual(selectTakeoverSeat(stateOf({ a: {}, b: {} }), scores({ a: 10, b: 8 })), 'b');
  assert.strictEqual(selectTakeoverSeat(stateOf({ a: {} }), scores({ a: 5 })), 'a');
  assert.strictEqual(selectTakeoverSeat(stateOf({}), scores({})), null);
});

test('takeover pool excludes HUMAN seats (rejoin promise) and DEAD civs', async () => {
  const { selectTakeoverSeat, takeoverPool } = await load();
  const s = stateOf({
    h: { human: true },        // an (abandoned) human seat — reserved, never taken
    dead: { alive: false },    // eliminated — not eligible
    ai1: {}, ai2: {}, ai3: {}
  });
  assert.deepStrictEqual(takeoverPool(s).sort(), ['ai1', 'ai2', 'ai3']);
  // among the 3 AI, second-strongest
  assert.strictEqual(selectTakeoverSeat(s, scores({ ai1: 9, ai2: 6, ai3: 3, h: 100, dead: 100 })), 'ai2');
});

test('takeover selection: score ties break deterministically by playerOrder', async () => {
  const { selectTakeoverSeat } = await load();
  // all equal -> ranked stays in playerOrder [a,b,c]; drop a + c; remaining = b
  assert.strictEqual(selectTakeoverSeat(stateOf({ a: {}, b: {}, c: {} }), scores({ a: 5, b: 5, c: 5 })), 'b');
});

test('eviction ranking: earliest era -> fewer humans -> longest paused', async () => {
  const { selectEviction } = await load();
  // earliest era wins outright
  assert.strictEqual(selectEviction([
    { gameId: 'classical', eraRank: 1, originalHumans: 1, pausedAt: 100 },
    { gameId: 'ancient', eraRank: 0, originalHumans: 4, pausedAt: 999 }
  ]), 'ancient');
  // tie era -> fewer original humans
  assert.strictEqual(selectEviction([
    { gameId: 'many', eraRank: 2, originalHumans: 3, pausedAt: 100 },
    { gameId: 'solo', eraRank: 2, originalHumans: 1, pausedAt: 500 }
  ]), 'solo');
  // tie era + humans -> longest paused (smallest pausedAt)
  assert.strictEqual(selectEviction([
    { gameId: 'recent', eraRank: 0, originalHumans: 2, pausedAt: 500 },
    { gameId: 'old', eraRank: 0, originalHumans: 2, pausedAt: 100 }
  ]), 'old');
  assert.strictEqual(selectEviction([]), null);
});
