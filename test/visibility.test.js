const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const TERRAIN = RULESET.terrain;
const UNITS = RULESET.units;

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];
const SETUP = { seed: 7, options: { width: 40, height: 30, players: PLAYERS } };

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const vis = await import('../engine/visibility.js');
  return { engine: createEngine(RULESET), vis };
}

test('createGame initializes fog: starts revealed, most of the world unknown', async () => {
  const { engine, vis } = await load();
  const state = engine.createGame(SETUP);
  const view = vis.filterView(state, 'p1');
  const u1 = Object.values(state.units).find(u => u.owner === 'p1');

  const at = (x, y) => view.map.tiles[y * view.map.width + x];
  assert.notStrictEqual(at(u1.x, u1.y).t, 'unknown', 'own start tile must be revealed');
  assert.strictEqual(at(u1.x, u1.y).visible, true);

  let unknown = 0;
  for (const t of view.map.tiles) { if (t.t === 'unknown') unknown++; }
  assert.ok(unknown > view.map.tiles.length / 2, 'most of a fresh world is unknown');
});

test('filterView hides enemy units outside sight and strips secrets', async () => {
  const { engine, vis } = await load();
  const state = engine.createGame(SETUP);
  const view = vis.filterView(state, 'p1');

  const mine = Object.values(view.units).filter(u => u.owner === 'p1');
  const theirs = Object.values(view.units).filter(u => u.owner === 'p2');
  assert.strictEqual(mine.length, 1, 'own settlers visible');
  assert.strictEqual(theirs.length, 0, 'enemy settlers (far away) hidden');

  assert.strictEqual(view.rngState, undefined, 'rngState must never reach a view');
  assert.strictEqual(view.players.p2.gold, undefined, 'enemy internals hidden');
  assert.strictEqual(view.players.p1.gold, 0, 'own internals present');
  assert.strictEqual(view.players.p2.explored, undefined, 'RIVAL explored arrays stay server-side');
  // the view carries what the client needs without shims (phase-3 remote
  // session): own fog knowledge, world-news wonders, and the founding
  // order of VISIBLE cities only
  assert.deepStrictEqual(view.players.p1.explored, state.players.p1.explored,
    'own explored array travels with the view');
  assert.deepStrictEqual(view.wonders, {}, 'wonders map present (empty at start)');
  assert.deepStrictEqual(view.cityOrder, [], 'cityOrder present (no cities yet)');
});

test('view cityOrder lists only visible cities; wonders are world news', async () => {
  const { engine, vis } = await load();
  const state = engine.createGame(SETUP);
  // a rival city far outside p1's sight, and one wonder somewhere
  const far = { id: 'c9', name: 'Hidden', owner: 'p2', x: 0, y: 0, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
  const p1u = Object.values(state.units).find(u => u.owner === 'p1');
  far.x = (p1u.x + 12) % state.map.width; // far from p1's revealed start
  state.cities.c9 = far;
  state.cityOrder.push('c9');
  state.wonders.pyramids = 'c9';
  const view = vis.filterView(state, 'p1');
  assert.strictEqual(view.cities.c9, undefined, 'the far city is not in view');
  assert.deepStrictEqual(view.cityOrder, [],
    'cityOrder must not reveal that hidden cities exist');
  assert.strictEqual(view.wonders.pyramids, 'c9',
    'wonder completions are public news even when the home city is unseen');
});

test('explored terrain is remembered after the unit moves away', async () => {
  const { engine, vis } = await load();
  let state = engine.createGame(SETUP);
  const u1 = Object.values(state.units).find(u => u.owner === 'p1');
  const startX = u1.x, startY = u1.y;

  // walk east twice (end turns to refresh moves)
  for (const dir of ['E', 'E']) {
    let res = engine.applyCommand(state, { type: 'moveUnit', playerId: 'p1', unitId: u1.id, dir });
    if (res.ok) state = res.state;
    res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
    state = res.state;
    res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p2' });
    state = res.state;
  }

  const view = vis.filterView(state, 'p1');
  const tile = view.map.tiles[startY * view.map.width + startX];
  assert.notStrictEqual(tile.t, 'unknown', 'start tile stays explored');
  const moved = state.units[u1.id];
  if (moved.x !== startX || moved.y !== startY) {
    // outside the unit's new sight radius the old tile may be dimmed
    assert.ok(tile.visible === true || tile.visible === false);
  }
});

test('view projection: a rival city on explored ground is only its outside', async () => {
  const { engine, vis } = await load();
  const state = engine.createGame(SETUP);
  // put an enemy city with secrets on p1's own start tile (fully explored)
  const u1 = Object.values(state.units).find(u => u.owner === 'p1');
  state.cities.c9 = {
    id: 'c9', name: 'Rivaltown', owner: 'p2', x: u1.x, y: u1.y, pop: 4,
    food: 17, shields: 9, buildings: ['city-walls', 'granary', 'barracks'],
    producing: { kind: 'unit', id: 'phalanx' }, workers: [3], taxmen: 1, disorder: true
  };
  state.cityOrder.push('c9');

  const view = vis.filterView(state, 'p1');
  const seen = view.cities.c9;
  assert.ok(seen, 'the city itself is visible on explored ground');
  assert.strictEqual(seen.name, 'Rivaltown');
  assert.strictEqual(seen.pop, 4, 'size is public (the map badge shows it)');
  assert.deepStrictEqual(seen.buildings, ['city-walls'], 'only physical structures show');
  assert.strictEqual(seen.producing, undefined, 'production is secret');
  assert.strictEqual(seen.food, undefined, 'the food box is secret');
  assert.strictEqual(seen.shields, undefined);
  assert.strictEqual(seen.workers, undefined);
  assert.strictEqual(seen.taxmen, undefined);
  assert.strictEqual(seen.disorder, undefined);
  // the canonical state is untouched by the projection
  assert.strictEqual(state.cities.c9.producing.id, 'phalanx');

  // the owner's own view still carries everything
  const ownView = vis.filterView(state, 'p2');
  if (ownView.cities.c9) assert.strictEqual(ownView.cities.c9.producing.id, 'phalanx');
});

test('view projection: own player carries rates/government, rivals never do', async () => {
  const { engine, vis } = await load();
  const state = engine.createGame(SETUP);
  state.players.p1.luxRate = 20;
  state.players.p1.government = 'monarchy';
  state.players.p2.government = 'republic';
  state.players.p2.bulbs = 99;

  const view = vis.filterView(state, 'p1');
  assert.strictEqual(view.players.p1.taxRate, 50, 'own rates present');
  assert.strictEqual(view.players.p1.luxRate, 20);
  assert.strictEqual(view.players.p1.government, 'monarchy');
  assert.strictEqual(view.players.p2.government, undefined, 'rival government hidden');
  assert.strictEqual(view.players.p2.bulbs, undefined, 'rival research hidden');
  assert.strictEqual(view.players.p2.taxRate, undefined);
});

test('omniscient fallback: players without explored arrays see everything', async () => {
  const { vis } = await load();
  const state = {
    turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 2, height: 1, wrapX: false, tiles: [{ t: 'grassland' }, { t: 'ocean' }] },
    units: {}, cities: {},
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: true, gold: 0, techs: [], researching: '' } }
  };
  const view = vis.filterView(state, 'p1');
  assert.strictEqual(view.map.tiles[0].t, 'grassland');
  assert.strictEqual(view.map.tiles[0].visible, true);
});
