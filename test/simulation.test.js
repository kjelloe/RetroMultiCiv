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
const { runSim, checkInvariants, snapshot, loadModules, SIM_ROSTER } = require('./sim-driver.js');
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

const GOLDEN_SOAK = {
  rounds: 400,
  checkpoints: {
    100: '0x67220be7',
    200: '0xbf549246',
    300: '0xe28e365f',
    400: '0xb88d908b'
  },
  finalHash: '0xb88d908b'
};
const GOLDEN_NATURAL = { rounds: 395, winner: 'p2', finalHash: '0x72c846cc' };

test('mechanics soak: 400 turns with chaos, run twice — deterministic and golden', async () => {
  const opts = Object.assign({}, SIM, {
    turns: 400,
    rulesOverrides: { endYear: 9999 }, // score victory at 2100 AD ~ turn 306 must not cut the soak short
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
});

test('natural end: standard rules reach a victory by turn 399', async () => {
  // the A21 year curve lands 2100 AD at wrap 395 (turn 396) — deliberately
  // under the sim harness's 400-round budget
  const r = await runSim(Object.assign({}, SIM, { turns: 399 }));
  assert.strictEqual(r.state.gameOver, true, 'no victory fired by turn 399 (score victory is due at endYear 2100 ≈ turn 396)');
  assert.ok(r.state.winner !== undefined && r.state.players[r.state.winner] !== undefined,
    'winner must be a real player');

  const result = { rounds: r.rounds, winner: r.state.winner, finalHash: r.finalHash };
  if (GOLDEN_NATURAL === null) console.log(`golden natural: ${JSON.stringify(result)}`);
  else assert.deepStrictEqual(result, GOLDEN_NATURAL, 'drifted from golden — if the change was intentional, re-record (header)');
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
