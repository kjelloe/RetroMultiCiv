// B18: zone-of-control fidelity — enemy CITIES exert ZOC, and Diplomats /
// Caravans / nuclear weapons IGNORE it (units.json ignoresZoc). The cross-
// language behavior is pinned in scenario 013-zoc.json; these are the fast
// JS-side regression assertions, including nuclear's flag (an air unit that
// can't be walked across land in a scenario) and a direct engine probe.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');
const UNITS = require('../data/units.json');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// 5x5 all grassland, ONE undefended enemy city at (2,2), no enemy units —
// the city is the only ZOC source. The mover starts at (1,1) (diagonally
// adjacent to the city) and steps E to (2,1) (also city-adjacent).
function world(moverType) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {
      m1: { id: 'm1', type: moverType, owner: 'p1', x: 1, y: 1, moves: 2, fortified: false, veteran: false }
    },
    cities: { c1: { id: 'c1', name: 'Ur', owner: 'p2', x: 2, y: 2, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('B18: an undefended enemy city exerts ZOC (a normal unit is blocked)', async () => {
  const engine = await load();
  const res = engine.applyCommand(world('militia'), { type: 'moveUnit', playerId: 'p1', unitId: 'm1', dir: 'E' });
  assert.strictEqual(res.ok, false, 'militia cannot step between two city-adjacent tiles');
  assert.strictEqual(res.reason, 'zoc');
});

test('B18: ignoresZoc units walk through a city ZOC', async () => {
  const engine = await load();
  // diplomat and caravan are land units — they can demonstrate the pass
  for (const type of ['diplomat', 'caravan']) {
    const res = engine.applyCommand(world(type), { type: 'moveUnit', playerId: 'p1', unitId: 'm1', dir: 'E' });
    assert.strictEqual(res.ok, true, `${type} ignores ZOC and moves`);
    assert.strictEqual(res.state.units.m1.x, 2);
    assert.strictEqual(res.state.units.m1.y, 1);
  }
});

test('B18: city ZOC needs BOTH tiles adjacent (positive control)', async () => {
  const engine = await load();
  // step N from (1,1) to (1,0): (1,0) is NOT adjacent to the city (2,2)
  const res = engine.applyCommand(world('militia'), { type: 'moveUnit', playerId: 'p1', unitId: 'm1', dir: 'N' });
  assert.strictEqual(res.ok, true, 'destination is not city-adjacent, so ZOC does not bind');
});

test('B18/A72: diplomat/caravan/nuclear + the air units carry ignoresZoc in units.json', async () => {
  const flagged = Object.keys(UNITS).filter(id => UNITS[id].ignoresZoc === true).sort();
  assert.deepStrictEqual(flagged, ['bomber', 'caravan', 'diplomat', 'fighter', 'nuclear'],
    'the ground ZOC-ignorers (B18) plus the air units (A72), and only those');
  // a normal unit must not carry it (guards the overlay against over-application)
  assert.strictEqual(UNITS.militia.ignoresZoc, undefined);
  assert.strictEqual(UNITS.legion.ignoresZoc, undefined);
});
