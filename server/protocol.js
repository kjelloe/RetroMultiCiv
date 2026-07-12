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
    const bound = game.bindSeat(msg.name, msg.token);
    if (bound.error) {
      const hint = bound.error === 'gameFull'
        ? 'every human seat is bound to an earlier session — rejoin from the '
          + 'original browser AND port (seat tokens live in per-origin '
          + 'localStorage), or restart the server with --reset-seats'
        : 'unknown or stale seat token — rejoin without a token to take a free seat';
      return { reply: [rejected(-1, bound.error, hint)], broadcast: [], viewsChanged: false };
    }
    return {
      reply: [{
        t: 'joined',
        playerId: bound.playerId,
        gameId: game.gameId, // the client needs the real id for the /saves fetch + keys
        token: bound.token,
        view: game.view(bound.playerId),
        rulesOverrides: game.rulesOverrides,
        code: game.code() // docs/07: the authoritative verification code
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
    reply: [{ t: 'applied', commandId: msg.commandId, events: res.events || [] }],
    broadcast: turnBroadcasts(game),
    viewsChanged: true
  };
}
