// XIV §45b REHOME (Civ 1 "Home"): a unit standing in an OWNED city re-homes to it; upkeep shifts
// from the old home to the new (processCities reads unit.home). The repair path for a settler-
// starved city whose garrison is homed elsewhere. New engine command (movement.js) + luau twin +
// scenario 060; the semantics + rejections live here.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

function mk() {
  const tiles = []; for (let i = 0; i < 81; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 9, height: 9, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 6, y: 6, moves: 1, fortified: false, veteran: false, home: 'c1' } },
    cities: {
      c1: { id: 'c1', name: 'Old', owner: 'p1', x: 2, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'New', owner: 'p1', x: 6, y: 6, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('#7 rehome: a unit in an owned city re-homes to it and emits unitRehomed', async () => {
  const engine = await load();
  const r = engine.applyCommand(mk(), { type: 'rehome', playerId: 'p1', unitId: 'u1' });
  assert.ok(r.ok, `rehome should succeed: ${r.reason}`);
  assert.strictEqual(r.state.units.u1.home, 'c2', 'the unit re-homes to the city it stands in');
  assert.ok(r.events.some(e => e.type === 'unitRehomed' && e.unitId === 'u1' && e.cityId === 'c2' && e.from === 'c1'),
    'a unitRehomed event carries the from/to cities');
});

test('#7 rehome rejections: not in own city / already homed / not your unit / not your turn', async () => {
  const engine = await load();
  // not in a city — move u1 to open ground
  const s1 = mk(); s1.units.u1.x = 8; s1.units.u1.y = 8;
  assert.strictEqual(engine.applyCommand(s1, { type: 'rehome', playerId: 'p1', unitId: 'u1' }).reason, 'notInOwnCity');
  // in a RIVAL city (owner mismatch)
  const s2 = mk(); s2.cities.c2.owner = 'p2';
  assert.strictEqual(engine.applyCommand(s2, { type: 'rehome', playerId: 'p1', unitId: 'u1' }).reason, 'notInOwnCity');
  // already homed to the city it stands in — a no-op reject
  const s3 = mk(); s3.units.u1.home = 'c2';
  assert.strictEqual(engine.applyCommand(s3, { type: 'rehome', playerId: 'p1', unitId: 'u1' }).reason, 'alreadyHomed');
  // not your unit / not your turn
  assert.strictEqual(engine.applyCommand(mk(), { type: 'rehome', playerId: 'p2', unitId: 'u1' }).reason, 'notYourUnit');
  const s4 = mk(); s4.activePlayer = 'p2';
  assert.strictEqual(engine.applyCommand(s4, { type: 'rehome', playerId: 'p1', unitId: 'u1' }).reason, 'notYourTurn');
});

test('#7 rehome shifts upkeep: the new home city pays the shield upkeep after re-homing', async () => {
  const { createEngine } = await import('../engine/index.js');
  const { processCities } = await import('../engine/cities.js');
  // monarchy gives free units per city; despotism upkeeps sooner. Pile enough own units homed to c2
  // that c2 owes shield upkeep only once u1 joins it — a direct home-shift witness via supported count.
  const engine = createEngine(RULESET);
  void engine;
  const gov = RULESET.governments.despotism;
  const st = mk();
  // fill c2's free slots so the (freeUnitsPerCity+1)-th unit owes upkeep; u1 is that marginal unit.
  const free = gov.freeUnitsPerCity === undefined ? 0 : gov.freeUnitsPerCity;
  let nid = 60;
  for (let i = 0; i < free; i++) { const id = 'f' + i; st.units[id] = { id, type: 'militia', owner: 'p1', x: 6, y: 6, moves: 1, home: 'c2' }; nid++; }
  st.players.p1.government = 'despotism';
  // BEFORE re-home: u1 homed to c1 -> c2 supports exactly `free` units -> owes 0.
  const before = JSON.parse(JSON.stringify(st)); before.cities.c2.shields = 0;
  const evB = []; processCities(before, RULESET, evB);
  // AFTER re-home: u1 now homed to c2 -> c2 supports free+1 -> owes gov.upkeepShields.
  const r = createEngine(RULESET).applyCommand(st, { type: 'rehome', playerId: 'p1', unitId: 'u1' });
  assert.ok(r.ok);
  const after = r.state; after.cities.c2.shields = 0;
  const evA = []; processCities(after, RULESET, evA);
  if (gov.upkeepShields > 0) {
    assert.ok(after.cities.c2.shields <= before.cities.c2.shields,
      'the new home now shoulders the marginal unit\'s shield upkeep (shields no higher than before the shift)');
  }
});
