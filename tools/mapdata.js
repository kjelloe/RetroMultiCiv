// Map the raw wiki extraction (data/wiki-extract/) to final ruleset files.
//
//   node tools/mapdata.js
//
// Currently produces data/terrain.json and data/units.json (roadmap step 1).
// Output is meant to be reviewed by hand and committed; regeneration is safe.
const fs = require('fs');
const path = require('path');
const { parseYields } = require('./wiki2data.js');

const EXTRACT = path.join(__dirname, '..', 'data', 'wiki-extract');
const OUT = path.join(__dirname, '..', 'data');

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function int(s, what) {
  const n = parseInt(s, 10);
  if (!Number.isInteger(n)) throw new Error(`expected integer for ${what}, got "${s}"`);
  return n;
}

function yields(cell) {
  const y = parseYields(cell);
  return { food: y.food, shields: y.shields, trade: y.trade };
}

function buildTerrain() {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'terrain-civ1.json'), 'utf8'));
  const rows = page.tables[0].rows.filter(r => r.length >= 7 && r[1]);
  const terrains = {};
  let riverModifier = null;

  for (const r of rows) {
    const name = r[1];
    const id = slug(name) === 'mountain' ? 'mountains' : slug(name);
    const entry = {
      name,
      move: int(r[2], `${name} move`),
      defenseBonus: int(r[3].replace(/[+%]/g, ''), `${name} defense`),
      yields: yields(r[4]),
      special: { name: r[5], yields: yields(r[6] || '') },
      domain: id === 'ocean' ? 'sea' : 'land'
    };
    if (id === 'river') {
      // Civ 1 "River" is a tile type; we store rivers as a tile flag instead:
      // River tile = Grassland + river flag (see docs/01-game-spec.md §3.1)
      riverModifier = {
        tradeBonus: entry.yields.trade,
        defenseBonus: entry.defenseBonus,
        special: entry.special
      };
    } else {
      terrains[id] = entry;
    }
  }

  const expected = ['ocean', 'grassland', 'plains', 'forest', 'hills', 'mountains',
    'desert', 'tundra', 'arctic', 'swamp', 'jungle'];
  const missing = expected.filter(t => !terrains[t]);
  if (missing.length) throw new Error(`missing terrains: ${missing.join(', ')}`);
  if (!riverModifier) throw new Error('River row not found');

  return { terrains, riverModifier };
}

function buildUnits() {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'list-of-units-in-civ1.json'), 'utf8'));
  const domains = ['land', 'sea', 'air'];
  const units = {};

  page.tables.forEach((table, i) => {
    for (const r of table.rows) {
      const name = r[0];
      if (!name) continue;
      units[slug(name)] = {
        name,
        tech: r[1] === 'None' ? '' : r[1],
        attack: int(r[2], `${name} attack`),
        defense: int(r[3], `${name} defense`),
        moves: int(r[4], `${name} moves`),
        cost: int(r[5], `${name} cost`),
        domain: domains[i],
        notes: r[7] || ''
      };
    }
  });

  const count = Object.keys(units).length;
  if (count !== 28) throw new Error(`expected 28 units, got ${count}`);
  if (!units.settlers || units.settlers.attack !== 0) throw new Error('settlers sanity check failed');
  return units;
}

function main() {
  const terrain = buildTerrain();
  const units = buildUnits();
  fs.writeFileSync(path.join(OUT, 'terrain.json'), JSON.stringify(terrain, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'units.json'), JSON.stringify(units, null, 2) + '\n');
  console.log(`terrain.json: ${Object.keys(terrain.terrains).length} terrains + river modifier`);
  console.log(`units.json: ${Object.keys(units).length} units`);
}

module.exports = { buildTerrain, buildUnits };
if (require.main === module) main();
