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

// barb-sea-raids: the two-phase telegraph->land + the mandated visibility-gated
// 'sails spotted' warning (#2096). A coastal city (p1) is raided; the sails are
// spotted the turn BEFORE the landing, seen by the coast owner but not a blind
// inland viewer; next turn the raiders materialize on the beach.
test('barb-sea-raids: sails spotted (visibility-gated) T-1, raiders land T', async () => {
  const { process } = await load();
  const { filterEvents } = await import('../engine/visibility.js');
  const W = 7, H = 7, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  tiles[5 * W + 3] = { t: 'ocean' }; // a single sea tile at (3,5) -> the coast
  const rules = Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules,
    { barb: Object.assign({}, RULESET.rules.barb, { seaRaidChance: 1 }) }) }); // 1 => always fires
  const state = {
    version: 1, turn: 16, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: {}, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: { c1: { id: 'c1', name: 'Coast', owner: 'p1', x: 3, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'],
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 0, techs: [], researching: '', explored: new Array(W * H).fill(1) },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: '', explored: new Array(W * H).fill(0) }
    },
    rngState: 12345
  };
  // T-1: process schedules the raid + emits the sighting
  const ev1 = [];
  process(state, rules, ev1);
  const spotted = ev1.find(e => e.type === 'sailsSpotted');
  assert.ok(spotted && spotted.cityId === 'c1', 'sailsSpotted fires for the coastal city; got ' + JSON.stringify(ev1));
  assert.ok(state.pendingRaids && state.pendingRaids.length === 1, 'a raid is scheduled for next turn');
  assert.strictEqual(state.pendingRaids[0].turn, 17, 'landing scheduled T+1');
  // #2096 visibility gate: the coast owner sees the warning, a blind inland viewer does not
  assert.ok(filterEvents(state, [spotted], 'p1').some(e => e.type === 'sailsSpotted'), 'the coast owner sees the sails');
  assert.ok(!filterEvents(state, [spotted], 'p2').some(e => e.type === 'sailsSpotted'), 'a viewer with no sight of the coast does NOT');
  // T: the raiders land on the beach
  state.turn = 17;
  const ev2 = [];
  process(state, rules, ev2);
  const landed = ev2.find(e => e.type === 'barbariansLanded');
  assert.ok(landed, 'the raiders land on turn T; got ' + JSON.stringify(ev2));
  assert.ok(state.units[landed.unitId] && state.units[landed.unitId].owner === 'barb', 'a barbarian unit exists on the beach');
  assert.ok(state.pendingRaids === undefined, 'the resolved raid is cleared (hash-stable when empty)');
});
