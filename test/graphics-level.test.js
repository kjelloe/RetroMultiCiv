// G1 graphics-levels (specs/graphics-levels.md): the GPU-probe heuristic that
// resolves 'auto'. Pure function over the diagnostics object, so this runs
// headless. The table IS the contract: software renderers and WebGL1-only
// stacks must never be suggested above 'low', and 'high' only for GPU strings
// positively recognized as discrete/desktop-class.
const { test } = require('node:test');
const assert = require('node:assert');

test('suggestGraphicsLevel: the GPU-string table', async () => {
  const { suggestGraphicsLevel } = await import('../client/diagnostics.js');
  const cases = [
    // [webgl2, webgl1, renderer string, expected]
    [false, false, 'anything', 'low'],                                     // no WebGL at all
    [true, true, 'Google SwiftShader', 'low'],                             // CI / headless software GL
    [true, true, 'ANGLE (Microsoft, Microsoft Basic Render Driver ...)', 'low'],
    [true, true, 'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)', 'medium'],
    [true, true, 'ANGLE (Intel(R) UHD Graphics 600 Direct3D11 vs_5_0)', 'low'],   // Gemini Lake: measured ~48fps at medium — starts low
    [true, true, 'ANGLE (Intel(R) UHD Graphics 615)', 'low'],                     // Amber Lake Y
    [true, true, 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x9A49))', 'medium'],
    [false, true, 'ANGLE (Intel(R) HD Graphics Direct3D9Ex vs_3_0)', 'low'], // the D3D9 machine: WebGL1-only
    [true, true, 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)', 'high'],
    [true, true, 'NVIDIA GeForce GTX 1060 6GB/PCIe/SSE2', 'high'],
    [true, true, 'ANGLE (AMD, AMD Radeon RX 6700 XT)', 'high'],
    [true, true, 'Apple M2', 'high'],
    [true, true, 'Adreno (TM) 740', 'medium'],                             // modern phone: medium, not high
    [true, true, 'Mali-G78', 'medium'],
    [true, true, '', 'medium'],                                            // unknown but WebGL2-capable
    [false, true, 'Adreno (TM) 320', 'low']                                // old phone: WebGL1-only
  ];
  for (const [webgl2, webgl1, renderer, want] of cases) {
    assert.strictEqual(suggestGraphicsLevel({ webgl2, webgl1, renderer }), want,
      `${renderer || '(blank)'} webgl2=${webgl2} → ${want}`);
  }
  assert.strictEqual(suggestGraphicsLevel(null), 'low', 'null diag never crashes');
});

test('terrain-detail painters cover every terrain id', () => {
  // the terrain-coverage pattern (test/mock-state.test.js): terrain-detail.js
  // is browser ESM (imports 'three'), so read the PAINTERS table from source —
  // a terrain added to data/terrain.json without a painter would silently
  // render textureless at medium
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'client', 'renderer', 'three', 'terrain-detail.js'), 'utf8');
  const table = src.match(/const PAINTERS = \{([\s\S]*?)\n\};/);
  assert.ok(table, 'PAINTERS table found in terrain-detail.js');
  const painters = [...table[1].matchAll(/^  (\w+)\(g, rnd/gm)].map(m => m[1]);
  for (const id of Object.keys(require('../data/terrain.json').terrains)) {
    assert.ok(painters.includes(id), `terrain "${id}" has no detail painter`);
  }
});
