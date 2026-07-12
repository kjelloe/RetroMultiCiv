// Game verification code (docs/07-game-code.md): a 64-bit digest of the
// canonical game state, shown as 13 Crockford-base32 characters so players can
// verify a save was not edited between sessions. Built only from machinery we
// already trust (shared/statehash.js) and only integer math — the Luau port
// reimplements it for identical codes, and its golden vectors are phase-5
// cross-engine anchors like statehash's `0x30db1e29`.
//
//   canon  = canonicalize(state)              // shared/statehash.js, unchanged
//   codeLo = FNV-1a-32(canon)                 // identical to hashState (the anchor)
//   codeHi = FNV-1a-32(canon REVERSED)        // same STANDARD basis/prime, last
//                                             // char to first — a genuinely
//                                             // different function, no invented
//                                             // constants (docs/07 §1/§2)
//   code   = base32crockford(codeHi * 2^32 + codeLo)   // 64-bit, two 32-bit limbs
//
// Written in the Lua-portable subset (docs/02-architecture.md §4): no floats,
// no 64-bit values held as doubles, no Map/Set/classes.
import { canonicalize, mul32 } from './statehash.js';

const FNV_OFFSET = 2166136261; // FNV offset basis
const FNV_PRIME = 16777619;    // FNV prime
// Crockford base32 — omits I, L, O, U so the code is unambiguous aloud/on paper.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function idiv(a, b) {
  return Math.floor(a / b);
}

// FNV-1a-32 over a string; reversed = iterate last char to first. The forward
// pass is byte-identical to statehash.hashState, so fnv32(canon, false) equals
// that state's stored hash (codeLo). Lua: bit32.bxor + the same mul32.
function fnv32(s, reversed) {
  let hash = FNV_OFFSET;
  for (let k = 0; k < s.length; k++) {
    const i = reversed ? s.length - 1 - k : k;
    hash = (hash ^ s.charCodeAt(i)) >>> 0; // >>> 0 undoes JS signed-int32 ^
    hash = mul32(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

// Render (hi * 2^32 + lo), both 32-bit, as 13 Crockford-base32 chars, most
// significant first. Long-division by 32 across the two limbs so the 64-bit
// value is never formed as a float: at each step
//   combined = (hi mod 32) * 2^32 + lo   (<= 31*2^32 + 2^32 < 2^53 — exact)
// carries the hi remainder into the low limb; the base-32 digit is
// combined mod 32 and the quotient limbs are idiv(hi,32), idiv(combined,32).
function base32crockford(hi, lo) {
  const digits = [];
  for (let d = 0; d < 13; d++) {
    const combined = (hi % 32) * 4294967296 + lo;
    hi = idiv(hi, 32);
    lo = idiv(combined, 32);
    digits.push(CROCKFORD.charAt(combined % 32));
  }
  let out = '';
  for (let d = 12; d >= 0; d--) out += digits[d];
  return out;
}

// The raw 13-char code (no separators) — the canonical form to store/compare.
function gameCodeRaw(state) {
  const canon = canonicalize(state);
  return base32crockford(fnv32(canon, true), fnv32(canon, false));
}

// Grouped for display / reading aloud: XXXX-XXXX-XXXXX (docs/07 §1).
function formatGameCode(raw) {
  return raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8);
}

// The player-facing code, grouped.
function gameCode(state) {
  return formatGameCode(gameCodeRaw(state));
}

export { gameCode, gameCodeRaw, formatGameCode, fnv32, base32crockford };
