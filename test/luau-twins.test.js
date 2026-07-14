// Phase 5 (P5-1): the Luau twins of rng/statehash/gamecode must reproduce
// the three cross-language anchors exactly. Runs the luau/anchors.luau
// harness under lune and asserts every printed gate value; self-skips when
// lune is not installed (docs/09 §5 — the CI twin pattern; the nightly
// picks it up once its runner installs lune).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');

const lune = (() => {
  const r = spawnSync('lune', ['--version'], { encoding: 'utf8', timeout: 30000 });
  return !r.error && r.status === 0 ? (r.stdout || '').trim() : null;
})();

test('luau twins: rng + statehash + gamecode reproduce the phase-5 anchors under lune',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, () => {
    const res = spawnSync('lune', ['run', 'luau/anchors.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(res.status, 0, `lune run failed (${lune}):\n${res.stdout}\n${res.stderr}`);
    const out = res.stdout;
    // gate 1: xorshift32 golden sequence, seed 123456789 (test/rng.test.js)
    assert.match(out, /rng: 2714967881,2238813396,1250077441,3820100336\n/,
      'the Luau xorshift32 must reproduce the golden sequence bit-exactly');
    // gate 2: canonical serialization + hash anchor
    assert.match(out, /canon: \{"a":\[1,"x",true\],"b":2\}\n/,
      'the canonical string must be byte-identical, not merely hash-equal');
    assert.match(out, /statehash: 0x30db1e29\n/, 'the statehash anchor');
    // gate 3: the A11 game-code anchors
    assert.match(out, /codehi: 0xa687b72d\n/, 'the reverse-FNV codeHi anchor');
    assert.match(out, /gamecode: AD1X-Q5MR-DP7H9\n/, 'the grouped Crockford game code');
    // the empty-array representation convention (P5-1 trap-list addition):
    // marked empty tables are [], unmarked are {} — json2lua relies on this
    assert.match(out, /emptyarray: \{"a":\[\],"b":\{\}\}\n/,
      'ARRAY_MT-marked empty tables must serialize as [] and plain empties as {}');
  });
