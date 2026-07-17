// B26: defender march discipline (the over-conquest root cause, #646). The
// per-unit odds gate now governs ANY unit initiating an attack-move, keyed by
// the aiWarDoctrine table: offensive units (attack>defense) by `oddsGate`,
// DEFENDER-type units (militia/phalanx, attack<=defense) by `defenderGate`.
// A defender marches on a known enemy ONLY toward an odds-viable target; with
// nothing viable to strike it holds the line (fortify) instead of the un-gated
// sortie that did the conquering. `defenderGate` lives in the table so the
// sim-runner's elim re-sweep + the M11 pinning session tune it (never a
// hardcoded constant — the pre-B21 mistake). Scope: attack-INITIATION only;
// combat.js resolution and barbarians.js are untouched.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/ai.js');
}

function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

// 6x5 open grassland. p1 militia (the surplus defender, not on a city so the
// garrison rule never fires) sits within march radius of a p2 target. All
// tiles explored so the enemy is a known march target. aiScoutSharePct 0 keeps
// the militia a plain soldier (not a B21 scout, which would explore instead).
function march(enemyWalledCity) {
  const W = 6, H = 5;
  const tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const explored = new Array(W * H).fill(1);
  const units = { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false } };
  const cities = {}, cityOrder = [];
  if (enemyWalledCity) {
    // fortified militia behind City Walls: def 1 x100 x150 x3 = 45000 vs att 10000
    units.u2 = { id: 'u2', type: 'militia', owner: 'p2', x: 4, y: 2, moves: 1, fortified: true, veteran: false };
    cities.c2 = { id: 'c2', name: 'Fort', owner: 'p2', x: 4, y: 2, pop: 2, food: 0, shields: 0, buildings: ['city-walls'], producing: { kind: 'unit', id: 'militia' } };
    cityOrder.push('c2');
  } else {
    // plain militia in the open: def 1 x100 x100 = 10000 vs att 10000 (even odds)
    units.u2 = { id: 'u2', type: 'militia', owner: 'p2', x: 3, y: 2, moves: 1, fortified: false, veteran: false };
  }
  const player = (id, color, exp) => ({ id, name: id, color, human: false, gold: 0, techs: [], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50, explored: exp });
  return {
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: player('p1', '#00f', explored),
      p2: player('p2', '#f00', new Array(W * H).fill(1))
    },
    rngState: 1
  };
}

test('B26: a defender will NOT sortie against an un-viable target — it holds the line (fortify)', async () => {
  const ai = await load();
  const cmd = ai.pickCommand(march(true), 'p1', withRules({ aiScoutSharePct: 0 }), {});
  assert.strictEqual(cmd.type, 'fortify', 'militia must garrison, not charge a walled+fortified defender (45000 def vs 10000 att)');
  assert.strictEqual(cmd.unitId, 'u1');
});

test('B26: a defender STILL attacks an odds-viable target — even-odds aggression survives (Civ 1 flavor)', async () => {
  const ai = await load();
  const cmd = ai.pickCommand(march(false), 'p1', withRules({ aiScoutSharePct: 0 }), {});
  assert.strictEqual(cmd.type, 'moveUnit', 'militia marches on an even-odds open target (10000 >= 1 x 10000)');
  assert.strictEqual(cmd.dir, 'E', 'the step is toward the enemy at (3,2)');
});

test('B26: defenderGate is TABLE-SWEPT — raise it and the same even-odds attack is refused', async () => {
  const ai = await load();
  // the M11 pinning session sweeps exactly this field; a high gate = surgical.
  const strict = withRules({ aiScoutSharePct: 0, aiWarDoctrine: { '1': { massSize: 4, oddsGate: 0, defenderGate: 99 } } });
  const cmd = ai.pickCommand(march(false), 'p1', strict, {});
  assert.strictEqual(cmd.type, 'fortify', 'defenderGate 99 forbids even the even-odds sortie — proves the gate reads the table');
});

test('B26: a pre-B26 doctrine table (no defenderGate) still disciplines defenders via the one-roll floor', async () => {
  const ai = await load();
  // warDoctrineOf falls defenderGate back to 1 when oddsGate is 0 (even-odds floor)
  const legacy = withRules({ aiScoutSharePct: 0, aiWarDoctrine: { '1': { massSize: 4, oddsGate: 0 } } });
  assert.strictEqual(ai.pickCommand(march(true), 'p1', legacy, {}).type, 'fortify', 'walled target still refused under the fallback gate');
  assert.strictEqual(ai.pickCommand(march(false), 'p1', legacy, {}).type, 'moveUnit', 'even-odds target still engaged under the fallback gate');
});
