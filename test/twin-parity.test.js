// Twin-file parity guard: every engine/*.js module MUST have a byte-shaped
// luau/<name>.luau twin (CLAUDE.md golden-window rule — twins change together
// in one window). The heavy luau-twins gate verifies twin BEHAVIOR but only
// for modules the scenarios/anchors happen to exercise; a brand-new engine
// module whose twin file was never created would not fail anything until a
// scenario reached it. This guard makes the missing FILE fail immediately
// (naval.js/naval.luau, disasters, pollution, difficulty all landed as pairs
// — the invariant this pins). Runs without lune; extra luau/ files (shared
// twins, harness) are fine — the constraint is one-directional.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

test('every engine/*.js module has a luau/*.luau twin file', () => {
  const engineMods = fs.readdirSync(path.join(REPO, 'engine'))
    .filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  assert.ok(engineMods.length >= 27, `engine module count sanity (got ${engineMods.length})`);
  const missing = engineMods.filter(m => !fs.existsSync(path.join(REPO, 'luau', m + '.luau')));
  assert.deepStrictEqual(missing, [],
    `engine modules missing their luau twin FILE: ${missing.join(', ')} — ` +
    'the golden-window rule says the twin lands in the same window');
});

test('the twinned shared/ modules backing the cross-language gates exist in luau/', () => {
  // These five shared modules are load-bearing for the twins gates
  // (statehash = every pin; strategic = SO17 + soak stats; fastforward =
  // ff-parity anchor; gamecode = docs/07 anchor; pathfind = road-aware goto).
  for (const m of ['statehash', 'strategic', 'fastforward', 'gamecode', 'pathfind']) {
    assert.ok(fs.existsSync(path.join(REPO, 'luau', m + '.luau')),
      `luau/${m}.luau missing — a cross-language gate depends on it`);
  }
});
