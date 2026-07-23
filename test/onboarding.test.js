// The onboarding overlay is one-time per browser+screen via the
// `rmc_onboarding_seen` localStorage flag. The rendering needs a DOM (covered by
// browser.test.js), but the gating logic is pure localStorage — guard it here so
// CI without a headless browser still catches a regression in the once-only rule.
const test = require('node:test');
const assert = require('node:assert');

function withStore(seed) {
  const store = Object.assign({}, seed);
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  return store;
}

test('hasSeenOnboarding: false when unset, true once the per-screen flag is set', async () => {
  withStore({});
  const { hasSeenOnboarding } = await import('../client/ui/onboarding.js');
  assert.strictEqual(hasSeenOnboarding('setup'), false, 'unseen on a fresh profile');
  assert.strictEqual(hasSeenOnboarding('game'), false);
});

test('hasSeenOnboarding: per-screen — setup seen does not suppress game', async () => {
  withStore({ rmc_onboarding_seen: JSON.stringify({ setup: true }) });
  const { hasSeenOnboarding } = await import('../client/ui/onboarding.js');
  assert.strictEqual(hasSeenOnboarding('setup'), true, 'setup marked → seen');
  assert.strictEqual(hasSeenOnboarding('game'), false, 'game screen is independent');
});

test('hasSeenOnboarding: a corrupt flag falls back to unseen (never throws)', async () => {
  withStore({ rmc_onboarding_seen: '{not json' });
  const { hasSeenOnboarding } = await import('../client/ui/onboarding.js');
  assert.strictEqual(hasSeenOnboarding('setup'), false);
});

test('REGENCY_HELP is a single shared non-empty string (onboarding caption == button tooltip)', async () => {
  const { REGENCY_HELP } = await import('../client/ui/onboarding.js');
  assert.strictEqual(typeof REGENCY_HELP, 'string');
  assert.match(REGENCY_HELP, /AI plays your turns/);
});
