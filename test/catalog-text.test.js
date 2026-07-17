const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() { return import('../client/ui/catalog-text.js'); }

test('effectText renders structured effect fields to human strings', async () => {
  const { makeCatalogText } = await load();
  const { effectText } = makeCatalogText(RULESET);
  assert.strictEqual(effectText({ effect: { defenseMultiplier: 3 } }), 'defenders ×3 against attacks');
  assert.strictEqual(effectText({ effect: { taxBonus: 50 } }), '+50% gold in this city');
  assert.strictEqual(effectText({ effect: { contentBonus: 1 } }), 'calms 1 unhappy citizen');
  assert.strictEqual(effectText({ effect: { contentBonus: 2 } }), 'calms 2 unhappy citizens', 'plural');
  assert.strictEqual(effectText({ effect: { isPalace: true } }), 'your capital — no corruption at the seat of power');
  // multiple effects join with " · "
  assert.strictEqual(effectText({ effect: { defenseMultiplier: 2, taxBonus: 25 } }), 'defenders ×2 against attacks · +25% gold in this city');
  // unknown keys are skipped; no effect → empty
  assert.strictEqual(effectText({ effect: { madeUpKey: 9 } }), '');
  assert.strictEqual(effectText({}), '');
});

test('effectText appends obsoleteBy with the tech name', async () => {
  const { makeCatalogText } = await load();
  const { effectText } = makeCatalogText(RULESET);
  const techId = Object.keys(RULESET.techs)[0];
  assert.strictEqual(
    effectText({ effect: {}, obsoleteBy: techId }),
    `obsolete with ${RULESET.techs[techId].name}`
  );
});

test('contentDoubleTech names the doubling tech from the ruleset', async () => {
  const { makeCatalogText } = await load();
  const { effectText } = makeCatalogText(RULESET);
  const techId = Object.keys(RULESET.techs)[0];
  assert.strictEqual(effectText({ effect: { contentDoubleTech: techId } }),
    `doubled once you know ${RULESET.techs[techId].name}`);
});

test('techUnlocks / techLeadsTo cross-link maps are built from the rulesets', async () => {
  const { makeCatalogText } = await load();
  const { techUnlocks, techLeadsTo } = makeCatalogText(RULESET);
  // some unit with a tech appears under that tech's unlocks
  const unitWithTech = Object.keys(RULESET.units).map(id => RULESET.units[id]).find(u => u.tech !== '');
  assert.ok(unitWithTech, 'the ruleset has a tech-gated unit');
  assert.ok((techUnlocks[unitWithTech.tech] || []).includes(unitWithTech.name),
    'the unit is listed under its tech');
  // wonders carry the 🏆 marker in the unlocks list
  const wonderWithTech = Object.keys(RULESET.wonders).map(id => RULESET.wonders[id]).find(w => w.tech !== '');
  if (wonderWithTech) {
    assert.ok((techUnlocks[wonderWithTech.tech] || []).includes(wonderWithTech.name + ' 🏆'), 'wonder marked 🏆');
  }
  // a tech with prereqs leads-to from each prereq
  const child = Object.keys(RULESET.techs).map(id => RULESET.techs[id]).find(t => t.prereqs.length > 0);
  if (child) {
    assert.ok((techLeadsTo[child.prereqs[0]] || []).includes(child.name), 'prereq leads to the child tech');
  }
});
