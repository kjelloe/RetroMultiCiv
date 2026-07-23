// Guard for the shared/version.js class (2026-07-23, hardening catch #2292):
// a runtime file imported a module that existed in the working tree but was
// never git-added — local suites passed, every clean clone had a broken
// server boot, and the clean-clone failures were mis-attributed to env noise.
// This test resolves every static/dynamic relative import in the ESM runtime
// dirs against `git ls-files`, so an untracked dependency fails ON THE DEV
// TREE, where the mistake is made. Self-skips outside a git checkout.
const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNTIME_DIRS = ['client', 'engine', 'shared', 'server'];

let tracked = null;
try {
  tracked = new Set(
    execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean)
  );
} catch {
  // not a git checkout (exported tarball) — nothing to verify against
}

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|export\s[^'"]*?from\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

test('every runtime import resolves to a git-tracked file', { skip: !tracked }, () => {
  const problems = [];
  for (const dir of RUNTIME_DIRS) {
    for (const file of jsFiles(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(IMPORT_RE)) {
        const target = path.normalize(
          path.join(path.dirname(path.relative(ROOT, file)), m[1])
        ).replace(/\\/g, '/');
        if (!tracked.has(target)) {
          problems.push(`${path.relative(ROOT, file)} imports ${m[1]} -> ${target} (NOT git-tracked)`);
        }
      }
    }
  }
  assert.deepStrictEqual(problems, [],
    'untracked import targets found — git add them or the clean clone breaks:\n' + problems.join('\n'));
});
