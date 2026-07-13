// A20 starting-age fast-forward (design in agent-workitems A20, 2026-07-13):
// later-age starts run the whole world as AI up to the age's turn, then grant
// every civ the cumulative techs of prior eras and hand the humans their
// seats. Pure engine-API consumer — the same public loop test/sim-driver.js
// and the session AI-drive use; no engine changes, nothing stored beyond the
// ordinary state. ESM in shared/ so browser (setup screen) and Node (server
// create, unit tests) run the identical deterministic walk.
import { createEngine } from '../engine/index.js';
import { runAiTurn } from '../engine/ai.js';

// Grant the union of the named eras' techs to EVERY player — identical list
// for all civs (fairness), deduped against what the AI already researched,
// sorted for a deterministic canonical state. Research resets: the player
// picks fresh at takeover; bulbs zero out (no carried progress).
export function applyAgeGrant(state, age, ruleset) {
  const grant = [];
  const eras = {};
  const except = {};
  for (const e of age.grantEras === undefined ? [] : age.grantEras) eras[e] = true;
  for (const t of age.except === undefined ? [] : age.except) except[t] = true; // Space Age: everything but Future Tech
  for (const id of Object.keys(ruleset.techs).sort()) {
    if (eras[ruleset.techs[id].era] === true && except[id] !== true) grant.push(id);
  }
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const merged = {};
    for (const t of p.techs) merged[t] = true;
    for (const t of grant) merged[t] = true;
    p.techs = Object.keys(merged).sort();
    p.researching = '';
    p.bulbs = 0;
  }
  return grant;
}

// Drive full all-AI rounds toward targetTurn. Returns a stepper so the
// browser can chunk work across setTimeout slices (the tab stays alive);
// Node callers just loop step() to completion. Aborts — never re-rolls —
// when the game ends or a to-be-human civ dies (deterministic UX: the
// player picks another seed/age/civ knowingly).
export function createFastForward(ruleset, initialState, opts) {
  const engine = createEngine(ruleset);
  const humanSeats = (opts && opts.humanSeats) || [];
  let state = initialState;
  let aborted = null;

  function deadHumanSeat() {
    for (const pid of humanSeats) {
      if (state.players[pid] && state.players[pid].alive === false) return pid;
    }
    return null;
  }

  return {
    get state() { return state; },
    get turn() { return state.turn; },
    get aborted() { return aborted; },
    // run up to `rounds` full game turns; returns { done, aborted }
    step(rounds, targetTurn) {
      for (let i = 0; i < rounds && state.turn < targetTurn && aborted === null; i++) {
        const startTurn = state.turn;
        let guard = state.playerOrder.length + 2;
        while (state.turn === startTurn && !state.gameOver && guard-- > 0) {
          const pid = state.activePlayer;
          if (state.players[pid].alive !== false) {
            state = runAiTurn(engine, state, pid, ruleset, []);
          }
          const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
          if (!res.ok) { aborted = { reason: 'wedged', detail: res.reason }; break; }
          state = res.state;
        }
        if (state.gameOver) aborted = { reason: 'gameOver', winner: state.winner };
        const dead = deadHumanSeat();
        if (aborted === null && dead !== null) {
          aborted = { reason: 'civEliminated', playerId: dead, name: state.players[dead].name };
        }
      }
      return { done: state.turn >= targetTurn || aborted !== null, aborted };
    }
  };
}

// Node-side convenience (server create, tests): run to completion, then grant
// and flip the chosen seats human. Returns { state, grant } or { aborted }.
export function fastForwardTo(ruleset, initialState, age, humanSeats) {
  if (age.turn === 0) return { state: initialState, grant: [] }; // Ancient: today's behavior
  const ff = createFastForward(ruleset, initialState, { humanSeats });
  let r = { done: false };
  while (!r.done) r = ff.step(50, age.turn);
  if (ff.aborted) return { aborted: ff.aborted };
  const state = ff.state;
  const grant = applyAgeGrant(state, age, ruleset);
  for (const pid of humanSeats) state.players[pid].human = true;
  return { state, grant };
}
