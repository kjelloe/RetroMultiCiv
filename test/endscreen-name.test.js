// XV §12: the endscreen must NEVER print "the undefined had built…" — the
// fog-filtered ?server=1 view omits state.winner, and a rival stub can lack a
// name. winnerLabel resolves name → id → a safe generic, never undefined.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/endscreen.js'); }

test('winnerLabel: names the winner when the name is present', async () => {
  const { winnerLabel } = await load();
  assert.strictEqual(winnerLabel({ p1: { name: 'Chinese' } }, 'p1'), 'Chinese');
});

test('winnerLabel: falls back to the id when the stub lacks a name', async () => {
  const { winnerLabel } = await load();
  assert.strictEqual(winnerLabel({ p1: {} }, 'p1'), 'p1', 'a rival stub without a name → the id, not undefined');
});

test('winnerLabel: a missing/undefined winner never yields undefined', async () => {
  const { winnerLabel } = await load();
  assert.strictEqual(winnerLabel({ p1: { name: 'Chinese' } }, undefined), 'leading civilization',
    'no winner id (fog view lacks state.winner) → the safe generic');
  assert.strictEqual(winnerLabel(undefined, undefined), 'leading civilization');
  assert.strictEqual(winnerLabel({}, 'p2'), 'p2', 'unknown id but present → the id, not undefined');
  // the reported bug: the headline must never contain the literal "undefined"
  for (const label of [winnerLabel({ p1: {} }, undefined), winnerLabel(null, null)]) {
    assert.ok(!/undefined/.test(String(label)), `label "${label}" must not read "undefined"`);
  }
});
