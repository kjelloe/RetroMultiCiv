// XIV §42: the auto-improve settler's per-tile work chooser (chooseWork in
// client/ui/automate.js) — PURE, DOM-free. Priority-driven, road-first, rail-
// last, no-downgrade-unless-priority-demands.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/automate.js'); }

const GRASS = { irrigate: { food: 1 } };                        // irrigable, no mine
const HILLS = { mine: { shields: 2 }, irrigate: { food: 1 } };  // both; mine out-yields

test('road comes first on an unimproved, unroaded tile', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({}, GRASS, { water: true, priority: 'balanced' }), 'road');
});

test('balanced: mine when it out-yields irrigation, else irrigate', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({ road: true }, HILLS, { water: true, priority: 'balanced' }), 'mine');
  assert.strictEqual(chooseWork({ road: true }, GRASS, { water: true, priority: 'balanced' }), 'irrigate');
});

test('food prefers irrigation; shield prefers mine (over the balanced heuristic)', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({ road: true }, HILLS, { water: true, priority: 'food' }), 'irrigate');
  assert.strictEqual(chooseWork({ road: true }, HILLS, { water: true, priority: 'shield' }), 'mine');
});

test('trade builds roads + rails only (terrain work skipped)', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({}, HILLS, { water: true, priority: 'trade' }), 'road');
  assert.strictEqual(chooseWork({ road: true }, HILLS, { water: true, priority: 'trade', knowsRail: true }), 'railroad');
  assert.strictEqual(chooseWork({ road: true }, HILLS, { water: true, priority: 'trade' }), null);
});

test('no downgrade by default; a priority may replace the other improvement', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({ road: true, mine: true }, HILLS, { water: true, priority: 'balanced' }), null,
    'balanced never downgrades a mined tile');
  assert.strictEqual(chooseWork({ road: true, mine: true }, HILLS, { water: true, priority: 'balanced', knowsRail: true }), 'railroad',
    'but it still lays rail on the road');
  assert.strictEqual(chooseWork({ road: true, mine: true }, HILLS, { water: true, priority: 'food' }), 'irrigate',
    'food DEMANDS irrigation — replaces the mine');
  assert.strictEqual(chooseWork({ road: true, irrigation: true }, HILLS, { water: true, priority: 'shield' }), 'mine',
    'shield replaces irrigation with a mine');
});

test('rail needs the advance + a road; irrigation needs water; else the tile is done', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({ road: true, irrigation: true }, GRASS, { water: true, priority: 'balanced' }), null,
    'improved + no rail tech → done');
  assert.strictEqual(chooseWork({ road: true }, GRASS, { water: false, priority: 'balanced' }), null,
    'no water → no irrigation on grassland → done');
  assert.strictEqual(chooseWork({ road: true, irrigation: true }, GRASS, { water: true, priority: 'balanced', knowsRail: true }), 'railroad');
});

test('bridge gates a road on a river tile', async () => {
  const { chooseWork } = await load();
  assert.strictEqual(chooseWork({ river: true }, GRASS, { water: true, priority: 'balanced', knowsBridge: false }), 'irrigate',
    'no Bridge Building → skip the river road, improve the terrain instead');
  assert.strictEqual(chooseWork({ river: true }, GRASS, { water: true, priority: 'balanced', knowsBridge: true }), 'road',
    'with Bridge Building the river road is built first');
});

test('IMPROVE_PRIORITIES is the stable 4-option menu', async () => {
  const { IMPROVE_PRIORITIES } = await load();
  assert.deepStrictEqual(IMPROVE_PRIORITIES, ['balanced', 'food', 'shield', 'trade']);
});
