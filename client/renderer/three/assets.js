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
export function createUnitMesh(unitType, colorOrVisual, status) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const recipe = UNIT_SILHOUETTE[unitType] || 'fallback';
  const chrome = RECIPE_CHROME[recipe] || {};
  baseToken(group, visual, status, chrome.naval ? 0.02 : 0.035);
  if (chrome.plain) { composeRecipe(group, UNIT_RECIPES.fallback); return group; } // all-neutral, no visual/pennant
  composeRecipe(group, UNIT_RECIPES[recipe], visual);
  if (TYPE_EXTRA[unitType]) composeRecipe(group, UNIT_RECIPES[TYPE_EXTRA[unitType]], visual); // chariot wheels
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

export function createCityMesh(city, colorOrVisual, isCapital) {
  const group = new THREE.Group();
  const visual = resolveVisual(colorOrVisual);
  const tier = cityTierFor(city.pop);
  const tierIndex = CITY_TIERS.indexOf(tier);
  // ERA band (render-only hint from the annotated view; ancient for mock/gallery)
  const style = CITY_ERA_STYLES[city.eraBand] || CITY_ERA_STYLES.ancient;
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
    const roof = add(group, roofGeo, roofMat, x, 0, z);
    if (peaked) {
      roof.position.y = h + h * 0.32; roof.scale.set(w * 0.82, h * 0.7, w * 0.82);
      roof.rotation.y = Math.PI / 4;
    } else { // flat / slab industrial+modern rooflines sit low on the body
      roof.position.y = h + h * 0.08; roof.scale.set(w * 0.98, h * 0.2, w * 0.98);
    }
  }
  // the band's signature central structure (tower / smokestacks / dome+spire /
  // capital hall), gated by tier + capital
  addEraSignature(group, style, tier, tierIndex, isCapital);
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
    const wall = add(group, GEO.wallRing, NEUTRAL.stone, 0, 0.06, 0);
    wall.rotation.x = Math.PI / 2;
  }
  return group;
}
