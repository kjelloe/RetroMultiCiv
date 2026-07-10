const test = require('node:test');
const assert = require('node:assert');
// engine/ is ESM (browser + Node); load it once for all tests here
const engineRng = import('../engine/rng.js');
let seedRng, nextRng, rollRange;
test.before(async () => { ({ seedRng, nextRng, rollRange } = await engineRng); });

test('xorshift32 golden sequence (cross-language parity anchor)', () => {
  // The Luau implementation MUST reproduce these values for seed 123456789.
  const GOLDEN = [2714967881, 2238813396, 1250077441, 3820100336];
  let s = seedRng(123456789);
  const seq = [];
  for (let i = 0; i < GOLDEN.length; i++) { s = nextRng(s); seq.push(s); }
  assert.deepStrictEqual(seq, GOLDEN);
});

test('seedRng avoids the zero fixed point', () => {
  assert.notStrictEqual(seedRng(0), 0);
  assert.notStrictEqual(nextRng(seedRng(0)), 0);
});

test('rollRange returns values in [0, max) and threads state', () => {
  let s = seedRng(42);
  for (let i = 0; i < 100; i++) {
    const r = rollRange(s, 6);
    assert.ok(r.value >= 0 && r.value < 6);
    assert.notStrictEqual(r.rngState, s);
    s = r.rngState;
  }
});
