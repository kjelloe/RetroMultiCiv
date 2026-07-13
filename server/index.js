// Server boot (docs/06 §2 + docs/08 §2): static file hosting for the client +
// a WebSocket endpoint. Phase 4 adds a multi-game LOBBY (server/lobby.js) above
// the untouched game.js: the server still boots one DEFAULT game so phase-3
// `?server=1` bare joins keep working, and additionally serves create/list/
// join-by-code/start so friends can spin up their own games. The socket layer
// stays thin — validation in protocol.js, seat logic in lobby.js, state in
// game.js. Started games autosave after every accepted command (--game resume).
//
//   node server/index.js [--port 8123] [--seed N] [--civs N] [--humans N]
//                        [--size medium] [--game saves/<id>.json]
//                        [--reset-seats] [--no-save]
//
// Then open http://localhost:<port>/client/?server=1 — the client joins the
// default game, or hosts/joins a lobby game (phase-4 slice 2).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame } from './game.js';
import { createRegistry } from './lobby.js';
import { parseMessage, route, turnBroadcasts, playerCivs } from './protocol.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml'
};
const SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
const COLORS = ['#3b7dd8', '#d84a3b', '#3bd87d', '#d8b13b', '#9b59d0', '#d07f3b', '#4fd0c9'];

function loadRuleset() {
  const data = (f) => JSON.parse(fs.readFileSync(path.join(REPO, 'data', f), 'utf8'));
  return {
    terrain: data('terrain.json'), units: data('units.json'), techs: data('techs.json'),
    buildings: data('buildings.json'), wonders: data('wonders.json'),
    governments: data('governments.json'), civs: data('civs.json'), rules: data('rules.json')
  };
}

function setupFromOpts(opts) {
  const dims = SIZES[opts.size] || SIZES.medium;
  const players = [];
  for (let i = 0; i < opts.civs; i++) {
    players.push({
      id: 'p' + (i + 1), name: 'Player ' + (i + 1),
      color: COLORS[i % COLORS.length], human: i < opts.humans
    });
  }
  return { seed: opts.seed, options: { width: dims[0], height: dims[1], players } };
}

// opts: { port?, game?, saveFile?, autosave?, resetSeats? } plus fresh-game
// fields (seed/civs/humans/size). Returns { port, game, close } — `game` is the
// DEFAULT game (phase-3 compat) used by the integration test and the CLI.
export function startServer(opts) {
  const ruleset = opts.ruleset || loadRuleset();
  const registry = createRegistry({ ruleset });
  const saveFiles = {};    // gameId -> autosave path
  const autosave = opts.autosave !== false;

  // Boot the default game (phase-3): a resume (--game) or a fresh setup.
  let defaultGame;
  if (opts.game) {
    const parsed = JSON.parse(fs.readFileSync(opts.game, 'utf8'));
    if (parsed.format !== 'retromulticiv-server-save') {
      throw new Error(
        `--game needs a SERVER save (saves/<gameId>.json, written by the server's autosave) — `
        + `this file is "${parsed.format || 'unknown format'}". Client Shift+S files hold one `
        + `player's state${parsed.format === 'retromulticiv-save' ? ' (and in ?server=1 mode only a fog-filtered VIEW)' : ''} `
        + `and cannot boot a server.`);
    }
    defaultGame = createGame({ ruleset, save: parsed });
    if (opts.resetSeats) {
      defaultGame.resetSeats();
      console.log('seat bindings cleared (--reset-seats) — first joiners take the seats');
    }
    saveFiles[defaultGame.gameId] = opts.saveFile || opts.game;
  } else {
    defaultGame = createGame({
      ruleset,
      gameId: opts.gameId || ('g' + (opts.seed || 1)),
      rulesOverrides: opts.rulesOverrides,
      setup: setupFromOpts({
        seed: opts.seed || 1, civs: opts.civs || 2,
        humans: opts.humans || 1, size: opts.size || 'medium'
      })
    });
    saveFiles[defaultGame.gameId] = opts.saveFile || path.join(REPO, 'saves', defaultGame.gameId + '.json');
  }
  // the boot game allows spectators by default (a local-dev convenience; the
  // CLI host stays in control via --no-spectators — docs/08 §6). Lobby-created
  // games remain opt-in at create.
  registry.register(defaultGame, opts.spectators !== false);
  const defaultGameId = defaultGame.gameId;

  const httpServer = http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://x');
    const urlPath = decodeURIComponent(parsed.pathname);
    // A22: friendly entry points — the bare host and /client (no slash) both
    // land on /client/ (302 keeps the query string: join links carry params)
    if (urlPath === '/' || urlPath === '/client') {
      res.writeHead(302, { Location: '/client/' + parsed.search });
      res.end();
      return;
    }
    let file = path.normalize(path.join(REPO, urlPath));
    if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const conns = new Map(); // ws -> { gameId?, seat?, playerId?, isCreator? }

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
  function savePath(gameId) {
    if (!saveFiles[gameId]) saveFiles[gameId] = path.join(REPO, 'saves', gameId + '.json');
    return saveFiles[gameId];
  }
  function roster(entry) {
    return {
      options: entry.options,
      seats: Object.keys(entry.seats).map(pid => ({
        seat: pid, human: entry.seats[pid].human,
        reserved: entry.seats[pid].reserved === true, name: entry.seats[pid].name
      }))
    };
  }
  function broadcastLobby(gameId) {
    const e = registry.entryOf(gameId);
    if (!e) return;
    const r = roster(e);
    for (const [o, i] of conns) if (i.gameId === gameId) send(o, { t: 'lobby', gameId, lobby: r });
  }
  // broadcast + per-seat view fan-out to every connection in the given game
  // (spectator pseudo-seats get game.view('spectator') — omniscient, docs/08 §6).
  function fanout(gameId, out, game) {
    for (const m of out.broadcast) for (const [o, i] of conns) if (i.gameId === gameId) send(o, m);
    if (out.viewsChanged) {
      for (const [o, i] of conns) if (i.gameId === gameId && i.playerId) send(o, { t: 'view', view: game.view(i.playerId) });
      if (autosave) game.saveTo(savePath(gameId));
      // a stale skip vote dies the moment the turn moves off its target
      const e = registry.entryOf(gameId);
      if (e && e.skipVote && game.state.activePlayer !== e.skipVote.target) e.skipVote = null;
    }
  }

  // --- phase-4 turn flow (docs/08 §4 + §6) --------------------------------
  function gameConns(gameId) {
    const out = [];
    for (const [o, i] of conns) if (i.gameId === gameId) out.push([o, i]);
    return out;
  }
  function broadcastGame(gameId, msg) {
    for (const [o] of gameConns(gameId)) send(o, msg);
  }
  // connected human seats, excluding the at-turn player and spectators —
  // the skip-vote electorate (docs/08 §6: pass at MORE than 2/3).
  function eligibleVoters(gameId, atTurn) {
    const seats = {};
    for (const [, i] of gameConns(gameId)) {
      if (i.playerId && !i.spectator && i.playerId !== atTurn) seats[i.playerId] = true;
    }
    return Object.keys(seats);
  }
  function doSkip(gameId, e) {
    const seat = e.game.state.activePlayer;
    const res = e.game.endTurn(seat); // stamped with the skipped seat, logged like any command
    e.skipVote = null;
    if (!res.ok) return;
    broadcastGame(gameId, { t: 'turnSkipped', playerId: seat });
    fanout(gameId, { broadcast: turnBroadcasts(e.game), viewsChanged: true }, e.game);
  }
  function skipVoteState(e, gameId) {
    const eligible = eligibleVoters(gameId, e.skipVote.target);
    const yes = eligible.filter(p => e.skipVote.votes[p] === true).length;
    // strictly more than 2/3 of eligible: yes*3 > eligible*2
    const needed = Math.floor(eligible.length * 2 / 3) + 1;
    return { target: e.skipVote.target, yes, needed };
  }
  function handleSkipFrames(ws, info, msg) {
    const e = info.gameId ? registry.entryOf(info.gameId) : null;
    if (!e || e.status !== 'started' || !info.playerId || info.spectator) {
      send(ws, { t: 'rejected', commandId: -1, code: 'notInGame' }); return;
    }
    if (msg.t === 'skipTurn') { // the host's pressure valve
      if (info.playerId !== e.hostSeat) { send(ws, { t: 'rejected', commandId: -1, code: 'notHost' }); return; }
      doSkip(info.gameId, e);
      return;
    }
    if (msg.t === 'proposeSkip') {
      const target = e.game.state.activePlayer;
      e.skipVote = { target, votes: { [info.playerId]: true } }; // proposing counts as yes
      const s = skipVoteState(e, info.gameId);
      if (s.yes >= s.needed) { doSkip(info.gameId, e); return; } // 1 eligible voter total
      broadcastGame(info.gameId, Object.assign({ t: 'skipVote' }, s));
      return;
    }
    // vote
    if (!e.skipVote) { send(ws, { t: 'rejected', commandId: -1, code: 'noVoteOpen' }); return; }
    if (info.playerId === e.skipVote.target) { send(ws, { t: 'rejected', commandId: -1, code: 'targetCannotVote' }); return; }
    e.skipVote.votes[info.playerId] = msg.yes;
    const s = skipVoteState(e, info.gameId);
    if (s.yes >= s.needed) { doSkip(info.gameId, e); return; }
    broadcastGame(info.gameId, Object.assign({ t: 'skipVote' }, s));
  }
  // presence (docs/08 §4): everyone in a started game learns who is connected;
  // a joiner gets the full map so the "waiting for <name>" banner has state.
  function presenceMap(gameId) {
    const all = {};
    const e = registry.entryOf(gameId);
    if (e && e.game) {
      for (const pid of e.game.state.playerOrder) {
        if (e.game.state.players[pid].human) all[pid] = false;
      }
    }
    for (const [, i] of gameConns(gameId)) if (i.playerId && !i.spectator) all[i.playerId] = true;
    return all;
  }

  function handleJoin(ws, info, msg) {
    const target = msg.gameId || msg.joinCode;
    const gameId = target ? registry.resolveId(target) : defaultGameId;
    const e = gameId ? registry.entryOf(gameId) : null;
    if (!e) { send(ws, { t: 'rejected', commandId: -1, code: 'noSuchGame' }); return; }
    // view-only pseudo-seat (docs/08 §6): omniscient, tokenless, never votes —
    // trust-based, host-enabled at create (allowSpectators)
    if (msg.spectator === true) {
      if (e.status !== 'started') { send(ws, { t: 'rejected', commandId: -1, code: 'notStarted' }); return; }
      if (e.options.allowSpectators !== true) { send(ws, { t: 'rejected', commandId: -1, code: 'spectatorsOff' }); return; }
      info.gameId = gameId; info.playerId = 'spectator'; info.spectator = true;
      send(ws, {
        t: 'joined', playerId: 'spectator', gameId,
        view: e.game.view('spectator'), rulesOverrides: e.game.rulesOverrides, code: e.game.code(),
        civs: playerCivs(e.game) // A24: faction visuals for the omniscient view too
      });
      return;
    }
    if (e.status === 'lobby') {
      const res = registry.reserveSeat(gameId, { name: msg.name, seat: msg.seat });
      if (!res.ok) { send(ws, { t: 'rejected', commandId: -1, code: res.reason }); return; }
      info.gameId = gameId; info.seat = res.seat;
      send(ws, { t: 'joinedLobby', gameId, joinCode: e.joinCode, seat: res.seat, lobby: roster(e) });
      broadcastLobby(gameId);
    } else {
      info.gameId = gameId; // started game: phase-3 join / reconnect via route
      const out = route(e.game, msg);
      for (const m of out.reply) { send(ws, m); if (m.t === 'joined') info.playerId = m.playerId; }
      if (info.playerId) { // presence: tell the game, and hand the joiner the map
        broadcastGame(gameId, { t: 'presence', playerId: info.playerId, connected: true });
        send(ws, { t: 'presence', all: presenceMap(gameId) });
      }
    }
  }

  function handleStart(ws, info) {
    if (!info.gameId || !info.isCreator) { send(ws, { t: 'rejected', commandId: -1, code: 'notCreator' }); return; }
    const gameId = info.gameId;
    const seatConn = {}; const liveSeats = [];
    for (const [o, i] of conns) if (i.gameId === gameId && i.seat) { liveSeats.push(i.seat); seatConn[i.seat] = o; }
    const res = registry.start(gameId, liveSeats);
    if (!res.ok) { send(ws, { t: 'rejected', commandId: -1, code: res.reason }); return; }
    const entry = registry.entryOf(gameId);
    // bind live human seats IN ORDER: bindSeat's first-free then lands each
    // connection on its charted seat (lobby authored setup to match).
    for (const pid of res.humanSeats) {
      const bound = res.game.bindSeat(entry.seats[pid].name);
      const o = seatConn[pid];
      if (o && bound.playerId) {
        const ci = conns.get(o);
        ci.playerId = bound.playerId; ci.seat = pid;
        send(o, {
          t: 'joined', playerId: bound.playerId, gameId, token: bound.token,
          view: res.game.view(bound.playerId), rulesOverrides: res.game.rulesOverrides, code: res.game.code(),
          civs: playerCivs(res.game) // A24: city rosters + faction visuals
        });
      }
    }
    for (const [o, i] of conns) if (i.gameId === gameId) send(o, { t: 'started', gameId });
    broadcastGame(gameId, { t: 'presence', all: presenceMap(gameId) });
    if (autosave) res.game.saveTo(savePath(gameId));
  }

  wss.on('connection', ws => {
    conns.set(ws, {});
    ws.on('close', () => {
      const info = conns.get(ws);
      conns.delete(ws); // first, so presence/eligibility no longer count us
      if (info && info.gameId) {
        const e = registry.entryOf(info.gameId);
        if (e && e.status === 'lobby' && info.seat) {
          registry.releaseSeat(info.gameId, info.seat);
          broadcastLobby(info.gameId);
        } else if (e && e.status === 'started' && info.playerId && !info.spectator) {
          // docs/08 §4: the game learns who dropped ("waiting for <name>")
          broadcastGame(info.gameId, { t: 'presence', playerId: info.playerId, connected: false });
        }
      }
    });
    ws.on('message', raw => {
      const parsed = parseMessage(raw.toString());
      if (!parsed.ok) { send(ws, { t: 'rejected', commandId: -1, code: parsed.code }); return; }
      const msg = parsed.msg;
      const info = conns.get(ws);
      if (msg.t === 'ping') { send(ws, { t: 'pong' }); return; }
      if (msg.t === 'list') { send(ws, { t: 'games', games: registry.list() }); return; }
      if (msg.t === 'create') {
        const { entry, seat } = registry.create(msg.options || {}, msg.name);
        info.gameId = entry.gameId; info.seat = seat; info.isCreator = true;
        send(ws, { t: 'created', gameId: entry.gameId, joinCode: entry.joinCode, seat, lobby: roster(entry) });
        return;
      }
      if (msg.t === 'join') { handleJoin(ws, info, msg); return; }
      if (msg.t === 'start') { handleStart(ws, info); return; }
      if (msg.t === 'skipTurn' || msg.t === 'proposeSkip' || msg.t === 'vote') {
        handleSkipFrames(ws, info, msg); return;
      }
      // in-game: cmd / endTurn — route to the game this connection belongs to
      const gameId = info.gameId || defaultGameId;
      const e = registry.entryOf(gameId);
      if (!e || !e.game) {
        send(ws, { t: 'rejected', commandId: Number.isInteger(msg.commandId) ? msg.commandId : -1, code: 'noGame' });
        return;
      }
      const out = route(e.game, msg);
      for (const m of out.reply) send(ws, m);
      fanout(gameId, out, e.game);
    });
  });

  return new Promise(resolve => {
    // 0.0.0.0 so LAN machines can reach the game (the CLI default);
    // tests pass host '127.0.0.1' explicitly to stay loopback-only
    httpServer.listen(opts.port || 0, opts.host || '0.0.0.0', () => {
      resolve({
        port: httpServer.address().port,
        game: defaultGame,
        close: () => new Promise(done => {
          for (const ws of conns.keys()) ws.terminate();
          wss.close(() => httpServer.close(done));
        })
      });
    });
  });
}

// --- CLI ----------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = { port: 8123, seed: Date.now() % 1000000, civs: 2, humans: 1, size: 'medium' };
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--civs') opts.civs = Number(argv[++i]);
    else if (a === '--humans') opts.humans = Number(argv[++i]);
    else if (a === '--size') opts.size = argv[++i];
    else if (a === '--game') opts.game = argv[++i];
    else if (a === '--reset-seats') opts.resetSeats = true;
    else if (a === '--host') opts.host = argv[++i];
    else if (a === '--no-save') opts.autosave = false;
    else if (a === '--no-spectators') opts.spectators = false;
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  Promise.resolve().then(() => startServer(opts)).then(({ port, game }) => {
    console.log(`RetroMultiCiv server: http://localhost:${port}/client/ (default game ${game.gameId}, turn ${game.state.turn})`);
    console.log(`WebSocket: ws://localhost:${port}/ws — autosave ${opts.autosave === false ? 'OFF' : 'on'} — lobby: create/list/join-code/start`);
  }).catch(err => {
    console.error(`cannot start: ${err.message}`);
    process.exit(1);
  });
}
