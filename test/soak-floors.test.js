const test = require('node:test');
const assert = require('node:assert');

const { computeFloorReport, isCanonicalFloorRun, floorMedian, floorCmp } = require('../tools/soak.js');

const CANON = { civs: 7, size: 'medium', chaos: false, natural: false, difficulty: 'medium', turns: 400 };

// A checkpoint row shaped like tools/soak.js appendStats writes: meta + snapshot.
function cp(seed, turn, players) {
  return Object.assign(
    { t: 'checkpoint', seed, civs: 7, size: 'medium', chaos: false, natural: false, difficulty: 'medium', turns: 400 },
    { turn, players }
  );
}

// One surviving civ. gold/cities/pop/imprPct/buys are the floor metrics.
function civ(id, o) {
  return Object.assign({ id, name: id, alive: true, cities: 10, pop: 60, imprPct: 80, buys: 2, gold: 100 }, o || {});
}

test('floorMedian: odd, even, empty', () => {
  assert.strictEqual(floorMedian([3, 1, 2]), 2);
  assert.strictEqual(floorMedian([1, 2, 3, 4]), 2.5);
  assert.strictEqual(floorMedian([]), null);
});

test('floorCmp operators', () => {
  assert.ok(floorCmp(8, '>=', 8));
  assert.ok(!floorCmp(7, '>=', 8));
  assert.ok(floorCmp(1, '>', 0));
  assert.ok(!floorCmp(0, '>', 0));
  assert.ok(floorCmp(49, '<', 50));
  assert.ok(!floorCmp(50, '<', 50));
});

test('isCanonicalFloorRun gates to the pinned config', () => {
  assert.ok(isCanonicalFloorRun(CANON));
  assert.ok(!isCanonicalFloorRun(Object.assign({}, CANON, { chaos: true })));
  assert.ok(!isCanonicalFloorRun(Object.assign({}, CANON, { civs: 4 })));
  assert.ok(!isCanonicalFloorRun(Object.assign({}, CANON, { size: 'small' })));
  assert.ok(!isCanonicalFloorRun(Object.assign({}, CANON, { difficulty: 'godemperor' })));
  assert.ok(!isCanonicalFloorRun(Object.assign({}, CANON, { turns: 300 })));
});

test('healthy world clears all measurable floors; resourceCov PENDING', () => {
  // gold climbs 100 -> 200 over the last 100 turns => goldRate 1 (< 50 OK)
  const rows = [
    cp(1, 301, [civ('a', { gold: 100 }), civ('b', { gold: 100 })]),
    cp(1, 401, [civ('a', { gold: 200 }), civ('b', { gold: 200 })]),
    cp(2, 301, [civ('a', { gold: 100 }), civ('b', { gold: 100 })]),
    cp(2, 401, [civ('a', { gold: 200 }), civ('b', { gold: 200 })])
  ];
  const rep = computeFloorReport(rows, CANON, [1, 2]);
  assert.strictEqual(rep.applicable, true);
  assert.strictEqual(rep.finalTurn, 401);
  const byKey = {};
  for (const r of rep.results) byKey[r.key] = r;
  for (const k of ['M2-cities', 'M3-pop', 'M4-impr', 'M10-buys', 'M10-treasury']) {
    assert.strictEqual(byKey[k].pending, false, `${k} should be measured`);
    assert.strictEqual(byKey[k].ok, true, `${k} should clear`);
  }
  assert.strictEqual(byKey['M-resourceCov'].pending, true, 'resourceCov has no column yet');
});

test('breaches: low pop, low cities, zero buys, runaway treasury', () => {
  const bad = { cities: 5, pop: 40, imprPct: 60, buys: 0 };
  const rows = [
    cp(1, 301, [civ('a', Object.assign({ gold: 100 }, bad)), civ('b', Object.assign({ gold: 100 }, bad))]),
    // gold 100 -> 10100 over 100 turns => goldRate 100 (>= 50 breach)
    cp(1, 401, [civ('a', Object.assign({ gold: 10100 }, bad)), civ('b', Object.assign({ gold: 10100 }, bad))])
  ];
  const rep = computeFloorReport(rows, CANON, [1]);
  const byKey = {};
  for (const r of rep.results) byKey[r.key] = r;
  assert.strictEqual(byKey['M2-cities'].ok, false);
  assert.strictEqual(byKey['M3-pop'].ok, false);
  assert.strictEqual(byKey['M4-impr'].ok, false);
  assert.strictEqual(byKey['M10-buys'].ok, false);
  assert.strictEqual(byKey['M10-treasury'].ok, false);
});

test('eliminated civs are excluded from floor medians', () => {
  const rows = [
    cp(1, 301, [civ('a', { gold: 100 }), civ('b', { gold: 100 })]),
    cp(1, 401, [
      civ('a', { gold: 200 }),
      Object.assign(civ('b', { gold: 200 }), { alive: false, cities: 0, pop: 0, imprPct: 0, buys: 0 })
    ])
  ];
  const rep = computeFloorReport(rows, CANON, [1]);
  const cities = rep.results.find(r => r.key === 'M2-cities');
  assert.strictEqual(cities.measured, 10, 'dead civ b (0 cities) must not drag the median');
  assert.strictEqual(cities.ok, true);
});

test('stale rows from a different config are ignored', () => {
  const canonRows = [
    cp(1, 301, [civ('a', { gold: 100 })]),
    cp(1, 401, [civ('a', { gold: 200 })])
  ];
  const stale = Object.assign(cp(1, 401, [civ('a', { cities: 1, pop: 1, gold: 5 })]), { chaos: true });
  const rep = computeFloorReport([...canonRows, stale], CANON, [1]);
  const cities = rep.results.find(r => r.key === 'M2-cities');
  assert.strictEqual(cities.measured, 10, 'chaos-on row must not contaminate the canonical floor');
});

test('short run (no t401 checkpoint) is not applicable', () => {
  const rows = [cp(1, 301, [civ('a')])];
  const rep = computeFloorReport(rows, CANON, [1]);
  assert.strictEqual(rep.applicable, false);
});
