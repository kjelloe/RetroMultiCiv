// A43: machine-readable render spec for the designer ally.
//   node tools/render-spec.js            # rewrites specs/render-spec.json
//   node tools/render-spec.js --stdout   # print (the drift guard's path)
//
// The renderer CODE stays the single source of truth — this tool
// mechanically extracts the declarative tables from the browser-ESM
// modules (they import 'three', so they can't be require()d here; the
// literal tables are sliced from source and evaluated standalone) and
// emits them as versioned JSON. Anything that resists declarative capture
// is listed as { procedural: true } with a one-line description — never
// approximated. test/render-spec.test.js fails when the committed export
// drifts from the code: run this tool and commit the result.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(REPO, f), 'utf8');

// slice `const NAME = {...};` (or [...]) out of a source file and evaluate
// the literal — works because the renderer tables are self-contained
function sliceTable(src, name, open, close) {
  const start = src.indexOf(`const ${name} = ${open}`);
  if (start === -1) throw new Error(`table ${name} not found`);
  const from = src.indexOf(open, start);
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return new Function(`return ${src.slice(from, i + 1)}`)();
    }
  }
  throw new Error(`table ${name} not closed`);
}
const constNum = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = (-?[\\d.]+)`));
  if (!m) throw new Error(`constant ${name} not found`);
  return Number(m[1]);
};
const hex = n => '#' + n.toString(16).padStart(6, '0');

function build() {
  const terrainSrc = read('client/renderer/three/terrain.js');
  const propsSrc = read('client/renderer/three/props.js');
  const assetsSrc = read('client/renderer/three/assets.js');
  const animSrc = read('client/renderer/three/anim.js');
  const factionsSrc = read('client/renderer/three/factions.js');
  const civs = JSON.parse(read('data/civs.json'));

  // --- terrain -------------------------------------------------------------
  const TERRAIN = sliceTable(terrainSrc, 'TERRAIN', '{', '}');
  const terrain = {};
  for (const id of Object.keys(TERRAIN)) {
    const t = TERRAIN[id];
    terrain[id] = {
      base: t.base, jitter: t.jitter, peak: t.peak,
      dunes: t.dunes === true,
      palette: t.palette.map(hex)
    };
  }

  // --- factions ------------------------------------------------------------
  const emblems = [...factionsSrc.matchAll(/emblem === '(\w+)'/g)].map(m => m[1]);
  const lightThreshold = Number(factionsSrc.match(/> (\d+);\n\}/)[1]);
  const factions = {};
  for (const id of Object.keys(civs).sort()) {
    factions[id] = Object.assign({}, civs[id].visual, { color: civs[id].color });
  }

  // --- models --------------------------------------------------------------
  const geo = {};
  for (const m of assetsSrc.matchAll(/^\s*(\w+): new THREE\.(\w+)Geometry\(([^)]*)\)/gm)) {
    geo[m[1]] = { shape: m[2], args: m[3].split(',').map(s => Number(s.trim())) };
  }
  const neutral = {};
  for (const m of assetsSrc.matchAll(/^\s*(\w+): new THREE\.MeshLambertMaterial\(\{ color: 0x([0-9a-f]{6}) \}\)/gm)) {
    neutral[m[1]] = '#' + m[2];
  }
  const typeClasses = {};
  for (const name of ['WAGON_TYPES', 'FOOT_TYPES', 'MOUNTED_TYPES', 'SIEGE_TYPES',
    'SAIL_TYPES', 'POWERED_TYPES', 'AIR_TYPES']) {
    typeClasses[name.replace('_TYPES', '').toLowerCase()] =
      Object.keys(sliceTable(assetsSrc, name, '{', '}'));
  }
  const builders = { // loops, param scaling, conditionals: honestly procedural
    baseToken: { procedural: true, description: 'ownership disc (faction primary, dimmed when out of moves) + dark rim for light civs + gold veteran rim + fortified shield chip' },
    pennant: { procedural: true, description: 'pole + primary flag + secondary emblem dot on a sway hinge at the pole top' },
    wagon: { procedural: true, description: 'settlers/caravan/diplomat: wood body, canvas roof, four wheels, pennant' },
    footSoldier: { procedural: true, description: 'cone body, sphere head, tilted spear with tip, pennant' },
    mounted: { procedural: true, description: 'box-built horse (body/neck/head/four legs), cone rider, chariot wheels when chariot, pennant' },
    siege: { procedural: true, description: 'armor: hull+turret+barrel; catapult/cannon/artillery: wood platform, two wheels, angled barrel, pennant' },
    ship: { procedural: true, description: 'hull + bow cone; sail: mast+canvas; sub: fin; powered: funnel+bridge; pennant' },
    aircraft: { procedural: true, description: 'fuselage + wings + tail boxes, no pennant' },
    city: { procedural: true, description: 'house ring per CITY_TIERS (angle-spread boxes with roof cones in the faction primary), capital emblem flag or pennant, dark ground ring for light civs, stone wall ring with city-walls' }
  };
  const cityTiers = sliceTable(assetsSrc, 'CITY_TIERS', '[', ']');

  // --- props ---------------------------------------------------------------
  const PROP_COLOR = sliceTable(propsSrc, 'PROP_COLOR', '{', '}');
  const propColors = {};
  for (const k of Object.keys(PROP_COLOR)) propColors[k] = hex(PROP_COLOR[k]);

  // --- anim ----------------------------------------------------------------
  const anim = {
    glideMs: constNum(animSrc, 'GLIDE_MS'),
    flashMs: constNum(animSrc, 'FLASH_MS'),
    smokeMinPop: constNum(animSrc, 'SMOKE_POP'),
    smokeRise: constNum(animSrc, 'SMOKE_RISE'),
    swayYAmplitudeRad: constNum(animSrc, 'SWAY_Y_AMP'),
    swayYHz: constNum(animSrc, 'SWAY_Y_HZ'),
    swayZAmplitudeRad: constNum(animSrc, 'SWAY_Z_AMP'),
    swayZHz: constNum(animSrc, 'SWAY_Z_HZ')
  };

  return {
    schema: {
      version: 1,
      generatedBy: 'tools/render-spec.js — regenerate after any renderer table change',
      fields: {
        terrain: 'tiles = per-terrain surface recipe: base height, per-vertex jitter, extra peak height, three facet palette shades (terrain.js TERRAIN); waterLevel = the translucent plane height (props.js); gridSegmentsPerTile = mesh density (terrain.js SEGS)',
        factions: 'data/civs.json visual{} per civ id + flat color. FIELD SEMANTICS (A44): `color` is the gameplay/seat display color (HUD text, scores, pop badges — anywhere a flat swatch identifies the player) while `visual.primary/secondary` is the CLIENT-ONLY art palette (base discs, flags, roofs); they often differ deliberately for on-terrain readability. A color→seatColor rename is a possible FUTURE migration (touches saves) — not done. lightColor = luminance rule forcing dark rims on light primaries (factions.js)',
        models: 'shared primitive geometries (three.js constructor args), neutral material colors, unit-type → silhouette class map, city growth tiers; builders that resist declarative capture are procedural:true with a description (assets.js)',
        props: 'tile decoration colors (props.js PROP_COLOR); placement is deterministic visualRand(x,y,salt) — procedural by design',
        anim: 'A28 render-time animation constants (anim.js); all phases derive from clock + position, never game state'
      }
    },
    terrain: {
      tiles: terrain,
      waterLevel: constNum(propsSrc, 'WATER_LEVEL'),
      gridSegmentsPerTile: constNum(terrainSrc, 'SEGS')
    },
    factions: {
      lightColor: { rule: 'luminance 0.299r+0.587g+0.114b', threshold: lightThreshold, effect: 'dark rim under base disc / dark ground ring under cities' },
      emblems,
      civs: factions
    },
    models: { geometries: geo, neutralColors: neutral, typeClasses, cityTiers, builders },
    props: { colors: propColors, placement: { procedural: true, description: 'deterministic visualRand(x, y, salt) hash — identical across clients, never touches game state' } },
    anim
  };
}

const json = JSON.stringify(build(), null, 2) + '\n';
if (process.argv.includes('--stdout')) process.stdout.write(json);
else {
  fs.writeFileSync(path.join(REPO, 'specs', 'render-spec.json'), json);
  console.log(`specs/render-spec.json written (${json.length} bytes)`);
}
