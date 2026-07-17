// The TECH_BLURBS coverage gate (specs/tech-discovery-card.md): every entry
// must name a REAL tech id and stay under the length cap (both FAIL); the
// missing set only WARNS while the ally's 68 authored lines are filling in —
// flip the warn to an assert when coverage completes.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

test('TECH_BLURBS: valid ids, capped length; missing coverage warns', async () => {
  const { TECH_BLURBS } = await import('../client/ui/tech-blurbs.js');
  const techIds = Object.keys(RULESET.techs);
  for (const [id, blurb] of Object.entries(TECH_BLURBS)) {
    assert.ok(techIds.includes(id), `blurb for unknown tech id "${id}"`);
    assert.strictEqual(typeof blurb, 'string');
    assert.ok(blurb.length > 0 && blurb.length <= 200,
      `"${id}": blurb length ${blurb.length} outside (0, 200]`);
  }
  const missing = techIds.filter(id => TECH_BLURBS[id] === undefined);
  if (missing.length > 0) {
    console.warn(`tech-blurbs: ${missing.length}/${techIds.length} advances await their `
      + `authored line (warn-not-fail while the ally's table fills)`);
  }
});
