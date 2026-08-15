// H13b (specs/graphics-levels.md): city tiles draw the road's other half
// toward real-road neighbours — as a plain road, never rail styling — and
// roadless adjacent cities sprout nothing. Runs createTileProps headless
// (test/three-alias.mjs resolves 'three' to the vendored module) and reads
// the InstancedMesh matrices/colors directly, so the guard needs no WebGL.
const { test } = require('node:test');
const assert = require('node:assert');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

register(pathToFileURL(path.join(__dirname, 'three-alias.mjs')).href);

const ROAD_BROWN = 0x8a6f4d; // PROP_COLOR.road / RS stage 3
const RAIL_DARK = 0x3c3c46;  // PROP_COLOR.railroad
const RAIL_STEEL = 0x9aa0a8; // H13 twin rail lines
const DASH_WHITE = 0xe8e8e8; // road centerline dashes (high)

function makeMap(w, h) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'grassland', visible: true });
  return { width: w, height: h, wrapX: false, tiles, at: (x, y) => tiles[y * w + x] };
}

// every instance across all prop meshes whose centre lands in the box
function instancesNear(meshes, x0, x1, z0, z1) {
  const out = [];
  for (const m of meshes) {
    for (let i = 0; i < m.count; i++) {
      const a = m.instanceMatrix.array;
      const px = a[i * 16 + 12], py = a[i * 16 + 13], pz = a[i * 16 + 14];
      if (px >= x0 && px <= x1 && pz >= z0 && pz <= z1) {
        let rgb = null;
        if (m.instanceColor) {
          const c = m.instanceColor.array;
          rgb = [c[i * 3], c[i * 3 + 1], c[i * 3 + 2]];
        }
        out.push({ geo: m.geometry.type, px, py, pz, rgb });
      }
    }
  }
  return out;
}

test('H13b: city tiles draw the road half; rails stop at the edge; roadless cities stay bare', async () => {
  const { createTileProps } = await import('../client/renderer/three/props.js');
  // instance colors are stored in the LINEAR working space (setHex converts
  // from sRGB) — compare through the same THREE.Color path, never raw hex
  const THREE = await import('three');
  const lin = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const isColor = (rgb, hex) => rgb && lin(hex).every((v, i) => Math.abs(v - rgb[i]) < 1e-3);
  const map = makeMap(12, 12);
  map.at(6, 5).road = true;              // road north of the road-city
  map.at(2, 5).road = true; map.at(2, 5).railroad = true; // rail north of the rail-city
  const joins = {};
  for (const [x, y] of [[6, 6], [2, 6], [9, 6], [9, 7]]) joins[y * map.width + x] = true;
  // (9,6)+(9,7): two ADJACENT roadless cities — must sprout nothing

  for (const level of ['low', 'medium', 'high']) {
    const meshes = createTileProps(map, () => 0.05, joins, false, level,
      level === 'low' ? undefined : () => 0.05, 3);

    // the road-city pair: road tile half (z 5..5.5) AND city half (z 5.5..6)
    const roadHalf = instancesNear(meshes, 5.9, 6.1, 5.05, 5.45).filter(s => s.geo === 'BoxGeometry');
    const cityHalf = instancesNear(meshes, 5.9, 6.1, 5.55, 5.95).filter(s => s.geo === 'BoxGeometry');
    assert.ok(roadHalf.length >= 1, `${level}: road tile draws its half toward the city`);
    assert.ok(cityHalf.length >= 1, `${level}: city tile draws the road's other half`);
    assert.ok(cityHalf.every(s => !isColor(s.rgb, RAIL_DARK)), `${level}: city half is never rail-colored`);

    // the rail-city pair: the city's half must be a PLAIN ROAD (rails stop
    // at the edge) — no rail-colored instance on the city side
    const railCityHalf = instancesNear(meshes, 1.9, 2.1, 5.55, 5.95).filter(s => s.geo === 'BoxGeometry');
    assert.ok(railCityHalf.length >= 1, `${level}: city next to a rail still gets a road half`);
    // road-brown or dash-white are both ROAD styling (high draws centerline
    // dashes); rail steel/dark must never appear on the city side
    assert.ok(railCityHalf.every(s => isColor(s.rgb, ROAD_BROWN) || isColor(s.rgb, DASH_WHITE)),
      `${level}: the half toward a rail carries only road styling (got ${JSON.stringify(railCityHalf.map(s => s.rgb))})`);
    assert.ok(railCityHalf.every(s => !isColor(s.rgb, RAIL_DARK) && !isColor(s.rgb, RAIL_STEEL)),
      `${level}: no rail styling on the city side`);

    // two adjacent roadless cities: no segments, no isolated stub
    const bare = instancesNear(meshes, 8.6, 9.4, 5.6, 7.4).filter(s => s.geo === 'BoxGeometry' && Math.abs(s.py - 0.08) < 0.02);
    assert.strictEqual(bare.length, 0, `${level}: roadless adjacent cities sprout nothing (got ${bare.length})`);
  }
});
