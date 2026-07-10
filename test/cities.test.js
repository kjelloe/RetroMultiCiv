const test = require('node:test');
const assert = require('node:assert');

const TERRAIN = require('../data/terrain.json');
const UNITS = require('../data/units.json');
const RULESET = { terrain: TERRAIN, units: UNITS };

async function load() {
  const cities = await import('../engine/cities.js');
  const { createEngine } = await import('../engine/index.js');
  return { cities, engine: createEngine(RULESET) };
}

test('tileYields: specials and river bonus apply', async () => {
  const { cities } = await load();
  assert.deepStrictEqual(cities.tileYields({ t: 'grassland' }, RULESET), { food: 2, shields: 0, trade: 0 });
  assert.deepStrictEqual(cities.tileYields({ t: 'grassland', special: true }, RULESET), { food: 2, shields: 1, trade: 0 });
  assert.deepStrictEqual(cities.tileYields({ t: 'grassland', river: true }, RULESET), { food: 2, shields: 0, trade: 1 });
  assert.deepStrictEqual(cities.tileYields({ t: 'ocean' }, RULESET), { food: 1, shields: 0, trade: 2 });
});

test('FAT_CROSS is the 20-tile Civ 1 city radius (21 minus center)', async () => {
  const { cities } = await load();
  assert.strictEqual(cities.FAT_CROSS.length, 20);
});

test('growth: city grows when the food box fills, starves back down', async () => {
  const { engine } = await load();
  // 3x3 all-grassland island state with one city
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  let state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 1, y: 1, pop: 1, food: 18, shields: 0, producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '' } },
    rngState: 1
  };
  // pop 1 works center (2 food) + 1 tile (2 food) = 4, eats 2 => +2 -> 20 >= 20: grows
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.cities.c1.pop, 2);
  assert.strictEqual(res.state.cities.c1.food, 0);
  const grew = res.events.find(e => e.type === 'cityGrew');
  assert.ok(grew && grew.pop === 2);
});

test('foundCity rejected on water, on an existing city, and for non-settlers', async () => {
  const { engine } = await load();
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 2, height: 1, wrapX: false, tiles: [{ t: 'grassland' }, { t: 'ocean' }] },
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], nextUnitId: 3, nextCityId: 1,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '' } },
    rngState: 1
  };
  const notSettlers = engine.applyCommand(state, { type: 'foundCity', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(notSettlers.ok, false);
  assert.strictEqual(notSettlers.reason, 'notSettlers');

  const founded = engine.applyCommand(state, { type: 'foundCity', playerId: 'p1', unitId: 'u2' });
  assert.strictEqual(founded.ok, true);
  assert.strictEqual(founded.state.units.u2, undefined, 'settlers consumed');

  // a second settlers on the same tile cannot found again
  founded.state.units.u9 = { id: 'u9', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false };
  const dupe = engine.applyCommand(founded.state, { type: 'foundCity', playerId: 'p1', unitId: 'u9' });
  assert.strictEqual(dupe.ok, false);
  assert.strictEqual(dupe.reason, 'cityExists');
});
