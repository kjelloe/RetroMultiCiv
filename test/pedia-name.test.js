// Refinement XX §1: the in-game reference's display name lives behind ONE
// constant (PEDIA_NAME), so the franchise term "Civilopedia" is gone from the UI
// and the final string is a one-line swap. Pure: constant + a source guard.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('pedia-name: PEDIA_NAME is a non-empty display string', async () => {
  const { PEDIA_NAME } = await import('../client/ui/pedia-name.js');
  assert.ok(typeof PEDIA_NAME === 'string' && PEDIA_NAME.length > 0, 'non-empty string');
});

test('pedia-name: no user-facing "Civilopedia" remains in the UI (rename behind the constant)', () => {
  // The franchise term must not appear in code/text; historical A58 mentions in
  // line COMMENTS are allowed (dropped before the check).
  const files = ['pedia.js', 'pedia-concepts.js', 'discovery-card.js', 'onboarding.js', 'dpad.js', 'options.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'ui', f), 'utf8');
    src.split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, ''); // strip a trailing line comment
      assert.ok(!/Civilopedia/i.test(code), `user-facing "Civilopedia" left in ${f}:${i + 1} → ${line.trim()}`);
    });
  }
});
