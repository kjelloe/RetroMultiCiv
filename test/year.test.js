// A21: the Civ-1-style variable year curve (data/rules.json yearSteps).
// Landmarks are counted in TURN WRAPS from 4000 BC — the exact table the
// item pins, and the phase-5 Luau port must reproduce the same walk.
const test = require('node:test');
const assert = require('node:assert');
const RULES = require('../data/rules.json');
const engine = import('../engine/index.js');
let nextYear;
test.before(async () => { ({ nextYear } = await engine); });

function yearAfter(wraps, rules) {
  let y = -4000;
  for (let i = 0; i < wraps; i++) y = nextYear(y, rules);
  return y;
}

test('year curve landmarks (data/rules.json yearSteps)', () => {
  assert.strictEqual(yearAfter(150, RULES), -1000, '150 wraps of 20yr reach 1000 BC');
  assert.strictEqual(yearAfter(200, RULES), 0, '50 more at 20yr reach the 1 AD boundary');
  assert.strictEqual(yearAfter(300, RULES), 1000, '100 at 10yr reach 1000 AD');
  assert.strictEqual(yearAfter(350, RULES), 1500, '50 more at 10yr reach 1500');
  assert.strictEqual(yearAfter(420, RULES), 1850, '70 at 5yr reach 1850');
  assert.strictEqual(yearAfter(545, RULES), 2100,
    '125 at 2yr reach the 2100 AD score end — turn 546 with a turn-1 start (Calendar-545)');
});

test('rulesets without yearSteps keep the old flat +20 (crafted-state stability)', () => {
  assert.strictEqual(nextYear(-4000, {}), -3980);
  assert.strictEqual(nextYear(1985, { yearSteps: undefined }), 2005);
});

test('past the last bracket the final step keeps applying (runaway guard)', () => {
  assert.strictEqual(nextYear(2100, RULES), 2102);
  assert.strictEqual(nextYear(5000, RULES), 5002);
});
