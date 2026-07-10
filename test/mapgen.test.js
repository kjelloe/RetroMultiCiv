const test = require('node:test');
const assert = require('node:assert');

const TERRAIN = require('../data/terrain.json');
const UNITS = require('../data/units.json');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  return { engine: createEngine({ terrain: TERRAIN, units: UNITS }), hashState };
}

const SETUP = { seed: 42, options: { width: 80, height: 50, players: PLAYERS } };

test('createGame is deterministic: same seed, identical state hash', async () => {
  const { engine, hashState } = await load();
  const a = engine.createGame(SETUP);
  const b = engine.createGame(SETUP);
  assert.strictEqual(hashState(a), hashState(b));
});

test('createGame: different seeds give different worlds', async () => {
  const { engine, hashState } = await load();
  const a = engine.createGame({ ...SETUP, seed: 42 });
  const b = engine.createGame({ ...SETUP, seed: 43 });
  assert.notStrictEqual(hashState(a), hashState(b));
});

test('createGame: world invariants hold', async () => {
  const { engine } = await load();
  const state = engine.createGame(SETUP);
  const { width, height, tiles } = state.map;
  assert.strictEqual(tiles.length, width * height);

  let land = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x].t;
      assert.ok(TERRAIN.terrains[t], `unknown terrain "${t}" at ${x},${y}`);
      if (y === 0 || y === height - 1) assert.strictEqual(t, 'arctic', 'poles must be arctic');
      if (t !== 'ocean') land++;
    }
  }
  const landPct = Math.floor((land * 100) / tiles.length);
  assert.ok(landPct >= 15 && landPct <= 55, `land fraction ${landPct}% out of range`);
});

test('createGame: each player starts with settlers on good land', async () => {
  const { engine } = await load();
  const state = engine.createGame(SETUP);
  assert.deepStrictEqual(state.playerOrder, ['p1', 'p2']);
  assert.strictEqual(state.activePlayer, 'p1');
  assert.ok(Number.isInteger(state.rngState) && state.rngState > 0);

  const byOwner = {};
  for (const u of Object.values(state.units)) {
    assert.strictEqual(u.type, 'settlers');
    assert.strictEqual(u.moves, UNITS.settlers.moves);
    const terrain = state.map.tiles[u.y * state.map.width + u.x].t;
    assert.ok(terrain === 'grassland' || terrain === 'plains', `start on ${terrain}`);
    byOwner[u.owner] = (byOwner[u.owner] || 0) + 1;
  }
  assert.deepStrictEqual(byOwner, { p1: 1, p2: 1 });
});

test('createGame output is a legal engine state (settlers can act)', async () => {
  const { engine } = await load();
  const state = engine.createGame(SETUP);
  // end both turns: must succeed and refresh moves
  const e1 = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(e1.ok, true);
  const e2 = engine.applyCommand(e1.state, { type: 'endTurn', playerId: 'p2' });
  assert.strictEqual(e2.ok, true);
  assert.strictEqual(e2.state.turn, 2);
});
