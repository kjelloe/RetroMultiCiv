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
import { createRegistry, joinCode } from './lobby.js';
import { hashState } from '../shared/statehash.js';
import { createLimiter, createCommandBudget } from './limits.js';
import { planRotation } from './rotation.js';
import { buildReport, writeReport, rotateReports } from './report.js';
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
  // A38: the measured seats-per-size table gates --civs (data/rules.json)
  if (opts.civs !== undefined) {
    const table = (ruleset.rules && ruleset.rules.maxCivsBySize) || {};
    const maxCivs = table[opts.size || 'medium'] || 14;
    if (opts.civs > maxCivs) {
      throw new Error(`--civs ${opts.civs} needs a bigger map: ${opts.size || 'medium'} seats up to ${maxCivs} civilizations`);
    }
  }
  const now = opts.now || Date.now; // A50: one injectable clock (limiter + lifecycle)
  // L3b: opts.lobbyGameIdFn lets tests pin deterministic lobby ids; the
  // default mixes boot entropy (fresh join codes per restart, lobby.js)
  const registry = createRegistry({ ruleset, nowFn: now, gameIdFn: opts.lobbyGameIdFn });
  // A50 item 2: per-IP rate limits + global caps (docs/16 gap 1). Clock
  // injectable (opts.now) for tests; caps overridable via opts.limits.
  const limiter = createLimiter({ now, limits: opts.limits });
  // A50 item 3b: lifecycle expiry — an unstarted lobby with no start, and a
  // started game with no live connections, both eventually retire. Generous
  // defaults (LAN never trips them); overridable via opts.lifecycle.
  const lifecycle = Object.assign({ lobbyTtlMs: 3600000, abandonedMs: 86400000 }, opts.lifecycle || {});
  const emptySince = {}; // started gameId -> ts it went to zero connections
  // Bound rate-window memory + run lifecycle/rotation; unref'd so it never
  // holds the process (or a test) open.
  const sweepTimer = setInterval(maintenanceSweep, 60000);
  if (sweepTimer.unref) sweepTimer.unref();
  const saveFiles = {};    // gameId -> autosave path
  const autosave = opts.autosave !== false;
  const SAVES = opts.savesDir || path.join(REPO, 'saves'); // A98: overridable for tests

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
    defaultGame = createGame({ ruleset, save: parsed, allowRulesetDrift: opts.allowRulesetDrift });
    if (opts.resetSeats) {
      defaultGame.resetSeats();
      console.log('seat bindings cleared (--reset-seats) — first joiners take the seats');
    }
    saveFiles[defaultGame.gameId] = opts.saveFile || opts.game;
  } else {
    defaultGame = createGame({
      ruleset,
      // NAMESPACED default id: the lobby counter mints g1, g2 … and saves are
      // named by id, so a 'g<seed>' default could collide with a resumed
      // save's id and steal its join-by-id resolution (the A49-ext resume
      // spec caught this live). 'default-g<seed>' cannot collide.
      gameId: opts.gameId || ('default-g' + (opts.seed || 1)),
      rulesOverrides: opts.rulesOverrides,
      setup: setupFromOpts({
        seed: opts.seed || 1, civs: opts.civs || 2,
        humans: opts.humans || 1, size: opts.size || 'medium'
      })
    });
    saveFiles[defaultGame.gameId] = opts.saveFile || path.join(SAVES, defaultGame.gameId + '.json');
  }
  // the boot game allows spectators by default (a local-dev convenience; the
  // CLI host stays in control via --no-spectators — docs/08 §6). Lobby-created
  // games remain opt-in at create.
  registry.register(defaultGame, opts.spectators !== false);
  const defaultGameId = defaultGame.gameId;

  // A61 slice 1: HARDENED BY DEFAULT. The static handler used to serve the
  // WHOLE repo root behind only a traversal guard — so /saves/<id>.json (SEAT
  // TOKENS + SEAT CODES = hijack by URL), /debugging/logs/*, ops/,
  // .agent-mail/ were all fetchable on any LAN game. Default now serves ONLY
  // the four roots the client needs; --debug restores whole-repo for the
  // gallery + diagnostics (shoot.sh --server passes it for /debugging/ URLs).
  const debugMode = opts.debug === true;
  const STATIC_ROOTS = ['/client/', '/engine/', '/shared/', '/data/'];
  function servable(urlPath) {
    if (debugMode) return true; // dev: whole repo (gallery, /debugging/*)
    return STATIC_ROOTS.some(r => urlPath.startsWith(r));
  }
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
    // A51b: the cheap liveness answer the master index probes (docs/12 §6)
    if (urlPath === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (!servable(urlPath)) { res.writeHead(404); res.end(); return; } // A61: whitelist
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
    if (!saveFiles[gameId]) saveFiles[gameId] = path.join(SAVES, gameId + '.json');
    return saveFiles[gameId];
  }
  // A50 item 3 (USER rotation spec 2026-07-16): keep saves/ under a count AND
  // size budget by retiring the OLDEST completed/abandoned games first; a game
  // still LIVE in the registry (and not gameOver) is ACTIVE and never evicted —
  // a resumable save is not disk to reclaim (docs/how-to-host.md). Ours-only
  // (the retromulticiv-server-save envelope); foreign files are left alone.
  // Called at startup and on the maintenance sweep, not per-command.
  function rotateSaves() {
    if (!autosave) return;
    let names;
    try { names = fs.existsSync(SAVES) ? fs.readdirSync(SAVES) : []; } catch (e) { return; }
    const files = [];
    for (const f of names) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(SAVES, f);
      try {
        const env = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (env.format !== 'retromulticiv-server-save') continue;
        files.push({
          path: p, gameId: env.gameId, savedAt: env.savedAt, sizeBytes: fs.statSync(p).size,
          over: !!(env.state && env.state.gameOver === true) // completed → tier 1, else resumable → tier 2
        });
      } catch (e) { /* foreign/corrupt/mid-write: not ours to rotate */ }
    }
    const active = {};
    for (const g of registry.list()) {
      const e = registry.entryOf(g.gameId);
      const over = e && e.game && e.game.state && e.game.state.gameOver === true;
      if (!over) active[g.gameId] = true; // finished games are rotatable, live ones never
    }
    for (const victim of planRotation(files, active, opts.rotation)) {
      try { fs.unlinkSync(victim); } catch (e) { /* already gone */ }
    }
  }
  // A50 item 3b: registry lifecycle expiry, run on the maintenance sweep.
  function liveConnCount(gameId) {
    let n = 0;
    for (const [, i] of conns) if (i.gameId === gameId) n = n + 1;
    return n;
  }
  function closeGame(gameId, reason) {
    for (const [o, i] of conns) if (i.gameId === gameId) send(o, { t: 'gameClosed', gameId, reason });
    registry.remove(gameId); // the on-disk save survives — abandoned games stay resumable by code
    delete emptySince[gameId];
  }
  // S1 (specs/match-report-corpus.md): one report per finished game, written
  // on the sweep (lifecycle region — the cmd path is never touched). Veto by
  // any seat = never written. Failures log and mark done (no retry storms).
  function writeMatchReports() {
    if (!opts.shareReports) return;
    for (const g of registry.list()) {
      const e = registry.entryOf(g.gameId);
      if (!e || !e.game || !e.game.state || e.game.state.gameOver !== true) continue;
      if (e.reportDone === true) continue;
      e.reportDone = true;
      if (e.reportVeto === true) {
        console.log(`match report: ${g.gameId} vetoed by a seat — not written`);
        continue;
      }
      try {
        const report = buildReport(e.game, ruleset);
        if (report === null) {
          console.log(`match report: ${g.gameId} recording did not replay clean — not written`);
          continue;
        }
        const file = writeReport(opts.shareReports, report);
        console.log(`match report: ${g.gameId} -> ${file} (${report.envelope.endReason}, turn ${report.envelope.turns})`);
        rotateReports(opts.shareReports, 200);
      } catch (err) {
        console.log(`match report: ${g.gameId} write failed — ${err.message}`);
      }
    }
  }
  function maintenanceSweep() {
    limiter.sweep();
    rotateSaves();
    writeMatchReports();
    const t = now();
    for (const g of registry.list()) { // list() is a fresh snapshot — safe to remove during iteration
      if (g.gameId === defaultGameId) continue; // the LAN host's persistent game is exempt
      const e = registry.entryOf(g.gameId);
      if (!e) continue;
      if (e.status === 'lobby') {
        // an unstarted lobby that has aged past the TTL: nobody is coming
        if (e.createdAt !== undefined && t - e.createdAt > lifecycle.lobbyTtlMs) closeGame(g.gameId, 'lobbyExpired');
      } else {
        // a started game with no live connection for longer than abandonedMs
        if (liveConnCount(g.gameId) > 0) { delete emptySince[g.gameId]; continue; }
        if (emptySince[g.gameId] === undefined) emptySince[g.gameId] = t;
        else if (t - emptySince[g.gameId] > lifecycle.abandonedMs) closeGame(g.gameId, 'gameAbandoned');
      }
    }
  }
  // A34/A98: load a saves/ envelope into a live game and answer the caller.
  // Shared by resume (by filename) and resumeByCode (by the docs/07 code).
  // Seats ALWAYS reset — resumed lobby games re-pick by name (tokens are
  // per-origin/per-machine); autosaves continue into the same file.
  function resumeFromFile(ws, file) {
    if (!fs.existsSync(file)) { send(ws, { t: 'rejected', commandId: -1, code: 'noSuchSave' }); return; }
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { parsed = {}; }
    if (parsed.format !== 'retromulticiv-server-save') { send(ws, { t: 'rejected', commandId: -1, code: 'badSave' }); return; }
    if (registry.entryOf(parsed.gameId)) { // already live — point the caller at it
      send(ws, { t: 'resumed', gameId: parsed.gameId, code: parsed.code, turn: parsed.state.turn });
      return;
    }
    const game = createGame({ ruleset, save: parsed, allowRulesetDrift: opts.allowRulesetDrift });
    game.resetSeats();
    registry.register(game, false); // spectators: off for resumed games (v1)
    saveFiles[game.gameId] = file;
    send(ws, { t: 'resumed', gameId: game.gameId, code: game.code(), turn: game.state.turn });
  }
  function roster(entry) {
    return {
      // S1: consent notice — joiners see that finished games write shared
      // match reports (and can veto at their seat)
      shareReports: opts.shareReports !== undefined && entry.reportVeto !== true,
      reportVetoed: entry.reportVeto === true,
      options: entry.options,
      seats: Object.keys(entry.seats).map(pid => ({
        seat: pid, human: entry.seats[pid].human,
        mode: entry.seats[pid].human ? 'open' : 'ai', // A27: explicit slot mode
        civ: entry.seats[pid].civ, // A27: host's pick (undefined = Random)
        reserved: entry.seats[pid].reserved === true, name: entry.seats[pid].name
      }))
    };
  }
  function ipOf(ws) {
    return (ws._socket && ws._socket.remoteAddress) || '';
  }
  function broadcastLobby(gameId) {
    const e = registry.entryOf(gameId);
    if (!e) return;
    const r = roster(e);
    // A37: the HOST's copy carries each seat's remote IP (hover identity) —
    // never broadcast to other joiners or spectators
    const seatIp = {};
    for (const [o, i] of conns) if (i.gameId === gameId && i.seat) seatIp[i.seat] = ipOf(o);
    const hostR = Object.assign({}, r, {
      seats: r.seats.map(s => s.reserved ? Object.assign({}, s, { ip: seatIp[s.seat] || '' }) : s)
    });
    for (const [o, i] of conns) {
      if (i.gameId === gameId) send(o, { t: 'lobby', gameId, lobby: i.isCreator ? hostR : r });
    }
  }
  // broadcast + per-seat view fan-out to every connection in the given game
  // (spectator pseudo-seats get game.view('spectator') — omniscient, docs/08 §6).
  function fanout(gameId, out, game) {
    for (const m of out.broadcast) for (const [o, i] of conns) if (i.gameId === gameId) send(o, m);
    if (out.viewsChanged) {
      for (const [o, i] of conns) if (i.gameId === gameId && i.playerId) {
        // per-seat fog-filtered round events ride the view push (B5) —
        // spectators hit filterEvents' omniscient fallback like filterView
        send(o, { t: 'view', view: game.view(i.playerId), events: game.eventsFor(i.playerId, out.events) });
      }
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
  // A40 slice 2: while the active seat is a regent, the SERVER plays it — the
  // regent's commands log as individual cmd entries (playRegentSeat), then
  // endTurn runs the following AI chain (its own round entry), and we loop
  // if the next active seat is also a regent. Replay stays hash-exact: regent
  // turns are cmd entries (re-applied verbatim), AI chains are round entries
  // (re-derived). Guarded against re-entrancy per game.
  // YIELDS between turns (setTimeout 0) so frames flush and the event loop
  // breathes — a solo regent would otherwise run the whole game to gameOver
  // in one synchronous block, starving delivery and blocking take-back. The
  // per-game guard prevents overlapping drives (a re-entrant kick is a no-op).
  const regentDriving = {};
  async function driveRegents(gameId, e) {
    if (!e || !e.game || regentDriving[gameId]) return;
    regentDriving[gameId] = true;
    try {
      let guard = 2000;
      while (guard-- > 0) {
        const seat = e.game.state.activePlayer;
        if (e.game.state.gameOver || e.game.regentOf(seat) === undefined) break;
        const regentEvents = e.game.playRegentSeat(seat);
        const res = e.game.endTurn(seat);
        if (!res.ok) break;
        const events = regentEvents.concat(res.events || []);
        fanout(gameId, { broadcast: turnBroadcasts(e.game), viewsChanged: true, events }, e.game);
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!registry.entryOf(gameId)) break; // game gone (shutdown)
      }
    } finally {
      regentDriving[gameId] = false;
    }
  }

  function doSkip(gameId, e) {
    const seat = e.game.state.activePlayer;
    const res = e.game.endTurn(seat); // stamped with the skipped seat, logged like any command
    e.skipVote = null;
    if (!res.ok) return;
    broadcastGame(gameId, { t: 'turnSkipped', playerId: seat });
    fanout(gameId, { broadcast: turnBroadcasts(e.game), viewsChanged: true, events: res.events || [] }, e.game);
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
  // A40: which human seats are on AI regency (pid present = auto) — rides the
  // presence broadcast so every client's wait line can tag "🤖 (auto)"
  function regentMap(gameId) {
    const out = {};
    const e = registry.entryOf(gameId);
    if (e && e.game) {
      for (const pid of e.game.state.playerOrder) {
        if (e.game.regentOf(pid) !== undefined) out[pid] = true;
      }
    }
    return out;
  }

  function handleJoin(ws, info, msg) {
    // A50 item 2: per-IP join rate (covers join + joinListed + reconnect —
    // 30/min is generous for legit reconnection, murders enumeration floods).
    const jrl = limiter.allow(ipOf(ws), 'join');
    if (!jrl.ok) { send(ws, { t: 'rejected', commandId: -1, code: jrl.reason }); return; }
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
      // A50 item 1: a PRIVATE lobby is joinable only by its join CODE
      // (authorization-by-knowledge, docs/12 §3.1) — never by a raw gameId.
      // gameIds are sequential (g1,g2,…), so id-join would let an enumerator
      // reserve seats in games they were never invited to. Public lobbies
      // (find-a-game capability) and the LAN default game stay id-joinable;
      // started-game joins are token-gated by route() below, not here.
      const providedCode = msg.joinCode !== undefined ? String(msg.joinCode).toUpperCase() : '';
      const viaCode = providedCode !== '' && joinCode(gameId) === providedCode;
      if (!viaCode && e.options.public !== true && gameId !== defaultGameId) {
        send(ws, { t: 'rejected', commandId: -1, code: 'codeRequired' });
        return;
      }
      // A37 kick-and-block: a blocked IP bounces before any reservation
      if (e.blockedIps && e.blockedIps[ipOf(ws)] === true) {
        send(ws, { t: 'rejected', commandId: -1, code: 'blocked' });
        return;
      }
      const res = registry.reserveSeat(gameId, { name: msg.name, seat: msg.seat });
      if (!res.ok) { send(ws, { t: 'rejected', commandId: -1, code: res.reason }); return; }
      info.gameId = gameId; info.seat = res.seat;
      send(ws, { t: 'joinedLobby', gameId, joinCode: e.joinCode, seat: res.seat, lobby: roster(e) });
      broadcastLobby(gameId);
    } else {
      // A46 seat-code reclaim gates (the route itself is pure): 1/sec/conn
      // against brute force, and a LIVE seat rejects the code — the code is
      // recovery while disconnected, never a displacement tool
      if (msg.seatCode !== undefined) {
        const now = Date.now();
        if (info.lastReclaimAt !== undefined && now - info.lastReclaimAt < 1000) {
          send(ws, { t: 'rejected', commandId: -1, code: 'tooFast' });
          return;
        }
        info.lastReclaimAt = now;
        const pid = e.game.seatOfCode(msg.seatCode);
        if (pid) {
          for (const [, i] of conns) {
            if (i.gameId === gameId && i.playerId === pid) {
              send(ws, { t: 'rejected', commandId: -1, code: 'seatOccupied' });
              return;
            }
          }
        }
      }
      info.gameId = gameId; // started game: phase-3 join / reconnect via route
      const out = route(e.game, msg);
      for (const m of out.reply) { send(ws, m); if (m.t === 'joined') info.playerId = m.playerId; }
      if (info.playerId) { // presence: tell the game, and hand the joiner the map
        broadcastGame(gameId, { t: 'presence', playerId: info.playerId, connected: true });
        send(ws, { t: 'presence', all: presenceMap(gameId), regents: regentMap(gameId) });
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
          seatCode: bound.seatCode, // A46: private to this seat's connection
          view: res.game.view(bound.playerId), rulesOverrides: res.game.rulesOverrides, code: res.game.code(),
          civs: playerCivs(res.game) // A24: city rosters + faction visuals
        });
      } else {
        // L8 (reviewer #1328): the skip is no longer silent — the log names
        // the seat and why; a still-connected socket is told explicitly (its
        // 'started' handler shows the missed-seat screen either way)
        console.log(`start ${gameId}: seat ${pid} (${entry.seats[pid] ? entry.seats[pid].name : '?'}) not bound — ${o ? 'seat bind failed' : 'no live connection'}`);
        if (o) send(o, { t: 'rejected', commandId: -1, code: 'seatNotBound' });
      }
    }
    for (const [o, i] of conns) if (i.gameId === gameId) send(o, { t: 'started', gameId });
    broadcastGame(gameId, { t: 'presence', all: presenceMap(gameId), regents: regentMap(gameId) });
    if (autosave) res.game.saveTo(savePath(gameId));
  }

  wss.on('connection', ws => {
    // A50 item 2: admission control — global + per-IP connection caps. A
    // rejected socket is told why and closed before it can send anything.
    const ip = ipOf(ws);
    const adm = limiter.onConnect(ip);
    if (!adm.ok) { send(ws, { t: 'rejected', commandId: -1, code: adm.reason }); ws.close(); return; }
    // A50 item 0 (docs/17 lane): every admitted socket gets its own command
    // token-bucket — the per-connection fairness guard on the cmd/endTurn path.
    conns.set(ws, { budget: createCommandBudget({ now, limits: opts.limits }) });
    ws.on('close', () => {
      limiter.onDisconnect(ip);
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
      if (msg.t === 'listGames') { // A41 find-a-game: public lobbies only
        const now = Date.now(); // 1/sec/conn — the one message crawlers hammer
        if (info.lastListAt !== undefined && now - info.lastListAt < 1000) {
          send(ws, { t: 'rejected', commandId: -1, code: 'tooFast' });
          return;
        }
        info.lastListAt = now;
        const games = [];
        for (const g of registry.list()) {
          const e = registry.entryOf(g.gameId);
          if (!e || e.options.public !== true) continue; // private-by-default
          if (e.game && e.game.state && e.game.state.gameOver === true) continue; // A50 item 3: finished games unlist
          const open = Object.values(e.seats).filter(x => x.human && !x.reserved).length;
          const total = Object.values(e.seats).filter(x => x.human).length;
          if (e.status === 'lobby' && open === 0) continue; // full lobbies drop off
          if (e.status !== 'lobby' && e.options.allowSpectators !== true) continue;
          // NEVER the join code, NEVER seated players' IPs
          games.push({
            gameId: g.gameId, // capability-by-listing: public lobbies are joinable
            hostName: (e.seats[e.hostSeat] && e.seats[e.hostSeat].name) || 'host',
            openSeats: open, totalSeats: total,
            size: e.options.size, age: e.options.age,
            spectators: e.options.allowSpectators === true,
            status: e.status
          });
        }
        send(ws, { t: 'openGames', games });
        return;
      }
      if (msg.t === 'joinListed') { // A41: the SAME reservation path, gated
        const e = registry.entryOf(msg.gameId);
        if (!e || e.options.public !== true) { // private lobbies are not listed-joinable
          send(ws, { t: 'rejected', commandId: -1, code: 'notPublic' });
          return;
        }
        handleJoin(ws, info, { joinCode: msg.gameId, name: msg.name, seat: msg.seat, spectator: msg.spectator });
        return;
      }
      if (msg.t === 'listSaves') { // A34: the host machine's saves/ inventory
        // L2: the open listing leaked save codes to anyone who asked (an
        // information-leak nit + host-screen clutter) — it answers only
        // under --debug now; resume-by-CODE (knowing it = the permission)
        // is the production path
        if (!opts.debug) { send(ws, { t: 'saves', saves: [] }); return; }
        const dir = SAVES;
        const saves = [];
        for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
          if (!f.endsWith('.json')) continue;
          try {
            const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (p.format !== 'retromulticiv-server-save') continue;
            saves.push({
              file: f, gameId: p.gameId, code: p.code, savedAt: p.savedAt,
              turn: p.state.turn, year: p.state.year,
              players: p.state.playerOrder.map(pid => ({
                name: p.state.players[pid].name,
                civ: p.state.players[pid].civ,
                human: p.state.players[pid].human === true
              })),
              loaded: registry.entryOf(p.gameId) !== null // already live?
            });
          } catch (e) { /* foreign/corrupt file: not listable, not an error */ }
        }
        saves.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)); // newest first
        send(ws, { t: 'saves', saves });
        return;
      }
      if (msg.t === 'resume') { // A34: load a listed save by basename, seats reset
        resumeFromFile(ws, path.join(SAVES, path.basename(String(msg.file || ''))));
        return;
      }
      if (msg.t === 'resumeByCode') { // A98: the docs/07 game code IS the resume
        // gamecode — it identifies which saved game to resume (docs/12 §3.1).
        // Scan saves/ for the envelope whose code matches; the file never comes from the client.
        const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
        const want = norm(msg.code);
        if (want.length === 0) { send(ws, { t: 'rejected', commandId: -1, code: 'noCode' }); return; }
        const dir = SAVES;
        let best = null; // newest matching envelope wins
        for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
          if (!f.endsWith('.json')) continue;
          try {
            const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (p.format !== 'retromulticiv-server-save' || norm(p.code) !== want) continue;
            if (best === null || String(p.savedAt || '') > String(best.savedAt || '')) best = { file: f, savedAt: p.savedAt };
          } catch (e) { /* foreign/corrupt file: skip */ }
        }
        if (best === null) { send(ws, { t: 'rejected', commandId: -1, code: 'noSuchCode' }); return; }
        resumeFromFile(ws, path.join(dir, best.file));
        return;
      }
      if (msg.t === 'create') {
        // A50 item 2: per-IP create rate + global game cap before anything is
        // registered (game-spam / registry exhaustion).
        const crl = limiter.allow(ipOf(ws), 'create');
        if (!crl.ok) { send(ws, { t: 'rejected', commandId: -1, code: crl.reason }); return; }
        const gcap = limiter.canCreateGame(registry.list().length);
        if (!gcap.ok) { send(ws, { t: 'rejected', commandId: -1, code: gcap.reason }); return; }
        const res = registry.create(msg.options || {}, msg.name);
        if (res.ok === false) { // A38: civ count exceeds what the map seats
          send(ws, { t: 'rejected', commandId: -1, code: res.reason, maxCivs: res.maxCivs, size: res.size });
          return;
        }
        const { entry, seat } = res;
        info.gameId = entry.gameId; info.seat = seat; info.isCreator = true;
        send(ws, { t: 'created', gameId: entry.gameId, joinCode: entry.joinCode, seat, lobby: roster(entry) });
        return;
      }
      if (msg.t === 'join') { handleJoin(ws, info, msg); return; }
      if (msg.t === 'start') { handleStart(ws, info); return; }
      if (msg.t === 'setSlot' || msg.t === 'setSlots') { // A27: host-only lobby edits
        if (!info.gameId || !info.isCreator) {
          send(ws, { t: 'rejected', commandId: -1, code: 'notCreator' });
          return;
        }
        const r = msg.t === 'setSlot'
          ? registry.setSlot(info.gameId, msg.seat, { mode: msg.mode, civ: msg.civ })
          : registry.setSlots(info.gameId, msg.civs);
        if (!r.ok) { send(ws, { t: 'rejected', commandId: -1, code: r.reason }); return; }
        broadcastLobby(info.gameId); // joiners see the slot list update live
        return;
      }
      if (msg.t === 'reportVeto') { // S1: any SEAT may veto the match report — sticky for the game
        const e = info.gameId ? registry.entryOf(info.gameId) : null;
        if (!e || !info.seat) {
          send(ws, { t: 'rejected', commandId: -1, code: 'noSeat' });
          return;
        }
        if (opts.shareReports === undefined) return; // nothing to veto — silently fine
        if (e.reportVeto !== true) {
          e.reportVeto = true;
          console.log(`match report: ${info.gameId} veto by ${info.seat}`);
          broadcastLobby(info.gameId); // the notice flips to "not shared" for everyone
        }
        return;
      }
      if (msg.t === 'chat') { // A37: transient lobby traffic — never game state
        const e = info.gameId ? registry.entryOf(info.gameId) : null;
        if (!e || e.status !== 'lobby' || !info.seat) {
          send(ws, { t: 'rejected', commandId: -1, code: 'noLobby' });
          return;
        }
        if (e.options.chat !== true) {
          send(ws, { t: 'rejected', commandId: -1, code: 'chatOff' });
          return;
        }
        const now = Date.now(); // rate limit: 1/sec per connection
        if (info.lastChatAt !== undefined && now - info.lastChatAt < 1000) {
          send(ws, { t: 'rejected', commandId: -1, code: 'tooFast' });
          return;
        }
        // A50 item 2: per-IP chat burst cap across a minute (the 1/sec above is
        // per-connection; this bounds a many-socket chat flood from one IP).
        const chrl = limiter.allow(ipOf(ws), 'chat');
        if (!chrl.ok) { send(ws, { t: 'rejected', commandId: -1, code: chrl.reason }); return; }
        info.lastChatAt = now;
        const name = (e.seats[info.seat] && e.seats[info.seat].name) || info.seat;
        for (const [o, i] of conns) {
          if (i.gameId === info.gameId) send(o, { t: 'chat', seat: info.seat, name, text: msg.text });
        }
        return;
      }
      if (msg.t === 'setChat' || msg.t === 'kick') { // A37: host-only moderation
        if (!info.gameId || !info.isCreator) {
          send(ws, { t: 'rejected', commandId: -1, code: 'notCreator' });
          return;
        }
        if (msg.t === 'setChat') {
          const r = registry.setChat(info.gameId, msg.on);
          if (!r.ok) { send(ws, { t: 'rejected', commandId: -1, code: r.reason }); return; }
          broadcastLobby(info.gameId); // the roster options carry the flag
          return;
        }
        // kick (+block): frees the reservation; the kicked connection gets a
        // friendly {t:'kicked'} and its lobby membership is severed
        const r = registry.kick(info.gameId, msg.seat, info.seat);
        if (!r.ok) { send(ws, { t: 'rejected', commandId: -1, code: r.reason }); return; }
        for (const [o, i] of conns) {
          if (i.gameId === info.gameId && i.seat === msg.seat && o !== ws) {
            if (msg.block === true) registry.blockIp(info.gameId, ipOf(o));
            send(o, { t: 'kicked', gameId: info.gameId });
            conns.set(o, {}); // no longer in this lobby
            break;
          }
        }
        broadcastLobby(info.gameId);
        return;
      }
      if (msg.t === 'fullLog') { // A47: replay source — post-gameOver only
        const e = info.gameId ? registry.entryOf(info.gameId) : null;
        if (!e || !e.game) { send(ws, { t: 'rejected', commandId: -1, code: 'noGame' }); return; }
        if (e.game.state.gameOver !== true) { // before the end it would leak fog
          send(ws, { t: 'rejected', commandId: -1, code: 'notOver' });
          return;
        }
        const rec = e.game.fullLog();
        send(ws, { t: 'fullLog', initialState: rec.initialState, log: rec.log, finalHash: rec.finalHash });
        return;
      }
      if (msg.t === 'regent') { // A40: seat-owner-only auto-play toggle
        const e = info.gameId ? registry.entryOf(info.gameId) : null;
        if (!e || !e.game || !info.playerId || info.playerId === 'spectator') {
          send(ws, { t: 'rejected', commandId: -1, code: 'noSeat' });
          return;
        }
        e.game.setRegent(info.playerId, msg.stance);
        broadcastGame(info.gameId, { t: 'presence', all: presenceMap(info.gameId), regents: regentMap(info.gameId) });
        driveRegents(info.gameId, e); // if it's their turn now, start playing
        return;
      }
      if (msg.t === 'skipTurn' || msg.t === 'proposeSkip' || msg.t === 'vote') {
        handleSkipFrames(ws, info, msg); return;
      }
      // in-game: cmd / endTurn — route to the game this connection belongs to.
      // A50 item 0 (docs/17 lane): spend a command-budget token FIRST. Over
      // budget → cheap-reject (rateLimited) and DO NOT route, so a socket
      // flooding cheap commands cannot starve co-players' command→ack time
      // (measured 1 ms → 4.5 s). O(1) reject; the expensive game path is skipped.
      if (info.budget !== undefined && !info.budget.take().ok) {
        send(ws, { t: 'rejected', commandId: Number.isInteger(msg.commandId) ? msg.commandId : -1, code: 'rateLimited' });
        return;
      }
      const gameId = info.gameId || defaultGameId;
      const e = registry.entryOf(gameId);
      if (!e || !e.game) {
        send(ws, { t: 'rejected', commandId: Number.isInteger(msg.commandId) ? msg.commandId : -1, code: 'noGame' });
        return;
      }
      const out = route(e.game, msg);
      for (const m of out.reply) send(ws, m);
      fanout(gameId, out, e.game);
      driveRegents(gameId, e); // A40: if the turn landed on a regent, play it
    });
  });

  rotateSaves(); // A50 item 3: trim a bloated saves/ dir on boot, before serving

  // ── A51b: the OUTBOUND master-index announce loop (docs/12 §6) ─────────────
  // REGION NOTE (docs/17 boundary): everything announce-related lives HERE and
  // in the CLI flags — it never touches the connect/cmd dispatch or limits.
  // Heartbeats POST to the master every ~60s; the master's listed/reason reply
  // is surfaced on the console when it changes ("master says: …").
  let announceTimer = null;
  const announceState = { listed: null, reason: null, lastError: null };
  if (opts.announce) {
    if (!opts.publicAddr) {
      throw new Error('--announce needs --public-addr <host[:port]> — the address players reach YOU at (the master validates it)');
    }
    const [aHost, aPort] = opts.publicAddr.includes(':')
      ? [opts.publicAddr.slice(0, opts.publicAddr.lastIndexOf(':')), Number(opts.publicAddr.slice(opts.publicAddr.lastIndexOf(':') + 1))]
      : [opts.publicAddr, null];
    // the eight canonical ruleset hashes — clients see instantly whether this
    // server speaks their rules (same hashState both sides of the wire)
    const dataHashes = {};
    for (const k of Object.keys(ruleset).sort()) dataHashes[k] = hashState(ruleset[k]);
    // the A41 "public open games" summary as a COUNT — mirrors the listGames
    // filters (the dispatch handler is the robustness lane's region, so the
    // five conditions are twinned here rather than refactored across it)
    const publicOpenGames = () => {
      let n = 0;
      for (const g of registry.list()) {
        const e = registry.entryOf(g.gameId);
        if (!e || e.options.public !== true) continue;
        if (e.game && e.game.state && e.game.state.gameOver === true) continue;
        const open = Object.values(e.seats).filter(x => x.human && !x.reserved).length;
        if (e.status === 'lobby' && open === 0) continue;
        if (e.status !== 'lobby' && e.options.allowSpectators !== true) continue;
        n++;
      }
      return n;
    };
    const announce = async listenPort => {
      try {
        const res = await fetch(String(opts.announce).replace(/\/$/, '') + '/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: opts.publicName || `RetroMultiCiv @ ${opts.publicAddr}`,
            host: aHost, port: aPort !== null ? aPort : listenPort,
            protocolVersion: '1',
            dataHashes,
            openGames: publicOpenGames()
          })
        });
        const out = await res.json();
        if (out.listed !== announceState.listed || (out.reason || null) !== announceState.reason) {
          console.log(out.listed
            ? `master: listed at ${opts.announce}`
            : `master says: ${out.reason || `announce rejected (${res.status})`}`);
        }
        announceState.listed = out.listed === true;
        announceState.reason = out.reason || null;
        announceState.lastError = null;
      } catch (err) {
        if (announceState.lastError !== err.message) console.log(`master unreachable: ${err.message}`);
        announceState.lastError = err.message;
      }
    };
    announceState.start = listenPort => {
      announce(listenPort);
      announceTimer = setInterval(() => announce(listenPort), opts.announceIntervalMs || 60000);
      if (announceTimer.unref) announceTimer.unref();
    };
  }
  // ── end A51b announce region ────────────────────────────────────────────────

  return new Promise(resolve => {
    // 0.0.0.0 so LAN machines can reach the game (the CLI default);
    // tests pass host '127.0.0.1' explicitly to stay loopback-only
    httpServer.listen(opts.port || 0, opts.host || '0.0.0.0', () => {
      if (announceState.start) announceState.start(httpServer.address().port); // A51b
      resolve({
        port: httpServer.address().port,
        game: defaultGame,
        rotateSaves, // exposed so tests can trigger rotation deterministically
        maintenanceSweep, // A50 3b: tests advance opts.now then call this to exercise expiry
        announceStatus: () => ({ listed: announceState.listed, reason: announceState.reason, lastError: announceState.lastError }), // A51b: test/console visibility
        close: () => new Promise(done => {
          clearInterval(sweepTimer);
          if (announceTimer) clearInterval(announceTimer); // A51b
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
    else if (a === '--allow-ruleset-drift') opts.allowRulesetDrift = true;
    else if (a === '--host') opts.host = argv[++i];
    else if (a === '--no-save') opts.autosave = false;
    else if (a === '--no-spectators') opts.spectators = false;
    // A50 item 3 rotation caps (saves/ budget; oldest completed/abandoned first)
    else if (a === '--max-saves') (opts.rotation = opts.rotation || {}).maxSaves = Number(argv[++i]);
    else if (a === '--max-saves-mb') (opts.rotation = opts.rotation || {}).maxSavesMb = Number(argv[++i]);
    // A50 item 2 rate/cap tuning (LAN-safe defaults otherwise; docs/how-to-host.md)
    else if (a === '--max-conns') (opts.limits = opts.limits || {}).maxConns = Number(argv[++i]);
    else if (a === '--max-conns-per-ip') (opts.limits = opts.limits || {}).maxConnsPerIp = Number(argv[++i]);
    else if (a === '--max-games') (opts.limits = opts.limits || {}).maxGames = Number(argv[++i]);
    else if (a === '--creates-per-hour') (opts.limits = opts.limits || {}).createsPerHour = Number(argv[++i]);
    else if (a === '--joins-per-min') (opts.limits = opts.limits || {}).joinsPerMin = Number(argv[++i]);
    else if (a === '--chat-per-min') (opts.limits = opts.limits || {}).chatPerMin = Number(argv[++i]);
    // A50 item 0 per-connection command budget (fairness under a cmd flood)
    else if (a === '--cmd-burst') (opts.limits = opts.limits || {}).cmdBurst = Number(argv[++i]);
    else if (a === '--cmd-per-sec') (opts.limits = opts.limits || {}).cmdRefillPerSec = Number(argv[++i]);
    // A50 item 3b lifecycle expiry (unstarted lobbies + abandoned started games)
    else if (a === '--lobby-ttl-min') (opts.lifecycle = opts.lifecycle || {}).lobbyTtlMs = Number(argv[++i]) * 60000;
    else if (a === '--abandoned-hours') (opts.lifecycle = opts.lifecycle || {}).abandonedMs = Number(argv[++i]) * 3600000;
    // A51b: master-index announce (docs/12 §6) — one flag = listed; stop = gone
    else if (a === '--announce') opts.announce = argv[++i];
    else if (a === '--public-name') opts.publicName = argv[++i];
    else if (a === '--public-addr') opts.publicAddr = argv[++i];
    else if (a === '--share-reports') opts.shareReports = argv[++i]; // S1: match-report dir (OFF by default)
    else if (a === '--debug') opts.debug = true; // A61: dev conveniences (whole-repo static, verbose)
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  Promise.resolve().then(() => startServer(opts)).then(({ port, game }) => {
    console.log(`RetroMultiCiv server: http://localhost:${port}/client/ (default game ${game.gameId}, turn ${game.state.turn})`);
    console.log(`WebSocket: ws://localhost:${port}/ws — autosave ${opts.autosave === false ? 'OFF' : 'on'} — static ${opts.debug ? 'WHOLE-REPO (--debug)' : 'hardened (client/engine/shared/data)'} — lobby: create/list/join-code/start`);
  }).catch(err => {
    console.error(`cannot start: ${err.message}`);
    process.exit(1);
  });
}
