// The diagnostics recording (client/session.js, Shift+D) must replay
// hash-for-hash through tools/replay.js — this drives a real generated game
// the way the session does, records the same log format, and verifies the
// replay. Also the dress rehearsal for phase 5's Luau cross-verification.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const { replayDiagnostics } = require('../tools/replay.js');

test('a recorded game replays exactly (commands, rounds, failures, hashes)', async () => {
  const { createEngine, deepClone } = await import('../engine/index.js');
  const { runAiTurn } = await import('../engine/ai.js');
  const { hashState } = await import('../shared/statehash.js');
  const engine = createEngine(RULESET);

  let state = engine.createGame({
    seed: 424242,
    options: {
      width: 24, height: 16,
      players: [
        { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
        { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
      ]
    }
  });
  assert.notStrictEqual(state.ok, false, 'world generated');
  const initialState = deepClone(state);
  const log = [];

  // mirror session.apply
  function apply(cmd) {
    const res = engine.applyCommand(state, cmd);
    const entry = { t: 'cmd', turn: state.turn, cmd, ok: res.ok };
    if (res.ok) state = res.state;
    else entry.reason = res.reason;
    log.push(entry);
    return res;
  }
  // mirror session.endTurn (AI players are driven, not recorded)
  function round() {
    const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
    assert.strictEqual(first.ok, true);
    state = first.state;
    let guard = 10;
    while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
      state = runAiTurn(engine, state, state.activePlayer, RULESET, []);
      const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!res.ok) break;
      state = res.state;
    }
    log.push({ t: 'round', turn: state.turn, activePlayer: state.activePlayer, hash: hashState(state) });
  }

  // play a few turns: found a city, set research, take some rounds,
  // and record one deliberate failure (they must reproduce too)
  const settler = Object.keys(state.units).map(id => state.units[id])
    .find(u => u.owner === 'p1' && u.type === 'settlers');
  assert.ok(settler, 'p1 starts with settlers');
  apply({ type: 'foundCity', playerId: 'p1', unitId: settler.id, name: 'Replaytown' });
  apply({ type: 'setResearch', playerId: 'p1', tech: 'writing' }); // fails: prereqs
  apply({ type: 'setResearch', playerId: 'p1', tech: 'alphabet' });
  for (let i = 0; i < 5; i++) round();
  apply({ type: 'buy', playerId: 'p1', cityId: state.cityOrder[0] }); // may fail on gold — recorded either way
  round();

  const diag = {
    format: 'retromulticiv-diagnostics',
    version: 1,
    initialState,
    log,
    finalHash: hashState(state)
  };
  // survive JSON round-tripping like a real downloaded file
  const report = await replayDiagnostics(JSON.parse(JSON.stringify(diag)), RULESET);
  assert.deepStrictEqual(report.problems, [], 'no divergence');
  assert.strictEqual(report.finalHash, diag.finalHash);
  assert.strictEqual(report.rounds, 6);
  assert.strictEqual(report.commands, 4);

  // and a tampered log must be caught
  const bad = JSON.parse(JSON.stringify(diag));
  bad.log[bad.log.length - 1].hash = '0xdeadbeef';
  const caught = await replayDiagnostics(bad, RULESET);
  assert.ok(caught.problems.length > 0, 'divergence detected');
});
