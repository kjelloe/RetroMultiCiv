// XII.6 Part B: the pure client-side beeline next-step computation over the
// tech DAG. Pins the deterministic walk (shallowest researchable-now unknown on
// a prereq path to the goal, tie-break level then id) against a crafted graph
// AND the real data/techs.json.
const test = require('node:test');
const assert = require('node:assert');

// a tiny crafted DAG: a -> b -> d, a -> c -> d (d needs b AND c)
const G = {
  a: { level: 1, prereqs: [] },
  b: { level: 2, prereqs: ['a'] },
  c: { level: 2, prereqs: ['a'] },
  d: { level: 3, prereqs: ['b', 'c'] }
};

let B;
test.before(async () => { B = await import('../shared/beeline.js'); });

test('prereqClosure: the goal plus everything it (transitively) needs', () => {
  assert.deepStrictEqual(Object.keys(B.prereqClosure(G, 'd')).sort(), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(Object.keys(B.prereqClosure(G, 'b')).sort(), ['a', 'b']);
});

test('nextBeelineStep: shallowest researchable-now unknown toward the goal', () => {
  assert.strictEqual(B.nextBeelineStep(G, [], 'd'), 'a', 'nothing known → the root first');
  assert.strictEqual(B.nextBeelineStep(G, ['a'], 'd'), 'b', 'a known → b (tie-break id: b < c)');
  assert.strictEqual(B.nextBeelineStep(G, ['a', 'b'], 'd'), 'c', 'b done → c is the other frontier');
  assert.strictEqual(B.nextBeelineStep(G, ['a', 'b', 'c'], 'd'), 'd', 'both prereqs known → the goal itself');
  assert.strictEqual(B.nextBeelineStep(G, ['a', 'b', 'c', 'd'], 'd'), null, 'goal known → done');
  assert.strictEqual(B.nextBeelineStep(G, [], null), null, 'no goal → null');
  assert.strictEqual(B.nextBeelineStep(G, [], 'nope'), null, 'unknown goal id → null');
});

test('goalReached', () => {
  assert.strictEqual(B.goalReached(['a', 'd'], 'd'), true);
  assert.strictEqual(B.goalReached(['a'], 'd'), false);
  assert.strictEqual(B.goalReached(['a'], null), false);
});

test('nextBeelineStep over the real techs.json reaches a deep goal in prereq order', () => {
  const techs = require('../data/techs.json');
  // beeline to a deep modern tech from scratch; each step must be researchable-
  // now and the walk must terminate at the goal.
  const goal = 'automobile';
  assert.ok(techs[goal], 'goal exists');
  const known = [];
  let steps = 0;
  for (; steps < 100; steps++) {
    const next = B.nextBeelineStep(techs, known, goal);
    if (next === null) break;
    // every issued step is researchable NOW (all prereqs already known)
    assert.ok(B.researchableNow(techs, next, Object.fromEntries(known.map(k => [k, true]))),
      `${next} researchable when issued`);
    known.push(next);
  }
  assert.ok(B.goalReached(known, goal), `beeline reached ${goal} in ${steps} steps`);
  assert.ok(steps < 100, 'terminated');
});
