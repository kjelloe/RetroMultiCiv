// Canonical serialization + FNV-1a 32-bit hash of a game state.
// THE cross-language verification primitive: the Luau port must produce
// byte-identical canonical strings and therefore identical hashes.
// Written in the Lua-portable subset (docs/02-architecture.md §4):
// no bit-shift tricks that overflow doubles, no Map/Set, no classes.
//
// State value rules (enforced here, required for Lua parity):
// - numbers must be integers (floats drift across languages)
// - null/undefined are forbidden (JSON null becomes nil in Lua and vanishes)
// - strings must be printable ASCII (byte-level parity with Lua string.byte)
// - only plain objects, arrays, strings, integers, booleans

function idiv(a, b) {
  return Math.floor(a / b);
}

// (a * b) mod 2^32 without exceeding double precision.
// Lua: identical formula with math.floor.
function mul32(a, b) {
  const aHi = idiv(a, 65536) % 65536;
  const aLo = a % 65536;
  return (((aHi * b) % 65536) * 65536 + aLo * b) % 4294967296;
}

function canonical(value, out) {
  const kind = typeof value;
  if (kind === 'number') {
    if (!Number.isInteger(value)) throw new Error(`non-integer number in state: ${value}`);
    out.push(String(value));
  } else if (kind === 'string') {
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c < 32 || c > 126) throw new Error(`non-printable-ASCII char in state string: "${value}"`);
    }
    out.push('"' + value + '"');
  } else if (kind === 'boolean') {
    out.push(value ? 'true' : 'false');
  } else if (Array.isArray(value)) {
    out.push('[');
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out.push(',');
      canonical(value[i], out);
    }
    out.push(']');
  } else if (kind === 'object' && value !== null) {
    const keys = Object.keys(value).sort(); // lexicographic = Lua table.sort default
    out.push('{');
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) out.push(',');
      out.push('"' + keys[i] + '":');
      canonical(value[keys[i]], out);
    }
    out.push('}');
  } else {
    throw new Error(`forbidden value in state: ${String(value)}`);
  }
}

function canonicalize(state) {
  const out = [];
  canonical(state, out);
  return out.join('');
}

function hashState(state) {
  const s = canonicalize(state);
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    // >>> 0 undoes JS's signed-int32 coercion of ^ ; Luau's bit32.bxor is
    // already unsigned, so the Lua port is just bit32.bxor(hash, byte)
    hash = (hash ^ s.charCodeAt(i)) >>> 0;
    hash = mul32(hash, 16777619); // FNV prime
  }
  return '0x' + hash.toString(16).padStart(8, '0');
}

// #28 behavior-hash discriminator: the state hash EXCLUDING the rulesetHash STAMP — the
// BEHAVIORAL trajectory hash, independent of the ruleset stamp createGame writes into state
// (mapgen.js). When a golden hash moves, compare behaviorHash: UNCHANGED = a COSMETIC
// rulesetHash-stamp move (a data/rules.json knob added, behavior byte-identical — safe to re-pin
// without a behavior review); CHANGED = a REAL behavior change (needs the witness/review). Kills
// the misattribution class where a knob addition looks identical to a behavior change by the full
// hash (the seaPathRadius/holdPathPct re-records). Pure; a rulesetHash-less state falls through.
function behaviorHash(state) {
  if (state.rulesetHash === undefined) return hashState(state);
  const copy = {};
  for (const k in state) { if (k !== 'rulesetHash') copy[k] = state[k]; }
  return hashState(copy);
}

export { canonicalize, hashState, mul32, behaviorHash };
