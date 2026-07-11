// AssetFactory (art track A0/A1, specs/plan-assets.md): all unit/city mesh
// construction lives here — the renderer maps state to visuals, this module
// decides how they look. Ownership reads as a colored base disc + banner on
// a mostly neutral body (not a whole-mesh recolor). Materials are Lambert
// (cheap on SwiftShader/WebGL1 — the r162 constraint applies to art too) and
// cached per color; geometries are shared module constants, so removing a
// group from the scene needs no disposal.
import * as THREE from 'three';

// --- shared materials ---------------------------------------------------------
const NEUTRAL = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  wheel: new THREE.MeshLambertMaterial({ color: 0x4a3319 }),
  canvas: new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  cloth: new THREE.MeshLambertMaterial({ color: 0x8b93a5 }),
  skin: new THREE.MeshLambertMaterial({ color: 0xd7a27d }),
  metal: new THREE.MeshLambertMaterial({ color: 0xb8b8b8 }),
  stone: new THREE.MeshLambertMaterial({ color: 0xc2ab82 }),
  house: new THREE.MeshLambertMaterial({ color: 0xe1d0ad })
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
  roof: new THREE.ConeGeometry(1, 1, 4)
};

function add(group, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

// silhouette classes for the 28 Civ 1 unit types (unbuilt classes fall back)
const WAGON_TYPES = { settlers: true, caravan: true, diplomat: true };
const FOOT_TYPES = {
  militia: true, phalanx: true, legion: true,
  musketeers: true, riflemen: true, 'mech-inf': true
};

function footSoldier(group, color) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
  add(group, GEO.body, NEUTRAL.cloth, 0, 0.28, 0);
  add(group, GEO.head, NEUTRAL.skin, 0, 0.56, 0);
  const spear = add(group, GEO.spear, NEUTRAL.wood, 0.15, 0.42, 0);
  spear.rotation.z = -0.12;
  const tip = add(group, GEO.spearTip, NEUTRAL.metal, 0.19, 0.8, 0);
  tip.rotation.z = -0.12;
}

function wagon(group, color) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
  add(group, GEO.wagonBody, NEUTRAL.wood, 0, 0.22, 0);
  const top = add(group, GEO.wagonTop, NEUTRAL.canvas, 0, 0.34, 0);
  top.rotation.z = Math.PI / 2; // canvas roof lies along the wagon
  for (const dx of [-0.17, 0.17]) {
    for (const dz of [-0.16, 0.16]) {
      const wheel = add(group, GEO.wheel, NEUTRAL.wheel, dx, 0.09, dz);
      wheel.rotation.x = Math.PI / 2;
    }
  }
}

function fallbackToken(group, color) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
  add(group, GEO.fallback, NEUTRAL.cloth, 0, 0.32, 0);
}

// Returns a group with its base at y = 0 (place it on the tile top).
export function createUnitMesh(unitType, color) {
  const group = new THREE.Group();
  if (WAGON_TYPES[unitType]) wagon(group, color);
  else if (FOOT_TYPES[unitType]) footSoldier(group, color);
  else fallbackToken(group, color);
  return group;
}

// Deterministic house cluster scaled by population, roofs in the owner's
// color, a banner pole, and a wall ring once City Walls is built.
export function createCityMesh(city, color) {
  const group = new THREE.Group();
  const roofMat = matFor(color);
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
  add(group, GEO.pole, NEUTRAL.stone, 0, 0.35, 0);
  add(group, GEO.flag, flagMatFor(color), 0.11, 0.6, 0);
  if ((city.buildings || []).indexOf('city-walls') !== -1) {
    const wall = add(group, GEO.wallRing, NEUTRAL.stone, 0, 0.06, 0);
    wall.rotation.x = Math.PI / 2;
  }
  return group;
}
