// The TECH_BLURBS coverage gate (specs/tech-discovery-card.md): every entry
// must name a REAL tech id and stay under the length cap, AND every advance now
// has an authored line — the ally's 68 landed (#1711), so the missing set is a
// hard FAIL (a new tech must ship with its blurb).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

test('TECH_BLURBS: valid ids, capped length, and every advance is covered', async () => {
  const { TECH_BLURBS } = await import('../client/ui/tech-blurbs.js');
  const techIds = Object.keys(RULESET.techs);
  for (const [id, blurb] of Object.entries(TECH_BLURBS)) {
    assert.ok(techIds.includes(id), `blurb for unknown tech id "${id}"`);
    assert.strictEqual(typeof blurb, 'string');
    assert.ok(blurb.length > 0 && blurb.length <= 200,
      `"${id}": blurb length ${blurb.length} outside (0, 200]`);
  }
  const missing = techIds.filter(id => TECH_BLURBS[id] === undefined);
  assert.strictEqual(missing.length, 0,
    `${missing.length}/${techIds.length} advances lack a blurb: ${missing.join(', ')}`);
});
