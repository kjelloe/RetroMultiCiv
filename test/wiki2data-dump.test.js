// Integration test against the real wikiteam dump (sibling checkout, not part
// of this repo). Skips itself when the dump is absent so CI/other machines
// still pass. Override the location with MULTICIV_WIKI_DUMP.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { scanDump, extractTables, parseYields, TARGET_TITLES } = require('../tools/wiki2data.js');

function findDump() {
  if (process.env.MULTICIV_WIKI_DUMP) return process.env.MULTICIV_WIKI_DUMP;
  const dir = path.join(__dirname, '..', '..', 'wikiteam', 'civ_articles_only');
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find(f => f.endsWith('-current.xml'));
  return file ? path.join(dir, file) : null;
}

const dump = findDump();

test('real dump: all target pages extract with expected shapes', { skip: !dump && 'wiki dump not present' }, async () => {
  const pages = {};
  const { found } = await scanDump(dump, TARGET_TITLES, (title, text) => { pages[title] = text; });
  assert.strictEqual(found.length, TARGET_TITLES.length, `missing: ${TARGET_TITLES.filter(t => !found.includes(t))}`);

  const unitTables = extractTables(pages['List of units in Civ1']);
  const unitRows = unitTables.reduce((n, t) => n + t.rows.length, 0);
  assert.strictEqual(unitRows, 28, 'Civ1 has exactly 28 unit types');

  assert.strictEqual(extractTables(pages['List of wonders in Civ1'])[0].rows.length, 21, '21 wonders');
  assert.strictEqual(extractTables(pages['List of buildings in Civ1'])[0].rows.length, 21, '21 buildings');

  // spot-check terrain yields: Grassland row must decode to 2/0/0
  const terrain = extractTables(pages['Terrain (Civ1)'])[0];
  const grassland = terrain.rows.find(r => r.includes('Grassland'));
  assert.ok(grassland, 'Grassland row present');
  const normalYieldCell = grassland[grassland.indexOf('Grassland') + 3];
  assert.deepStrictEqual(
    parseYields(normalYieldCell),
    { food: 2, shields: 0, trade: 0, republicBonus: false, despotismPenalty: false }
  );
});
