// A78: the pure first-timer-advice gate (client/ui/advice-gate.js). DOM-free.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/advice-gate.js'); }

test('advice shows once per id when enabled for a human player', async () => {
  const { adviceGate } = await load();
  const seen = {};
  assert.strictEqual(adviceGate('settler', seen, true, false), true, 'unseen → shows');
  seen.settler = true;
  assert.strictEqual(adviceGate('settler', seen, true, false), false, 'seen → suppressed');
  assert.strictEqual(adviceGate('city-view', seen, true, false), true, 'a different id still shows');
});

test('advice is suppressed for bots, when disabled, and for empty ids', async () => {
  const { adviceGate } = await load();
  assert.strictEqual(adviceGate('settler', {}, true, true), false, 'webdriver/e2e never sees advice');
  assert.strictEqual(adviceGate('settler', {}, false, false), false, 'tips turned off in ⚙');
  assert.strictEqual(adviceGate('', {}, true, false), false, 'empty id');
  assert.strictEqual(adviceGate(undefined, {}, true, false), false, 'non-string id');
});

test('SEEN_KEY is a stable localStorage key', async () => {
  const { SEEN_KEY } = await load();
  assert.strictEqual(SEEN_KEY, 'retromulticiv-advice-seen');
});
