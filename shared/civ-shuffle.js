// XIV §11: seed-reproducible civilization shuffle for game SETUP (client boot
// code — NOT engine game state). The old picker drove Fisher-Yates with a raw
// LCG (seed*1103515245+12345 mod 2^31) and took `% (i+1)` on the LOW bits; an
// LCG mod 2^31 has a period-2 lowest bit, so shuffled[0] (the human's civ when
// none is picked) was grossly biased by seed parity — the "always Aztec" start.
//
// Fix: drive the shuffle with the engine's xorshift32 (engine/rng.js algorithm,
// inlined — this is boot code, not the engine's stateful rng), whose full
// 32-bit output makes `% (i+1)` effectively uniform. Pure + deterministic, so
// the same seed still yields the same lineup and it unit-tests headless.
export function shuffleRoster(roster, seed) {
  let rng = Math.floor(Math.abs(seed)) % 4294967296;
  if (rng === 0) rng = 2463534242; // 0 is xorshift's fixed point (seedRng)
  const next = () => {
    let x = rng;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    rng = x;
    return x;
  };
  const out = roster.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}
