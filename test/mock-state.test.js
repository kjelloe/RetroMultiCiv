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
