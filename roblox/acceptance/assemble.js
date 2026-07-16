#!/usr/bin/env node
// R4 acceptance assembler (roblox/SPEC.md §5): paste the Studio Output into a
// file (raw copy is fine — timestamps/context suffixes are stripped), then:
//
//   node roblox/acceptance/assemble.js <output.txt>
//
// 1. Rebuilds the initial state JS-side from the [R4INIT] line (createGame is
//    deterministic) and asserts the initial hash matches the Studio print.
// 2. Assembles a tools/replay.js diagnostics object from the [R4LOG] lines
//    and replays it through the Node engine — every per-command and
//    per-round hash must match (H_js(S_i) == H_luau(S_i) for every i).
// 3. Recomputes the final game verification code and checks it against the
//    last [R4CODE] line — the player-visible token of the whole proof.
// Exit 0 = accepted; 1 = divergence (report pinpoints it).
'use strict';
const fs = require('fs');
const path = require('path');
const { replayDiagnostics, loadRuleset } = require('../../tools/replay.js');

const ROOT = path.resolve(__dirname, '..', '..');

function parseOutput(text) {
  const init = {};
  const log = [];
  let lastCode = null;
  for (const line of text.split('\n')) {
    let idx = line.indexOf('[R4INIT]');
    if (idx >= 0) {
      for (const m of line.slice(idx + 8).matchAll(/(\w+)=([^\s]+)/g)) init[m[1]] = m[2];
      continue;
    }
    idx = line.indexOf('[R4LOG]');
    if (idx >= 0) {
      const start = line.indexOf('{', idx);
      const end = line.lastIndexOf('}');
      if (start >= 0 && end > start) log.push(JSON.parse(line.slice(start, end + 1)));
      continue;
    }
    idx = line.indexOf('[R4CODE]');
    if (idx >= 0) {
      const m = line.slice(idx).match(/turn=(\d+) code=([A-Z0-9-]+)/);
      if (m) lastCode = { turn: Number(m[1]), code: m[2] };
    }
  }
  return { init, log, lastCode };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node roblox/acceptance/assemble.js <studio-output.txt>');
    process.exit(1);
  }
  const { init, log, lastCode } = parseOutput(fs.readFileSync(file, 'utf8'));
  if (!init.seed || !init.initialHash) {
    console.error('no [R4INIT] line found in ' + file);
    process.exit(1);
  }
  if (log.length === 0) {
    console.error('no [R4LOG] entries found in ' + file);
    process.exit(1);
  }

  const ruleset = loadRuleset();
  const { createEngine, deepClone } = await import(path.join(ROOT, 'engine', 'index.js'));
  const { runAiTurn } = await import(path.join(ROOT, 'engine', 'ai.js'));
  const { hashState } = await import(path.join(ROOT, 'shared', 'statehash.js'));
  const { gameCode } = await import(path.join(ROOT, 'shared', 'gamecode.js'));

  const civIds = init.civs.split(',');
  const players = civIds.map((id, i) => ({
    id: 'p' + (i + 1),
    name: ruleset.civs[id].name,
    color: ruleset.civs[id].color,
    human: i === 0
  }));
  const engine = createEngine(ruleset);
  const initialState = engine.createGame({
    seed: Number(init.seed),
    options: { width: Number(init.width), height: Number(init.height), players }
  });
  if (initialState.ok === false) {
    console.error('createGame failed: ' + initialState.reason);
    process.exit(1);
  }
  const h0 = hashState(initialState);
  if (h0 !== init.initialHash) {
    console.error(`INITIAL STATE DIVERGES: JS createGame ${h0}, Studio ${init.initialHash}`);
    process.exit(1);
  }
  console.log(`initial state: ${h0} == Studio (createGame parity)`);

  const report = await replayDiagnostics({ initialState: deepClone(initialState), log }, ruleset);
  console.log(`replayed ${report.commands} commands, ${report.rounds} rounds -> turn ${report.turn}, final ${report.finalHash}`);
  for (const p of report.problems) console.log('PROBLEM: ' + p);

  // final game code: re-drive the log locally to hold the states
  // (replayDiagnostics returns only hashes). [R4CODE] prints at each ROUND,
  // so the comparison point is the state after the LAST ROUND entry —
  // commands the player made after that print (run2 finding: one trailing
  // move before stopping) are hash-verified above but must not skew the
  // code check.
  let verdictOk = report.problems.length === 0;
  if (lastCode) {
    let state = deepClone(initialState);
    let codeAtLastRound = null;
    for (const entry of log) {
      if (entry.t === 'cmd' && entry.ok) {
        state = engine.applyCommand(state, entry.cmd).state;
      } else if (entry.t === 'round') {
        state = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer }).state;
        let guard = 10;
        while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
          state = runAiTurn(engine, state, state.activePlayer, ruleset, []);
          const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
          if (!res.ok) break;
          state = res.state;
        }
        codeAtLastRound = { turn: state.turn, code: gameCode(state) };
      }
    }
    if (hashState(state) !== report.finalHash) {
      console.log('PROBLEM: local re-drive diverged from replayDiagnostics (harness bug)');
      verdictOk = false;
    }
    const code = codeAtLastRound !== null ? codeAtLastRound.code : gameCode(state);
    if (code === lastCode.code) {
      console.log(`game code: ${code} == Studio [R4CODE] (turn ${lastCode.turn})`);
    } else {
      console.log(`PROBLEM: game code ${code}, Studio printed ${lastCode.code}`);
      verdictOk = false;
    }
  } else {
    console.log('note: no [R4CODE] line found — game-code check skipped');
  }

  console.log(verdictOk ? 'R4 ACCEPTANCE: ALL HASHES MATCH' : 'R4 ACCEPTANCE: DIVERGENCE');
  process.exit(verdictOk ? 0 : 1);
}
main();
