// #36 river-terrain (ruling A #2522, specs/river-terrain.md): river stays a tile
// FLAG but is now placed as meandering CONTINUOUS strips (~RIVER_PCT% of land) and
// carries Civ1-authentic effects (2/0/1, +50% def, Bridge-Building road gate,
// mine-illegal — the last two already covered by the B19 tests in improvements/
// combat suites). This suite covers the window-specific pieces: the strip mapgen
// (coverage + determinism) and the land-domain audit (cityIsCoastal excludes river).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

const PLAYERS = [{ id: 'p1', name: 'A', color: '#00f', human: true }, { id: 'p2', name: 'B', color: '#f00', human: false }];

async function gen(seed, w = 40, h = 25) {
  const { createGame } = await import('../engine/mapgen.js');
  return createGame({ seed, options: { width: w, height: h, players: PLAYERS } }, RULESET).map;
}
const riverPct = (map) => {
  let land = 0, river = 0;
  for (const t of map.tiles) { if (t.t !== 'ocean' && t.t !== 'arctic') land++; if (t.river === true) river++; }
  return { land, river, pct: 100 * river / land };
};

test('river mapgen: ~10-12% of land is flagged, and never ocean/arctic/mountains/hills', async () => {
  const map = await gen(7);
  const { pct } = riverPct(map);
  assert.ok(pct >= 8 && pct <= 13, `river coverage ~11% of land, saw ${pct.toFixed(1)}%`);
  for (const t of map.tiles) {
    // fix (A) #2573: hills are excluded from FLAGGING (spring still starts there) — B19
    // forbids mining a river tile, so flagging a hill would strand its +3 mine at 0 shields.
    if (t.river === true) assert.ok(t.t !== 'ocean' && t.t !== 'arctic' && t.t !== 'mountains' && t.t !== 'hills',
      `river never flags ocean/arctic/mountains/hills (saw ${t.t})`);
  }
});

test('river mapgen is deterministic: same seed → identical river layout', async () => {
  const a = await gen(42), b = await gen(42);
  const ra = a.tiles.map(t => t.river === true ? 1 : 0).join('');
  const rb = b.tiles.map(t => t.river === true ? 1 : 0).join('');
  assert.strictEqual(ra, rb, 'the river strips reproduce byte-for-byte');
  // a DIFFERENT seed differs (the placement actually varies)
  const c = await gen(43);
  assert.notStrictEqual(ra, c.tiles.map(t => t.river === true ? 1 : 0).join(''), 'a different seed gives different rivers');
});

test('land-domain audit: cityIsCoastal EXCLUDES river (a river is not ocean)', async () => {
  const { cityIsCoastal } = await import('../engine/cities.js');
  // a city whose only adjacent water is a RIVER tile is NOT coastal.
  const tiles = []; for (let i = 0; i < 49; i++) tiles.push({ t: 'grassland' });
  tiles[3 * 7 + 4] = { t: 'grassland', river: true }; // river tile next to the city (3,3)
  const state = { map: { width: 7, height: 7, wrapX: false, tiles } };
  const city = { id: 'c1', x: 3, y: 3 };
  assert.strictEqual(cityIsCoastal(state, city, RULESET), false, 'river adjacency does NOT make a city coastal');
  // but an actual ocean neighbour does
  tiles[3 * 7 + 4] = { t: 'ocean' };
  assert.strictEqual(cityIsCoastal(state, city, RULESET), true, 'ocean adjacency still counts');
});

test('river carries Civ1 yields: +1 trade (2/0/1 on grassland) + Shield special', async () => {
  const rm = RULESET.terrain.riverModifier;
  assert.strictEqual(rm.tradeBonus, 1, 'river +1 trade → grassland 2/0/0 becomes 2/0/1');
  assert.strictEqual(rm.defenseBonus, 50, 'river +50% defense');
  assert.deepStrictEqual(rm.special.yields, { food: 2, shields: 1, trade: 1 }, 'the Shield special is 2/1/1');
});
