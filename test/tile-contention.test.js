// A8 tile contention (docs/04 §7): two cities never work the same tile. Priority:
// MANUAL (city.workers) beats AUTO; within a tier, cityOrder (older wins). A city
// never works another city's centre. Resolution lives in resolveAllWorked +
// workedTiles (engine/cities.js) + luau twin; the cross-language hash contract is
// scenario 063. NOTE: the REAL game threads the contended resolveAllWorked map; the
// workedTiles fallback is deliberately NON-contended (A8 §b — the AI plans on it),
// so these tests pass the contended map explicitly via idxOf.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { workedTiles, candidateTiles, resolveAllWorked } = await import('../engine/cities.js');
  // the CONTENDED worked tiles for a city (what the real game applies)
  const idxOf = (state, city) =>
    workedTiles(state, city, RULESET, resolveAllWorked(state, RULESET)[city.id])
      .filter(w => !w.center).map(w => w.y * 10 + w.x);
  return { candidateTiles, resolveAllWorked, idxOf };
}

// two same-owner cities 2 apart on an all-grassland map; pop lets them reach deep
// into the shared overlap so contention actually bites.
function twoCityState(extra) {
  const tiles = []; for (let i = 0; i < 100; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 10, height: 10, wrapX: false, tiles },
    units: {},
    cities: {
      c1: { id: 'c1', name: 'Old', owner: 'p1', x: 3, y: 5, pop: 8, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'New', owner: 'p1', x: 5, y: 5, pop: 8, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 1, nextCityId: 1,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  }, extra || {});
}

test('A8: two adjacent auto cities never work the same tile', async () => {
  const { idxOf } = await load();
  const s = twoCityState();
  const a = idxOf(s, s.cities.c1);
  const b = idxOf(s, s.cities.c2);
  const overlap = a.filter(i => b.includes(i));
  assert.strictEqual(overlap.length, 0, `no shared tile, saw overlap ${JSON.stringify(overlap)}`);
  assert.strictEqual(a.length, 8, 'the older city works a full pop of tiles');
});

test('A8: no city works another city\'s centre', async () => {
  const { idxOf } = await load();
  const s = twoCityState();
  const a = idxOf(s, s.cities.c1);
  const b = idxOf(s, s.cities.c2);
  assert.ok(!a.includes(5 * 10 + 5), 'c1 does not work c2 centre');
  assert.ok(!b.includes(5 * 10 + 3), 'c2 does not work c1 centre');
});

// a tile the OLDER c1 works (contended) that ALSO sits in c2's candidate set — a
// real contested tile (c1 holds it, c2 could take it if it out-prioritises).
function contestedTile(state, idxOf, candidateTiles) {
  const c1Worked = idxOf(state, state.cities.c1);
  const c2Cand = {};
  for (const c of candidateTiles(state, state.cities.c2, RULESET)) c2Cand[c.idx] = true;
  return c1Worked.find(i => c2Cand[i] === true);
}

test('A8: a MANUAL city beats a greedy neighbour for a contested tile', async () => {
  const { idxOf, candidateTiles } = await load();
  const shared = contestedTile(twoCityState(), idxOf, candidateTiles);
  assert.ok(shared !== undefined, 'the two cities overlap on a real contested tile');
  const manual = twoCityState();
  manual.cities.c2.workers = [shared]; // the YOUNGER c2 claims it manually
  const b = idxOf(manual, manual.cities.c2);
  const a = idxOf(manual, manual.cities.c1);
  assert.ok(b.includes(shared), 'manual c2 (younger) wins the contested tile over greedy c1');
  assert.ok(!a.includes(shared), 'greedy c1 yields the tile to the manual claim');
});

test('A8: conflicting manual claims go to the older city', async () => {
  const { idxOf, candidateTiles } = await load();
  const shared = contestedTile(twoCityState(), idxOf, candidateTiles);
  const s = twoCityState();
  s.cities.c1.workers = [shared]; // older, manual
  s.cities.c2.workers = [shared]; // younger, manual — same tile
  const a = idxOf(s, s.cities.c1);
  const b = idxOf(s, s.cities.c2);
  assert.ok(a.includes(shared), 'older manual c1 wins the conflicting claim');
  assert.ok(!b.includes(shared), 'younger manual c2 loses it (its citizen idles)');
});

test('A8 §b: the workedTiles FALLBACK is non-contended (the AI planning path)', async () => {
  const { resolveAllWorked } = await load();
  const { workedTiles } = await import('../engine/cities.js');
  const s = twoCityState();
  // fallback (no map) = each city greedily works its own best, IGNORING the neighbour
  const a = workedTiles(s, s.cities.c1, RULESET).filter(w => !w.center).map(w => w.y * 10 + w.x);
  const b = workedTiles(s, s.cities.c2, RULESET).filter(w => !w.center).map(w => w.y * 10 + w.x);
  const overlap = a.filter(i => b.includes(i));
  assert.ok(overlap.length > 0, 'the non-contended fallback DOES overlap (that is the point — AI plans on it)');
  // while the contended map for the same state does NOT overlap
  const ca = resolveAllWorked(s, RULESET)['c1'];
  const cb = resolveAllWorked(s, RULESET)['c2'];
  assert.strictEqual(ca.filter(i => cb.includes(i)).length, 0, 'the contended map has no overlap');
});
