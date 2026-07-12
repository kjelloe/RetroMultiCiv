// AssetFactory (art track A0/A1, specs/plan-assets.md): all unit/city mesh
// construction lives here — the renderer maps state to visuals, this module
// decides how they look. Ownership reads as a colored base disc + banner on
// a mostly neutral body (not a whole-mesh recolor). Materials are Lambert
// (cheap on SwiftShader/WebGL1 — the r162 constraint applies to art too) and
// cached per color; geometries are shared module constants, so removing a
// group from the scene needs no disposal.
import * as THREE from 'three';
import { emblemTexture, isLightColor } from './factions.js';

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

// silhouette classes covering all 28 Civ 1 unit types
const WAGON_TYPES = { settlers: true, caravan: true, diplomat: true };
const FOOT_TYPES = {
  militia: true, phalanx: true, legion: true,
  musketeers: true, riflemen: true, 'mech-inf': true
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
  const flag = add(group, GEO.flag, flagMatFor(visual.primary), x + 0.09 * s, y + 0.24 * s, 0);
  flag.scale.setScalar(s * 0.8);
  if (visual.emblem) {
    const dot = add(group, GEO.emblemDisc, flagMatFor(visual.secondary), x + 0.09 * s, y + 0.24 * s, 0.006);
    dot.scale.setScalar(s);
  }
}

function footSoldier(group, visual) {
  add(group, GEO.body, NEUTRAL.cloth, 0, 0.28, 0);
  add(group, GEO.head, NEUTRAL.skin, 0, 0.56, 0);
  const spear = add(group, GEO.spear, NEUTRAL.wood, 0.15, 0.42, 0);
  spear.rotation.z = -0.12;
  const tip = add(group, GEO.spearTip, NEUTRAL.metal, 0.19, 0.8, 0);
  tip.rotation.z = -0.12;
  pennant(group, visual, -0.16, 0.3, 0.7);
}

function wagon(group, visual) {
  add(group, GEO.wagonBody, NEUTRAL.wood, 0, 0.22, 0);
  const top = add(group, GEO.wagonTop, NEUTRAL.canvas, 0, 0.34, 0);
  top.rotation.z = Math.PI / 2; // canvas roof lies along the wagon
  for (const dx of [-0.17, 0.17]) {
    for (const dz of [-0.16, 0.16]) {
      const wheel = add(group, GEO.wheel, NEUTRAL.wheel, dx, 0.09, dz);
      wheel.rotation.x = Math.PI / 2;
    }
  }
  pennant(group, visual, -0.3, 0.32, 0.7);
}

function mounted(group, visual, isChariot) {
  const body = add(group, GEO.box, NEUTRAL.horse, 0, 0.3, 0);
  body.scale.set(0.42, 0.16, 0.16);
  const neck = add(group, GEO.box, NEUTRAL.horse, 0.18, 0.42, 0);
  neck.scale.set(0.1, 0.2, 0.1);
  neck.rotation.z = -0.35;
  const head = add(group, GEO.box, NEUTRAL.horse, 0.27, 0.5, 0);
  head.scale.set(0.14, 0.08, 0.09);
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.05, 0.05]) {
      const leg = add(group, GEO.box, NEUTRAL.horse, dx, 0.13, dz);
      leg.scale.set(0.05, 0.19, 0.05);
    }
  }
  const rider = add(group, GEO.body, NEUTRAL.cloth, -0.06, 0.52, 0);
  rider.scale.setScalar(0.7);
  if (isChariot) {
    for (const dz of [-0.12, 0.12]) {
      const wheel = add(group, GEO.wheel, NEUTRAL.wheel, -0.14, 0.11, dz);
      wheel.rotation.x = Math.PI / 2;
    }
  }
  pennant(group, visual, -0.28, 0.34, 0.7);
}

function siege(group, visual, isArmor) {
  if (isArmor) {
    const hull = add(group, GEO.box, NEUTRAL.darkMetal, 0, 0.18, 0);
    hull.scale.set(0.46, 0.16, 0.3);
    const turret = add(group, GEO.box, NEUTRAL.darkMetal, 0, 0.32, 0);
    turret.scale.set(0.2, 0.12, 0.18);
    const barrel = add(group, GEO.spear, NEUTRAL.metal, 0.24, 0.34, 0);
    barrel.rotation.z = Math.PI / 2 - 0.08;
    barrel.scale.setScalar(0.6);
  } else {
    const platform = add(group, GEO.box, NEUTRAL.wood, 0, 0.2, 0);
    platform.scale.set(0.4, 0.1, 0.24);
    for (const dz of [-0.14, 0.14]) {
      const wheel = add(group, GEO.wheel, NEUTRAL.wheel, 0, 0.11, dz);
      wheel.rotation.x = Math.PI / 2;
      wheel.scale.setScalar(1.2);
    }
    const barrel = add(group, GEO.spear, NEUTRAL.metal, 0.1, 0.38, 0);
    barrel.rotation.z = -0.9;
    barrel.scale.set(2.2, 0.6, 2.2);
  }
  pennant(group, visual, -0.26, 0.3, 0.65);
}

function ship(group, visual, kind) {
  const hullMat = kind === 'sail' ? NEUTRAL.wood
    : kind === 'sub' ? NEUTRAL.darkMetal : NEUTRAL.hull;
  const hull = add(group, GEO.box, hullMat, -0.04, 0.14, 0);
  hull.scale.set(0.5, kind === 'sub' ? 0.1 : 0.14, 0.2);
  const bow = add(group, GEO.roof, hullMat, 0.28, 0.14, 0);
  bow.scale.set(0.1, 0.12, 0.1);
  bow.rotation.z = -Math.PI / 2;
  if (kind === 'sail') {
    add(group, GEO.pole, NEUTRAL.wood, -0.04, 0.45, 0);
    const sail = add(group, GEO.flag, NEUTRAL.canvas, -0.04, 0.42, 0.02);
    sail.scale.set(1.3, 2, 1);
  } else if (kind === 'sub') {
    const fin = add(group, GEO.box, NEUTRAL.darkMetal, -0.06, 0.24, 0);
    fin.scale.set(0.12, 0.12, 0.05);
  } else {
    const funnel = add(group, GEO.wheel, NEUTRAL.darkMetal, -0.1, 0.28, 0);
    funnel.scale.set(0.6, 2.4, 0.6);
    const bridge = add(group, GEO.box, NEUTRAL.hull, 0.08, 0.26, 0);
    bridge.scale.set(0.14, 0.1, 0.12);
  }
  pennant(group, visual, -0.28, 0.14, 0.65);
}

function aircraft(group, visual) {
  const fuselage = add(group, GEO.box, NEUTRAL.metal, 0, 0.32, 0);
  fuselage.scale.set(0.42, 0.08, 0.1);
  const wings = add(group, GEO.box, NEUTRAL.metal, 0.04, 0.32, 0);
  wings.scale.set(0.12, 0.02, 0.46);
  const tail = add(group, GEO.box, NEUTRAL.metal, -0.18, 0.38, 0);
  tail.scale.set(0.08, 0.1, 0.02);
}

function fallbackToken(group) {
  add(group, GEO.fallback, NEUTRAL.cloth, 0, 0.32, 0);
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
  else if (unitType === 'armor') siege(group, visual, true);
  else if (SIEGE_TYPES[unitType]) siege(group, visual, false);
  else if (SAIL_TYPES[unitType]) ship(group, visual, 'sail');
  else if (unitType === 'submarine') ship(group, visual, 'sub');
  else if (POWERED_TYPES[unitType]) ship(group, visual, 'powered');
  else if (AIR_TYPES[unitType]) aircraft(group, visual);
  else fallbackToken(group);
  return group;
}

// Deterministic house cluster scaled by population, roofs in the owner's
// color, a banner pole, and a wall ring once City Walls is built.

export function createCityMesh(city, colorOrVisual, isCapital) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const roofMat = matFor(visual.primary);
  const houses = Math.min(2 + city.pop, 12);
  for (let i = 0; i < houses; i++) {
    const angle = (i / houses) * Math.PI * 2 + 0.5;
    const dist = 0.16 + (i % 3) * 0.1;
    const w = 0.14 + (i % 2) * 0.04;
    const h = 0.12 + (i % 4) * 0.03;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const base = add(group, GEO.box, NEUTRAL.house, x, h / 2, z);
    base.scale.set(w, h, w);
    const roof = add(group, GEO.roof, roofMat, x, h + h * 0.3, z);
    roof.scale.set(w * 0.8, h * 0.6, w * 0.8);
    roof.rotation.y = Math.PI / 4;
  }
  if (isCapital && visual.emblem) {
    // the capital flies the full CanvasTexture emblem flag (art A1.6a)
    add(group, GEO.pole, NEUTRAL.stone, 0, 0.42, 0);
    add(group, GEO.cityFlag, flagTexMatFor(visual), 0.16, 0.62, 0);
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
