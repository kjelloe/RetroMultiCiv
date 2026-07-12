// The authoritative game session (docs/06-phase3-server.md §2): owns the
// state; every mutation flows through here. apply/endTurn/diagnostics mirror
// client/session.js exactly so server recordings verify with tools/replay.js
// unchanged. What the server adds: seat binding (token -> playerId), per-seat
// filtered views, and atomic save/resume that spans restarts.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine, deepClone } from '../engine/index.js';
import { runAiTurn } from '../engine/ai.js';
import { filterView } from '../engine/visibility.js';
import { hashState } from '../shared/statehash.js';
import { gameCode } from '../shared/gamecode.js';

const SAVE_FORMAT = 'retromulticiv-server-save';

// opts: { ruleset, gameId?, setup?, rulesOverrides?, save?, tokenFn? }
// — either `setup` ({seed, options}) for a fresh game, or `save` (a parsed
// server-save envelope) to resume one. `tokenFn` is injectable for tests;
// the default is node:crypto — the ONE legitimate non-deterministic
// randomness on the server, because tokens never touch game state.
export function createGame(opts) {
  const rulesOverrides = opts.save
    ? (opts.save.rulesOverrides || {})
    : (opts.rulesOverrides || {});
  let ruleset = opts.ruleset;
  if (Object.keys(rulesOverrides).length > 0) {
    ruleset = Object.assign({}, ruleset, {
      rules: Object.assign({}, ruleset.rules, rulesOverrides)
    });
  }
  const engine = createEngine(ruleset);
  const tokenFn = opts.tokenFn || (() => randomBytes(12).toString('hex'));

  let state, seats, log, logStart, gameId;
  if (opts.save) {
    if (opts.save.format !== SAVE_FORMAT) {
      throw new Error(`not a server save (format: ${opts.save.format})`);
    }
    gameId = opts.save.gameId;
    seats = opts.save.seats || {};
    state = opts.save.state;
    log = opts.save.diag.log;
    logStart = opts.save.diag.initialState;
  } else {
    gameId = opts.gameId || 'game1';
    seats = {};
    state = engine.createGame(opts.setup);
    if (state.ok === false) throw new Error(`createGame failed: ${state.reason}`);
    log = [];
    logStart = deepClone(state);
  }

  function seatOf(token) {
    for (const pid of Object.keys(seats)) {
      if (seats[pid] === token) return pid;
    }
    return null;
  }

  // First join takes the first unbound human seat; a token reclaims its seat
  // across reconnects AND server restarts (seats persist in the save).
  function bindSeat(name, token) {
    if (token !== undefined && token !== '') {
      const pid = seatOf(token);
      return pid ? { playerId: pid, token } : { error: 'badToken' };
    }
    for (const pid of state.playerOrder) {
      if (state.players[pid].human === true && seats[pid] === undefined) {
        seats[pid] = tokenFn();
        return { playerId: pid, token: seats[pid] };
      }
    }
    return { error: 'gameFull' };
  }

  // The server STAMPS playerId from the seat: a forged playerId inside the
  // command is overwritten here, and the engine's own ownership/turn checks
  // then reject what remains. This is the tamper-rejection acceptance test.
  function apply(playerId, cmd) {
    const stamped = Object.assign({}, cmd, { playerId });
    const res = engine.applyCommand(state, stamped);
    const entry = { t: 'cmd', turn: state.turn, cmd: stamped };
    if (res.ok) {
      state = res.state;
      entry.ok = true;
    } else {
      entry.ok = false;
      entry.reason = res.reason;
    }
    log.push(entry);
    return res;
  }

  // Mirror client/session.js endTurn: end this seat's turn, drive AI players
  // until the next human (or game over), deliver the whole round's events
  // together, and log one round entry with the state hash.
  function endTurn(playerId) {
    const collected = [];
    const first = engine.applyCommand(state, { type: 'endTurn', playerId });
    if (!first.ok) {
      log.push({ t: 'cmd', turn: state.turn, cmd: { type: 'endTurn', playerId }, ok: false, reason: first.reason });
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
    return { ok: true, events: collected };
  }

  function view(playerId) {
    return filterView(state, playerId);
  }

  // docs/07: the 64-bit verification code of the authoritative state. The
  // client can't compute it in server mode (it holds only a filtered view),
  // so the server provides it in the joined reply, save envelope, and
  // `{t:'code'}` broadcasts.
  function code() {
    return gameCode(state);
  }

  // Recovery hatch (--reset-seats): drop all token bindings so the next
  // joiners take the seats fresh — for resumes from another browser/port
  // (tokens live in per-origin localStorage and don't travel).
  function resetSeats() {
    for (const pid of Object.keys(seats)) delete seats[pid];
  }

  function toSave() {
    return {
      format: SAVE_FORMAT,
      version: 1,
      gameId,
      savedAt: new Date().toISOString(),
      rulesOverrides,
      seats,
      state,
      code: gameCode(state), // docs/07: the file carries its own verification code
      diag: {
        format: 'retromulticiv-diagnostics',
        version: 1,
        rulesOverrides,
        initialState: logStart,
        log,
        finalHash: hashState(state),
        finalTurn: state.turn
      }
    };
  }

  // Atomic: a crash mid-write must never corrupt the only copy of the game.
  function saveTo(file) {
    const tmp = file + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(toSave()));
    fs.renameSync(tmp, file);
  }

  return {
    get state() { return state; },
    gameId,
    ruleset,
    rulesOverrides,
    bindSeat,
    seatOf,
    resetSeats,
    apply,
    endTurn,
    view,
    code,
    toSave,
    saveTo
  };
}
