// The session owns the game state and is the ONLY thing that mutates it.
// UI modules read session.state and call apply()/endTurn(); every change
// notifies subscribers. This is the phase-3 seam: a socket-backed session
// with the same interface replaces this file, and the UI never knows.
import { createEngine } from '../engine/index.js';
import { runAiTurn } from '../engine/ai.js';

export function createSession(ruleset, initialState) {
  const engine = createEngine(ruleset);
  let state = initialState;
  const listeners = [];

  function notify(events) {
    for (const cb of listeners) cb(state, events || []);
  }

  return {
    get state() { return state; },
    ruleset,

    onChange(cb) { listeners.push(cb); },

    apply(cmd) {
      const res = engine.applyCommand(state, cmd);
      if (res.ok) {
        state = res.state;
        notify(res.events);
      }
      return res;
    },

    // End the human turn, then let every AI player act and pass.
    endTurn() {
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) return first;
      state = first.state;
      let guard = 10;
      while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
        state = runAiTurn(engine, state, state.activePlayer, ruleset);
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
        if (!res.ok) break;
        state = res.state;
      }
      notify(first.events);
      return first;
    },

    // Load a saved/foreign state wholesale (save files, quick load).
    replaceState(next) {
      state = next;
      notify([]);
    }
  };
}
