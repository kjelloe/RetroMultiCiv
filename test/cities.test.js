const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const TERRAIN = RULESET.terrain;
const UNITS = RULESET.units;

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

test('workedTiles: center first, then pop best tiles; sums match cityYields', async () => {
  const { cities } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'plains' });
  tiles[6] = { t: 'grassland', special: true }; // best candidate
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 2, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const worked = cities.workedTiles(state, state.cities.c1, RULESET);
  assert.strictEqual(worked.length, 3, 'center + pop tiles');
  assert.strictEqual(worked[0].center, true);
  assert.deepStrictEqual({ x: worked[0].x, y: worked[0].y }, { x: 2, y: 2 });
  assert.deepStrictEqual({ x: worked[1].x, y: worked[1].y }, { x: 1, y: 1 }, 'shield grassland picked first');

  const sums = { food: 0, shields: 0, trade: 0 };
  for (const w of worked) { sums.food += w.yields.food; sums.shields += w.yields.shields; sums.trade += w.yields.trade; }
  assert.deepStrictEqual(cities.cityYields(state, state.cities.c1, RULESET), sums);
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

test('starvation trims specialists that would outnumber the shrunken pop', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'mountains' }); // 0 food anywhere
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      // pop 5, all idle: 2 taxmen + 3 scientists (sum 5 = pop, legal)
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 1, y: 1, pop: 5, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' }, workers: [], taxmen: 2, scientists: 3 }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.ok, true);
  const c = res.state.cities.c1;
  assert.strictEqual(c.pop, 4, 'no food: starved');
  assert.strictEqual((c.taxmen || 0) + (c.scientists || 0) <= c.pop, true,
    `specialists ${c.taxmen}/${c.scientists} must fit pop ${c.pop}`);
  assert.strictEqual(c.scientists, 2, 'scientists trimmed first');
  assert.strictEqual(c.taxmen, 2);
});

test('aqueduct gates growth past pop 10; granary halves the food box', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 49; i++) tiles.push({ t: 'grassland', special: true });
  const mkState = (buildings) => ({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 7, height: 7, wrapX: false, tiles: tiles.map(t => ({ ...t })) },
    units: {}, cities: {
      c1: { id: 'c1', name: 'Metro', owner: 'p1', x: 3, y: 3, pop: 10, food: 108, shields: 0, buildings, producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  });
  // shield-grassland everywhere: center 2 food + 10 worked × 2 = 22, eats 20 => +2/turn
  const blocked = engine.applyCommand(mkState([]), { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(blocked.state.cities.c1.pop, 10, 'no growth past 10 without aqueduct');
  assert.strictEqual(blocked.state.cities.c1.food, 110, 'food box capped at threshold');

  const grown = engine.applyCommand(mkState(['aqueduct', 'granary']), { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(grown.state.cities.c1.pop, 11);
  assert.strictEqual(grown.state.cities.c1.food, 55, 'granary keeps half the box (110/2)');
});

test('barracks makes newly built units veterans', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland', special: true });
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'Fort', owner: 'p1', x: 1, y: 1, pop: 1, food: 0, shields: 9, buildings: ['barracks'], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 5, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.units.u5.veteran, true, 'barracks-trained militia is veteran');
});

test('setWorkers: manual tile assignment overrides greedy, validates, resets', async () => {
  const { cities, engine } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'plains' });     // 1/1/0
  tiles[6] = { t: 'grassland', special: true };                  // 2/1/0 — greedy pick
  tiles[8] = { t: 'ocean' };                                     // 1/0/2 — trade choice
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 2, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  // auto: greedy works the shield grassland — the only trade is the city
  // square's own (roaded & irrigated, Civ 1) +1 capital bonus (VI.2 —
  // a lone city IS its owner's capital)
  assert.strictEqual(cities.cityYields(state, state.cities.c1, RULESET).trade, 2);

  // manual: work the ocean instead (idx 8) — optimize for trade
  const res = engine.applyCommand(state, { type: 'setWorkers', playerId: 'p1', cityId: 'c1', workers: [8] });
  assert.strictEqual(res.ok, true);
  const y = cities.cityYields(res.state, res.state.cities.c1, RULESET);
  assert.strictEqual(y.trade, 4, 'ocean worked manually (+ the roaded, capital-bonused city square)');
  assert.strictEqual(y.shields, 1, 'only the plains center shield remains — grassland released');

  // validation: too many workers, bad tile index, duplicates
  assert.strictEqual(engine.applyCommand(state, { type: 'setWorkers', playerId: 'p1', cityId: 'c1', workers: [6, 8] }).reason, 'badWorkers');
  assert.strictEqual(engine.applyCommand(state, { type: 'setWorkers', playerId: 'p1', cityId: 'c1', workers: [12] }).reason, 'badWorkers', 'center is not assignable');
  assert.strictEqual(engine.applyCommand(state, { type: 'setWorkers', playerId: 'p1', cityId: 'c1', workers: [99] }).reason, 'badWorkers');

  // reset to automatic
  const auto = engine.applyCommand(res.state, { type: 'setWorkers', playerId: 'p1', cityId: 'c1', auto: true });
  assert.strictEqual(auto.state.cities.c1.workers, undefined);
});

test('manual workers: growth assigns the new citizen to the best free tile', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland', special: true });
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 2, y: 2, pop: 1, food: 19, shields: 0, buildings: [], workers: [7], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  // center 2 + worked 2 = 4 food, eats 2 => +2 → 21 ≥ 20: grows
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.cities.c1.pop, 2);
  assert.strictEqual(res.state.cities.c1.workers.length, 2, 'new citizen got a tile');
  assert.strictEqual(res.state.cities.c1.workers[0], 7, 'existing assignment kept');
});

test('factory chain: +50% shields, doubled by a power source', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'plains' }); // 1 shield each
  const base = (buildings) => ({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'F', owner: 'p1', x: 2, y: 2, pop: 4, food: 0, shields: 0, buildings, producing: { kind: 'unit', id: 'battleship' } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: ['steel'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  });
  // pop 4 on plains: center + 4 tiles = 5 shields/turn raw
  const plain = engine.applyCommand(base([]), { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(plain.cities.c1.shields, 5);
  const factory = engine.applyCommand(base(['factory']), { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(factory.cities.c1.shields, 7, '5 + 50% (floored)');
  const powered = engine.applyCommand(base(['factory', 'power-plant']), { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(powered.cities.c1.shields, 10, '5 + 100%');
  const plantOnly = engine.applyCommand(base(['power-plant']), { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(plantOnly.cities.c1.shields, 5, 'a plant without a factory boosts nothing');
});

test('buy: wonders cost the wonder rate; exact-gold purchase succeeds', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'plains' });
  const wonderId = Object.keys(RULESET.wonders).sort()[0];
  const wonder = RULESET.wonders[wonderId];
  const price = (wonder.cost - 5) * RULESET.rules.buyGoldPerShieldWonder;
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'T', owner: 'p1', x: 2, y: 2, pop: 1, food: 0, shields: 5, buildings: [], producing: { kind: 'wonder', id: wonderId } }
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: price - 1, techs: [wonder.tech], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const short = engine.applyCommand(state, { type: 'buy', playerId: 'p1', cityId: 'c1' });
  assert.strictEqual(short.reason, 'notEnoughGold', 'one gold short at the wonder rate');

  state.players.p1.gold = price;
  const bought = engine.applyCommand(state, { type: 'buy', playerId: 'p1', cityId: 'c1' });
  assert.strictEqual(bought.ok, true);
  assert.strictEqual(bought.state.players.p1.gold, 0);
  assert.strictEqual(bought.state.cities.c1.shields, wonder.cost);
});

test('wonder race: only one civilization gets the wonder; the loser keeps shields', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland', special: true });
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 0, y: 0, pop: 1, food: 0, shields: 299, buildings: [], producing: { kind: 'wonder', id: 'pyramids' } },
      c2: { id: 'c2', name: 'B', owner: 'p1', x: 2, y: 2, pop: 1, food: 0, shields: 299, buildings: [], producing: { kind: 'wonder', id: 'pyramids' } }
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 1, nextCityId: 3,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: ['masonry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.wonders.pyramids, 'c1', 'first city in cityOrder completes it');
  const lost = res.events.find(e => e.type === 'wonderLost');
  assert.ok(lost && lost.cityId === 'c2', 'second city loses the race');
  assert.ok(res.state.cities.c2.shields >= 299, 'loser keeps its shields');
  const taken = engine.applyCommand(res.state, { type: 'setProduction', playerId: 'p1', cityId: 'c2', item: { kind: 'wonder', id: 'pyramids' } });
  assert.strictEqual(taken.reason, 'wonderTaken');
});

test('Colossus adds +1 trade per worked trade tile in its own city', async () => {
  const { cities } = await load();
  // ocean ring: center river grassland (1 trade) + 1 worked ocean (2 trade)
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'ocean' });
  tiles[4] = { t: 'grassland', river: true };
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {
      c1: { id: 'c1', name: 'Rhodes', owner: 'p1', x: 1, y: 1, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: { colossus: 'c1' }, nextUnitId: 1, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const withWonder = cities.cityYields(state, state.cities.c1, RULESET);
  state.wonders = {};
  const without = cities.cityYields(state, state.cities.c1, RULESET);
  assert.strictEqual(without.trade, 4, 'river center 1 +1 capital (VI.2) + ocean 2');
  assert.strictEqual(withWonder.trade, 6, 'both worked tiles produce trade: +2');
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

test('settler food upkeep: a homed settler eats 1 food/turn; homeless is free; knob 0 = identity', async () => {
  const { createEngine } = await import('../engine/index.js');
  const engAt = (upkeep) => createEngine(Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, { settlerFoodUpkeep: upkeep }) }));
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland', special: true });
  const mk = (units) => ({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles: tiles.map(t => ({ ...t })) },
    units,
    cities: { c1: { id: 'c1', name: 'C', owner: 'p1', x: 2, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 9, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  });
  const homed = { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false, home: 'c1' } };
  const homeless = { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false } };
  const foodAfter = (eng, units) => eng.applyCommand(mk(units), { type: 'endTurn', playerId: 'p1' }).state.cities.c1.food;
  const baseline = foodAfter(engAt(0), homed); // upkeep off = identity, even with a homed settler
  assert.strictEqual(foodAfter(engAt(1), homeless), baseline, 'a homeless settler eats nothing');
  assert.strictEqual(foodAfter(engAt(1), homed), baseline - 1, 'a homed settler eats 1 food/turn');
});

test('A79 blockade: an enemy unit on a worked tile removes it from the candidates; own unit does not', async () => {
  const { cities } = await load();
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  const mk = (units) => ({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units,
    cities: { c1: { id: 'c1', name: 'C', owner: 'p1', x: 2, y: 2, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 9, nextCityId: 2,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, government: 'despotism' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, government: 'despotism' }
    },
    rngState: 1
  });
  const tileIdx = 1 * 5 + 2; // (2,1), a tile the city at (2,2) works
  const has = (st) => cities.candidateTiles(st, st.cities.c1, RULESET).some(c => c.idx === tileIdx);
  assert.ok(has(mk({})), 'no unit: the tile is a candidate');
  assert.ok(!has(mk({ z1: { id: 'z1', type: 'militia', owner: 'p2', x: 2, y: 1, moves: 0, fortified: false, veteran: false } })),
    'an enemy unit blockades the tile (dropped from candidates)');
  assert.ok(has(mk({ u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 1, moves: 0, fortified: false, veteran: false } })),
    'an own unit on a tile does NOT blockade it');
});

// manhattan-gate (#16): the nuclear unit is buildable only once nukes are ENABLED —
// the Manhattan Project (nukesEnabled effect) built anywhere, and not host-disabled.
// The 056/057 scenarios pin the reject/allow cross-language; this covers the
// nukesDisabled host TOGGLE (a rulesOverride, no scenario) + the nukesEnabled predicate.
test('manhattan-gate: nuclear gates on the Manhattan Project + the no-nukes toggle', async () => {
  const { cities } = await load();
  const { createEngine } = await import('../engine/index.js');
  const mkState = (wonders) => ({
    version: 1, turn: 5, year: 1990, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles: Array.from({ length: 9 }, () => ({ t: 'grassland' })) },
    units: {}, cities: { c1: { id: 'c1', name: 'C', owner: 'p1', x: 1, y: 1, pop: 5, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders, nextUnitId: 2, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: true, alive: true, gold: 0, techs: ['rocketry', 'nuclear-fission'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  });
  const setNuke = (rs, wonders) => createEngine(rs).applyCommand(mkState(wonders), { type: 'setProduction', playerId: 'p1', cityId: 'c1', item: { kind: 'unit', id: 'nuclear' } });
  const noNukesRules = Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, { nukesDisabled: true }) });
  // predicate
  assert.strictEqual(cities.nukesEnabled(mkState({}), RULESET), false, 'no Manhattan -> nukes off');
  assert.strictEqual(cities.nukesEnabled(mkState({ 'manhattan-project': 'c1' }), RULESET), true, 'Manhattan active -> nukes on');
  assert.strictEqual(cities.nukesEnabled(mkState({ 'manhattan-project': 'c1' }), noNukesRules), false, 'host-disabled -> nukes off even with Manhattan');
  // setProduction gate
  assert.strictEqual(setNuke(RULESET, {}).reason, 'noNukes', 'no Manhattan -> setProduction rejected');
  assert.strictEqual(setNuke(RULESET, { 'manhattan-project': 'c1' }).ok, true, 'Manhattan built -> setProduction ok');
  assert.strictEqual(setNuke(noNukesRules, { 'manhattan-project': 'c1' }).reason, 'noNukes', 'host no-nukes toggle -> rejected');
});
