const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const TERRAIN = RULESET.terrain;
const UNITS = RULESET.units;

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  return { engine: createEngine(RULESET), hashState };
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

// A82a: named map-type presets (rules.mapTypes). The crafted table below is
// the blessed preset set; the committed data/rules.json block carries the same
// numbers (phase-2 paste — these rows pin the resolve contract either way).
const MAPTYPES = {
  continents: { landPercent: 32, continents: 5 },
  pangaea: { landPercent: 36, continents: 1 },
  archipelago: { landPercent: 20, continents: 20 },
  islands: { landPercent: 14, continents: 24 }
};

async function loadWithPresets() {
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  const ruleset = Object.assign({}, RULESET, {
    rules: Object.assign({}, RULESET.rules, { mapTypes: MAPTYPES })
  });
  return { engine: createEngine(ruleset), hashState };
}

test('A82a: the continents preset is the identity — byte-identical world', async () => {
  const { engine: plain, hashState } = await load();
  const { engine: preset } = await loadWithPresets();
  const base = hashState(plain.createGame(SETUP));
  // the mapTypes table being present changes nothing without a mapType…
  assert.strictEqual(hashState(preset.createGame(SETUP)), base);
  // …and naming the default preset resolves to the same DEFAULTS values
  const named = preset.createGame({ seed: 42, options: { ...SETUP.options, mapType: 'continents' } });
  assert.strictEqual(hashState(named), base);
});

test('A82a: pangaea/archipelago/islands are deterministic and pairwise distinct', async () => {
  const { engine, hashState } = await loadWithPresets();
  const hashes = {};
  for (const type of ['continents', 'pangaea', 'archipelago', 'islands']) {
    const mk = () => engine.createGame({ seed: 42, options: { ...SETUP.options, mapType: type } });
    const h = hashState(mk());
    assert.strictEqual(hashState(mk()), h, `${type} not deterministic`);
    hashes[type] = h;
  }
  const values = Object.values(hashes);
  assert.strictEqual(new Set(values).size, values.length, 'preset worlds must differ');
});

test('A82a: explicit landPercent/continents beat the preset', async () => {
  const { engine, hashState } = await loadWithPresets();
  const base = hashState(engine.createGame(SETUP));
  const forced = engine.createGame({
    seed: 42,
    options: { ...SETUP.options, mapType: 'pangaea', landPercent: 32, continents: 5 }
  });
  assert.strictEqual(hashState(forced), base, 'explicit overrides must win');
});

test('A82a: an unknown mapType falls back to the default world', async () => {
  const { engine, hashState } = await loadWithPresets();
  const base = hashState(engine.createGame(SETUP));
  const odd = engine.createGame({ seed: 42, options: { ...SETUP.options, mapType: 'doughnut' } });
  assert.strictEqual(hashState(odd), base);
});
