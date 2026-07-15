// A56(a): the pure helpers behind the fast-forward interstitial
// (client/ui/ff-overlay.js) — era-name-for-turn and BC/AD year formatting.
// The DOM overlay itself is screenshot-verified; these are the Node-testable
// bits that drive what it shows.
const test = require('node:test');
const assert = require('node:assert');

const mod = import('../client/ui/ff-overlay.js');
let eraNameForTurn, formatYear;
test.before(async () => { ({ eraNameForTurn, formatYear } = await mod); });

// ages are turn-keyed, ascending — the shape data/rules.json carries
const AGES = [
  { id: 'ancient', name: 'Ancient', turn: 0 },
  { id: 'renaissance', name: 'Renaissance', turn: 190 },
  { id: 'industrial', name: 'Industrial', turn: 256 },
  { id: 'modern', name: 'Modern', turn: 305 }
];

test('eraNameForTurn returns the highest age whose turn threshold is reached', () => {
  assert.strictEqual(eraNameForTurn(AGES, 0), 'Ancient');
  assert.strictEqual(eraNameForTurn(AGES, 100), 'Ancient');   // before Renaissance
  assert.strictEqual(eraNameForTurn(AGES, 190), 'Renaissance'); // exactly on the boundary
  assert.strictEqual(eraNameForTurn(AGES, 260), 'Industrial');
  assert.strictEqual(eraNameForTurn(AGES, 5000), 'Modern');    // past the last age
});

test('eraNameForTurn is empty when nothing is reached or no ages given', () => {
  assert.strictEqual(eraNameForTurn([{ id: 'x', name: 'X', turn: 10 }], 0), '');
  assert.strictEqual(eraNameForTurn([], 100), '');
  assert.strictEqual(eraNameForTurn(undefined, 100), '');
});

test('formatYear renders BC for negative years, AD otherwise', () => {
  assert.strictEqual(formatYear(-4000), '4000 BC');
  assert.strictEqual(formatYear(-1), '1 BC');
  assert.strictEqual(formatYear(1), '1 AD');
  assert.strictEqual(formatYear(2100), '2100 AD');
});
