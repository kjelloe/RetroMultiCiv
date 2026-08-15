// Continuous low-poly terrain surface (specs/terrain-mesh.md, adapted):
// ONE non-indexed BufferGeometry for the whole map, displaced per vertex and
// colored per FACE from small per-terrain palettes. Explicit per-face normals
// give the faceted "tabletop" lighting without flatShading — that flag needs
// the derivatives extension on WebGL1, and this renderer must keep working on
// ANGLE D3D9 and SwiftShader. Deterministic: every wobble goes through
// visualRand(x, y, salt); nothing touches game state.
import * as THREE from 'three';
import { visualRand, WATER_LEVEL } from './props.js';
import { detailTexture } from './terrain-detail.js';

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

// grid cells per tile edge — tile centers land on vertices. Per graphics
// level (specs/graphics-levels.md §4b, the v2 ladder): low = the shipped
// 8-tris/tile faceted look, BYTE-IDENTICAL to the pre-level renderer
// (gallery.html?vertexcheck=1 + the rest-pose screenshot contracts pin it);
// medium = 128 tris/tile faceted with per-terrain detail textures; high =
// the same density rendered SMOOTH (buildSmoothTerrain below — indexed,
// vertex-color blended, sand shorelines).
const LEVEL_SEGS = { low: 2, medium: 8, high: 8 };
const LEVEL_DUNE_AMP = { low: 0.035, medium: 0.055, high: 0.055 }; // (already equal — dunes were never the tier delta)

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
  desert:    { base: 0.05, jitter: 0.015, peak: 0, dunes: true, palette: [0xeab84f, 0xf2c460, 0xdcaa40] },
  tundra:    { base: 0.04, jitter: 0.012, peak: 0, palette: [0xb0b8a8, 0xa5ad9d, 0xbbc3b3] },
  arctic:    { base: 0.06, jitter: 0.015, peak: 0, palette: [0xe8eef0, 0xdde4e7, 0xf2f7f8] },
  swamp:     { base: 0.02, jitter: 0.01, peak: 0, palette: [0x5d7a5a, 0x546f52, 0x668563] },
  jungle:    { base: 0.06, jitter: 0.012, peak: 0, palette: [0x3f7d46, 0x46884e, 0x38723f] },
  unknown:   { base: 0.0, jitter: 0, peak: 0, palette: [0x0a0e16] }
};
// Darkened from 0x3a7ac8 (ally review 2026-07-25 night): the scene's
// ambient(0.55)+directional(1.4) light sums to ~1.95x — on facets that catch
// strong light, the old mid-bright blue's G/B channels multiplied past the
// clamp and washed to near-white, reading as pale/constructed-canal seams
// along the ribbon. This deeper blue stays visibly blue even at full light.
const RIVER_TINT = new THREE.Color(0x1a4070);
const SNOW_TINT = new THREE.Color(0xeef3f6); // H12a: the smooth summit cap
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
function heightAt(map, fx, fy, vi, vj, segs, duneAmp) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const wx = fx - x0, wy = fy - y0;
  const s00 = specAt(map, x0, y0), s10 = specAt(map, x0 + 1, y0);
  const s01 = specAt(map, x0, y0 + 1), s11 = specAt(map, x0 + 1, y0 + 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  let h = lerp(lerp(s00.base, s10.base, wx), lerp(s01.base, s11.base, wx), wy);
  const amp = lerp(lerp(s00.jitter, s10.jitter, wx), lerp(s01.jitter, s11.jitter, wx), wy);
  h += (visualRand(vi, vj, 7) - 0.5) * 2 * amp;
  const near = specAt(map, Math.round(fx), Math.round(fy));
  if (near.dunes) h += Math.sin(fx * 2.4) * Math.cos(fy * 1.9) * duneAmp;
  // a tile-center vertex on peaked terrain rises into a ridge point
  if (near.peak > 0 && vi % segs === segs / 2 && vj % segs === segs / 2) {
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
// level (G2): 'low' | 'medium' | 'high'. Low writes ONE geometry with the
// mottle material — the same buffers in the same order as before levels
// existed. Medium+ writes one geometry PER TERRAIN ID so each carries its own
// procedural detail texture (terrain-detail.js); the face loop and every
// height/palette decision are shared, so the levels differ only in where a
// face's vertices land and which material shades them.
// H2 (spec §4b): the HIGH tier's smooth-terrain style — the Transport World
// watermark. Vertex colors blend across tile boundaries with a sharpness
// exponent (1 = fully painterly, high = near-faceted); the sand band paints
// shoreline vertices on both sides of a land/water boundary. Provisional
// values land under the decide-document-flag rule; the 3-variant question
// settles them.
export const SMOOTH_STYLE = {
  blendSharpness: 3,   // weight exponent: 2 painterly / 3 balanced / 6 subtle
  sand: 0xdcc98e,      // the beach band hue
  sandLandLerp: 0.45   // how far a shore-adjacent land vertex leans toward sand
};

export function buildTerrain(map, reveal, level = 'low') { // reveal (#34 S2): un-dim explored tiles
  const { width, height } = map;
  const segs = LEVEL_SEGS[level] || 2;
  const duneAmp = LEVEL_DUNE_AMP[level] || 0.035;
  const smooth = level === 'high'; // H2: high renders the smooth blended style
  const perTerrain = !smooth && segs !== 2; // medium: per-terrain buckets with detail textures
  const gw = width * segs, gh = height * segs;

  // vertex height grid, (gw+1) x (gh+1); world x = -0.5 + vi / segs
  const H = new Float32Array((gw + 1) * (gh + 1));
  for (let vj = 0; vj <= gh; vj++) {
    for (let vi = 0; vi <= gw; vi++) {
      H[vj * (gw + 1) + vi] = heightAt(map, -0.5 + vi / segs, -0.5 + vj / segs, vi, vj, segs, duneAmp);
    }
  }

  if (smooth) return buildSmoothTerrain(map, reveal, segs, H);

  // face buckets: key -> preallocated attribute arrays. Low = one bucket for
  // the whole sheet; medium+ = one per terrain id (counted first).
  const tilesByKey = {};
  for (const t of map.tiles) {
    const key = perTerrain ? (TERRAIN[t.t] ? t.t : 'grassland') : 'all';
    tilesByKey[key] = (tilesByKey[key] || 0) + 1;
  }
  const buckets = {};
  for (const key of Object.keys(tilesByKey)) {
    const faces = tilesByKey[key] * segs * segs * 2;
    buckets[key] = {
      positions: new Float32Array(faces * 9),
      normals: new Float32Array(faces * 9),
      colors: new Float32Array(faces * 9),
      uvs: new Float32Array(faces * 6), // world-planar, for the mottle/detail map
      p: 0
    };
  }

  const color = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const wx = (vi) => -0.5 + vi / segs;
  for (let vj = 0; vj < gh; vj++) {
    for (let vi = 0; vi < gw; vi++) {
      const tx = Math.floor(vi / segs), ty = Math.floor(vj / segs);
      const tile = map.tiles[ty * width + tx];
      const spec = TERRAIN[tile.t] || TERRAIN.grassland;
      const bucket = buckets[perTerrain ? (TERRAIN[tile.t] ? tile.t : 'grassland') : 'all'];
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
        // 0.35 -> 0.62 (ally review 2026-07-25 night): each of a river tile's up
        // to 4 quad-cells still rolls its own base-terrain palette shade before
        // the blend, and at 0.35 that per-face variance survived strongly enough
        // on light base terrains (plains/desert/tundra) to read as pale/white
        // tile-edge seams — a constructed-canal look, not a natural course. A
        // stronger blend suppresses that facet contrast while keeping the same
        // tint hue and the ribbon's width/meander untouched (the requested fix).
        if (tile.river) color.lerp(RIVER_TINT, 0.62);
        // H13c: MEDIUM snow-caps its own summits, the H12a smooth treatment on
        // the faceted mesh (per-face: the peak cones are LOW-only now — at
        // SEGS 8 the mesh owns the silhouette and cones read as a second
        // floating peak; mobile playtest, 2026-08-15). perTerrain gates it
        // off LOW, whose bytes are frozen.
        if (perTerrain) {
          // line 0.78 (vs the smooth pass's 0.85): medium summits are thin
          // spikes, so the cap needs to start lower to read as snow at all
          const fh = Math.max(quad[tri * 3][1], quad[tri * 3 + 1][1], quad[tri * 3 + 2][1]);
          if (fh > 0.78) color.lerp(SNOW_TINT, Math.min(1, (fh - 0.78) / 0.3) * 0.85);
        }
        if (tile.visible === false && reveal !== true) color.lerp(FOG_TINT, 0.45); // explored, out of sight (#34: reveal un-dims)
        const v0 = quad[tri * 3], v1 = quad[tri * 3 + 1], v2 = quad[tri * 3 + 2];
        a.set(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
        b.set(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]);
        n.crossVectors(a, b).normalize();
        if (n.y < 0) n.negate();
        let p = bucket.p;
        for (const v of [v0, v1, v2]) {
          bucket.positions[p] = v[0]; bucket.positions[p + 1] = v[1]; bucket.positions[p + 2] = v[2];
          bucket.normals[p] = n.x; bucket.normals[p + 1] = n.y; bucket.normals[p + 2] = n.z;
          bucket.colors[p] = color.r; bucket.colors[p + 1] = color.g; bucket.colors[p + 2] = color.b;
          bucket.uvs[(p / 3) * 2] = v[0] / 4; bucket.uvs[(p / 3) * 2 + 1] = v[2] / 4;
          p += 3;
        }
        bucket.p = p;
      }
    }
  }

  // DoubleSide: the sheet is hand-wound; culling half of it by winding
  // mistakes is a worse deal than shading both faces of one terrain mesh
  const parts = []; // { geometry, material } per bucket
  for (const key of Object.keys(buckets).sort()) {
    const bk = buckets[key];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(bk.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(bk.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(bk.colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(bk.uvs, 2));
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide,
      map: perTerrain ? detailTexture(key) : mottleTexture()
    });
    parts.push({ geometry, material });
  }
  // low keeps the single-Mesh shape (?vertexcheck=1 byte-compares its buffers);
  // medium+ groups the per-terrain meshes under one node
  let mesh;
  if (parts.length === 1) {
    mesh = new THREE.Mesh(parts[0].geometry, parts[0].material);
  } else {
    mesh = new THREE.Group();
    for (const part of parts) mesh.add(new THREE.Mesh(part.geometry, part.material));
  }

  function tileTop(x, y) {
    // tile center lands exactly on vertex (x*segs + segs/2, y*segs + segs/2)
    const vi = x * segs + segs / 2, vj = y * segs + segs / 2;
    return H[vj * (gw + 1) + vi];
  }

  // Surface height at CONTINUOUS world coordinates — bilinear over the H grid
  // (the exact mesh, not a re-derivation). G4 polish: off-center props (road
  // segments, field patches, scatter) sit ON the denser medium/high relief
  // instead of floating at the tile-center height.
  function surfaceAt(fx, fz) {
    const gx = Math.min(Math.max((fx + 0.5) * segs, 0), gw);
    const gz = Math.min(Math.max((fz + 0.5) * segs, 0), gh);
    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = Math.min(x0 + 1, gw), z1 = Math.min(z0 + 1, gh);
    const tx = gx - x0, tz = gz - z0;
    const h00 = H[z0 * (gw + 1) + x0], h10 = H[z0 * (gw + 1) + x1];
    const h01 = H[z1 * (gw + 1) + x0], h11 = H[z1 * (gw + 1) + x1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  return {
    mesh,
    tileTop,
    surfaceAt,
    dispose() {
      for (const part of parts) { part.geometry.dispose(); part.material.dispose(); }
    }
  };
}

// --- H2: the smooth high-tier surface -------------------------------------------
// ONE indexed grid geometry: (gw+1)x(gh+1) shared vertices, per-VERTEX colors
// blended from the four nearest tiles (sharpened bilinear weights, so tiles
// stay readable while edges fade into each other), computeVertexNormals for
// the smooth relief, sand painted at land/water boundary vertices, river tint
// and fog dim applied as per-vertex WEIGHTS (soft edges instead of tile-hard
// ones). Same H grid, same tileTop anchors, same determinism (visualRand).
function buildSmoothTerrain(map, reveal, segs, H) {
  const { width, height } = map;
  const gw = width * segs, gh = height * segs;
  const nvx = gw + 1, nvz = gh + 1;
  const positions = new Float32Array(nvx * nvz * 3);
  const colors = new Float32Array(nvx * nvz * 3);
  const uvs = new Float32Array(nvx * nvz * 2);
  const color = new THREE.Color(), tileCol = new THREE.Color();
  const SAND = new THREE.Color(SMOOTH_STYLE.sand);
  const p = SMOOTH_STYLE.blendSharpness;

  const clampTX = tx => {
    if (tx >= 0 && tx < width) return tx;
    if (map.wrapX) return ((tx % width) + width) % width;
    return tx < 0 ? 0 : width - 1;
  };
  const clampTY = ty => ty < 0 ? 0 : ty >= height ? height - 1 : ty;

  for (let vj = 0; vj < nvz; vj++) {
    for (let vi = 0; vi < nvx; vi++) {
      const idx = vj * nvx + vi;
      const fx = -0.5 + vi / segs, fz = -0.5 + vj / segs;
      positions[idx * 3] = fx;
      positions[idx * 3 + 1] = H[idx];
      positions[idx * 3 + 2] = fz;
      uvs[idx * 2] = fx / 4; uvs[idx * 2 + 1] = fz / 4;

      // the four nearest tiles + sharpened bilinear weights
      const x0 = Math.floor(fx), z0 = Math.floor(fz);
      const wx = fx - x0, wz = fz - z0;
      const quad = [
        [clampTX(x0), clampTY(z0), (1 - wx) * (1 - wz)],
        [clampTX(x0 + 1), clampTY(z0), wx * (1 - wz)],
        [clampTX(x0), clampTY(z0 + 1), (1 - wx) * wz],
        [clampTX(x0 + 1), clampTY(z0 + 1), wx * wz]
      ];
      let wsum = 0;
      for (const q of quad) { q[2] = Math.pow(q[2], p); wsum += q[2]; }
      // does this vertex touch both land and water? (the shoreline test)
      let touchesLand = false, touchesWater = false;
      for (const q of quad) {
        if (q[2] <= 0) continue;
        const t = map.tiles[q[1] * width + q[0]].t;
        if (t === 'ocean') touchesWater = true;
        else if (t !== 'unknown') touchesLand = true;
      }
      const shore = touchesLand && touchesWater;
      color.setRGB(0, 0, 0);
      let riverW = 0, fogW = 0;
      for (const q of quad) {
        if (q[2] <= 0) continue;
        const w = q[2] / wsum;
        const tile = map.tiles[q[1] * width + q[0]];
        const spec = TERRAIN[tile.t] || TERRAIN.grassland;
        tileCol.setHex(spec.palette[Math.floor(visualRand(q[0], q[1], 11) * spec.palette.length)]);
        if (shore) {
          // the beach band: water contributes SAND at mixed vertices; the land
          // side leans toward sand so the ring sits on both banks (TW's look)
          if (tile.t === 'ocean') tileCol.copy(SAND);
          else if (tile.t !== 'unknown') tileCol.lerp(SAND, SMOOTH_STYLE.sandLandLerp);
        }
        color.r += tileCol.r * w; color.g += tileCol.g * w; color.b += tileCol.b * w;
        if (tile.river) riverW += w;
        if (tile.visible === false && reveal !== true) fogW += w;
      }
      if (riverW > 0) color.lerp(RIVER_TINT, 0.62 * riverW);
      // H12a: SNOWLINE — the smooth pass snow-caps its own summits (the peak
      // prop cones are suppressed at high; they read as a second floating
      // peak). Vertices above 0.85 whiten toward full snow by 1.15.
      const hV = H[idx];
      if (hV > 0.85) color.lerp(SNOW_TINT, Math.min(1, (hV - 0.85) / 0.3) * 0.85);
      if (fogW > 0) color.lerp(FOG_TINT, 0.45 * fogW);
      colors[idx * 3] = color.r; colors[idx * 3 + 1] = color.g; colors[idx * 3 + 2] = color.b;
    }
  }

  const index = new Uint32Array(gw * gh * 6);
  let k = 0;
  for (let vj = 0; vj < gh; vj++) {
    for (let vi = 0; vi < gw; vi++) {
      const i00 = vj * nvx + vi, i10 = i00 + 1, i01 = i00 + nvx, i11 = i01 + 1;
      // the same alternating diagonal as the faceted path, for parity of shape
      if ((vi + vj) % 2 === 0) {
        index[k++] = i00; index[k++] = i01; index[k++] = i11;
        index[k++] = i00; index[k++] = i11; index[k++] = i10;
      } else {
        index[k++] = i00; index[k++] = i01; index[k++] = i10;
        index[k++] = i10; index[k++] = i01; index[k++] = i11;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals(); // the smooth relief — shared vertices average their faces
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide, map: mottleTexture()
  });
  const mesh = new THREE.Mesh(geometry, material);

  function tileTop(x, y) {
    const vi = x * segs + segs / 2, vj = y * segs + segs / 2;
    return H[vj * (gw + 1) + vi];
  }
  function surfaceAt(fx, fz) {
    const gx = Math.min(Math.max((fx + 0.5) * segs, 0), gw);
    const gz = Math.min(Math.max((fz + 0.5) * segs, 0), gh);
    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = Math.min(x0 + 1, gw), z1 = Math.min(z0 + 1, gh);
    const tx = gx - x0, tz = gz - z0;
    const h00 = H[z0 * (gw + 1) + x0], h10 = H[z0 * (gw + 1) + x1];
    const h01 = H[z1 * (gw + 1) + x0], h11 = H[z1 * (gw + 1) + x1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  return {
    mesh, tileTop, surfaceAt,
    dispose() { geometry.dispose(); material.dispose(); }
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

export function buildWater(map, level = 'low') {
  // H11 (spec §4b): HIGH water is richer — a segmented sheet with gentle
  // render-time waves plus a counter-drifting shimmer layer above the base
  // bands. Low/medium keep the exact shipped plane (byte-stable).
  const smooth = level === 'high';
  const segX = smooth ? Math.min(64, map.width * 2) : 1;
  const segZ = smooth ? Math.min(40, map.height * 2) : 1;
  const geometry = new THREE.PlaneGeometry(map.width, map.height, segX, segZ);
  const tex = bandTexture();
  tex.repeat.set(map.width / 6, map.height / 6);
  const material = new THREE.MeshPhongMaterial({
    color: 0x3d84b8, map: tex, transparent: true, opacity: 0.45,
    shininess: smooth ? 55 : 35 // the ally's number at low/med; a touch glossier smooth
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((map.width - 1) / 2, WATER_LEVEL, (map.height - 1) / 2);
  const parent = new THREE.Group();
  parent.add(mesh);
  let shimmerTex = null, shimmer = null, shimGeo = null, shimMat = null;
  if (smooth) {
    shimmerTex = bandTexture().clone();
    shimmerTex.needsUpdate = true;
    shimmerTex.wrapS = shimmerTex.wrapT = THREE.RepeatWrapping;
    shimmerTex.repeat.set(map.width / 3.2, map.height / 3.2); // finer sparkle
    shimGeo = new THREE.PlaneGeometry(map.width, map.height);
    shimMat = new THREE.MeshBasicMaterial({
      map: shimmerTex, transparent: true, opacity: 0.1, depthWrite: false
    });
    shimmer = new THREE.Mesh(shimGeo, shimMat);
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.set((map.width - 1) / 2, WATER_LEVEL + 0.004, (map.height - 1) / 2);
    parent.add(shimmer);
  }
  const pos = smooth ? geometry.attributes.position : null;
  const baseXY = smooth ? Float32Array.from(pos.array) : null;
  return {
    mesh: parent,
    tick(timeMs) { // render-time wave drift (never simulation state)
      tex.offset.set((timeMs * 0.000012) % 1, (timeMs * 0.000007) % 1);
      if (!smooth) return;
      shimmerTex.offset.set(1 - (timeMs * 0.000019) % 1, (timeMs * 0.000011) % 1); // counter-drift
      const t = timeMs * 0.0011;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const wx2 = baseXY[i], wy2 = baseXY[i + 1];
        arr[i + 2] = Math.sin(wx2 * 1.7 + t) * 0.006 + Math.cos(wy2 * 2.3 + t * 0.8) * 0.005;
      }
      pos.needsUpdate = true;
      // H12a perf: normals every 4th tick — the per-frame recompute showed in
      // the RTX playtest's dips; the glint still moves, at a quarter the cost
      if ((this._nrm = ((this._nrm || 0) + 1) % 4) === 0) geometry.computeVertexNormals();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      if (shimGeo) { shimGeo.dispose(); shimMat.dispose(); }
    }
  };
}
