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
  assert.strictEqual(view.players.p2.explored, undefined, 'explored arrays stay server-side');
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
