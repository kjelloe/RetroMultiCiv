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
  roof: new THREE.ConeGeometry(1, 1, 4)
};

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

function mounted(group, color, isChariot) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
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
}

function siege(group, color, isArmor) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
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
}

function ship(group, color, kind) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.02, 0);
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
  const flag = add(group, GEO.flag, flagMatFor(color), -0.28, 0.3, 0);
  flag.scale.setScalar(0.6);
}

function aircraft(group, color) {
  add(group, GEO.baseDisc, matFor(color), 0, 0.035, 0);
  const fuselage = add(group, GEO.box, NEUTRAL.metal, 0, 0.32, 0);
  fuselage.scale.set(0.42, 0.08, 0.1);
  const wings = add(group, GEO.box, NEUTRAL.metal, 0.04, 0.32, 0);
  wings.scale.set(0.12, 0.02, 0.46);
  const tail = add(group, GEO.box, NEUTRAL.metal, -0.18, 0.38, 0);
  tail.scale.set(0.08, 0.1, 0.02);
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
  else if (MOUNTED_TYPES[unitType]) mounted(group, color, unitType === 'chariot');
  else if (unitType === 'armor') siege(group, color, true);
  else if (SIEGE_TYPES[unitType]) siege(group, color, false);
  else if (SAIL_TYPES[unitType]) ship(group, color, 'sail');
  else if (unitType === 'submarine') ship(group, color, 'sub');
  else if (POWERED_TYPES[unitType]) ship(group, color, 'powered');
  else if (AIR_TYPES[unitType]) aircraft(group, color);
  else fallbackToken(group, color);
  return group;
}

// Deterministic house cluster scaled by population, roofs in the owner's
// color, a banner pole, and a wall ring once City Walls is built.
// --- tile props: improvements, trees, special resources (instanced) ------------
const PROP_GEO = {
  strip: new THREE.BoxGeometry(0.72, 0.02, 0.14),   // irrigation channel / road
  mine: new THREE.ConeGeometry(0.13, 0.2, 4),
  tree: new THREE.ConeGeometry(0.11, 0.28, 6),
  special: new THREE.SphereGeometry(0.07, 8, 6)
};
const PROP_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff }); // × instance color
const PROP_COLOR = {
  irrigation: 0x5db8e8, road: 0x8a6f4d, mine: 0x8a8494,
  forest: 0x1e6b2f, jungle: 0x2f8d3f, special: 0xffd75e
};
const PROP_FOG = new THREE.Color(0x0a0e16);

// One InstancedMesh per prop geometry, colored per instance (fog-dimmed when
// the tile is explored but not visible). Rebuilt wholesale with the tiles;
// geometries/material are shared, so only the instance buffers need disposal.
export function createTileProps(map, tileTop) {
  const items = { strip: [], mine: [], tree: [], special: [] };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x];
      if (t.t === 'unknown') continue;
      const dim = t.visible === false;
      const top = tileTop(x, y);
      if (t.irrigation) items.strip.push({ x, y, top, dim, color: PROP_COLOR.irrigation, rotY: Math.PI / 4, dy: 0.02 });
      if (t.road) {
        items.strip.push({ x, y, top, dim, color: PROP_COLOR.road, rotY: 0, dy: 0.03 });
        items.strip.push({ x, y, top, dim, color: PROP_COLOR.road, rotY: Math.PI / 2, dy: 0.03 });
      }
      if (t.mine) items.mine.push({ x, y, top, dim, color: PROP_COLOR.mine, dx: 0.18, dz: -0.16, dy: 0.1 });
      if (t.t === 'forest' || t.t === 'jungle') {
        const color = PROP_COLOR[t.t];
        items.tree.push({ x, y, top, dim, color, dx: -0.18, dz: -0.12, dy: 0.14 });
        items.tree.push({ x, y, top, dim, color, dx: 0.15, dz: 0.16, dy: 0.14 });
      }
      if (t.special) items.special.push({ x, y, top, dim, color: PROP_COLOR.special, dx: -0.2, dz: 0.2, dy: 0.08 });
    }
  }
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const meshes = [];
  for (const kind of Object.keys(items)) {
    const list = items[kind];
    if (list.length === 0) continue;
    const mesh = new THREE.InstancedMesh(PROP_GEO[kind], PROP_MAT, list.length);
    list.forEach((it, i) => {
      dummy.position.set(it.x + (it.dx || 0), it.top + (it.dy || 0), it.y + (it.dz || 0));
      dummy.rotation.set(0, it.rotY || 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      c.setHex(it.color);
      if (it.dim) c.lerp(PROP_FOG, 0.45);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshes.push(mesh);
  }
  return meshes;
}

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
