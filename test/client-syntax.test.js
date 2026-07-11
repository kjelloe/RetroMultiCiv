// The client is browser-only ESM (no bundler), so nothing else exercises it
// headless. This guard at least catches syntax errors: each module is checked
// as ESM via `node --check` on a temp .mjs copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLIENT_MODULES = [
  'client/main.js',
  'client/session.js',
  'client/diagnostics.js',
  'client/ui/hud.js',
  'client/ui/panels.js',
  'client/ui/input.js',
  'client/ui/saves.js',
  'client/ui/turnlog.js',
  'client/renderer/renderer.js',
  'client/renderer/three/index.js',
  'client/renderer/three/assets.js',
  'engine/ai.js',
  'engine/barbarians.js',
  'engine/cities.js',
  'engine/improvements.js',
  'engine/score.js',
  'engine/combat.js',
  'engine/index.js',
  'engine/mapgen.js',
  'engine/movement.js',
  'engine/rng.js',
  'engine/tech.js',
  'engine/visibility.js',
  'shared/statehash.js'
];

test('browser-facing ESM modules parse', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-check-'));
  try {
    for (const rel of CLIENT_MODULES) {
      const src = path.join(__dirname, '..', rel);
      const copy = path.join(tmp, rel.replace(/[\\/]/g, '_') + '.mjs');
      fs.copyFileSync(src, copy);
      const res = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
      assert.strictEqual(res.status, 0, `${rel} failed --check:\n${res.stderr}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
