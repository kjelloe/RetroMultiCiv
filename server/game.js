// The authoritative game session (docs/06-phase3-server.md §2): owns the
// state; every mutation flows through here. apply/endTurn/diagnostics mirror
// client/session.js exactly so server recordings verify with tools/replay.js
// unchanged. What the server adds: seat binding (token -> playerId), per-seat
// filtered views, and atomic save/resume that spans restarts.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine, deepClone } from '../engine/index.js';
import { runAiTurn, pickCommand } from '../engine/ai.js';
import { filterView, filterEvents } from '../engine/visibility.js';
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

  let state, seats, seatCodes, regents, log, logStart, gameId;
  if (opts.save) {
    if (opts.save.format !== SAVE_FORMAT) {
      throw new Error(`not a server save (format: ${opts.save.format})`);
    }
    // ruleset-compat pin (docs/02 §7, specs/ruleset-compat-policy.md): a save
    // created under a DIFFERENT ruleset (a server upgrade mid-game) diverges
    // silently — refuse it. Omit-safe: older saves lack the pin -> exempt.
    // --allow-ruleset-drift (opts.allowRulesetDrift) loads anyway.
    const savedHash = opts.save.state !== undefined ? opts.save.state.rulesetHash : undefined;
    if (savedHash !== undefined && opts.allowRulesetDrift !== true) {
      const currentHash = '0x' + (hashState(ruleset) >>> 0).toString(16).padStart(8, '0');
      if (savedHash !== currentHash) {
        throw new Error(`ruleset drift: save created under ${savedHash}, this server runs ${currentHash} — resume with --allow-ruleset-drift to load anyway`);
      }
    }
    gameId = opts.save.gameId;
    seats = opts.save.seats || {};
    seatCodes = opts.save.seatCodes || {}; // A46: envelope-only, older saves lack it
    regents = opts.save.regents || {}; // A40: envelope-only, regency survives resume
    state = opts.save.state;
    log = opts.save.diag.log;
    logStart = opts.save.diag.initialState;
  } else if (opts.initialState) {
    // A20: a pre-built state (the lobby's age fast-forward) — treated exactly
    // like a fresh game whose history starts at the takeover point, so the
    // diagnostics recording and tools/replay.js need nothing new
    gameId = opts.gameId || 'game1';
    seats = {};
    seatCodes = {};
    regents = {};
    state = opts.initialState;
    log = [];
    logStart = deepClone(state);
  } else {
    gameId = opts.gameId || 'game1';
    seats = {};
    seatCodes = {};
    regents = {};
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

  // A46 per-seat reclaim code: a short recovery secret in the game-code
  // alphabet (docs/07), generated from the server's crypto like tokens —
  // NEVER game state, never hashed; persists in the save ENVELOPE only.
  // Two groups of four: "XXXX-YYYY".
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const seatCodeFn = opts.seatCodeFn || (() => {
    const bytes = randomBytes(8);
    let out = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) out += '-';
      out += CROCKFORD[bytes[i] % 32];
    }
    return out;
  });
  function seatOfCode(code) {
    const norm = String(code || '').toUpperCase();
    for (const pid of Object.keys(seatCodes)) {
      if (seatCodes[pid] === norm) return pid;
    }
    return null;
  }

  // First join takes the first unbound human seat; a token reclaims its seat
  // across reconnects AND server restarts (seats persist in the save).
  // A46: a seatCode reclaims a bound seat from a NEW device — the token is
  // ROTATED so the old device's copy dies with the move (its retry loop gets
  // badToken, which is correct: the seat changed hands deliberately).
  function bindSeat(name, token, seatCode) {
    if (token !== undefined && token !== '') {
      const pid = seatOf(token);
      return pid ? { playerId: pid, token, seatCode: seatCodes[pid] } : { error: 'badToken' };
    }
    if (seatCode !== undefined && seatCode !== '') {
      const pid = seatOfCode(seatCode);
      if (!pid) return { error: 'badSeatCode' };
      seats[pid] = tokenFn(); // rotate: the old device's token dies here
      return { playerId: pid, token: seats[pid], seatCode: seatCodes[pid] };
    }
    for (const pid of state.playerOrder) {
      if (state.players[pid].human === true && seats[pid] === undefined) {
        seats[pid] = tokenFn();
        seatCodes[pid] = seatCodeFn();
        return { playerId: pid, token: seats[pid], seatCode: seatCodes[pid] };
      }
    }
    return { error: 'gameFull' };
  }

  // A40 slice 2: per-seat regency. `regents` is a PARALLEL map (like seats/
  // seatCodes) — never game state, state.human stays true so hashes are
  // untouched; envelope-persisted so regency survives a resume. Regent turns
  // log INDIVIDUAL cmd entries (below), NOT a round entry — replay re-applies
  // them verbatim (a round entry's re-derivation only handles non-human
  // seats and would diverge on a regent human).
  function setRegent(pid, stance) {
    if (stance === null || stance === undefined) delete regents[pid];
    else regents[pid] = stance;
  }
  function regentOf(pid) { return regents[pid]; }

  // Play a regent seat's whole turn with the REAL pick logic (engine/ai.js —
  // not a parallel impl), logging each attempt as an ordinary cmd entry.
  // Does NOT end the turn (the caller does, so the following AI chain logs
  // its own round entry). Returns the collected events.
  function playRegentSeat(pid) {
    const done = {};
    const events = [];
    let guard = 500;
    const tally = { applied: 0, byType: {}, research: '', production: [] };
    while (guard-- > 0) {
      // A40 slice 1: the regent plays with its chosen stance (balanced by
      // default — byte-identical to the AI-round path)
      const cmd = pickCommand(state, pid, ruleset, done, regents[pid]);
      if (!cmd) break;
      const res = engine.applyCommand(state, cmd);
      const entry = { t: 'cmd', turn: state.turn, cmd };
      if (res.ok) {
        state = res.state;
        entry.ok = true;
        for (const e of res.events) events.push(e);
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
    // B11b: the synthetic regent summary — same shape session.js emits locally,
    // never logged/hashed (not in `log`), so replay stays exact. filterEvents
    // delivers it to the regent's OWN seat only (playerId party) so the LAN
    // client shows the 🤖 turn-log line exactly like local play.
    events.push({ type: 'regentTurn', playerId: pid, applied: tally.applied,
      byType: tally.byType, research: tally.research, production: tally.production });
    return events;
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

  // Fog policy for round events (B5): what this seat may hear about.
  // Spectators and unknown ids fall through to omniscient, like filterView.
  function eventsFor(playerId, events) {
    return filterEvents(state, events || [], playerId);
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
    for (const pid of Object.keys(seatCodes)) delete seatCodes[pid]; // A46: codes regenerate at rebind
  }

  function toSave() {
    return {
      format: SAVE_FORMAT,
      version: 1,
      gameId,
      savedAt: new Date().toISOString(),
      rulesOverrides,
      seats,
      seatCodes, // A46: recovery codes, envelope-only — never state, never hashed
      regents, // A40: regency stances, envelope-only — never state, never hashed
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
    seatOfCode, // A46: index.js's liveness gate resolves the code first
    setRegent, regentOf, playRegentSeat, // A40 slice 2
    fullLog() { return { initialState: logStart, log, finalHash: hashState(state) }; }, // A47: replay theater source
    resetSeats,
    apply,
    endTurn,
    view,
    eventsFor,
    code,
    toSave,
    saveTo
  };
}
