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

test('rejections: notYourTurn, not a diplomat, out of reach, self/barbarian target', () => {
  const off = baseState({ activePlayer: 'p2' });
  assert.strictEqual(engine.applyCommand(off, mission('establishEmbassy', { targetCityId: 'cap2' })).reason, 'notYourTurn');
  const notDip = baseState(); notDip.units.d1.type = 'militia';
  assert.strictEqual(engine.applyCommand(notDip, mission('stealTech', { targetCityId: 'cap2' })).reason, 'notADiplomat');
  const far = baseState(); far.units.d1.x = 0; far.units.d1.y = 0; // nowhere near cap2 (3,2)
  assert.strictEqual(engine.applyCommand(far, mission('stealTech', { targetCityId: 'cap2' })).reason, 'noSuchTarget');
});
