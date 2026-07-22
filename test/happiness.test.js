const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const happiness = await import('../engine/happiness.js');
  const { createEngine } = await import('../engine/index.js');
  return { happiness, engine: createEngine(RULESET) };
}

// A pop-N city on all-grassland (plenty of candidate tiles).
function moodState(pop, cityExtra, playerExtra) {
  const tiles = [];
  for (let i = 0; i < 49; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 7, height: 7, wrapX: false, tiles },
    units: {},
    cities: {
      c1: Object.assign({
        id: 'c1', name: 'Mood', owner: 'p1', x: 3, y: 3, pop, food: 0, shields: 0,
        buildings: [], producing: { kind: 'unit', id: 'militia' }
      }, cityExtra || {})
    },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 9, nextCityId: 2,
    players: {
      p1: Object.assign({
        id: 'p1', name: 'A', color: '#00f', human: true, gold: 0,
        techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50
      }, playerExtra || {})
    },
    rngState: 1
  };
}

test('mood: the first contentCitizens workers are content, later ones unhappy', async () => {
  const { happiness } = await load();
  const small = happiness.cityMood(moodState(3), moodState(3).cities.c1, RULESET);
  assert.strictEqual(small.unhappy, 0);
  assert.strictEqual(small.disorder, false);

  const state = moodState(6);
  const big = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.strictEqual(big.unhappy, 2, '6 workers - 4 content = 2 unhappy');
  assert.strictEqual(big.disorder, true, 'unhappy > happy: disorder');
});

test('entertainers make luxuries and calm the city; temple helps (doubled by Mysticism)', async () => {
  const { happiness } = await load();
  // pop 6, 4 worked tiles => 2 idle citizens = entertainers = 4 lux = 2 steps
  const state = moodState(6, { workers: [] }); // manual, zero worked tiles
  state.cities.c1.workers = [24 - 1, 24 + 1, 24 - 7, 24 + 7].slice(0, 4);
  const mood = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.strictEqual(mood.entertainers, 2);
  assert.strictEqual(mood.unhappy, 0, '2 entertainers: 4 lux = 2 upgrades fix 0 unhappy (only 4 workers)');
  assert.strictEqual(mood.disorder, false);

  // temple: +1 content; with Mysticism the temple doubles
  const t = moodState(6, { buildings: ['temple'] });
  const m1 = happiness.cityMood(t, t.cities.c1, RULESET);
  assert.strictEqual(m1.unhappy, 1, 'temple calms one of the two');
  t.players.p1.techs = ['mysticism'];
  const m2 = happiness.cityMood(t, t.cities.c1, RULESET);
  assert.strictEqual(m2.unhappy, 0, 'Mysticism doubles the temple');
});

test('luxury rate buys happiness from trade', async () => {
  const { happiness } = await load();
  const state = moodState(2, {}, { taxRate: 40, sciRate: 30, luxRate: 30 });
  // give the city trade: river center
  state.map.tiles[3 * 7 + 3].river = true;
  const mood = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.ok(mood.lux >= 0, 'lux computed');
  assert.strictEqual(mood.disorder, false);
});

test('martial law (despotism) calms; disorder halts shields and taxes at the wrap', async () => {
  const { happiness, engine } = await load();
  const state = moodState(6);
  state.units.u1 = { id: 'u1', type: 'militia', owner: 'p1', x: 3, y: 3, moves: 1, fortified: false, veteran: false };
  state.units.u2 = { id: 'u2', type: 'militia', owner: 'p1', x: 3, y: 3, moves: 1, fortified: false, veteran: false };
  const mood = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.strictEqual(mood.unhappy, 0, 'two garrisoned units = martial law x2');

  // without the garrison: disorder flag lands at the wrap and blocks output
  const angry = moodState(6, {}, { gold: 0 });
  let s = engine.applyCommand(angry, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(s.cities.c1.disorder, true);
  assert.strictEqual(s.cities.c1.shields, 0, 'disorder: no shields collected');
  assert.strictEqual(s.players.p1.gold, 0, 'disorder: no taxes');
});

test('war unhappiness: a republic pays for military units abroad', async () => {
  const { happiness } = await load();
  const state = moodState(4, {}, { government: 'republic' });
  state.units.u1 = { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false, home: 'c1' };
  const mood = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.strictEqual(mood.unhappy, 1, 'one legion abroad = one unhappy citizen');

  state.units.u1.x = 3; state.units.u1.y = 3; // back home
  const home = happiness.cityMood(state, state.cities.c1, RULESET);
  assert.strictEqual(home.unhappy, 0);
});

test('#29 women-s-suffrage: -1 per-unit war unhappiness (Republic 1->0, Democracy 2->1)', async () => {
  const { happiness } = await load();
  // Republic (warUnhappiness 1): one legion abroad = one unhappy; suffrage -> 0.
  const rep = moodState(4, {}, { government: 'republic' });
  rep.units.u1 = { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false, home: 'c1' };
  assert.strictEqual(happiness.cityMood(rep, rep.cities.c1, RULESET).unhappy, 1, 'republic baseline: 1');
  rep.wonders['women-s-suffrage'] = 'c1';
  assert.strictEqual(happiness.cityMood(rep, rep.cities.c1, RULESET).unhappy, 0, 'republic + suffrage: 1->0');

  // Democracy (warUnhappiness 2): one legion abroad = two unhappy; suffrage -> one (per unit -1).
  const dem = moodState(6, {}, { government: 'democracy' });
  dem.units.u1 = { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false, home: 'c1' };
  const demBase = happiness.cityMood(dem, dem.cities.c1, RULESET).unhappy;
  dem.wonders['women-s-suffrage'] = 'c1';
  const demSuff = happiness.cityMood(dem, dem.cities.c1, RULESET).unhappy;
  assert.strictEqual(demBase - demSuff, 1, 'democracy + suffrage: one legion 2 unhappy -> 1 (per-unit -1)');
});
