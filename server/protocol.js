// Frame validation and routing (docs/06-phase3-server.md §3). Pure: no
// sockets, no timers — slice 2's ws layer feeds it raw strings and fans out
// the results. Per-seat views can't be broadcast (they differ per player),
// so routing signals `viewsChanged` and the socket layer sends each
// connection its own `game.view(seat)`.
const MAX_FRAME = 64 * 1024;

export function parseMessage(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_FRAME) {
    return { ok: false, code: 'badFrame' };
  }
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    return { ok: false, code: 'badJson' };
  }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') {
    return { ok: false, code: 'badShape' };
  }
  if (msg.t === 'ping') return { ok: true, msg };
  if (msg.t === 'join') {
    if (typeof msg.name !== 'string' || msg.name.length < 1 || msg.name.length > 24) {
      return { ok: false, code: 'badName' };
    }
    if (msg.token !== undefined && typeof msg.token !== 'string') {
      return { ok: false, code: 'badShape' };
    }
    if (msg.seat !== undefined && typeof msg.seat !== 'string') return { ok: false, code: 'badShape' };
    if (msg.spectator !== undefined && typeof msg.spectator !== 'boolean') return { ok: false, code: 'badShape' };
    if (msg.seatCode !== undefined // A46: XXXX-YYYY in the docs/07 alphabet
        && !/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{4}-[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{4}$/.test(msg.seatCode)) {
      return { ok: false, code: 'badShape' };
    }
    return { ok: true, msg };
  }
  // phase-4 lobby frames (docs/08 §2): create a game, list open games, start.
  if (msg.t === 'create') {
    if (typeof msg.name !== 'string' || msg.name.length < 1 || msg.name.length > 24) {
      return { ok: false, code: 'badName' };
    }
    if (msg.options !== undefined && (typeof msg.options !== 'object' || Array.isArray(msg.options))) {
      return { ok: false, code: 'badShape' };
    }
    return { ok: true, msg };
  }
  if (msg.t === 'list' || msg.t === 'start') return { ok: true, msg };
  // A27 host-only lobby edits: slot mode/civ + slot-count resize
  if (msg.t === 'setSlot') {
    if (typeof msg.seat !== 'string') return { ok: false, code: 'badShape' };
    if (msg.mode !== undefined && msg.mode !== 'open' && msg.mode !== 'ai') return { ok: false, code: 'badShape' };
    if (msg.civ !== undefined && typeof msg.civ !== 'string') return { ok: false, code: 'badShape' };
    if (msg.mode === undefined && msg.civ === undefined) return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  if (msg.t === 'setSlots') {
    if (!Number.isInteger(msg.civs)) return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  // A37: lobby chat + host moderation. Chat text is HARD-capped here (200
  // chars) so oversized frames never reach routing; chat is transient lobby
  // traffic and NEVER enters game state.
  if (msg.t === 'chat') {
    if (typeof msg.text !== 'string' || msg.text.length === 0 || msg.text.length > 200) {
      return { ok: false, code: 'badShape' };
    }
    return { ok: true, msg };
  }
  if (msg.t === 'setChat') {
    if (typeof msg.on !== 'boolean') return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  if (msg.t === 'kick') {
    if (typeof msg.seat !== 'string') return { ok: false, code: 'badShape' };
    if (msg.block !== undefined && typeof msg.block !== 'boolean') return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  // A41 find-a-game: browse is auth-free; joinListed carries the same join
  // fields and the server resolves it to the SAME reservation path — but
  // only for lobbies that opted INTO the public list.
  if (msg.t === 'listGames') return { ok: true, msg };
  if (msg.t === 'joinListed') {
    if (typeof msg.gameId !== 'string') return { ok: false, code: 'badShape' };
    if (msg.name !== undefined && typeof msg.name !== 'string') return { ok: false, code: 'badShape' };
    if (msg.seat !== undefined && typeof msg.seat !== 'string') return { ok: false, code: 'badShape' };
    if (msg.spectator !== undefined && typeof msg.spectator !== 'boolean') return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  // A34: resume server saves from the host flow. `file` is a BASENAME only —
  // the strict shape here plus the server-side saves/-scoped resolution keeps
  // client-supplied paths out (no separators, no dotfiles, .json only).
  if (msg.t === 'listSaves') return { ok: true, msg };
  if (msg.t === 'resume') {
    if (typeof msg.file !== 'string' || !/^[A-Za-z0-9][\w.-]*\.json$/.test(msg.file)
        || msg.file.includes('..') || msg.file.includes('/') || msg.file.includes('\\')) {
      return { ok: false, code: 'badShape' };
    }
    return { ok: true, msg };
  }
  // phase-4 turn flow (docs/08 §6): host skip + propose/vote (>2/3 of eligible).
  if (msg.t === 'skipTurn' || msg.t === 'proposeSkip') return { ok: true, msg };
  if (msg.t === 'vote') {
    if (typeof msg.yes !== 'boolean') return { ok: false, code: 'badShape' };
    return { ok: true, msg };
  }
  if (msg.t === 'cmd' || msg.t === 'endTurn') {
    if (typeof msg.token !== 'string') return { ok: false, code: 'badToken' };
    if (!Number.isInteger(msg.commandId)) return { ok: false, code: 'badShape' };
    if (msg.t === 'cmd'
        && (!msg.cmd || typeof msg.cmd !== 'object' || Array.isArray(msg.cmd)
            || typeof msg.cmd.type !== 'string')) {
      return { ok: false, code: 'badShape' };
    }
    return { ok: true, msg };
  }
  return { ok: false, code: 'unknownType' };
}

// A24: pid -> civ id for every player that has one — public identity (the
// scoreboard names civs anyway), so the client can wire city-name rosters and
// faction visuals in server games. Cleaner long-term home: filterView's
// players projection — flagged to the architect; this rides the joined reply
// meanwhile (survives reconnect and spectate for free).
export function playerCivs(game) {
  const out = {};
  for (const pid of game.state.playerOrder) {
    if (game.state.players[pid].civ !== undefined) out[pid] = game.state.players[pid].civ;
  }
  return out;
}

function rejected(commandId, code, message) {
  const out = { t: 'rejected', commandId, code };
  if (message) out.message = message;
  return out;
}

// The broadcasts every turn-advancing action produces — route() emits them
// after cmd/endTurn, and index.js reuses them for a passed skip-vote so the
// two paths can't drift. code broadcast per docs/07 (rides every autosave).
export function turnBroadcasts(game) {
  const out = [{ t: 'turn', activePlayerId: game.state.activePlayer, turn: game.state.turn }];
  out.push({ t: 'code', turn: game.state.turn, code: game.code() });
  if (game.state.gameOver === true) out.push({ t: 'gameOver', winner: game.state.winner });
  return out;
}

// route(game, msg) -> { reply: [...], broadcast: [...], viewsChanged }
// reply goes to the sender only; broadcast to every connection; when
// viewsChanged, the socket layer additionally sends {t:'view', view} per
// seat. join replies carry rulesOverrides, NOT the ruleset — clients fetch
// data/*.json from the same static host and apply the overrides (the
// difficulty mechanism), keeping join frames small.
export function route(game, msg) {
  if (msg.t === 'ping') {
    return { reply: [{ t: 'pong' }], broadcast: [], viewsChanged: false };
  }

  if (msg.t === 'join') {
    const bound = game.bindSeat(msg.name, msg.token, msg.seatCode);
    if (bound.error) {
      const hint = bound.error === 'gameFull'
        ? 'every human seat is bound to an earlier session — rejoin from the '
          + 'original browser AND port (seat tokens live in per-origin '
          + 'localStorage), use your seat code, or restart the server with --reset-seats'
        : bound.error === 'badSeatCode'
          ? 'no seat carries that code — check the XXXX-YYYY code the game showed you'
        : 'unknown or stale seat token — rejoin without a token to take a free seat';
      return { reply: [rejected(-1, bound.error, hint)], broadcast: [], viewsChanged: false };
    }
    return {
      reply: [{
        t: 'joined',
        playerId: bound.playerId,
        gameId: game.gameId, // the client needs the real id for the /saves fetch + keys
        token: bound.token,
        seatCode: bound.seatCode, // A46: shown to its OWNER only (private reply)
        view: game.view(bound.playerId),
        rulesOverrides: game.rulesOverrides,
        code: game.code(), // docs/07: the authoritative verification code
        civs: playerCivs(game) // A24: public identity — city rosters + faction visuals
      }],
      broadcast: [],
      viewsChanged: false
    };
  }

  // cmd / endTurn: authenticate the seat, stamp, apply
  const playerId = game.seatOf(msg.token);
  if (playerId === null) {
    return { reply: [rejected(msg.commandId, 'badToken', 'unknown seat token')], broadcast: [], viewsChanged: false };
  }
  const res = msg.t === 'endTurn'
    ? game.endTurn(playerId)
    : game.apply(playerId, msg.cmd);
  if (!res.ok) {
    return { reply: [rejected(msg.commandId, res.reason)], broadcast: [], viewsChanged: false };
  }
  return {
    // the actor's ack: own actions are visible by definition, but run them
    // through the same fog policy anyway (belt-and-braces, B5 ruling)
    reply: [{ t: 'applied', commandId: msg.commandId, events: game.eventsFor(playerId, res.events || []) }],
    broadcast: turnBroadcasts(game),
    viewsChanged: true,
    // raw round events for the socket layer: fanout filters them PER SEAT
    // and rides them on each view push (B5 — every human's turn log hears
    // the AI/rival combat their fog allows)
    events: res.events || []
  };
}
