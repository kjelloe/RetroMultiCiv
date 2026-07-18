// N11 unit upgrades (engine/upgrade.js): the data-driven upgradesTo consistency
// invariant and the applyUpgrade rules. The command + cost + rejections are
// pinned cross-language by scenarios 035-038; these are the JS-side unit rows.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/upgrade.js');
}

test('every upgradesTo target requires the same-or-later tech than its source (forward-upgrade, ruling A)', () => {
  // Reviewer ruling (A): the invariant is target-tech-level >= source-tech-level,
  // NOT >= the source's OBSOLETING tech. The funnel counter-example that proves
  // it: Civ2's own legion -> musketeers goes through gunpowder (level 6), which
  // PRECEDES legion's obsoletion at conscription (8) — yet gunpowder(6) is >=
  // legion's iron-working(2), a valid forward upgrade. The earlier "postdates
  // the obsoleting tech" wording would wrongly reject legion and cavalry.
  const lvl = t => (t && RULESET.techs[t] ? RULESET.techs[t].level : 0);
  let checked = 0;
  for (const [id, def] of Object.entries(RULESET.units)) {
    if (def.upgradesTo === undefined) continue;
    checked++;
    const tgt = RULESET.units[def.upgradesTo];
    assert.ok(tgt !== undefined, `${id}: upgradesTo '${def.upgradesTo}' is not a real unit`);
    assert.ok(lvl(tgt.tech) >= lvl(def.tech),
      `${id}(${def.tech || '-'}=${lvl(def.tech)}) -> ${def.upgradesTo}(${tgt.tech || '-'}=${lvl(tgt.tech)}): target must need the same or a later tech`);
  }
  assert.strictEqual(checked, 12, 'the twelve N11 upgrade chains are present');
});

test('applyUpgrade: moves = min(remaining, new type moves); veteran per keepVeteran; no hp reset (none exists)', async () => {
  const up = await load();
  // a SPENT unit (moves 0) keeps 0 — the pay-to-move exploit is closed (R2)
  const st = { units: { u: { id: 'u', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 0, veteran: true } } };
  const from = up.applyUpgrade(st, st.units.u, RULESET, true);
  assert.strictEqual(from, 'militia');
  assert.strictEqual(st.units.u.type, 'musketeers');
  assert.strictEqual(st.units.u.moves, 0, 'spent moves are not refunded');
  assert.strictEqual(st.units.u.veteran, true, 'the PAID (3a) upgrade carries veteran');
  // a unit with more remaining than the new type is clamped down; free (3b) drops veteran
  const st2 = { units: { u: { id: 'u', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 5, veteran: true } } };
  up.applyUpgrade(st2, st2.units.u, RULESET, false);
  assert.strictEqual(st2.units.u.moves, RULESET.units.musketeers.moves, 'moves clamped to the new type');
  assert.strictEqual(st2.units.u.veteran, false, 'the FREE (Leonardo/3b) upgrade drops veteran');
});

test('upgradeCost: baseGold + goldPerShield * max(0, costNew - costOld); null when no successor', async () => {
  const up = await load();
  const r = RULESET.rules.upgrade;
  const expect = r.baseGold + r.goldPerShield * Math.max(0, RULESET.units.musketeers.cost - RULESET.units.militia.cost);
  assert.strictEqual(up.upgradeCost({ type: 'militia' }, RULESET), expect);
  assert.strictEqual(up.upgradeCost({ type: 'settlers' }, RULESET), null, 'no upgradesTo -> null');
});
