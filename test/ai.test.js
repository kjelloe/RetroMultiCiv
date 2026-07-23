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

// #26 archetype-wonders: a HIGH-appetite (builder) civ with a shield-rich, defended,
// unthreatened capital builds a STANCE-appropriate wonder (pyramids = builder affinity #1,
// masonry known); a NONE-appetite (aggressive) control never does. The cross-language
// acceptance fixture (deterministic — no RNG in the pick).
test('#26 wonderAppetite: builder capital picks a wonder, aggressive control does not', async () => {
  const { ai, engine } = await load();
  const forest = (stance) => {
    const W = 9, H = 9, tiles = [];
    for (let i = 0; i < W * H; i++) tiles.push({ t: 'forest' });
    return {
      version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
      map: { width: W, height: H, wrapX: false, tiles },
      units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
      cities: { c9: { id: 'c9', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
      players: {
        p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['masonry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, stance },
        p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
      },
      rngState: 1
    };
  };
  const builder = ai.runAiTurn(engine, forest('builder'), 'p1', RULESET);
  assert.strictEqual(builder.cities.c9.producing.kind, 'wonder', 'builder (HIGH appetite): a wonder');
  assert.strictEqual(builder.cities.c9.producing.id, 'pyramids', 'the stance affinity #1 (masonry-available)');
  const aggressive = ai.runAiTurn(engine, forest('aggressive'), 'p1', RULESET);
  assert.notStrictEqual(aggressive.cities.c9.producing.kind, 'wonder', 'aggressive (NONE appetite): never a wonder');
});

// #30 unit-bloat drain: a civ well OVER its capped attacker target, at peace, disbands ONE
// obsolete attacker per turn (reusing the existing disband command). The cap stops new growth;
// this valve recovers the legacy 1002-unit bloat. Deterministic; a safe (no enemy near) obsolete
// unit only. An under-cap civ never disbands.
test('#30 disband valve: an over-cap at-peace civ disbands one obsolete attacker', async () => {
  const { ai } = await load();
  const W = 9, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const mk = (n) => {
    const units = {};
    for (let i = 0; i < n; i++) units['u' + i] = { id: 'u' + i, type: 'legion', owner: 'p1', x: i % 9, y: (Math.floor(i / 9)) % 9, moves: 1, fortified: false, veteran: false };
    return {
      version: 1, turn: 200, year: 1, activePlayer: 'p1', playerOrder: ['p1'],
      map: { width: W, height: H, wrapX: false, tiles }, units, wonders: {}, nextUnitId: 999, nextCityId: 10,
      cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c1'],
      // conscription obsoletes the legion; republic (no gov advance), 0 gold (no rush) so the
      // empire cascade reaches the disband valve.
      players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['conscription'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, government: 'republic' } },
      rngState: 1
    };
  };
  const doneFlags = { happiness: true, research: true, rates: true, government: true, diplo: {} };
  // 60 obsolete legions, 1 city -> armyTarget = 1 (capped at 50 is moot here); 60 >> target +
  // disbandOverBy(4) -> disband. (For a WIDE empire the cap bounds the target; the valve drains
  // whatever is over the capped target.)
  const cmd = ai.pickCommand(mk(60), 'p1', RULESET, Object.assign({}, doneFlags));
  assert.strictEqual(cmd.type, 'disband', 'over-target at-peace -> disband; got ' + JSON.stringify(cmd));
  // within target + hysteresis (3 <= 1 + 4): no disband.
  const few = ai.pickCommand(mk(3), 'p1', RULESET, Object.assign({}, doneFlags));
  assert.ok(!few || few.type !== 'disband', 'within target+hysteresis civ keeps its army; got ' + JSON.stringify(few));
});

// #30 STRENGTHEN (#2289): the valve is CAP-gated, NOT obsolescence-gated — the endemic-war seeds
// are low-tech (units never obsolete), so it must drain OVER-CAP CURRENT-GEN units too. Here the
// phalanx are NOT obsolete (no gunpowder) yet the over-garrison-cap civ still disbands them.
test('#30 disband valve: an over-garrison-cap civ disbands a CURRENT-gen defender (cap-gated, not obsolescence-gated)', async () => {
  const { ai } = await load();
  const W = 9, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const mk = (n) => {
    const units = {};
    // phalanx = a DEFENDER (atk 1 < def 2); with NO gunpowder it is CURRENT-GEN (not obsolete).
    for (let i = 0; i < n; i++) units['u' + i] = { id: 'u' + i, type: 'phalanx', owner: 'p1', x: i % 9, y: (Math.floor(i / 9)) % 9, moves: 1, fortified: false, veteran: false };
    return {
      version: 1, turn: 200, year: 1, activePlayer: 'p1', playerOrder: ['p1'],
      map: { width: W, height: H, wrapX: false, tiles }, units, wonders: {}, nextUnitId: 999, nextCityId: 10,
      cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c1'],
      // techs=[] -> phalanx NOT obsolete (the pre-strengthen valve would NOT fire); balanced
      // armyCapPerCity=4 -> garrison cap = 1*4 = 4.
      players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, government: 'republic' } },
      rngState: 1
    };
  };
  const doneFlags = { happiness: true, research: true, rates: true, government: true, diplo: {} };
  // 60 current-gen phalanx, 1 city -> garrison cap 4; 60 > 4 + disbandOverBy(4) -> disband regardless of obsolescence.
  const big = mk(60);
  const cmd = ai.pickCommand(big, 'p1', RULESET, Object.assign({}, doneFlags));
  assert.strictEqual(cmd.type, 'disband', 'over garrison cap at-peace -> disband a defender even when not obsolete; got ' + JSON.stringify(cmd));
  assert.strictEqual(big.units[cmd.unitId].type, 'phalanx', 'the disbanded unit is the over-cap phalanx defender');
  // within the garrison cap + hysteresis (5 <= 4 + 4): no disband.
  const few = ai.pickCommand(mk(5), 'p1', RULESET, Object.assign({}, doneFlags));
  assert.ok(!few || few.type !== 'disband', 'within garrison cap civ keeps its defenders; got ' + JSON.stringify(few));
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
  // control A: ancient era (no industrial+ tech) fails the eligibility gate — never rushes the
  // SS-PART (c1). #30: the widened surplus lever may rush a plain BUILDING (c2 temple) instead, so
  // the commit check is "does not rush c1", not "does not buy at all".
  const anc = ai.pickCommand(mk([], 'science'), 'p1', RULESET, Object.assign({}, done));
  assert.ok(!anc || anc.cityId !== 'c1', 'an ancient-era civ never rushes the ss-part; got ' + JSON.stringify(anc));
  // control B: a conquest stance fails spaceDriveOn — never rushes the ss-part (may rush a building).
  const agg = ai.pickCommand(mk(['space-flight'], 'aggressive'), 'p1', RULESET, Object.assign({}, done));
  assert.ok(!agg || agg.cityId !== 'c1', 'a conquest-stance civ never rushes the ss-part; got ' + JSON.stringify(agg));
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

// XII.5b-tune (#2113 sweep / #2117 ruling): a space-COMMITTED civ must SURVIVE a
// transient border skirmish. The 9-metric witness sweep found 0/25 launches, 100%
// abandon — spaceCommitted re-evaluated an every-turn global-peace gate, so any
// border war (mode -> defending, threat -> med) broke the ~150-turn project before
// it could build a single part. The RULED fix (predicate-relax-first, my lean):
// tolerate defending mode + med threat; abandon ONLY at mode 'warring' or threat
// 'high'. The capital-safety abandon condition already lives in spaceCommitEligible
// (ai.js:655-656), so the commit persists through border wars while the core is
// safe. Replay-fixture-FIRST (#1989): pre-fix the skirmish case FAILS.
test('XII.5b-tune: a committed civ keeps its commit through a border skirmish (safe capital)', async () => {
  const { ai } = await load();
  const { strategicSnapshot } = await import('../shared/strategic.js');
  const W = 30, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  // c1 (capital, far from any enemy) builds an ss-part; c2 (border) builds a
  // DEFENDER; three p2 units sit next to c2 -> threat 'med', mode 'defending'. The
  // capital stays clear (enemyNear(cap)=false) so spaceCommitEligible holds.
  const base = () => ({
    version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles }, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: {
      c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'ss-part', id: 'structural' } },
      c2: { id: 'c2', name: 'Front', owner: 'p1', x: 25, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'phalanx' } }
    },
    cityOrder: ['c1', 'c2'],
    units: {
      e1: { id: 'e1', type: 'phalanx', owner: 'p2', x: 24, y: 4, moves: 1 },
      e2: { id: 'e2', type: 'phalanx', owner: 'p2', x: 26, y: 4, moves: 1 },
      e3: { id: 'e3', type: 'phalanx', owner: 'p2', x: 25, y: 5, moves: 1 }
    },
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 20, techs: ['space-flight'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  });
  const st = base();
  // the scenario reads exactly as #2113 describes: defending + med, capital safe.
  const snap = strategicSnapshot(st, 'p1', RULESET);
  assert.strictEqual(snap.mode, 'defending', 'fixture: border skirmish -> defending mode; got ' + snap.mode);
  assert.strictEqual(snap.threat, 'med', 'fixture: three near-c2 enemies -> med threat; got ' + snap.threat);
  assert.strictEqual(ai.spaceCommitEligible(st, 'p1', RULESET), true, 'capital is safe -> commit-eligible');
  // THE FIX: pre-fix this is false (defending/med break the every-turn peace gate);
  // post-fix the commit survives the skirmish.
  assert.strictEqual(ai.spaceCommitted(st, 'p1', RULESET), true,
    'a committed civ with a SAFE CAPITAL keeps its commit through a border skirmish (defending mode, med threat)');
  // XII.5b latch (#2125): a HIGH-threat SPIKE with no accumulated streak SURVIVES —
  // only a SUSTAINED siege abandons (see the latch test below). Pre-latch this abandoned.
  const hi = base();
  for (let i = 0; i < 8; i++) hi.units['h' + i] = { id: 'h' + i, type: 'phalanx', owner: 'p2', x: 24, y: (i % 3) + 3, moves: 1 };
  assert.strictEqual(strategicSnapshot(hi, 'p1', RULESET).threat, 'high', 'control: many enemies -> high threat');
  assert.strictEqual(ai.spaceCommitted(hi, 'p1', RULESET), true, 'a HIGH-threat SPIKE survives (streak still below patience)');
  // control WARRING: c2 builds an ATTACKER while threatened -> mode 'warring' -> abandoned.
  const war = base();
  war.cities.c2.producing = { kind: 'unit', id: 'catapult' };
  assert.strictEqual(strategicSnapshot(war, 'p1', RULESET).mode, 'warring', 'control: attacker+threat -> warring mode');
  assert.strictEqual(ai.spaceCommitted(war, 'p1', RULESET), false, 'a WARRING civ abandons the commit');
});

// DANGER-ABANDON (#2138, user-ruled): the threat-metric latch was REMOVED — its signal
// misfired three re-witnesses running (the latch STRUCTURE was sound, the threat read was
// not). A committed civ now MAINTAINS through a border skirmish ANYWHERE and abandons ONLY
// on CONCRETE danger: mode 'warring', an enemy ADJACENT to the capital (cheb 1), or a CITY
// LOST since last turn (ownedCities < the record). Recommit is possible once danger clears.
test('danger-abandon: skirmish-anywhere survives; city-loss + capital-adjacency abandon; recommit works', async () => {
  const { ai } = await load();
  const W = 30, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  // committed-eligible (space-flight, science); capital c1 at (4,4) FAR from enemies; c2
  // (border, x=25) under an 8-unit skirmish, building a DEFENDER -> mode 'defending'.
  const base = () => {
    const units = {};
    for (let i = 0; i < 8; i++) units['e' + i] = { id: 'e' + i, type: 'phalanx', owner: 'p2', x: 24, y: (i % 3) + 3, moves: 1 };
    return {
      version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
      map: { width: W, height: H, wrapX: false, tiles }, wonders: {}, nextUnitId: 50, nextCityId: 10,
      cities: {
        c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'ss-part', id: 'structural' } },
        c2: { id: 'c2', name: 'Front', owner: 'p1', x: 25, y: 4, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'phalanx' } }
      },
      cityOrder: ['c1', 'c2'], units,
      players: {
        p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 20, techs: ['space-flight'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science' },
        p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
      },
      rngState: 1
    };
  };
  // 1) SKIRMISH ANYWHERE survives (a border war far from the capital, no city lost).
  assert.strictEqual(ai.spaceCommitted(base(), 'p1', RULESET), true, 'a border skirmish away from the capital does NOT abandon');
  // 2) CITY LOST since last turn -> abandon (recorded 3, now owns 2); no loss -> holds.
  const lost = base(); lost.players.p1.spaceCities = 3;
  assert.strictEqual(ai.spaceCommitted(lost, 'p1', RULESET), false, 'a city lost since last turn abandons');
  const held = base(); held.players.p1.spaceCities = 2;
  assert.strictEqual(ai.spaceCommitted(held, 'p1', RULESET), true, 'no city lost -> the commit holds');
  // 3) CAPITAL ADJACENCY -> abandon (an enemy unit next to c1 at (5,4)).
  const cap = base(); cap.units.eCap = { id: 'eCap', type: 'phalanx', owner: 'p2', x: 5, y: 4, moves: 1 };
  assert.strictEqual(ai.spaceCommitted(cap, 'p1', RULESET), false, 'an enemy adjacent to the capital abandons');
  // 4) the city RECORD (updateSpaceCityRecord stamps the owned-city count) + ownedCities.
  const rec = base();
  ai.updateSpaceCityRecord(rec, 'p1', RULESET);
  assert.strictEqual(rec.players.p1.spaceCities, 2, 'records the 2 owned cities');
  assert.strictEqual(ai.ownedCities(rec, 'p1'), 2, 'ownedCities counts p1 cities');
  // RECOMMIT after a loss: the turn OF the loss abandons (record 2, now 1); next turn the
  // record refreshes to 1 and, with the danger gone, the civ recommits.
  const rc = base(); delete rc.cities.c2; rc.cityOrder = ['c1']; rc.players.p1.spaceCities = 2;
  assert.strictEqual(ai.spaceCommitted(rc, 'p1', RULESET), false, 'the turn a city is lost: abandons');
  ai.updateSpaceCityRecord(rc, 'p1', RULESET);
  assert.strictEqual(ai.spaceCommitted(rc, 'p1', RULESET), true, 'next turn (record refreshed, danger gone): recommits');
});

// apollo-narrow (#2160, user-ruled STAGED-BOTH slice 1): a space-COMMITTED civ that
// holds Apollo's tech and has Apollo unbuilt builds apollo-program in its CAPITAL as its
// TOP choice — opening the ss-part gate EARLIER than spaceDriveEligible (which waits for
// EVERY part tech). space-flight is Apollo's tech + the 'structural' part tech, but NOT
// plastics/robotics, so a space-flight-only civ is committed yet NOT spaceDriveEligible.
// Fixture-FIRST (#1989): pre-fix the committed capital builds a defender, not Apollo.
test('apollo-narrow: committed+tech+unbuilt builds apollo-program top; uncommitted unchanged; Apollo-active -> parts', async () => {
  const { ai, engine } = await load();
  const W = 30, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const base = () => ({
    version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles }, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: {
      c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'],
    units: { d1: { id: 'd1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 20, techs: ['space-flight'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  });
  assert.strictEqual(ai.spaceCommitted(base(), 'p1', RULESET), true, 'base() is space-committed (has Apollo tech, secure, peaceful)');
  // 1) COMMITTED + Apollo tech + Apollo unbuilt -> the capital builds apollo-program.
  const s1 = ai.runAiTurn(engine, base(), 'p1', RULESET);
  assert.deepStrictEqual(s1.cities.c1.producing, { kind: 'wonder', id: 'apollo-program' }, 'a committed civ builds Apollo as its top choice');
  // 2) UNCOMMITTED control (aggressive = not a spaceStance) -> NOT Apollo.
  const unc = base(); unc.players.p1.stance = 'aggressive';
  assert.strictEqual(ai.spaceCommitted(unc, 'p1', RULESET), false, 'aggressive stance is not space-committed');
  const s2 = ai.runAiTurn(engine, unc, 'p1', RULESET);
  assert.notDeepStrictEqual(s2.cities.c1.producing, { kind: 'wonder', id: 'apollo-program' }, 'an uncommitted civ does NOT build Apollo (byte-identical path)');
  // 3) Apollo ALREADY ACTIVE + all part techs -> the capital builds a ship PART, not a second Apollo.
  const act = base();
  act.wonders = { 'apollo-program': 'c1' };
  act.players.p1.techs = ['space-flight', 'plastics', 'robotics'];
  const s3 = ai.runAiTurn(engine, act, 'p1', RULESET);
  assert.strictEqual(s3.cities.c1.producing.kind, 'ss-part', 'Apollo active -> the capital builds a ship part, never a second Apollo');
});

// radius-mismatch fix (#2186/#2187): the space BUILD guards used !threatened (enemyNear
// cap, threatRadius=8) while the COMMIT side gates on concrete cheb-1 adjacency (#2138).
// So a committed capital (no cheb-1 enemy) with a DISTANT enemy (cheb 2..8) stayed
// committed but never built Apollo — the endemic-war 0-launches blocker. The fix migrates
// both space guards (apollo-narrow + XII.5 parts) to cheb-1. Fixture-FIRST: (a) FAILS pre-fix.
test('radius-mismatch: a committed capital with a DISTANT (cheb 2..8) enemy builds Apollo; a cheb-1 enemy reverts', async () => {
  const { ai, engine } = await load();
  const W = 30, H = 9, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const base = (enemyX) => ({
    version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles }, wonders: {}, nextUnitId: 50, nextCityId: 10,
    cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'],
    units: {
      d1: { id: 'd1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      e1: { id: 'e1', type: 'phalanx', owner: 'p2', x: enemyX, y: 4, moves: 1, fortified: false, veteran: false }
    },
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 20, techs: ['space-flight'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science', explored: Array.from({ length: W * H }, () => 1) },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  });
  // (a) enemy at (7,4) = cheb-3 from the capital (4,4): within radius-8 but not adjacent.
  const distant = base(7);
  assert.strictEqual(ai.spaceCommitted(distant, 'p1', RULESET), true, 'a cheb-3 enemy leaves the civ committed');
  const sa = ai.runAiTurn(engine, distant, 'p1', RULESET);
  assert.deepStrictEqual(sa.cities.c1.producing, { kind: 'wonder', id: 'apollo-program' }, 'committed + distant enemy -> builds Apollo (the fix)');
  // (b) enemy at (5,4) = cheb-1 (adjacent): concrete danger -> NOT committed -> reverts to defense.
  const adjacent = base(5);
  assert.strictEqual(ai.spaceCommitted(adjacent, 'p1', RULESET), false, 'a cheb-1 (adjacent) enemy abandons the commit');
  const sb = ai.runAiTurn(engine, adjacent, 'p1', RULESET);
  assert.notDeepStrictEqual(sb.cities.c1.producing, { kind: 'wonder', id: 'apollo-program' }, 'committed-broken by adjacency -> reverts to defense, not Apollo');
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

// naval-loop S1 (#2195 Q4): landComponent = the connected component of contiguous LAND
// (a continent; islands separate); isOverseasSite = the target is on a different landmass.
test('naval-loop S1: landComponent + isOverseasSite (continent flood-fill)', async () => {
  const { ai } = await load();
  // 7x3: continent A (x0..2) | sea column (x3) | continent B (x4..6), all land else.
  const W = 7, H = 3, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x === 3 ? 'ocean' : 'grassland' });
  const state = { map: { width: W, height: H, wrapX: false, tiles } };
  const compA = ai.landComponent(state, 1, 1, RULESET);
  assert.strictEqual(compA[1 * W + 0] === true && compA[1 * W + 2] === true, true, 'continent A tiles in the component');
  assert.strictEqual(compA[1 * W + 4] === true, false, 'continent B is NOT in A (sea separates them)');
  assert.strictEqual(compA[1 * W + 3] === true, false, 'the sea tile is not land');
  assert.strictEqual(ai.isOverseasSite(state, 1, 1, 5, 1, RULESET), true, 'B is overseas from A');
  assert.strictEqual(ai.isOverseasSite(state, 1, 1, 2, 1, RULESET), false, 'a same-continent tile is not overseas');
  // wrapX: with wrap, the two sides join through the seam ONLY if the seam is land.
  const wrap = { map: { width: W, height: H, wrapX: true, tiles } };
  assert.strictEqual(ai.isOverseasSite(wrap, 1, 1, 5, 1, RULESET), false, 'wrapX: x6-x0 land seam joins A and B into one continent');
  // a water start tile -> empty component
  assert.deepStrictEqual(ai.landComponent(state, 3, 1, RULESET), {}, 'a sea start tile has no land component');
});

// naval-loop S2 (#2195 Q1): bestCarrierUnit = best available sea unit with `transport`
// capacity (trireme from map-making; the dedicated transport once industrialization is in).
test('naval-loop S2: bestCarrierUnit picks the best available carrier', async () => {
  const { ai } = await load();
  const mk = techs => ({ techs });
  assert.strictEqual(ai.bestCarrierUnit(mk([]), RULESET), null, 'no carrier tech -> null');
  assert.strictEqual(ai.bestCarrierUnit(mk(['map-making']), RULESET), 'trireme', 'map-making -> trireme (cap 2)');
  assert.strictEqual(ai.bestCarrierUnit(mk(['map-making', 'navigation']), RULESET), 'sail', 'navigation -> sail (cap 3 > trireme 2)');
  assert.strictEqual(ai.bestCarrierUnit(mk(['map-making', 'navigation', 'magnetism']), RULESET), 'frigate', 'magnetism -> frigate (cap 4)');
  assert.strictEqual(ai.bestCarrierUnit(mk(['map-making', 'navigation', 'magnetism', 'industrialization']), RULESET), 'transport', 'industrialization -> transport (cap 8)');
});

// naval-loop S3 + naval-presence M3: seaStepToward (bounded sea-BFS to a landfall adjacent
// the target land) is CARRIER-SAFE — a coastal (openSeaLoss) hull only routes through land-
// adjacent sea, an ocean-capable hull crosses open water. + nearestOwnCarrier/carrierFreeSlots.
test('naval-loop S3 / M3: seaStepToward is carrier-safe; nearestOwnCarrier finds a free carrier', async () => {
  const { ai } = await load();
  // 7x3: land col x0..2 (continent A) | sea x3..5 (3-wide OPEN OCEAN) | land x6 (continent B).
  const W = 7, H = 3, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: (x >= 3 && x <= 5) ? 'ocean' : 'grassland' });
  const state = {
    map: { width: W, height: H, wrapX: false, tiles },
    units: {
      sh: { id: 'sh', type: 'trireme', owner: 'p1', x: 3, y: 1, moves: 3, fortified: false, veteran: false },
      st: { id: 'st', type: 'settlers', owner: 'p1', x: 1, y: 1, moves: 1, fortified: false, veteran: false, aboard: 'sh' }
    }
  };
  // M3: a TRIREME (openSeaLoss) may NOT cross the 3-wide open ocean — the middle tile (4,1)
  // is not land-adjacent, so it would sink; seaStepToward refuses (null, it holds coast).
  assert.strictEqual(ai.seaStepToward(state, state.units.sh, 6, 1, RULESET), null,
    'M3: a trireme refuses the open-ocean crossing (would sink)');
  // an OCEAN-CAPABLE hull (sail, no openSeaLoss) crosses the same ocean toward landfall (5,1).
  const sail = { id: 'sl', type: 'sail', owner: 'p1', x: 3, y: 1, moves: 3 };
  const sdir = ai.seaStepToward(Object.assign({}, state, { units: { sl: sail } }), sail, 6, 1, RULESET);
  assert.ok(sdir === 'E' || sdir === 'NE' || sdir === 'SE', `M3: a sail crosses open ocean east (got ${sdir})`);
  // a TRIREME crosses a NARROW strait (every step land-adjacent): 6x3, ocean cols 2-3,
  // land A cols 0-1, land B cols 4-5. From (2,1) the step to (3,1) stays land-adjacent (to B).
  const nW = 6, nTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < nW; x++) nTiles.push({ t: (x === 2 || x === 3) ? 'ocean' : 'grassland' });
  const strait = { map: { width: nW, height: H, wrapX: false, tiles: nTiles }, units: { t2: { id: 't2', type: 'trireme', owner: 'p1', x: 2, y: 1, moves: 3 } } };
  const tdir = ai.seaStepToward(strait, strait.units.t2, 4, 1, RULESET);
  assert.ok(tdir === 'E' || tdir === 'NE' || tdir === 'SE', `M3: a trireme crosses a 2-wide strait (land-adjacent throughout, got ${tdir})`);
  // free-slot accounting: trireme cap 2, one settler aboard -> 1 free.
  assert.strictEqual(ai.carrierFreeSlots(state, state.units.sh, RULESET), 1, 'trireme cap2 minus 1 cargo = 1 free');
  // nearestOwnCarrier from a land settler at (2,1) -> the trireme (has a free slot).
  const land = { id: 'st2', type: 'settlers', owner: 'p1', x: 2, y: 1 };
  assert.strictEqual(ai.nearestOwnCarrier(state, land, 'p1', RULESET).id, 'sh', 'finds the free-slot carrier');
  // a full carrier is not returned.
  state.units.st3 = { id: 'st3', type: 'militia', owner: 'p1', x: 3, y: 1, aboard: 'sh' };
  assert.strictEqual(ai.nearestOwnCarrier(state, land, 'p1', RULESET), null, 'a FULL carrier (cap2, 2 aboard) is not boardable');
});

// naval-loop slice A (#2195/#2198 B): the CRAFTED 2-continent acceptance gate — a
// settler on a SATURATED island (its own continent has no foundable spot) with a best
// city site OVERSEAS, and a carrier adjacent, is driven UNAIDED through runAiTurn to
// board -> sail the strait -> disembark -> found an OVERSEAS city. Proves the settle-
// loop CORE fires end to end (the soak-emergent arming is the separate naval-presence
// slice). 6x5: A=cols0-1, strait cols2-3 (trireme-crossable), B=cols4-5.
test('naval-loop slice A: the AI settles an OVERSEAS city (crafted 2-continent fixture)', async () => {
  const { ai, engine } = await load();
  const W = 6, H = 5, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: (x <= 1 || x >= 4) ? 'grassland' : 'ocean' });
  let st = {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false },
      s1: { id: 's1', type: 'trireme', owner: 'p1', x: 2, y: 2, moves: 3, fortified: false, veteran: false }
    },
    cities: { c1: { id: 'c1', name: 'Alpha', owner: 'p1', x: 0, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['map-making'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const homeA = ai.landComponent(st, 0, 2, RULESET); // continent A (the capital's landmass)
  let overseas = null;
  for (let turn = 1; turn <= 8 && !overseas; turn++) {
    st = ai.runAiTurn(engine, st, 'p1', RULESET);
    const res = engine.applyCommand(st, { type: 'endTurn', playerId: 'p1' });
    assert.ok(res.ok, `endTurn ${turn}: ${res.reason}`);
    st = res.state;
    for (const cid of st.cityOrder) { const c = st.cities[cid]; if (homeA[c.y * W + c.x] !== true) overseas = c; }
  }
  assert.ok(overseas, 'the AI founded a city on continent B (overseas)');
  assert.ok(overseas.x >= 4, `the overseas city is on continent B (x=${overseas.x} >= 4)`);
});

// naval-presence M4 (#2201 Q4 / #2230 option A): oceanTech = the earliest ocean-capable
// carrier tech (sail@navigation); needsOcean = true ONLY when the nearest overseas site has
// no coastal-hug (trireme) path (wide ocean) — a close-island civ across a narrow strait keeps
// its trireme (needsOcean false). This is the ruled "no narrow-strait site" gate for the beeline.
test('naval-presence M4: oceanTech = navigation; needsOcean distinguishes wide ocean from narrow strait', async () => {
  const { ai } = await load();
  assert.strictEqual(ai.oceanTech(RULESET), 'navigation', 'earliest ocean-capable carrier tech');

  // helper: a 1-row-tall band map, p1 with a coastal city on continent A, foundable land on B.
  const mk = (W, seaCols) => {
    const H = 3, tiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: seaCols.includes(x) ? 'ocean' : 'grassland' });
    return {
      version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
      map: { width: W, height: H, wrapX: false, tiles },
      units: {}, wonders: {}, nextUnitId: 50, nextCityId: 10,
      cities: { c1: { id: 'c1', name: 'A', owner: 'p1', x: 1, y: 1, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c1'],
      players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['map-making'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
      rngState: 1
    };
  };
  // NARROW strait: 6 wide, ocean cols 2-3 (every crossing step stays land-adjacent) -> trireme
  // reaches B -> needsOcean FALSE (keep the trireme).
  const narrow = mk(6, [2, 3]);
  const me = narrow.players.p1;
  assert.strictEqual(ai.needsOcean(narrow, 'p1', me, RULESET), false, 'narrow strait: a trireme reaches -> no ocean hull needed');
  // WIDE ocean: 8 wide, ocean cols 2-5 (4-wide, the middle is not land-adjacent) -> no coast-hug
  // path -> needsOcean TRUE (beeline the sail).
  const wide = mk(8, [2, 3, 4, 5]);
  assert.strictEqual(ai.needsOcean(wide, 'p1', wide.players.p1, RULESET), true, 'wide ocean: no coast-hug path -> ocean hull needed');
});

// #35 space-war-hold: spacePathPct = the % of the space-flight tech closure (Apollo + ss-parts)
// a civ has researched — the pure engine twin of soak.js's telemetry pathPct. It drives the
// pathPct-conditional 'warring' abandon (a committed civ with pathPct >= holdPathPct holds).
test('#35 spacePathPct: 0 with no closure tech, 100 with the full closure, monotone between', async () => {
  const { ai } = await load();
  const st = techs => ({ players: { p1: { id: 'p1', techs } } });
  // gather the closure = Apollo's tech + every ss-part tech
  const closure = {};
  const apollo = RULESET.wonders[RULESET.rules.ssFlight.gateWonder].tech;
  const markAll = (id) => { const stack = [id]; while (stack.length) { const t = stack.pop(); if (closure[t]) continue; closure[t] = true; for (const r of RULESET.techs[t].prereqs) stack.push(r); } };
  if (apollo) markAll(apollo);
  for (const k of Object.keys(RULESET.rules.ssParts)) markAll(RULESET.rules.ssParts[k].tech);
  const all = Object.keys(closure);
  assert.strictEqual(ai.spacePathPct(st([]), 'p1', RULESET), 0, 'no closure tech -> 0%');
  assert.strictEqual(ai.spacePathPct(st(all), 'p1', RULESET), 100, 'full closure -> 100%');
  const half = all.slice(0, Math.floor(all.length / 2));
  const pct = ai.spacePathPct(st(half), 'p1', RULESET);
  assert.ok(pct > 0 && pct < 100, `partial closure -> between 0 and 100 (got ${pct})`);
});

// #35 naval-invade-B: the CRAFTED 2-continent WAR fixture. A SUPERIOR attacker stack (2 legions)
// + a carrier on continent A, a weakly-held enemy city on continent B, at war (the default
// relation). Driven UNAIDED through runAiTurn: the attackers BOARD -> the carrier SAILS the strait
// -> the attackers DISEMBARK on B -> ASSAULT the city per-unit (existing combat). Proves the
// invade loop fires end to end. 6x5: A=cols0-1, strait cols2-3 (trireme-crossable), B=cols4-5.
function invadeFixture(stack, garrison, relations) {
  const W = 6, H = 5, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: (x <= 1 || x >= 4) ? 'grassland' : 'ocean' });
  const units = {
    s1: { id: 's1', type: 'trireme', owner: 'p1', x: 2, y: 2, moves: 3, fortified: false, veteran: false }
  };
  const seats = [[1, 2], [1, 1]];
  for (let i = 0; i < stack.length; i++) {
    units['l' + i] = { id: 'l' + i, type: stack[i], owner: 'p1', x: seats[i][0], y: seats[i][1], moves: 1, fortified: false, veteran: false };
  }
  for (let i = 0; i < garrison.length; i++) {
    units['g' + i] = { id: 'g' + i, type: garrison[i], owner: 'p2', x: 4, y: 2, moves: 1, fortified: false, veteran: false };
  }
  const st = {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units,
    cities: {
      c1: { id: 'c1', name: 'Alpha', owner: 'p1', x: 0, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'Beta', owner: 'p2', x: 4, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['map-making', 'iron-working'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
  if (relations !== undefined) st.relations = relations;
  return st;
}

function driveInvade(ai, engine, st, W) {
  const homeA = ai.landComponent(st, 0, 2, RULESET);
  let boarded = false, landedOnB = false;
  for (let turn = 1; turn <= 16; turn++) {
    st = ai.runAiTurn(engine, st, 'p1', RULESET);
    for (const uid of Object.keys(st.units)) {
      const u = st.units[uid];
      if (u.owner !== 'p1' || RULESET.units[u.type].domain !== 'land') continue;
      if (u.aboard !== undefined) boarded = true;
      else if (homeA[u.y * W + u.x] !== true
        && RULESET.terrain.terrains[st.map.tiles[u.y * W + u.x].t].domain === 'land') landedOnB = true;
    }
    const res = engine.applyCommand(st, { type: 'endTurn', playerId: 'p1' });
    assert.ok(res.ok, `endTurn ${turn}: ${res.reason}`);
    st = res.state;
    if (st.cities.c2 === undefined || st.cities.c2.owner === 'p1') break; // captured
  }
  return { st, boarded, landedOnB };
}

test('#35 naval-invade-B: the AI invades an OVERSEAS enemy city (load->sail->disembark->assault)', async () => {
  const { ai, engine } = await load();
  const st0 = invadeFixture(['legion', 'legion'], ['militia']);
  const { st, boarded, landedOnB } = driveInvade(ai, engine, st0, 6);
  assert.ok(boarded, 'an attacker boarded the carrier (load)');
  assert.ok(landedOnB, 'an attacker disembarked onto continent B (sail + disembark)');
  const captured = st.cities.c2 === undefined || st.cities.c2.owner === 'p1';
  const defendersGone = !Object.keys(st.units).some(uid => st.units[uid].owner === 'p2' && RULESET.units[st.units[uid].type].attack >= 0 && st.units[uid].x === 4 && st.units[uid].y === 2);
  assert.ok(captured || defendersGone, 'the overseas city was assaulted (captured or its garrison destroyed)');
});

// CONTROL 1 — an AT-PEACE rival is never invaded: a peace treaty makes relationOf 'peace', so the
// target selection skips c2 -> no attacker ever boards for an invasion, none reaches continent B.
test('#35 naval-invade-B control: an at-PEACE overseas city is never invaded', async () => {
  const { ai, engine } = await load();
  const st0 = invadeFixture(['legion', 'legion'], ['militia'], { 'p1|p2': { state: 'peace', met: true } });
  const { st, landedOnB } = driveInvade(ai, engine, st0, 6);
  assert.strictEqual(landedOnB, false, 'no attacker crossed to continent B at peace');
  assert.strictEqual(st.cities.c2 !== undefined && st.cities.c2.owner, 'p2', 'the peace-held city is untouched');
});

// CONTROL 2 — an INFERIOR stack never launches: 1 legion vs 2 phalanx fails the 3:1 launch gate,
// so the loaded carrier HOLDS at its coast (never sails). The attacker still BOARDS (embark is
// upstream of the launch gate) but no unit reaches continent B.
test('#35 naval-invade-B control: an inferior stack boards but never launches', async () => {
  const { ai, engine } = await load();
  const st0 = invadeFixture(['legion'], ['phalanx', 'phalanx']);
  const { st, boarded, landedOnB } = driveInvade(ai, engine, st0, 6);
  assert.ok(boarded, 'the attacker boarded the carrier (staging)');
  assert.strictEqual(landedOnB, false, 'the inferior stack never crossed (launch gate held it)');
  assert.strictEqual(st.cities.c2 !== undefined && st.cities.c2.owner, 'p2', 'the enemy city is untouched');
});
