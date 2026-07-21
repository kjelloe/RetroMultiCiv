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
  if (!diag.initialState) {
    return {
      commands: 0, rounds: 0, turn: 0, finalHash: '',
      problems: ['no initialState — a client in SERVER mode (?server=1) only holds views; '
        + 'the authoritative recording is inside the server save: replay saves/<gameId>.json instead']
    };
  }
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
      // Chaos-mode commands apply BEFORE the AI's turn as of 2026-07-13
      // (@9ba56f30 — a player command lands on fresh moves, the AI plays
      // around it); sim artifacts recorded before this date do not replay.
      // Client Shift+D recordings carry no chaos arrays and are unaffected.
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
        for (const c of chaosBySlot[pid] === undefined ? [] : chaosBySlot[pid]) {
          commands++;
          const cres = engine.applyCommand(state, c.cmd);
          if (cres.ok !== c.ok) {
            problems.push(`entry ${i} (airound chaos ${c.cmd.type}): ok=${cres.ok}${cres.reason ? ` (${cres.reason})` : ''}, recorded ok=${c.ok}${c.reason ? ` (${c.reason})` : ''}`);
          }
          if (cres.ok) state = cres.state;
        }
        if (state.players[pid].alive !== false) {
          state = runAiTurn(engine, state, pid, ruleset, []);
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

// B16: accept every replayable artifact shape, not just Shift+D files.
// A LOCAL save envelope (Shift+S) carries its history in .diag and its own
// final state — hashState(state) is the recorded truth to replay against.
// Pre-B16 envelopes lack diag.rulesOverrides: a game played on a non-default
// difficulty then replays under the WRONG ruleset and reports phantom
// divergence (the turn-371 hunt) — warn instead of confusing the triage.
async function normalizeReplayInput(obj, srcPath) {
  if (obj && obj.format === 'retromulticiv-server-save' && obj.diag) {
    // #1870 slice 2: a slice-2 save embeds only the round-hash chain; the full
    // per-command recording lives in a sidecar (<gameId>.log.jsonl) next to the
    // save. Reconstruct diag.log from it so offline replay verifies the whole
    // game. srcPath (the save's own path) locates the sidecar; without it (a
    // programmatic caller) or an older full-log save, the embedded log is used.
    if (obj.diag.logTruncated && obj.diag.sidecar && srcPath) {
      const scPath = path.join(path.dirname(srcPath), obj.diag.sidecar);
      if (fs.existsSync(scPath)) {
        const entries = [];
        for (const line of fs.readFileSync(scPath, 'utf8').split('\n')) {
          if (line) entries.push(JSON.parse(line));
        }
        return {
          note: `server save (game ${obj.gameId}) — replaying its per-command sidecar (${obj.diag.sidecar})`,
          diag: Object.assign({}, obj.diag, { log: entries })
        };
      }
      return {
        note: `server save (game ${obj.gameId}) — sidecar ${obj.diag.sidecar} missing; replaying round-hashes only`,
        diag: obj.diag
      };
    }
    return {
      note: `server save (game ${obj.gameId}) — replaying its embedded diagnostics`,
      diag: obj.diag
    };
  }
  if (obj && obj.format === 'retromulticiv-save' && obj.diag && obj.diag.initialState) {
    const { hashState } = await import('../shared/statehash.js');
    const diag = {
      format: 'retromulticiv-diagnostics',
      version: 1,
      initialState: obj.diag.initialState,
      log: obj.diag.log,
      finalHash: hashState(obj.state),
      finalTurn: obj.turn
    };
    let note = `local save (turn ${obj.turn}) — replaying its embedded history against the save's own state hash`;
    if (obj.diag.rulesOverrides !== undefined) {
      diag.rulesOverrides = obj.diag.rulesOverrides;
    } else {
      note += '\nWARNING: pre-B16 save — difficulty overrides were not recorded;'
        + ' a game played on a non-default difficulty will report phantom divergence';
    }
    return { note, diag };
  }
  return { note: null, diag: obj };
}

module.exports = { replayDiagnostics, loadRuleset, normalizeReplayInput };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/replay.js <diagnostics-or-save.json>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  (async () => {
    const { note, diag } = await normalizeReplayInput(raw, file);
    if (note) console.log(note);
    if (diag.format !== 'retromulticiv-diagnostics') {
      console.error(`not a replayable file (format: ${diag.format}) — Shift+D diagnostics, a Shift+S save with its history block, or a server save`);
      process.exit(1);
    }
    const ruleset = loadRuleset();
    // ruleset-compat pin: WARN-ONLY here (diagnostics never refuse). A pinned
    // recording replayed under a different build is likely "wrong ruleset", not
    // a real divergence. Stderr, so the twins verdict-equality (stdout) is unaffected.
    if (diag.initialState && diag.initialState.rulesetHash !== undefined) {
      const { hashState } = await import('../shared/statehash.js');
      const cur = '0x' + (hashState(ruleset) >>> 0).toString(16).padStart(8, '0');
      if (diag.initialState.rulesetHash !== cur) {
        console.error(`⚠ ruleset drift: recording pinned ${diag.initialState.rulesetHash}, this build ${cur} — replay may diverge`);
      }
    }
    const report = await replayDiagnostics(diag, ruleset);
    console.log(`replayed ${report.commands} commands + ${report.rounds} rounds -> turn ${report.turn}, final hash ${report.finalHash}`);
    if (report.problems.length === 0) {
      console.log('OK: the recorded game reproduces exactly');
    } else {
      console.log(`DIVERGENCE (${report.problems.length} problem${report.problems.length > 1 ? 's' : ''}):`);
      for (const p of report.problems) console.log('  ' + p);
      process.exitCode = 1;
    }
  })();
}
