// A75: worldAge(state, ruleset) — the world's current age is DERIVED (never
// stored): the highest TECH ERA reached by >= worldAgeThreshold% of ALIVE civs,
// where "reached era i" = knows >=1 tech whose era index >= i (cumulative-
// upward). Ranges over the four tech eras only (Space Age is not a tech era).
// Pure read → the ageChanged event it drives is transient, goldens untouched
// (proven by simulation.test.js staying green).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let worldAge;
test.before(async () => { ({ worldAge } = await import('../engine/index.js')); });

// pick a real tech id per era from the loaded ruleset
function techOf(era) {
  for (const id of Object.keys(RULESET.techs)) if (RULESET.techs[id].era === era) return id;
  throw new Error(`no tech in era ${era}`);
}
function state(players) {
  return { playerOrder: Object.keys(players), players };
}
const civ = (alive, techs) => ({ alive, techs });

test('the floor is ancient; a lone advanced civ does not move the world', () => {
  const anc = techOf('ancient'), ren = techOf('renaissance');
  assert.strictEqual(worldAge(state({
    a: civ(true, [anc]), b: civ(true, [anc]), c: civ(true, [anc]), d: civ(true, [anc])
  }), RULESET), 'ancient');
  // 1 of 4 = 25% < 30% threshold → still ancient
  assert.strictEqual(worldAge(state({
    a: civ(true, [ren]), b: civ(true, [anc]), c: civ(true, [anc]), d: civ(true, [anc])
  }), RULESET), 'ancient');
});

test('the threshold: >=30% of alive civs entering an era advances the world', () => {
  const anc = techOf('ancient'), ren = techOf('renaissance');
  // 2 of 4 = 50% >= 30% → renaissance
  assert.strictEqual(worldAge(state({
    a: civ(true, [ren]), b: civ(true, [ren]), c: civ(true, [anc]), d: civ(true, [anc])
  }), RULESET), 'renaissance');
});

test('cumulative-upward: a beeliner into modern counts as modern-reached', () => {
  const anc = techOf('ancient'), mod = techOf('modern');
  // 2 of 4 know a MODERN tech (having skipped renaissance/industrial techs)
  assert.strictEqual(worldAge(state({
    a: civ(true, [anc, mod]), b: civ(true, [anc, mod]), c: civ(true, [anc]), d: civ(true, [anc])
  }), RULESET), 'modern');
});

test('dead civs do not count toward the alive-civ denominator', () => {
  const anc = techOf('ancient'), ind = techOf('industrial');
  // 2 alive, both industrial (100%); 2 dead ancients are ignored → industrial
  assert.strictEqual(worldAge(state({
    a: civ(true, [ind]), b: civ(true, [ind]), c: civ(false, [anc]), d: civ(false, [anc])
  }), RULESET), 'industrial');
});

test('the Space Age is NOT a worldAge — the ceiling is modern', () => {
  const mod = techOf('modern');
  // every civ maxed on modern techs → modern is the highest derivable age
  assert.strictEqual(worldAge(state({
    a: civ(true, [mod]), b: civ(true, [mod]), c: civ(true, [mod]), d: civ(true, [mod])
  }), RULESET), 'modern');
  // 'space' is a rules.ages entry but has no tech era, so it never appears
  const ages = RULESET.rules.ages.map(a => a.id);
  assert.ok(ages.includes('space'), 'space is a starting-age option');
});
