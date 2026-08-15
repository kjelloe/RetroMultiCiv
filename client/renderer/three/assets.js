// AssetFactory (art track A0/A1, specs/plan-assets.md): all unit/city mesh
// construction lives here — the renderer maps state to visuals, this module
// decides how they look. Ownership reads as a colored base disc + banner on
// a mostly neutral body (not a whole-mesh recolor). Materials are Lambert
// (cheap on SwiftShader/WebGL1 — the r162 constraint applies to art too) and
// cached per color; geometries are shared module constants, so removing a
// group from the scene needs no disposal.
import * as THREE from 'three';
import { emblemTexture, isLightColor } from './factions.js';
import { UNIT_RECIPES, UNIT_SILHOUETTE, CITY_RECIPE } from './recipes.js';
import { HIGH_UNIT_RECIPES } from './recipes-high.js';
import { MODEL_UNIT_RECIPES } from './recipes-model.js';
import { RECIPE_CHROME, TYPE_EXTRA } from './unit-chrome.js';
import { CITY_ERA_STYLES } from '../../../shared/city-era.js';

// --- faction visuals (art A1.6a) -----------------------------------------------
// Factories accept either a plain color string (mock/test states, lobby games
// without civs — the fallback path) or a data/civs.json visual object
// { primary, secondary, emblem }. Everything downstream works off this shape.
function resolveVisual(colorOrVisual) {
  if (colorOrVisual && typeof colorOrVisual === 'object') return colorOrVisual;
  return { primary: colorOrVisual || '#ffffff', secondary: '#e8e0cc', emblem: '' };
}
const dimCache = {};
function dimmed(color) { // moved-out units: same hue, clearly darker
  if (!dimCache[color]) {
    const c = new THREE.Color(color).lerp(new THREE.Color(0x11151d), 0.55);
    dimCache[color] = '#' + c.getHexString();
  }
  return dimCache[color];
}

// --- shared materials ---------------------------------------------------------
const NEUTRAL = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  wheel: new THREE.MeshLambertMaterial({ color: 0x4a3319 }),
  canvas: new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  cloth: new THREE.MeshLambertMaterial({ color: 0x8b93a5 }),
  skin: new THREE.MeshLambertMaterial({ color: 0xd7a27d }),
  metal: new THREE.MeshLambertMaterial({ color: 0xb8b8b8 }),
  stone: new THREE.MeshLambertMaterial({ color: 0xc2ab82 }),
  house: new THREE.MeshLambertMaterial({ color: 0xe1d0ad }),
  horse: new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
  hull: new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
  darkMetal: new THREE.MeshLambertMaterial({ color: 0x5a5f52 })
};

const matCache = {};
function matFor(color) {
  if (!matCache[color]) matCache[color] = new THREE.MeshLambertMaterial({ color });
  return matCache[color];
}

const flagCache = {};
function flagMatFor(color) {
  if (!flagCache[color]) {
    flagCache[color] = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  }
  return flagCache[color];
}

// --- shared geometries ----------------------------------------------------------
const GEO = {
  baseDisc: new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12),
  body: new THREE.ConeGeometry(0.17, 0.42, 8),
  head: new THREE.SphereGeometry(0.1, 10, 8),
  spear: new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6),
  spearTip: new THREE.ConeGeometry(0.05, 0.12, 4),
  wagonBody: new THREE.BoxGeometry(0.5, 0.18, 0.3),
  wagonTop: new THREE.CylinderGeometry(0.14, 0.14, 0.44, 10),
  wheel: new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10),
  fallback: new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8),
  pole: new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6),
  flag: new THREE.PlaneGeometry(0.22, 0.13),
  wallRing: new THREE.TorusGeometry(0.42, 0.05, 6, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(1, 1, 4),
  // faction identity + status markers (art A1.6a)
  emblemDisc: new THREE.CircleGeometry(0.042, 10),      // secondary dot on pennants
  baseRim: new THREE.TorusGeometry(0.3, 0.016, 6, 18),  // veteran gold / light-civ dark
  shieldChip: new THREE.BoxGeometry(0.09, 0.11, 0.02),  // fortified marker
  cityFlag: new THREE.PlaneGeometry(0.3, 0.3)           // capital CanvasTexture flag
};
const GOLD = new THREE.MeshLambertMaterial({ color: 0xd9a521 });
const DARK_RIM = new THREE.MeshLambertMaterial({ color: 0x20242e });
const SHIELD = new THREE.MeshLambertMaterial({ color: 0xcfd6df });
const flagTexCache = {};
function flagTexMatFor(visual) {
  const key = visual.primary + '|' + visual.emblem;
  if (!flagTexCache[key]) {
    flagTexCache[key] = new THREE.MeshLambertMaterial({
      map: emblemTexture(visual), side: THREE.DoubleSide
    });
  }
  return flagTexCache[key];
}

function add(group, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

// A88: build a geometry from a recipe primitive (cached, so shared shapes reuse
// one buffer exactly as the GEO constants did — sharing vs new instance never
// moves a pixel). shape/size/seg mirror the three.js constructors 1:1.
// G4: segMult (graphics level) multiplies radial/height segments — medium 1.5,
// high 2 — so curved primitives round out; mult 1 (low) keys and builds
// EXACTLY as before. Dodeca detail is left alone (detail 1 = a ball).
const recipeGeo = {};
function boostSeg(seg, mult) { return Math.max(3, Math.round((seg || 8) * mult)); }
function geometryFor(p, segMult = 1) {
  const key = p.shape + '|' + p.size.join(',') + '|' + (p.seg === undefined ? '' : [].concat(p.seg).join(',')) + (segMult === 1 ? '' : '|x' + segMult);
  if (recipeGeo[key]) return recipeGeo[key];
  let g;
  if (p.shape === 'box') g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
  else if (p.shape === 'cyl') g = new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], segMult === 1 ? p.seg : boostSeg(p.seg, segMult));
  else if (p.shape === 'cone') g = new THREE.ConeGeometry(p.size[0], p.size[1], segMult === 1 ? p.seg : boostSeg(p.seg, segMult));
  else if (p.shape === 'sphere') g = new THREE.SphereGeometry(p.size[0], segMult === 1 ? p.seg[0] : boostSeg(p.seg[0], segMult), segMult === 1 ? p.seg[1] : boostSeg(p.seg[1], segMult));
  else if (p.shape === 'dodeca') g = new THREE.DodecahedronGeometry(p.size[0], p.seg || 0);
  recipeGeo[key] = g;
  return g;
}
const SEG_MULT = { low: 1, medium: 1.5, high: 2 };
// a colorRole slot → material: neutral roles from NEUTRAL, 'primary'/'secondary'
// injected from the civ visual (the data itself never carries a faction hex)
function roleMaterial(role, visual) {
  if (role === 'primary') return matFor(visual.primary);
  if (role === 'secondary') return matFor(visual.secondary);
  return NEUTRAL[role];
}
// compose a recipe's primitive list into the group — byte-identical to the
// hand-written add()/scale/rotation the silhouette functions used to do inline
function composeRecipe(group, recipe, visual, segMult = 1) {
  for (const p of recipe) {
    const mesh = add(group, geometryFor(p, segMult), roleMaterial(p.color, visual), p.pos[0], p.pos[1], p.pos[2]);
    if (p.scale !== undefined) {
      if (Array.isArray(p.scale)) mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
      else mesh.scale.setScalar(p.scale);
    }
    if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  }
}

// A88b: the type→silhouette mapping is DATA (UNIT_SILHOUETTE in recipes.js) and
// the per-recipe chrome is DATA (unit-chrome.js) — createUnitMesh reads both, so
// the old per-class type sets + functions that hardcoded a second copy of the
// mapping are gone.

// --- unit token layer (art A1.6a): every unit sits on this ---------------------
// base disc in the faction primary (bright = can move, dim = moved out), a
// thin dark rim for light civs (readability), gold rim for veterans, a small
// shield chip when fortified. Ownership stays readable before any silhouette.
function baseToken(group, visual, status, discY) {
  const s = status || {};
  const discColor = s.canMove === false ? dimmed(visual.primary) : visual.primary;
  add(group, GEO.baseDisc, matFor(discColor), 0, discY, 0);
  if (isLightColor(visual.primary)) {
    const rim = add(group, GEO.baseRim, DARK_RIM, 0, discY + 0.02, 0);
    rim.rotation.x = Math.PI / 2;
  }
  if (s.veteran) {
    const rim = add(group, GEO.baseRim, GOLD, 0, discY + 0.045, 0);
    rim.rotation.x = Math.PI / 2;
  }
  if (s.fortified) add(group, GEO.shieldChip, SHIELD, 0.24, 0.14, 0.14);
}

// small faction pennant: pole + primary flag + secondary emblem dot (the
// ally's first-implementation geometric flag; capitals upgrade to the
// CanvasTexture emblem in createCityMesh)
function pennant(group, visual, x, y, scale) {
  const s = scale || 1;
  const pole = add(group, GEO.pole, NEUTRAL.wood, x, y, 0);
  pole.scale.setScalar(s * 0.8);
  // flag + emblem dot ride a hinge group at the pole top, so the A28 sway
  // can flutter them around the pole axis without desyncing the dot; the
  // rest pose decomposes to the exact same world transforms as before
  const hinge = new THREE.Group();
  hinge.position.set(x, y + 0.24 * s, 0);
  hinge.userData.sway = 1;
  group.add(hinge);
  const flag = add(hinge, GEO.flag, flagMatFor(visual.primary), 0.09 * s, 0, 0);
  flag.scale.setScalar(s * 0.8);
  if (visual.emblem) {
    const dot = add(hinge, GEO.emblemDisc, flagMatFor(visual.secondary), 0.09 * s, 0, 0.006);
    dot.scale.setScalar(s);
  }
}

// Returns a group with its base at y = 0 (place it on the tile top).
// colorOrVisual: '#hex' fallback OR a civ visual {primary, secondary, emblem};
// status: { veteran, fortified, canMove } drives the token-layer markers.
// A88b: DATA-DRIVEN — the silhouette recipe comes from UNIT_SILHOUETTE and the
// render chrome (pennant offset / naval base / sail plane / chariot wheels) from
// unit-chrome.js. No per-type function ladder that hardcoded a second copy of
// the mapping. Byte-identical to the old path (the mesh child ORDER is
// preserved: baseToken → body → type-extra → sail → pennant).
// level (G4, specs/graphics-levels.md): 'low' builds exactly the shipped
// silhouettes. Medium rounds curved primitives (segment boost). High swaps in
// the HIGH_UNIT_RECIPES body when one is authored for the silhouette —
// un-authored silhouettes get the medium treatment, so the tier can land
// incrementally without a gap in the roster.
export function createUnitMesh(unitType, colorOrVisual, status, level = 'low') {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const recipe = UNIT_SILHOUETTE[unitType] || 'fallback';
  const chrome = RECIPE_CHROME[recipe] || {};
  const segMult = SEG_MULT[level] || 1;
  // H1: the authored (recipes-high) bodies ARE the medium bar; H4: high
  // prefers the MODEL-grade table, falling back per silhouette so the tier
  // lands batch by batch (absent model body → the medium body).
  // H11 (user ruling 2026-08-14): the MODEL bodies (R15 figures + period
  // helmets) are promoted to MEDIUM too — recipes-high remains the fallback
  // layer for anything the model table ever lacks.
  const bodyOf = name => ((level === 'medium' || level === 'high') && MODEL_UNIT_RECIPES[name]) ? MODEL_UNIT_RECIPES[name]
    : ((level === 'medium' || level === 'high') && HIGH_UNIT_RECIPES[name]) ? HIGH_UNIT_RECIPES[name]
    : UNIT_RECIPES[name];
  baseToken(group, visual, status, chrome.naval ? 0.02 : 0.035);
  if (chrome.plain) { composeRecipe(group, bodyOf('fallback'), undefined, segMult); return group; } // all-neutral, no visual/pennant
  composeRecipe(group, bodyOf(recipe), visual, segMult);
  if (TYPE_EXTRA[unitType]) composeRecipe(group, bodyOf(TYPE_EXTRA[unitType]), visual, segMult); // chariot wheels
  if (chrome.sail) { const sail = add(group, GEO.flag, NEUTRAL.canvas, -0.04, 0.42, 0.02); sail.scale.set(1.3, 2, 1); } // procedural plane
  if (chrome.pennant) pennant(group, visual, chrome.pennant[0], chrome.pennant[1], chrome.pennant[2]);
  return group;
}

// Deterministic house cluster in five GROWTH TIERS (A36 — Civ 1 pops reach
// 40+; the cluster reads the tier at a glance: denser and taller), roofs in
// the owner's color, a banner pole, a wall ring once City Walls is built.
export const CITY_TIERS = [ // ascending minPop; the last match wins
  { minPop: 1, houses: 3, scale: 1.0 },
  { minPop: 4, houses: 6, scale: 1.1 },
  { minPop: 8, houses: 9, scale: 1.25 },
  { minPop: 16, houses: 12, scale: 1.45 },
  { minPop: 28, houses: 15, scale: 1.7 }
];
export function cityTierFor(pop) {
  let tier = CITY_TIERS[0];
  for (const t of CITY_TIERS) if (pop >= t.minPop) tier = t;
  return tier;
}

// ERA look (specs/city-era-looks.md §5d): the era band changes SILHOUETTE +
// ROOFLINE + material + a signature prop — never a plain recolor. CITY_TIERS
// still owns house count/height/footprint; the era table owns body-geo / roof-
// geo / material / signature-prop. Owner color lives on the base RING + banner
// (guardrail: NOT the body or roof), so the era reads at map zoom. The
// CITY_ERA_STYLES band ids come from shared/city-era.js.
const ERA_MAT = {
  mud: new THREE.MeshLambertMaterial({ color: 0xb08a5e }),
  stone: new THREE.MeshLambertMaterial({ color: 0xb2ab9a }),
  brick: new THREE.MeshLambertMaterial({ color: 0x9d5a45 }),
  concrete: new THREE.MeshLambertMaterial({ color: 0xa7bccf }),
  thatch: new THREE.MeshLambertMaterial({ color: 0xcdb280 }),
  tile: new THREE.MeshLambertMaterial({ color: 0xb5623e }),
  tar: new THREE.MeshLambertMaterial({ color: 0x44454d }),
  glass: new THREE.MeshLambertMaterial({ color: 0x8fb2cf })
};
// roof SHAPE per band (peaked ancient/classical vs flat industrial vs slab modern)
const ROOF_GEO = {
  peak: GEO.roof,                            // 4-sided peaked cone (thatch/tile)
  flat: new THREE.BoxGeometry(1, 0.26, 1),   // industrial rectilinear roof
  slab: new THREE.BoxGeometry(1, 0.16, 1)    // modern flat slab
};
const PROP_GEO = {
  keepBody: new THREE.BoxGeometry(0.2, 0.5, 0.2),                            // classical tower/keep
  smokestack: new THREE.CylinderGeometry(0.035, 0.05, 0.62, 8),             // industrial stack
  dome: new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), // modern dome
  spire: new THREE.ConeGeometry(0.05, 0.5, 8),                              // modern spire
  civic: new THREE.BoxGeometry(0.34, 0.44, 0.34)                            // industrial capital block
};
const STACK_MAT = new THREE.MeshLambertMaterial({ color: 0x3b3b40 });
const SPIRE_MAT = new THREE.MeshLambertMaterial({ color: 0xb9c6d6 });
// H3 (spec §4b): the HIGH city house kit — gable ridge roofs, chimneys,
// window insets, rampart walls with corner towers. Shared geometries.
const HIGH_GEO = {
  gable: new THREE.ConeGeometry(0.72, 1, 4),          // scaled [long, h, narrow] → a ridge roof
  chimney: new THREE.BoxGeometry(0.028, 0.07, 0.028),
  window: new THREE.BoxGeometry(0.012, 0.03, 0.026),  // proud dark inset on a wall face
  door: new THREE.BoxGeometry(0.014, 0.045, 0.03),
  wallSeg: new THREE.BoxGeometry(0.24, 0.09, 0.045),  // rampart segment (ring of 10)
  wallTower: new THREE.CylinderGeometry(0.045, 0.052, 0.13, 8),
  towerCap: new THREE.ConeGeometry(0.055, 0.06, 8),
  acBox: new THREE.BoxGeometry(0.05, 0.02, 0.05)      // modern rooftop unit
};
const WINDOW_MAT = new THREE.MeshLambertMaterial({ color: 0x1c2230 });
// H9b (user ruling 2026-08-14): roof-STYLE variation on the peaked eras —
// per-house deterministic pick between the era's default, terracotta TILE
// (with a ridge cap), grey-green SHINGLE, and WOODEN LOGS (with two plank
// lines). Industrial/modern keep their flat/slab roofs.
const ROOF_TILE_MAT = new THREE.MeshLambertMaterial({ color: 0xa1543a });
const ROOF_SHINGLE_MAT = new THREE.MeshLambertMaterial({ color: 0x74806e });
const ROOF_LOG_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
// H10 (spec §4b): the era kit — cities age Ancient → Space at High. Each
// band restricts the roof mix, swaps wall materials, and adds its own
// street furniture; everything below keys off the band id + house index.
const TIMBER_MAT = new THREE.MeshLambertMaterial({ color: 0x9a7b52 });   // classical timber-frame walls
const WINDOW_LIT_MAT = new THREE.MeshLambertMaterial({ color: 0xe8c96a }); // industrial+ lit panes
const LAMP_MAT = new THREE.MeshLambertMaterial({ color: 0xffd98a });
const SOLAR_MAT = new THREE.MeshLambertMaterial({ color: 0x2b3f66 });
const PAD_MAT = new THREE.MeshLambertMaterial({ color: 0x8b929c });
const HIGH_ERA_GEO = {
  lampPole: new THREE.CylinderGeometry(0.0045, 0.0055, 0.09, 6),
  lampHead: new THREE.SphereGeometry(0.011, 8, 6),
  antenna: new THREE.CylinderGeometry(0.0025, 0.0035, 0.07, 4),
  solar: new THREE.BoxGeometry(0.05, 0.006, 0.036),
  padDisc: new THREE.CylinderGeometry(0.095, 0.095, 0.008, 20),
  wellRing: new THREE.CylinderGeometry(0.034, 0.038, 0.03, 10),
  wellRoof: new THREE.ConeGeometry(0.045, 0.035, 4),
  wellPost: new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4)
};
// per-band: which of the H9 roof styles are allowed (0 era / 1 tile /
// 2 shingle / 3 logs), whether panes glow, and the band's street kit
// H11: WONDER LANDMARKS — six iconic wonders render as structures on the
// owning city at high (view.wonders is world news, so this is fog-honest).
// Fixed anchor per wonder id; primitives only, faction-neutral materials.
const BRONZE_MAT = new THREE.MeshLambertMaterial({ color: 0xa07437 });
const MARBLE_MAT = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
const SANDSTONE_MAT = new THREE.MeshLambertMaterial({ color: 0xd4b878 });
const WONDER_GEO = {
  domeHalf: new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  dish: new THREE.CylinderGeometry(0.05, 0.012, 0.02, 12),
  hull2: new THREE.BoxGeometry(0.09, 0.024, 0.036),
  waterDisc: new THREE.CylinderGeometry(0.075, 0.075, 0.006, 14),
  rocket: new THREE.CylinderGeometry(0.013, 0.016, 0.09, 10),
  nose2: new THREE.ConeGeometry(0.013, 0.03, 10),
  flagTiny: new THREE.BoxGeometry(0.022, 0.014, 0.003),
  barrel: new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12, 1, false, 0, Math.PI),
  pyr: new THREE.ConeGeometry(0.07, 0.11, 4),
  wallSeg2: new THREE.BoxGeometry(0.11, 0.05, 0.022),
  colTorso: new THREE.BoxGeometry(0.036, 0.06, 0.026),
  colLimb: new THREE.CylinderGeometry(0.007, 0.009, 0.05, 8),
  colHead: new THREE.SphereGeometry(0.016, 10, 8),
  ltHouse: new THREE.CylinderGeometry(0.02, 0.028, 0.16, 12),
  ltHead: new THREE.SphereGeometry(0.016, 10, 8),
  terrace: new THREE.BoxGeometry(0.11, 0.028, 0.11),
  shrub: new THREE.SphereGeometry(0.018, 8, 6),
  column: new THREE.CylinderGeometry(0.006, 0.007, 0.055, 8),
  slab: new THREE.BoxGeometry(0.1, 0.01, 0.07),
  pediment: new THREE.ConeGeometry(0.055, 0.03, 4)
};
// Anchors: 12 SLOTS on the south/east/west rim (the camera-facing lesson);
// each owned wonder takes the next slot in sorted-id order, wrapping with an
// outward bump past 12. Every builder draws RELATIVE to its slot base.
const WONDER_SLOTS = [
  [-0.36, 0.4], [-0.12, 0.44], [0.12, 0.44], [0.36, 0.4],
  [-0.44, 0.24], [0.44, 0.24], [-0.46, 0.06], [0.46, 0.06],
  [-0.42, -0.12], [0.42, -0.12], [-0.24, 0.42], [0.24, 0.42]
];
const WONDER_BUILDERS = {
  pyramids(g, bx, bz) {
    add(g, WONDER_GEO.pyr, SANDSTONE_MAT, bx, 0.055, bz).rotation.y = Math.PI / 4;
    const p2 = add(g, WONDER_GEO.pyr, SANDSTONE_MAT, bx - 0.08, 0.038, bz - 0.06); p2.scale.setScalar(0.7); p2.rotation.y = Math.PI / 4;
    const p3 = add(g, WONDER_GEO.pyr, SANDSTONE_MAT, bx + 0.07, 0.028, bz + 0.05); p3.scale.setScalar(0.5); p3.rotation.y = Math.PI / 4;
  },
  'great-wall'(g, bx, bz) {
    for (const [wx2, wz2, ry] of [[bx - 0.1, bz + 0.02, -0.25], [bx + 0.02, bz, 0.15], [bx + 0.13, bz - 0.04, 0.5]]) {
      add(g, WONDER_GEO.wallSeg2, ERA_MAT.stone, wx2, 0.028, wz2).rotation.y = ry;
    }
    add(g, HIGH_GEO.wallTower, ERA_MAT.stone, bx - 0.16, 0.045, bz + 0.02);
    add(g, HIGH_GEO.towerCap, NEUTRAL.wood, bx - 0.16, 0.1, bz + 0.02);
    add(g, HIGH_GEO.wallTower, ERA_MAT.stone, bx + 0.18, 0.045, bz - 0.05);
    add(g, HIGH_GEO.towerCap, NEUTRAL.wood, bx + 0.18, 0.1, bz - 0.05);
  },
  colossus(g, bx, bz) {
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.008, bz).scale.set(0.6, 1.6, 0.8);
    add(g, WONDER_GEO.colLimb, BRONZE_MAT, bx - 0.01, 0.045, bz - 0.01);
    add(g, WONDER_GEO.colLimb, BRONZE_MAT, bx + 0.01, 0.045, bz + 0.01);
    add(g, WONDER_GEO.colTorso, BRONZE_MAT, bx, 0.1, bz);
    add(g, WONDER_GEO.colHead, BRONZE_MAT, bx, 0.15, bz);
    const arm = add(g, WONDER_GEO.colLimb, BRONZE_MAT, bx + 0.02, 0.145, bz + 0.02);
    arm.rotation.z = -0.6;
    add(g, HIGH_ERA_GEO.lampHead, LAMP_MAT, bx + 0.045, 0.175, bz + 0.035);
  },
  lighthouse(g, bx, bz) {
    add(g, WONDER_GEO.ltHouse, MARBLE_MAT, bx, 0.08, bz);
    add(g, HIGH_GEO.window, STACK_MAT, bx, 0.1, bz + 0.025).scale.set(1.2, 1.2, 1.2);
    add(g, WONDER_GEO.ltHead, LAMP_MAT, bx, 0.175, bz);
    add(g, HIGH_GEO.towerCap, ERA_MAT.tile, bx, 0.2, bz);
  },
  'hanging-gardens'(g, bx, bz) {
    add(g, WONDER_GEO.terrace, SANDSTONE_MAT, bx, 0.014, bz);
    const t2 = add(g, WONDER_GEO.terrace, SANDSTONE_MAT, bx, 0.042, bz); t2.scale.setScalar(0.72);
    const t3 = add(g, WONDER_GEO.terrace, SANDSTONE_MAT, bx, 0.068, bz); t3.scale.setScalar(0.48);
    for (const [gx, gz, gy] of [[-0.05, -0.04, 0.035], [0.05, 0.04, 0.035], [-0.03, 0.05, 0.062], [0.03, -0.05, 0.062], [0, 0, 0.088]]) {
      add(g, WONDER_GEO.shrub, matFor('#3f8f43'), bx + gx, gy, bz + gz);
    }
  },
  oracle(g, bx, bz) {
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.006, bz);
    for (const [cx2, cz2] of [[-0.04, -0.03], [0.04, -0.03], [-0.04, 0.03], [0.04, 0.03]]) {
      add(g, WONDER_GEO.column, MARBLE_MAT, bx + cx2, 0.035, bz + cz2);
    }
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.065, bz).scale.set(0.9, 0.8, 0.9);
    add(g, WONDER_GEO.pediment, MARBLE_MAT, bx, 0.085, bz).rotation.y = Math.PI / 4;
  },
  'great-library'(g, bx, bz) {
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.008, bz).scale.set(1.2, 1.6, 1.2);
    for (const cx2 of [-0.035, 0, 0.035]) add(g, WONDER_GEO.column, MARBLE_MAT, bx + cx2, 0.045, bz + 0.028);
    add(g, HIGH_GEO.window, STACK_MAT, bx, 0.05, bz - 0.01).scale.set(3.2, 2.2, 3);
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.078, bz).scale.set(1.05, 0.8, 1.05);
  },
  'copernicus-observatory'(g, bx, bz) {
    add(g, WONDER_GEO.ltHouse, ERA_MAT.stone, bx, 0.06, bz).scale.set(1.3, 0.75, 1.3);
    add(g, WONDER_GEO.domeHalf, MARBLE_MAT, bx, 0.12, bz);
    const t = add(g, WONDER_GEO.column, BRONZE_MAT, bx + 0.02, 0.16, bz);
    t.rotation.z = -0.7; // the telescope
  },
  'darwin-s-voyage'(g, bx, bz) {
    add(g, WONDER_GEO.waterDisc, matFor('#3d84b8'), bx, 0.006, bz);
    add(g, WONDER_GEO.hull2, NEUTRAL.wood, bx, 0.03, bz);
    add(g, WONDER_GEO.column, NEUTRAL.wood, bx, 0.07, bz).scale.set(0.8, 1.2, 0.8);
    add(g, WONDER_GEO.flagTiny, matFor('#e8e0cc'), bx + 0.015, 0.09, bz);
  },
  'magellan-s-expedition'(g, bx, bz) {
    add(g, WONDER_GEO.waterDisc, matFor('#2f6f9f'), bx, 0.006, bz);
    add(g, WONDER_GEO.hull2, NEUTRAL.wood, bx - 0.01, 0.03, bz).scale.set(1.2, 1, 1.1);
    add(g, WONDER_GEO.column, NEUTRAL.wood, bx - 0.03, 0.07, bz).scale.set(0.8, 1.2, 0.8);
    add(g, WONDER_GEO.column, NEUTRAL.wood, bx + 0.02, 0.065, bz).scale.set(0.7, 1, 0.7);
    add(g, WONDER_GEO.flagTiny, matFor('#d84a3b'), bx - 0.015, 0.09, bz);
  },
  'isaac-newton-s-college'(g, bx, bz) {
    add(g, HIGH_GEO.window, ERA_MAT.brick, bx, 0.035, bz).scale.set(5.5, 2.4, 4);
    add(g, HIGH_GEO.wallTower, ERA_MAT.brick, bx - 0.05, 0.05, bz).scale.setScalar(0.8);
    add(g, HIGH_GEO.wallTower, ERA_MAT.brick, bx + 0.05, 0.05, bz).scale.setScalar(0.8);
    add(g, HIGH_ERA_GEO.wellPost, NEUTRAL.wood, bx + 0.085, 0.035, bz + 0.03);
    add(g, WONDER_GEO.shrub, matFor('#3f8f43'), bx + 0.085, 0.075, bz + 0.03);
    add(g, WONDER_GEO.shrub, matFor('#c33'), bx + 0.095, 0.052, bz + 0.038).scale.setScalar(0.3); // the apple
  },
  'j-s-bach-s-cathedral'(g, bx, bz) {
    add(g, HIGH_GEO.window, ERA_MAT.stone, bx, 0.04, bz).scale.set(4.5, 3, 5.5);
    add(g, HIGH_GEO.gable, ERA_MAT.tile, bx, 0.085, bz).scale.set(0.09, 0.05, 0.062);
    add(g, PROP_GEO.spire, MARBLE_MAT, bx - 0.035, 0.14, bz).scale.setScalar(0.35);
    add(g, HIGH_ERA_GEO.lampHead, matFor('#7a5230'), bx + 0.03, 0.07, bz + 0.032); // rose window
  },
  'michelangelo-s-chapel'(g, bx, bz) {
    add(g, HIGH_GEO.window, MARBLE_MAT, bx, 0.035, bz).scale.set(4.5, 2.6, 4.5);
    const roof = add(g, WONDER_GEO.barrel, ERA_MAT.tile, bx, 0.062, bz);
    roof.rotation.z = Math.PI / 2; roof.scale.set(0.75, 0.62, 0.75);
    add(g, WONDER_GEO.domeHalf, MARBLE_MAT, bx, 0.075, bz).scale.setScalar(0.6);
  },
  'shakespeare-s-theatre'(g, bx, bz) { // the Globe: an open ring + thatch rim
    add(g, HIGH_ERA_GEO.wellRing, ERA_MAT.mud, bx, 0.03, bz).scale.set(1.9, 1.6, 1.9);
    add(g, HIGH_ERA_GEO.wellRing, ERA_MAT.thatch, bx, 0.062, bz).scale.set(2.0, 0.5, 2.0);
    add(g, WONDER_GEO.slab, NEUTRAL.wood, bx, 0.012, bz).scale.set(0.45, 1, 0.45); // the stage
  },
  'leonardo-s-workshop'(g, bx, bz) {
    add(g, HIGH_GEO.window, ERA_MAT.mud, bx, 0.03, bz).scale.set(4, 2.2, 3.4);
    add(g, HIGH_GEO.gable, ERA_MAT.tile, bx, 0.062, bz).scale.set(0.075, 0.04, 0.05);
    add(g, WONDER_GEO.column, NEUTRAL.wood, bx + 0.05, 0.09, bz).scale.set(0.6, 0.9, 0.6);
    const wing = add(g, HIGH_GEO.window, ERA_MAT.thatch, bx + 0.05, 0.125, bz); // the flying machine
    wing.scale.set(6, 0.4, 1.6); wing.rotation.z = 0.15;
  },
  'hoover-dam'(g, bx, bz) {
    add(g, WONDER_GEO.waterDisc, matFor('#2f6f9f'), bx, 0.006, bz - 0.045).scale.set(0.9, 1, 0.7);
    for (const [ox, ry] of [[-0.045, 0.35], [0, 0], [0.045, -0.35]]) {
      const seg = add(g, WONDER_GEO.wallSeg2, ERA_MAT.concrete, bx + ox, 0.035, bz + 0.01);
      seg.rotation.y = ry; seg.scale.set(0.55, 1.5, 1.4);
    }
  },
  'women-s-suffrage'(g, bx, bz) { // the banner statue
    add(g, WONDER_GEO.slab, MARBLE_MAT, bx, 0.008, bz).scale.set(0.55, 1.6, 0.7);
    add(g, WONDER_GEO.colTorso, BRONZE_MAT, bx, 0.075, bz).scale.setScalar(0.85);
    add(g, WONDER_GEO.colHead, BRONZE_MAT, bx, 0.12, bz).scale.setScalar(0.85);
    const arm = add(g, WONDER_GEO.colLimb, BRONZE_MAT, bx + 0.015, 0.115, bz);
    arm.rotation.z = -1.1;
    add(g, WONDER_GEO.flagTiny, matFor('#7a4a8a'), bx + 0.045, 0.135, bz).scale.setScalar(1.4);
  },
  'united-nations'(g, bx, bz) {
    add(g, HIGH_GEO.window, ERA_MAT.glass, bx, 0.07, bz).scale.set(1.6, 6.5, 3.6); // the slab tower
    for (const [i2, c] of [[-1, '#d84a3b'], [0, '#3b7dd8'], [1, '#3f8f43']].map((v, i3) => [v[0], v[1]])) {
      add(g, HIGH_ERA_GEO.wellPost, NEUTRAL.metal, bx + i2 * 0.028 - 0.0, 0.03, bz + 0.05);
      add(g, WONDER_GEO.flagTiny, matFor(c), bx + i2 * 0.028 + 0.012, 0.055, bz + 0.05);
    }
  },
  'manhattan-project'(g, bx, bz) {
    add(g, HIGH_GEO.window, ERA_MAT.concrete, bx, 0.028, bz).scale.set(4.5, 2, 4.5); // the bunker
    add(g, HIGH_GEO.window, matFor('#e8c020'), bx, 0.05, bz + 0.001).scale.set(4.6, 0.4, 4.6); // warning band
    add(g, PROP_GEO.smokestack, STACK_MAT, bx + 0.05, 0.07, bz - 0.03).scale.setScalar(0.35);
  },
  'seti-program'(g, bx, bz) {
    add(g, HIGH_GEO.wallTower, ERA_MAT.concrete, bx, 0.04, bz).scale.set(0.8, 0.6, 0.8);
    const dish = add(g, WONDER_GEO.dish, MARBLE_MAT, bx, 0.085, bz);
    dish.rotation.z = 0.6; dish.rotation.x = 0.2;
    add(g, WONDER_GEO.column, NEUTRAL.metal, bx + 0.02, 0.1, bz).scale.set(0.4, 0.5, 0.4);
  },
  'cure-for-cancer'(g, bx, bz) {
    add(g, HIGH_GEO.window, MARBLE_MAT, bx, 0.035, bz).scale.set(4.5, 2.6, 4);
    add(g, HIGH_GEO.window, matFor('#3f8f43'), bx, 0.045, bz + 0.026).scale.set(0.6, 1.6, 0.5); // the cross
    add(g, HIGH_GEO.window, matFor('#3f8f43'), bx, 0.045, bz + 0.026).scale.set(1.8, 0.55, 0.5);
  },
  'apollo-program'(g, bx, bz) {
    add(g, WONDER_GEO.slab, ERA_MAT.concrete, bx, 0.006, bz).scale.set(1.1, 1.2, 1.1);
    add(g, WONDER_GEO.rocket, MARBLE_MAT, bx, 0.055, bz);
    add(g, WONDER_GEO.nose2, matFor('#d84a3b'), bx, 0.115, bz);
    add(g, HIGH_GEO.window, STACK_MAT, bx + 0.03, 0.05, bz).scale.set(0.5, 4.2, 0.5); // the gantry
  }
};
function addWonderLandmarks(group, wonderIds) {
  const owned = [...wonderIds].sort();
  owned.forEach((wid, i) => {
    const builder = WONDER_BUILDERS[wid];
    if (!builder) return;
    const slot = WONDER_SLOTS[i % WONDER_SLOTS.length];
    const ring = Math.floor(i / WONDER_SLOTS.length); // >12 wonders: bump outward
    const scale2 = 1 + ring * 0.18;
    builder(group, slot[0] * scale2, slot[1] * scale2);
  });
}
const HIGH_ERA_KIT = {
  ancient:           { roofs: [0, 3, 0, 3], lit: false, lamps: false, well: true },
  classicalMedieval: { roofs: [0, 1, 2, 3], lit: false, lamps: false, well: false },
  industrial:        { roofs: [0], lit: true, lamps: true, warehouse: true },
  modernSpace:       { roofs: [0], lit: true, lamps: true, tech: true }
};
const DOOR_MAT = new THREE.MeshLambertMaterial({ color: 0x2e2418 });

// The band's signature central structure. CITY_TIERS gates the tower to upper
// tiers; the capital always gets the (larger) band core, so it evolves
// hall -> keep -> civic -> spire across the ages.
function addEraSignature(group, style, tier, tierIndex, isCapital) {
  const s = tier.scale;
  if (style.prop === 'keep' && (isCapital || tierIndex >= 2)) {
    const big = isCapital ? 1.3 : 1;
    const t = add(group, PROP_GEO.keepBody, ERA_MAT.stone, 0, 0.25 * s * big, 0);
    t.scale.set(s * big, s * big, s * big);
    const cap = add(group, GEO.roof, ERA_MAT.tile, 0, 0.5 * s * big, 0);
    cap.scale.set(0.22 * s * big, 0.2 * s * big, 0.22 * s * big); cap.rotation.y = Math.PI / 4;
  } else if (style.prop === 'smokestack') {
    if (isCapital) { // industrial capital = a rectilinear civic block + stacks
      const c = add(group, PROP_GEO.civic, ERA_MAT.brick, 0, 0.22 * s, 0); c.scale.set(s, s, s);
      const r = add(group, ROOF_GEO.flat, ERA_MAT.tar, 0, 0.45 * s, 0); r.scale.set(0.36 * s, 0.12 * s, 0.36 * s);
    }
    const n = isCapital ? 3 : Math.min(3, 1 + tierIndex);
    const spots = [[-0.14, 0.1], [0.16, -0.04], [0.03, 0.17]];
    for (let i = 0; i < n; i++) {
      const st = add(group, PROP_GEO.smokestack, STACK_MAT, spots[i][0], 0.31 * s, spots[i][1]);
      st.scale.set(s * 0.9, s, s * 0.9);
    }
  } else if (style.prop === 'spire') {
    const big = isCapital ? 1.35 : 1;
    const dome = add(group, PROP_GEO.dome, ERA_MAT.glass, 0, 0.16 * s, 0); dome.scale.set(s * big, s * big, s * big);
    const sp = add(group, PROP_GEO.spire, SPIRE_MAT, 0, 0.42 * s * big, 0); sp.scale.set(s * big, s * big * 1.1, s * big);
  } else if (isCapital) { // ancient capital = a larger central hall
    const b = add(group, GEO.box, ERA_MAT.mud, 0, 0.2 * s, 0); b.scale.set(0.3 * s, 0.4 * s, 0.3 * s);
    const r = add(group, GEO.roof, ERA_MAT.thatch, 0, 0.44 * s, 0); r.scale.set(0.34 * s, 0.32 * s, 0.34 * s); r.rotation.y = Math.PI / 4;
  }
}

// level (G4): high densifies the house ring +30% — same tier ladder, same era
// styles, just a fuller settlement; low/medium build exactly the shipped count.
export function createCityMesh(city, colorOrVisual, isCapital, eraBand, level = 'low', wonderIds = []) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const baseTier = cityTierFor(city.pop);
  const tier = (level === 'medium' || level === 'high') // H1: density rides down to medium
    ? { minPop: baseTier.minPop, houses: Math.ceil(baseTier.houses * 1.3), scale: baseTier.scale }
    : baseTier;
  const tierIndex = CITY_TIERS.indexOf(baseTier); // index by the REAL tier — the high-density clone is not in the table
  // ERA band (render-only hint): the annotated view passes it via a side map
  // (see index.js buildCities); direct callers (gallery/mock) may set a
  // `city.eraBand` field instead; no band → ancient.
  const band = CITY_ERA_STYLES[eraBand || city.eraBand] ? (eraBand || city.eraBand) : 'ancient';
  const style = CITY_ERA_STYLES[band];
  const kit = HIGH_ERA_KIT[band]; // H10: the band's High street kit
  // A88: house SHAPE from CITY_RECIPE; the era band sets roof SHAPE + body/roof
  // MATERIAL (not owner color — that's the base ring). The placement is procedural.
  const houseGeo = geometryFor(CITY_RECIPE.house);
  const roofGeo = ROOF_GEO[style.roofShape] || ROOF_GEO.peak;
  const bodyMat = ERA_MAT[style.body] || NEUTRAL.house;
  const roofMat = ERA_MAT[style.roofMat] || NEUTRAL.stone;
  const peaked = style.roofShape === 'peak';
  for (let i = 0; i < tier.houses; i++) {
    const angle = (i / tier.houses) * Math.PI * 2 + 0.5;
    const dist = 0.16 + (i % 3) * 0.1;
    const w = 0.14 + (i % 2) * 0.04;
    const h = (0.12 + (i % 4) * 0.03) * tier.scale;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const base = add(group, houseGeo, bodyMat, x, h / 2, z);
    base.scale.set(w, h, w);
    if (level === 'medium' || level === 'high') { // H12: city kits ride to MEDIUM (user ruling 2026-08-15)
      // H3: the model-grade house — houses FACE the city center (rotate the
      // whole footprint), gable ridge roof for peaked eras, chimney, a lit
      // window pair on the street face, a door on every third house. All
      // deterministic off the house index — no RNG, rebuilds are stable.
      // H8 (user ruling 2026-08-14): the OUTER-ring houses — the ones a
      // zoomed-in player actually sees — carry the full facade kit: framed
      // panes, door + lintel + step, and every other outer house gains a
      // second storey with an upper window row. Inner houses stay simple
      // (occluded by the ring).
      // H8b (user ruling 2026-08-14): facades face the CAMERA — the game
      // camera sits south of the target looking north, so +z surfaces are
      // the visible ones. Center-facing facades rendered detail nobody
      // could see. All high houses align south, village-grid style.
      const facing = Math.PI / 2;
      base.rotation.y = facing;
      const outer = (i % 3) !== 0; // dist 0.26 / 0.36 rings
      const twoStorey = outer && i % 2 === 0;
      const hh = twoStorey ? h * 1.45 : h; // the storey grows the body
      if (twoStorey) { base.scale.set(w, hh, w); base.position.y = hh / 2; }
      if (peaked) {
        // H9b: roof style rotates per house — era default / tile / shingle /
        // logs; H10 restricts the rotation to the BAND's set (ancient has no
        // terracotta, industrial+ never thatch)
        const styleIdx = kit.roofs[i % kit.roofs.length];
        const roofPick = styleIdx === 1 ? ROOF_TILE_MAT : styleIdx === 2 ? ROOF_SHINGLE_MAT : styleIdx === 3 ? ROOF_LOG_MAT : roofMat;
        const roof = add(group, HIGH_GEO.gable, roofPick, x, hh + hh * 0.28, z);
        roof.scale.set(w * 1.05, hh * 0.62, w * 0.72);
        roof.rotation.y = facing + Math.PI / 4; // cone seg-4 diagonal → ridge along the footprint
        if (styleIdx === 1) { // tile: a ridge cap along the peak
          const cap = add(group, HIGH_GEO.window, ROOF_LOG_MAT, x, hh + hh * 0.56, z);
          cap.rotation.y = facing + Math.PI / 2;
          cap.scale.set(1.1, 0.5, w * 68);
        } else if (styleIdx === 3) { // logs: two plank lines across the slope
          for (const t of [0.36, 0.46]) {
            const plank = add(group, HIGH_GEO.window, ROOF_TILE_MAT,
              x + Math.cos(facing) * w * 0.32, hh + hh * t, z + Math.sin(facing) * w * 0.32);
            plank.rotation.y = facing + Math.PI / 2;
            plank.scale.set(0.7, 0.35, w * 52);
          }
        }
        const ch = add(group, HIGH_GEO.chimney, STACK_MAT, x + Math.cos(facing + 2.2) * w * 0.28, hh + hh * 0.5, z + Math.sin(facing + 2.2) * w * 0.28);
        ch.scale.setScalar(tier.scale);
        if (outer) { // H8: gable trim under the eave on the street face
          const trim = add(group, HIGH_GEO.window, roofMat,
            x + Math.cos(facing) * w * 0.5, hh * 0.98, z + Math.sin(facing) * w * 0.5);
          trim.rotation.y = facing;
          trim.scale.set(0.7, 0.35, w * 32);
        }
      } else if (style.roofShape === 'flat') { // industrial: low roof + thin stack on every other house
        const roof = add(group, roofGeo, roofMat, x, hh + hh * 0.08, z);
        roof.scale.set(w * 0.98, hh * 0.2, w * 0.98);
        roof.rotation.y = facing;
        if (i % 2 === 0) add(group, PROP_GEO.smokestack, STACK_MAT, x, hh + hh * 0.2, z).scale.setScalar(0.32 * tier.scale);
      } else { // modern slab: rooftop unit instead of a chimney
        const roof = add(group, roofGeo, roofMat, x, hh + hh * 0.08, z);
        roof.scale.set(w * 0.98, hh * 0.2, w * 0.98);
        roof.rotation.y = facing;
        add(group, HIGH_GEO.acBox, STACK_MAT, x + w * 0.15, hh + hh * 0.18, z);
      }
      // H10: era wall variety + the band's street furniture
      if (band === 'classicalMedieval' && outer && i % 2 === 1) base.material = TIMBER_MAT; // timber-frame rows
      if (band === 'industrial' && kit.warehouse && outer && i % 3 === 1) {
        base.scale.set(w * 1.45, hh * 0.62, w * 1.05); // the warehouse proportion
        base.position.y = hh * 0.31;
      }
      if (kit.lamps && outer && i % 3 === 0) { // a street lamp at the door side
        const lx = x + Math.cos(facing) * w * 0.85, lz = z + Math.sin(facing) * w * 0.85;
        add(group, HIGH_ERA_GEO.lampPole, STACK_MAT, lx, 0.045, lz);
        add(group, HIGH_ERA_GEO.lampHead, LAMP_MAT, lx, 0.095, lz);
      }
      if (band === 'modernSpace' && kit.tech && outer) { // rooftop tech
        if (twoStorey) add(group, HIGH_ERA_GEO.antenna, NEUTRAL.metal, x + w * 0.2, hh + hh * 0.3, z);
        else {
          const sp = add(group, HIGH_ERA_GEO.solar, SOLAR_MAT, x - w * 0.1, hh + hh * 0.2, z);
          sp.rotation.z = 0.25;
        }
      }
      // windows on the street face (proud dark boxes; the inset READ).
      // H8: outer houses get FRAMED panes; two-storey houses an upper row.
      const wx1 = x + Math.cos(facing) * w * 0.52, wz1 = z + Math.sin(facing) * w * 0.52;
      const side = facing + Math.PI / 2;
      const paneMat = kit.lit ? WINDOW_LIT_MAT : WINDOW_MAT; // H10: industrial+ panes glow
      const paneRows = twoStorey ? [hh * 0.32, hh * 0.68] : [h * 0.55];
      for (const rowY of paneRows) {
        for (const off of !outer ? [0.22] : [-0.2, 0.24]) {
          const px = wx1 + Math.cos(side) * w * off, pz = wz1 + Math.sin(side) * w * off;
          if (outer) { // frame: a lighter surround slightly behind the pane
            const fr = add(group, HIGH_GEO.window, ERA_MAT.thatch,
              px - Math.cos(facing) * 0.004, rowY, pz - Math.sin(facing) * 0.004);
            fr.rotation.y = facing;
            fr.scale.set(tier.scale * 0.8, tier.scale * 1.3, tier.scale * 1.35);
          }
          const wm = add(group, HIGH_GEO.window, paneMat, px, rowY, pz);
          wm.rotation.y = facing;
          wm.scale.setScalar(tier.scale);
        }
      }
      if (!outer ? i % 3 === 0 : true) { // H8: every OUTER house gets a door
        const doorY = hh * 0.16;
        const dx2 = wx1 + Math.cos(side) * w * -0.12, dz2 = wz1 + Math.sin(side) * w * -0.12;
        const dm = add(group, HIGH_GEO.door, DOOR_MAT, dx2, doorY, dz2);
        dm.rotation.y = facing;
        dm.scale.setScalar(tier.scale);
        if (outer) {
          const lintel = add(group, HIGH_GEO.window, ERA_MAT.stone,
            dx2, doorY + 0.028 * tier.scale, dz2);
          lintel.rotation.y = facing;
          lintel.scale.set(tier.scale * 0.7, tier.scale * 0.4, tier.scale * 1.5);
          const step = add(group, HIGH_GEO.window, ERA_MAT.stone,
            dx2 + Math.cos(facing) * 0.008, 0.006, dz2 + Math.sin(facing) * 0.008);
          step.rotation.y = facing;
          step.scale.set(tier.scale * 1.2, tier.scale * 0.3, tier.scale * 1.6);
        }
      }
    } else {
    const roof = add(group, roofGeo, roofMat, x, 0, z);
    if (peaked) {
      roof.position.y = h + h * 0.32; roof.scale.set(w * 0.82, h * 0.7, w * 0.82);
      roof.rotation.y = Math.PI / 4;
    } else { // flat / slab industrial+modern rooflines sit low on the body
      roof.position.y = h + h * 0.08; roof.scale.set(w * 0.98, h * 0.2, w * 0.98);
    }
    }
  }
  // the band's signature central structure (tower / smokestacks / dome+spire /
  // capital hall), gated by tier + capital
  addEraSignature(group, style, tier, tierIndex, isCapital);
  // H10: the ancient WELL (a non-capital village's center) and the
  // modernSpace capital's LANDING PAD at the city edge
  if ((level === 'medium' || level === 'high') && kit) { // H12: medium too
    // H11: the owning city's wonder landmarks (view.wonders = world news)
    if (wonderIds.length) addWonderLandmarks(group, wonderIds);
    // H11: three classical banner poles around the ring (user: "add 3")
    if (band === 'classicalMedieval') {
      for (const ang of [0.8, 2.9, 5.0]) {
        const bx = Math.cos(ang) * 0.44, bz = Math.sin(ang) * 0.44;
        const pole = add(group, GEO.pole, NEUTRAL.wood, bx, 0.24, bz);
        pole.scale.set(0.7, 0.7, 0.7);
        const fl = add(group, GEO.flag, flagMatFor(visual.primary), bx + 0.05, 0.42, bz);
        fl.scale.set(0.55, 0.55, 1);
      }
    }
    if (kit.well && !isCapital) {
      add(group, HIGH_ERA_GEO.wellRing, ERA_MAT.stone, 0.1, 0.02, -0.08);
      add(group, HIGH_ERA_GEO.wellPost, NEUTRAL.wood, 0.065, 0.05, -0.08);
      add(group, HIGH_ERA_GEO.wellPost, NEUTRAL.wood, 0.135, 0.05, -0.08);
      const wr = add(group, HIGH_ERA_GEO.wellRoof, ERA_MAT.thatch, 0.1, 0.095, -0.08);
      wr.rotation.y = Math.PI / 4;
    }
    if (band === 'modernSpace' && isCapital) {
      add(group, HIGH_ERA_GEO.padDisc, PAD_MAT, 0.2, 0.008, 0.34);
      const m1 = add(group, HIGH_GEO.window, WINDOW_MAT, 0.2, 0.014, 0.34);
      m1.scale.set(2.2, 0.3, 4.5); // the H marking bars
      const m2 = add(group, HIGH_GEO.window, WINDOW_MAT, 0.16, 0.014, 0.34);
      m2.scale.set(0.8, 0.3, 2.2);
      const m3 = add(group, HIGH_GEO.window, WINDOW_MAT, 0.24, 0.014, 0.34);
      m3.scale.set(0.8, 0.3, 2.2);
    }
  }
  // owner identity: a colored base RING (guardrail — never the body/roof, so the
  // era reads at map zoom); the banner/flag also carries the owner color
  const ownerRing = add(group, GEO.baseRim, matFor(visual.primary), 0, 0.035, 0);
  ownerRing.rotation.x = Math.PI / 2; ownerRing.scale.set(1.3, 1.3, 1.3);
  if (isCapital && visual.emblem) {
    // the capital flies the full CanvasTexture emblem flag (art A1.6a),
    // hinged at the pole top for the A28 sway like the pennants
    add(group, GEO.pole, NEUTRAL.stone, 0, 0.42, 0);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.62, 0);
    hinge.userData.sway = 1;
    group.add(hinge);
    add(hinge, GEO.cityFlag, flagTexMatFor(visual), 0.16, 0, 0);
  } else {
    pennant(group, visual, 0, 0.4, 1.15);
  }
  if (isLightColor(visual.primary)) {
    // light civs (Ivory Tower, Arctic Rune) need a dark ground outline
    const rim = add(group, GEO.wallRing, DARK_RIM, 0, 0.03, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(0.9, 0.9, 0.5);
  }
  if ((city.buildings || []).indexOf('city-walls') !== -1) {
    if (level === 'medium' || level === 'high') { // H12: medium too
      // H3: a real rampart — 10 wall segments in a ring with 5 corner towers
      // (capped), replacing the torus marker. Deterministic ring placement.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const seg = add(group, HIGH_GEO.wallSeg, NEUTRAL.stone, Math.cos(a) * 0.46, 0.045, Math.sin(a) * 0.46);
        seg.rotation.y = -a + Math.PI / 2;
        if (i % 2 === 0) {
          add(group, HIGH_GEO.wallTower, ERA_MAT.stone || NEUTRAL.stone, Math.cos(a) * 0.46, 0.065, Math.sin(a) * 0.46);
          add(group, HIGH_GEO.towerCap, NEUTRAL.wood, Math.cos(a) * 0.46, 0.16, Math.sin(a) * 0.46);
        }
      }
    } else {
      const wall = add(group, GEO.wallRing, NEUTRAL.stone, 0, 0.06, 0);
      wall.rotation.x = Math.PI / 2;
    }
  }
  return group;
}
