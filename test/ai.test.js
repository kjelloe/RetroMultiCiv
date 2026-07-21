const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: false },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  return { ai, engine: createEngine(RULESET), hashState };
}

function grassState(width, height, units, cities, extra) {
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities: cities || {}, cityOrder: Object.keys(cities || {}),
    wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  }, extra || {});
}

test('AI founds a city with idle settlers on good land', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {
    u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 4, y: 4, moves: 1, fortified: false, veteran: false }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(Object.keys(after.cities).length, 1, 'city founded');
  assert.strictEqual(after.units.u1, undefined, 'settlers consumed');
  assert.notStrictEqual(after.players.p1.researching, '', 'research chosen');
});

test('AI keeps a defender: undefended city switches production to a unit', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Capital', owner: 'p1', x: 4, y: 4, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'militia', 'undefended: build a defender first');

  // once defended, it expands with settlers
  const defended = grassState(9, 9, {
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false }
  }, {
    c9: { id: 'c9', name: 'Capital', owner: 'p1', x: 4, y: 4, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after2 = ai.runAiTurn(engine, defended, 'p1', RULESET);
  assert.strictEqual(after2.cities.c9.producing.id, 'settlers');
});

// B13a/B13e: the AI's defender choice era-scales past obsolete units — once a
// tech obsoletes phalanx/militia (gunpowder), the AI builds the successor
// instead of an obsolete unit setProduction now rejects.
test('B13a: AI defender era-scales (phalanx → musketeers → riflemen → mech-inf)', async () => {
  const { ai, engine } = await load();
  const mk = (techs) => grassState(9, 9, {},
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    { players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs, researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const defenderFor = (techs) => ai.runAiTurn(engine, mk(techs), 'p1', RULESET).cities.c9.producing.id;
  assert.strictEqual(defenderFor([]), 'militia', 'no tech: militia');
  assert.strictEqual(defenderFor(['bronze-working']), 'phalanx', 'bronze-working: phalanx (unchanged)');
  assert.strictEqual(defenderFor(['bronze-working', 'gunpowder']), 'musketeers', 'gunpowder obsoletes phalanx → musketeers');
  assert.strictEqual(defenderFor(['bronze-working', 'gunpowder', 'conscription']), 'riflemen', 'conscription → riflemen');
  assert.strictEqual(defenderFor(['bronze-working', 'gunpowder', 'conscription', 'labor-union']), 'mech-inf', 'labor-union → mech-inf');
});

test('AI military marches toward a known enemy city', async () => {
  const { ai, engine } = await load();
  const state = grassState(12, 5, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'Target', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.units.u1.x, 2, 'stepped east toward the enemy city');
});

// B13f: the march-vs-explore radius is a sweepable rules.json knob
// (exploreMarchRadius) so the sim-runner can tune contact behavior. Default =
// the historical literal (8 -> marches); sweeping it to 0 makes even balanced
// never march on a known enemy (the war-lab "civs never meet" axis).
test('B13f: exploreMarchRadius is sweepable and defaults to the historical march', async () => {
  const { ai } = await load();
  const { createEngine } = await import('../engine/index.js');
  const mk = () => grassState(12, 5, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'Target', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  // drift-guard: default rules reproduce the historical march (east toward the enemy)
  assert.strictEqual(ai.runAiTurn(createEngine(RULESET), mk(), 'p1', RULESET).units.u1.x, 2,
    'default exploreMarchRadius (8) marches — the historical behaviour');
  // sweep to 0: balanced no longer marches on the known enemy (holds / explores)
  const noWar = Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, { exploreMarchRadius: 0 }) });
  assert.strictEqual(ai.runAiTurn(createEngine(noWar), mk(), 'p1', noWar).units.u1.x, 1,
    'exploreMarchRadius 0: the knob changes contact behaviour — no march');
});

// B21: the wake-the-capabilities knobs are sweepable rules.json levers, each
// with an identity/documented default and a sweep that measurably changes AI
// behaviour (the marchRadius test above is the template).
function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

// B21(a): the attacker BUILD-ORDER slot fires above buildings/wonders while the
// empire is under its attacker target (rules.attackerPerCity/attackerBase).
test('B21(a): attackerPerCity is sweepable — a defended city builds the attacker slot', async () => {
  const { ai } = await load();
  // one defended city, settlers no longer scarce (two afield), an attacker
  // unlocked (iron-working -> legion), currently producing settlers.
  const mk = () => grassState(9, 9, {
    ud: { id: 'ud', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
    us1: { id: 'us1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
    us2: { id: 'us2', type: 'settlers', owner: 'p1', x: 8, y: 8, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } }
  }, { players: {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['bronze-working', 'iron-working'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const doneAll = { happiness: true, research: true, rates: true, government: true, buy: true };
  // default: armyTarget = 1 city * 1 + 0 = 1, no attackers yet -> build the legion
  const def = ai.pickCommand(mk(), 'p1', RULESET, Object.assign({}, doneAll));
  assert.strictEqual(def.item.id, 'legion', 'default attackerPerCity fields the offensive slot');
  // sweep to 0: armyTarget 0 -> the slot never fires; the city defends instead
  const swept = ai.pickCommand(mk(), 'p1', withRules({ attackerPerCity: 0 }), Object.assign({}, doneAll));
  assert.notStrictEqual(swept.item.id, 'legion', 'attackerPerCity 0: no attacker slot');
});

// B21(b): the research beeline pulls the earliest attacker tech, knob-weighted
// (rules.aiAttackerTechWeight). 0 = the old monarchy-only rush.
test('B21(b): aiAttackerTechWeight is sweepable — it steers the beeline', async () => {
  const { ai } = await load();
  const mk = () => grassState(9, 9, {}, {}, { players: {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const doneH = { happiness: true };
  const off = ai.pickCommand(mk(), 'p1', withRules({ aiAttackerTechWeight: 0 }), Object.assign({}, doneH));
  const on = ai.pickCommand(mk(), 'p1', withRules({ aiAttackerTechWeight: 5 }), Object.assign({}, doneH));
  assert.strictEqual(off.type, 'setResearch');
  assert.strictEqual(on.type, 'setResearch');
  assert.notStrictEqual(on.tech, off.tech, 'a heavy attacker-tech weight steers the beeline off the monarchy-only path');
});

// B21(c): rush-buy a threatened city's military production above the gold floor
// (rules.aiBuyThreshold). "no buys ever" dies here.
test('B21(c): aiBuyThreshold is sweepable — a flush, threatened city rush-buys', async () => {
  const { ai } = await load();
  // c9 threatened by an adjacent enemy, producing a defender, p1 flush with gold
  const mk = () => grassState(9, 9, {
    ue: { id: 'ue', type: 'legion', owner: 'p2', x: 6, y: 4, moves: 1, fortified: false, veteran: false },
    ud: { id: 'ud', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false }
  }, {
    c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  }, { players: {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 500, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const doneAll = { happiness: true, research: true, rates: true, government: true };
  const def = ai.pickCommand(mk(), 'p1', RULESET, Object.assign({}, doneAll));
  assert.strictEqual(def.type, 'buy', 'default threshold: a flush threatened city buys its defender');
  const swept = ai.pickCommand(mk(), 'p1', withRules({ aiBuyThreshold: 99999 }), Object.assign({}, doneAll));
  assert.ok(swept === null || swept.type !== 'buy', 'aiBuyThreshold above the treasury: no buy');
});

// B21(d): a share of the military scouts the fog (rules.aiScoutSharePct); 0 is
// the old incidental exploration. Live-knob proof: 0 marches, 100 scouts.
test('B21(d): aiScoutSharePct is sweepable — it diverts military to the fog', async () => {
  const { ai, hashState } = await load();
  const { createEngine } = await import('../engine/index.js');
  // east half explored (the enemy is visible there); west is fog. Two legions
  // in the field: as scouts they head into the western fog, else they march east.
  const W = 12, H = 5;
  const explored = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) explored.push(x >= 4 ? 1 : 0);
  const mk = () => grassState(W, H, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 5, y: 2, moves: 1, fortified: false, veteran: false },
    u2: { id: 'u2', type: 'legion', owner: 'p1', x: 6, y: 2, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'E', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  }, { players: {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, explored },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  // B23b: aiScoutQuotaByCities is now the primary scout selector; aiScoutSharePct
  // is retained as the ABSENT-TABLE fallback, so this sweep is exercised with the
  // quota table removed (the fallback path old sweeps still resolve through).
  const noTable = (share) => {
    const r = withRules({ aiScoutSharePct: share });
    delete r.rules.aiScoutQuotaByCities;
    return r;
  };
  const none = noTable(0);
  const all = noTable(100);
  const hNone = hashState(ai.runAiTurn(createEngine(none), mk(), 'p1', none));
  const hAll = hashState(ai.runAiTurn(createEngine(all), mk(), 'p1', all));
  assert.notStrictEqual(hAll, hNone, 'aiScoutSharePct (fallback) changes where the military goes (fog vs march)');
});

// A40 slice 1: regency stances. The HARD invariant first — balanced (and the
// omitted default) is the IDENTITY: pickCommand returns the exact same command
// with stance 'balanced', undefined, or an unknown value across crafted states.
test('AI stances: balanced / undefined / unknown are the byte-identical default', async () => {
  const { ai, engine } = await load();
  const crafted = [
    grassState(9, 9, { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 4, y: 4, moves: 1, fortified: false, veteran: false } }),
    grassState(9, 9, {}, { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } }),
    grassState(12, 5, { u1: { id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false } },
      { c9: { id: 'c9', name: 'T', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } })
  ];
  for (const st of crafted) {
    const base = ai.pickCommand(st, 'p1', RULESET, {});
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, 'balanced'), base, 'balanced == default');
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, undefined), base, 'undefined == default');
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, 'nonsense'), base, 'unknown stance falls back to balanced');
  }
});

test('AI stance defensive: garrisons two + prioritizes city walls', async () => {
  const { ai, engine } = await load();
  // a city with ONE guard, producing settlers, no enemy near
  const mk = () => grassState(9, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['masonry'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const defensive = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'defensive');
  assert.strictEqual(balanced.cities.c9.producing.id, 'settlers', 'balanced (1 guard, no threat): keeps expanding');
  assert.strictEqual(defensive.cities.c9.producing.id, 'militia', 'defensive: wants a second guard');
});

test('AI stance growth: builds settlers past the balanced cap', async () => {
  const { ai, engine } = await load();
  // 1 city, 2 settlers already exist → balanced is AT its ratio (2 < 2 false);
  // growth (base 3, div 1) still wants more
  const mk = () => grassState(14, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 6, y: 4, moves: 0, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'settlers', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'granary' } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const growth = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'growth');
  assert.notStrictEqual(balanced.cities.c9.producing.id, 'settlers', 'balanced: enough settlers, builds otherwise');
  assert.strictEqual(growth.cities.c9.producing.id, 'settlers', 'growth: keeps expanding');
});

test('AI stance science: prefers science rates when disorder-free', async () => {
  const { ai, engine } = await load();
  const mk = () => grassState(9, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const science = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'science');
  assert.strictEqual(balanced.players.p1.sciRate, 50, 'balanced never touches rates');
  assert.ok(science.players.p1.sciRate > 50, `science raises the science rate (got ${science.players.p1.sciRate})`);
});

// B11: the regent path (client playSeatLogged) and the AI round share ONE
// policy — pickCommand — and it never reads players[pid].human. Pin that a
// human:true seat gets the identical full empire policy (research, production,
// improvements), so "the regent skips the empire" can never regress into
// truth: the whole command stream must match the AI seat's byte for byte.
test('B11: a human seat (regency) gets the identical empire policy stream', async () => {
  const { ai, engine } = await load();
  const mk = (human) => grassState(14, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 5, y: 4, moves: 1, fortified: false, veteran: false },
      // u3 = settler rank 1 (the homeland IMPROVER) parked ON a worked tile
      // of c9 — its road job is underfoot, so startWork lands immediately
      u3: { id: 'u3', type: 'settlers', owner: 'p1', x: 4, y: 2, moves: 1, fortified: false, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  // three turns: the improver settler first WALKS to its job tile, then
  // startWork lands on a later turn — same shape either seat
  const stream = (human) => {
    let state = mk(human);
    const cmds = [];
    for (let round = 0; round < 3; round++) {
      const done = {};
      let guard = 100;
      while (guard-- > 0) {
        const cmd = ai.pickCommand(state, 'p1', RULESET, done);
        if (!cmd) break;
        const res = engine.applyCommand(state, cmd);
        if (res.ok) state = res.state;
        cmds.push(cmd);
      }
      let res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
      if (res.ok) state = res.state;
      res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p2' });
      if (res.ok) state = res.state;
    }
    return cmds;
  };
  const aiSeat = stream(false);
  const regentSeat = stream(true);
  assert.deepStrictEqual(regentSeat, aiSeat, 'the seat flag must not change the policy');
  assert.ok(aiSeat.some(c => c.type === 'setResearch'), 'idle research gets a pick');
  assert.ok(aiSeat.some(c => c.type === 'startWork'), 'the improver settler starts work');
});

// B13e: the AI now fields an OFFENSIVE army — a defended, settler-saturated,
// fully-built city builds an era-appropriate attacker instead of only settlers.
test('B13e: a maxed-out city builds an attacker, era-scaling with tech', async () => {
  const { ai, engine } = await load();
  // 1 city + a garrison (wantDefenders met) + 2 settlers (settler target met);
  // barracks is the only tech-free building so nextBuilding is exhausted, and
  // no wonder tech is known — so the loop reaches the attacker branch.
  const mk = (techs) => grassState(14, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 6, y: 4, moves: 0, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'settlers', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: ['barracks'], producing: { kind: 'building', id: 'barracks' } } },
    { players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs, researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const attackerFor = (techs) => ai.runAiTurn(engine, mk(techs), 'p1', RULESET).cities.c9.producing.id;
  assert.strictEqual(attackerFor(['iron-working']), 'legion', 'iron-working: legion (atk 3)');
  assert.strictEqual(attackerFor(['iron-working', 'mathematics']), 'catapult', 'mathematics: catapult (atk 6)');
  assert.strictEqual(attackerFor(['iron-working', 'mathematics', 'metallurgy']), 'cannon', 'metallurgy: cannon (atk 8)');
  // no offensive unit unlocked yet (only militia/phalanx-tier): stays defensive
  const noAttacker = ai.runAiTurn(engine, mk([]), 'p1', RULESET).cities.c9.producing.id;
  assert.notStrictEqual(noAttacker, 'legion', 'no attacker tech: does not build an attacker');
});

// B13b/B13d: the AI improver now mines shield terrain and upgrades roads to
// rails once Railroad is known — it was only ever roading + irrigating before.
test('B13d/B13b: improver mines a worked hills tile, then rails it with Railroad', async () => {
  const { ai, engine } = await load();
  // all-hills 9x9 so the city works hills tiles (minable); c9 pop 6 works
  // (3,3) among others (verified). u1=rank0 expander far off; u2=rank1
  // improver STANDING on the worked, roaded tile so it starts work in place.
  // pop-3 city works (4,4)(3,2)(4,2)(5,2); a fortified garrison keeps it out of
  // disorder so the worked set stays put. u0=garrison; u1=rank0 settler parked
  // ADJACENT to the city (can't found — spacing — so the settler count and
  // thus u2's rank stay stable); u2=rank1 improver STANDING on worked (4,2).
  const build = (techs, tile42) => {
    const tiles = [];
    for (let i = 0; i < 81; i++) tiles.push({ t: 'hills' });
    tiles[2 * 9 + 4] = Object.assign({ t: 'hills' }, tile42);
    return {
      version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
      map: { width: 9, height: 9, wrapX: false, tiles },
      units: {
        u0: { id: 'u0', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
        u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 5, y: 5, moves: 1, fortified: false, veteran: false },
        u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 4, y: 2, moves: 1, fortified: false, veteran: false } },
      cities: { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
      cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
      players: {
        p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs, researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
        p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
      rngState: 1
    };
  };
  // roaded (not mined) hills → the improver mines it (shields beat irrigation food)
  const mined = ai.runAiTurn(engine, build([], { road: true }), 'p1', RULESET);
  assert.strictEqual(mined.units.u2.working, 'mine', 'roaded hills gets mined');
  // roaded AND mined, Railroad known → the improver upgrades the road to rail
  const railed = ai.runAiTurn(engine, build(['railroad'], { road: true, mine: true }), 'p1', RULESET);
  assert.strictEqual(railed.units.u2.working, 'railroad', 'a finished road is upgraded to rail');
});

// B13g: a city with a known enemy within 8 walls up first (masonry known) —
// balanced no longer leaves threatened cities unwalled.
test('B13g: a threatened city builds city-walls first', async () => {
  const { ai, engine } = await load();
  // 2 fortified guards so the city is defended and reaches the building branch;
  // 2 parked settlers keep the settler count at target; masonry known.
  const mk = (enemyX) => {
    const tiles = [];
    for (let i = 0; i < 13 * 9; i++) tiles.push({ t: 'grassland' });
    return {
      version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
      map: { width: 13, height: 9, wrapX: false, tiles },
      units: {
        g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
        g2: { id: 'g2', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
        s1: { id: 's1', type: 'settlers', owner: 'p1', x: 3, y: 4, moves: 0, fortified: false, veteran: false },
        s2: { id: 's2', type: 'settlers', owner: 'p1', x: 5, y: 4, moves: 0, fortified: false, veteran: false },
        e1: { id: 'e1', type: 'legion', owner: 'p2', x: enemyX, y: 4, moves: 0, fortified: false, veteran: false } },
      cities: { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
      cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
      players: {
        p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['masonry'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
        p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } }, rngState: 1 };
  };
  const threatened = ai.runAiTurn(engine, mk(10), 'p1', RULESET); // enemy at (10,4): 6 tiles away
  assert.strictEqual(threatened.cities.c9.producing.id, 'city-walls', 'threatened + masonry → walls');
  const safe = ai.runAiTurn(engine, mk(99), 'p1', RULESET); // enemy off-map far
  assert.notStrictEqual(safe.cities.c9.producing.id, 'city-walls', 'no threat → no urgent walls');
});

test('a full AI-vs-AI game is deterministic and reaches an end', async () => {
  const { ai, engine, hashState } = await load();
  const play = () => {
    let state = engine.createGame({ seed: 4242, options: { width: 30, height: 20, players: PLAYERS } });
    let guard = 400;
    while (!state.gameOver && guard-- > 0) {
      const pid = state.activePlayer;
      state = ai.runAiTurn(engine, state, pid, RULESET);
      const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (res.ok) state = res.state;
    }
    return state;
  };
  const a = play();
  const b = play();
  assert.strictEqual(hashState(a), hashState(b), 'identical AI games from the same seed');
  assert.ok(Object.keys(a.cities).length >= 1, 'AI civilizations founded cities');
  // the game either ended or is still legally in progress after the cap
  if (a.gameOver) assert.ok(a.players[a.winner], 'winner is a real player');
});


// --- Batch 4 iteration 3 (docs/04): entertainers-local disorder management --

test('batch 4: a disordered city converts its worst tile to an entertainer', async () => {
  const { ai, engine } = await load();
  // pop 6, no garrison, contentCitizens 4 => unhappy 2 > happy 0 = disorder
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Riot', owner: 'p1', x: 4, y: 4, pop: 6, food: 20, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  const c = after.cities.c9;
  assert.ok(Array.isArray(c.workers), 'manual assignment set');
  assert.strictEqual(c.workers.length, 5, 'pop 6 works 5 tiles: one citizen entertains');
  assert.strictEqual(after.players.p1.luxRate, undefined, 'rates untouched — the cost stays local');
});

test('batch 4: no flap — the entertainer is NOT reverted while the auto layout would riot', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Riot', owner: 'p1', x: 4, y: 4, pop: 6, food: 20, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const once = ai.runAiTurn(engine, state, 'p1', RULESET);
  // run a second AI turn on the result: the hypothetical auto layout still
  // riots (nothing else changed), so the assignment must SURVIVE
  const twice = ai.runAiTurn(engine, once, 'p1', RULESET);
  assert.ok(Array.isArray(twice.cities.c9.workers), 'assignment kept');
  assert.strictEqual(twice.cities.c9.workers.length, 5, 'still one entertainer — no oscillation');
});

test('batch 4: a temple calms the city and the tiles go back to auto', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Calmed', owner: 'p1', x: 4, y: 4, pop: 5, food: 20, shields: 0, buildings: ['temple'], producing: { kind: 'unit', id: 'militia' }, workers: [0, 1, 2, 3] }
  });
  // pop 5 auto layout has ONE would-be rioter; the temple's contentBonus 1
  // calms exactly that one, so the hypothetical passes and the AI hands
  // the tiles back (pop 6 would need temple+market — one temple is not
  // enough, and the no-flap test above proves the guard holds there)
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.workers, undefined,
    'reverted to auto (setWorkers auto:true clears manual mode)');
});

// stance-mix v1: the 'builder' stance (defendFirst + econReserve 99 + attackerPct
// 0) builds economy in the NORMAL block after its full garrison — its zero-army
// removes the treadmill so the reserve is reached; wonders concentrate in the
// capital (bl>=2). Seeded per-civ assignment at createGame (aiBuilderPct). All
// dormant at pct=0 (no builder assigned -> balanced identity).
const DONE_ALL = { happiness: true, research: true, rates: true, government: true, buy: true };
// a defended, settler-satisfied city; 2 militia (builder wants 2), 4 settlers
// (builder settlerBase 3 + 1 city met), iron-working (legion attacker unlocked).
function builderCity(buildings, techs) {
  return grassState(9, 9, {
    d1: { id: 'd1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
    d2: { id: 'd2', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
    s1: { id: 's1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
    s2: { id: 's2', type: 'settlers', owner: 'p1', x: 8, y: 0, moves: 1, fortified: false, veteran: false },
    s3: { id: 's3', type: 'settlers', owner: 'p1', x: 0, y: 8, moves: 1, fortified: false, veteran: false },
    s4: { id: 's4', type: 'settlers', owner: 'p1', x: 8, y: 8, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: buildings, producing: { kind: 'unit', id: 'settlers' } }
  }, { players: {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: techs, researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
}

test('stance-mix: a builder city builds economy after its garrison; balanced builds the army', async () => {
  const { ai } = await load();
  const mk = () => builderCity([], ['bronze-working', 'iron-working']);
  // balanced: economy is dead-last, the standing-army slot wins -> an attacker
  const bal = ai.pickCommand(mk(), 'p1', RULESET, Object.assign({}, DONE_ALL), 'balanced');
  assert.strictEqual(bal.item.kind, 'unit', 'balanced: army above economy');
  // builder: the defBuild reserve fires after the 2-defender garrison -> a building
  const bld = ai.pickCommand(mk(), 'p1', RULESET, Object.assign({}, DONE_ALL), 'builder');
  assert.strictEqual(bld.item.kind, 'building', 'builder: economy reserve after the garrison');
});

test('stance-mix: a builder concentrates the wonder in its capital at pop-2+ buildings', async () => {
  const { ai } = await load();
  // c9 is the civ's only city -> its capital (capitalOf oldest-fallback). With a
  // missing building AND bl>=2, the capital builds the WONDER (concentration);
  // with bl<2 it builds the missing building first.
  const wonderAt = (bl) => {
    const built = bl === 2 ? ['barracks', 'granary'] : ['barracks'];
    return ai.pickCommand(builderCity(built, ['bronze-working', 'masonry']), 'p1', RULESET, Object.assign({}, DONE_ALL), 'builder').item;
  };
  assert.strictEqual(wonderAt(2).kind, 'wonder', 'capital at bl>=2: the wonder concentrates here');
  assert.strictEqual(wonderAt(1).kind, 'building', 'capital at bl<2: the missing building first');
});

test('stance-mix: runAiTurn reads player.stance (no explicit arg -> the assigned field drives)', async () => {
  const { ai } = await load();
  const state = builderCity([], ['bronze-working', 'iron-working']);
  state.players.p1.stance = 'builder';
  // no explicit stance arg -> the AI uses p1's assigned 'builder' field -> economy
  const cmd = ai.pickCommand(state, 'p1', RULESET, Object.assign({}, DONE_ALL));
  assert.strictEqual(cmd.item.kind, 'building', 'player.stance builder drives the economy reserve');
});

test('stance-mix: seeded assignment — pct 0 writes NO stance (identity); pct 35 is deterministic; humans excluded', async () => {
  const mapgen = await import('../engine/mapgen.js');
  const playerDefs = [];
  for (let i = 1; i <= 7; i++) playerDefs.push({ id: 'p' + i, name: 'C' + i, color: '#00f', human: i === 1 }); // p1 human
  // pct 0: NO player carries a stance field (absent = balanced back-compat)
  const g0 = mapgen.createGame({ seed: 424242, options: { width: 40, height: 25, players: playerDefs } }, withRules({ aiBuilderPct: 0 }));
  assert.ok(Object.values(g0.players).every(p => p.stance === undefined), 'pct 0: no stance field written');
  // pct 35: some AI civs are builders, the human never, deterministic across runs
  const a = mapgen.createGame({ seed: 424242, options: { width: 40, height: 25, players: playerDefs } }, withRules({ aiBuilderPct: 35 }));
  const b = mapgen.createGame({ seed: 424242, options: { width: 40, height: 25, players: playerDefs } }, withRules({ aiBuilderPct: 35 }));
  const builders = Object.keys(a.players).filter(id => a.players[id].stance === 'builder');
  assert.strictEqual(builders.length, 2, '6 AI civs * 35% -> 2 builders');
  assert.ok(a.players.p1.stance === undefined, 'the human seat is never a builder');
  assert.deepStrictEqual(builders, Object.keys(b.players).filter(id => b.players[id].stance === 'builder'),
    'the seeded assignment is deterministic (same seed -> same builders)');
});

// Government re-eval (specs/government-reeval.md): stance-linked adoption toward
// Republic — builder unconditional, balanced only when safe, aggressive holds
// Monarchy, and the revolt only ever moves UP the rank ladder (no thrash).
test('government re-eval: stance-linked adoption toward Republic', async () => {
  const { ai } = await load();
  const doneEarly = { happiness: true, research: true, rates: true }; // isolate the government decision
  const mk = (gov, enemy) => grassState(9, 9,
    Object.assign(
      { ud: { id: 'ud', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
      enemy ? { ue: { id: 'ue', type: 'legion', owner: 'p2', x: 6, y: 4, moves: 1, fortified: false, veteran: false } } : {}),
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    { players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['monarchy', 'republic'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, government: gov },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });

  // builder adopts Republic unconditionally — even with an enemy adjacent
  const b = ai.pickCommand(mk('monarchy', true), 'p1', RULESET, Object.assign({}, doneEarly), 'builder');
  assert.strictEqual(b.type, 'setGovernment');
  assert.strictEqual(b.government, 'republic', 'builder adopts Republic even under threat');

  // balanced HOLDS Monarchy while an enemy stands within threat range of a city
  const held = ai.pickCommand(mk('monarchy', true), 'p1', RULESET, Object.assign({}, doneEarly), 'balanced');
  assert.ok(held === null || !(held.type === 'setGovernment' && held.government === 'republic'), 'balanced holds Monarchy under threat');

  // balanced adopts Republic once the enemy is gone (peace returns)
  const adopt = ai.pickCommand(mk('monarchy', false), 'p1', RULESET, Object.assign({}, doneEarly), 'balanced');
  assert.strictEqual(adopt.type, 'setGovernment');
  assert.strictEqual(adopt.government, 'republic', 'balanced adopts Republic when safe');

  // aggressive tops out at Monarchy (never Republic), from despotism
  const agg = ai.pickCommand(mk('despotism', false), 'p1', RULESET, Object.assign({}, doneEarly), 'aggressive');
  assert.strictEqual(agg.type, 'setGovernment');
  assert.strictEqual(agg.government, 'monarchy', 'aggressive holds Monarchy by design');

  // monotonic: a Republic never revolts backward, even under threat
  const stay = ai.pickCommand(mk('republic', true), 'p1', RULESET, Object.assign({}, doneEarly), 'balanced');
  assert.ok(stay === null || stay.type !== 'setGovernment', 'no backward revolt from Republic');

  // back-compat: Republic unknown → the old Monarchy revolt still fires
  const early = grassState(9, 9,
    { ud: { id: 'ud', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    { players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['monarchy'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, government: 'despotism' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const bc = ai.pickCommand(early, 'p1', RULESET, Object.assign({}, doneEarly), 'builder');
  assert.strictEqual(bc.government, 'monarchy', 'Republic unknown: revolt to Monarchy first (back-compat)');
});

// xiv-ai §13 (regency economics, #1989): a balanced/regency seat running a
// SOLVABLE gold deficit must climb the deficit ladder (tax-bump first) instead
// of draining to 0 and disorder. Failing-test-first: today the rate branch is
// sciRates-stance-only, so balanced never adjusts and this returns non-rates.
test('§13: a solvable gold deficit raises the tax rate (balanced/regency, not just sciRates)', async () => {
  const { ai } = await load();
  // river+road grassland gives the city trade to tax; maint-4 buildings; at
  // tax 20 playerIncome nets -1 (deficit), and a bump to 30+ clears it (solvable).
  const tiles = [];
  for (let i = 0; i < 12 * 12; i++) tiles.push({ t: 'grassland', river: true, road: true });
  const deficit = {
    version: 1, turn: 5, year: -3800, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 12, height: 12, wrapX: false, tiles },
    units: { ud: { id: 'ud', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: { c9: { id: 'c9', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 8, food: 0, shields: 0, buildings: ['temple', 'library', 'marketplace', 'granary'], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c9'],
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 2, techs: ['pottery', 'ceremonial-burial', 'alphabet', 'writing', 'currency'], researching: 'x', bulbs: 0, taxRate: 20, sciRate: 80, government: 'despotism' } },
    rngState: 1
  };
  // everything but the economy is marked done, so pickCommand reaches the rate
  // step; default (balanced) stance is the regency shape that carries the bug.
  const doneEcon = { happiness: true, research: true, government: true, buy: true, launch: true };
  const cmd = ai.pickCommand(deficit, 'p1', RULESET, Object.assign({}, doneEcon));
  assert.ok(cmd && cmd.type === 'setRates' && cmd.tax > 20,
    'a solvable deficit (net -1 at tax 20) must raise tax; got ' + JSON.stringify(cmd));
});

// xiv-ai §14 (treasury): a large treasury rushes a non-defensive build (settler/
// army) so the AI spends its hoard instead of sitting on gold. rush-current-only.
test('§14 surplus lever: a large treasury rushes an in-production settler', async () => {
  const { ai } = await load();
  const tiles = [];
  for (let i = 0; i < 9 * 9; i++) tiles.push({ t: 'grassland' });
  const st = {
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 9, height: 9, wrapX: false, tiles }, units: {}, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: { c9: { id: 'c9', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 5, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    cityOrder: ['c9'],
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 5000, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const done = { happiness: true, research: true, rates: true, government: true, diplo: {} };
  const cmd = ai.pickCommand(st, 'p1', RULESET, done);
  assert.ok(cmd && cmd.type === 'buy' && cmd.cityId === 'c9',
    'gold 5000 (> aiSurplusBuyThreshold) rushes the in-production settler; got ' + JSON.stringify(cmd));
  // control: below the threshold, no surplus buy (the settler is left to build out)
  st.players.p1.gold = 300;
  const cmd2 = ai.pickCommand(st, 'p1', RULESET, { happiness: true, research: true, rates: true, government: true, diplo: {} });
  assert.ok(!cmd2 || cmd2.type !== 'buy', 'gold 300 (< threshold) does NOT surplus-rush; got ' + JSON.stringify(cmd2));
});

// xiv-ai §14 F2: a unit rejected with reason zoc 3 turns running is DROPPED for
// the turn (stops the ping-pong burn); it re-plans next turn (runAiTurn clears).
test('§14 F2: a unit with zocBlocks>=3 is skipped by the move loop', async () => {
  const { ai } = await load();
  const tiles = [];
  for (let i = 0; i < 9 * 9; i++) tiles.push({ t: 'grassland' });
  const wide = [];
  for (let i = 0; i < 12 * 5; i++) wide.push({ t: 'grassland' });
  const mk = (zoc) => ({
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 12, height: 5, wrapX: false, tiles: wide },
    units: { u1: Object.assign({ id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false }, zoc !== undefined ? { zocBlocks: zoc } : {}) },
    cities: { c9: { id: 'c9', name: 'Target', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  });
  const done = () => ({ happiness: true, research: true, rates: true, government: true, buy: true, launch: true, diplo: { p2: true } });
  // control: without zoc blocks the legion marches east toward the enemy city
  const free = ai.pickCommand(mk(undefined), 'p1', RULESET, done());
  assert.ok(free && free.type === 'moveUnit' && free.unitId === 'u1',
    'the legion without zoc blocks DOES march (control); got ' + JSON.stringify(free));
  // with zocBlocks>=3 the same unit is dropped (no move issued this turn)
  const blocked = ai.pickCommand(mk(3), 'p1', RULESET, done());
  assert.ok(!blocked || blocked.type !== 'moveUnit' || blocked.unitId !== 'u1',
    'a zocBlocks>=3 unit is not moved; got ' + JSON.stringify(blocked));
});

// xiv-ai XII.5b (space-as-project, #1899/#1901/#1916): a space-COMMITTED civ
// gold-rushes its in-production spaceship PART with a surplus treasury (Apollo,
// a WONDER, is never rushed). The commit gate = spaceDriveOn(stance) +
// eligibility (own tech era >= industrial, research-leader, secure core, game
// has time) + a peaceful snapshot (building/expanding mode, none/low threat).
test('XII.5b parts-rush: a committed civ rushes its in-production ss-part', async () => {
  const { ai } = await load();
  const tiles = [];
  for (let i = 0; i < 9 * 9; i++) tiles.push({ t: 'grassland' });
  // c1 builds an ss-part (kind ss-part reads as 'other' in the snapshot); c2
  // builds infrastructure so the empire-wide mode stays 'building' (a single
  // ss-part city alone reads as 'defending' and would fail the commit gate).
  const mk = (techs, stance) => ({
    version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 9, height: 9, wrapX: false, tiles }, units: {}, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: {
      c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'ss-part', id: 'structural' } },
      c2: { id: 'c2', name: 'Two', owner: 'p1', x: 7, y: 7, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' } }
    },
    cityOrder: ['c1', 'c2'],
    players: { p1: Object.assign({ id: 'p1', name: 'A', color: '#00f', human: false, gold: 5000, techs, researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }, stance ? { stance } : {}) },
    rngState: 1
  });
  const done = { happiness: true, research: true, rates: true, government: true, diplo: {} };
  // committed: science stance + space-flight (era modern >= industrial), secure
  // single-player core, year < endYear, peaceful mode -> rushes the ss-part.
  const cmd = ai.pickCommand(mk(['space-flight'], 'science'), 'p1', RULESET, Object.assign({}, done));
  assert.ok(cmd && cmd.type === 'buy' && cmd.cityId === 'c1',
    'a committed civ with a surplus treasury rushes its ss-part; got ' + JSON.stringify(cmd));
  // control A: ancient era (no industrial+ tech) fails the eligibility gate.
  const anc = ai.pickCommand(mk([], 'science'), 'p1', RULESET, Object.assign({}, done));
  assert.ok(!anc || anc.type !== 'buy', 'an ancient-era civ is not commit-eligible; got ' + JSON.stringify(anc));
  // control B: a conquest stance fails spaceDriveOn (not in victoryDrive.spaceStances).
  const agg = ai.pickCommand(mk(['space-flight'], 'aggressive'), 'p1', RULESET, Object.assign({}, done));
  assert.ok(!agg || agg.type !== 'buy', 'a conquest-stance civ does not commit; got ' + JSON.stringify(agg));
});

// xiv-ai XII.5b Q3 (path-preferring research): a committed civ restricts its
// beeline to the space-flight prereq closure (space-flight + each ss-part tech),
// superseding the monarchy/attacker/nav paths. With the full computers-prereq
// chain in hand, the on-path researchable set is a known 5 techs; the off-path
// modern/renaissance side techs (monarchy, democracy, religion, ...) are excluded.
test('XII.5b path-research: a committed civ beelines the space-flight closure', async () => {
  const { ai } = await load();
  const tiles = [];
  for (let i = 0; i < 9 * 9; i++) tiles.push({ t: 'grassland' });
  const chain = ['electronics', 'mathematics', 'engineering', 'electricity', 'alphabet', 'masonry', 'wheel', 'construction', 'metallurgy', 'magnetism', 'currency', 'gunpowder', 'university', 'navigation', 'physics', 'bronze-working', 'iron-working', 'invention', 'philosophy', 'astronomy', 'map-making', 'literacy', 'mysticism', 'code-of-laws', 'writing', 'ceremonial-burial'];
  const st = {
    version: 1, turn: 260, year: 1900, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 9, height: 9, wrapX: false, tiles }, units: {}, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' } } },
    cityOrder: ['c1'],
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: chain, researching: '', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science' } },
    rngState: 1
  };
  const onPath = ['bridge-building', 'computers', 'republic', 'steam-engine', 'trade'];
  const cmd = ai.pickCommand(st, 'p1', RULESET, { happiness: true });
  assert.strictEqual(cmd && cmd.type, 'setResearch', 'the research phase picks a tech; got ' + JSON.stringify(cmd));
  assert.ok(onPath.includes(cmd.tech),
    'a committed civ researches an on-path tech (space-flight closure), not an off-path side tech; got ' + cmd.tech);
});

// §12 (settler inlet-pathing, #2056): the expander must navigate AROUND a deep
// ocean inlet to a frontier site — the greedy chebyshev step (safeDirToward)
// dead-ends at the inlet mouth and the settler never crosses. A crafted 6-deep
// vertical inlet (crossing only at y=1) between the settler and the only
// foundable site (grassland across the water; the near side is unfoundable
// desert) reproduces it. Replay-fixture-FIRST per #1989: pre-fix this FAILS.
function inletState() {
  const W = 13, H = 9, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 'desert';
    if (x === 6 && y >= 2 && y <= 7) t = 'ocean'; // 6-deep inlet, land crossing only at y=1
    if (x >= 9 && x <= 11 && y >= 3 && y <= 5) t = 'grassland'; // the only foundable ground
    const tile = { t };
    if (x === 10 && y === 4) tile.river = true; // the clearly-best far site
    tiles.push(tile);
  }
  const explored = [];
  for (let i = 0; i < W * H; i++) explored.push(1);
  return {
    version: 1, turn: 5, year: -3800, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 4, y: 4, moves: 1, fortified: false, veteran: false } },
    cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 2, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, explored } },
    rngState: 1
  };
}
test('§12: an expander settler routes AROUND a deep ocean inlet to the far site', async () => {
  const { ai, engine } = await load();
  let s = inletState();
  for (let turn = 0; turn < 16; turn++) {
    s = ai.runAiTurn(engine, s, 'p1', RULESET, []);
    const res = engine.applyCommand(s, { type: 'endTurn', playerId: 'p1' });
    if (res.ok) s = res.state;
  }
  // success = the settler crossed the inlet (x > 6) or a city was founded on the
  // far side. Pre-fix the greedy step strands it at x<=5 (near side) forever.
  const u = s.units.u1;
  const farCity = Object.keys(s.cities).some(cid => s.cities[cid].owner === 'p1' && s.cities[cid].x > 6);
  const crossed = (u !== undefined && u.x > 6) || farCity;
  assert.ok(crossed,
    '§12: the expander must path around the inlet to the far side; got '
    + (u ? `settler stuck at ${u.x},${u.y}` : 'settler gone') + `, farCity=${farCity}`);
});
