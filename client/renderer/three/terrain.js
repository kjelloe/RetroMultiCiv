// Continuous low-poly terrain surface (specs/terrain-mesh.md, adapted):
// ONE non-indexed BufferGeometry for the whole map, displaced per vertex and
// colored per FACE from small per-terrain palettes. Explicit per-face normals
// give the faceted "tabletop" lighting without flatShading — that flag needs
// the derivatives extension on WebGL1, and this renderer must keep working on
// ANGLE D3D9 and SwiftShader. Deterministic: every wobble goes through
// visualRand(x, y, salt); nothing touches game state.
import * as THREE from 'three';
import { visualRand, WATER_LEVEL } from './props.js';

// --- low-contrast surface mottle (art A1.6b §2) --------------------------------
// One tileable 64x64 CanvasTexture of faint speckles, world-planar mapped and
// MULTIPLIED into the per-face palette colors — enriches the surface without
// turning the map into noise (the ally's own caution). Seeded locally.
let mottleTex = null;
function mottleTexture() {
  if (mottleTex) return mottleTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  let seed = 20260713; // fixed local seed — visual only, never game state
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 260; i++) {
    const v = 244 + Math.floor(rnd() * 11); // 244..254: ±4% brightness dip
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1 + Math.floor(rnd() * 2), 1);
  }
  mottleTex = new THREE.CanvasTexture(canvas);
  mottleTex.wrapS = mottleTex.wrapT = THREE.RepeatWrapping;
  return mottleTex;
}

const SEGS = 2; // grid cells per tile edge — tile centers land on vertices

// base: ground level; jitter: vertex wobble amplitude; peak: extra center
// height (mountains read as ridges, hills as mounds); palette: 3 shades
// picked per face so no two neighboring facets read as a flat sheet
// XIV §29 (ally art direction, user-confirmed overlap 2026-07-21): three height
// tiers with clear GAPS — water 0 / flats near-level / hills / mountains own the
// skyline. Flats carry NO per-tile vertical jitter (their variety is COLOR via
// the per-face palette, not elevation), so grassland/plains no longer read as
// hilly with no hill/mountain neighbor. Hills ≈ 25% of mountain height (the
// user cap: hills 0.20 base, mountains 0.80 → 25%); the boundary curving is
// preserved automatically — heightAt bilinearly blends neighbor tile bases, so a
// flat tile bordering a hill/mountain still curves up toward it. First
// screenshot candidate; the desaturation review settles the final ratio.
const TERRAIN = {
  ocean:     { base: -0.18, jitter: 0.01, peak: 0, palette: [0x1d4e79, 0x1a4870, 0x225a86] },
  grassland: { base: 0.05, jitter: 0.01, peak: 0, palette: [0x4c9a3f, 0x57a848, 0x428a37] },
  plains:    { base: 0.05, jitter: 0.01, peak: 0, palette: [0xc2b46b, 0xcbbd76, 0xb7a960] },
  forest:    { base: 0.06, jitter: 0.012, peak: 0, palette: [0x2d6a35, 0x33743c, 0x27602f] },
  hills:     { base: 0.20, jitter: 0.06, peak: 0.10, palette: [0x96854f, 0xa08f58, 0x8a7a47] },
  mountains: { base: 0.80, jitter: 0.18, peak: 0.45, palette: [0x8c8c94, 0x7f7f86, 0x9a9aa2] },
  desert:    { base: 0.05, jitter: 0.015, peak: 0, dunes: true, palette: [0xd9c27e, 0xe2cd8a, 0xcdb671] },
  tundra:    { base: 0.04, jitter: 0.012, peak: 0, palette: [0xb0b8a8, 0xa5ad9d, 0xbbc3b3] },
  arctic:    { base: 0.06, jitter: 0.015, peak: 0, palette: [0xe8eef0, 0xdde4e7, 0xf2f7f8] },
  swamp:     { base: 0.02, jitter: 0.01, peak: 0, palette: [0x5d7a5a, 0x546f52, 0x668563] },
  jungle:    { base: 0.06, jitter: 0.012, peak: 0, palette: [0x3f7d46, 0x46884e, 0x38723f] },
  unknown:   { base: 0.0, jitter: 0, peak: 0, palette: [0x0a0e16] }
};
const RIVER_TINT = new THREE.Color(0x3a7ac8);
const FOG_TINT = new THREE.Color(0x0a0e16);

// shared with the DOM UI (city view mini-map)
export function terrainBaseColor(terrainId) {
  const spec = TERRAIN[terrainId] || TERRAIN.grassland;
  return '#' + spec.palette[0].toString(16).padStart(6, '0');
}

function tileAt(map, tx, ty) {
  let x = tx;
  const y = ty < 0 ? 0 : ty >= map.height ? map.height - 1 : ty;
  if (x < 0 || x >= map.width) {
    if (map.wrapX) x = ((x % map.width) + map.width) % map.width;
    else x = x < 0 ? 0 : map.width - 1;
  }
  return map.tiles[y * map.width + x];
}

function specAt(map, tx, ty) {
  return TERRAIN[tileAt(map, tx, ty).t] || TERRAIN.grassland;
}

// Height of the surface at continuous tile coordinates (tiles centered on
// integers): bilinear blend of the four nearest tile-center base heights —
// coasts ramp down into the water basin, hills shoulder into plains — plus
// deterministic vertex wobble and a center peak for hills/mountains.
function heightAt(map, fx, fy, vi, vj) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const wx = fx - x0, wy = fy - y0;
  const s00 = specAt(map, x0, y0), s10 = specAt(map, x0 + 1, y0);
  const s01 = specAt(map, x0, y0 + 1), s11 = specAt(map, x0 + 1, y0 + 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  let h = lerp(lerp(s00.base, s10.base, wx), lerp(s01.base, s11.base, wx), wy);
  const amp = lerp(lerp(s00.jitter, s10.jitter, wx), lerp(s01.jitter, s11.jitter, wx), wy);
  h += (visualRand(vi, vj, 7) - 0.5) * 2 * amp;
  const near = specAt(map, Math.round(fx), Math.round(fy));
  if (near.dunes) h += Math.sin(fx * 2.4) * Math.cos(fy * 1.9) * 0.035;
  // a tile-center vertex on peaked terrain rises into a ridge point
  if (near.peak > 0 && vi % SEGS === 1 && vj % SEGS === 1) {
    h += near.peak * (0.7 + visualRand(vi, vj, 8) * 0.6);
  }
  return h;
}

// Build the whole surface for one view. Returns { mesh, tileTop, dispose } —
// tileTop(x, y) is the exact surface height at a tile's center vertex, the
// anchor every unit/city/prop/marker sits on.
//
// SHARED-VERTEX INVARIANT (A44, ally sign-off): every shared vertex receives
// ONE deterministic height + palette decision; adjacent tiles never write
// conflicting values. This holds by CODE SHAPE, not by reconciliation: the
// height grid H is computed once per vertex from heightAt(x, y) — a pure
// function of world coordinates via visualRand — before any face exists, so
// nothing tile-scoped COULD write a second value; face colors are then read
// per-face (each face belongs to exactly one tile), never per shared vertex.
// The determinism half is mechanically checked in the browser suite
// (gallery.html?vertexcheck=1 builds this mesh twice, byte-compares buffers).
export function buildTerrain(map, reveal) { // reveal (#34 S2): un-dim explored tiles
  const { width, height } = map;
  const gw = width * SEGS, gh = height * SEGS;

  // vertex height grid, (gw+1) x (gh+1); world x = -0.5 + vi / SEGS
  const H = new Float32Array((gw + 1) * (gh + 1));
  for (let vj = 0; vj <= gh; vj++) {
    for (let vi = 0; vi <= gw; vi++) {
      H[vj * (gw + 1) + vi] = heightAt(map, -0.5 + vi / SEGS, -0.5 + vj / SEGS, vi, vj);
    }
  }

  const faces = gw * gh * 2;
  const positions = new Float32Array(faces * 9);
  const normals = new Float32Array(faces * 9);
  const colors = new Float32Array(faces * 9);
  const uvs = new Float32Array(faces * 6); // world-planar, for the mottle map
  const color = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();

  let p = 0;
  const wx = (vi) => -0.5 + vi / SEGS;
  for (let vj = 0; vj < gh; vj++) {
    for (let vi = 0; vi < gw; vi++) {
      const tx = Math.floor(vi / SEGS), ty = Math.floor(vj / SEGS);
      const tile = map.tiles[ty * width + tx];
      const spec = TERRAIN[tile.t] || TERRAIN.grassland;
      const h00 = H[vj * (gw + 1) + vi], h10 = H[vj * (gw + 1) + vi + 1];
      const h01 = H[(vj + 1) * (gw + 1) + vi], h11 = H[(vj + 1) * (gw + 1) + vi + 1];
      // two triangles per cell; alternate the diagonal for a woven look
      const flip = (vi + vj) % 2 === 0;
      const quad = flip
        ? [[wx(vi), h00, wx(vj)], [wx(vi), h01, wx(vj + 1)], [wx(vi + 1), h11, wx(vj + 1)],
           [wx(vi), h00, wx(vj)], [wx(vi + 1), h11, wx(vj + 1)], [wx(vi + 1), h10, wx(vj)]]
        : [[wx(vi), h00, wx(vj)], [wx(vi), h01, wx(vj + 1)], [wx(vi + 1), h10, wx(vj)],
           [wx(vi + 1), h10, wx(vj)], [wx(vi), h01, wx(vj + 1)], [wx(vi + 1), h11, wx(vj + 1)]];
      // note: quad rows are [x, height, z] with z = world position of vj
      for (let tri = 0; tri < 2; tri++) {
        color.setHex(spec.palette[Math.floor(visualRand(vi, vj, 11 + tri) * spec.palette.length)]);
        if (tile.river) color.lerp(RIVER_TINT, 0.35);
        if (tile.visible === false && reveal !== true) color.lerp(FOG_TINT, 0.45); // explored, out of sight (#34: reveal un-dims)
        const v0 = quad[tri * 3], v1 = quad[tri * 3 + 1], v2 = quad[tri * 3 + 2];
        a.set(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
        b.set(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]);
        n.crossVectors(a, b).normalize();
        if (n.y < 0) n.negate();
        for (const v of [v0, v1, v2]) {
          positions[p] = v[0]; positions[p + 1] = v[1]; positions[p + 2] = v[2];
          normals[p] = n.x; normals[p + 1] = n.y; normals[p + 2] = n.z;
          colors[p] = color.r; colors[p + 1] = color.g; colors[p + 2] = color.b;
          uvs[(p / 3) * 2] = v[0] / 4; uvs[(p / 3) * 2 + 1] = v[2] / 4;
          p += 3;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  // DoubleSide: the sheet is hand-wound; culling half of it by winding
  // mistakes is a worse deal than shading both faces of one terrain mesh
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide, map: mottleTexture()
  });
  const mesh = new THREE.Mesh(geometry, material);

  function tileTop(x, y) {
    // tile center lands exactly on vertex (x*SEGS + 1, y*SEGS + 1) for SEGS=2
    const vi = x * SEGS + SEGS / 2, vj = y * SEGS + SEGS / 2;
    return H[vj * (gw + 1) + vi];
  }

  return {
    mesh,
    tileTop,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

// --- water plane (art A1.6b §1) -------------------------------------------------
// One translucent Phong sheet at WATER_LEVEL over the whole map: the sunken
// ocean basin shows through it, so shallows near ramped coasts read lighter
// and deep water darker for free. A faint band texture drifts by RENDER TIME
// ONLY — pure presentation, never simulation state. Land (base ≥ +0.02) and
// unknown tiles (base 0.0) sit above the plane and simply hide it.
let bandTex = null;
function bandTexture() {
  if (bandTex) return bandTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgb(238,242,246)'; // faint lighter bands, low contrast
  for (const y of [6, 27, 47]) {
    g.fillRect(0, y, 64, 3);
    g.fillRect(0, y + 9, 40, 2);
  }
  bandTex = new THREE.CanvasTexture(canvas);
  bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping;
  return bandTex;
}

export function buildWater(map) {
  const geometry = new THREE.PlaneGeometry(map.width, map.height);
  const tex = bandTexture();
  tex.repeat.set(map.width / 6, map.height / 6);
  const material = new THREE.MeshPhongMaterial({
    color: 0x3d84b8, map: tex, transparent: true, opacity: 0.45,
    shininess: 35 // the ally's number — a gentle specular glint, WebGL1-safe
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((map.width - 1) / 2, WATER_LEVEL, (map.height - 1) / 2);
  return {
    mesh,
    tick(timeMs) { // render-time wave drift (never simulation state)
      tex.offset.set((timeMs * 0.000012) % 1, (timeMs * 0.000007) % 1);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
