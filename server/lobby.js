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
  // L3b: the default id-gen mixes BOOT entropy — a bare counter reset every
  // boot, so the first game was always g1 and joinCode('g1') repeated the
  // SAME join code across server restarts (user-observed). The suffix makes
  // ids (and so codes) fresh per boot; tests inject a deterministic gameIdFn;
  // resume-by-code still reuses the SAVED game's own id/code by design.
  const bootSuffix = (deps.nowFn ? deps.nowFn() : Date.now()).toString(36).slice(-4);
  const gameIdFn = deps.gameIdFn || (() => `g${bootSuffix}-${nextNum++}`);
  const seedFn = deps.seedFn || (() => Date.now() % 1000000);
  const nowFn = deps.nowFn || Date.now; // A50 3b: injectable clock for createdAt (lifecycle expiry)
  const ruleset = deps.ruleset;
  const games = {};      // gameId -> entry
  const codeIndex = {};  // joinCode -> gameId

  // A38: how many civs a map size seats reliably (measured fit sweep,
  // data/rules.json maxCivsBySize); absent table = the 14-identity ceiling
  function maxCivsFor(size) {
    const table = ruleset.rules && ruleset.rules.maxCivsBySize;
    return (table && table[size]) || 14;
  }

  // A fresh pre-start lobby, with the creator holding the first human seat.
  function create(options, creatorName) {
    const size = SIZES[options.size] ? options.size : 'medium';
    const wanted = clamp(options.civs, 2, 14);
    if (wanted > maxCivsFor(size)) {
      return { ok: false, reason: 'mapTooSmall', maxCivs: maxCivsFor(size), size };
    }
    const civs = wanted;
    const humans = clamp(options.humans, 1, civs);
    let gameId = gameIdFn();
    let code = joinCode(gameId);
    let guard = 50; // regenerate on the rare join-code collision
    while (codeIndex[code] !== undefined && guard-- > 0) { gameId = gameIdFn(); code = joinCode(gameId); }
    const seats = {};
    for (let i = 0; i < civs; i++) seats['p' + (i + 1)] = { human: i < humans, name: null, reserved: false };
    const entry = {
      gameId, joinCode: code, status: 'lobby',
      createdAt: nowFn(), // A50 3b: unstarted-lobby TTL measures from here
      hostSeat: 'p1', // the creator's seat — may use the host skip (docs/08 §6)
      options: {
        civs, humans,
        size,
        difficulty: options.difficulty, combat: options.combat,
        seed: options.seed !== undefined ? options.seed : seedFn(),
        allowSpectators: options.allowSpectators === true,
        // A20 starting age (validated against the ruleset; ancient = none)
        age: ((ruleset.rules && ruleset.rules.ages) || []).some(a => a.id === options.age) ? options.age : 'ancient',
        // A82a map type (validated against rules.mapTypes; unknown = default)
        maptype: (ruleset.rules && ruleset.rules.mapTypes && ruleset.rules.mapTypes[options.maptype])
          ? options.maptype : 'continents',
        chat: options.chat !== false, // A37: lobby chat, host-toggleable, default ON
        public: options.public === true // A41: find-a-game listing, OPT-IN
      },
      seats, game: null,
      blockedIps: {} // A37 kick-and-block: per-game, dies with the entry
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

  // A27 host controls. NO-KICK policy (@3b520ebc): mode flips reject on
  // reserved seats — 'locked to AI' governs FUTURE joiners, never occupants;
  // kicking would be its own deliberate social feature. Civ picks are fine on
  // any slot (nobody loses a seat).
  function setSlot(gameId, seat, patch) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    if (e.status !== 'lobby') return { ok: false, reason: 'alreadyStarted' };
    const s = e.seats[seat];
    if (!s) return { ok: false, reason: 'noSuchSeat' };
    if (patch.mode !== undefined) {
      if (patch.mode !== 'open' && patch.mode !== 'ai') return { ok: false, reason: 'badMode' };
      if (s.reserved) return { ok: false, reason: 'seatReserved' };
      s.human = patch.mode === 'open';
    }
    if (patch.civ !== undefined) {
      if (patch.civ === '') {
        delete s.civ; // back to Random (A24's seed-shuffle resolves at start)
      } else {
        if (!ruleset.civs || !ruleset.civs[patch.civ]) return { ok: false, reason: 'noSuchCiv' };
        for (const pid of Object.keys(e.seats)) {
          if (pid !== seat && e.seats[pid].civ === patch.civ) return { ok: false, reason: 'civTaken' };
        }
        s.civ = patch.civ;
      }
    }
    return { ok: true };
  }

  // A37: host moderation. Kick frees a reserved seat (LOBBY only — mid-game
  // seats are the AI-regency design's territory, docs/08 §7); the host's own
  // seat is not kickable. The connection cleanup + {t:'kicked'} notify is
  // index.js's job — the registry only owns the seat state.
  function kick(gameId, seat, hostSeat) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    if (e.status !== 'lobby') return { ok: false, reason: 'alreadyStarted' };
    const s = e.seats[seat];
    if (!s) return { ok: false, reason: 'noSuchSeat' };
    if (seat === hostSeat) return { ok: false, reason: 'cannotKickHost' };
    if (!s.reserved) return { ok: false, reason: 'seatNotReserved' };
    s.reserved = false;
    s.name = null;
    return { ok: true };
  }
  function blockIp(gameId, ip) {
    const e = games[gameId];
    if (e && typeof ip === 'string' && ip.length > 0) e.blockedIps[ip] = true;
  }
  function setChat(gameId, on) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    e.options.chat = on === true;
    return { ok: true };
  }

  // Resize to N civs (2 up to what the map seats — A38): grow with Open
  // slots; shrink only past UNRESERVED tail slots (no-kick applies to
  // removal too).
  function setSlots(gameId, civCount) {
    const e = games[gameId];
    if (!e) return { ok: false, reason: 'noSuchGame' };
    if (e.status !== 'lobby') return { ok: false, reason: 'alreadyStarted' };
    const n = clamp(civCount, 2, maxCivsFor(e.options.size));
    const pids = Object.keys(e.seats);
    if (n > pids.length) {
      for (let i = pids.length; i < n; i++) {
        e.seats['p' + (i + 1)] = { human: true, name: null, reserved: false };
      }
    } else if (n < pids.length) {
      for (let i = pids.length; i > n; i--) {
        if (e.seats['p' + i].reserved) return { ok: false, reason: 'seatReserved' };
      }
      for (let i = pids.length; i > n; i--) delete e.seats['p' + i];
    }
    e.options.civs = n;
    return { ok: true };
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
    // A24: every lobby seat gets a DISTINCT civilization — seed-shuffled with
    // the same LCG client/main.js uses for local games, so a seed reproduces
    // the same lineup. A27: host civ PICKS take precedence; the shuffle only
    // fills the Random slots (skipping every picked civ). Humans keep their
    // chosen names; AI seats take the civ name; colors come from the civ.
    const picked = {};
    for (const pid of Object.keys(e.seats)) {
      if (e.seats[pid].civ !== undefined) picked[e.seats[pid].civ] = true;
    }
    const roster = Object.keys(ruleset.civs || {}).sort();
    let shuffleRng = e.options.seed;
    for (let i = roster.length - 1; i > 0; i--) {
      shuffleRng = (shuffleRng * 1103515245 + 12345) % 2147483648;
      const j = shuffleRng % (i + 1);
      const tmp = roster[i]; roster[i] = roster[j]; roster[j] = tmp;
    }
    const pool = roster.filter(id => picked[id] !== true);
    let poolAt = 0;
    const players = [];
    const humanSeats = [];
    Object.keys(e.seats).forEach((pid, i) => {
      const s = e.seats[pid];
      const human = s.human && s.reserved && live[pid] === true;
      const civId = s.civ !== undefined ? s.civ
        : pool.length > 0 ? pool[poolAt++ % pool.length] : undefined;
      const civ = civId ? ruleset.civs[civId] : undefined;
      const def = {
        id: pid,
        name: human ? s.name : (civ ? civ.name : 'AI ' + (i + 1)),
        color: civ ? civ.color : COLORS[i % COLORS.length],
        human
      };
      if (civId) def.civ = civId;
      players.push(def);
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
          seed: e.options.seed,
          debug: deps.debug === true ? true : undefined, // A92: --debug host → debug-capable games
          options: { width: dims[0], height: dims[1], players: allAi, mapType: e.options.maptype }
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
          setup: { seed: e.options.seed,
            debug: deps.debug === true ? true : undefined, // A92
            options: { width: dims[0], height: dims[1], players, mapType: e.options.maptype } }
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
      createdAt: nowFn(), // A50 3b: lifecycle timestamp (parity with lobby entries)
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

  // A50 3b: drop a game from the registry (expired lobby / abandoned game). The
  // caller notifies any live connections first; the on-disk save (if any) is
  // left untouched — an abandoned game stays resumable by its code.
  function remove(gameId) {
    const e = games[gameId];
    if (!e) return false;
    delete codeIndex[e.joinCode];
    delete games[gameId];
    return true;
  }

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

  return {
    create, reserveSeat, releaseSeat, setSlot, setSlots, start, register,
    resolveId, entryOf, list, kick, blockIp, setChat, remove // A37 / A50 3b
  };
}
