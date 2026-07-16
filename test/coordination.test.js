// B24: the coordination doctrine. Offensive units form derived army groups —
// they converge on the nearest known enemy city, HOLD at its edge until
// `massSize` attackers are massed, then assault together. Under best-of-three
// each strike is per-unit odds-gated (E); under one-roll there is no gate
// (mass, not odds). Constants live in rules.aiWarDoctrine keyed by combatRounds.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  return { ai };
}

function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

// wide map: p1 legions on the left, a p2 city on the right. Omniscient (no
// explored mask) so the enemy city is "known".
function grass(w, h, units, cities) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 30, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: w, height: h, wrapX: false, tiles },
    units, cities, cityOrder: Object.keys(cities),
    wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['iron-working'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}
const legion = (id, x, y) => ({ id, type: 'legion', owner: 'p1', x, y, moves: 1, fortified: false, veteran: false });
const enemyCity = (defender) => {
  const c = { c9: { id: 'c9', name: 'Target', owner: 'p2', x: 8, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } };
  return c;
};
// skip happiness/research/gov/buy + all cities so pickCommand reaches the unit loop
const DONE = () => ({ happiness: true, research: true, rates: true, government: true, buy: true, 'c:c9': true });

test('B24: a lone attacker converges on the nearest known enemy city', async () => {
  const { ai } = await load();
  const st = grass(12, 5, { u1: legion('u1', 1, 2) }, enemyCity());
  const cmd = ai.pickCommand(st, 'p1', RULESET, DONE());
  assert.strictEqual(cmd.type, 'moveUnit');
  assert.strictEqual(cmd.unitId, 'u1');
  assert.strictEqual(cmd.dir, 'E', 'steps east toward the enemy city');
});

test('B24: an attacker at the edge HOLDS until the mass gathers', async () => {
  const { ai } = await load();
  // one attacker adjacent to the city; massSize default 4 -> not massed -> wait
  const st = grass(12, 5, { u1: legion('u1', 7, 2) }, enemyCity());
  const cmd = ai.pickCommand(st, 'p1', RULESET, DONE());
  assert.strictEqual(cmd.type, 'wait', 'holds at the edge until massed');
  assert.strictEqual(cmd.unitId, 'u1');
});

test('B24: once massSize attackers are massed, they assault (one-roll, no gate)', async () => {
  const { ai } = await load();
  // four legions adjacent to the city -> massed 4 >= 4 -> assault (one-roll)
  const st = grass(12, 5, {
    u1: legion('u1', 7, 1), u2: legion('u2', 7, 2), u3: legion('u3', 7, 3), u4: legion('u4', 8, 3)
  }, enemyCity());
  const cmd = ai.pickCommand(st, 'p1', RULESET, DONE());
  assert.strictEqual(cmd.type, 'moveUnit', 'assaults the city');
  assert.ok(['u1', 'u2', 'u3', 'u4'].indexOf(cmd.unitId) !== -1);
});

test('B24: best-of-three odds gate — a massed attacker HOLDS against strong odds', async () => {
  const { ai } = await load();
  const bo3 = withRules({ combatRounds: 3 }); // oddsGate 2 for combatRounds 3
  // four legions massed, but the city holds a fortified musketeers behind walls
  // -> the attacker's odds are below E=2 -> hold (surgical bo3, no charge)
  const cities = { c9: { id: 'c9', name: 'Fortress', owner: 'p2', x: 8, y: 2, pop: 2, food: 0, shields: 0, buildings: ['city-walls'], producing: { kind: 'unit', id: 'militia' } } };
  const st = grass(12, 5, {
    u1: legion('u1', 7, 1), u2: legion('u2', 7, 2), u3: legion('u3', 7, 3), u4: legion('u4', 8, 3),
    d1: { id: 'd1', type: 'musketeers', owner: 'p2', x: 8, y: 2, moves: 0, fortified: true, veteran: false }
  }, cities);
  const cmd = ai.pickCommand(st, 'p1', bo3, DONE());
  assert.strictEqual(cmd.type, 'wait', 'bo3: bad odds -> hold instead of a doomed charge');
});

test('B24: best-of-three still assaults an undefended city (odds trivially met)', async () => {
  const { ai } = await load();
  const bo3 = withRules({ combatRounds: 3 });
  const st = grass(12, 5, {
    u1: legion('u1', 7, 1), u2: legion('u2', 7, 2), u3: legion('u3', 7, 3), u4: legion('u4', 8, 3)
  }, enemyCity()); // c9 has no defender unit
  const cmd = ai.pickCommand(st, 'p1', bo3, DONE());
  assert.strictEqual(cmd.type, 'moveUnit', 'an undefended city is captured even under bo3');
});

test('B24: the odds gate (E) is sweepable — it flips assault vs hold on the same state', async () => {
  const { ai } = await load();
  // one massed attacker vs a fortified musketeers behind walls (strong odds)
  const cities = { c9: { id: 'c9', name: 'Fortress', owner: 'p2', x: 8, y: 2, pop: 2, food: 0, shields: 0, buildings: ['city-walls'], producing: { kind: 'unit', id: 'militia' } } };
  const mk = () => grass(12, 5, {
    u1: legion('u1', 7, 2),
    d1: { id: 'd1', type: 'musketeers', owner: 'p2', x: 8, y: 2, moves: 0, fortified: true, veteran: false }
  }, cities);
  const gate0 = withRules({ aiWarDoctrine: { '1': { massSize: 1, oddsGate: 0 }, '3': { massSize: 1, oddsGate: 2 } } });
  const gate9 = withRules({ aiWarDoctrine: { '1': { massSize: 1, oddsGate: 9 }, '3': { massSize: 1, oddsGate: 2 } } });
  assert.strictEqual(ai.pickCommand(mk(), 'p1', gate0, DONE()).type, 'moveUnit', 'oddsGate 0: assault regardless');
  assert.strictEqual(ai.pickCommand(mk(), 'p1', gate9, DONE()).type, 'wait', 'oddsGate 9: bad odds -> hold');
});

test('B24: massSize is sweepable — a smaller mass assaults sooner', async () => {
  const { ai } = await load();
  // one attacker adjacent; default massSize 4 holds, but massSize 1 assaults
  const st = () => grass(12, 5, { u1: legion('u1', 7, 2) }, enemyCity());
  assert.strictEqual(ai.pickCommand(st(), 'p1', RULESET, DONE()).type, 'wait', 'default: holds');
  const solo = withRules({ aiWarDoctrine: { '1': { massSize: 1, oddsGate: 0 }, '3': { massSize: 1, oddsGate: 2 } } });
  assert.strictEqual(ai.pickCommand(st(), 'p1', solo, DONE()).type, 'moveUnit', 'massSize 1: assaults alone');
});
