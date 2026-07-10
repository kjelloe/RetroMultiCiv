// Deterministic PRNG: xorshift32 with the state living in the game state.
// The Luau port must be bit-identical: JS `(x ^ (x << n)) >>> 0` maps to
// `bit32.bxor(x, bit32.lshift(x, n))` (bit32 ops already truncate to 32 bits).
// Never use Math.random() (or math.random()) anywhere in the engine.

// 0 is a fixed point of xorshift; map any seed onto [1, 2^32).
function seedRng(seed) {
  const s = Math.floor(Math.abs(seed)) % 4294967296;
  return s === 0 ? 2463534242 : s;
}

function nextRng(rngState) {
  let x = rngState;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  return x;
}

// Roll an integer in [0, maxExclusive). Returns the new rng state and the
// value; the caller stores rngState back into the game state.
function rollRange(rngState, maxExclusive) {
  const next = nextRng(rngState);
  return { rngState: next, value: next % maxExclusive };
}

export { seedRng, nextRng, rollRange };
