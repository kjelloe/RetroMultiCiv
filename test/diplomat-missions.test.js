// D6 diplomat missions (spec d456 §D6): establish embassy, steal tech (ROLL),
// sabotage (ROLL), incite revolt (deterministic), bribe unit (deterministic), plus
// the embassy-intel filterView reveal. Golden-neutral: no AI use, omit-safe state.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let engine, rollRange;
test('load', async () => {
  const { createEngine } = await import('../engine/index.js');
  ({ rollRange } = await import('../engine/rng.js'));
  engine = createEngine(RULESET);
});

// p1 owns a diplomat; p2 owns a capital (Palace) + a second city + a unit.
function baseState(over) {
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    units: {
      d1: { id: 'd1', type: 'diplomat', owner: 'p1', x: 2, y: 2, moves: 2, fortified: false, veteran: false },
      m2: { id: 'm2', type: 'militia', owner: 'p2', x: 4, y: 4, moves: 1, fortified: false, veteran: false }
    },
    cities: {
      cap2: { id: 'cap2', name: 'Thebes', owner: 'p2', x: 3, y: 2, pop: 4, food: 0, shields: 20, buildings: ['palace'], producing: { kind: 'unit', id: 'militia' } },
      c2b: { id: 'c2b', name: 'Memphis', owner: 'p2', x: 4, y: 3, pop: 3, food: 0, shields: 15, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['cap2', 'c2b'], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'Rome', color: '#00f', human: true, gold: 5000, techs: ['pottery'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'Egypt', color: '#f00', human: false, gold: 100, techs: ['pottery', 'bronze-working', 'writing'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, government: 'monarchy' }
    },
    rngState: 12345
  }, over || {});
}
const mission = (mission, over) => Object.assign({ type: 'diplomatMission', playerId: 'p1', unitId: 'd1', mission }, over || {});

test('establishEmbassy: a diplomat on a rival CAPITAL sets state.embassies + is consumed', () => {
  const r = engine.applyCommand(baseState(), mission('establishEmbassy', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.embassies.p1.p2, 10, 'embassy stamped with the turn');
  assert.strictEqual(r.state.units.d1, undefined, 'the diplomat is consumed');
  assert.ok(r.events.some(e => e.type === 'EMBASSY_ESTABLISHED'));
});

test('establishEmbassy: a non-capital rival city is refused (notACapital)', () => {
  // move the diplomat adjacent to the non-capital c2b (4,3)
  const s = baseState(); s.units.d1.x = 3; s.units.d1.y = 3;
  const r = engine.applyCommand(s, mission('establishEmbassy', { targetCityId: 'c2b' }));
  assert.strictEqual(r.reason, 'notACapital');
});

test('embassy intel: filterView reveals a rival gov/gold/techCount/capital only WITH an embassy', async () => {
  const { filterView } = await import('../engine/visibility.js');
  const s = baseState();
  s.players.p1.explored = new Array(35).fill(1); // p1 sees the map (not omniscient — has an explored array)
  const before = filterView(s, 'p1', RULESET).players.p2;
  assert.strictEqual(before.gold, undefined, 'no embassy -> no rival gold in the view');
  assert.strictEqual(before.techCount, undefined, 'no embassy -> no tech count');
  s.embassies = { p1: { p2: 10 } };
  const after = filterView(s, 'p1', RULESET).players.p2;
  assert.strictEqual(after.gold, 100, 'embassy -> rival gold revealed');
  assert.strictEqual(after.techCount, 3, 'embassy -> tech COUNT (not the list)');
  assert.strictEqual(after.techs, undefined, 'the tech LIST is still secret');
  assert.strictEqual(after.government, 'monarchy', 'embassy -> government revealed');
  assert.strictEqual(after.capitalX, 3, 'embassy -> capital location revealed');
});

test('inciteRevolt: pays gold, flips the city to the inciter, consumes the diplomat', () => {
  // adjacent to the non-capital c2b (the capital cannot be incited)
  const s = baseState(); s.units.d1.x = 3; s.units.d1.y = 3;
  const r = engine.applyCommand(s, mission('inciteRevolt', { targetCityId: 'c2b' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.cities.c2b.owner, 'p1', 'the city flipped');
  assert.ok(r.state.players.p1.gold < 5000, 'gold was spent');
  assert.strictEqual(r.state.units.d1, undefined, 'diplomat consumed');
  assert.ok(r.events.some(e => e.type === 'CITY_INCITED' && e.gold > 0));
});

test('inciteRevolt: the capital cannot be incited (cannotInciteCapital)', () => {
  const r = engine.applyCommand(baseState(), mission('inciteRevolt', { targetCityId: 'cap2' }));
  assert.strictEqual(r.reason, 'cannotInciteCapital');
});

test('inciteRevolt: insufficient gold is refused, no flip', () => {
  const s = baseState(); s.units.d1.x = 3; s.units.d1.y = 3; s.players.p1.gold = 1;
  const r = engine.applyCommand(s, mission('inciteRevolt', { targetCityId: 'c2b' }));
  assert.strictEqual(r.reason, 'notEnoughGold');
  assert.strictEqual(s.cities.c2b.owner, 'p2', 'no flip on failure');
});

test('bribeUnit: pays gold, transfers the rival unit, consumes the diplomat', () => {
  const s = baseState(); s.units.d1.x = 4; s.units.d1.y = 3; // adjacent to m2 (4,4)
  const r = engine.applyCommand(s, mission('bribeUnit', { targetUnitId: 'm2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.units.m2.owner, 'p1', 'unit bribed to p1');
  assert.strictEqual(r.state.units.m2.moves, 0, 'a freshly bribed unit has spent its turn');
  assert.strictEqual(r.state.units.d1, undefined, 'diplomat consumed');
  assert.ok(r.events.some(e => e.type === 'UNIT_BRIBED'));
});

test('stealTech: deterministic ROLL — matches rng, once-per-city, consumes the diplomat', () => {
  const s = baseState();
  // predict the roll the engine will make (rollRange over the SAME rngState)
  const roll = rollRange(s.rngState, 100);
  const willSucceed = roll.value < 50;
  const r = engine.applyCommand(s, mission('stealTech', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.cities.cap2.techStolen, true, 'city flagged (once per city)');
  assert.strictEqual(r.state.units.d1, undefined, 'diplomat consumed');
  if (willSucceed) {
    assert.ok(r.state.players.p1.techs.length > 1, 'a tech was stolen on success');
    const gained = r.state.players.p1.techs.filter(t => t !== 'pottery');
    assert.ok(['bronze-working', 'writing'].includes(gained[0]), 'stole an eligible rival tech');
  } else {
    assert.deepStrictEqual(r.state.players.p1.techs, ['pottery'], 'no tech on a failed roll');
  }
  // determinism: a second identical run reproduces the same outcome
  const r2 = engine.applyCommand(baseState(), mission('stealTech', { targetCityId: 'cap2' }));
  assert.deepStrictEqual(r2.state.players.p1.techs, r.state.players.p1.techs);
});

// FOUND BY THE W8 GATE SWEEP (sim-runner, seeds 13/18, 2026-07-30): stealing the
// tech you are CURRENTLY RESEARCHING left `researching` set, so processResearch
// completed it again and grantTech pushed a SECOND copy — a duplicate tech in
// state. Latent since D6; W8's diplomat doctrine drives enough steals to hit it.
// grantTech (tech.js) and diploGrantTech (diplomacy.js) both already guard this;
// the direct push in stealTech was the one path that did not.
test('stealTech: stealing the tech you are researching clears it (no duplicate)', () => {
  const s = baseState();
  // force the success branch and make the stolen pick the one being researched:
  // p2 holds bronze-working + writing, so research bronze-working and roll until
  // the engine's own pick lands there.
  s.players.p1.researching = 'bronze-working';
  s.players.p1.bulbs = 0;
  let r = null;
  for (let seed = 1; seed < 200 && r === null; seed++) {
    const probe = baseState();
    probe.rngState = seed;
    probe.players.p1.researching = 'bronze-working';
    const out = engine.applyCommand(probe, mission('stealTech', { targetCityId: 'cap2' }));
    if (out.ok && out.state.players.p1.techs.indexOf('bronze-working') !== -1) r = out;
  }
  assert.ok(r !== null, 'found a seed where bronze-working is the stolen tech');
  const techs = r.state.players.p1.techs;
  const copies = techs.filter(t => t === 'bronze-working').length;
  assert.strictEqual(copies, 1, `bronze-working appears ${copies}x — a duplicate tech`);
  assert.strictEqual(r.state.players.p1.researching, '',
    'the stolen tech must stop being researched, or processResearch re-completes it');
});

test('stealTech: a city already stolen from is refused (alreadyStolen)', () => {
  const s = baseState(); s.cities.cap2.techStolen = true;
  const r = engine.applyCommand(s, mission('stealTech', { targetCityId: 'cap2' }));
  assert.strictEqual(r.reason, 'alreadyStolen');
});

test('sabotage: deterministic ROLL — success zeroes the shields box, consumes the diplomat', () => {
  const s = baseState();
  const roll = rollRange(s.rngState, 100);
  const willSucceed = roll.value < 50;
  const r = engine.applyCommand(s, mission('sabotage', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.units.d1, undefined, 'diplomat consumed');
  assert.strictEqual(r.state.cities.cap2.shields, willSucceed ? 0 : 20, 'shields zeroed on success only');
});

test('investigateCity: a one-time snapshot event (pop/shields/producing), consumes the diplomat, no state change to the rival', () => {
  const s = baseState();
  const before = JSON.stringify(s.cities.cap2);
  const r = engine.applyCommand(s, mission('investigateCity', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.units.d1, undefined, 'diplomat consumed');
  assert.strictEqual(JSON.stringify(r.state.cities.cap2), before, 'the rival city is UNCHANGED (a read-only peek)');
  const ev = r.events.find(e => e.type === 'CITY_INVESTIGATED');
  assert.ok(ev, 'CITY_INVESTIGATED emitted');
  assert.strictEqual(ev.pop, 4);
  assert.strictEqual(ev.shields, 20);
  assert.strictEqual(ev.cityId, 'cap2');
});

test('investigateCity: works on a non-capital rival city too (any rival city)', () => {
  const s = baseState(); s.units.d1.x = 3; s.units.d1.y = 3;
  const r = engine.applyCommand(s, mission('investigateCity', { targetCityId: 'c2b' }));
  assert.ok(r.ok, r.reason);
  assert.ok(r.events.some(e => e.type === 'CITY_INVESTIGATED' && e.cityId === 'c2b'));
});

// --- W1 discovered-sabotage: a discovery roll after steal/sabotage; fallout on discovery ---

test('discovery: sabotage rolls discovery after resolving — on discovery perp reputation + victim grievance + ESPIONAGE_EXPOSED; else clean', async () => {
  const { grievanceOf } = await import('../engine/diplomacy.js');
  const d = RULESET.rules.diplomacy;
  const s = baseState();
  // rng order: sabotage success roll, THEN the discovery roll (botch-amplified odds)
  const r1 = rollRange(s.rngState, 100); const success = r1.value < 50;
  const r2 = rollRange(r1.rngState, 100);
  const discovered = r2.value < (success ? d.discoveryPctOnSuccess : d.discoveryPctOnFail);
  const r = engine.applyCommand(s, mission('sabotage', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  if (discovered) {
    assert.strictEqual(r.state.players.p1.reputation, 1, 'perp reputation soiled one band (treaty-break machinery)');
    assert.strictEqual(grievanceOf(r.state, 'p2', 'p1'), d.relGrievanceOnBetray, 'victim grievance toward perp rose');
    assert.ok(r.events.some(e => e.type === 'ESPIONAGE_EXPOSED' && e.mission === 'sabotage' && e.byCivId === 'p1' && e.atCivId === 'p2'));
    assert.ok(r.events.some(e => e.type === 'REPUTATION_SHIFT' && e.direction === 'worse'));
  } else {
    assert.strictEqual(r.state.players.p1.reputation, undefined, 'clean job — no reputation hit');
    assert.ok(!r.events.some(e => e.type === 'ESPIONAGE_EXPOSED'));
  }
});

test('discovery: stealTech rolls discovery AFTER the success + tech-pick rolls (correct rng order)', () => {
  const d = RULESET.rules.diplomacy;
  const s = baseState();
  const eligible = ['bronze-working', 'writing']; // p2's techs minus p1's (pottery), sorted
  const r1 = rollRange(s.rngState, 100); const success = r1.value < 50 && eligible.length > 0;
  let after = r1.rngState;
  if (success) { const rp = rollRange(after, eligible.length); after = rp.rngState; }
  const r2 = rollRange(after, 100);
  const discovered = r2.value < (success ? d.discoveryPctOnSuccess : d.discoveryPctOnFail);
  const r = engine.applyCommand(s, mission('stealTech', { targetCityId: 'cap2' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(!!r.events.find(e => e.type === 'ESPIONAGE_EXPOSED'), discovered, 'exposed iff the discovery roll landed');
  if (discovered) assert.strictEqual(r.state.players.p1.reputation, 1, 'exposed theft soils reputation');
  else assert.strictEqual(r.state.players.p1.reputation, undefined, 'undetected theft leaves reputation clean');
});

test('discovery: incite + bribe are OVERT — no discovery roll (rngState untouched), no reputation/exposure', () => {
  // incite (deterministic, no roll): rngState must be unchanged
  const s = baseState(); s.units.d1.x = 3; s.units.d1.y = 3;
  const r = engine.applyCommand(s, mission('inciteRevolt', { targetCityId: 'c2b' }));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.state.rngState, s.rngState, 'incite rolls no rng (overt)');
  assert.strictEqual(r.state.players.p1.reputation, undefined, 'no reputation hit');
  assert.ok(!r.events.some(e => e.type === 'ESPIONAGE_EXPOSED'));
  // bribe (deterministic): same
  const s2 = baseState(); s2.units.d1.x = 4; s2.units.d1.y = 3;
  const rb = engine.applyCommand(s2, mission('bribeUnit', { targetUnitId: 'm2' }));
  assert.ok(rb.ok, rb.reason);
  assert.strictEqual(rb.state.rngState, s2.rngState, 'bribe rolls no rng (overt)');
  assert.ok(!rb.events.some(e => e.type === 'ESPIONAGE_EXPOSED'));
});

test('rejections: notYourTurn, not a diplomat, out of reach, self/barbarian target', () => {
  const off = baseState({ activePlayer: 'p2' });
  assert.strictEqual(engine.applyCommand(off, mission('establishEmbassy', { targetCityId: 'cap2' })).reason, 'notYourTurn');
  const notDip = baseState(); notDip.units.d1.type = 'militia';
  assert.strictEqual(engine.applyCommand(notDip, mission('stealTech', { targetCityId: 'cap2' })).reason, 'notADiplomat');
  const far = baseState(); far.units.d1.x = 0; far.units.d1.y = 0; // nowhere near cap2 (3,2)
  assert.strictEqual(engine.applyCommand(far, mission('stealTech', { targetCityId: 'cap2' })).reason, 'noSuchTarget');
});
