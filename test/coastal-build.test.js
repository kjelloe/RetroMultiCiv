// XVII §5 coastal-build (specs/refinement-xvii.md): sea units are buildable only in
// a COASTAL city — centre tile land AND 8-adjacent to ocean; workable-radius water
// does NOT qualify. One shared cityIsCoastal (engine/cities.js) gates setProduction
// (reason needsCoast) AND the AI navy paths (ai.js isCoastal delegates) + luau twin.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

// the earliest attack sea unit + the tech it needs (so techRequired never pre-empts
// the coast check, which is what we are testing).
const SEA = (() => {
  const id = Object.keys(RULESET.units).find(k => RULESET.units[k].domain === 'sea' && RULESET.units[k].attack > 0);
  return { id, tech: RULESET.units[id].tech };
})();

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const { cityIsCoastal } = await import('../engine/cities.js');
  return { engine: createEngine(RULESET), cityIsCoastal };
}

// 7x7 all-grassland; optionally drop one ocean tile at (ox,oy). City at (3,3).
function mk(ox, oy) {
  const tiles = []; for (let i = 0; i < 49; i++) tiles.push({ t: 'grassland' });
  if (ox !== undefined) tiles[oy * 7 + ox] = { t: 'ocean' };
  return {
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 7, height: 7, wrapX: false, tiles }, units: {},
    cities: { c1: { id: 'c1', name: 'A', owner: 'p1', x: 3, y: 3, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 1,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: true, gold: 0, techs: SEA.tech ? [SEA.tech] : [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}
const build = (engine, s) => engine.applyCommand(s, { type: 'setProduction', playerId: 'p1', cityId: 'c1', item: { kind: 'unit', id: SEA.id } });

test('coastal-YES: a city 8-adjacent to ocean is coastal and CAN build a sea unit', async () => {
  const { engine, cityIsCoastal } = await load();
  const s = mk(4, 3); // ocean at (4,3), orthogonally adjacent to the city (3,3)
  assert.strictEqual(cityIsCoastal(s, s.cities.c1, RULESET), true);
  assert.strictEqual(build(engine, s).ok, true, `coastal city builds ${SEA.id}`);
});

test('radius-water-NO: workable-radius water that is NOT 8-adjacent does NOT qualify', async () => {
  const { engine, cityIsCoastal } = await load();
  const s = mk(5, 3); // ocean at (5,3): Chebyshev 2 (in the fat cross, but not 8-adjacent)
  assert.strictEqual(cityIsCoastal(s, s.cities.c1, RULESET), false);
  assert.strictEqual(build(engine, s).reason, 'needsCoast', 'radius-only water still rejects');
});

test('landlocked-NO: no adjacent ocean rejects the sea unit with needsCoast', async () => {
  const { engine, cityIsCoastal } = await load();
  const s = mk(); // all grassland
  assert.strictEqual(cityIsCoastal(s, s.cities.c1, RULESET), false);
  assert.strictEqual(build(engine, s).reason, 'needsCoast');
  // a LAND unit is unaffected (still buildable landlocked)
  assert.strictEqual(engine.applyCommand(mk(), { type: 'setProduction', playerId: 'p1', cityId: 'c1', item: { kind: 'unit', id: 'militia' } }).ok, true);
});

test('coastal via a DIAGONAL ocean neighbour also qualifies', async () => {
  const { cityIsCoastal } = await load();
  assert.strictEqual(cityIsCoastal(mk(4, 4), mk(4, 4).cities.c1, RULESET), true, 'diagonal (4,4) counts');
});
