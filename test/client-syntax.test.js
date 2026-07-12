// The client is browser-only ESM (no bundler), so nothing else exercises it
// headless. This guard at least catches syntax errors: each module is checked
// as ESM via `node --check` on a temp .mjs copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Auto-discovered: every .js under these roots is checked — a hand-kept
// list missed newly added files TWICE (terrain.js, gamecode.js).
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'vendor' || name === 'node_modules') continue;
      walk(full, out);
    } else if (name.endsWith('.js')) {
      out.push(path.relative(path.join(__dirname, '..'), full));
    }
  }
  return out;
}
const CLIENT_MODULES = ['client', 'engine', 'shared', 'server']
  .flatMap(root => walk(path.join(__dirname, '..', root), []));

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
