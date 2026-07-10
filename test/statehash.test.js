const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { canonicalize, hashState, mul32 } = require('../shared/statehash.js');

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
