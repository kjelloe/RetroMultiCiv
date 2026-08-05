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

// The barbarian ceiling (user ruling 2026-08-02). A civ is bounded by unit
// upkeep; barbarian hordes pay nothing, so a captured city could ship units
// forever — the RC sweep measured 695 barbarian units, 69% of the map, at turn
// 340. rules.barb.maxUnits is the missing ceiling, and the hordes with the
// least left to raid give up first. PROVENANCE: RetroMultiCiv, not Civ 1 —
// the wiki documents only the LEADER disbanding once clear of civ cities.
function capState(positions, cities) {
  const units = {};
  for (const [id, x, y] of positions) {
    units[id] = { id, type: 'militia', owner: 'barb', x, y, moves: 1, fortified: false, veteran: false };
  }
  const cityMap = {}, cityOrder = [];
  for (const [id, owner, x, y] of cities === undefined ? [] : cities) {
    cityMap[id] = { id, name: id, owner, x, y, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
    cityOrder.push(id);
  }
  return {
    turn: 40, map: { width: 60, height: 40, wrapX: false, tiles: [] },
    units, cities: cityMap, cityOrder,
    players: { p1: { id: 'p1', alive: true, techs: [] }, barb: { id: 'barb', alive: true, techs: [] } },
    playerOrder: ['p1', 'barb']
  };
}
const capRules = cap => Object.assign({}, RULESET, {
  rules: Object.assign({}, RULESET.rules, { barb: Object.assign({}, RULESET.rules.barb, { maxUnits: cap }) })
});

test('barb cap: under the ceiling nothing disbands', async () => {
  const { enforceCap } = await load();
  const state = capState([['u1', 1, 1], ['u2', 2, 2], ['u3', 3, 3]], [['c1', 'p1', 0, 0]]);
  const events = [];
  enforceCap(state, capRules(3), events);
  assert.strictEqual(Object.keys(state.units).length, 3, 'exactly at the cap is not over it');
  assert.deepStrictEqual(events, []);
});

test('barb cap: the hordes FURTHEST from a civ city disband, down to the cap', async () => {
  const { enforceCap } = await load();
  // civ city at (0,0); u1 nearest .. u5 furthest
  const state = capState(
    [['u1', 1, 0], ['u2', 5, 0], ['u3', 12, 0], ['u4', 25, 0], ['u5', 40, 0]],
    [['c1', 'p1', 0, 0]]
  );
  const events = [];
  enforceCap(state, capRules(2), events);
  assert.deepStrictEqual(Object.keys(state.units).sort(), ['u1', 'u2'], 'the two nearest survive');
  assert.deepStrictEqual(events.map(e => e.unitId), ['u5', 'u4', 'u3'],
    'furthest first, so the turn log reads as the outermost hordes dispersing');
  assert.strictEqual(events[0].type, 'barbariansDispersed');
});

test('barb cap: a BARBARIAN-held city is a camp, not a raid target', async () => {
  const { enforceCap } = await load();
  // u2 sits on top of a barbarian city but far from the only civ city:
  // being at home must not save it.
  const state = capState(
    [['u1', 1, 0], ['u2', 40, 0]],
    [['c1', 'p1', 0, 0], ['c2', 'barb', 40, 0]]
  );
  const events = [];
  enforceCap(state, capRules(1), events);
  assert.deepStrictEqual(Object.keys(state.units), ['u1'], 'distance is to CIV cities only');
});

test('barb cap: with no civ cities left the cap still holds, by id', async () => {
  const { enforceCap } = await load();
  const state = capState([['u1', 1, 0], ['u2', 5, 0], ['u3', 9, 0]], [['c2', 'barb', 3, 3]]);
  const events = [];
  enforceCap(state, capRules(1), events);
  assert.strictEqual(Object.keys(state.units).length, 1, 'the ceiling is unconditional');
});

test('barb cap: omitting maxUnits keeps the pre-ruling behavior', async () => {
  const { enforceCap } = await load();
  const state = capState([['u1', 1, 0], ['u2', 5, 0], ['u3', 9, 0]], [['c1', 'p1', 0, 0]]);
  const bare = Object.assign({}, RULESET, {
    rules: Object.assign({}, RULESET.rules, { barb: { leaderRansom: 100, leaderChance: 4, seaRaidChance: 8 } })
  });
  const events = [];
  enforceCap(state, bare, events);
  assert.strictEqual(Object.keys(state.units).length, 3, 'omit-safe: no knob, no cap');
});

// A barbarian attack emitted NOTHING (user playtest 2026-08-05: "when barbarians
// win over one of your units, there is no entry in the turn log and thus no
// location marker"). act() calls resolveAttack, which RETURNS { ok, events } —
// movement.js returns that straight up the command path, but barbarians.js
// discarded it, so every barbarian battle was silent: no turn-log line, no
// zoom-to marker, no combat cue.
test('a barbarian attack reports itself — combatResolved reaches the caller', async () => {
  const { process } = await load();
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' });
  const state = {
    turn: 20, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    // the barbarian stands next to a lone defender, so act() must attack it
    units: {
      b1: { id: 'b1', type: 'legion', owner: 'barb', x: 3, y: 2, moves: 1, fortified: false, veteran: false },
      d1: { id: 'd1', type: 'militia', owner: 'p1', x: 4, y: 2, moves: 1, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 5, nextCityId: 2, rngState: 99,
    players: {
      p1: { id: 'p1', name: 'Rome', alive: true, gold: 0, techs: [] },
      barb: { id: 'barb', name: 'Barbarians', alive: true, gold: 0, techs: [] }
    }
  };
  const events = [];
  process(state, RULESET, events);
  const combat = events.filter(e => e.type === 'combatResolved');
  assert.strictEqual(combat.length, 1, `the battle must be reported; got ${JSON.stringify(events.map(e => e.type))}`);
  assert.strictEqual(combat[0].attackerOwner, 'barb', 'attributed to the barbarians');
  assert.strictEqual(combat[0].defenderOwner, 'p1', 'and names the defender, so the turn log can classify it');
  assert.strictEqual(typeof combat[0].x, 'number', 'carries a location — the turn-log marker needs it');
  assert.strictEqual(typeof combat[0].y, 'number');
});
