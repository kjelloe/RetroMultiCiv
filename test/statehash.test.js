const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
// shared/ is ESM (browser + Node); load it once for all tests here
const shared = import('../shared/statehash.js');
let canonicalize, hashState, mul32, behaviorHash;
test.before(async () => { ({ canonicalize, hashState, mul32, behaviorHash } = await shared); });

test('canonicalize sorts keys and is order-independent', () => {
  assert.strictEqual(canonicalize({ b: 2, a: [1, 'x', true] }), '{"a":[1,"x",true],"b":2}');
  assert.strictEqual(
    hashState({ b: 2, a: [1, 'x', true] }),
    hashState({ a: [1, 'x', true], b: 2 })
  );
});

test('hashState golden value (cross-language parity anchor)', () => {
  // The Luau implementation MUST reproduce this exact value for this input.
  assert.strictEqual(hashState({ b: 2, a: [1, 'x', true] }), '0x30db1e29');
});

test('hashState rejects Lua-unsafe values', () => {
  assert.throws(() => hashState({ a: 1.5 }), /non-integer/);
  assert.throws(() => hashState({ a: null }), /forbidden/);
  assert.throws(() => hashState({ a: undefined }), /forbidden/);
  assert.throws(() => hashState({ a: 'æøå' }), /ASCII/);
});

test('mul32 stays exact at 32-bit boundaries (BigInt oracle)', () => {
  const oracle = (a, b) => Number((BigInt(a) * BigInt(b)) % 4294967296n);
  assert.strictEqual(mul32(4294967295, 16777619), oracle(4294967295, 16777619));
  assert.strictEqual(mul32(2166136261, 16777619), oracle(2166136261, 16777619));
  assert.strictEqual(mul32(84696351, 16777619), oracle(84696351, 16777619));
});

test('mock state is hashable (no null/floats) and stable', () => {
  const mock = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'client', 'mock-state.json'), 'utf8')
  );
  const h = hashState(mock);
  assert.match(h, /^0x[0-9a-f]{8}$/);
  assert.strictEqual(hashState(mock), h);
});

// #28 behavior-hash discriminator: behaviorHash excludes the rulesetHash STAMP, so a cosmetic
// stamp move (a rules.json knob added, behavior identical) is distinguishable from a real
// behavior change. Kills the misattribution class the seaPathRadius/holdPathPct re-records hit.
test('#28 behaviorHash: a rulesetHash-stamp-only change leaves behaviorHash unchanged; a real change moves both', () => {
  const base = { turn: 3, rulesetHash: '0xaaaaaaaa', units: { u1: { id: 'u1', x: 2, y: 2 } } };
  const stampOnly = { turn: 3, rulesetHash: '0xbbbbbbbb', units: { u1: { id: 'u1', x: 2, y: 2 } } };
  // the STAMP differs -> the full hash moves, but the behavior (trajectory) is identical.
  assert.notStrictEqual(hashState(base), hashState(stampOnly), 'full hash moves with the stamp');
  assert.strictEqual(behaviorHash(base), behaviorHash(stampOnly), 'behaviorHash ignores the stamp -> COSMETIC move');
  // a REAL behavior change (a unit moved) moves BOTH, even with the same stamp.
  const moved = { turn: 3, rulesetHash: '0xaaaaaaaa', units: { u1: { id: 'u1', x: 3, y: 2 } } };
  assert.notStrictEqual(hashState(base), hashState(moved), 'full hash moves with behavior');
  assert.notStrictEqual(behaviorHash(base), behaviorHash(moved), 'behaviorHash ALSO moves -> REAL behavior change');
  // a state without a rulesetHash stamp: behaviorHash === hashState (no-op fallthrough).
  const noStamp = { turn: 3, units: {} };
  assert.strictEqual(behaviorHash(noStamp), hashState(noStamp), 'no stamp -> behaviorHash == hashState');
});
