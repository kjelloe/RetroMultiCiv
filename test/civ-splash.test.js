// Refinement XX §2: the game-start civ splash describes the leader via A59
// personality → a stance phrase. Guard that EVERY civ's personality resolves to a
// stance the splash's phrase map covers (aggressive/science/growth/defensive/
// balanced), so the splash never falls to a blank descriptor. Pure engine read.
const { test } = require('node:test');
const assert = require('node:assert');

test('civ-splash: every civ personality maps to a known leader stance', async () => {
  const { stanceFromPersonality } = await import('../engine/leaders.js');
  const raw = require('../data/civs.json');
  const civs = raw.civs || raw;
  // the five stances the splash's LEADER_STANCE_PHRASE map covers (discovery-card.js)
  const KNOWN = new Set(['aggressive', 'science', 'growth', 'defensive', 'balanced']);
  let checked = 0;
  for (const [id, civ] of Object.entries(civs)) {
    if (!civ || !civ.personality) continue;
    const stance = stanceFromPersonality(civ.personality);
    assert.ok(KNOWN.has(stance), `${id}: stance "${stance}" has no splash phrase`);
    checked += 1;
  }
  assert.ok(checked >= 10, `expected the full civ roster, checked ${checked}`);
});
