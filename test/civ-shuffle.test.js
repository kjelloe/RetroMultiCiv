// XIV §11: the random-civ pick was seed-parity biased — Fisher-Yates driven by
// a raw LCG (seed*1103515245+12345 mod 2^31) taking `% (i+1)` on the LOW bits,
// whose lowest bit alternates with period 2. shuffled[0] (the human's civ when
// none is picked) was grossly biased ("always Aztec"). shared/civ-shuffle.js
// drives the shuffle with the engine's xorshift32 instead. These pins assert
// determinism and a roughly-uniform first-slot distribution.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return (await import('../shared/civ-shuffle.js')).shuffleRoster; }

const ROSTER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'];

test('shuffleRoster: deterministic per seed + a permutation of the input', async () => {
  const shuffleRoster = await load();
  const a = shuffleRoster(ROSTER, 12345);
  const b = shuffleRoster(ROSTER, 12345);
  assert.deepStrictEqual(a, b, 'same seed → same lineup (URL reproducibility)');
  assert.deepStrictEqual(a.slice().sort(), ROSTER.slice().sort(), 'output is a permutation (no drops/dupes)');
  assert.notDeepStrictEqual(shuffleRoster(ROSTER, 1), shuffleRoster(ROSTER, 2), 'different seeds differ');
  assert.strictEqual(shuffleRoster([], 5).length, 0, 'empty roster is safe');
  assert.deepStrictEqual(shuffleRoster(['solo'], 9), ['solo'], 'single entry is safe');
});

test('shuffleRoster: first slot is NOT biased by seed parity (the old LCG bug)', async () => {
  const shuffleRoster = await load();
  // The old LCG made shuffled[0] depend on seed parity. Compare the first-slot
  // civ for even vs odd seeds: a biased picker clusters; xorshift does not.
  const evenFirst = {}, oddFirst = {};
  for (let s = 1; s <= 2000; s++) {
    const first = shuffleRoster(ROSTER, s)[0];
    const bucket = s % 2 === 0 ? evenFirst : oddFirst;
    bucket[first] = (bucket[first] || 0) + 1;
  }
  // every civ must appear as the first slot from BOTH parities (the LCG bug
  // made some civs impossible for one parity)
  for (const civ of ROSTER) {
    assert.ok(evenFirst[civ] > 0, `${civ} never led an even seed — parity bias`);
    assert.ok(oddFirst[civ] > 0, `${civ} never led an odd seed — parity bias`);
  }
});

test('shuffleRoster: first-slot distribution is roughly uniform (chi-square)', async () => {
  const shuffleRoster = await load();
  const N = 14000; // ~1000 per civ expected
  const counts = {};
  for (const c of ROSTER) counts[c] = 0;
  for (let s = 1; s <= N; s++) counts[shuffleRoster(ROSTER, s)[0]] += 1;
  const expected = N / ROSTER.length;
  let chi = 0;
  for (const c of ROSTER) chi += ((counts[c] - expected) ** 2) / expected;
  // 13 df, p=0.001 critical ≈ 34.5; a uniform generator sits well under it.
  // The old parity-biased LCG blew far past this.
  assert.ok(chi < 34.5, `first-slot distribution not uniform: chi-square ${chi.toFixed(1)} (df=13)`);
});
