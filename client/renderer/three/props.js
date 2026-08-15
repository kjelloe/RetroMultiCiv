// Tile props (art A1.5/A1.6b — split from assets.js per the A15 pre-step):
// terrain features, improvements, and resources as InstancedMeshes, plus the
// deterministic visualRand every decoration derives from. One seam = one
// module, mirroring factions.js; assets.js keeps unit/city construction only.
import * as THREE from 'three';
import { PROP_SHAPES } from './recipes.js';
import { DETAIL_STYLE } from './terrain-detail.js';

// --- deterministic visual randomness (terrain art A1.5) -------------------------
// Decoration must be identical across refreshes, saves, and clients, and
// never touch canonical state — so it derives from tile coordinates alone.
export function visualRand(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + (salt + 1) * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- tile props: terrain features, improvements, resources (instanced) ---------
// A88: geometries built from the shared PROP_SHAPES recipe table (data), so the
// Roblox composer (R8) builds the same shapes; placement below stays procedural.
function propGeometry(p) {
  if (p.shape === 'box') return new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
  if (p.shape === 'cone') return new THREE.ConeGeometry(p.size[0], p.size[1], p.seg);
  if (p.shape === 'cyl') return new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], p.seg); // N13 hut wall
  if (p.shape === 'sphere') return new THREE.SphereGeometry(p.size[0], p.seg[0], p.seg[1]);
  if (p.shape === 'dodeca') return new THREE.DodecahedronGeometry(p.size[0], p.seg);
  if (p.shape === 'torus') return new THREE.TorusGeometry(p.size[0], p.size[1], p.seg[0], p.seg[1]);
  return null;
}
const PROP_GEO = {};
for (const kind of Object.keys(PROP_SHAPES)) PROP_GEO[kind] = propGeometry(PROP_SHAPES[kind]);
const PROP_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff }); // × instance color
const PROP_COLOR = {
  irrigation: 0x5db8e8, road: 0x8a6f4d, railroad: 0x3c3c46, mine: 0x8a8494,
  forest: 0x1e6b2f, jungle: 0x2f8d3f, special: 0xffd75e, fortress: 0xb8ab8e,
  jungleTrunk: 0x6a5236, jungleButtress: 0x5c472f, jungleCanopy: 0x2f8d3f, // XV §5
  rock: 0x7d7468, peak: 0x63636d, snow: 0xe8eef0,
  grassTuft: 0x3f8f3f, dryScrub: 0x9d8f55, tundraScrub: 0x9fae9d,
  tie: 0x2c2620, mineDoor: 0x17130e, mineBeam: 0x6b4a2a,
  fieldPatch: 0x59a03e, foam: 0xdcecf2, pond: 0x3a6b58,
  hutWall: 0xb08d5a, hutRoof: 0xc9a94c // N13: mud wall + thatch
};
// the translucent water plane's height (terrain.js buildWater) — foam strips
// ride just above it; ocean floor is at -0.18, lowest land at +0.02
export const WATER_LEVEL = -0.02;
const PROP_FOG = new THREE.Color(0x0a0e16);
const SCRUB_COLOR = { grassland: 0x3f8f3f, plains: 0x9d8f55, desert: 0x9d8f55, tundra: 0x9fae9d };
// specials-icons: the Civ-1 terrain-keyed special resource → its MAP MOTIF (a
// list of prop primitives with per-instance color/scale/offset). Render-only;
// the resource is DERIVED from the tile's terrain (each terrain has exactly one
// special — data/terrain.json). ocean rides the water surface (see the handler).
const SPECIAL_MOTIF = {
  ocean:     [ // Fish — H1 side profile (user pick 2026-08-13 of 3): body + FORKED tail + dorsal fin + eye dot
              { k: 'resFish', color: 0xd2e6f5, sx: 1.5, sy: 0.75, sz: 0.45, dy: 0.06 },
              { k: 'resFishTail', color: 0xbcd2e4, dx: 0.15, dy: 0.1, rotZ: -0.9, sx: 0.9, sy: 0.85 },
              { k: 'resFishTail', color: 0xbcd2e4, dx: 0.15, dy: 0.015, rotZ: -2.2, sx: 0.9, sy: 0.85 },
              { k: 'resFishTail', color: 0xbcd2e4, dx: -0.01, dy: 0.13, rotZ: -0.35, sx: 0.8, sy: 0.9 },
              { k: 'resEar', color: 0x2b3a4a, dx: -0.1, dy: 0.075, dz: 0.042, rotX: 1.5707963267948966, sx: 1.4, sy: 0.4, sz: 1.4 }],
  grassland: [                                                                                 // Shield → wheat sheaf (XVII #8/#14): a bright cluster of golden stalks
              { k: 'resStraw', color: 0xf2d84e, dy: 0.2 },
              { k: 'resStraw', color: 0xf6e264, dx: 0.11, dz: 0.03, dy: 0.19, rotX: 0.3, rotY: 0.4 },
              { k: 'resStraw', color: 0xe8c840, dx: -0.09, dz: 0.09, dy: 0.19, rotX: 0.3, rotY: 2.1 },
              { k: 'resStraw', color: 0xfced7a, dx: 0.05, dz: -0.11, dy: 0.19, rotX: 0.3, rotY: 3.7 },
              { k: 'resStraw', color: 0xe2be3a, dx: -0.08, dz: -0.06, dy: 0.19, rotX: 0.3, rotY: 5.1 },
              { k: 'resStraw', color: 0xf2d84e, dx: 0.08, dz: -0.04, dy: 0.19, rotX: 0.26, rotY: 1.2 },
              { k: 'resStraw', color: 0xf6e264, dx: -0.02, dz: 0.1, dy: 0.19, rotX: 0.26, rotY: 4.4 }],
  plains:    [ // Horse — G0 standing profile (user pick 2026-08-05, specs/graphics-levels.md):
              // barrel body on four legs, arched neck, muzzle, pricked ears, swept tail
              { k: 'resBeast', color: 0x9a6b3f, sx: 1.5, sy: 0.75, sz: 0.65, dy: 0.24 },
              { k: 'resLeg', color: 0x8a5f36, dx: -0.10, dz: -0.045, dy: 0.085 },
              { k: 'resLeg', color: 0x8a5f36, dx: -0.10, dz: 0.045, dy: 0.085 },
              { k: 'resLeg', color: 0x8a5f36, dx: 0.10, dz: -0.045, dy: 0.085 },
              { k: 'resLeg', color: 0x8a5f36, dx: 0.10, dz: 0.045, dy: 0.085 },
              { k: 'resNeck', color: 0x9a6b3f, dx: -0.13, dy: 0.33, rotZ: 0.55 },
              { k: 'resBeastHead', color: 0x9a6b3f, dx: -0.185, dy: 0.42, sy: 0.9 },
              { k: 'resMuzzle', color: 0x9a6b3f, dx: -0.245, dy: 0.405 },
              { k: 'resEar', color: 0x5d3f22, dx: -0.165, dz: -0.025, dy: 0.475 },
              { k: 'resEar', color: 0x5d3f22, dx: -0.165, dz: 0.025, dy: 0.475 },
              { k: 'resTail', color: 0x5d3f22, dx: 0.175, dy: 0.24, rotZ: 2.6 }],
  forest:    [ // Game (deer) — H1 standing-alert (user pick 2026-08-13 of 3): slim body on legs, neck UP, antler V high
              { k: 'resBeast', color: 0x7a5a35, sx: 1.15, sy: 0.62, sz: 0.5, dy: 0.22 },
              { k: 'resLeg', color: 0x6b4d2c, dx: -0.08, dz: -0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x6b4d2c, dx: -0.08, dz: 0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x6b4d2c, dx: 0.08, dz: -0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x6b4d2c, dx: 0.08, dz: 0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resNeck', color: 0x7a5a35, dx: -0.1, dy: 0.31, rotZ: 0.28, sx: 0.75, sz: 0.75 },
              { k: 'resBeastHead', color: 0x7a5a35, dx: -0.13, dy: 0.41, sy: 0.85 },
              { k: 'resMuzzle', color: 0x7a5a35, dx: -0.18, dy: 0.4, sx: 0.7, sy: 0.8, sz: 0.8 },
              { k: 'resAntler', color: 0x533c22, dx: -0.15, dy: 0.5, rotZ: 0.62 },
              { k: 'resAntler', color: 0x533c22, dx: -0.1, dy: 0.5, rotZ: -0.62 },
              { k: 'resTail', color: 0xe8e0cc, dx: 0.12, dy: 0.24, rotZ: 2.4, sx: 0.5, sy: 0.4 }],
  tundra:    [ // Game (deer) — the H1 V1 standing-alert pose in tundra colors (user pick 2026-08-13)
              { k: 'resBeast', color: 0x8a6a45, sx: 1.15, sy: 0.62, sz: 0.5, dy: 0.22 },
              { k: 'resLeg', color: 0x5f4728, dx: -0.08, dz: -0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x5f4728, dx: -0.08, dz: 0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x5f4728, dx: 0.08, dz: -0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resLeg', color: 0x5f4728, dx: 0.08, dz: 0.035, dy: 0.075, sx: 0.8, sz: 0.8 },
              { k: 'resNeck', color: 0x8a6a45, dx: -0.1, dy: 0.31, rotZ: 0.28, sx: 0.75, sz: 0.75 },
              { k: 'resBeastHead', color: 0x8a6a45, dx: -0.13, dy: 0.41, sy: 0.85 },
              { k: 'resMuzzle', color: 0x8a6a45, dx: -0.18, dy: 0.4, sx: 0.7, sy: 0.8, sz: 0.8 },
              { k: 'resAntler', color: 0x5f4728, dx: -0.15, dy: 0.5, rotZ: 0.62 },
              { k: 'resAntler', color: 0x5f4728, dx: -0.1, dy: 0.5, rotZ: -0.62 },
              { k: 'resTail', color: 0xe8e0cc, dx: 0.12, dy: 0.24, rotZ: 2.4, sx: 0.5, sy: 0.4 }],
  arctic:    [ // Seal — H1 basking (user pick 2026-08-13 of 3): tapered body, CHEST RAISED on fore-flippers, head up, tail flipper
              { k: 'resBeast', color: 0xc4cbd4, sx: 1.6, sy: 0.6, sz: 0.7, dy: 0.12, rotZ: -0.22 },
              { k: 'resBeastHead', color: 0xc4cbd4, dx: -0.2, dy: 0.26, sy: 0.9 },
              { k: 'resMuzzle', color: 0xb4bcc6, dx: -0.26, dy: 0.24, sx: 0.6, sy: 0.6, sz: 0.7 },
              { k: 'resLeg', color: 0xb4bcc6, dx: -0.12, dz: -0.06, dy: 0.05, rotZ: 0.5, sx: 1.2, sy: 0.45, sz: 0.6 },
              { k: 'resLeg', color: 0xb4bcc6, dx: -0.12, dz: 0.06, dy: 0.05, rotZ: -0.5, sx: 1.2, sy: 0.45, sz: 0.6 },
              { k: 'resFishTail', color: 0xb4bcc6, dx: 0.18, dy: 0.08, rotZ: -0.95, sx: 1.1, sy: 1.3 }],
  desert:    [{ k: 'resWater', color: 0x2f7fc0, dy: 0.02, sx: 1.3, sz: 1.3 },                    // Oasis: the pool
              { k: 'jungleTrunk', color: 0x8a6a3d, dy: 0.18, sx: 1.05, sy: 0.8, sz: 1.05 },         // brown palm trunk (jungleTrunk reused, scaled down)
              // frond crown: blades PLANTED around a small ring at the trunk top, each
              // leaning outward (dx/dz ring gives the azimuthal spread — the proven wheat-
              // sheaf idiom; rotY alone gimbal-collapses at this tilt). A palm spray, never
              // a fir cone.
              { k: 'resPalm', color: 0x3fae4f, dx: 0.07,  dz: 0.0,   dy: 0.33, rotX: 0.86, rotY: 0.0,  sz: 0.55 },
              { k: 'resPalm', color: 0x4cbf5c, dx: 0.035, dz: 0.061, dy: 0.33, rotX: 0.86, rotY: 1.05, sz: 0.55 },
              { k: 'resPalm', color: 0x3fae4f, dx: -0.035, dz: 0.061, dy: 0.33, rotX: 0.86, rotY: 2.09, sz: 0.55 },
              { k: 'resPalm', color: 0x4cbf5c, dx: -0.07, dz: 0.0,   dy: 0.33, rotX: 0.86, rotY: 3.14, sz: 0.55 },
              { k: 'resPalm', color: 0x3fae4f, dx: -0.035, dz: -0.061, dy: 0.33, rotX: 0.86, rotY: 4.19, sz: 0.55 },
              { k: 'resPalm', color: 0x4cbf5c, dx: 0.035, dz: -0.061, dy: 0.33, rotX: 0.86, rotY: 5.24, sz: 0.55 }],
  hills:     [{ k: 'resCrystal', color: 0x2b2b30, dy: 0.11, sx: 1.3, sy: 1.3, sz: 1.3 }],         // Coal
  mountains: [{ k: 'resCrystal', color: 0xffd23b, dy: 0.24, sx: 1.9, sy: 1.9, sz: 1.9 }],         // Gold (XVII #14: bright, raised above the peak, enlarged)
  jungle:    [{ k: 'resCrystal', color: 0x5ad0c9, dy: 0.14, sx: 1.4, sy: 1.4, sz: 1.4 }],         // Gem (XVII #14: raised above the lowered canopy, enlarged)
  swamp:     [{ k: 'resDerrick', color: 0x2a2622, dy: 0.17 }]                                    // Oil
};
// H6 (spec §4b): HIGH-tier animal motifs — high-segment anatomy with jointed
// legs, full antler racks, fins. Selected over SPECIAL_MOTIF at level 'high';
// terrains absent here (wheat/oasis/crystals/oil) keep the shared motif.
// Poses preserve the user-picked H1 attitudes (standing deer, basking seal,
// side-profile fish, standing horse) — this tier is MORE VERTICES, not a
// different animal.
const leg4 = (color, hoofColor, xF, xB, zz, yU, yL) => {
  const out = [];
  for (const [lx, lz] of [[xF, -zz], [xF, zz], [xB, -zz], [xB, zz]]) {
    out.push({ k: 'hiLegU', color, dx: lx, dz: lz, dy: yU });
    out.push({ k: 'hiLegL', color, dx: lx, dz: lz, dy: yL });
    out.push({ k: 'hiHoof', color: hoofColor, dx: lx, dz: lz, dy: 0.012 });
  }
  return out;
};
const antlers = (color, dx, dy) => [
  { k: 'hiBeam', color, dx, dz: -0.028, dy, rotZ: 0.55, rotX: -0.25 },
  { k: 'hiBeam', color, dx, dz: 0.028, dy, rotZ: 0.55, rotX: 0.25 },
  { k: 'hiTine', color, dx: dx - 0.015, dz: -0.045, dy: dy + 0.055, rotZ: 0.2, rotX: -0.4 },
  { k: 'hiTine', color, dx: dx - 0.015, dz: 0.045, dy: dy + 0.055, rotZ: 0.2, rotX: 0.4 },
  { k: 'hiTine', color, dx: dx + 0.02, dz: -0.05, dy: dy + 0.04, rotZ: 0.9, rotX: -0.3 },
  { k: 'hiTine', color, dx: dx + 0.02, dz: 0.05, dy: dy + 0.04, rotZ: 0.9, rotX: 0.3 }
];
const SPECIAL_MOTIF_HIGH = {
  forest: [ // deer, standing-alert — the H1 pose with real anatomy
    { k: 'hiBody', color: 0x7a5a35, sx: 1.45, sy: 0.72, sz: 0.55, dy: 0.235 },
    { k: 'hiBody', color: 0x7a5a35, sx: 0.7, sy: 0.55, sz: 0.5, dx: -0.1, dy: 0.26 },      // chest
    { k: 'hiLegU', color: 0x7a5a35, dx: -0.11, dy: 0.3, rotZ: 0.5, sx: 1.3, sy: 1.4, sz: 1.3 }, // neck
    { k: 'hiHead', color: 0x7a5a35, dx: -0.15, dy: 0.415 },
    { k: 'hiMuzzle', color: 0x6b4d2c, dx: -0.2, dy: 0.4, sx: 1.2, sy: 0.85, sz: 0.85 },
    { k: 'hiEar', color: 0x6b4d2c, dx: -0.13, dz: -0.035, dy: 0.47, rotX: -0.5 },
    { k: 'hiEar', color: 0x6b4d2c, dx: -0.13, dz: 0.035, dy: 0.47, rotX: 0.5 }
  ].concat(antlers(0x533c22, -0.14, 0.5)).concat(leg4(0x6b4d2c, 0x3a2c18, -0.085, 0.085, 0.038, 0.14, 0.06)).concat([
    { k: 'resTail', color: 0xe8e0cc, dx: 0.13, dy: 0.25, rotZ: 2.4, sx: 0.5, sy: 0.4 }
  ]),
  tundra: [ // the same deer in tundra colors
    { k: 'hiBody', color: 0x8a6a45, sx: 1.45, sy: 0.72, sz: 0.55, dy: 0.235 },
    { k: 'hiBody', color: 0x8a6a45, sx: 0.7, sy: 0.55, sz: 0.5, dx: -0.1, dy: 0.26 },
    { k: 'hiLegU', color: 0x8a6a45, dx: -0.11, dy: 0.3, rotZ: 0.5, sx: 1.3, sy: 1.4, sz: 1.3 },
    { k: 'hiHead', color: 0x8a6a45, dx: -0.15, dy: 0.415 },
    { k: 'hiMuzzle', color: 0x745738, dx: -0.2, dy: 0.4, sx: 1.2, sy: 0.85, sz: 0.85 },
    { k: 'hiEar', color: 0x745738, dx: -0.13, dz: -0.035, dy: 0.47, rotX: -0.5 },
    { k: 'hiEar', color: 0x745738, dx: 0.13 - 0.26, dz: 0.035, dy: 0.47, rotX: 0.5 }
  ].concat(antlers(0x5f4728, -0.14, 0.5)).concat(leg4(0x745738, 0x40301c, -0.085, 0.085, 0.038, 0.14, 0.06)).concat([
    { k: 'resTail', color: 0xe8e0cc, dx: 0.13, dy: 0.25, rotZ: 2.4, sx: 0.5, sy: 0.4 }
  ]),
  plains: [ // horse, standing — the G0 pose with real anatomy + mane
    { k: 'hiBody', color: 0x9a6b3f, sx: 1.6, sy: 0.82, sz: 0.66, dy: 0.26 },
    { k: 'hiLegU', color: 0x9a6b3f, dx: -0.13, dy: 0.33, rotZ: 0.55, sx: 1.7, sy: 1.6, sz: 1.7 }, // neck
    { k: 'hiHead', color: 0x9a6b3f, dx: -0.185, dy: 0.46, sy: 0.9 },
    { k: 'hiMuzzle', color: 0x8a5f36, dx: -0.245, dy: 0.44, sx: 1.4, sy: 0.9, sz: 0.9 },
    { k: 'hiEar', color: 0x5d3f22, dx: -0.16, dz: -0.03, dy: 0.52, rotX: -0.4 },
    { k: 'hiEar', color: 0x5d3f22, dx: -0.16, dz: 0.03, dy: 0.52, rotX: 0.4 },
    { k: 'roadDash', color: 0x5d3f22, dx: -0.1, dy: 0.42, rotZ: -0.9, sx: 1.3, sy: 3.2, sz: 1.6 } // mane ridge
  ].concat(leg4(0x8a5f36, 0x3a2c18, -0.1, 0.1, 0.045, 0.15, 0.065)).concat([
    { k: 'resTail', color: 0x5d3f22, dx: 0.17, dy: 0.27, rotZ: 2.6 }
  ]),
  arctic: [ // seal, basking — smooth high-seg body, real flippers
    { k: 'hiBody', color: 0xc4cbd4, sx: 1.75, sy: 0.62, sz: 0.72, dy: 0.11, rotZ: -0.18 },
    { k: 'hiBody', color: 0xc4cbd4, sx: 0.62, sy: 0.55, sz: 0.55, dx: -0.17, dy: 0.22 },   // raised chest
    { k: 'hiHead', color: 0xc4cbd4, dx: -0.21, dy: 0.3 },
    { k: 'hiMuzzle', color: 0xb4bcc6, dx: -0.26, dy: 0.28, sy: 0.8 },
    { k: 'hiFin', color: 0xb4bcc6, dx: -0.12, dz: -0.075, dy: 0.045, rotZ: 2.2, rotX: -0.5, sy: 0.55 },
    { k: 'hiFin', color: 0xb4bcc6, dx: -0.12, dz: 0.075, dy: 0.045, rotZ: 2.2, rotX: 0.5, sy: 0.55 },
    { k: 'hiFin', color: 0xb4bcc6, dx: 0.2, dy: 0.09, rotZ: -1.1, sx: 1.2, sy: 0.5, sz: 1.4 }
  ],
  ocean: [ // fish, side profile — high-seg body, full fin set, eye
    { k: 'hiBody', color: 0xd2e6f5, sx: 1.45, sy: 0.85, sz: 0.42, dy: 0.07 },
    { k: 'hiFin', color: 0xbcd2e4, dx: 0.16, dy: 0.1, rotZ: -0.85, sy: 0.85, sz: 0.4 },
    { k: 'hiFin', color: 0xbcd2e4, dx: 0.16, dy: 0.025, rotZ: -2.25, sy: 0.85, sz: 0.4 },
    { k: 'hiFin', color: 0xbcd2e4, dx: -0.01, dy: 0.15, rotZ: -0.35, sy: 0.75, sz: 0.35 },
    { k: 'hiFin', color: 0xbcd2e4, dx: 0.02, dz: 0.045, dy: 0.045, rotZ: -2.6, sy: 0.5, sz: 0.3 }, // pectoral
    { k: 'hiHead', color: 0x2b3a4a, dx: -0.1, dz: 0.042, dy: 0.085, sx: 0.28, sy: 0.28, sz: 0.28 } // eye
  ]
};
// eight neighbor directions for road connectivity (rotY aligns the segment)
const ROAD_DIRS = [
  { dx: 1, dy: 0, rot: 0, diag: false }, { dx: -1, dy: 0, rot: 0, diag: false },
  { dx: 0, dy: 1, rot: Math.PI / 2, diag: false }, { dx: 0, dy: -1, rot: Math.PI / 2, diag: false },
  { dx: 1, dy: 1, rot: -Math.PI / 4, diag: true }, { dx: -1, dy: -1, rot: -Math.PI / 4, diag: true },
  { dx: 1, dy: -1, rot: Math.PI / 4, diag: true }, { dx: -1, dy: 1, rot: Math.PI / 4, diag: true }
];

// One InstancedMesh per prop geometry, colored per instance (fog-dimmed when
// the tile is explored but not visible). Rebuilt wholesale with the tiles;
// geometries/material are shared, so only the instance buffers need disposal.
// `joins` marks tile indices that roads visually connect to (own cities).
// level (G2, specs/graphics-levels.md): 'low' keeps the shipped sparse scrub;
// medium+ densifies the ground scatter (more tufts, pebbles, swamp reeds) so
// open terrain reads as a surface rather than a board. Scatter placement is
// pure visualRand(x, y, salt) — same field on every client at the same level.
const SCATTER_PEBBLE = { desert: 0xb5924d, hills: 0x8a7f66, tundra: 0x8f968c, arctic: 0xd8e2e6 };

export function createTileProps(map, tileTop, joins, reveal, level = 'low', surfaceAt, roadStage = 3) { // reveal (#34 S2): un-dim explored tiles
  // H1 re-tier: medium and high share the G3 scatter density (the user judged
  // the G3 look a MEDIUM); H2 differentiates high again with the smooth pass
  const scatter = (level === 'medium' || level === 'high') ? DETAIL_STYLE.scatterBoost * 1.7 : 0;
  // G4 polish: at medium/high, off-center props sample the REAL surface at
  // their offset (terrain.js surfaceAt over the mesh's own height grid) — road
  // segments and scatter stop floating over the denser relief. Low keeps the
  // tile-center height exactly (byte-identity).
  const ground = (x, y, dx, dz, center) =>
    (surfaceAt !== undefined && level !== 'low') ? surfaceAt(x + dx, y + dz) : center;
  // Long rigid strips (roads, irrigation channels) additionally TILT to their
  // endpoint heights — a flat box anchored at its midpoint still bridges dips
  // on the denser relief. Euler XYZ applies the Z pitch BEFORE the Y yaw, so
  // rotZ pitches the box along its own length. Returns { top, rotZ }.
  const laid = (cx, cz, rotY, halfLen, center) => {
    if (surfaceAt === undefined || level === 'low') return { top: center, rotZ: 0 };
    const ex = Math.cos(rotY) * halfLen, ez = -Math.sin(rotY) * halfLen;
    const hPlus = surfaceAt(cx + ex, cz + ez), hMinus = surfaceAt(cx - ex, cz - ez);
    return { top: (hPlus + hMinus) / 2, rotZ: Math.atan2(hPlus - hMinus, halfLen * 2) };
  };
  const items = {
    strip: [], roadSeg: [], mine: [], tree: [], scrub: [],
    jungleTrunk: [], jungleCanopy: [], jungleButtress: [], // XV §5
    rock: [], peak: [], snow: [], special: [], fortress: [],
    tie: [], mineDoor: [], mineBeam: [], fieldPatch: [], foam: [],
    hutBase: [], hutRoof: [], // N13: goody-hut villages
    treeTrunk: [], treeCanopy: [], roadDash: [], // H2: high tree kit + centerlines
    hiBody: [], hiHead: [], hiMuzzle: [], hiLegU: [], hiLegL: [], hiHoof: [],
    hiEar: [], hiBeam: [], hiTine: [], hiFin: [], hiHorn: [], // H6: high animal kit
    // specials-icons: per-resource motif primitives
    resFish: [], resFishTail: [], resCrystal: [], resWater: [], resPalm: [],
    resDerrick: [], resStraw: [], resBeast: [], resBeastHead: [], resAntler: [],
    resLeg: [], resNeck: [], resMuzzle: [], resTail: [], resEar: [], pond: []
  };
  const roadAt = (x, y) => {
    if (y < 0 || y >= map.height) return false;
    let xx = x;
    if (xx < 0 || xx >= map.width) {
      if (!map.wrapX) return false;
      xx = ((xx % map.width) + map.width) % map.width;
    }
    const n = map.tiles[y * map.width + xx];
    return n.road === true || n.railroad === true || joins[y * map.width + xx] === true;
  };
  const landAt = (x, y) => {
    if (y < 0 || y >= map.height) return false;
    let xx = x;
    if (xx < 0 || xx >= map.width) {
      if (!map.wrapX) return false;
      xx = ((xx % map.width) + map.width) % map.width;
    }
    const n = map.tiles[y * map.width + xx];
    return n.t !== 'ocean' && n.t !== 'unknown';
  };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x];
      if (t.t === 'unknown') continue;
      const dim = t.visible === false && reveal !== true; // #34: end-reveal un-dims explored tiles
      const top = tileTop(x, y);
      if (t.irrigation) {
        // thin channel + two cultivated field patches (art A1.6b)
        const ch = laid(x, y, Math.PI / 4, 0.36, top);
        items.strip.push({ x, y, top: ch.top, dim, color: PROP_COLOR.irrigation, rotY: Math.PI / 4, rotZ: ch.rotZ, dy: 0.02 });
        items.fieldPatch.push({ x, y, top: ground(x, y, -0.2, 0.14, top), dim, color: PROP_COLOR.fieldPatch, dx: -0.2, dz: 0.14, dy: 0.015, rotY: Math.PI / 4 });
        items.fieldPatch.push({ x, y, top: ground(x, y, 0.16, -0.2, top), dim, color: PROP_COLOR.fieldPatch, dx: 0.16, dz: -0.2, dy: 0.015, rotY: Math.PI / 4 });
      }
      if (t.road || t.railroad) {
        // H13 (user 2026-08-15): at medium/high, roads restyle with the
        // VIEWER's era — 0 dirt path / 1 cobblestone / 2 slim unmarked /
        // 3 marked (the classic look) / 4 four-lane highway — and rails are
        // twin steel lines, double-tracked from stage 3. LOW keeps the exact
        // classic segments (byte-frozen contract).
        const staged = level === 'medium' || level === 'high';
        const RS = [
          { color: 0x7a5c38, w: 0.55, len: 0.85, dash: false }, // dirt path
          { color: 0x8a8578, w: 0.8, len: 1, dash: false },     // cobblestone
          { color: 0x50505a, w: 0.6, len: 1, dash: false },     // slim unmarked
          { color: 0x8a6f4d, w: 1, len: 1, dash: true },        // marked (classic)
          { color: 0x3a3a44, w: 1.7, len: 1, dash: true }       // highway
        ][roadStage] || { color: 0x8a6f4d, w: 1, len: 1, dash: true };
        const isRail = t.railroad === true;
        const color = isRail ? PROP_COLOR.railroad : (staged ? RS.color : PROP_COLOR.road);
        let connected = 0;
        for (const d of ROAD_DIRS) {
          if (!roadAt(x + d.dx, y + d.dy)) continue;
          connected++;
          const df = d.diag ? 1.42 : 1;
          if (level === 'high') {
            // H2: the connection half is THREE conforming sub-segments (the
            // ribbon read); H13 styles width/hue/markings by stage
            for (const c of [0.0833, 0.25, 0.4167]) {
              const sub = laid(x + d.dx * c, y + d.dy * c, d.rot, 0.0833 * df, top);
              const segColor = staged && roadStage === 1 && !isRail
                ? (Math.floor(c * 12) % 2 ? 0x938e80 : 0x827d70) : color; // cobble shade alternation
              items.roadSeg.push({
                x, y, top: sub.top, dim, color: segColor, rotY: d.rot, rotZ: sub.rotZ, dy: 0.03,
                dx: d.dx * c, dz: d.dy * c, sx: 0.36 * df * RS.len, sz: isRail ? 0.7 : RS.w
              });
              if (!isRail && RS.dash) {
                if (roadStage === 4) { // highway: twin dash rows
                  for (const off of [-0.03, 0.03]) {
                    items.roadDash.push({
                      x, y, top: sub.top, dim, color: 0xe8e8e8, rotY: d.rot, rotZ: sub.rotZ, dy: 0.041,
                      dx: d.dx * c - Math.sin(d.rot) * off, dz: d.dy * c - Math.cos(d.rot) * off, sx: df
                    });
                  }
                } else {
                  items.roadDash.push({
                    x, y, top: sub.top, dim, color: 0xe8e8e8, rotY: d.rot, rotZ: sub.rotZ, dy: 0.041,
                    dx: d.dx * c, dz: d.dy * c, sx: df
                  });
                }
              }
              if (isRail && staged) { // twin steel rails ride each sub-segment
                const tracks = roadStage >= 3 ? [-0.062, -0.018, 0.018, 0.062] : [-0.022, 0.022];
                for (const off of tracks) {
                  items.roadSeg.push({
                    x, y, top: sub.top, dim, color: 0x9aa0a8, rotY: d.rot, rotZ: sub.rotZ, dy: 0.037,
                    dx: d.dx * c - Math.sin(d.rot) * off, dz: d.dy * c - Math.cos(d.rot) * off,
                    sx: 0.36 * df, sz: 0.09
                  });
                }
              }
            }
          } else {
          const seg = laid(x + d.dx * 0.25, y + d.dy * 0.25, d.rot, 0.25 * df, top);
          items.roadSeg.push({
            x, y, top: seg.top, dim, color, rotY: d.rot, rotZ: seg.rotZ, dy: 0.03,
            dx: d.dx * 0.25, dz: d.dy * 0.25, sx: df * (staged ? RS.len : 1), sz: staged && !isRail ? RS.w : 1
          });
          if (isRail && staged) { // medium: twin rails on the single segment
            const tracks = roadStage >= 3 ? [-0.062, -0.018, 0.018, 0.062] : [-0.022, 0.022];
            for (const off of tracks) {
              items.roadSeg.push({
                x, y, top: seg.top, dim, color: 0x9aa0a8, rotY: d.rot, rotZ: seg.rotZ, dy: 0.037,
                dx: d.dx * 0.25 - Math.sin(d.rot) * off, dz: d.dy * 0.25 - Math.cos(d.rot) * off,
                sx: df, sz: 0.09
              });
            }
          }
          }
          if (isRail) {
            // cross-ties along the rail segment (art A1.6b)
            for (const k of [0.14, 0.3]) {
              items.tie.push({
                x, y, top: ground(x, y, d.dx * k, d.dy * k, top), dim, color: PROP_COLOR.tie, rotY: d.rot, dy: 0.032,
                dx: d.dx * k, dz: d.dy * k,
                sz: staged && roadStage >= 3 ? 1.6 : 1 // double-track ties widen
              });
            }
          }
        }
        if (connected === 0) {
          items.roadSeg.push({ x, y, top, dim, color, rotY: 0, dy: 0.03, sx: 0.5 });
        }
      }
      if (t.mine) {
        // rock pile + dark entrance + timber lintel (art A1.6b)
        items.mine.push({ x, y, top, dim, color: PROP_COLOR.mine, dx: 0.18, dz: -0.16, dy: 0.1 });
        items.mineDoor.push({ x, y, top, dim, color: PROP_COLOR.mineDoor, dx: 0.18, dz: -0.06, dy: 0.045 });
        items.mineBeam.push({ x, y, top, dim, color: PROP_COLOR.mineBeam, dx: 0.18, dz: -0.055, dy: 0.1 });
      }
      if (t.fortress) items.fortress.push({ x, y, top, dim, color: PROP_COLOR.fortress, rotX: Math.PI / 2, dy: 0.05 });
      if (t.t === 'forest') {
        if (level === 'high') {
          // H2: TW-style tree models — trunk + layered canopy; species mix
          // (60% deciduous, 25% conifer, 15% autumn), all placement/species
          // via visualRand so every client grows the same wood.
          // H6: a SPECIAL forest tile is a CLEARING — few trees, pushed to the
          // rim, so the high-detail Game animal isn't buried in canopy.
          const count = t.special ? 2 : 5 + Math.floor(visualRand(x, y, 1) * 4);
          for (let i = 0; i < count; i++) {
            const s = 0.8 + visualRand(x, y, 100 + i) * 0.5;
            let dx = (visualRand(x, y, 200 + i) - 0.5) * 0.72;
            let dz = (visualRand(x, y, 300 + i) - 0.5) * 0.72;
            if (t.special) { // push to the tile rim, keep the center clear
              const m = Math.max(Math.abs(dx), Math.abs(dz), 0.001);
              dx = dx / m * 0.34; dz = dz / m * 0.34;
            }
            const gnd = ground(x, y, dx, dz, top);
            const species = visualRand(x, y, 400 + i);
            if (species < 0.25) { // conifer: trunk + two stacked cones
              items.treeTrunk.push({ x, y, top: gnd, dim, color: 0x6a5236, dx, dz, dy: 0.08 * s, sx: s, sy: s, sz: s });
              items.tree.push({ x, y, top: gnd, dim, color: 0x2d6a35, dx, dz, dy: 0.2 * s, sx: s, sy: s, sz: s });
              items.tree.push({ x, y, top: gnd, dim, color: 0x33743c, dx, dz, dy: 0.32 * s, sx: s * 0.7, sy: s * 0.8, sz: s * 0.7 });
            } else { // deciduous / autumn: trunk + 2-3 canopy spheres
              const autumn = species > 0.85;
              const c1 = autumn ? 0xd07a2e : 0x3f8f43, c2 = autumn ? 0xdd9a3a : 0x4c9a4f;
              items.treeTrunk.push({ x, y, top: gnd, dim, color: 0x6a5236, dx, dz, dy: 0.08 * s, sx: s, sy: s, sz: s });
              items.treeCanopy.push({ x, y, top: gnd, dim, color: c1, dx, dz, dy: 0.22 * s, sx: s, sy: s * 0.9, sz: s });
              items.treeCanopy.push({ x, y, top: gnd, dim, color: c2, dx: dx + 0.04 * s, dz: dz - 0.02 * s, dy: 0.3 * s, sx: s * 0.7, sy: s * 0.65, sz: s * 0.7 });
              if (visualRand(x, y, 500 + i) > 0.5) {
                items.treeCanopy.push({ x, y, top: gnd, dim, color: c1, dx: dx - 0.05 * s, dz: dz + 0.03 * s, dy: 0.27 * s, sx: s * 0.6, sy: s * 0.55, sz: s * 0.6 });
              }
            }
          }
        } else {
        // 6–11 spruce cones (XVII #10: doubled density), scattered + sized per tile
        const color = PROP_COLOR.forest;
        const count = 6 + Math.floor(visualRand(x, y, 1) * 6);
        for (let i = 0; i < count; i++) {
          const s = 0.75 + visualRand(x, y, 100 + i) * 0.55;
          items.tree.push({
            x, y, top, dim, color,
            dx: (visualRand(x, y, 200 + i) - 0.5) * 0.72,
            dz: (visualRand(x, y, 300 + i) - 0.5) * 0.72,
            dy: 0.14 * s, sx: s, sy: s, sz: s
          });
        }
        }
      } else if (t.t === 'jungle') {
        // XV §5: tropical rainforest — each a buttress base + slender trunk + broad
        // flat dome canopy; no cones. XVII #11: doubled canopy count at ~60% height
        // (denser, lower rainforest mass).
        const count = 6 + Math.floor(visualRand(x, y, 1) * 4); // 6–9 (broad canopies overlap)
        const h = 0.6; // ~60% of the previous height
        for (let i = 0; i < count; i++) {
          const s = 0.8 + visualRand(x, y, 100 + i) * 0.45;
          const dx = (visualRand(x, y, 200 + i) - 0.5) * 0.62;
          const dz = (visualRand(x, y, 300 + i) - 0.5) * 0.62;
          items.jungleButtress.push({ x, y, top, dim, color: PROP_COLOR.jungleButtress, dx, dz, dy: 0.075 * s * h, sx: s, sy: s * h, sz: s });
          items.jungleTrunk.push({ x, y, top, dim, color: PROP_COLOR.jungleTrunk, dx, dz, dy: 0.24 * s * h, sx: s, sy: s * h, sz: s });
          items.jungleCanopy.push({ x, y, top, dim, color: PROP_COLOR.jungleCanopy, dx, dz, dy: 0.52 * s * h, sx: 1.05 * s, sy: 0.42 * s * h, sz: 1.05 * s });
        }
      } else if (t.t === 'swamp') {
        // XVII #12: scattered small pond discs so swamp reads as wet, waterlogged ground
        const count = 2 + Math.floor(visualRand(x, y, 9) * 3); // 2–4
        for (let i = 0; i < count; i++) {
          const s = 0.6 + visualRand(x, y, 400 + i) * 0.7;
          items.pond.push({
            x, y, top, dim, color: PROP_COLOR.pond,
            dx: (visualRand(x, y, 200 + i) - 0.5) * 0.66,
            dz: (visualRand(x, y, 300 + i) - 0.5) * 0.66,
            dy: 0.012, sx: s, sz: s
          });
        }
      } else if (t.t === 'hills') {
        // H12 (flying-boulders.png): a hill's centre is PEAKED — anchoring an
        // offset rock at the centre height floats it over the falling slope.
        // ground() samples the real surface at the rock's own position.
        const count = 1 + (visualRand(x, y, 2) > 0.55 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const dx = (visualRand(x, y, 40 + i) - 0.5) * 0.5;
          const dz = (visualRand(x, y, 50 + i) - 0.5) * 0.5;
          items.rock.push({
            x, y, top: ground(x, y, dx, dz, top), dim, color: PROP_COLOR.rock,
            dx, dz, dy: 0.05, sy: 0.6, rotY: visualRand(x, y, 60 + i) * Math.PI
          });
        }
      } else if (t.t === 'mountains' && level !== 'high') {
        // The peak + snow cones give the FACETED tiers their summits. At HIGH
        // the smooth terrain owns the silhouette and these read as a second
        // peak floating over the real one (user playtest screenshot,
        // peakes-over-peakes.png, 2026-08-15) — the smooth pass snow-caps
        // its summits via vertex color instead (terrain.js SNOWLINE).
        const px = (visualRand(x, y, 3) - 0.5) * 0.3;
        const pz = (visualRand(x, y, 4) - 0.5) * 0.3;
        const s = 0.85 + visualRand(x, y, 5) * 0.4;
        items.peak.push({ x, y, top, dim, color: PROP_COLOR.peak, dx: px, dz: pz, dy: 0.25 * s, sx: s, sy: s, sz: s, rotY: visualRand(x, y, 6) * Math.PI });
        items.snow.push({ x, y, top, dim, color: PROP_COLOR.snow, dx: px, dz: pz, dy: 0.42 * s, sx: s, sy: s, sz: s, rotY: visualRand(x, y, 6) * Math.PI });
      } else if (SCRUB_COLOR[t.t] !== undefined && visualRand(x, y, 7) > (scatter > 0 ? 0.55 - 0.15 * scatter : 0.55)) {
        // sparse tufts/scrub so open ground reads as a world, not a board;
        // medium+ lowers the threshold and raises the count (G2 scatter)
        const count = 1 + (visualRand(x, y, 8) > 0.7 ? 1 : 0)
          + (scatter > 0 ? Math.floor(visualRand(x, y, 9) * scatter) : 0);
        for (let i = 0; i < count; i++) {
          const s = scatter > 0 ? 0.6 + visualRand(x, y, 90 + i) * 0.55 : 1;
          const dx = (visualRand(x, y, 70 + i) - 0.5) * 0.7;
          const dz = (visualRand(x, y, 80 + i) - 0.5) * 0.7;
          items.scrub.push({
            x, y, top: ground(x, y, dx, dz, top), dim, color: SCRUB_COLOR[t.t],
            dx, dz, dy: 0.05 * s, sx: s, sy: s, sz: s
          });
        }
      }
      // H2: occasional LONE tree on open grassland at high (the TW look —
      // scattered singles across the meadows), never on worked/occupied tiles
      if (level === 'high' && t.t === 'grassland' && !t.irrigation && !t.road && !t.railroad
          && !t.mine && !t.special && visualRand(x, y, 21) < 0.09) {
        const s = 0.9 + visualRand(x, y, 22) * 0.5;
        const dx = (visualRand(x, y, 23) - 0.5) * 0.6;
        const dz = (visualRand(x, y, 24) - 0.5) * 0.6;
        const gnd = ground(x, y, dx, dz, top);
        const autumn = visualRand(x, y, 25) > 0.88;
        items.treeTrunk.push({ x, y, top: gnd, dim, color: 0x6a5236, dx, dz, dy: 0.08 * s, sx: s, sy: s, sz: s });
        items.treeCanopy.push({ x, y, top: gnd, dim, color: autumn ? 0xd07a2e : 0x3f8f43, dx, dz, dy: 0.22 * s, sx: s, sy: s * 0.9, sz: s });
        items.treeCanopy.push({ x, y, top: gnd, dim, color: autumn ? 0xdd9a3a : 0x4c9a4f, dx: dx + 0.04 * s, dz: dz - 0.02 * s, dy: 0.3 * s, sx: s * 0.7, sy: s * 0.65, sz: s * 0.7 });
      }
      // G2 medium+ ground scatter: pebbles on dry/rocky/cold ground, reeds in
      // swamp — small instanced props, colors fixed per terrain
      if (scatter > 0 && SCATTER_PEBBLE[t.t] !== undefined && visualRand(x, y, 17) < 0.18 * scatter) {
        const k = 1 + (visualRand(x, y, 18) > 0.6 ? 1 : 0);
        for (let i = 0; i < k; i++) {
          const s = 0.2 + visualRand(x, y, 110 + i) * 0.12;
          const dx = (visualRand(x, y, 120 + i) - 0.5) * 0.8;
          const dz = (visualRand(x, y, 130 + i) - 0.5) * 0.8;
          items.rock.push({
            x, y, top: ground(x, y, dx, dz, top), dim, color: SCATTER_PEBBLE[t.t],
            dx, dz, dy: 0.03, sx: s, sy: s, sz: s
          });
        }
      }
      if (scatter > 0 && t.t === 'swamp' && visualRand(x, y, 19) < 0.22 * scatter) {
        const k = 2 + (visualRand(x, y, 20) > 0.5 ? 1 : 0);
        for (let i = 0; i < k; i++) {
          const dx = (visualRand(x, y, 140 + i) - 0.5) * 0.7;
          const dz = (visualRand(x, y, 150 + i) - 0.5) * 0.7;
          items.scrub.push({
            x, y, top: ground(x, y, dx, dz, top), dim, color: 0x4a6b45, // reeds: thin, tall, marsh-green
            dx, dz, dy: 0.07, sx: 0.35, sy: 1.4, sz: 0.35
          });
        }
      }
      if (t.t === 'ocean') {
        // (H2 foam densify happens inside the existing coast handler below)
        // foam strips along shore edges, riding just above the water plane
        // (art A1.6b §4: stylized, grid-readable — one strip per land edge)
        for (const d of [{ dx: 1, dy: 0, rot: Math.PI / 2 }, { dx: -1, dy: 0, rot: Math.PI / 2 },
          { dx: 0, dy: 1, rot: 0 }, { dx: 0, dy: -1, rot: 0 }]) {
          if (!landAt(x + d.dx, y + d.dy)) continue;
          items.foam.push({
            x, y, dim, top: WATER_LEVEL + 0.008, dy: 0,
            color: PROP_COLOR.foam, rotY: d.rot, dx: d.dx * 0.44, dz: d.dy * 0.44
          });
          if (level === 'high') {
            // H2: a second, thinner foam line a little off the beach — the TW
            // double-line surf read
            items.foam.push({
              x, y, dim, top: WATER_LEVEL + 0.008, dy: 0,
              color: PROP_COLOR.foam, rotY: d.rot, dx: d.dx * 0.34, dz: d.dy * 0.34,
              sx: 0.85, sz: 0.5
            });
          }
        }
      }
      if (t.special) {
        // per-resource motif by terrain (Civ 1 showed the resource itself). An
        // OCEAN special (fish) rides the WATER SURFACE, not the submerged floor
        // (`top`) — at `top` it renders underwater, invisible (friend playtest).
        const base = t.t === 'ocean' ? WATER_LEVEL : top;
        const motif = (level === 'high' && SPECIAL_MOTIF_HIGH[t.t]) || SPECIAL_MOTIF[t.t]; // H6 tier-split
        if (motif) {
          for (const m of motif) {
            // H12: each prim grounds at ITS OWN offset (peaked hill/mountain
            // centres floated offset prims — flying-boulders.png), and the
            // crystals' faceted-era "raised above the peak" lift sinks at
            // high, where the smooth summit carries the shape itself.
            const crystalSink = (level === 'high' && m.k === 'resCrystal') ? 0.45 : 1;
            items[m.k].push({ x, y, top: ground(x, y, m.dx || 0, m.dz || 0, base), dim, color: m.color,
              dx: m.dx || 0, dz: m.dz || 0, dy: (m.dy || 0) * crystalSink,
              sx: m.sx, sy: m.sy, sz: m.sz, rotX: m.rotX || 0, rotY: m.rotY || 0, rotZ: m.rotZ || 0 });
          }
        } else { // any terrain without a motif keeps the generic marker
          items.special.push({ x, y, top: base, dim, color: PROP_COLOR.special, dx: -0.2, dz: 0.2, dy: 0.08 });
        }
      }
      if (t.hut === true) { // N13: the village — wall cylinder + thatch cone
        items.hutBase.push({ x, y, top, dim, color: PROP_COLOR.hutWall, dy: 0.06 });
        items.hutRoof.push({ x, y, top, dim, color: PROP_COLOR.hutRoof, dy: 0.19 });
      }
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
      dummy.rotation.set(it.rotX || 0, it.rotY || 0, it.rotZ || 0);
      dummy.scale.set(it.sx || 1, it.sy || 1, it.sz || 1);
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
