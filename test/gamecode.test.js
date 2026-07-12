const test = require('node:test');
const assert = require('node:assert');
// shared/ is ESM (browser + Node); load it once for all tests here.
const gc = import('../shared/gamecode.js');
const sh = import('../shared/statehash.js');
let gameCode, gameCodeRaw, formatGameCode, fnv32, base32crockford;
let canonicalize, hashState;
test.before(async () => {
  ({ gameCode, gameCodeRaw, formatGameCode, fnv32, base32crockford } = await gc);
  ({ canonicalize, hashState } = await sh);
});

// The statehash cross-language anchor, reused so the two digests share an input.
const ANCHOR = { b: 2, a: [1, 'x', true] };

// Independent 64-bit base-32 oracle (BigInt) — trusted reference the integer-only
// long division in gamecode.js must match. Tests may use BigInt; the engine can't.
function oracleBase32(hi, lo) {
  let n = (BigInt(hi) << 32n) + BigInt(lo);
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let d = 0; d < 13; d++) { s = A[Number(n % 32n)] + s; n = n / 32n; }
  return s;
}

test('codeLo IS the statehash (shares the existing anchor)', () => {
  const lo = fnv32(canonicalize(ANCHOR), false);
  assert.strictEqual('0x' + lo.toString(16).padStart(8, '0'), hashState(ANCHOR));
  assert.strictEqual(hashState(ANCHOR), '0x30db1e29'); // and that anchor is unchanged
});

test('game code golden vectors (cross-language phase-5 anchors)', () => {
  // The Luau implementation MUST reproduce these exact values for this input.
  const canon = canonicalize(ANCHOR);
  assert.strictEqual('0x' + fnv32(canon, false).toString(16).padStart(8, '0'), '0x30db1e29'); // codeLo
  assert.strictEqual('0x' + fnv32(canon, true).toString(16).padStart(8, '0'), '0xa687b72d');  // codeHi
  assert.strictEqual(gameCodeRaw(ANCHOR), 'AD1XQ5MRDP7H9');
  assert.strictEqual(gameCode(ANCHOR), 'AD1X-Q5MR-DP7H9');
  assert.strictEqual(formatGameCode('AD1XQ5MRDP7H9'), 'AD1X-Q5MR-DP7H9');
});

test('codeHi = FNV over the REVERSED canon (reverse iteration, standard constants)', () => {
  const reverse = s => s.split('').reverse().join('');
  for (const s of ['hello', 'AD1X', '{"a":[1,"x",true],"b":2}', '', 'z']) {
    assert.strictEqual(fnv32(s, true), fnv32(reverse(s), false));
  }
  // a non-palindrome canon really does diverge (the independence the code needs)
  const canon = canonicalize(ANCHOR);
  assert.notStrictEqual(fnv32(canon, true), fnv32(canon, false));
});

test('base32crockford matches the BigInt oracle across the 64-bit range', () => {
  const cases = [
    [0, 0], [0, 1], [0, 31], [0, 32], [1, 0], [31, 4294967295],
    [4294967295, 4294967295], [2166136261, 819453481], [0xa687b72d, 0x30db1e29]
  ];
  for (const [hi, lo] of cases) {
    assert.strictEqual(base32crockford(hi, lo), oracleBase32(hi, lo), `hi=${hi} lo=${lo}`);
  }
  // always exactly 13 chars, Crockford alphabet only (no I/L/O/U)
  assert.strictEqual(base32crockford(0, 0), '0000000000000');
  assert.strictEqual(base32crockford(4294967295, 4294967295), 'FZZZZZZZZZZZZ');
  assert.match(gameCodeRaw(ANCHOR), /^[0-9A-HJKMNP-TV-Z]{13}$/);
});

test('the code is deterministic across a JSON round-trip', () => {
  const code = gameCode(ANCHOR);
  assert.strictEqual(gameCode(JSON.parse(JSON.stringify(ANCHOR))), code);
  // key order does not matter (canonicalize sorts)
  assert.strictEqual(gameCode({ a: [1, 'x', true], b: 2 }), code);
});

test('the code is tamper-evident: any state change moves it', () => {
  const base = { rngState: 12345, players: { p1: { gold: 50 } } };
  const code = gameCode(base);
  assert.notStrictEqual(gameCode({ rngState: 12346, players: { p1: { gold: 50 } } }), code); // grind rngState
  assert.notStrictEqual(gameCode({ rngState: 12345, players: { p1: { gold: 51 } } }), code); // edit gold
});

test('gamecode inherits statehash Lua-safety (rejects floats/null/non-ASCII)', () => {
  assert.throws(() => gameCode({ a: 1.5 }), /non-integer/);
  assert.throws(() => gameCode({ a: null }), /forbidden/);
  assert.throws(() => gameCode({ a: 'æ' }), /ASCII/);
});
