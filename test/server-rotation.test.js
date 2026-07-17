const test = require('node:test');
const assert = require('node:assert');

async function load() { return await import('../server/rotation.js'); }

const MB = 1024 * 1024;
// savedAt as ms for easy ordering; f<n> is older when n is smaller.
function f(n, opts) {
  return Object.assign({ path: 'g' + n + '.json', gameId: 'g' + n, savedAt: n * 1000, sizeBytes: MB }, opts || {});
}

test('under both budgets: nothing rotates', async () => {
  const { planRotation } = await load();
  const files = [f(1), f(2), f(3)];
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 100, maxSavesMb: 500 }), []);
});

test('over the count budget: oldest non-active retire first', async () => {
  const { planRotation } = await load();
  const files = [f(3), f(1), f(2), f(4)]; // unsorted input
  // cap 2 → must drop 2 oldest (g1, g2)
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 2, maxSavesMb: 9999 }), ['g1.json', 'g2.json']);
});

test('over the size budget: retire oldest until under maxSavesMb', async () => {
  const { planRotation } = await load();
  const files = [f(1), f(2), f(3), f(4)]; // 4 MB total
  // 2 MB budget → drop the two oldest (1 MB each) to reach 2 MB
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 100, maxSavesMb: 2 / 1 }), ['g1.json', 'g2.json']);
});

test('ACTIVE games are never evicted, even when oldest', async () => {
  const { planRotation } = await load();
  const files = [f(1), f(2), f(3)];
  // g1 is the oldest but ACTIVE → g2 (next oldest, non-active) goes instead
  assert.deepStrictEqual(planRotation(files, { g1: true }, { maxSaves: 2, maxSavesMb: 9999 }), ['g2.json']);
});

test('all-active over budget: nothing to reclaim (stays over — correct)', async () => {
  const { planRotation } = await load();
  const files = [f(1), f(2), f(3)];
  assert.deepStrictEqual(planRotation(files, { g1: true, g2: true, g3: true }, { maxSaves: 1, maxSavesMb: 1 }), []);
});

test('mixed active/inactive: only inactive retire, oldest first, deterministic', async () => {
  const { planRotation } = await load();
  const files = [f(1, { gameId: 'live1' }), f(2), f(3, { gameId: 'live3' }), f(4), f(5)];
  // active live1(oldest) + live3 pinned; cap 2 total → must drop 3 non-active,
  // oldest non-active first: g2, g4, g5
  const plan = planRotation(files, { live1: true, live3: true }, { maxSaves: 2, maxSavesMb: 9999 });
  assert.deepStrictEqual(plan, ['g2.json', 'g4.json', 'g5.json']);
});

test('ISO savedAt strings order the same as ms', async () => {
  const { planRotation } = await load();
  const files = [
    { path: 'a.json', gameId: 'a', savedAt: '2026-07-16T10:00:00.000Z', sizeBytes: MB },
    { path: 'b.json', gameId: 'b', savedAt: '2026-07-15T10:00:00.000Z', sizeBytes: MB }, // older
    { path: 'c.json', gameId: 'c', savedAt: '2026-07-17T10:00:00.000Z', sizeBytes: MB }
  ];
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 2, maxSavesMb: 9999 }), ['b.json']);
});

test('TIER: a newer COMPLETED save retires before an older RESUMABLE one', async () => {
  const { planRotation } = await load();
  // g1 resumable (oldest), g2 completed (newer). Budget 1 → the completed g2
  // must go first even though g1 is older, because resumable saves are tier 2.
  const files = [f(1), f(2, { over: true })];
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 1, maxSavesMb: 9999 }), ['g2.json']);
});

test('TIER: budget met by completed alone → zero resumable evictions', async () => {
  const { planRotation } = await load();
  // 2 resumable + 2 completed, budget 2 → drop only the 2 completed; both
  // resumable saves survive.
  const files = [f(1), f(2), f(3, { over: true }), f(4, { over: true })];
  assert.deepStrictEqual(
    planRotation(files, {}, { maxSaves: 2, maxSavesMb: 9999 }),
    ['g3.json', 'g4.json'] // completed, oldest-first
  );
});

test('TIER: all-resumable over budget → the budget is HARD, oldest resumable goes', async () => {
  const { planRotation } = await load();
  const files = [f(1), f(2), f(3)]; // all resumable
  // no completed to sacrifice; budget 2 forces the oldest resumable out
  assert.deepStrictEqual(planRotation(files, {}, { maxSaves: 2, maxSavesMb: 9999 }), ['g1.json']);
});

test('TIER: completed retire oldest-first, then resumable oldest-first', async () => {
  const { planRotation } = await load();
  // 2 completed (c-old, c-new) + 2 resumable (r-old, r-new), budget 1 →
  // order: c-old, c-new, then r-old (stop when count=1). r-new survives.
  const files = [
    f(1, { over: true }), f(2, { over: true }), f(3), f(4)
  ];
  assert.deepStrictEqual(
    planRotation(files, {}, { maxSaves: 1, maxSavesMb: 9999 }),
    ['g1.json', 'g2.json', 'g3.json']
  );
});

test('defaults are exported and sane', async () => {
  const { DEFAULT_ROTATION } = await load();
  assert.strictEqual(DEFAULT_ROTATION.maxSaves, 100);
  assert.ok(DEFAULT_ROTATION.maxSavesMb >= 100);
});
