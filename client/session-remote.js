// Phase-3 remote session (docs/06 §5): the same five-surface contract as
// client/session.js — state / apply / endTurn / onChange / ruleset — but the
// authoritative engine runs on the server. This module speaks the docs/06 §3
// protocol over one WebSocket; the ui never knows it isn't local.
//
// Ordering the design relies on (server/index.js sends reply → broadcast →
// per-seat view, and WebSocket preserves per-connection order): a successful
// command yields `applied` (events) THEN `view` (new state). So apply()'s
// Promise resolves on the VIEW, not the ack — session.state is fresh by the
// time an awaiting caller resumes. A `rejected` has no following view, so it
// resolves immediately.

export function createRemoteSession(opts) {
  const baseRuleset = opts.ruleset;      // terrain/units/techs/... + base rules
  const baseRules = opts.baseRules || baseRuleset.rules;
  const wsUrl = opts.wsUrl;
  const name = opts.name || 'Player';
  const spectator = opts.spectator === true; // A17: tokenless view-only pseudo-seat
  // The server owns the gameId; the client learns it from the joined reply and
  // NEEDS it for the /saves/<gameId>.json fetch + localStorage key names. Persist
  // it per-origin so a page reload can find its token key before joining (the
  // seat-reclaim chicken-and-egg). KNOWN LIMIT (accepted for phase 4,
  // @704be920): one slot = one concurrent server game per browser origin;
  // ?game=<id> in the URL beats the stored value when both exist.
  const GAMEID_KEY = 'retromulticiv-gameid';
  const storedGameId = localStorage.getItem(GAMEID_KEY);
  let gameId = opts.gameId || storedGameId || 'g1';
  // 'g1' is only a placeholder for keying; a bare ?server=1 join must NOT send
  // it (the multi-game server would reject an unknown id) — omit gameId until
  // we actually know one (from ?game=, localStorage, or the joined reply), so
  // the server routes to its default game.
  let gameIdKnown = Boolean(opts.gameId || storedGameId);

  let ws = null;
  let state = null;
  let ruleset = baseRuleset;
  let playerId = null;
  let serverCode; // docs/07: the authoritative code, from joined + {t:'code'} pushes
  let playerCivsMap = {}; // A24: pid -> civ id from the joined reply
  let token = tokenKey(gameId) && localStorage.getItem(tokenKey(gameId)) || null;
  let commandId = 0;
  let joined = false;
  const listeners = [];
  const sent = [];                        // lightweight log for diagnostics/probe
  let statusHandler = null;
  let metaHandler = null;                 // phase-4 turn-flow frames (presence, skipVote…)

  // one command in flight at a time (the ui awaits): the ack's events wait
  // here for the view that resolves the caller's Promise.
  let awaiting = null;                    // { commandId, resolve }
  let awaitingEvents = null;

  function tokenKey(id) { return 'retromulticiv-token-' + id; }
  function notify(events) { for (const cb of listeners) cb(state, events || []); }
  function status(msg) { if (statusHandler) statusHandler(msg); else console.warn('[server]', msg); }

  // filterView (engine/visibility.js) ships you/turn/map/units/cities/players
  // but NOT cityOrder/wonders/nextCityId, which some client reads expect.
  // Reconstruct the shims client-side (cities arrive in founding order, so
  // Object.keys rebuilds cityOrder; own cities are always present). wonders
  // defaults to {} — the guarded reads (combat-preview walls, the C build
  // menu) degrade gracefully. FLAGGED to the architect for a filterView fix.
  function augment(view) {
    if (!view) return view;
    if (view.cityOrder === undefined) view.cityOrder = Object.keys(view.cities || {});
    if (view.wonders === undefined) view.wonders = {};
    if (view.nextCityId === undefined) view.nextCityId = Object.keys(view.cities || {}).length + 1;
    // filterView drops the per-player `explored` array (the tiles already
    // encode it as t:'unknown'); reconstruct it so sitePreview's fog guard
    // works instead of treating the whole map as explored and rating fog.
    const me = view.players && view.you !== undefined ? view.players[view.you] : null;
    if (me && me.explored === undefined && view.map && Array.isArray(view.map.tiles)) {
      const t = view.map.tiles;
      const ex = [];
      for (let i = 0; i < t.length; i++) ex.push(t[i].t === 'unknown' ? 0 : 1);
      me.explored = ex;
    }
    return view;
  }

  // sitePreview/city-view reuse engine tileYields, which crashes on the view's
  // fog tiles (t:'unknown' has no terrain def). Give the client ruleset a
  // zero-yield 'unknown' terrain so those tiles score 0 (then get filtered out
  // of the rating by the explored shim above) rather than throwing.
  if (baseRuleset.terrain && baseRuleset.terrain.terrains
      && baseRuleset.terrain.terrains.unknown === undefined) {
    baseRuleset.terrain.terrains.unknown = {
      yields: { food: 0, shields: 0, trade: 0 }, defenseBonus: 0, domain: 'land', move: 1
    };
  }

  function applyRuleset(rulesOverrides) {
    const ov = rulesOverrides || {};
    ruleset = Object.keys(ov).length > 0
      ? Object.assign({}, baseRuleset, { rules: Object.assign({}, baseRules, ov) })
      : Object.assign({}, baseRuleset, { rules: baseRules });
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function handle(msg) {
    if (msg.t === 'joined') {
      playerId = msg.playerId;
      if (msg.gameId) { // adopt the server's real id BEFORE keying the token by it
        gameId = msg.gameId;
        gameIdKnown = true;
        try { localStorage.setItem(GAMEID_KEY, gameId); } catch (e) { /* private mode */ }
      }
      if (!spectator) { // spectators are tokenless — nothing to persist/reclaim
        token = msg.token;
        try { localStorage.setItem(tokenKey(gameId), token); } catch (e) { /* private mode */ }
      }
      applyRuleset(msg.rulesOverrides);
      state = augment(msg.view);
      if (msg.code !== undefined) serverCode = msg.code;
      if (msg.civs !== undefined) playerCivsMap = msg.civs;
      const wasJoined = joined;
      joined = true;
      if (wasJoined) notify([]); // reconnect: refresh the view under the ui
      return { joinedNow: !wasJoined };
    }
    if (msg.t === 'applied') {
      awaitingEvents = msg.events || [];
      return {};
    }
    if (msg.t === 'rejected') {
      if (awaiting && (msg.commandId === awaiting.commandId)) {
        const w = awaiting; awaiting = null; awaitingEvents = null;
        w.resolve({ ok: false, reason: msg.code, message: msg.message, events: [] });
      } else if (msg.commandId === -1) {
        status('server rejected a frame: ' + msg.code);
      }
      return {};
    }
    if (msg.t === 'view') {
      state = augment(msg.view);
      const events = awaitingEvents || [];
      awaitingEvents = null;
      notify(events);                     // ui refreshes on the new state first
      if (awaiting) { const w = awaiting; awaiting = null; w.resolve({ ok: true, events }); }
      return {};
    }
    if (msg.t === 'gameOver') {
      if (state) { state.gameOver = true; state.winner = msg.winner; }
      return {};
    }
    if (msg.t === 'code') {
      serverCode = msg.code;
      notify([]); // refresh displays that read the code (e.g. the game-over line)
      return {};
    }
    // everything else (turn, presence, skipVote, turnSkipped, pong…) is
    // informational — the view is the authoritative state. The phase-4 turn
    // flow UI (ui/lobby.js initMultiplayerFlow) listens through this hook.
    if (metaHandler) metaHandler(msg);
    return {};
  }

  // apply/endTurn share the request path: stamp a commandId, register the
  // single in-flight waiter, send, and hand back the Promise the ui awaits.
  function request(frame) {
    if (!joined || !ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ ok: false, reason: 'notConnected', events: [] });
    }
    frame.commandId = ++commandId;
    frame.gameId = gameId;
    frame.token = token;
    sent.push({ t: frame.t, commandId: frame.commandId });
    return new Promise(resolve => {
      awaiting = { commandId: frame.commandId, resolve };
      send(frame);
    });
  }

  function openSocket(resolveJoin, rejectJoin) {
    let triedFresh = false;
    ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => {
      send({
        t: 'join', gameId: gameIdKnown ? gameId : undefined, name,
        token: spectator ? undefined : (token || undefined),
        spectator: spectator || undefined
      });
    });
    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const r = handle(msg);
      if (r.joinedNow && resolveJoin) { const f = resolveJoin; resolveJoin = null; f(); }
      if (msg.t === 'rejected' && msg.commandId === -1 && !joined) {
        // a stored token the server no longer knows (it started a fresh game):
        // drop it and try once as a brand-new join before giving up
        if (msg.code === 'badToken' && token && !triedFresh) {
          triedFresh = true;
          token = null;
          try { localStorage.removeItem(tokenKey(gameId)); } catch (e) { /* private mode */ }
          send({ t: 'join', gameId: gameIdKnown ? gameId : undefined, name });
        } else if (rejectJoin) {
          const f = rejectJoin; rejectJoin = null; f(new Error('join rejected: ' + msg.code));
        }
      }
    });
    ws.addEventListener('close', () => {
      if (joined) {
        status('disconnected — retrying…');
        setTimeout(() => openSocket(null, null), 1000); // reconnect with stored token
      }
    });
    ws.addEventListener('error', () => { if (rejectJoin) { const f = rejectJoin; rejectJoin = null; f(new Error('socket error')); } });
  }

  const session = {
    get state() { return state; },
    get log() { return sent; },
    get ruleset() { return ruleset; },
    get playerId() { return playerId; },
    get gameId() { return gameId; }, // presence signals server mode to ui/saves.js
    get serverCode() { return serverCode; }, // docs/07: authoritative code for ctx.gameCode()
    get playerCivs() { return playerCivsMap; }, // A24: pid -> civ id (public identity)

    onChange(cb) { listeners.push(cb); },
    setStatusHandler(fn) { statusHandler = fn; },
    setMetaHandler(fn) { metaHandler = fn; },
    // fire-and-forget phase-4 frames (skipTurn / proposeSkip / vote) — no
    // commandId, no waiter; the server answers with broadcasts.
    sendMeta(frame) { send(Object.assign({ gameId }, frame)); },

    apply(cmd) { return request({ t: 'cmd', cmd }); },
    endTurn() { return request({ t: 'endTurn' }); },

    // Server owns persistence (autosave + --game resume); local save/load and
    // the diagnostics recorder are server-side in this mode.
    replaceState() { status('load a save on the server, not the client, in server mode'); },
    exportDiagnostics(extra) {
      return Object.assign({ format: 'retromulticiv-diagnostics', version: 1, remote: true, log: sent }, extra || {});
    }
  };

  return new Promise((resolve, reject) => {
    openSocket(() => resolve(session), reject);
  });
}
