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

// Improvement columns hold the YIELD BONUS the improvement adds, or a terrain
// transform like "→ Forest" (the same settler order changes the terrain).
function improvementBonus(cell) {
  if (!cell || cell.indexOf('→') !== -1) return null;
  const y = yields(cell);
  if (y.food + y.shields + y.trade === 0) return null;
  return y;
}

function transformTarget(cell) {
  if (!cell || cell.indexOf('→') === -1) return null;
  const raw = cell.split('→')[1].trim().toLowerCase();
  const targets = { plains: 'plains', grass: 'grassland', grassland: 'grassland', forest: 'forest' };
  if (!targets[raw]) throw new Error(`unknown transform target "${raw}"`);
  return targets[raw];
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
    // settler improvements (columns: Irrigation, Mine, Road) — bonus yields
    // or terrain transforms ("→ Forest": the order changes the terrain)
    const irrigate = improvementBonus(r[7]);
    const mine = improvementBonus(r[8]);
    const road = improvementBonus(r[9]);
    if (irrigate) entry.irrigate = irrigate;
    if (mine) entry.mine = mine;
    if (road) entry.road = road;
    const transforms = {};
    const irrigateTo = transformTarget(r[7]);
    const mineTo = transformTarget(r[8]);
    if (irrigateTo) transforms.irrigate = irrigateTo;
    if (mineTo) transforms.mine = mineTo;
    if (irrigateTo || mineTo) entry.transforms = transforms;
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

// Building costs/maintenance (Civ 1 values, tuneable) and structured effects.
// IMPORTANT: effects are OUR encoding — never copy wiki description sentences
// into committed data (CC BY-SA). Empty effect = buildable, no engine effect yet.
const BUILDING_OVERLAY = {
  'palace':              { cost: 200, maintenance: 0, effect: { isPalace: true } },
  'barracks':            { cost: 40,  maintenance: 1, effect: { veteranUnits: true } },
  'granary':             { cost: 60,  maintenance: 1, effect: { halvesGrowthFood: true } },
  'temple':              { cost: 40,  maintenance: 1, effect: { contentBonus: 1, contentDoubleTech: 'mysticism' } },
  'marketplace':         { cost: 80,  maintenance: 1, effect: { taxBonus: 50, luxBonus: 50 } },
  'library':             { cost: 80,  maintenance: 1, effect: { sciBonus: 50 } },
  'courthouse':          { cost: 80,  maintenance: 1, effect: { corruptionReduction: 50 } },
  'city-walls':          { cost: 120, maintenance: 2, effect: { defenseMultiplier: 3 } },
  'aqueduct':            { cost: 120, maintenance: 2, effect: { growthPast10: true } },
  'bank':                { cost: 120, maintenance: 3, effect: { taxBonus: 50, luxBonus: 50 } },
  'cathedral':           { cost: 160, maintenance: 3, effect: { contentBonus: 4 } },
  'university':          { cost: 160, maintenance: 3, effect: { sciBonus: 50 } },
  'colosseum':           { cost: 100, maintenance: 4, effect: { contentBonus: 3 } },
  'factory':             { cost: 200, maintenance: 4, effect: {} },
  'hydro-plant':         { cost: 240, maintenance: 4, effect: {} },
  'power-plant':         { cost: 160, maintenance: 4, effect: {} },
  'nuclear-plant':       { cost: 160, maintenance: 2, effect: {} },
  'mfg-plant':           { cost: 320, maintenance: 6, effect: {} },
  'recycling-center':    { cost: 200, maintenance: 2, effect: {} },
  'mass-transit':        { cost: 160, maintenance: 4, effect: {} },
  'sdi-defense':         { cost: 200, maintenance: 4, effect: {} }
};

const WONDER_OVERLAY = {
  'colossus':              { effect: { cityTradeBonus: true } },
  'great-wall':            { effect: { wallsEverywhere: true } },
  'hanging-gardens':       { effect: { contentEverywhere: 1 } },
  'j-s-bach-s-cathedral':  { effect: { contentEverywhere: 2 } },
  'michelangelo-s-chapel': { effect: { contentEverywhere: 4 } },
  'cure-for-cancer':       { effect: { happyEverywhere: 1 } },
  'shakespeare-s-theatre': { effect: { allContentInCity: true } },
  'oracle':                { effect: { doublesTemple: true } }
};

function techId(techs, raw, context) {
  if (!raw || raw === 'None' || raw === 'Nothing') return '';
  const id = slug(techName(raw).replace(/^The /, '').replace(/ \(advance\)$/, ''));
  if (!techs[id]) throw new Error(`${context}: unknown tech "${raw}"`);
  return id;
}

function buildBuildings(techs) {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'list-of-buildings-in-civ1.json'), 'utf8'));
  const buildings = {};
  for (const r of page.tables[0].rows) {
    // "University (building)" disambiguation suffix mirrors the advances page
    const name = techName(r[0]).replace(/ \(building\)$/, '');
    if (!name) continue;
    const id = slug(name);
    const overlay = BUILDING_OVERLAY[id];
    if (!overlay) throw new Error(`building "${id}" missing from BUILDING_OVERLAY`);
    buildings[id] = {
      name,
      tech: techId(techs, r[1], `building ${id}`),
      cost: overlay.cost,
      maintenance: overlay.maintenance,
      effect: overlay.effect
    };
  }
  const count = Object.keys(buildings).length;
  if (count !== 21) throw new Error(`expected 21 buildings, got ${count}`);
  return buildings;
}

function buildWonders(techs) {
  const page = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'list-of-wonders-in-civ1.json'), 'utf8'));
  const wonders = {};
  for (const r of page.tables[0].rows) {
    const name = techName(r[1]);
    if (!name) continue;
    const id = slug(name);
    wonders[id] = {
      name,
      tech: techId(techs, r[3], `wonder ${id}`),
      obsoleteBy: techId(techs, r[4], `wonder ${id} obsoleteBy`),
      cost: int(r[5], `${name} cost`),
      effect: (WONDER_OVERLAY[id] && WONDER_OVERLAY[id].effect) || {}
    };
  }
  const count = Object.keys(wonders).length;
  if (count !== 21) throw new Error(`expected 21 wonders, got ${count}`);
  return wonders;
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
  const buildings = buildBuildings(techs);
  const wonders = buildWonders(techs);
  fs.writeFileSync(path.join(OUT, 'terrain.json'), JSON.stringify(terrain, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'techs.json'), JSON.stringify(techs, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'units.json'), JSON.stringify(units, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'buildings.json'), JSON.stringify(buildings, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'wonders.json'), JSON.stringify(wonders, null, 2) + '\n');
  console.log(`terrain.json: ${Object.keys(terrain.terrains).length} terrains + river modifier`);
  console.log(`techs.json: ${Object.keys(techs).length} advances`);
  console.log(`units.json: ${Object.keys(units).length} units`);
  console.log(`buildings.json: ${Object.keys(buildings).length} buildings`);
  console.log(`wonders.json: ${Object.keys(wonders).length} wonders`);
}

module.exports = { buildTerrain, buildTechs, buildUnits, buildBuildings, buildWonders };
if (require.main === module) main();
