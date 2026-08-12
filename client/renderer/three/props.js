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

export function createTileProps(map, tileTop, joins, reveal, level = 'low', surfaceAt) { // reveal (#34 S2): un-dim explored tiles
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
        // segments toward each connected neighbor; an isolated road is a stub
        const color = t.railroad ? PROP_COLOR.railroad : PROP_COLOR.road;
        let connected = 0;
        for (const d of ROAD_DIRS) {
          if (!roadAt(x + d.dx, y + d.dy)) continue;
          connected++;
          const seg = laid(x + d.dx * 0.25, y + d.dy * 0.25, d.rot, 0.25 * (d.diag ? 1.42 : 1), top);
          items.roadSeg.push({
            x, y, top: seg.top, dim, color, rotY: d.rot, rotZ: seg.rotZ, dy: 0.03,
            dx: d.dx * 0.25, dz: d.dy * 0.25, sx: d.diag ? 1.42 : 1
          });
          if (t.railroad) {
            // cross-ties along the rail segment (art A1.6b)
            for (const k of [0.14, 0.3]) {
              items.tie.push({
                x, y, top: ground(x, y, d.dx * k, d.dy * k, top), dim, color: PROP_COLOR.tie, rotY: d.rot, dy: 0.032,
                dx: d.dx * k, dz: d.dy * k
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
        const count = 1 + (visualRand(x, y, 2) > 0.55 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          items.rock.push({
            x, y, top, dim, color: PROP_COLOR.rock,
            dx: (visualRand(x, y, 40 + i) - 0.5) * 0.5,
            dz: (visualRand(x, y, 50 + i) - 0.5) * 0.5,
            dy: 0.05, sy: 0.6, rotY: visualRand(x, y, 60 + i) * Math.PI
          });
        }
      } else if (t.t === 'mountains') {
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
        // foam strips along shore edges, riding just above the water plane
        // (art A1.6b §4: stylized, grid-readable — one strip per land edge)
        for (const d of [{ dx: 1, dy: 0, rot: Math.PI / 2 }, { dx: -1, dy: 0, rot: Math.PI / 2 },
          { dx: 0, dy: 1, rot: 0 }, { dx: 0, dy: -1, rot: 0 }]) {
          if (!landAt(x + d.dx, y + d.dy)) continue;
          items.foam.push({
            x, y, dim, top: WATER_LEVEL + 0.008, dy: 0,
            color: PROP_COLOR.foam, rotY: d.rot, dx: d.dx * 0.44, dz: d.dy * 0.44
          });
        }
      }
      if (t.special) {
        // per-resource motif by terrain (Civ 1 showed the resource itself). An
        // OCEAN special (fish) rides the WATER SURFACE, not the submerged floor
        // (`top`) — at `top` it renders underwater, invisible (friend playtest).
        const base = t.t === 'ocean' ? WATER_LEVEL : top;
        const motif = SPECIAL_MOTIF[t.t];
        if (motif) {
          for (const m of motif) {
            items[m.k].push({ x, y, top: base, dim, color: m.color,
              dx: m.dx || 0, dz: m.dz || 0, dy: m.dy || 0,
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
