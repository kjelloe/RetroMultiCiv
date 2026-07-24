// Simulated playthroughs (docs/05-simulation-test.md): four AI civilizations
// play full games through the real engine, headless, with invariants audited
// every turn and deep checks at the 100/200/300/400 checkpoints. The suite
// world is 56x35 — the design's 80x50 costs ~7x more (deepClone per command
// dominates); soak mode (tools/soak.js) uses full size.
//
// GOLDEN RE-RECORD: any intentional engine/AI/ruleset change shifts long
// games. Set GOLDEN_SOAK / GOLDEN_NATURAL to null, run this file, copy the
// printed JSON back in. The double-run comparison and the invariants keep
// guarding the change itself while goldens are being re-recorded.
// Phase 5: the Luau engine must reproduce these same checkpoint hashes.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const { runSim, checkInvariants, checkDeep, snapshot, loadModules, SIM_ROSTER } = require('./sim-driver.js');
const { replayDiagnostics } = require('../tools/replay.js');

// A38: the roster grew to 14 for scaling runs, but the goldens above run at
// civs=4 and SLICE THE HEAD — the first four entries are load-bearing bytes.
// Anyone reordering or "fixing" them re-records every golden in this file.
test('SIM_ROSTER head is frozen: the golden games are built from these bytes', () => {
  assert.deepStrictEqual(SIM_ROSTER.slice(0, 4), [
    { id: 'p1', name: 'Romans', color: '#3b7dd8', civ: 'romans' },
    { id: 'p2', name: 'Egyptians', color: '#d8b13b', civ: 'egyptians' },
    { id: 'p3', name: 'Greeks', color: '#3bd87d', civ: 'greeks' },
    { id: 'p4', name: 'Zulus', color: '#d84a3b', civ: 'zulus' }
  ], 'the sim goldens slice these four — a change here IS a golden re-record');
});

const SIM = { seed: 20260712, civs: 4, width: 56, height: 35 };
const CHECKPOINTS = [100, 200, 300, 400];

// #22 XV §11 disorder-lux re-record. BEHAVIORAL (#28: BEHAVIOR_SOAK 200-400 + BEHAVIOR_NATURAL MOVED):
// on MULTI-city disorder the AI now raises the empire LUXURY rate (gated on a K=10 treasury window)
// BEFORE the per-city entertainer. Fires after t100 (checkpoint-100 UNCHANGED — cities grow into
// disorder mid-game); 200-400 + natural move. NATURAL stays 545 rounds (winner p2). ai.js-only ->
// rulesetHash STAMP UNMOVED (K is an ai.js constant, not a rules knob). JS==Luau at every hash (lune
// 400 0x4088da66, natural 545/0xce24dd0d). (Prior N2 moved only 400+natural; N1a moved 200-400.)
// #32 A8 tile-contention re-record: BEHAVIORAL (#28: BEHAVIOR_SOAK + BEHAVIOR_NATURAL MOVED too —
// a real trajectory change). Two adjacent cities no longer double-work the same tile (resolveAllWorked,
// contended in the REAL game paths; AI plans on the non-contended fallback per §b/#2495), so dense
// empires yield less → smaller/slower-growing civs (rounds 400/545 + winner p2 UNCHANGED; every hash
// moved). GOLDEN_SOAK 0x84feaa76.. / GOLDEN_NATURAL 0x71ddb121 / BEHAVIOR_SOAK 0x54965b49.. /
// BEHAVIOR_NATURAL 0xca3d4446. Honest re-record (not a paste-back stamp move).
// #31 XII.2 future-tech re-record: STAMP-ONLY (#28: BEHAVIOR_SOAK + BEHAVIOR_NATURAL UNMOVED —
// verified). Adding data/rules.json scorePerFutureTech ripples the rulesetHash stamp into every
// createGame golden; the soak is DORMANT (no AI exhausts the 68-tech tree in 400/545 turns, so
// futureTech stays 0). GOLDEN_SOAK 400 -> 0xcaeeb8fb, GOLDEN_NATURAL -> 0x71ddb121 (rounds 400/545
// + winner p2 unchanged). A paste-back, not a trajectory change.
const GOLDEN_SOAK = {
  rounds: 400,
  checkpoints: {
    100: '0x84feaa76',
    200: '0xfc4c8765',
    300: '0x0b3bdc8f',
    400: '0xcaeeb8fb'
  },
  finalHash: '0xcaeeb8fb'
};
const GOLDEN_NATURAL = { rounds: 545, winner: 'p2', finalHash: '0x71ddb121' };

// #28 behavior-hash discriminator: the STAMP-EXCLUDED trajectory hash (behaviorHash) at the same
// checkpoints. When a re-record shifts GOLDEN_* but these DON'T move, the change was a cosmetic
// rulesetHash-stamp (a data/rules.json knob added, behavior byte-identical); when these move too,
// it is a real behavioral change. Recorded at HEAD; re-record with GOLDEN_* (same procedure).
const BEHAVIOR_SOAK = {
  checkpoints: { 100: '0x54965b49', 200: '0xe8908688', 300: '0xc4df37e4', 400: '0xdd8770a2' },
  finalHash: '0xdd8770a2'
};
const BEHAVIOR_NATURAL = { finalHash: '0xca3d4446' };

test('mechanics soak: 400 turns with chaos, run twice — deterministic and golden', async () => {
  const opts = Object.assign({}, SIM, {
    turns: 400,
    // disasters OFF in the pinned goldens (ruled #2133 — an authentic-ON default would
    // churn every checkpoint + re-invalidate the M-floors; the ON path rides scenarios +
    // a land-time non-degeneracy soak). The SHIP default stays authentic-ON.
    rulesOverrides: { endYear: 9999, disastersEnabled: false }, // score victory at 2100 AD ~ turn 306 must not cut the soak short
    chaos: true, // exercise the human-only command surface (buy/rates/workers/volatile governments)
    deepAt: CHECKPOINTS
  });
  const a = await runSim(opts);
  const b = await runSim(opts);
  assert.deepStrictEqual(b.checkpoints, a.checkpoints,
    'two identical runs diverged — nondeterminism in the engine or AI');
  assert.strictEqual(b.rounds, a.rounds);
  assert.strictEqual(b.finalHash, a.finalHash);

  const result = { rounds: a.rounds, checkpoints: a.checkpoints, finalHash: a.finalHash };
  if (GOLDEN_SOAK === null) console.log(`golden soak: ${JSON.stringify(result)}`);
  else assert.deepStrictEqual(result, GOLDEN_SOAK, 'drifted from golden — if the change was intentional, re-record (header)');

  // #28: the stamp-excluded behavior hashes (deterministic across the double run too).
  assert.deepStrictEqual(b.behaviorCheckpoints, a.behaviorCheckpoints, 'behaviorHash nondeterminism');
  const behavior = { checkpoints: a.behaviorCheckpoints, finalHash: a.behaviorFinalHash };
  if (BEHAVIOR_SOAK === null) console.log(`behavior soak: ${JSON.stringify(behavior)}`);
  else assert.deepStrictEqual(behavior, BEHAVIOR_SOAK, 'behaviorHash drifted — a REAL behavior change (not a stamp move)');
});

test('natural end: standard rules reach a victory by turn 550', async () => {
  // the Calendar-545 year curve lands 2100 AD at wrap 545 (turn 546) — this
  // budget sits just past it so the score end (or an earlier conquest) fires
  const r = await runSim(Object.assign({}, SIM, { turns: 550, rulesOverrides: { disastersEnabled: false } }));
  assert.strictEqual(r.state.gameOver, true, 'no victory fired by turn 550 (score victory is due at endYear 2100 ≈ turn 546)');
  assert.ok(r.state.winner !== undefined && r.state.players[r.state.winner] !== undefined,
    'winner must be a real player');

  const result = { rounds: r.rounds, winner: r.state.winner, finalHash: r.finalHash };
  if (GOLDEN_NATURAL === null) console.log(`golden natural: ${JSON.stringify(result)}`);
  else assert.deepStrictEqual(result, GOLDEN_NATURAL, 'drifted from golden — if the change was intentional, re-record (header)');

  // #28: the stamp-excluded behavior hash for natural.
  const behavior = { finalHash: r.behaviorFinalHash };
  if (BEHAVIOR_NATURAL === null) console.log(`behavior natural: ${JSON.stringify(behavior)}`);
  else assert.deepStrictEqual(behavior, BEHAVIOR_NATURAL, 'behaviorHash drifted — a REAL behavior change (not a stamp move)');
});

// The checker itself: a healthy crafted state passes, seeded defects are named.
function craftedState() {
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 5, year: -3920, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false } },
    cities: { c1: { id: 'c1', name: 'Alpha', owner: 'p1', x: 3, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 2, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: false, gold: 10, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 42
  };
}

test('the invariant checker passes a healthy state and names seeded defects', () => {
  assert.deepStrictEqual(checkInvariants(craftedState(), RULESET), []);

  const broken = craftedState();
  broken.units.u1.owner = 'ghost';
  broken.cities.c1.pop = 0;
  broken.players.p1.gold = -5;
  broken.players.p1.taxRate = 60; // 60+50 > 100
  const problems = checkInvariants(broken, RULESET);
  assert.ok(problems.some(p => /unit u1: owner "ghost"/.test(p)), `missing owner problem in: ${problems}`);
  assert.ok(problems.some(p => /city c1: pop 0/.test(p)), `missing pop problem in: ${problems}`);
  assert.ok(problems.some(p => /player p1: gold -5/.test(p)), `missing gold problem in: ${problems}`);
  assert.ok(problems.some(p => /rates 60\+50\+0/.test(p)), `missing rates problem in: ${problems}`);

  // two owners on one tile is unrepresentable through legal moves (attacks
  // never co-locate) — a movement/combat bug must not slip past
  const stacked = craftedState();
  stacked.players.p2 = { id: 'p2', name: 'Y', color: '#000', human: false, gold: 0, techs: [], researching: '' };
  stacked.units.u9 = { id: 'u9', type: 'militia', owner: 'p2', x: 2, y: 2, moves: 1, fortified: false, veteran: false };
  stacked.nextUnitId = 10;
  const stackProblems = checkInvariants(stacked, RULESET);
  assert.ok(stackProblems.some(p => /mixed-owner stack/.test(p)), `missing stack problem in: ${stackProblems}`);
});

// B28: A79's blockade drops an enemy-occupied tile from candidateTiles BY DESIGN
// while the manual assignment persists (the citizen idles until the enemy
// leaves). The deep-audit must allow a manual tile absent from candidates IFF an
// enemy stands on it — but still flag a plain non-candidate manual tile.
function blockadeState() {
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' }); // 7x5
  return {
    version: 1, turn: 5, year: -3920, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    // p2 militia sits on (3,0) = idx 3, a fat-cross tile of c1 — blockading it
    units: { ue: { id: 'ue', type: 'militia', owner: 'p2', x: 3, y: 0, moves: 1, fortified: false, veteran: false } },
    // c1 manually works idx 3 (blockaded) and idx 0 = (0,0), a tile at
    // Chebyshev 3 from the city — outside any fat cross, and no enemy on it
    cities: { c1: { id: 'c1', name: 'A', owner: 'p1', x: 3, y: 2, pop: 3, food: 0, shields: 0, buildings: [], workers: [0, 3], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 9, nextCityId: 2,
    players: {
      p1: { id: 'p1', name: 'X', color: '#fff', human: false, gold: 10, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'Y', color: '#000', human: false, gold: 10, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 42
  };
}

test('B28: the worker invariant allows a blockaded manual tile but still flags a plain non-candidate', async () => {
  const mods = await loadModules();
  const problems = checkDeep(blockadeState(), RULESET, mods);
  assert.ok(!problems.some(p => /manual worker tile 3 /.test(p)),
    `a blockaded manual tile (idx 3, enemy on it) must be allowed, got: ${problems}`);
  assert.ok(problems.some(p => /manual worker tile 0 /.test(p)),
    `a plain non-candidate manual tile (idx 0, off-cross, no enemy) must still be flagged, got: ${problems}`);
});

test('snapshot: the structured telemetry row carries per-player stats', async () => {
  const mods = await loadModules();
  const snap = snapshot(craftedState(), RULESET, mods);
  assert.strictEqual(snap.turn, 5);
  assert.strictEqual(snap.players.length, 1);
  const p = snap.players[0];
  assert.deepStrictEqual(
    { cities: p.cities, units: p.units, government: p.government, alive: p.alive, techs: p.techs },
    { cities: 1, units: 1, government: 'despotism', alive: true, techs: 0 });
});

// A sim artifact must replay through the same tool that verifies playtest
// recordings — the airound entries drive the identical all-AI loop.
test('a sim diagnostics artifact replays hash-for-hash through tools/replay.js', async () => {
  // chaos on: the airound entries must carry and replay the injected commands
  const r = await runSim({ seed: 777, civs: 3, width: 40, height: 25, turns: 40, chaos: true, hashEvery: 5, artifactsDir: false });
  const diag = {
    format: 'retromulticiv-diagnostics', version: 1, allAi: true,
    rulesOverrides: {}, initialState: r.initialState, log: r.roundLog, finalHash: r.finalHash
  };
  const report = await replayDiagnostics(JSON.parse(JSON.stringify(diag)), RULESET);
  assert.deepStrictEqual(report.problems, [], 'sim replay diverged');
  assert.strictEqual(report.rounds, r.rounds);

  const bad = JSON.parse(JSON.stringify(diag));
  bad.finalHash = '0xdeadbeef';
  const caught = await replayDiagnostics(bad, RULESET);
  assert.ok(caught.problems.length > 0, 'tampered artifact must be detected');
});
