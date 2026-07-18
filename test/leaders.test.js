// A59 leader personality (spec a59-leader-personality.md): the build guard (axes
// sum to 100 — integer-100 per ruling #1657, floats break statehash) + the read
// seam (personalityOf / stanceFromPersonality / favoriteModifier-no-op).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let personalityOf, stanceFromPersonality, favoriteModifier, STANCE_AXES;
test('load', async () => {
  ({ personalityOf, stanceFromPersonality, favoriteModifier, STANCE_AXES } = await import('../engine/leaders.js'));
});

test('build guard: every leader personality is 4 INTEGER axes summing to 100', () => {
  for (const id of Object.keys(RULESET.civs)) {
    const p = RULESET.civs[id].personality;
    assert.ok(p, `civ ${id} has no personality`);
    for (const axis of ['aggression', 'science', 'growth', 'defense']) {
      assert.ok(Number.isInteger(p[axis]), `${id}.${axis} must be an integer (floats break statehash), got ${p[axis]}`);
    }
    const sum = p.aggression + p.science + p.growth + p.defense;
    assert.strictEqual(sum, 100, `${id} personality must sum to 100, got ${sum}`);
  }
  // and the STANCE_AXES fallbacks also sum to 100
  for (const s of Object.keys(STANCE_AXES)) {
    const a = STANCE_AXES[s];
    assert.strictEqual(a.aggression + a.science + a.growth + a.defense, 100, `STANCE_AXES.${s} must sum to 100`);
  }
});

test('every leader has a name + a valid favoriteWonder (or "" none); Caesar carries the sourced favoriteUnit/beeline', () => {
  for (const id of Object.keys(RULESET.civs)) {
    const civ = RULESET.civs[id];
    assert.ok(typeof civ.leader === 'string' && civ.leader.length > 0, `civ ${id} needs a leader name`);
    assert.strictEqual(typeof civ.favoriteWonder, 'string', `${id} favoriteWonder must be a string`);
    if (civ.favoriteWonder !== '') {
      assert.ok(RULESET.wonders[civ.favoriteWonder], `${id} favoriteWonder "${civ.favoriteWonder}" is not a real wonder id`);
    }
    if (civ.favoriteUnit !== undefined) assert.ok(RULESET.units[civ.favoriteUnit], `${id} favoriteUnit "${civ.favoriteUnit}" is not a real unit`);
    if (civ.beelineTechs !== undefined) {
      for (const t of civ.beelineTechs) assert.ok(RULESET.techs[t], `${id} beelineTech "${t}" is not a real tech id`);
    }
  }
  assert.strictEqual(RULESET.civs.romans.favoriteUnit, 'legion');
  assert.deepStrictEqual(RULESET.civs.romans.beelineTechs, ['iron-working', 'conscription']);
  assert.strictEqual(RULESET.civs.zulus.favoriteWonder, '', 'Shaka builds no wonder (none)');
  assert.strictEqual(RULESET.civs.mongols.favoriteWonder, '', 'Genghis builds no wonder (none)');
});

function pstate(pid, over) {
  return { players: { [pid]: Object.assign({ id: pid, name: 'X' }, over || {}) } };
}

test('personalityOf: the civ axes when present; the stance fallback when stanceless (absent = today)', () => {
  assert.deepStrictEqual(personalityOf(pstate('p1', { civ: 'romans' }), 'p1', RULESET), RULESET.civs.romans.personality);
  // no civ, a stance -> the stance's implied axes
  assert.deepStrictEqual(personalityOf(pstate('p1', { stance: 'aggressive' }), 'p1', RULESET), STANCE_AXES.aggressive);
  // no civ, no stance -> balanced (crafted states reproduce today)
  assert.deepStrictEqual(personalityOf(pstate('p1', {}), 'p1', RULESET), STANCE_AXES.balanced);
});

test('stanceFromPersonality: dominant axis -> stance; a flat personality -> balanced', () => {
  assert.strictEqual(stanceFromPersonality({ aggression: 75, science: 10, growth: 10, defense: 5 }), 'aggressive');
  assert.strictEqual(stanceFromPersonality({ aggression: 10, science: 70, growth: 15, defense: 5 }), 'science');
  assert.strictEqual(stanceFromPersonality({ aggression: 5, science: 10, growth: 70, defense: 15 }), 'growth');
  assert.strictEqual(stanceFromPersonality({ aggression: 10, science: 10, growth: 10, defense: 70 }), 'defensive');
  // Lincoln: all four equal -> no dominant axis -> balanced (ruling #1657)
  assert.strictEqual(stanceFromPersonality({ aggression: 25, science: 25, growth: 25, defense: 25 }), 'balanced');
  // a PARTIAL tie for the max breaks by the fixed axis order (aggression first)
  assert.strictEqual(stanceFromPersonality({ aggression: 40, science: 40, growth: 10, defense: 10 }), 'aggressive');
  // every real leader's derived label matches the ruling table
  const expect = { romans: 'aggressive', babylonians: 'science', germans: 'defensive', egyptians: 'growth', americans: 'balanced', greeks: 'growth', russians: 'defensive', zulus: 'aggressive', indians: 'growth', french: 'growth', aztecs: 'growth', chinese: 'defensive', english: 'science', mongols: 'aggressive' };
  for (const id of Object.keys(expect)) {
    assert.strictEqual(stanceFromPersonality(RULESET.civs[id].personality), expect[id], `${id} (${RULESET.civs[id].leader})`);
  }
});

test('favoriteModifier is inert in A59 (bonus 0 — the seam exists, wiring is a later window)', () => {
  assert.strictEqual(favoriteModifier('wonder', 'great-wall', RULESET), 0);
  assert.strictEqual(favoriteModifier('unit', 'legion', RULESET), 0);
});
