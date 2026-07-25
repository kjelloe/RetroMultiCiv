// W6 build-doctrine slice-1 (specs/build-doctrine-plan.md; §3a core loop):
// the AI owes TEMPLE + GRANARY before the settler/army treadmill —
//   temple FIRST while the city is in disorder (happiness never optional),
//   granary BEFORE the settler loop (a high-food city defers it until
//   rules.buildDoctrine.granaryDeferPop), temple AFTER the granary.
// Fixture-first for the slice-1 golden window. The doctrine is knob-driven
// (rules.buildDoctrine) so the numbers live in data, not engine logic.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

// A defended city (2 fortified guards -> past the garrison branch) with no
// parked settlers (under the settler target -> the old behavior builds
// settlers). techs/buildings/disorder/tiles vary per case.
function doctrineState(techs, cityExtra, irrigateRing) {
  const width = 9, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  if (irrigateRing === true) {
    for (const [x, y] of [[3, 3], [4, 3], [5, 3], [3, 4], [5, 4], [3, 5], [4, 5], [5, 5]]) {
      tiles[y * width + x] = { t: 'grassland', irrigation: true };
    }
  }
  const city = Object.assign({
    id: 'c9', name: 'Doctrine', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0,
    buildings: [], producing: { kind: 'unit', id: 'militia' }
  }, cityExtra || {});
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units: {
      g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      g2: { id: 'g2', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false }
    },
    cities: { c9: city }, cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs, researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('slice-1: the knobs exist in rules.json (numbers in data, not engine)', () => {
  const d = RULESET.rules.buildDoctrine;
  assert.ok(d !== undefined, 'rules.buildDoctrine missing');
  assert.strictEqual(d.happinessBuilding, 'temple');
  assert.strictEqual(d.growthBuilding, 'granary');
  assert.ok(Number.isInteger(d.granaryDeferPop) && d.granaryDeferPop > 0);
  assert.ok(Number.isInteger(d.highFoodSurplus) && d.highFoodSurplus > 0);
});

test('slice-1: granary before the settler loop (pottery known, ordinary food)', async () => {
  const { ai, engine } = await load();
  const after = ai.runAiTurn(engine, doctrineState(['pottery']), 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c9.producing, { kind: 'building', id: 'granary' },
    'a defended, under-settler-target city owes the granary first (§3a core loop)');
});

test('slice-1: temple FIRST while the city is in disorder', async () => {
  const { ai, engine } = await load();
  const state = doctrineState(['pottery', 'ceremonial-burial'], { disorder: true, pop: 6, food: 20 });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'temple',
    'disorder-now beats the granary — happiness is never optional');
});

test('slice-1: a high-food city defers the granary until granaryDeferPop', async () => {
  const { ai, engine } = await load();
  // monarchy (no despotism tile penalty — the common early AI government) so the
  // irrigated ring's 3-food tiles survive: pop 2 works two -> surplus 4 >= knob
  const state = doctrineState(['pottery', 'monarchy'], { pop: 2 }, true);
  state.players.p1.government = 'monarchy';
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'settlers',
    'high food + pop under granaryDeferPop -> growth/settlers first (§3a exception)');
});

test('slice-1: temple after the granary', async () => {
  const { ai, engine } = await load();
  const state = doctrineState(['pottery', 'ceremonial-burial'], { buildings: ['granary'] });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'temple',
    'granary done -> the temple slot opens');
});

test('slice-1: doctrine satisfied -> the old settler behavior resumes', async () => {
  const { ai, engine } = await load();
  const state = doctrineState(['pottery', 'ceremonial-burial'], { buildings: ['granary', 'temple'] });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'settlers',
    'temple + granary in place -> expansion continues unchanged');
});

test('slice-1: threat still wins — a threatened city ignores the doctrine slot', async () => {
  const { ai, engine } = await load();
  const state = doctrineState(['pottery', 'masonry']);
  // parked settlers hold the count at target (the B13g shape) so the walls branch is reachable
  state.units.s1 = { id: 's1', type: 'settlers', owner: 'p1', x: 3, y: 4, moves: 0, fortified: false, veteran: false };
  state.units.s2 = { id: 's2', type: 'settlers', owner: 'p1', x: 5, y: 4, moves: 0, fortified: false, veteran: false };
  state.units.e1 = { id: 'e1', type: 'legion', owner: 'p2', x: 8, y: 4, moves: 0, fortified: false, veteran: false };
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'city-walls',
    'B13g walls-first is untouched: threat outranks the doctrine');
});
