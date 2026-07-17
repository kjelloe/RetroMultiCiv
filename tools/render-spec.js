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
  // A88b: the type→silhouette-recipe map is DATA (UNIT_SILHOUETTE, generated to
  // asset-recipes.json). createUnitMesh reads it + unit-chrome.js — no per-type
  // set to parse out of assets.js.
  // Key renamed typeClasses -> unitSilhouette (reviewer advisory post-A88b):
  // the value's SHAPE changed under the old name during A88b (class->[types]
  // arrays became a type->recipe map), so the self-describing name replaces
  // it — an out-of-repo reader breaks LOUDLY on the missing key instead of
  // silently misreading the new shape.
  const unitSilhouette = JSON.parse(read('data/assets/asset-recipes.json')).unitSilhouette;
  const builders = { // the composer + its procedural chrome (bodies are recipe data)
    baseToken: { procedural: true, description: 'ownership disc (faction primary, dimmed when out of moves) + dark rim for light civs + gold veteran rim + fortified shield chip' },
    pennant: { procedural: true, description: 'pole + primary flag + secondary emblem dot on a sway hinge at the pole top' },
    createUnitMesh: { procedural: true, description: 'A88b data-driven dispatch: recipe = UNIT_SILHOUETTE[type], render chrome (pennant offset / naval base / sail plane / chariot wheels) = unit-chrome.js RECIPE_CHROME + TYPE_EXTRA; composeRecipe builds the body from the recipe primitives' },
    ship: { procedural: true, description: 'sail ships add a procedural canvas sail plane on top of the shipSail body' },
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
    models: { geometries: geo, neutralColors: neutral, unitSilhouette, cityTiers, builders },
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
