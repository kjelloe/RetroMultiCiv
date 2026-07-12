// Continuous low-poly terrain surface (specs/terrain-mesh.md, adapted):
// ONE non-indexed BufferGeometry for the whole map, displaced per vertex and
// colored per FACE from small per-terrain palettes. Explicit per-face normals
// give the faceted "tabletop" lighting without flatShading — that flag needs
// the derivatives extension on WebGL1, and this renderer must keep working on
// ANGLE D3D9 and SwiftShader. Deterministic: every wobble goes through
// visualRand(x, y, salt); nothing touches game state.
import * as THREE from 'three';
import { visualRand } from './props.js';

const SEGS = 2; // grid cells per tile edge — tile centers land on vertices

// base: ground level; jitter: vertex wobble amplitude; peak: extra center
// height (mountains read as ridges, hills as mounds); palette: 3 shades
// picked per face so no two neighboring facets read as a flat sheet
const TERRAIN = {
  ocean:     { base: -0.18, jitter: 0.01, peak: 0, palette: [0x1d4e79, 0x1a4870, 0x225a86] },
  grassland: { base: 0.05, jitter: 0.05, peak: 0, palette: [0x4c9a3f, 0x57a848, 0x428a37] },
  plains:    { base: 0.05, jitter: 0.05, peak: 0, palette: [0xc2b46b, 0xcbbd76, 0xb7a960] },
  forest:    { base: 0.08, jitter: 0.06, peak: 0, palette: [0x2d6a35, 0x33743c, 0x27602f] },
  hills:     { base: 0.26, jitter: 0.10, peak: 0.10, palette: [0x96854f, 0xa08f58, 0x8a7a47] },
  mountains: { base: 0.55, jitter: 0.20, peak: 0.35, palette: [0x8c8c94, 0x7f7f86, 0x9a9aa2] },
  desert:    { base: 0.05, jitter: 0.03, peak: 0, dunes: true, palette: [0xd9c27e, 0xe2cd8a, 0xcdb671] },
  tundra:    { base: 0.04, jitter: 0.04, peak: 0, palette: [0xb0b8a8, 0xa5ad9d, 0xbbc3b3] },
  arctic:    { base: 0.10, jitter: 0.06, peak: 0, palette: [0xe8eef0, 0xdde4e7, 0xf2f7f8] },
  swamp:     { base: 0.02, jitter: 0.03, peak: 0, palette: [0x5d7a5a, 0x546f52, 0x668563] },
  jungle:    { base: 0.08, jitter: 0.06, peak: 0, palette: [0x3f7d46, 0x46884e, 0x38723f] },
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
export function buildTerrain(map) {
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
        if (tile.visible === false) color.lerp(FOG_TINT, 0.45); // explored, out of sight
        const v0 = quad[tri * 3], v1 = quad[tri * 3 + 1], v2 = quad[tri * 3 + 2];
        a.set(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
        b.set(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]);
        n.crossVectors(a, b).normalize();
        if (n.y < 0) n.negate();
        for (const v of [v0, v1, v2]) {
          positions[p] = v[0]; positions[p + 1] = v[1]; positions[p + 2] = v[2];
          normals[p] = n.x; normals[p + 1] = n.y; normals[p + 2] = n.z;
          colors[p] = color.r; colors[p + 1] = color.g; colors[p + 2] = color.b;
          p += 3;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // DoubleSide: the sheet is hand-wound; culling half of it by winding
  // mistakes is a worse deal than shading both faces of one terrain mesh
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
