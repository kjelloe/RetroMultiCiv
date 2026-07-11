// Replay a retromulticiv-diagnostics file (Shift+D in the client) through
// the engine and verify every recorded state hash — the determinism check,
// and the same harness that will verify the Luau engine in phase 5.
//
//   node tools/replay.js <diagnostics.json>
//
// Exit code 0 = the whole game reproduced hash-for-hash; 1 = divergence
// (the report pinpoints the first differing entry).
const fs = require('fs');
const path = require('path');

function loadRuleset() {
  const data = (f) => require(path.join(__dirname, '..', 'data', f));
  return {
    terrain: data('terrain.json'),
    units: data('units.json'),
    techs: data('techs.json'),
    buildings: data('buildings.json'),
    wonders: data('wonders.json'),
    governments: data('governments.json'),
    civs: data('civs.json'),
    rules: data('rules.json')
  };
}

// Mirrors client/session.js endTurn(): end the active player's turn, then
// drive AI players until the next human (or game over).
async function replayDiagnostics(diag, ruleset) {
  const { createEngine, deepClone } = await import('../engine/index.js');
  const { runAiTurn } = await import('../engine/ai.js');
  const { hashState } = await import('../shared/statehash.js');
  // difficulty etc. are ruleset overrides — apply the ones the game ran with
  if (diag.rulesOverrides !== undefined && Object.keys(diag.rulesOverrides).length > 0) {
    ruleset = Object.assign({}, ruleset, {
      rules: Object.assign({}, ruleset.rules, diag.rulesOverrides)
    });
  }
  const engine = createEngine(ruleset);
  let state = deepClone(diag.initialState);
  const problems = [];
  let commands = 0;
  let rounds = 0;

  diag.log.forEach((entry, i) => {
    if (problems.length >= 5) return; // after a divergence everything differs
    if (entry.t === 'cmd') {
      commands++;
      const res = engine.applyCommand(state, entry.cmd);
      if (res.ok !== entry.ok) {
        problems.push(`entry ${i} (${entry.cmd.type}): ok=${res.ok}${res.reason ? ` (${res.reason})` : ''}, recorded ok=${entry.ok}${entry.reason ? ` (${entry.reason})` : ''}`);
        return;
      }
      if (res.ok) state = res.state;
      if (entry.hash !== undefined && res.ok) {
        const h = hashState(state);
        if (h !== entry.hash) problems.push(`entry ${i} (${entry.cmd.type}): hash ${h}, recorded ${entry.hash}`);
      }
    } else if (entry.t === 'round') {
      rounds++;
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) {
        problems.push(`entry ${i} (round): endTurn rejected (${first.reason})`);
        return;
      }
      state = first.state;
      let guard = 10;
      while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
        state = runAiTurn(engine, state, state.activePlayer, ruleset, []);
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
        if (!res.ok) break;
        state = res.state;
      }
      const h = hashState(state);
      if (h !== entry.hash) {
        problems.push(`entry ${i} (round -> turn ${state.turn}): hash ${h}, recorded ${entry.hash}`);
      }
    } else if (entry.t === 'airound') {
      // all-AI games (test/sim-driver.js): a round is one full game turn —
      // drive every player's AI until the turn wraps, same loop as the driver.
      // Chaos-mode commands were injected after a player's AI turn and are
      // recorded per slot; re-apply them in place (order preserved).
      rounds++;
      const chaosBySlot = {};
      for (const c of entry.chaos === undefined ? [] : entry.chaos) {
        if (!chaosBySlot[c.playerId]) chaosBySlot[c.playerId] = [];
        chaosBySlot[c.playerId].push(c);
      }
      const startTurn = state.turn;
      let guard = state.playerOrder.length + 2;
      while (state.turn === startTurn && !state.gameOver && guard-- > 0) {
        const pid = state.activePlayer;
        if (state.players[pid].alive !== false) {
          state = runAiTurn(engine, state, pid, ruleset, []);
        }
        for (const c of chaosBySlot[pid] === undefined ? [] : chaosBySlot[pid]) {
          commands++;
          const cres = engine.applyCommand(state, c.cmd);
          if (cres.ok !== c.ok) {
            problems.push(`entry ${i} (airound chaos ${c.cmd.type}): ok=${cres.ok}${cres.reason ? ` (${cres.reason})` : ''}, recorded ok=${c.ok}${c.reason ? ` (${c.reason})` : ''}`);
          }
          if (cres.ok) state = cres.state;
        }
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
        if (!res.ok) {
          problems.push(`entry ${i} (airound): endTurn rejected (${res.reason})`);
          return;
        }
        state = res.state;
      }
      if (entry.hash !== undefined) { // the driver hashes every Nth round
        const h = hashState(state);
        if (h !== entry.hash) {
          problems.push(`entry ${i} (airound -> turn ${state.turn}): hash ${h}, recorded ${entry.hash}`);
        }
      }
    }
  });

  const finalHash = hashState(state);
  if (problems.length === 0 && diag.finalHash !== undefined && finalHash !== diag.finalHash) {
    problems.push(`final state: hash ${finalHash}, recorded ${diag.finalHash}`);
  }
  return { commands, rounds, turn: state.turn, finalHash, problems };
}

module.exports = { replayDiagnostics, loadRuleset };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/replay.js <diagnostics.json>');
    process.exit(1);
  }
  const diag = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (diag.format !== 'retromulticiv-diagnostics') {
    console.error(`not a diagnostics file (format: ${diag.format}) — use Shift+D in the client, not Shift+S`);
    process.exit(1);
  }
  replayDiagnostics(diag, loadRuleset()).then(report => {
    console.log(`replayed ${report.commands} commands + ${report.rounds} rounds -> turn ${report.turn}, final hash ${report.finalHash}`);
    if (report.problems.length === 0) {
      console.log('OK: the recorded game reproduces exactly');
    } else {
      console.log(`DIVERGENCE (${report.problems.length} problem${report.problems.length > 1 ? 's' : ''}):`);
      for (const p of report.problems) console.log('  ' + p);
      process.exitCode = 1;
    }
  });
}
