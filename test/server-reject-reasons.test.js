// reject-reasons-export (regression-guard 1, ruled #2523): REJECT_REASONS is
// the ONE registry of server-layer reject `code` strings. This guards the
// invariant (frozen, value===key, key wire codes present); the helper builds
// the CLIENT-superset contract test against the same export.
const test = require('node:test');
const assert = require('node:assert');

test('REJECT_REASONS is a frozen registry whose every value equals its key', async () => {
  const { REJECT_REASONS } = await import('../server/protocol.js');
  assert.ok(REJECT_REASONS && typeof REJECT_REASONS === 'object');
  assert.strictEqual(Object.isFrozen(REJECT_REASONS), true, 'the contract must not be mutable at runtime');
  for (const k of Object.keys(REJECT_REASONS)) {
    assert.strictEqual(REJECT_REASONS[k], k, `value must equal key (the wire string) for ${k}`);
    assert.strictEqual(typeof k, 'string');
    assert.ok(k.length > 0);
  }
});

test('REJECT_REASONS covers the wire codes referenced across the server layer', async () => {
  const { REJECT_REASONS } = await import('../server/protocol.js');
  // a spot-set spanning every origin group (protocol/limits/index/lobby-forwarded)
  const required = ['badShape', 'badToken', 'unknownType', 'rateLimited', 'serverFull',
    'joiningClosed', 'notCreator', 'noSuchGame', 'noSeatAvailable', 'gameFull',
    'seatReserved', 'notReclaimable', 'spectatorsOff', 'codeRequired'];
  for (const r of required) assert.ok(r in REJECT_REASONS, `registry is missing ${r}`);
});
