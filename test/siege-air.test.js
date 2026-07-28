// W6 build-doctrine slice-3B/3C (specs/build-doctrine-plan.md; unit-doctrine
// v1x §5 + §4): the v1 war pair —
//   PILLAGE-SIEGE (recalled-behavior label): an attacker HOLDING at the enemy
//   city edge (massing / odds wait) strips the siege-ring improvements instead
//   of idling; never inside an own city's radius.
//   AIR WAR: bombers strike the assault target only while a ground siege
//   exists and the target sits within the fuel leash of a friendly base —
//   aloft bombers head home; fighters hold at base and only ever engage
//   visible enemy AIR (interception).
// Command-level fixtures via pickCommand (deterministic, no combat rolls).
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  return ai;
}

// One own attacker near an enemy city on a 14x9 strip. p1 has no cities by
// default (the unit brain is the subject); fullExplored lets the AI "know"
// the enemy city. researching non-empty skips the research branch.
function warState(extraUnits, ownCities) {
  const width = 14, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  const units = {
    a1: { id: 'a1', type: 'legion', owner: 'p1', x: 6, y: 4, moves: 1, fortified: false, veteran: false },
    d1: { id: 'd1', type: 'militia', owner: 'p2', x: 7, y: 4, moves: 0, fortified: true, veteran: false }
  };
  Object.assign(units, extraUnits || {});
  const cities = {
    e2: { id: 'e2', name: 'Target', owner: 'p2', x: 7, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  };
  const cityOrder = ['e2'];
  for (const c of ownCities || []) {
    cities[c.id] = Object.assign({
      name: c.id, owner: 'p1', pop: 3, food: 0, shields: 0, buildings: [],
      producing: { kind: 'unit', id: 'militia' }
    }, c);
    cityOrder.push(c.id);
  }
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 90, nextCityId: 20,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['iron-working'], researching: 'pottery', bulbs: 0, taxRate: 50, sciRate: 50, explored: new Array(width * height).fill(1) },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('slice-3B: the siege knob exists in rules.json', () => {
  assert.ok(Number.isInteger(RULESET.rules.siegePillageRadius) && RULESET.rules.siegePillageRadius > 0);
});

test('slice-3C: the air knobs exist in rules.json', () => {
  const a = RULESET.rules.airDoctrine;
  assert.ok(a !== undefined, 'rules.airDoctrine missing');
  assert.ok(Number.isInteger(a.bombers) && Number.isInteger(a.fighters) && Number.isInteger(a.leash));
});

test('slice-3B: a holding attacker PILLAGES the siege-ring tile instead of idling', async () => {
  const ai = await load();
  const state = warState();
  state.map.tiles[4 * 14 + 6] = { t: 'grassland', irrigation: true, road: true };
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.deepStrictEqual(cmd, { type: 'pillage', playerId: 'p1', unitId: 'a1' },
    'the massing hold converts to siege work: cut the defender tiles (§5, recalled-behavior)');
});

test('slice-3B: never pillage inside an own city radius (border overlap guard)', async () => {
  const ai = await load();
  const state = warState({}, [{ id: 'h1', x: 5, y: 4 }]);
  state.map.tiles[4 * 14 + 6] = { t: 'grassland', irrigation: true, road: true };
  state.units.hg = { id: 'hg', type: 'militia', owner: 'p1', x: 5, y: 4, moves: 0, fortified: true, veteran: false };
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'wait', 'own worked tiles are not siege targets');
});

test('slice-3B: a bare siege tile still just holds (nothing to pillage)', async () => {
  const ai = await load();
  const state = warState();
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'wait', 'no improvement on the tile -> the old massing hold');
});

test('slice-3C: a bomber HOLDS at base while no ground siege exists', async () => {
  const ai = await load();
  const state = warState(
    { b1: { id: 'b1', type: 'bomber', owner: 'p1', x: 2, y: 4, moves: 8, fortified: false, veteran: false } },
    [{ id: 'h1', x: 2, y: 4 }]);
  delete state.units.a1; // no besieger anywhere
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.deepStrictEqual(cmd, { type: 'wait', playerId: 'p1', unitId: 'b1' },
    'no siege -> no sortie (the bomber pairs with the ground assault, §4)');
});

test('slice-3C: a bomber STRIKES the besieged city inside the fuel leash', async () => {
  const ai = await load();
  const state = warState(
    { b1: { id: 'b1', type: 'bomber', owner: 'p1', x: 2, y: 4, moves: 8, fortified: false, veteran: false } },
    [{ id: 'h1', x: 2, y: 4 }]);
  state.units.a1.moves = 0; // the besieger already acted; siege stands adjacent
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'moveUnit');
  assert.strictEqual(cmd.unitId, 'b1');
  assert.strictEqual(cmd.dir, 'E', 'toward the besieged city: reduce the defenders before the assault');
});

test('slice-3C: an ALOFT bomber heads home (fuel discipline beats another strike)', async () => {
  const ai = await load();
  const state = warState(
    { b1: { id: 'b1', type: 'bomber', owner: 'p1', x: 5, y: 4, moves: 8, fortified: false, veteran: false, aloft: 1 } },
    [{ id: 'h1', x: 2, y: 4 }]);
  state.units.a1.moves = 0;
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'moveUnit');
  assert.strictEqual(cmd.unitId, 'b1');
  assert.strictEqual(cmd.dir, 'W', 'aloft -> return to the friendly base, never a second sortie');
});

test('slice-3C: a fighter HOLDS at base with no enemy air in reach', async () => {
  const ai = await load();
  const state = warState(
    { f1: { id: 'f1', type: 'fighter', owner: 'p1', x: 2, y: 4, moves: 10, fortified: false, veteran: false } },
    [{ id: 'h1', x: 2, y: 4 }]);
  delete state.units.a1;
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.deepStrictEqual(cmd, { type: 'wait', playerId: 'p1', unitId: 'f1' },
    'fighters are the air DEFENSE: no ground marching, no city strikes (§4)');
});

test('slice-3C: a fighter ENGAGES a visible enemy air unit (interception)', async () => {
  const ai = await load();
  const state = warState(
    {
      f1: { id: 'f1', type: 'fighter', owner: 'p1', x: 2, y: 4, moves: 10, fortified: false, veteran: false },
      eb: { id: 'eb', type: 'bomber', owner: 'p2', x: 5, y: 4, moves: 0, fortified: false, veteran: false }
    },
    [{ id: 'h1', x: 2, y: 4 }]);
  delete state.units.a1;
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'moveUnit');
  assert.strictEqual(cmd.unitId, 'f1');
  assert.strictEqual(cmd.dir, 'E', 'attacksAir: the fighter closes on the intruding bomber');
});

test('slice-3C: at the army target with a known enemy city, a production city builds the BOMBER', async () => {
  const ai = await load();
  const { createEngine } = await import('../engine/index.js');
  const width = 14, height = 9;
  const state = warState({}, [{ id: 'h1', x: 3, y: 4, buildings: ['granary', 'temple', 'barracks'] }]);
  delete state.units.a1;
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    state.map.tiles[(4 + dy) * width + (3 + dx)] = { t: 'mountains', mine: true };
  }
  for (let g = 0; g < 2; g++) {
    state.units['g' + g] = { id: 'g' + g, type: 'militia', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false };
  }
  for (let s = 0; s < 2; s++) {
    state.units['s' + s] = { id: 's' + s, type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  }
  state.players.p1.techs = ['pottery', 'ceremonial-burial', 'advanced-flight'];
  const after = ai.runAiTurn(createEngine(RULESET), state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.h1.producing, { kind: 'unit', id: 'bomber' },
    'late-era war kit: the production city fields the bomber arm (§4)');
});

test('slice-3C: an enemy air sighting near an own city builds the FIGHTER first', async () => {
  const ai = await load();
  const { createEngine } = await import('../engine/index.js');
  const width = 14, height = 9;
  const state = warState(
    { eb: { id: 'eb', type: 'bomber', owner: 'p2', x: 4, y: 4, moves: 0, fortified: false, veteran: false } },
    [{ id: 'h1', x: 3, y: 4, buildings: ['granary', 'temple', 'barracks'] }]);
  delete state.units.a1;
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    state.map.tiles[(4 + dy) * width + (3 + dx)] = { t: 'mountains', mine: true };
  }
  for (let g = 0; g < 2; g++) {
    state.units['g' + g] = { id: 'g' + g, type: 'militia', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false };
  }
  for (let s = 0; s < 2; s++) {
    state.units['s' + s] = { id: 's' + s, type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  }
  state.players.p1.techs = ['pottery', 'ceremonial-burial', 'flight', 'advanced-flight'];
  const after = ai.runAiTurn(createEngine(RULESET), state, 'p1', RULESET);
  assert.deepStrictEqual(after.cities.h1.producing, { kind: 'unit', id: 'fighter' },
    'the interception alarm outranks the bomber arm: defense first (§4)');
});
