// W7 novelty map shapes (specs/map-shapes-w7.md): the MASK STAGE in mapgen.
// Fixture-FIRST — these assert the shapes the pre-W7 generator cannot make.
// The shipped map types are "later-Civ" shapes, not Civ 1 (Civ 1 had no map-shape
// selector, only Land Mass/Temperature/Climate/Age sliders) — the civ-mixing
// convention, flagged in the ruleset's own provenance note.
// A mask is wrap-aware in x: the world is a CYLINDER (map.wrapX is always true),
// so a shape must not seam at x=0.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const TERRAIN = RULESET.terrain;

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];
const W = 80, H = 50;

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  return { engine: createEngine(RULESET), hashState };
}

function world(engine, mapType, seed) {
  return engine.createGame({ seed: seed === undefined ? 42 : seed,
    options: { width: W, height: H, players: PLAYERS, mapType } });
}

// land = anything that is not ocean, minus the arctic polar caps the generator
// always paints on row 0 and row H-1 (they are not part of any shape).
function landTiles(state) {
  const out = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const t = state.map.tiles[y * W + x];
      if (TERRAIN.terrains[t.t].domain === 'land') out.push({ x, y });
    }
  }
  return out;
}

// wrap-aware offsets from the map centre, scaled to percent of the half-extent
// (integer math only, the same shape the engine mask uses)
function offsetPct(x, y) {
  let dx = Math.abs(x * 2 - (W - 1));
  if (W * 2 - dx < dx) dx = W * 2 - dx;
  const dy = Math.abs(y * 2 - (H - 1));
  return { dxPct: Math.floor(dx * 100 / (W - 1)), dyPct: Math.floor(dy * 100 / (H - 1)) };
}

test('W7 fractal: a broken-up world — more, smaller landmasses than pangaea', async () => {
  const { engine } = await load();
  const frac = landTiles(world(engine, 'fractal'));
  const pang = landTiles(world(engine, 'pangaea'));
  assert.ok(frac.length > 100, `fractal made land (${frac.length} tiles)`);
  // the shape claim: fractal scatters where pangaea consolidates
  const spread = (tiles) => {
    const cols = {};
    for (const t of tiles) cols[t.x] = true;
    return Object.keys(cols).length;
  };
  assert.ok(spread(frac) >= spread(pang),
    `fractal spans at least as many columns as pangaea (${spread(frac)} vs ${spread(pang)})`);
});

test('W7 oval: all land sits inside the oval mask, and there is land', async () => {
  const { engine } = await load();
  const st = world(engine, 'oval');
  const land = landTiles(st);
  assert.ok(land.length > 100, `oval made land (${land.length} tiles)`);
  for (const t of land) {
    const { dxPct, dyPct } = offsetPct(t.x, t.y);
    assert.ok(dxPct * dxPct + dyPct * dyPct <= 100 * 100,
      `land at ${t.x},${t.y} is outside the oval (${dxPct},${dyPct})`);
  }
});

test('W7 ring: a donut — land in the annulus, open sea in the middle', async () => {
  const { engine } = await load();
  const st = world(engine, 'ring');
  const land = landTiles(st);
  assert.ok(land.length > 100, `ring made land (${land.length} tiles)`);
  let inHole = 0;
  for (const t of land) {
    const { dxPct, dyPct } = offsetPct(t.x, t.y);
    if (dxPct * dxPct + dyPct * dyPct < 40 * 40) inHole++;
  }
  assert.strictEqual(inHole, 0, 'the central sea stayed open');
  // a donut, not a crescent: land on both sides of the central sea
  const mid = Math.floor(H / 2);
  assert.ok(land.some(t => t.y < mid - 5) && land.some(t => t.y > mid + 5),
    'the ring closes above and below the central sea');
});

test('W7 inland-sea: land around the rim, sea locked in the centre', async () => {
  const { engine } = await load();
  const st = world(engine, 'inland-sea');
  const land = landTiles(st);
  assert.ok(land.length > 100, `inland-sea made land (${land.length} tiles)`);
  let inSea = 0;
  for (const t of land) {
    const { dxPct, dyPct } = offsetPct(t.x, t.y);
    if (dxPct * dxPct + dyPct * dyPct < 45 * 45) inSea++;
  }
  assert.strictEqual(inSea, 0, 'the inland sea stayed water');
  // WRAP-AWARENESS (the seam check the pre-design flagged): the rim runs THROUGH
  // x=0. A mask that measured x from the left edge instead of the short way round
  // the cylinder would leave one side of the seam bare.
  assert.ok(land.some(t => t.x < 3) && land.some(t => t.x > W - 4),
    'the rim carries across the wrap seam');
});

test('W7: every new shape is deterministic and every civ still gets a start', async () => {
  const { engine, hashState } = await load();
  for (const t of ['fractal', 'oval', 'ring', 'inland-sea', 'clover']) {
    const a = world(engine, t), b = world(engine, t);
    assert.strictEqual(hashState(a), hashState(b), `${t}: same seed, same world`);
    assert.strictEqual(Object.keys(a.units).length > 0, true, `${t}: units were placed`);
    const owners = {};
    for (const uid of Object.keys(a.units)) owners[a.units[uid].owner] = true;
    assert.strictEqual(Object.keys(owners).length, PLAYERS.length, `${t}: every civ has a start`);
  }
});

test('W7 clover: four petals meeting at a hub, and one civ per petal', async () => {
  const { engine } = await load();
  const st = world(engine, 'clover');
  const land = landTiles(st);
  assert.ok(land.length > 100, `clover made land (${land.length} tiles)`);
  // the gaps BETWEEN petals stay water: due east/west of centre at the equator,
  // and due north/south on the centre meridian
  for (const t of land) {
    const { dxPct, dyPct } = offsetPct(t.x, t.y);
    const inHub = dxPct * dxPct + dyPct * dyPct <= 22 * 22;
    const px = dxPct - 55, py = dyPct - 55;
    const inPetal = px * px + py * py <= 38 * 38;
    assert.ok(inHub || inPetal, `land at ${t.x},${t.y} is in neither petal nor hub`);
  }
  // BALANCED STARTS — the point of the shape. Without the petal round-robin the
  // civs pile into two lobes (measured 2-3 distinct petals of 4 across five seeds).
  const four = [
    { id: 'p1', name: 'A', color: '#111', human: true },
    { id: 'p2', name: 'B', color: '#222', human: false },
    { id: 'p3', name: 'C', color: '#333', human: false },
    { id: 'p4', name: 'D', color: '#444', human: false }
  ];
  for (const seed of [42, 7, 101]) {
    const g = engine.createGame({ seed, options: { width: W, height: H, players: four, mapType: 'clover' } });
    const petals = {};
    for (const uid of Object.keys(g.units)) {
      const u = g.units[uid];
      petals[u.owner] = (u.y * 2 > H - 1 ? 2 : 0) + (u.x * 2 > W - 1 ? 1 : 0);
    }
    const seen = {};
    for (const p of Object.values(petals)) seen[p] = true;
    assert.strictEqual(Object.keys(seen).length, 4, `seed ${seed}: one civ per petal`);
  }
});

test('W7: the existing types are untouched by the mask stage', async () => {
  const { engine, hashState } = await load();
  const legacy = world(engine, undefined);
  assert.strictEqual(hashState(world(engine, 'continents')), hashState(legacy),
    'continents is still the identity default');
  assert.strictEqual(hashState(world(engine, 'doughnut')), hashState(legacy),
    'an unknown type still clamps to the default');
});
