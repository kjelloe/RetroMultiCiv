// Phase-4 lobby (docs/08 §2, §6): a multi-game layer ABOVE the untouched
// game.js. The server holds N games in memory keyed by gameId; each is first a
// pre-start LOBBY (options + seat reservations) and becomes a started GAME (a
// game.js instance) at the creator's {t:'start'}. Pure logic + an in-memory
// registry; index.js owns the sockets and does the per-game broadcast / view /
// autosave fan-out.
//
// Seat-token lifecycle (architect decision A/B, mail @e82e7068): reservations are
// connection-scoped and TOKENLESS until start. The LOBBY OWNS THE SEATING CHART
// — start() authors setup.options.players so reserved humans land on exactly
// the seats they picked (join order otherwise) and unfilled/disconnected slots
// become AI. index.js then binds each live human seat in seat order via
// game.bindSeat (so first-free IS the chart) and pushes the phase-3 joined
// reply. Reservation names become the player names (killing "Player N").
import { createGame } from './game.js';
import { createEngine } from '../engine/index.js';
import { fastForwardTo } from '../shared/fastforward.js';
import { fnv32 } from '../shared/gamecode.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const COLORS = ['#3b7dd8', '#d84a3b', '#3bd87d', '#d8b13b', '#9b59d0', '#d07f3b', '#4fd0c9'];
const SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
const DIFFICULTY = { trainer: 6, easy: 5, medium: 4, hard: 3, godemperor: 2 };

function clamp(n, lo, hi) {
  const v = Math.floor(Number(n));
  if (!(v >= lo)) return lo;
  return v > hi ? hi : v;
}

// difficulty/combat options → ruleset overrides (same mechanism as the client).
function overridesFor(options) {
  const o = {};
  const d = options.difficulty;
  if (d && DIFFICULTY[d] !== undefined && d !== 'medium') o.contentCitizens = DIFFICULTY[d];
  if (options.combat === 'bestof3') o.combatRounds = 3;
  return o;
}

// 5 Crockford-base32 chars derived from the gameId (25 bits of its FNV hash).
// Deterministic: the same gameId always yields the same code.
export function joinCode(gameId) {
  let h = fnv32(String(gameId), false);
  let s = '';
  for (let i = 0; i < 5; i++) { s = CROCKFORD.charAt(h % 32) + s; h = Math.floor(h / 32); }
  return s;
}

// deps: { ruleset, gameIdFn?, seedFn? }. gameIdFn/seedFn are injectable so
// tests are deterministic; index.js passes the real ruleset and defaults.
export function createRegistry(deps) {
  let nextNum = 1;
  const gameIdFn = deps.gameIdFn || (() => 'g' + (nextNum++));
  const seedFn = deps.seedFn || (() => Date.now() % 1000000);
  const ruleset = deps.ruleset;
  const games = {};      // gameId -> entry
  const codeIndex = {};  // joinCode -> gameId

  // A fresh pre-start lobby, with the creator holding the first human seat.
  function create(options, creatorName) {
    const civs = clamp(options.civs, 2, 7);
    const humans = clamp(options.humans, 1, civs);
    let gameId = gameIdFn();
    let code = joinCode(gameId);
    let guard = 50; // regenerate on the rare join-code collision
    while (codeIndex[code] !== undefined && guard-- > 0) { gameId = gameIdFn(); code = joinCode(gameId); }
    const seats = {};
    for (let i = 0; i < civs; i++) seats['p' + (i + 1)] = { human: i < humans, name: null, reserved: false };
    const entry = {
      gameId, joinCode: code, status: 'lobby',
      hostSeat: 'p1', // the creator's seat — may use the host skip (docs/08 §6)
      options: {
        civs, humans,
        size: SIZES[options.size] ? options.size : 'medium',
        difficulty: options.difficulty, combat: options.combat,
        seed: options.seed !== undefined ? options.seed : seedFn(),
        allowSpectators: options.allowSpectators === true,
        // A20 starting age (validated against the ruleset; ancient = none)
        age: ((ruleset.rules && ruleset.rules.ages) || []).some(a => a.id === options.age) ? options.age : 'ancient'
      },
      seats, game: null
    };
    seats.p1.reserved = true;
    seats.p1.name = creatorName || 'Player 1';
    games[gameId] = entry;
    codeIndex[code] = gameId;
    return { entry, seat: 'p1' };
  }

  // Reserve a human seat for a joiner: the requested seat if free, else the
  // first free human seat. Connection-scoped — index.js frees it on disconnect.
  function reserveSeat(gameId, opts) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    if (e.status !== 'lobby') return { ok: false, reason: 'alreadyStarted' };
    let pid = null;
    if (opts.seat && e.seats[opts.seat] && e.seats[opts.seat].human && !e.seats[opts.seat].reserved) {
      pid = opts.seat;
    } else {
      pid = Object.keys(e.seats).find(p => e.seats[p].human && !e.seats[p].reserved) || null;
    }
    if (!pid) return { ok: false, reason: 'gameFull' };
    e.seats[pid].reserved = true;
    e.seats[pid].name = opts.name || pid;
    return { ok: true, seat: pid };
  }

  function releaseSeat(gameId, seat) {
    const e = games[gameId];
    if (e && e.status === 'lobby' && e.seats[seat]) {
      e.seats[seat].reserved = false;
      e.seats[seat].name = null;
    }
  }

  // Build the engine game at the creator's start. liveSeats = seat ids whose
  // reserving connection is still present; a reserved-but-dropped seat OR an
  // unfilled human seat becomes AI (the creator's "start anyway"). Returns
  // { ok, game, humanSeats } — human seats IN ORDER for index.js to bindSeat +
  // joined-push (binding in order makes bindSeat's first-free land on the chart).
  function start(gameId, liveSeats) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    if (e.status === 'started') return { ok: false, reason: 'alreadyStarted' };
    const live = {};
    for (const s of (liveSeats || [])) live[s] = true;
    const players = [];
    const humanSeats = [];
    Object.keys(e.seats).forEach((pid, i) => {
      const s = e.seats[pid];
      const human = s.human && s.reserved && live[pid] === true;
      players.push({ id: pid, name: human ? s.name : ('AI ' + (i + 1)), color: COLORS[i % COLORS.length], human });
      if (human) humanSeats.push(pid);
    });
    const dims = SIZES[e.options.size];
    const ageEntry = ((ruleset.rules && ruleset.rules.ages) || []).find(a => a.id === e.options.age);
    let game;
    try {
      if (ageEntry && ageEntry.turn > 0) {
        // A20: the whole world plays as AI to the age turn, then the chart's
        // human seats take over (fastForwardTo grants techs + flips them)
        const allAi = players.map(p => Object.assign({}, p, { human: false }));
        const engine = createEngine(Object.assign({}, ruleset, {
          rules: Object.assign({}, ruleset.rules, overridesFor(e.options))
        }));
        const raw = engine.createGame({
          seed: e.options.seed, options: { width: dims[0], height: dims[1], players: allAi }
        });
        if (raw.ok === false) return { ok: false, reason: raw.reason };
        const r = fastForwardTo(ruleset, raw, ageEntry, humanSeats);
        if (r.aborted) {
          return {
            ok: false,
            reason: r.aborted.reason === 'civEliminated'
              ? `ageAborted: ${r.aborted.name} died before the ${ageEntry.name}`
              : `ageAborted: ${r.aborted.reason}`
          };
        }
        game = createGame({
          ruleset, gameId, rulesOverrides: overridesFor(e.options), initialState: r.state
        });
      } else {
        game = createGame({
          ruleset, gameId, rulesOverrides: overridesFor(e.options),
          setup: { seed: e.options.seed, options: { width: dims[0], height: dims[1], players } }
        });
      }
    } catch (err) {
      return { ok: false, reason: err.message };
    }
    e.game = game;
    e.status = 'started';
    return { ok: true, game, humanSeats };
  }

  // Register an ALREADY-STARTED game (the phase-3 boot game / a --game resume)
  // so a bare targetless join still reaches it and it shows in the list. Its
  // seats are game.js's, not lobby reservations — mirror them for the roster.
  function register(game, allowSpectators) {
    const gameId = game.gameId;
    const seats = {};
    for (const pid of game.state.playerOrder) {
      const p = game.state.players[pid];
      if (p.human) seats[pid] = { human: true, reserved: true, name: p.name };
    }
    const code = joinCode(gameId);
    const entry = {
      gameId, joinCode: code, status: 'started',
      options: { allowSpectators: allowSpectators === true }, seats, game,
      hostSeat: Object.keys(seats)[0] || 'p1' // first human seat hosts the boot game
    };
    games[gameId] = entry;
    codeIndex[code] = gameId;
    return entry;
  }

  // Accept a full gameId or a join code (case-insensitive).
  function resolveId(idOrCode) {
    if (games[idOrCode]) return idOrCode;
    const up = String(idOrCode || '').toUpperCase();
    return codeIndex[up] || null;
  }

  function entryOf(gameId) { return games[gameId] || null; }

  // Open games for the {t:'list'} reply.
  function list() {
    return Object.keys(games).map(id => {
      const e = games[id];
      const total = Object.values(e.seats).filter(s => s.human).length;
      const taken = Object.values(e.seats).filter(s => s.human && s.reserved).length;
      return {
        gameId: id, joinCode: e.joinCode, started: e.status === 'started',
        turn: e.game ? e.game.state.turn : 0,
        seats: { taken, total }
      };
    });
  }

  return { create, reserveSeat, releaseSeat, start, register, resolveId, entryOf, list };
}
