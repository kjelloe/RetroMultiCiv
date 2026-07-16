// A66/B13: barbarians era-scale — the spawn unit is the highest rules.barbTiers
// entry whose trigger tech is known by >= barbTierThreshold% of the alive
// non-barb civs (reusing the obsolescence-era triggers). Militia forever no more.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return import('../engine/barbarians.js');
}

// state with `n` alive civs; `knowers` of them know `tech`
function craft(n, tech, knowers) {
  const players = {};
  const order = [];
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    order.push(pid);
    players[pid] = { id: pid, alive: true, techs: (i <= knowers && tech) ? [tech] : [] };
  }
  // a non-roster barb owner must never be counted
  players.barb = { id: 'barb', alive: true, techs: ['gunpowder', 'conscription', 'labor-union'] };
  order.push('barb');
  return { playerOrder: order, players };
}

test('A66: barbTier stays militia when the trigger tech is rare', async () => {
  const { barbTier } = await load();
  // 10 civs, only 2 know gunpowder = 20% < 30% threshold
  assert.strictEqual(barbTier(craft(10, 'gunpowder', 2), RULESET), 'militia');
});

test('A66: barbTier advances once a tier tech crosses the threshold', async () => {
  const { barbTier } = await load();
  // 10 civs, 3 know gunpowder = 30% >= 30% → musketeers
  assert.strictEqual(barbTier(craft(10, 'gunpowder', 3), RULESET), 'musketeers');
  // conscription widespread → riflemen (higher tier wins)
  assert.strictEqual(barbTier(craft(10, 'conscription', 5), RULESET), 'riflemen');
  // labor-union widespread → mech-inf (top tier)
  assert.strictEqual(barbTier(craft(10, 'labor-union', 10), RULESET), 'mech-inf');
});

test('A66: the non-roster barb owner is never counted toward the threshold', async () => {
  const { barbTier } = await load();
  // no roster civ knows anything; only the barb "knows" late techs → still militia
  assert.strictEqual(barbTier(craft(4, 'gunpowder', 0), RULESET), 'militia');
});
