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
import { createEngine, deepClone, OFFTURN_WHITELIST } from '../engine/index.js';
import { runAiTurn, pickCommand } from '../engine/ai.js';
import { hashState } from '../shared/statehash.js';

export function createSession(ruleset, initialState, opts) {
  const engine = createEngine(ruleset);
  const debug = Boolean(opts && opts.debug);
  let state = initialState;
  let log = [];
  let logStart = deepClone(initialState);
  const listeners = [];
  // A30: while the chunked AI round is awaiting between players, no other
  // command may slip into the recording (it would replay in a different
  // order than it ran live) — apply() and endTurn() reject until it lands
  let roundInFlight = false;
  // A54: [{cmd, resolve}] — whitelisted commands issued during the chunked AI
  // round, applied + resolved when the round completes (see apply below)
  const offturnQueue = [];

  // A40 slice 2: per-seat regency — pid -> stance string. UI/session state
  // only, NEVER game state (players[pid].human stays true, hashes
  // untouched). The regent's commands are LOGGED as ordinary cmd entries,
  // so replay needs nothing new (docs/08 §7): replay applies them like any
  // human command.
  const regents = {};

  // The regent plays a seat with the REAL pick logic (engine/ai.js
  // pickCommand — not a parallel implementation), each attempt recorded
  // exactly as session.apply records human commands. Returns a tally of the
  // APPLIED commands (B11: regentTurn narrates it to the turn log).
  function playSeatLogged(pid, collected) {
    const done = {};
    let guard = 500;
    const tally = { applied: 0, byType: {}, research: '', production: [] };
    while (guard-- > 0) {
      // A40 slice 1: the regent plays with ITS chosen stance (balanced by
      // default — identical to the AI-round path)
      const cmd = pickCommand(state, pid, ruleset, done, regents[pid]);
      if (!cmd) break;
      const res = engine.applyCommand(state, cmd);
      const entry = { t: 'cmd', turn: state.turn, cmd };
      if (res.ok) {
        state = res.state;
        entry.ok = true;
        if (debug) entry.hash = hashState(state);
        for (const e of res.events) collected.push(e);
        tally.applied++;
        tally.byType[cmd.type] = (tally.byType[cmd.type] === undefined ? 0 : tally.byType[cmd.type]) + 1;
        if (cmd.type === 'setResearch') tally.research = cmd.tech;
        if (cmd.type === 'setProduction') tally.production.push(cmd.item.id);
      } else {
        entry.ok = false;
        entry.reason = res.reason;
      }
      log.push(entry);
    }
    return tally;
  }

  function notify(events) {
    for (const cb of listeners) cb(state, events || []);
  }

  return {
    get state() { return state; },
    get log() { return log; },
    ruleset,

    onChange(cb) { listeners.push(cb); },

    // Returns a Promise so the UI has ONE apply() contract across the local
    // and the phase-3 remote session (docs/06 §5). The state mutation is
    // synchronous — only the return value is wrapped — so callers that read
    // session.state right after (without awaiting) still see the new state.
    apply(cmd) {
      if (roundInFlight) {
        // A54: whitelisted self-scoped commands QUEUE during the chunked AI
        // round and flush when it completes — the caller's promise resolves
        // with the real result then. DESIGN NOTE (deviation, flagged): the
        // recording stores the whole round as ONE entry, so a mid-round
        // application would be invisible to the replayer; the flush lands
        // AFTER the round entry instead — ordinary cmd entries in actual
        // application order, replay exact under the unchanged format.
        if (OFFTURN_WHITELIST.indexOf(cmd.type) !== -1) {
          return new Promise(resolve => offturnQueue.push({ cmd, resolve }));
        }
        return Promise.resolve({ ok: false, reason: 'roundInFlight', events: [] });
      }
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
      return Promise.resolve(res);
    },

    // End the human turn, then let every AI player act and pass — stopping
    // at the next human (hotseat). A30: the round YIELDS to the event loop
    // between AI players (one macrotask each) so the HUD can repaint the
    // "⏳ <civ> (AI) is moving" line — big late-game empires no longer
    // freeze the page for the whole round. DETERMINISM UNCHANGED: the same
    // commands run in the same order and the recorder still writes ONE
    // round entry with the same hash (test/session.test.js pins this
    // against an unchunked twin). Events reach subscribers as per-player
    // DELTAS during the round; the recording is untouched.
    async endTurn() {
      if (roundInFlight) return { ok: false, reason: 'roundInFlight', events: [] };
      const collected = [];
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) {
        log.push({ t: 'cmd', turn: state.turn, cmd: { type: 'endTurn', playerId: state.activePlayer }, ok: false, reason: first.reason });
        return first;
      }
      state = first.state;
      for (const e of first.events) collected.push(e);
      // #37 regent-stall: the guard must cover a FULL round of AI seats — a fixed 10
      // stranded activePlayer on an AI seat in ≥12-civ games (the round couldn't wrap
      // back to the human/regent), freezing the game. Scale with the seat count (+2 slack;
      // still a runaway net). playerOrder length ≥ live seats, so a round always completes.
      let guard = state.playerOrder.length + 2;
      let seen = 0;
      roundInFlight = true;
      try {
        while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
          notify(collected.slice(seen)); // repaint: activePlayer = the AI about to act
          seen = collected.length;
          await new Promise(resolve => setTimeout(resolve, 0));
          state = runAiTurn(engine, state, state.activePlayer, ruleset, collected);
          const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
          if (!res.ok) break;
          state = res.state;
          for (const e of res.events) collected.push(e);
        }
      } finally {
        roundInFlight = false;
      }
      log.push({ t: 'round', turn: state.turn, activePlayer: state.activePlayer, hash: hashState(state) });
      notify(collected.slice(seen));
      // A54: flush the off-turn queue — ordinary cmd entries AFTER the round
      // entry, in actual application order (replay-exact, format unchanged)
      while (offturnQueue.length > 0) {
        const q = offturnQueue.shift();
        const res = engine.applyCommand(state, q.cmd);
        const entry = { t: 'cmd', turn: state.turn, cmd: q.cmd };
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
        q.resolve(res);
      }
      return first;
    },

    // A40 slice 2: toggle a seat's regent (stance string | null). The
    // regent's OWN current turn is driven by regentTurn below; later turns
    // play inside endTurn's round loop like AI seats.
    setRegent(pid, stance) {
      if (stance === null || stance === undefined) delete regents[pid];
      else regents[pid] = stance;
    },
    get regents() { return regents; },
    get busy() { return roundInFlight; },
    get pendingOffturn() { return offturnQueue.length; }, // A54: the UI's "queued" tick

    // Play the ACTIVE seat's regent turn (its units, logged), then end it —
    // the round loop carries on through AI and other regent seats. The UI's
    // onChange driver re-kicks this while regency stays on.
    async regentTurn() {
      if (roundInFlight) return { ok: false, reason: 'roundInFlight', events: [] };
      if (state.gameOver) return { ok: false, reason: 'gameOver', events: [] }; // XIV §2: a finished game never advances
      if (regents[state.activePlayer] === undefined) {
        return { ok: false, reason: 'notRegent', events: [] };
      }
      const collected = [];
      const pid = state.activePlayer;
      const tally = playSeatLogged(pid, collected);
      // B11: a synthetic CLIENT-side summary (the stateReplaced precedent —
      // never logged, never hashed) so the turn log can narrate what the
      // regent did; filterEvents passes it to its own seat as a named party
      collected.push({ type: 'regentTurn', playerId: pid, applied: tally.applied,
        byType: tally.byType, research: tally.research, production: tally.production });
      notify(collected);
      return this.endTurn();
    },

    // Load a saved/foreign state wholesale (save files, quick load). The
    // diagnostics recording restarts at the load point UNLESS the save
    // carries a `recording` block (A47: {initialState, log}) — then the
    // recorder is SEEDED with the game's full history so the replay theater
    // spans every session, and new commands keep appending (save→load→save
    // composes). Older saves without the block replay from the load point.
    replaceState(next, recording) {
      state = next;
      if (recording && recording.initialState && Array.isArray(recording.log)) {
        logStart = deepClone(recording.initialState);
        log = recording.log.slice();
      } else {
        log = [];
        logStart = deepClone(next);
      }
      // stateReplaced: a synthetic CLIENT-side event (never logged, never
      // hashed) — subscribers that keep per-game baselines (turn-log
      // contacts) re-baseline on it; a plain empty notify is just a repaint
      notify([{ type: 'stateReplaced' }]);
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
