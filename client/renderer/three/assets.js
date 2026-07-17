// AssetFactory (art track A0/A1, specs/plan-assets.md): all unit/city mesh
// construction lives here — the renderer maps state to visuals, this module
// decides how they look. Ownership reads as a colored base disc + banner on
// a mostly neutral body (not a whole-mesh recolor). Materials are Lambert
// (cheap on SwiftShader/WebGL1 — the r162 constraint applies to art too) and
// cached per color; geometries are shared module constants, so removing a
// group from the scene needs no disposal.
import * as THREE from 'three';
import { emblemTexture, isLightColor } from './factions.js';
import { UNIT_RECIPES, CITY_RECIPE } from './recipes.js';

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
const recipeGeo = {};
function geometryFor(p) {
  const key = p.shape + '|' + p.size.join(',') + '|' + (p.seg === undefined ? '' : [].concat(p.seg).join(','));
  if (recipeGeo[key]) return recipeGeo[key];
  let g;
  if (p.shape === 'box') g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
  else if (p.shape === 'cyl') g = new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], p.seg);
  else if (p.shape === 'cone') g = new THREE.ConeGeometry(p.size[0], p.size[1], p.seg);
  else if (p.shape === 'sphere') g = new THREE.SphereGeometry(p.size[0], p.seg[0], p.seg[1]);
  else if (p.shape === 'dodeca') g = new THREE.DodecahedronGeometry(p.size[0], p.seg || 0);
  recipeGeo[key] = g;
  return g;
}
// a colorRole slot → material: neutral roles from NEUTRAL, 'primary'/'secondary'
// injected from the civ visual (the data itself never carries a faction hex)
function roleMaterial(role, visual) {
  if (role === 'primary') return matFor(visual.primary);
  if (role === 'secondary') return matFor(visual.secondary);
  return NEUTRAL[role];
}
// compose a recipe's primitive list into the group — byte-identical to the
// hand-written add()/scale/rotation the silhouette functions used to do inline
function composeRecipe(group, recipe, visual) {
  for (const p of recipe) {
    const mesh = add(group, geometryFor(p), roleMaterial(p.color, visual), p.pos[0], p.pos[1], p.pos[2]);
    if (p.scale !== undefined) {
      if (Array.isArray(p.scale)) mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
      else mesh.scale.setScalar(p.scale);
    }
    if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  }
}

// silhouette classes covering all 28 Civ 1 unit types
const WAGON_TYPES = { settlers: true, caravan: true, diplomat: true };
const FOOT_TYPES = {
  militia: true, phalanx: true, legion: true,
  musketeers: true, riflemen: true // A67: mech-inf now rides an APC, not a foot figure
};
const MOUNTED_TYPES = { cavalry: true, knights: true, chariot: true };
const SIEGE_TYPES = { catapult: true, cannon: true, artillery: true };
const SAIL_TYPES = { trireme: true, sail: true, frigate: true, transport: true };
const POWERED_TYPES = { ironclad: true, cruiser: true, battleship: true, carrier: true };
const AIR_TYPES = { fighter: true, bomber: true, nuclear: true };

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

function footSoldier(group, visual) {
  composeRecipe(group, UNIT_RECIPES.footSoldier, visual); // A88: body is data
  pennant(group, visual, -0.16, 0.3, 0.7);
}

function wagon(group, visual) {
  composeRecipe(group, UNIT_RECIPES.wagon, visual); // A88: body is data
  pennant(group, visual, -0.3, 0.32, 0.7);
}

function mounted(group, visual, isChariot) {
  composeRecipe(group, UNIT_RECIPES.mounted, visual); // A88
  if (isChariot) composeRecipe(group, UNIT_RECIPES.chariotWheels, visual);
  pennant(group, visual, -0.28, 0.34, 0.7);
}

function siege(group, visual) {
  composeRecipe(group, UNIT_RECIPES.siege, visual); // A88
  pennant(group, visual, -0.26, 0.3, 0.65);
}

// A67: tracked armour — armor→tank, mech-inf→apc. The recipe name IS the
// UNIT_SILHOUETTE mapping, so browser + Roblox render the same body.
function armored(group, visual, recipeName) {
  composeRecipe(group, UNIT_RECIPES[recipeName], visual);
  pennant(group, visual, -0.28, 0.3, 0.62);
}

function ship(group, visual, kind) {
  if (kind === 'sail') {
    composeRecipe(group, UNIT_RECIPES.shipSail, visual); // A88 (hull/bow/pole)
    const sail = add(group, GEO.flag, NEUTRAL.canvas, -0.04, 0.42, 0.02); // sail is a plane → procedural
    sail.scale.set(1.3, 2, 1);
  } else if (kind === 'sub') {
    composeRecipe(group, UNIT_RECIPES.shipSub, visual);
  } else {
    composeRecipe(group, UNIT_RECIPES.shipPowered, visual);
  }
  pennant(group, visual, -0.28, 0.14, 0.65);
}

function aircraft(group, visual) {
  composeRecipe(group, UNIT_RECIPES.aircraft, visual); // A88
}

function fallbackToken(group) {
  composeRecipe(group, UNIT_RECIPES.fallback); // A88 (all-neutral, no visual needed)
}

// Returns a group with its base at y = 0 (place it on the tile top).
// colorOrVisual: '#hex' fallback OR a civ visual {primary, secondary, emblem};
// status: { veteran, fortified, canMove } drives the token-layer markers.
export function createUnitMesh(unitType, colorOrVisual, status) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const naval = SAIL_TYPES[unitType] || POWERED_TYPES[unitType] || unitType === 'submarine';
  baseToken(group, visual, status, naval ? 0.02 : 0.035);
  if (WAGON_TYPES[unitType]) wagon(group, visual);
  else if (FOOT_TYPES[unitType]) footSoldier(group, visual);
  else if (MOUNTED_TYPES[unitType]) mounted(group, visual, unitType === 'chariot');
  else if (unitType === 'armor') armored(group, visual, 'tank'); // A67
  else if (unitType === 'mech-inf') armored(group, visual, 'apc'); // A67
  else if (SIEGE_TYPES[unitType]) siege(group, visual);
  else if (SAIL_TYPES[unitType]) ship(group, visual, 'sail');
  else if (unitType === 'submarine') ship(group, visual, 'sub');
  else if (POWERED_TYPES[unitType]) ship(group, visual, 'powered');
  else if (AIR_TYPES[unitType]) aircraft(group, visual);
  else fallbackToken(group);
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

export function createCityMesh(city, colorOrVisual, isCapital) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const tier = cityTierFor(city.pop);
  // A88: house/roof SHAPES from CITY_RECIPE; the ring placement stays procedural
  const houseGeo = geometryFor(CITY_RECIPE.house);
  const roofGeo = geometryFor(CITY_RECIPE.roof);
  const houseMat = roleMaterial(CITY_RECIPE.house.color, visual);
  const roofMat = roleMaterial(CITY_RECIPE.roof.color, visual);
  for (let i = 0; i < tier.houses; i++) {
    const angle = (i / tier.houses) * Math.PI * 2 + 0.5;
    const dist = 0.16 + (i % 3) * 0.1;
    const w = 0.14 + (i % 2) * 0.04;
    const h = (0.12 + (i % 4) * 0.03) * tier.scale;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const base = add(group, houseGeo, houseMat, x, h / 2, z);
    base.scale.set(w, h, w);
    const roof = add(group, roofGeo, roofMat, x, h + h * 0.3, z);
    roof.scale.set(w * 0.8, h * 0.6, w * 0.8);
    roof.rotation.y = Math.PI / 4;
  }
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
    const wall = add(group, GEO.wallRing, NEUTRAL.stone, 0, 0.06, 0);
    wall.rotation.x = Math.PI / 2;
  }
  return group;
}
