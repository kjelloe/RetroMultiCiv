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
  'client/renderer/renderer.js',
  'client/renderer/three/index.js'
];

test('client ESM modules parse', () => {
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
