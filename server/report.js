// S1 (specs/match-report-corpus.md): the voluntary match-report writer.
// One report per FINISHED game, written beside the saves — a small metadata
// envelope over the full recording (determinism is the asset: every stat is
// derivable offline by replay). OFF by default; --share-reports <dir> turns
// it on; any seat's veto means the report is never written.
//
// ANONYMIZATION vs VERIFIABILITY: player names are game STATE and feed the
// hashes, so a report can't just rewrite names and keep the recorded hashes
// (the S3 ingest gate replays them). Resolution: rewrite the names in the
// initial state, then REGENERATE every hash by replaying the log through the
// engine at write time (the same walk tools/replay.js does) — the report is
// self-consistent and replay-verifiable under its own (anonymized) code.
// City names typed by players stay (out of v1 scope — flagged in the spec
// mail). A replay that diverges from its own log skips the report entirely.
import fs from 'fs';
import path from 'path';
import { createEngine, deepClone } from '../engine/index.js';
import { runAiTurn } from '../engine/ai.js';
import { hashState } from '../shared/statehash.js';
import { gameCode } from '../shared/gamecode.js';
import { score } from '../engine/score.js';

const FORMAT = 'retromulticiv-match-report';

// Rewrite player names to seat labels, then replay the log to regenerate
// every recorded hash. Returns { diag, finalState } or null when the replay
// disagrees with its own log (never write a report we can't verify).
function anonymizeRecording(diagIn, ruleset) {
  if (!diagIn || !diagIn.initialState) return null;
  let rs = ruleset;
  if (diagIn.rulesOverrides !== undefined && Object.keys(diagIn.rulesOverrides).length > 0) {
    rs = Object.assign({}, ruleset, { rules: Object.assign({}, ruleset.rules, diagIn.rulesOverrides) });
  }
  const engine = createEngine(rs);
  let state = deepClone(diagIn.initialState);
  state.playerOrder.forEach((pid, i) => {
    if (state.players[pid]) state.players[pid].name = 'seat' + (i + 1);
  });
  const initialState = deepClone(state);
  const log = [];
  for (const entry of diagIn.log) {
    if (entry.t === 'cmd') {
      const res = engine.applyCommand(state, entry.cmd);
      if (res.ok !== entry.ok) return null; // the log no longer replays — skip
      if (res.ok) state = res.state;
      const out = Object.assign({}, entry);
      if (entry.hash !== undefined && res.ok) out.hash = hashState(state);
      log.push(out);
    } else if (entry.t === 'round') {
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) return null;
      state = first.state;
      let guard = 20;
      while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
        state = runAiTurn(engine, state, state.activePlayer, rs, []);
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
        if (!res.ok) break;
        state = res.state;
      }
      log.push(Object.assign({}, entry, { hash: hashState(state) }));
    } else {
      return null; // airound etc.: not a server recording — refuse
    }
  }
  return {
    finalState: state,
    diag: {
      format: 'retromulticiv-diagnostics',
      version: 1,
      rulesOverrides: diagIn.rulesOverrides,
      initialState,
      log,
      finalHash: hashState(state),
      finalTurn: state.turn
    }
  };
}

// mirrors the endscreen's reason derivation (state stores no victory kind)
function endReasonOf(state, ruleset) {
  if (state.gameOver !== true) return 'abandoned';
  let alive = 0;
  for (const pid of state.playerOrder) {
    if (state.players[pid].alive !== false) alive = alive + 1;
  }
  if (alive <= 1) return 'conquest';
  const w = state.winner !== undefined ? state.players[state.winner] : undefined;
  if (w && w.spaceship && w.spaceship.launched && state.turn >= (w.spaceship.arrivalTurn || Infinity)) {
    return 'space';
  }
  return 'endYear';
}

function buildReport(game, ruleset) {
  const anon = anonymizeRecording(game.fullLog === undefined ? null : withOverrides(game), ruleset);
  if (anon === null) return null;
  const state = anon.finalState;
  const ranks = state.playerOrder.map((pid, i) => ({
    seat: 'seat' + (i + 1),
    civ: state.players[pid].civ === undefined ? '' : state.players[pid].civ,
    score: score(state, pid, ruleset),
    alive: state.players[pid].alive !== false,
    human: state.players[pid].human === true
  })).sort((a, b) => b.score - a.score);
  const humanSeats = ranks.filter(r => r.human).length;
  return {
    format: FORMAT,
    version: 1,
    envelope: {
      rulesetHash: '0x' + (hashState(ruleset) >>> 0).toString(16).padStart(8, '0'),
      engineVersion: 'dev', // no version constant yet; rulesetHash is the pin
      gameCode: gameCode(state),
      // lineage: a log that starts mid-game (resume / age start) points at
      // the load point's REAL code (codes are one-way hashes — no name
      // leak); fresh games carry their own boot code
      parentGameCode: gameCode(game.fullLog().initialState),
      mapSize: `${state.map.width}x${state.map.height}`,
      civCount: state.playerOrder.length,
      humanSeats,
      difficulty: state.difficulty !== undefined ? state.difficulty : 'default',
      turns: state.turn,
      endReason: endReasonOf(state, ruleset),
      ranks,
      labels: []
    },
    recording: anon.diag
  };
}

function withOverrides(game) {
  const d = game.fullLog();
  return {
    initialState: d.initialState,
    log: d.log,
    rulesOverrides: game.rulesOverrides
  };
}

// atomic write + keep-last rotation (mtime order, ours-only)
function writeReport(dir, report) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, report.envelope.gameCode.replace(/[^A-Za-z0-9-]/g, '') + '.json');
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(report));
  fs.renameSync(tmp, file);
  return file;
}

function rotateReports(dir, keep) {
  let names;
  try { names = fs.existsSync(dir) ? fs.readdirSync(dir) : []; } catch (e) { return; }
  const files = [];
  for (const f of names) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    try {
      const head = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (head.format !== FORMAT) continue;
      files.push({ path: p, mtime: fs.statSync(p).mtimeMs });
    } catch (e) { /* foreign/corrupt: leave alone */ }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  for (const victim of files.slice(keep)) {
    try { fs.unlinkSync(victim.path); } catch (e) { /* already gone */ }
  }
}

export { buildReport, writeReport, rotateReports, anonymizeRecording, endReasonOf, FORMAT };
