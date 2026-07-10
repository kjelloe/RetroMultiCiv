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

// Advance-name cleanup: disambiguated links come out as
// "Republic (advance) / Republic" (take the display segment), and the wiki
// table hyphenates long words across lines ("Industri-alization"). No real
// Civ 1 advance contains a hyphen, so de-hyphenating is safe here.
function techName(raw) {
  const parts = raw.split(' / ');
  return parts[parts.length - 1].replace(/(\w)-(\w)/g, '$1$2').trim();
}

function buildTechs() {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'list-of-advances-in-civ1.json'), 'utf8'));
  const techs = {};
  for (const r of page.tables[0].rows) {
    if (!r[0]) continue; // trailing "no tech required" rows
    const level = int(r[1], `${r[0]} level`);
    if (level < 1) continue; // level-0 rows are always-available capabilities
    const name = techName(r[0]);
    techs[slug(name)] = {
      name,
      level,
      prereqs: [r[2], r[3]].filter(p => p && p !== 'None').map(p => slug(techName(p)))
    };
  }
  // integrity: every prereq must itself be an advance
  for (const [id, t] of Object.entries(techs)) {
    for (const p of t.prereqs) {
      if (!techs[p]) throw new Error(`tech ${id} has unknown prereq "${p}"`);
    }
  }
  const count = Object.keys(techs).length;
  if (count < 60 || count > 80) throw new Error(`suspicious tech count: ${count}`);
  return techs;
}

function buildUnits(techs) {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'list-of-units-in-civ1.json'), 'utf8'));
  const domains = ['land', 'sea', 'air'];
  const units = {};

  page.tables.forEach((table, i) => {
    for (const r of table.rows) {
      const name = r[0];
      if (!name) continue;
      // the units page writes "The Wheel"; the advances page names it "Wheel"
      const techRaw = r[1] === 'None' ? '' : techName(r[1]).replace(/^The /, '');
      if (techRaw && !techs[slug(techRaw)]) {
        throw new Error(`unit ${name} requires unknown tech "${techRaw}"`);
      }
      units[slug(name)] = {
        name,
        tech: techRaw ? slug(techRaw) : '', // tech ID — engine gates on this
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
  const techs = buildTechs();
  const units = buildUnits(techs);
  fs.writeFileSync(path.join(OUT, 'terrain.json'), JSON.stringify(terrain, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'techs.json'), JSON.stringify(techs, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'units.json'), JSON.stringify(units, null, 2) + '\n');
  console.log(`terrain.json: ${Object.keys(terrain.terrains).length} terrains + river modifier`);
  console.log(`techs.json: ${Object.keys(techs).length} advances`);
  console.log(`units.json: ${Object.keys(units).length} units`);
}

module.exports = { buildTerrain, buildTechs, buildUnits };
if (require.main === module) main();
