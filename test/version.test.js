// §30: the envelope version stamp (shared/version.js) — pure, DOM-free.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../shared/version.js'); }

test('GAME_VERSION is a semver x.y.z string', async () => {
  const { GAME_VERSION } = await load();
  assert.match(GAME_VERSION, /^\d+\.\d+\.\d+$/);
});

test('majorOf parses the leading integer; null when absent/unparseable', async () => {
  const { majorOf } = await load();
  assert.strictEqual(majorOf('1.0.0'), 1);
  assert.strictEqual(majorOf('2.3.4'), 2);
  assert.strictEqual(majorOf('10.0.0'), 10);
  assert.strictEqual(majorOf(undefined), null);
  assert.strictEqual(majorOf(''), null);
  assert.strictEqual(majorOf('vX'), null);
});

test('versionMismatch: same major loads; different major refuses; legacy exempt', async () => {
  const { versionMismatch } = await load();
  assert.strictEqual(versionMismatch('1.0.0', '1.5.2'), null, 'same major → load');
  assert.strictEqual(versionMismatch(undefined, '1.0.0'), null, 'version-less save → load (forward-compat)');
  assert.strictEqual(versionMismatch('1.9.9'), null, 'against the current major (1) → load');
  const msg = versionMismatch('2.0.0', '1.0.0');
  assert.match(msg, /2\.x/, 'a 2.x save names its major');
  assert.match(msg, /1\.x/, 'and the running build major');
  assert.ok(versionMismatch('0.9.0', '1.0.0'), 'an older major is also refused');
});
