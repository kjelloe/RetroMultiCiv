// UNIT_BLURBS + BUILDING_BLURBS coverage gate (P2 / run-F #9, wired like the
// TECH_BLURBS gate): every entry names a REAL id, stays under the length cap,
// and is printable-ASCII (so the Roblox parity self-test can mirror the table
// byte-for-byte). Every BUILDABLE unit (the barb-only barbleader excluded) and
// every building must carry a blurb — a new one must ship with its line.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

const ASCII = /^[\x20-\x7E]*$/;

test('UNIT_BLURBS: valid buildable ids, capped ASCII length, full coverage', async () => {
  const { UNIT_BLURBS } = await import('../client/ui/unit-building-blurbs.js');
  const units = RULESET.units;
  const buildable = Object.keys(units).filter(id => units[id].barbOnly !== true);
  for (const [id, blurb] of Object.entries(UNIT_BLURBS)) {
    assert.ok(units[id], `blurb for unknown unit id "${id}"`);
    assert.notStrictEqual(units[id].barbOnly, true, `barb-only unit "${id}" must not have a blurb`);
    assert.strictEqual(typeof blurb, 'string');
    assert.ok(blurb.length > 0 && blurb.length <= 200, `"${id}": length ${blurb.length} outside (0, 200]`);
    assert.ok(ASCII.test(blurb), `"${id}": non-printable-ASCII in blurb`);
  }
  const missing = buildable.filter(id => UNIT_BLURBS[id] === undefined);
  assert.strictEqual(missing.length, 0, `${missing.length}/${buildable.length} buildable units lack a blurb: ${missing.join(', ')}`);
});

test('BUILDING_BLURBS: valid ids, capped ASCII length, full coverage', async () => {
  const { BUILDING_BLURBS } = await import('../client/ui/unit-building-blurbs.js');
  const ids = Object.keys(RULESET.buildings);
  for (const [id, blurb] of Object.entries(BUILDING_BLURBS)) {
    assert.ok(RULESET.buildings[id], `blurb for unknown building id "${id}"`);
    assert.strictEqual(typeof blurb, 'string');
    assert.ok(blurb.length > 0 && blurb.length <= 200, `"${id}": length ${blurb.length} outside (0, 200]`);
    assert.ok(ASCII.test(blurb), `"${id}": non-printable-ASCII in blurb`);
  }
  const missing = ids.filter(id => BUILDING_BLURBS[id] === undefined);
  assert.strictEqual(missing.length, 0, `${missing.length}/${ids.length} buildings lack a blurb: ${missing.join(', ')}`);
});
