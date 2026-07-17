const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Terrain ids come from the ruleset — the renderer's TERRAIN map must match.
const TERRAINS = Object.keys(require('../data/terrain.json').terrains);
const IMPASSABLE = ['ocean', 'arctic'];

const state = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'client', 'mock-state.json'), 'utf8')
);

test('mock state: map is consistent', () => {
  const { width, height, tiles } = state.map;
  assert.strictEqual(tiles.length, width * height);
  for (const tile of tiles) {
    assert.ok(TERRAINS.includes(tile.t), `unknown terrain "${tile.t}"`);
  }
});

test('mock state: units are on legal tiles and owned by known players', () => {
  const { width, height, tiles } = state.map;
  for (const u of Object.values(state.units)) {
    assert.ok(u.x >= 0 && u.x < width && u.y >= 0 && u.y < height, `${u.id} out of bounds`);
    const terrain = tiles[u.y * width + u.x].t;
    assert.ok(!IMPASSABLE.includes(terrain), `${u.id} standing on ${terrain}`);
    assert.ok(state.players[u.owner], `${u.id} has unknown owner ${u.owner}`);
    assert.strictEqual(u.id, Object.keys(state.units).find(k => state.units[k] === u));
  }
});

test('mock state: global fields are sane', () => {
  assert.ok(state.players[state.activePlayer], 'activePlayer must exist');
  assert.ok(Number.isInteger(state.rngState), 'rngState must be an integer');
  assert.ok(Number.isInteger(state.turn) && state.turn >= 1);
});

// terrain.js is browser ESM (imports 'three' via the import map), so the
// coverage check reads its TERRAIN table from source: a terrain added to
// data/terrain.json without a height/palette entry would silently render
// as grassland otherwise.
test('renderer terrain table covers every ruleset terrain (terrain.js)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'client', 'renderer', 'three', 'terrain.js'), 'utf8');
  const table = src.match(/const TERRAIN = \{([\s\S]*?)\n\};/);
  assert.ok(table, 'terrain.js must define its TERRAIN table');
  const ids = [...table[1].matchAll(/^\s*([a-z]+):\s*\{/gm)].map(m => m[1]);
  for (const t of TERRAINS) assert.ok(ids.includes(t), `terrain.js TERRAIN missing "${t}"`);
  assert.ok(ids.includes('unknown'), 'terrain.js must style fogged (unknown) tiles');
});

// A36: the five growth tiers (assets.js CITY_TIERS, source-parsed like the
// TERRAIN table above) — every Civ 1 population must map to a tier, the
// breakpoints ascend from pop 1, and density/height grow with the tier
// (a silently missing tier would render every big city as a hamlet).
test('renderer city growth tiers cover pop 1..40+ and grow monotonically (assets.js)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'client', 'renderer', 'three', 'assets.js'), 'utf8');
  const table = src.match(/const CITY_TIERS = \[([\s\S]*?)\n\];/);
  assert.ok(table, 'assets.js must define its CITY_TIERS table');
  const tiers = [...table[1].matchAll(/minPop:\s*(\d+),\s*houses:\s*(\d+),\s*scale:\s*([\d.]+)/g)]
    .map(m => ({ minPop: Number(m[1]), houses: Number(m[2]), scale: Number(m[3]) }));
  assert.strictEqual(tiers.length, 5, 'five growth tiers (VI.14)');
  assert.strictEqual(tiers[0].minPop, 1, 'tier 1 starts at pop 1 — no unmapped populations');
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i].minPop > tiers[i - 1].minPop, `breakpoints ascend (${i})`);
    assert.ok(tiers[i].houses > tiers[i - 1].houses, `density grows (${i})`);
    assert.ok(tiers[i].scale > tiers[i - 1].scale, `height grows (${i})`);
  }
  assert.ok(tiers[tiers.length - 1].minPop <= 40, 'the top tier is reachable in a real game');
});

// A44 (ally round 4): every unit type must map to a REAL silhouette — a
// class table, or one of the explicitly special-cased builders. Nothing may
// silently ride fallbackToken (the ally's tank/submarine worry: armor and
// submarine ARE special-cased; this guard keeps it that way as types grow).
test('renderer silhouette coverage: every data/units.json type maps in UNIT_SILHOUETTE (no fallback)', () => {
  const UNITS = Object.keys(require('../data/units.json'));
  // A88b: the type→silhouette mapping is DATA now (UNIT_SILHOUETTE, exported to
  // data/assets/asset-recipes.json); the data-driven createUnitMesh reads it, so
  // any type absent here would render as the generic fallback token.
  const { unitSilhouette } = require('../data/assets/asset-recipes.json');
  const missing = UNITS.filter(u => !unitSilhouette[u]);
  assert.deepStrictEqual(missing, [],
    `Missing UNIT_SILHOUETTE mapping (would render as the generic fallback token): ${missing.join(', ')}`);
});
