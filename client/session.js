// The session owns the game state and is the ONLY thing that mutates it.
// UI modules read session.state and call apply()/endTurn(); every change
// notifies subscribers. This is the phase-3 seam: a socket-backed session
// with the same interface replaces this file, and the UI never knows.
//
// Diagnostics recorder: every human command and every end-turn round is
// logged with the state hash after each round (after every command too with
// { debug: true }). Because the engine and AI are deterministic, the log +
// the initial-state snapshot REPLAY the whole game — `node tools/replay.js
// <file>` verifies every hash and pinpoints any divergence. Shift+D
// downloads it (ui/saves.js).
import { createEngine, deepClone } from '../engine/index.js';
import { runAiTurn } from '../engine/ai.js';
import { hashState } from '../shared/statehash.js';

export function createSession(ruleset, initialState, opts) {
  const engine = createEngine(ruleset);
  const debug = Boolean(opts && opts.debug);
  let state = initialState;
  let log = [];
  let logStart = deepClone(initialState);
  const listeners = [];

  function notify(events) {
    for (const cb of listeners) cb(state, events || []);
  }

  return {
    get state() { return state; },
    get log() { return log; },
    ruleset,

    onChange(cb) { listeners.push(cb); },

    apply(cmd) {
      const res = engine.applyCommand(state, cmd);
      const entry = { t: 'cmd', turn: state.turn, cmd };
      if (res.ok) {
        state = res.state;
        entry.ok = true;
        if (debug) entry.hash = hashState(state);
        log.push(entry);
        notify(res.events);
      } else {
        entry.ok = false;
        entry.reason = res.reason;
        log.push(entry);
      }
      return res;
    },

    // End the human turn, then let every AI player act and pass — stopping
    // at the next human (hotseat). All events from the whole round are
    // delivered together (the turn log needs the AI/barbarian actions).
    endTurn() {
      const collected = [];
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) {
        log.push({ t: 'cmd', turn: state.turn, cmd: { type: 'endTurn', playerId: state.activePlayer }, ok: false, reason: first.reason });
        return first;
      }
      state = first.state;
      for (const e of first.events) collected.push(e);
      let guard = 10;
      while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
        state = runAiTurn(engine, state, state.activePlayer, ruleset, collected);
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
        if (!res.ok) break;
        state = res.state;
        for (const e of res.events) collected.push(e);
      }
      log.push({ t: 'round', turn: state.turn, activePlayer: state.activePlayer, hash: hashState(state) });
      notify(collected);
      return first;
    },

    // Load a saved/foreign state wholesale (save files, quick load). The
    // diagnostics recording restarts here — replays run from the load point.
    replaceState(next) {
      state = next;
      log = [];
      logStart = deepClone(next);
      notify([]);
    },

    // Everything tools/replay.js needs to reproduce and verify this game.
    exportDiagnostics(extra) {
      return Object.assign({
        format: 'retromulticiv-diagnostics',
        version: 1,
        savedAt: new Date().toISOString(),
        debug,
        initialState: logStart,
        log,
        finalHash: hashState(state),
        finalTurn: state.turn
      }, extra || {});
    }
  };
}
