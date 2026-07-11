// Civilizations (data/civs.json): the full Civ 1 roster of 14, each with a
// city list and ONE specialty built on four generic engine hooks
// (startTech / startGold / cheapUnit|cheapBuilding / veteranUnit).
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const CIVS = RULESET.civs;

async function load() {
  const cities = await import('../engine/cities.js');
  const { createEngine } = await import('../engine/index.js');
  return { cities, engine: createEngine(RULESET) };
}

test('civ dataset: 14 civilizations, valid specialties, ASCII city names', () => {
  const ids = Object.keys(CIVS);
  assert.strictEqual(ids.length, 14, 'the canonical Civ 1 roster');
  const colors = {};
  for (const id of ids) {
    const c = CIVS[id];
    assert.ok(c.name && c.color && Array.isArray(c.cities) && c.cities.length >= 7, id);
    assert.ok(!colors[c.color], `duplicate color ${c.color} (${id})`);
    colors[c.color] = true;
    for (const name of c.cities) {
      assert.match(name, /^[\x20-\x7e]+$/, `${id}: "${name}" must be printable ASCII`);
    }
    const s = c.specialty;
    assert.ok(s && s.blurb, `${id} has a specialty with a blurb`);
    if (s.type === 'startTech') assert.ok(RULESET.techs[s.tech], `${id}: tech ${s.tech}`);
    else if (s.type === 'cheapUnit') assert.ok(RULESET.units[s.unit] && s.pct > 0, `${id}: unit ${s.unit}`);
    else if (s.type === 'cheapBuilding') assert.ok(RULESET.buildings[s.building] && s.pct > 0, `${id}: building ${s.building}`);
    else if (s.type === 'veteranUnit') assert.ok(RULESET.units[s.unit], `${id}: unit ${s.unit}`);
    else if (s.type === 'startGold') assert.ok(s.gold > 0, id);
    else assert.fail(`${id}: unknown specialty type ${s.type}`);
  }
});

test('start specialties: techs and gold applied at createGame; no civ = no change', async () => {
  const { engine } = await load();
  const state = engine.createGame({
    seed: 99,
    options: {
      width: 24, height: 16,
      players: [
        { id: 'p1', civ: 'babylonians', name: 'Babylonians', color: '#b13bd8', human: true },
        { id: 'p2', civ: 'aztecs', name: 'Aztecs', color: '#3bc9d8', human: false },
        { id: 'p3', name: 'Plain', color: '#ffffff', human: false }
      ]
    }
  });
  assert.deepStrictEqual(state.players.p1.techs, ['alphabet'], 'Babylonians know Alphabet');
  assert.strictEqual(state.players.p1.civ, 'babylonians');
  assert.strictEqual(state.players.p2.gold, 50, 'Aztec tribute');
  assert.strictEqual(state.players.p3.civ, undefined, 'civ-less defs stay plain');
  assert.strictEqual(state.players.p3.gold, 0);
});

test('cheapUnit: Roman legions cost less to build and to buy', async () => {
  const { cities, engine } = await load();
  const legion = RULESET.units.legion;
  const roman = { civ: 'romans' };
  const discounted = cities.itemCost('unit', 'legion', legion, roman, RULESET);
  assert.strictEqual(discounted, legion.cost - Math.floor(legion.cost * 25 / 100));
  assert.strictEqual(cities.itemCost('unit', 'militia', RULESET.units.militia, roman, RULESET),
    RULESET.units.militia.cost, 'other units unaffected');

  // completion at the discounted price, and buy charges the discounted gap
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'R', owner: 'p1', x: 1, y: 1, pop: 1, food: 0, shields: discounted - 1, buildings: [], producing: { kind: 'unit', id: 'legion' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true, civ: 'romans', gold: 100, techs: ['bronze-working', 'iron-working'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const bought = engine.applyCommand(state, { type: 'buy', playerId: 'p1', cityId: 'c1' });
  assert.strictEqual(bought.ok, true);
  assert.strictEqual(bought.state.players.p1.gold, 100 - 2, 'one missing shield x 2 gold');
  const done = engine.applyCommand(bought.state, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(done.units.u1.type, 'legion', 'completed at the discounted cost');
});

test('veteranUnit: Zulu militia are born veterans', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'Z', owner: 'p1', x: 1, y: 1, pop: 1, food: 0, shields: 10, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'Zulus', color: '#b0632f', human: true, civ: 'zulus', gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const done = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(done.units.u1.veteran, true, 'impi spirit');
});
