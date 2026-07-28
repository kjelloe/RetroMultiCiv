// W6 build-doctrine slice-3A (specs/build-doctrine-plan.md; §3/§3a roles):
// deterministic city ROLES from geography + empire context —
//   frontline (threatened) blocks the science list ("walls ONLY in frontline"),
//   production = top-shield cities (barracks -> factory -> best plant),
//   science = top-trade of the rest (library -> marketplace -> university -> bank),
//   spawner = high-food/low-shield (settler-cap headroom),
//   plus the happiness LADDER (disorder with temple built climbs to colosseum).
// Fixture-first for the slice-3 golden window; knobs in rules.cityRoles.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

// A crafted empire: each city fully garrisoned (2 fortified guards) and the
// settler loop saturated (parked settlers at the empire cap) so the cascade
// reaches the econ/role pick. `ring` paints the 8 tiles around a city.
function rolesState(techs, cityDefs, settlerCount) {
  const width = 14, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  const units = {};
  const cities = {};
  const cityOrder = [];
  let un = 1;
  for (const d of cityDefs) {
    const c = Object.assign({
      id: d.id, name: d.id, owner: 'p1', x: d.x, y: d.y, pop: 3, food: 0, shields: 0,
      buildings: [], producing: { kind: 'unit', id: 'militia' }
    }, d.extra || {});
    cities[d.id] = c; cityOrder.push(d.id);
    if (d.ring !== undefined) {
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        tiles[(d.y + dy) * width + (d.x + dx)] = Object.assign({}, d.ring);
      }
    }
    for (let g = 0; g < 2; g++) {
      const id = 'g' + un; un = un + 1;
      units[id] = { id, type: 'militia', owner: 'p1', x: d.x, y: d.y, moves: 0, fortified: true, veteran: false };
    }
  }
  for (let s = 0; s < settlerCount; s++) {
    const id = 's' + un; un = un + 1;
    units[id] = { id, type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  }
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 90, nextCityId: 20,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs, researching: 'pottery', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

const MINED_MOUNTAIN = { t: 'mountains', mine: true }; // 2 shields/tile -> clearly production

test('slice-3A: the role knobs exist in rules.json (numbers in data, not engine)', () => {
  const r = RULESET.rules.cityRoles;
  assert.ok(r !== undefined, 'rules.cityRoles missing');
  assert.ok(Number.isInteger(r.prodCities) && r.prodCities > 0);
  assert.ok(Number.isInteger(r.sciCities) && r.sciCities > 0);
  assert.ok(Number.isInteger(r.citiesPerRoleSlot) && r.citiesPerRoleSlot > 0);
  assert.ok(Number.isInteger(r.spawnerFoodSurplus) && r.spawnerFoodSurplus > 0);
  assert.ok(Number.isInteger(r.spawnerMaxShields) && r.spawnerMaxShields > 0);
  assert.ok(Array.isArray(r.productionBuildings) && Array.isArray(r.productionBuildings[0]));
  assert.ok(Array.isArray(r.scienceBuildings) && Array.isArray(r.scienceBuildings[0]));
  assert.ok(Array.isArray(RULESET.rules.buildDoctrine.happinessLadder));
});

test('slice-3A: a PRODUCTION city (top shields, doctrine done, barracks up) builds the factory', async () => {
  const { ai, engine } = await load();
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'currency', 'industrialization'],
    [{ id: 'c1', x: 4, y: 4, ring: MINED_MOUNTAIN, extra: { buildings: ['granary', 'temple', 'barracks'] } }],
    2);
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c1.producing, { kind: 'building', id: 'factory' },
    'role list beats cheapest-missing (marketplace 80): §3 factory-era concentration');
});

test('slice-3A: the production PLANT tier picks by tech preference, one plant only', async () => {
  const { ai, engine } = await load();
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'currency', 'industrialization', 'electronics', 'refining'],
    [{ id: 'c1', x: 4, y: 4, ring: MINED_MOUNTAIN, extra: { buildings: ['granary', 'temple', 'barracks', 'factory'] } }],
    2);
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c1.producing, { kind: 'building', id: 'hydro-plant' },
    'hydro preferred over the coal plant (§3: "coal plant worst-case"), cheapest-missing would say power-plant/marketplace');
});

test('slice-3A: the runner-up city takes the SCIENCE role (library ladder -> university)', async () => {
  const { ai, engine } = await load();
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'writing', 'currency', 'university', 'code-of-laws'],
    [
      { id: 'c1', x: 3, y: 4, ring: MINED_MOUNTAIN, extra: { buildings: ['granary', 'temple'] } },
      { id: 'c2', x: 9, y: 4, extra: { buildings: ['granary', 'temple', 'library', 'marketplace'] } }
    ],
    3);
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c2.producing, { kind: 'building', id: 'university' },
    'science role climbs its ladder; cheapest-missing would say courthouse (80 < 160)');
});

test('slice-3A: a THREATENED city is FRONTLINE — the science list is blocked there', async () => {
  const { ai, engine } = await load();
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'writing', 'currency', 'university', 'code-of-laws', 'masonry'],
    [
      { id: 'c1', x: 3, y: 4, ring: MINED_MOUNTAIN, extra: { buildings: ['granary', 'temple'] } },
      { id: 'c2', x: 9, y: 4, extra: { buildings: ['granary', 'temple', 'library', 'marketplace', 'city-walls', 'barracks'] } }
    ],
    3);
  state.units.e1 = { id: 'e1', type: 'legion', owner: 'p2', x: 12, y: 4, moves: 0, fortified: false, veteran: false };
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c2.producing, { kind: 'building', id: 'courthouse' },
    'frontline blocks university — §3 "walls ONLY in frontline cities" keeps investments off the border');
});

test('slice-3A: a SPAWNER city (high food, low shields) gets settler-cap headroom', async () => {
  const { ai, engine } = await load();
  // monarchy (no despotism cap) + irrigated ring -> big surplus, ~0 shields;
  // settlers parked AT the normal cap (1 city -> 2): a spawner builds one more.
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'monarchy', 'currency'],
    [{ id: 'c1', x: 4, y: 4, ring: { t: 'grassland', irrigation: true }, extra: { pop: 4, buildings: ['granary', 'temple'] } }],
    2);
  state.players.p1.government = 'monarchy';
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c1.producing.id, 'settlers',
    'the spawner keeps the settler loop alive past the empire cap (§3)');
});

test('slice-3A: the happiness LADDER — disorder with the temple built climbs to colosseum', async () => {
  const { ai, engine } = await load();
  const state = rolesState(
    ['pottery', 'ceremonial-burial', 'construction'],
    [{ id: 'c1', x: 4, y: 4, extra: { pop: 6, disorder: true, buildings: ['granary', 'temple'] } }],
    2);
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c1.producing, { kind: 'building', id: 'colosseum' },
    'happiness is never optional: the ladder walks temple -> colosseum on persistent disorder');
});
