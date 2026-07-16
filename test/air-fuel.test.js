// A72 slice 2: air fuel + crash. An air unit must end the game-turn on a
// friendly base (a city now; a carrier in slice 3) or it burns fuel; past its
// `fuel` turns aloft it crashes. Fighter = 1 turn aloft, bomber = 2 (data,
// wiki-flagged). No RNG — golden-neutral (the AI fields no air units).
// Cross-language: test/scenarios/022-air-fuel.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// single-player grassland so one endTurn wraps the turn (processAir runs).
function craft(unit, city) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  const units = {};
  units[unit.id] = unit;
  const cities = {};
  const cityOrder = [];
  if (city) { cities[city.id] = city; cityOrder.push(city.id); }
  return {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

const airborneFighter = () => ({ id: 'f1', type: 'fighter', owner: 'p1', x: 2, y: 2, moves: 10, fortified: false, veteran: false });

test('A72: a fighter aloft one turn survives (aloft counter increments)', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(airborneFighter()), { type: 'endTurn', playerId: 'p1' });
  assert.ok(res.ok);
  assert.ok(res.state.units.f1, 'still flying after one turn');
  assert.strictEqual(res.state.units.f1.aloft, 1, 'one turn aloft');
});

test('A72: a fighter aloft past its fuel crashes', async () => {
  const engine = await load();
  const t1 = engine.applyCommand(craft(airborneFighter()), { type: 'endTurn', playerId: 'p1' });
  const t2 = engine.applyCommand(t1.state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(t2.state.units.f1, undefined, 'the fighter ran out of fuel and crashed');
  assert.ok(t2.events.some(e => e.type === 'airCrashed' && e.owner === 'p1'), 'airCrashed event');
});

test('A72: a bomber lasts two turns aloft before crashing', async () => {
  const engine = await load();
  const bomber = { id: 'b1', type: 'bomber', owner: 'p1', x: 2, y: 2, moves: 8, fortified: false, veteran: false };
  let s = craft(bomber);
  s = engine.applyCommand(s, { type: 'endTurn', playerId: 'p1' }).state; // aloft 1
  assert.strictEqual(s.units.b1.aloft, 1);
  s = engine.applyCommand(s, { type: 'endTurn', playerId: 'p1' }).state; // aloft 2 (survives)
  assert.ok(s.units.b1, 'bomber survives 2 turns aloft');
  assert.strictEqual(s.units.b1.aloft, 2);
  const t3 = engine.applyCommand(s, { type: 'endTurn', playerId: 'p1' }); // aloft 3 -> crash
  assert.strictEqual(t3.state.units.b1, undefined, 'crashes on the third turn aloft');
});

test('A72: a fighter ending in a friendly city refuels (aloft cleared)', async () => {
  const engine = await load();
  const fighter = { id: 'f1', type: 'fighter', owner: 'p1', x: 2, y: 2, moves: 10, fortified: false, veteran: false, aloft: 1 };
  const city = { id: 'c1', name: 'Base', owner: 'p1', x: 2, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
  const res = engine.applyCommand(craft(fighter, city), { type: 'endTurn', playerId: 'p1' });
  assert.ok(res.state.units.f1, 'the fighter is safe in the city');
  assert.strictEqual(res.state.units.f1.aloft, undefined, 'aloft cleared (refueled) — omit-safe');
});

test('A72 revert-guard: a LAND unit left in the open never crashes (no fuel model)', async () => {
  const engine = await load();
  const militia = { id: 'm1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false };
  let s = craft(militia);
  for (let i = 0; i < 4; i++) s = engine.applyCommand(s, { type: 'endTurn', playerId: 'p1' }).state;
  assert.ok(s.units.m1, 'the militia is unaffected by air fuel');
  assert.strictEqual(s.units.m1.aloft, undefined, 'no aloft counter on a land unit');
});
