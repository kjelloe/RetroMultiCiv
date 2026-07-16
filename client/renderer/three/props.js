// Tile props (art A1.5/A1.6b — split from assets.js per the A15 pre-step):
// terrain features, improvements, and resources as InstancedMeshes, plus the
// deterministic visualRand every decoration derives from. One seam = one
// module, mirroring factions.js; assets.js keeps unit/city construction only.
import * as THREE from 'three';
import { PROP_SHAPES } from './recipes.js';

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
  rock: 0x7d7468, peak: 0x63636d, snow: 0xe8eef0,
  grassTuft: 0x3f8f3f, dryScrub: 0x9d8f55, tundraScrub: 0x9fae9d,
  tie: 0x2c2620, mineDoor: 0x17130e, mineBeam: 0x6b4a2a,
  fieldPatch: 0x59a03e, foam: 0xdcecf2
};
// the translucent water plane's height (terrain.js buildWater) — foam strips
// ride just above it; ocean floor is at -0.18, lowest land at +0.02
export const WATER_LEVEL = -0.02;
const PROP_FOG = new THREE.Color(0x0a0e16);
const SCRUB_COLOR = { grassland: 0x3f8f3f, plains: 0x9d8f55, desert: 0x9d8f55, tundra: 0x9fae9d };
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
export function createTileProps(map, tileTop, joins) {
  const items = {
    strip: [], roadSeg: [], mine: [], tree: [], scrub: [],
    rock: [], peak: [], snow: [], special: [], fortress: [],
    tie: [], mineDoor: [], mineBeam: [], fieldPatch: [], foam: []
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
      const dim = t.visible === false;
      const top = tileTop(x, y);
      if (t.irrigation) {
        // thin channel + two cultivated field patches (art A1.6b)
        items.strip.push({ x, y, top, dim, color: PROP_COLOR.irrigation, rotY: Math.PI / 4, dy: 0.02 });
        items.fieldPatch.push({ x, y, top, dim, color: PROP_COLOR.fieldPatch, dx: -0.2, dz: 0.14, dy: 0.015, rotY: Math.PI / 4 });
        items.fieldPatch.push({ x, y, top, dim, color: PROP_COLOR.fieldPatch, dx: 0.16, dz: -0.2, dy: 0.015, rotY: Math.PI / 4 });
      }
      if (t.road || t.railroad) {
        // segments toward each connected neighbor; an isolated road is a stub
        const color = t.railroad ? PROP_COLOR.railroad : PROP_COLOR.road;
        let connected = 0;
        for (const d of ROAD_DIRS) {
          if (!roadAt(x + d.dx, y + d.dy)) continue;
          connected++;
          items.roadSeg.push({
            x, y, top, dim, color, rotY: d.rot, dy: 0.03,
            dx: d.dx * 0.25, dz: d.dy * 0.25, sx: d.diag ? 1.42 : 1
          });
          if (t.railroad) {
            // cross-ties along the rail segment (art A1.6b)
            for (const k of [0.14, 0.3]) {
              items.tie.push({
                x, y, top, dim, color: PROP_COLOR.tie, rotY: d.rot, dy: 0.032,
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
      if (t.t === 'forest' || t.t === 'jungle') {
        // 3–5 trees, deterministically scattered and sized per tile
        const color = PROP_COLOR[t.t];
        const count = 3 + Math.floor(visualRand(x, y, 1) * 3);
        for (let i = 0; i < count; i++) {
          const s = 0.75 + visualRand(x, y, 10 + i) * 0.55;
          items.tree.push({
            x, y, top, dim, color,
            dx: (visualRand(x, y, 20 + i) - 0.5) * 0.62,
            dz: (visualRand(x, y, 30 + i) - 0.5) * 0.62,
            dy: 0.14 * s, sx: s, sy: s, sz: s
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
      } else if (SCRUB_COLOR[t.t] !== undefined && visualRand(x, y, 7) > 0.55) {
        // sparse tufts/scrub so open ground reads as a world, not a board
        const count = 1 + (visualRand(x, y, 8) > 0.7 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          items.scrub.push({
            x, y, top, dim, color: SCRUB_COLOR[t.t],
            dx: (visualRand(x, y, 70 + i) - 0.5) * 0.7,
            dz: (visualRand(x, y, 80 + i) - 0.5) * 0.7,
            dy: 0.05
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
      dummy.rotation.set(it.rotX || 0, it.rotY || 0, 0);
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
