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
import { createRegistry, joinCode, yearAtTurn } from './lobby.js';
import { installCrashHandlers, startMemoryWatchdog } from './crash.js';
import v8 from 'node:v8';

// #1870 slice 2: the per-command recording sidecar (saves/<gameId>.log.jsonl)
// sits next to the .json autosave; deriving one from the other keeps them paired
// for rotation + resume.
function sidecarOf(jsonFile) { return jsonFile ? jsonFile.replace(/\.json$/, '.log.jsonl') : null; }
import { hashState } from '../shared/statehash.js';
import { createLimiter, createCommandBudget, createBudgets, clientIpFrom, originAllowed, inviteAllowed } from './limits.js';
import { planRotation } from './rotation.js';
import { score } from '../engine/score.js';
import { selectTakeoverSeat, takeoverPool, selectEviction } from './late-join.js';
import { cityEraBand, CITY_ERA_BANDS } from '../shared/city-era.js';
import { buildReport, writeReport, rotateReports } from './report.js';
import { writeBugReport, rotateBugReports } from './bug-report.js';
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
const SIZE_ORDER = ['xsmall', 'small', 'medium', 'large', 'xlarge', 'huge']; // #1875 --max-size clamp
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
  const setup = { seed: opts.seed, options: { width: dims[0], height: dims[1], players } };
  if (opts.debug === true) setup.debug = true; // A92: --debug games allow debug commands
  return setup;
}

// opts: { port?, game?, saveFile?, autosave?, resetSeats? } plus fresh-game
// fields (seed/civs/humans/size). Returns { port, game, close } — `game` is the
// DEFAULT game (phase-3 compat) used by the integration test and the CLI.
export function startServer(opts) {
  const ruleset = opts.ruleset || loadRuleset();
  // #1875 operator resource caps also bound the HOST's own default game (the
  // --civs/--size/--game-less boot), for consistency with client-created games:
  // clamp the map size DOWN to --max-size, the civ count DOWN to --max-civs, and
  // fold --max-turns into the default game's endYear override.
  if (opts.maxSize && SIZES[opts.maxSize] && opts.size && SIZES[opts.size]
    && SIZE_ORDER.indexOf(opts.size) > SIZE_ORDER.indexOf(opts.maxSize)) {
    opts.size = opts.maxSize;
  }
  if (opts.maxCivs > 0 && opts.civs !== undefined) opts.civs = Math.min(opts.civs, Math.floor(opts.maxCivs));
  if (opts.maxTurns > 0) {
    const base = (opts.rulesOverrides && opts.rulesOverrides.endYear !== undefined)
      ? opts.rulesOverrides.endYear : ruleset.rules.endYear;
    const cap = yearAtTurn(ruleset.rules, Math.floor(opts.maxTurns));
    if (cap < base) opts.rulesOverrides = Object.assign({}, opts.rulesOverrides, { endYear: cap });
  }
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
  const autoTakeoverDefault = opts.autoTakeover !== false; // XIV §30: default ON
  const registry = createRegistry({ ruleset, nowFn: now, gameIdFn: opts.lobbyGameIdFn,
    debug: opts.debug === true, // A92: lobby games on a --debug host allow debug commands
    autoTakeoverDefault, // XIV §30: the per-game host option defaults to this
    maxTurns: opts.maxTurns, maxCivs: opts.maxCivs, maxSize: opts.maxSize }); // #1875 operator caps
  // A50 item 2: per-IP rate limits + global caps (docs/16 gap 1). Clock
  // injectable (opts.now) for tests; caps overridable via opts.limits.
  const limiter = createLimiter({ now, limits: opts.limits });
  // docs/17 layered budget (primary layer over the per-connection
  // createCommandBudget backstop): per-SEAT command buckets + a per-connection
  // all-message cap. Clock-injectable; swept + cleaned up alongside the limiter.
  const budgets = createBudgets({ now, limits: opts.limits });
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
    const defSaveFile = opts.saveFile || opts.game;
    defaultGame = createGame({ ruleset, save: parsed, allowRulesetDrift: opts.allowRulesetDrift,
      sidecarFile: autosave ? sidecarOf(defSaveFile) : null });
    if (opts.resetSeats) {
      defaultGame.resetSeats();
      console.log('seat bindings cleared (--reset-seats) — first joiners take the seats');
    }
    saveFiles[defaultGame.gameId] = defSaveFile;
  } else {
    // NAMESPACED default id: the lobby counter mints g1, g2 … and saves are
    // named by id, so a 'g<seed>' default could collide with a resumed
    // save's id and steal its join-by-id resolution (the A49-ext resume
    // spec caught this live). 'default-g<seed>' cannot collide.
    const defGameId = opts.gameId || ('default-g' + (opts.seed || 1));
    const defSaveFile = opts.saveFile || path.join(SAVES, defGameId + '.json');
    defaultGame = createGame({
      ruleset,
      gameId: defGameId,
      rulesOverrides: opts.rulesOverrides,
      sidecarFile: autosave ? sidecarOf(defSaveFile) : null,
      setup: setupFromOpts({
        seed: opts.seed || 1, civs: opts.civs || 2,
        humans: opts.humans || 1, size: opts.size || 'medium',
        debug: opts.debug // A92
      })
    });
    saveFiles[defaultGame.gameId] = defSaveFile;
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

  // Bug-report POST budget — a SELF-CONTAINED per-IP hourly bucket (NOT the
  // hardening lane's limits.js): a playtester files a handful of reports an
  // hour at most, so this is a coarse abuse floor, not a fairness system.
  const BUG_REPORT_PER_HOUR = Number.isInteger(opts.bugReportsPerHour) ? opts.bugReportsPerHour : 20;
  const BUG_REPORT_MAX_BYTES = 2 * 1024 * 1024; // recordings are small; cap hard
  const bugReportHits = {}; // ip -> [ms timestamps within the last hour]
  function bugReportAllowed(ip) {
    const t = Date.now();
    const cut = t - 3600 * 1000;
    if (Object.keys(bugReportHits).length > 5000) { for (const k of Object.keys(bugReportHits)) delete bugReportHits[k]; } // distinct-IP flood guard
    const arr = (bugReportHits[ip] || []).filter(x => x > cut);
    bugReportHits[ip] = arr;
    if (arr.length >= BUG_REPORT_PER_HOUR) return false;
    arr.push(t);
    return true;
  }

  const httpServer = http.createServer((req, res) => {
    // Slice 3b: cap absurd URL lengths cheaply, before URL parsing (Node already
    // caps total header bytes; this is an explicit, earlier guard).
    if (req.url && req.url.length > 2048) { res.writeHead(414); res.end(); return; }
    // Slice 3b: cap absurd URL lengths cheaply, before URL parsing (Node already
    // caps total header bytes; this is an explicit, earlier guard).
    if (req.url && req.url.length > 2048) { res.writeHead(414); res.end(); return; }
    const parsed = new URL(req.url, 'http://x');
    const urlPath = decodeURIComponent(parsed.pathname);
    // A22 + XIV §16ext, REVERSED by user ruling 2026-07-22: friendly entry
    // points — the bare host `/` and `/client` land on the LOCAL setup screen
    // (302 → /client/), so a new player's default game runs in their browser
    // and costs the server nothing (a server game holds engine state + ws +
    // saves per seat; the local engine is a static-file serve). The server is
    // used only when NEEDED: the setup screen's Host/Join LAN and Find-game
    // buttons (?server=1 direct joins keep working). The §16
    // lost-game-with-tab lesson is answered by the localStorage autosave +
    // resume card (saves.js/setup.js), not by defaulting into server games.
    // A query string is always preserved (join links carry params).
    if (urlPath === '/' || urlPath === '/client') {
      const dest = parsed.search === '' ? '/client/' : '/client/' + parsed.search;
      res.writeHead(302, { Location: dest, 'X-Content-Type-Options': 'nosniff' });
      res.end();
      return;
    }
    // A51b + A50 item 5: the master index probes this; make it a first-class ops
    // endpoint — liveness AND the operational snapshot (games/conns/memory) a
    // monitor or `curl` reads over the wire. No auth needed (no secrets: counts
    // and process stats only), no fog concern (no game state).
    if (urlPath === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(healthSnapshot()));
      return;
    }
    // master-proxy (reviewer #2446): a self-hosted box that ANNOUNCES to a master
    // has no same-origin server list — /master/servers only exists on the hosted
    // deployment's reverse proxy. Proxy it here so Find-game works self-hosted,
    // zero client change, no CORS. SSRF-safe: the target is ONLY the operator-
    // configured master (--announce), never a caller-supplied URL.
    if (req.method === 'GET' && urlPath === '/master/servers') {
      const J = { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
      if (!opts.announce) { res.writeHead(404, J); res.end('{"ok":false,"reason":"masterNotConfigured"}'); return; }
      const target = String(opts.announce).replace(/\/$/, '') + '/servers';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000); // don't hang on a dead master
      fetch(target, { signal: controller.signal }).then(async r => {
        clearTimeout(timer);
        const body = await r.text();
        if (r.ok) { res.writeHead(200, J); res.end(body); } // pass the master's JSON through
        else { res.writeHead(502, J); res.end(JSON.stringify({ ok: false, reason: 'masterError', status: r.status })); }
      }).catch(() => {
        clearTimeout(timer);
        try { res.writeHead(502, J); res.end('{"ok":false,"reason":"masterUnreachable"}'); } catch (_) { /* socket gone */ }
      });
      return;
    }
    // In-client BUG REPORT sink (helper queue #3). WRITE-ONLY: a playtester
    // POSTs the Shift+D recording + free text; we write ONE json file the
    // operator reads over ssh. Opt-in (--bug-reports DIR, off by default — same
    // posture as --share-reports); the dir is NEVER served back. Body capped;
    // per-IP hourly budget. The client falls back to a local download on any
    // non-2xx, so a 404 (disabled) / 413 / 429 all degrade gracefully.
    if (req.method === 'POST' && urlPath === '/bug-report') {
      const J = { 'Content-Type': 'application/json' };
      if (!opts.bugReports) { res.writeHead(404, J); res.end('{"ok":false,"reason":"disabled"}'); return; }
      if (!bugReportAllowed(clientIp(req))) { res.writeHead(429, J); res.end('{"ok":false,"reason":"rateLimited"}'); return; }
      let body = '';
      let total = 0;
      let dropped = false;
      req.on('data', chunk => {
        total += chunk.length;
        if (total > 8 * BUG_REPORT_MAX_BYTES) { req.destroy(); return; } // hard abort on a flood
        if (dropped) return;
        body += chunk;
        if (body.length > BUG_REPORT_MAX_BYTES) { dropped = true; body = ''; } // discard, 413 at end
      });
      req.on('error', () => { try { res.writeHead(400, J); res.end('{"ok":false,"reason":"badRequest"}'); } catch (_) { /* socket gone */ } });
      req.on('end', () => {
        if (dropped) { res.writeHead(413, J); res.end('{"ok":false,"reason":"tooLarge"}'); return; }
        let payload;
        try { payload = JSON.parse(body); } catch (e) { res.writeHead(400, J); res.end('{"ok":false,"reason":"badJson"}'); return; }
        try {
          writeBugReport(opts.bugReports, payload);
          rotateBugReports(opts.bugReports, 100); // keep the newest 100
          res.writeHead(200, J); res.end('{"ok":true}');
        } catch (e) { res.writeHead(500, J); res.end('{"ok":false,"reason":"writeFailed"}'); }
      });
      return;
    }
    // XV §13: on-demand server-save download for ?server=1 Shift+S/Shift+D. The
    // client fetches /saves/<gameId>.json; the autosave FILE may not exist yet
    // (before the first command, or --no-save) and saves/ is off the static
    // whitelist (A61), so snapshot the LIVE game's authoritative state here —
    // write-then-serve, always current, TOKEN-SAFE (toDownload strips seat
    // tokens/codes). Unknown/finished ids fall through to the static handler
    // (the on-disk file under --debug, else 404).
    if (req.method === 'GET' && urlPath.startsWith('/saves/') && urlPath.endsWith('.json') && urlPath.indexOf('..') === -1) {
      const gid = urlPath.slice('/saves/'.length, -('.json'.length));
      const e = gid ? registry.entryOf(gid) : null;
      if (e && e.game) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(e.game.toDownload()));
        return;
      }
    }
    if (!servable(urlPath)) { res.writeHead(404); res.end(); return; } // A61: whitelist
    let file = path.normalize(path.join(REPO, urlPath));
    if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(file);
      // Slice 3b: nosniff on every asset; the HTML entrypoint revalidates so a
      // deploy propagates (no stale client), other assets cache briefly (longer
      // would need content-hashed filenames, none today). X-Frame-Options DENY
      // (v2 nicety) — the game page is standalone, never legitimately framed, so
      // deny framing outright to close clickjacking.
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=600'
      });
      res.end(buf);
    });
  });
  // Slice 3c: bound slow-header (slowloris) HTTP — Node's defaults are lax.
  httpServer.headersTimeout = 15000;
  httpServer.requestTimeout = 30000;

  // maxPayload rejects an oversized frame at the ws protocol layer before the
  // whole payload is buffered — matches protocol.js MAX_FRAME (64 KB).
  // Slice 3a: proxy-aware client IP (--trust-proxy[-hops N]; XFF trusted only
  // from a private/loopback peer). Behind nginx every peer is 127.0.0.1, so
  // without this the per-IP limits collapse to one bucket for all clients.
  const trustProxyHops = Number(opts.trustProxyHops) || 0;
  const clientIp = req => clientIpFrom(req, trustProxyHops);
  // Slice 3b: optional WS Origin allow-list (empty = permissive LAN default; set
  // for a public browser deploy to blunt cross-origin socket abuse — WebSockets
  // are CORS-exempt). Browser-abuse mitigation, not auth.
  const originAllowlist = (opts.originAllowlist || []).filter(Boolean);
  const inviteCodes = (opts.inviteCodes || []).filter(Boolean); // A50 item 6
  // Handshake gate — rejects BEFORE the socket is allocated: bad Origin first
  // (cheap compare, no connect token spent), then the closed-group invite gate
  // (A50 item 6), then the per-IP connect-rate (3a).
  const wss = new WebSocketServer({
    server: httpServer, path: '/ws', maxPayload: 64 * 1024,
    // Self-audit (#2143): connect-rate BEFORE the invite check so wrong-invite
    // attempts spend the per-IP connect budget — bounds invite-code brute force
    // (codes are low-entropy operator strings). Origin stays first (cheapest,
    // spends nothing). Per-IP, so legit users on other IPs are unaffected.
    verifyClient: info => originAllowed(info.origin, originAllowlist)
      && limiter.allowConnect(clientIp(info.req)).ok
      && inviteAllowed(info.req && info.req.url, inviteCodes)
  });
  const conns = new Map(); // ws -> { budget, cid, gameId?, seat?, playerId?, isCreator? }

  // A50 item 5: structured one-line JSON ops logs, opt-in via --log-json (default
  // keeps the human-readable console output). One event per line so `journalctl`
  // / a log shipper can parse the lifecycle without regexing prose. Neutral,
  // low-cardinality fields only — never game state, never tokens/IPs-as-secrets.
  function olog(ev, fields) {
    if (!opts.logJson) return;
    try { console.log(JSON.stringify(Object.assign({ ts: new Date().toISOString(), ev }, fields))); } catch (e) { /* never let logging throw */ }
  }
  // A50 item 5: the /healthz body — liveness + the operational snapshot an ops
  // probe wants. Counts + process stats only (no secrets, no game state).
  function healthSnapshot() {
    const mem = process.memoryUsage();
    let heapPct = 0;
    try { const lim = v8.getHeapStatistics().heap_size_limit || 0; if (lim) heapPct = Math.round((mem.heapUsed / lim) * 100); } catch (e) { /* v8 stat unavailable */ }
    // Self-audit (#2143): NO version/pid here — the master + monitors only need
    // liveness + benign operational counts; leaking node version to anonymous
    // clients is a fingerprinting / known-CVE targeting aid.
    return {
      ok: true,
      uptime_s: Math.round(process.uptime()),
      games: registry.list().length,
      conns: conns.size,
      rss_mb: Math.round(mem.rss / (1024 * 1024)),
      heap_pct: heapPct
    };
  }
  let connSeq = 0;         // stable per-connection id for the all-message bucket
  // Part B (mobile seat-grace): a dropped lobby seat is held 'disconnected,
  // reclaimable' for seatGraceMs instead of freed instantly; graceTimers keys
  // "gameId|seat" -> the release timer (cancelled on reclaim). golden-neutral.
  const seatGraceMs = opts.seatGraceMs !== undefined ? opts.seatGraceMs : 45000;
  const graceTimers = {};
  // Part A (specs/mobile-resilience.md): heartbeat sweeper. A locked/backgrounded
  // phone leaves the socket HALF-OPEN (readyState OPEN, no close event), so it is
  // seatless at game start. Ping every heartbeatMs; a socket that misses
  // heartbeatMisses pongs is terminate()d → the close handler fires
  // DETERMINISTICALLY (the only way a half-open socket becomes detectable — and
  // the trigger for Part B's seat-grace). heartbeatTick() is exposed for tests.
  const heartbeatMs = opts.heartbeatMs !== undefined ? opts.heartbeatMs : 15000;
  const heartbeatMisses = opts.heartbeatMisses !== undefined ? opts.heartbeatMisses : 2;
  // #1732 busy-tolerant heartbeat: the engine turn is SYNCHRONOUS, so at extreme
  // scale (turn-2623: the AI chain inside one endTurn) it blocks the event loop
  // for longer than the whole miss window. While blocked the sweeper can't fire
  // AND queued pong frames can't be processed — so the one catch-up tick would
  // otherwise reap HEALTHY clients whose pongs are sitting unprocessed in the
  // queue. Detect the block via wall-clock lag (this tick fired >1.5 intervals
  // late) and take a GRACE round: reset miss counters, ping fresh, terminate
  // nobody — the queued pongs land before the next tick. nowMs is injectable
  // for tests; setInterval calls with no arg (real clock).
  let lastHeartbeatAt = null;
  function heartbeatTick(nowMs) {
    const t = nowMs !== undefined ? nowMs : Date.now();
    const blocked = lastHeartbeatAt !== null && (t - lastHeartbeatAt) > heartbeatMs * 1.5;
    lastHeartbeatAt = t;
    if (blocked) {
      for (const ws of wss.clients) { ws.missedPongs = 0; try { ws.ping(); } catch (e) { /* dying */ } }
      return; // one grace round after a loop-block; do not count misses / reap
    }
    for (const ws of wss.clients) {
      if (ws.missedPongs >= heartbeatMisses) { ws.terminate(); continue; }
      ws.missedPongs = (ws.missedPongs || 0) + 1;
      try { ws.ping(); } catch (e) { /* socket already dying */ }
    }
  }
  const heartbeatTimer = setInterval(heartbeatTick, heartbeatMs);
  if (heartbeatTimer.unref) heartbeatTimer.unref();

  // Slice 3c: outbound backpressure. A client that stays connected but stops
  // reading would grow an unbounded ws send queue (the server broadcasts to
  // every seat each turn). Over the cap it is a stuck/slow consumer — terminate
  // it. Cap sits above the largest single legit message (a full view on the
  // biggest map), so a healthy client is never dropped. --max-outbuf-mb.
  const maxOutBuffer = opts.maxOutBufferBytes !== undefined ? opts.maxOutBufferBytes : 4 * 1024 * 1024;
  // Slice 3c: close a socket that connects and sends NOTHING within this window
  // (the connect-flood residue). Any message spares it (--unauth-timeout-sec).
  const unauthTimeoutMs = opts.unauthTimeoutMs !== undefined ? opts.unauthTimeoutMs : 30000;
  function send(ws, msg) {
    if (ws.readyState !== ws.OPEN) return;
    if (ws.bufferedAmount > maxOutBuffer) { ws.terminate(); return; }
    ws.send(JSON.stringify(msg));
  }
  function savePath(gameId) {
    if (!saveFiles[gameId]) saveFiles[gameId] = path.join(SAVES, gameId + '.json');
    return saveFiles[gameId];
  }
  // Crash resilience (server/crash.js): best-effort per-game context for a
  // crashdump — the biggest-state signal for scale crashes (turn-2623).
  function gameProbe() {
    return registry.list().map(g => {
      const e = registry.entryOf(g.gameId);
      const st = e && e.game ? e.game.state : null;
      return {
        gameId: g.gameId, turn: g.turn,
        units: st && st.units ? Object.keys(st.units).length : 0,
        cities: st && st.cities ? Object.keys(st.cities).length : 0
      };
    });
  }
  // late-join §2/§7: the game's era band = the MOST-ADVANCED alive civ's
  // city-era band (shared/city-era.js, pure). rank = its ordinal in
  // CITY_ERA_BANDS (ancient=0 … modernSpace=3) — §7 eviction sorts by it.
  function gameEraBand(state) {
    let rank = 0;
    for (const pid of state.playerOrder) {
      const p = state.players[pid];
      if (!p || p.alive === false) continue;
      const r = CITY_ERA_BANDS.indexOf(cityEraBand(p, ruleset.techs));
      if (r > rank) rank = r;
    }
    return { band: CITY_ERA_BANDS[rank] || CITY_ERA_BANDS[0], rank };
  }
  // late-join §2: a STARTED game is late-join listable/joinable when it is public
  // AND lateJoining AND has ≥1 eligible (alive, AI, never-human) civ to take over.
  function lateJoinable(e) {
    return e.status !== 'lobby'
      && e.options.public === true && e.options.lateJoining === true
      && e.game && e.game.state && e.game.state.gameOver !== true
      && takeoverPool(e.game.state).length > 0;
  }
  // late-join §6-7: at the game cap, evict ONE paused game to make room. Rank
  // (selectEviction): earliest era → fewer original humans → longest-paused.
  // Never touches an ACTIVE game. Evicted = final autosave (the save SURVIVES, so
  // the code revives it via the on-demand reload) + unlist + drop from the live
  // registry. Returns true if a game was evicted, false if none is paused.
  function evictOnePaused() {
    const paused = [];
    for (const g of registry.list()) {
      const e = registry.entryOf(g.gameId);
      if (!e || e.status === 'lobby' || e.paused !== true || !e.game) continue;
      paused.push({
        gameId: g.gameId,
        eraRank: gameEraBand(e.game.state).rank,
        originalHumans: Object.values(e.seats).filter(x => x.human).length,
        pausedAt: e.pausedAt || 0
      });
    }
    const victim = selectEviction(paused);
    if (!victim) return false;
    if (autosave) { const ve = registry.entryOf(victim); if (ve && ve.game) ve.game.saveTo(savePath(victim)); }
    closeGame(victim, 'evicted'); // unlist + drop; the on-disk save stays rejoinable by code
    return true;
  }
  // Final best-effort save-all before an OOM graceful-exit; games are already
  // durable via per-command autosave, so this only narrows the in-flight window.
  function autosaveAll() {
    if (!autosave) return;
    for (const g of registry.list()) {
      const e = registry.entryOf(g.gameId);
      if (e && e.game) e.game.saveTo(savePath(g.gameId));
    }
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
      // #1870: sweep the per-command sidecar alongside its save so retired games
      // don't orphan .log.jsonl files (the exact disk growth rotation prevents)
      try { fs.unlinkSync(sidecarOf(victim)); } catch (e) { /* no sidecar / already gone */ }
    }
  }
  // A50 item 3b: registry lifecycle expiry, run on the maintenance sweep.
  function liveConnCount(gameId) {
    let n = 0;
    for (const [, i] of conns) if (i.gameId === gameId) n = n + 1;
    return n;
  }
  // late-join §5: connected SEATED humans (not spectators) — the count that
  // decides pause-on-empty.
  function humanConnCount(gameId) {
    let n = 0;
    for (const [, i] of conns) if (i.gameId === gameId && i.playerId && i.playerId !== 'spectator') n = n + 1;
    return n;
  }
  function closeGame(gameId, reason) {
    for (const [o, i] of conns) if (i.gameId === gameId) send(o, { t: 'gameClosed', gameId, reason });
    registry.remove(gameId); // the on-disk save survives — abandoned games stay resumable by code
    budgets.dropGame(gameId); // release this game's per-seat command buckets
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
  // H-1 (d): ONE cached saves/ scan (2s TTL) — resumeByCode and the debug
  // inventory otherwise re-parse every envelope PER REQUEST, an unthrottled
  // disk amplification on a public host. TTL beats invalidation here: saves
  // change on autosave anyway, and a 2s-stale resume answer is harmless.
  let savesScanCache = { at: 0, rows: null };
  function scanSaves() {
    const t = now();
    if (savesScanCache.rows !== null && t - savesScanCache.at < 2000) return savesScanCache.rows;
    const rows = [];
    for (const f of (fs.existsSync(SAVES) ? fs.readdirSync(SAVES) : [])) {
      if (!f.endsWith('.json')) continue;
      try {
        const p = JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8'));
        if (p.format !== 'retromulticiv-server-save') continue;
        rows.push({ file: f, envelope: p });
      } catch (e) { /* foreign/corrupt file: not listable, not an error */ }
    }
    savesScanCache = { at: t, rows };
    return rows;
  }
  function maintenanceSweep() {
    limiter.sweep();
    budgets.sweep();
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
    // H-1 (c): a corrupt-but-right-format save must reject, never crash the
    // path (createGame throws on ruleset drift and bad shapes)
    let game;
    try {
      game = createGame({ ruleset, save: parsed, allowRulesetDrift: opts.allowRulesetDrift,
        sidecarFile: autosave ? sidecarOf(file) : null });
      game.resetSeats();
    } catch (err) {
      console.log(`resume rejected: ${path.basename(file)} — ${err.message}`);
      send(ws, { t: 'rejected', commandId: -1, code: 'badSave' });
      return;
    }
    // §6 revival-at-cap: reviving a code when the server is full may itself evict
    // ONE paused game; if none is paused, serverFull (never evict an active game).
    if (!limiter.canCreateGame(registry.list().length).ok && !evictOnePaused()) {
      send(ws, { t: 'rejected', commandId: -1, code: 'serverFull' }); return;
    }
    registry.register(game, false); // spectators: off for resumed games (v1)
    saveFiles[game.gameId] = file;
    send(ws, { t: 'resumed', gameId: game.gameId, code: game.code(), turn: game.state.turn });
  }
  // rejoin-nosuchgame: load a save envelope into the live registry for an
  // on-demand JOIN reload (server restarted; the save is on disk, the game is
  // not live and not ended). Returns the registered game, or null on a corrupt/
  // incompatible save. No ws reply — the caller continues the join flow. Mirrors
  // resumeFromFile's load (seats reset; autosave continues into the same file).
  function reloadSaveEntry(file) {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
    if (parsed.format !== 'retromulticiv-server-save') return null;
    const existing = registry.entryOf(parsed.gameId);
    if (existing) return existing.game;
    let game;
    try {
      game = createGame({ ruleset, save: parsed, allowRulesetDrift: opts.allowRulesetDrift,
        sidecarFile: autosave ? sidecarOf(file) : null });
      game.resetSeats();
    } catch (err) { console.log(`join reload rejected: ${path.basename(file)} — ${err.message}`); return null; }
    // §6 revival-at-cap: make room by evicting a paused game, else refuse (null).
    if (!limiter.canCreateGame(registry.list().length).ok && !evictOnePaused()) return null;
    registry.register(game, false);
    saveFiles[game.gameId] = file;
    return game;
  }
  // rejoin-nosuchgame: find the newest save whose gameId OR docs/07 code matches
  // a rejoin target (the playtest rejoined by code). Returns {file, envelope} or null.
  function findSaveForTarget(target) {
    const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
    const want = norm(target);
    if (want.length === 0) return null;
    let best = null;
    for (const row of scanSaves()) {
      const p = row.envelope;
      if (norm(p.gameId) !== want && norm(p.code) !== want) continue;
      if (best === null || String(p.savedAt || '') > String(best.envelope.savedAt || '')) best = row;
    }
    return best;
  }
  function roster(entry) {
    return {
      // S1: consent notice — joiners see that finished games write shared
      // match reports (and can veto at their seat)
      shareReports: opts.shareReports !== undefined && entry.reportVeto !== true,
      reportVetoed: entry.reportVeto === true,
      joiningOpen: entry.options.joiningOpen !== false, // XVII §3: client renders the host toggle + reject copy
      options: entry.options,
      seats: Object.keys(entry.seats).map(pid => ({
        seat: pid, human: entry.seats[pid].human,
        mode: entry.seats[pid].human ? 'open' : 'ai', // A27: explicit slot mode
        civ: entry.seats[pid].civ, // A27: host's pick (undefined = Random)
        reserved: entry.seats[pid].reserved === true, name: entry.seats[pid].name,
        disconnected: entry.seats[pid].disconnected === true // Part B: grace-held (reclaimable)
      }))
    };
  }
  function broadcastLobby(gameId) {
    const e = registry.entryOf(gameId);
    if (!e) return;
    const r = roster(e);
    // A37: the HOST's copy carries each seat's remote IP (hover identity) —
    // never broadcast to other joiners or spectators
    const seatIp = {};
    for (const [o, i] of conns) if (i.gameId === gameId && i.seat) seatIp[i.seat] = i.ip || '';
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
      // gameover-reveal (XVII ruling #2496): at gameOver the fog rules lapse —
      // Civ1 shows the whole world once no competitive info remains. Compute the
      // unfiltered map ONCE and ride it on this fan-out (the gameOver broadcast).
      // Additive field; old clients ignore it (helper's Founder's Record S2
      // upgrades to true full-globe, fog-honest brighten stays the fallback).
      const reveal = game.state.gameOver === true ? game.view('spectator').map : undefined;
      for (const [o, i] of conns) if (i.gameId === gameId && i.playerId) {
        // per-seat fog-filtered round events ride the view push (B5) —
        // spectators hit filterEvents' omniscient fallback like filterView
        const m = { t: 'view', view: game.view(i.playerId), events: game.eventsFor(i.playerId, out.events) };
        if (reveal !== undefined) m.reveal = reveal;
        send(o, m);
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
  // XIV §3: pace live regent turns so a watching player can follow. The round
  // budget (--regency-min-turn-ms, default 1000) is divided across the seats
  // armed for regency THIS round; render-side only (a setTimeout between turns
  // — never engine state, so replay/goldens are untouched). 0 = instant.
  const regencyMinTurnMs = Number.isFinite(opts.regencyMinTurnMs) ? Math.max(0, opts.regencyMinTurnMs) : 1000;
  function regentPaceMs(game) {
    if (regencyMinTurnMs <= 0) return 0;
    let n = 0;
    for (const pid of game.state.playerOrder) if (game.regentOf(pid) !== undefined) n++;
    return n > 0 ? Math.round(regencyMinTurnMs / n) : 0;
  }
  const regentDriving = {};
  async function driveRegents(gameId, e) {
    if (!e || !e.game || regentDriving[gameId]) return;
    if (e.paused) return; // §5 pause-on-empty: no AI/regency turns while zero humans connected
    regentDriving[gameId] = true;
    try {
      let guard = 2000;
      while (guard-- > 0) {
        const seat = e.game.state.activePlayer;
        if (e.game.state.gameOver || e.game.regentOf(seat) === undefined) break; // XIV §2: never advance a finished game
        const regentEvents = e.game.playRegentSeat(seat);
        const res = e.game.endTurn(seat);
        if (!res.ok) break;
        const events = regentEvents.concat(res.events || []);
        fanout(gameId, { broadcast: turnBroadcasts(e.game), viewsChanged: true, events }, e.game);
        // the pace timer is unref'd: it must never keep the process alive on its
        // own (e.g. an all-regent game orphaned after server close). A live
        // server stays up on its other handles; the loop still checks entryOf.
        await new Promise(resolve => { const t = setTimeout(resolve, regentPaceMs(e.game)); if (t.unref) t.unref(); });
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
  // XIV §30: Auto AI takeover. A started-game seat that stays disconnected for
  // the seat-grace window is handed to the AI (regency, option ON) or has its
  // turn auto-skipped (option OFF), so a dropped player never stalls the game.
  // Reuses seatGraceMs (no third clock). This is TURN POLICY — it only calls the
  // game's own setRegent/endTurn (via driveRegents/doSkip); it never touches the
  // connect/cmd dispatch (docs/17 boundary).
  const takeoverTimers = {}; // "gameId|pid" -> timer
  const takeoverSeats = {};  // "gameId|pid" -> true while the AI holds it via §30
  function takeoverOn(e) {
    return e.options && e.options.autoTakeover !== undefined
      ? e.options.autoTakeover !== false : autoTakeoverDefault;
  }
  function scheduleTakeover(gameId, pid) {
    const key = gameId + '|' + pid;
    if (takeoverTimers[key]) clearTimeout(takeoverTimers[key]);
    takeoverTimers[key] = setTimeout(() => {
      delete takeoverTimers[key];
      const e = registry.entryOf(gameId);
      if (!e || !e.game || e.status !== 'started' || e.game.state.gameOver) return;
      if (presenceMap(gameId)[pid] === true) return; // reconnected within the window
      if (takeoverOn(e)) {
        e.game.setRegent(pid, 'balanced'); // the AI drives the seat
        takeoverSeats[key] = true;
        broadcastGame(gameId, { t: 'presence', all: presenceMap(gameId), regents: regentMap(gameId) });
        driveRegents(gameId, e); // play it now if it's their turn
      } else if (e.game.state.activePlayer === pid) {
        doSkip(gameId, e); // OFF: skip the stalled seat's turn so the round advances
      }
    }, seatGraceMs);
    if (takeoverTimers[key].unref) takeoverTimers[key].unref();
  }
  function cancelTakeover(gameId, pid) {
    const key = gameId + '|' + pid;
    if (takeoverTimers[key]) { clearTimeout(takeoverTimers[key]); delete takeoverTimers[key]; }
    // the AI grabbed it via §30 → hand the seat back when the player returns
    if (takeoverSeats[key]) {
      delete takeoverSeats[key];
      const e = registry.entryOf(gameId);
      if (e && e.game && e.game.regentOf && e.game.regentOf(pid) !== undefined) {
        e.game.setRegent(pid, null);
        broadcastGame(gameId, { t: 'presence', all: presenceMap(gameId), regents: regentMap(gameId) });
      }
    }
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
    const jrl = limiter.allow(info.ip, 'join');
    if (!jrl.ok) { send(ws, { t: 'rejected', commandId: -1, code: jrl.reason }); return; }
    const target = msg.gameId || msg.joinCode;
    let gameId = target ? registry.resolveId(target) : defaultGameId;
    let e = gameId ? registry.entryOf(gameId) : null;
    // rejoin-nosuchgame: a game that is NOT live gets a distinct answer instead of
    // the generic noSuchGame, so the client can show the right card (helper's half):
    //   ended (the save shows gameOver)  -> gameEnded (+ code for endscreen access)
    //   save on disk, not ended (restart) -> reload on demand + continue the join
    //   no save anywhere                  -> noSuchGame
    // Reason contract (for the helper's client half): { code:'gameEnded',
    // gameId, gameCode } — gameCode lets the client reach the final summary.
    if (!e && target) {
      const best = findSaveForTarget(target);
      if (best) {
        if (best.envelope.state && best.envelope.state.gameOver === true) {
          send(ws, { t: 'rejected', commandId: -1, code: 'gameEnded', gameId: best.envelope.gameId, gameCode: best.envelope.code });
          return;
        }
        const game = reloadSaveEntry(path.join(SAVES, best.file));
        if (game) { gameId = game.gameId; e = registry.entryOf(gameId); }
      }
    }
    if (!e) { send(ws, { t: 'rejected', commandId: -1, code: 'noSuchGame' }); return; }
    // NB: a finished game that is STILL in the registry stays JOINABLE — that is
    // how the A47 fullLog / endscreen access works (join the finished game, then
    // fetch its recording). gameEnded is only for a game GONE from the registry
    // whose save shows gameOver (handled in the !e branch above).
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
      if (e.blockedIps && e.blockedIps[info.ip] === true) {
        send(ws, { t: 'rejected', commandId: -1, code: 'blocked' });
        return;
      }
      // Part B: a reconnecting phone reclaims its grace-held seat with its id.
      if (msg.lobbyReconnect !== undefined) {
        const rc = registry.reclaimSeat(gameId, String(msg.lobbyReconnect));
        if (rc.ok) {
          const key = gameId + '|' + rc.seat;
          if (graceTimers[key]) { clearTimeout(graceTimers[key]); delete graceTimers[key]; }
          info.gameId = gameId; info.seat = rc.seat;
          send(ws, { t: 'joinedLobby', gameId, joinCode: e.joinCode, seat: rc.seat, reconnectId: rc.reconnectId, lobby: roster(e) });
          broadcastLobby(gameId);
          return;
        }
        // id didn't match (expired/released) — fall through to a fresh reservation
      }
      // XVII §3: a host may CLOSE joining on the pre-start lobby. A closed lobby
      // refuses fresh reservations (the reconnect-reclaim above already returned,
      // so a dropped seat-holder still reclaims its own seat). While OPEN, a
      // joiner overflowing the human seats flips a free AI seat (allowAiFill).
      if (e.options.joiningOpen === false) {
        send(ws, { t: 'rejected', commandId: -1, code: 'joiningClosed' });
        return;
      }
      const res = registry.reserveSeat(gameId, { name: msg.name, seat: msg.seat, allowAiFill: true });
      if (!res.ok) { send(ws, { t: 'rejected', commandId: -1, code: res.reason }); return; }
      info.gameId = gameId; info.seat = res.seat;
      send(ws, { t: 'joinedLobby', gameId, joinCode: e.joinCode, seat: res.seat, reconnectId: res.reconnectId, lobby: roster(e) });
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
      // §3 late-join takeover: a NEW joiner (no reconnect token / seat code) to a
      // running/paused game with (public AND lateJoining) takes over an eligible
      // AI civ. selectTakeoverSeat = second-strongest of the alive-&&-AI pool;
      // the claimSeat ENGINE command flips human=true through the normal command
      // path so it records + replays (a75fc2b). Seat + fresh token then bind the
      // now-human pid. The join answer names the assigned civ (client reveal, §4).
      if (!msg.token && !msg.seatCode && e.options.public === true && e.options.lateJoining === true) {
        const pid = selectTakeoverSeat(e.game.state, p => score(e.game.state, p, ruleset));
        if (pid === null) { send(ws, { t: 'rejected', commandId: -1, code: 'noSeatAvailable' }); return; }
        const claimed = e.game.apply(pid, { type: 'claimSeat', player: pid });
        if (!claimed.ok) { send(ws, { t: 'rejected', commandId: -1, code: 'noSeatAvailable' }); return; }
        const bound = e.game.bindSeat(msg.name || 'Player'); // the now-only untokened human seat = pid
        if (bound.error || bound.playerId !== pid) { send(ws, { t: 'rejected', commandId: -1, code: 'noSeatAvailable' }); return; }
        e.seats[pid] = { human: true, reserved: true, name: msg.name || 'Player' }; // registry tracks the seat
        info.playerId = pid; info.seat = pid;
        send(ws, {
          t: 'joined', playerId: pid, gameId, token: bound.token, seatCode: bound.seatCode,
          assignedCiv: e.game.state.players[pid].civ, // §4: client shows a post-join reveal banner
          view: e.game.view(pid), rulesOverrides: e.game.rulesOverrides, code: e.game.code(),
          civs: playerCivs(e.game)
        });
        if (autosave) e.game.saveTo(savePath(gameId)); // claimSeat changed state — persist
        broadcastGame(gameId, { t: 'presence', playerId: pid, connected: true });
        return;
      }
      const out = route(e.game, msg);
      for (const m of out.reply) { send(ws, m); if (m.t === 'joined') info.playerId = m.playerId; }
      if (info.playerId) { // presence: tell the game, and hand the joiner the map
        cancelTakeover(gameId, info.playerId); // XIV §30: the player is back — stop/undo any auto-takeover
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
    // #1870 slice 2: lobby games are built without a save path; attach the
    // recording sidecar now (before any command) so their per-command log
    // streams to disk instead of growing in RAM — the turn-2623 OOM case.
    if (autosave && res.game.setSidecar) res.game.setSidecar(sidecarOf(savePath(gameId)));
    olog('game_start', { gameId, seats: liveSeats.length, turn: res.game.state.turn });
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

  wss.on('connection', (ws, req) => {
    // A50 item 2: admission control — global + per-IP concurrency caps (the
    // per-IP connect-RATE already ran in verifyClient, pre-allocation).
    const ip = clientIp(req); // proxy-aware; stored so every per-IP check agrees
    const adm = limiter.onConnect(ip);
    if (!adm.ok) { send(ws, { t: 'rejected', commandId: -1, code: adm.reason }); ws.close(); return; }
    // A50 item 0 (docs/17 lane): every admitted socket gets its own command
    // token-bucket — the per-connection fairness guard on the cmd/endTurn path.
    conns.set(ws, { budget: createCommandBudget({ now, limits: opts.limits }), cid: String(++connSeq), ip });
    olog('conn_open', { conns: conns.size });
    // A ws protocol error (oversized frame past maxPayload, malformed framing)
    // emits 'error'; WITHOUT a listener Node throws and crashes the whole
    // server — one bad client could take it down. ws closes that socket itself;
    // swallow so it can't (never logged per event).
    ws.on('error', () => {});
    // Part A heartbeat liveness: a pong resets the miss counter (see heartbeatTick).
    ws.missedPongs = 0;
    ws.on('pong', () => { ws.missedPongs = 0; });
    // Slice 3c: close a SILENT squatter — connected, sent nothing within the
    // window (the connect-flood residue). Any message sets sawMessage + spares it.
    const unauthTimer = setTimeout(() => {
      const i = conns.get(ws);
      if (i && i.gameId === undefined && !i.sawMessage && ws.readyState === ws.OPEN) {
        send(ws, { t: 'rejected', commandId: -1, code: 'joinTimeout' });
        ws.close();
      }
    }, unauthTimeoutMs);
    if (unauthTimer.unref) unauthTimer.unref();
    ws.on('close', () => {
      clearTimeout(unauthTimer);
      limiter.onDisconnect(ip);
      const info = conns.get(ws);
      conns.delete(ws); // first, so presence/eligibility no longer count us
      olog('conn_close', { conns: conns.size, gameId: info && info.gameId });
      if (info && info.cid) budgets.dropConn(info.cid); // release the all-message bucket
      if (info && info.gameId) {
        const e = registry.entryOf(info.gameId);
        if (e && e.status === 'lobby' && info.seat) {
          // Part B: hold the seat 'disconnected, reclaimable' for seatGraceMs
          // instead of freeing it instantly, so a reconnecting phone keeps it.
          registry.markDisconnected(info.gameId, info.seat);
          broadcastLobby(info.gameId);
          const gGameId = info.gameId, gSeat = info.seat, key = gGameId + '|' + gSeat;
          if (graceTimers[key]) clearTimeout(graceTimers[key]);
          graceTimers[key] = setTimeout(() => {
            delete graceTimers[key];
            const ent = registry.entryOf(gGameId);
            if (ent && ent.status === 'lobby' && ent.seats[gSeat] && ent.seats[gSeat].disconnected) {
              registry.releaseSeat(gGameId, gSeat); // grace expired unreclaimed → free as today
              broadcastLobby(gGameId);
            }
          }, seatGraceMs);
          if (graceTimers[key].unref) graceTimers[key].unref();
        } else if (e && e.status === 'started' && info.playerId && !info.spectator) {
          // docs/08 §4: the game learns who dropped ("waiting for <name>")
          broadcastGame(info.gameId, { t: 'presence', playerId: info.playerId, connected: false });
          scheduleTakeover(info.gameId, info.playerId); // XIV §30: AI takes over / auto-skip after the grace window
          // §5 pause-on-empty: when the LAST connected human leaves a public+
          // lateJoining game, PAUSE — no AI/regency turns, no clock (driveRegents
          // early-returns on e.paused). It stays listed as 'paused', a late-join
          // or token rejoin + a human action resumes it.
          if (e.options.public === true && e.options.lateJoining === true && humanConnCount(info.gameId) === 0) {
            e.paused = true;
            e.pausedAt = Date.now(); // §7: eviction breaks ties by longest-paused
          }
        }
      }
    });
    ws.on('message', raw => {
      const parsed = parseMessage(raw.toString());
      if (!parsed.ok) { send(ws, { t: 'rejected', commandId: -1, code: parsed.code }); return; }
      const msg = parsed.msg;
      const info = conns.get(ws);
      if (info) info.sawMessage = true; // Slice 3c: not a silent squatter
      // docs/17 layered budget: a per-connection ALL-MESSAGE cap over EVERY
      // frame type (ping/list/vote/cmd/...) so no socket saturates the loop with
      // cheap non-cmd frames. Over budget -> cheap drop; reply throttled 1/sec.
      if (info && info.cid && !budgets.message(info.cid).ok) {
        const nowMs = Date.now();
        if (info.lastMsgRejectAt === undefined || nowMs - info.lastMsgRejectAt >= 1000) {
          info.lastMsgRejectAt = nowMs;
          send(ws, { t: 'rejected', commandId: -1, code: 'rateLimited' });
        }
        return;
      }
      if (msg.t === 'ping') { send(ws, { t: 'pong' }); return; }
      if (msg.t === 'list') {
        // H-1 (b): joinCode enumerates ONLY for public lobbies — handing a
        // private lobby's code to any connection defeats the A50 posture
        // (existence still lists; the code is the secret, not the game)
        const games = registry.list().map(g => {
          const e = registry.entryOf(g.gameId);
          if (e && e.options && e.options.public === true) return g;
          return { gameId: g.gameId, started: g.started, turn: g.turn, seats: g.seats };
        });
        send(ws, { t: 'games', games });
        return;
      }
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
          const started = e.status !== 'lobby';
          const lj = lateJoinable(e); // §2: started + public + lateJoining + eligible pool
          if (!started) {
            if (open === 0) continue; // full lobbies drop off
          } else if (!lj && e.options.allowSpectators !== true) {
            continue; // a started game nobody can take over or spectate is unlisted
          }
          // §2 additive row fields (state/turn/era/joinable) — the shared contract
          // with the helper's client half. NEVER the join code, NEVER seated IPs.
          const paused = started && e.paused === true; // §5 sets e.paused
          const row = {
            gameId: g.gameId, // capability-by-listing: public games are joinable
            hostName: (e.seats[e.hostSeat] && e.seats[e.hostSeat].name) || 'host',
            openSeats: open, totalSeats: total,
            size: e.options.size, age: e.options.age,
            spectators: e.options.allowSpectators === true,
            status: e.status,
            state: started ? (paused ? 'paused' : 'running') : 'open',
            joinable: started ? lj : open > 0
          };
          if (started) { row.turn = e.game.state.turn; row.era = gameEraBand(e.game.state).band; }
          games.push(row);
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
        const saves = [];
        for (const row of scanSaves()) { // H-1 (d): the cached scan
          const p = row.envelope;
          try {
            saves.push({
              file: row.file, gameId: p.gameId, code: p.code, savedAt: p.savedAt,
              turn: p.state.turn, year: p.state.year,
              players: p.state.playerOrder.map(pid => ({
                name: p.state.players[pid].name,
                civ: p.state.players[pid].civ,
                human: p.state.players[pid].human === true
              })),
              loaded: registry.entryOf(p.gameId) !== null // already live?
            });
          } catch (e) { /* malformed state shape: not listable */ }
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
        let best = null; // newest matching envelope wins
        for (const row of scanSaves()) { // H-1 (d): the cached scan
          const p = row.envelope;
          if (norm(p.code) !== want) continue;
          if (best === null || String(p.savedAt || '') > String(best.savedAt || '')) best = { file: row.file, savedAt: p.savedAt };
        }
        if (best === null) { send(ws, { t: 'rejected', commandId: -1, code: 'noSuchCode' }); return; }
        resumeFromFile(ws, path.join(SAVES, best.file));
        return;
      }
      if (msg.t === 'create') {
        // A50 item 2: per-IP create rate + global game cap before anything is
        // registered (game-spam / registry exhaustion).
        const crl = limiter.allow(info.ip, 'create');
        if (!crl.ok) { send(ws, { t: 'rejected', commandId: -1, code: crl.reason }); return; }
        const gcap = limiter.canCreateGame(registry.list().length);
        if (!gcap.ok) {
          // §6-7: at the cap — evict ONE paused game (never an active one) to make
          // room; the evicted game's code stays rejoinable. No paused game to
          // reclaim -> serverFull (the client shows the three-option message, §4).
          if (!evictOnePaused()) { send(ws, { t: 'rejected', commandId: -1, code: 'serverFull' }); return; }
        }
        const res = registry.create(msg.options || {}, msg.name);
        if (res.ok === false) { // A38: civ count exceeds what the map seats
          send(ws, { t: 'rejected', commandId: -1, code: res.reason, maxCivs: res.maxCivs, size: res.size });
          return;
        }
        const { entry, seat } = res;
        // §1 late-join: per-game flag, default ON, disabled host-wide by
        // --no-late-join. Only EFFECTIVE with listPublicly (options.public) —
        // §2 listing + §3 takeover check the (public AND lateJoining) pair.
        entry.options.lateJoining = opts.noLateJoin !== true
          && (msg.options && msg.options.lateJoining) !== false;
        // XVII §3: pre-start lobby joining toggle, host-only, default OPEN.
        entry.options.joiningOpen = (msg.options && msg.options.joiningOpen) !== false;
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
        const chrl = limiter.allow(info.ip, 'chat');
        if (!chrl.ok) { send(ws, { t: 'rejected', commandId: -1, code: chrl.reason }); return; }
        info.lastChatAt = now;
        const name = (e.seats[info.seat] && e.seats[info.seat].name) || info.seat;
        for (const [o, i] of conns) {
          if (i.gameId === info.gameId) send(o, { t: 'chat', seat: info.seat, name, text: msg.text });
        }
        return;
      }
      if (msg.t === 'setJoining') { // XVII §3: host-only open/closed toggle
        if (!info.gameId || !info.isCreator) {
          send(ws, { t: 'rejected', commandId: -1, code: 'notCreator' });
          return;
        }
        const r = registry.setJoining(info.gameId, msg.open);
        if (!r.ok) { send(ws, { t: 'rejected', commandId: -1, code: r.reason }); return; }
        broadcastLobby(info.gameId); // the roster's joiningOpen flips for everyone
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
            if (msg.block === true) registry.blockIp(info.gameId, i.ip);
            send(o, { t: 'kicked', gameId: info.gameId });
            // preserve the command budget across the kick — replacing the record
            // wholesale would drop info.budget and wave every subsequent frame
            // from a kicked-then-flooding socket past the budget (reviewer #1348).
            conns.set(o, { budget: (conns.get(o) || {}).budget, cid: (conns.get(o) || {}).cid }); // no longer in this lobby (keep budget + message-bucket id)
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
        if (e.paused) e.paused = false; // §5: re-enabling regency resumes a paused game
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
      // docs/17 layered budget: the SEAT bucket (PRIMARY) — shared across every
      // socket holding this seat's token, so a second socket/reconnect cannot
      // buy extra budget (the multi-socket bypass the per-connection backstop
      // above misses). endTurn draws its own tighter bucket.
      const seatPid = e.game.seatOf(msg.token);
      if (seatPid !== null && !budgets.seatCmd(gameId, seatPid, msg.t === 'endTurn' ? 'endTurn' : 'cmd').ok) {
        send(ws, { t: 'rejected', commandId: Number.isInteger(msg.commandId) ? msg.commandId : -1, code: 'rateLimited' });
        return;
      }
      const out = route(e.game, msg);
      for (const m of out.reply) send(ws, m);
      fanout(gameId, out, e.game);
      if (e.paused && seatPid !== null) e.paused = false; // §5: a seated human's command resumes a paused game
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
    // host:port is split at the LAST ':', so a scheme silently yields a garbage
    // host and the master rejects every heartbeat with "badAddress". Caught at
    // boot instead: behind a TLS proxy the right value is <domain>:443.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(opts.publicAddr)) {
      throw new Error(`--public-addr must be a bare host[:port] with no scheme — got "${opts.publicAddr}". Behind a TLS proxy use the PUBLIC port, e.g. example.com:443`);
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
    // late-join §2: this TWINS the listGames filter (noted duplication — keep the
    // two in sync). The public count is the "can I play on this server" number,
    // so it INCLUDES late-join-joinable running games (spec §2 recommendation),
    // not just open lobbies.
    const publicOpenGames = () => {
      let n = 0;
      for (const g of registry.list()) {
        const e = registry.entryOf(g.gameId);
        if (!e || e.options.public !== true) continue;
        if (e.game && e.game.state && e.game.state.gameOver === true) continue;
        const open = Object.values(e.seats).filter(x => x.human && !x.reserved).length;
        if (e.status === 'lobby') { if (open === 0) continue; }
        else if (!lateJoinable(e) && e.options.allowSpectators !== true) continue;
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
      olog('boot', { port: httpServer.address().port, host: opts.host || '0.0.0.0', autosave: opts.autosave !== false, trustProxyHops: opts.trustProxyHops || 0 });
      resolve({
        port: httpServer.address().port,
        game: defaultGame,
        rotateSaves, // exposed so tests can trigger rotation deterministically
        maintenanceSweep, // A50 3b: tests advance opts.now then call this to exercise expiry
        heartbeatTick, // Part A: tests drive heartbeat rounds without waiting heartbeatMs
        gameProbe, autosaveAll, // crash.js: crashdump context + OOM graceful save-all
        healthSnapshot, // A50 item 5: /healthz body (test/ops visibility)
        announceStatus: () => ({ listed: announceState.listed, reason: announceState.reason, lastError: announceState.lastError }), // A51b: test/console visibility
        close: () => new Promise(done => {
          clearInterval(sweepTimer);
          clearInterval(heartbeatTimer); // Part A
          if (announceTimer) clearInterval(announceTimer); // A51b
          for (const k of Object.keys(graceTimers)) clearTimeout(graceTimers[k]); // Part B seat-grace
          for (const k of Object.keys(takeoverTimers)) clearTimeout(takeoverTimers[k]); // XIV §30
          // lobby-drop-surface (#2448): a lobby client reconnects on a raw drop
          // (Part C), which SWALLOWS a server-going-away close and leaves the room
          // stale. Close lobby sockets with a DETERMINISTIC reason (code 1001 +
          // 'lobbyConnectionLost') so the client can distinguish "server gone,
          // surface it + stop reconnecting" from a transient drop. Others keep the
          // abrupt terminate.
          for (const ws of conns.keys()) {
            const ci = conns.get(ws);
            const e = ci && ci.gameId ? registry.entryOf(ci.gameId) : null;
            if (e && e.status === 'lobby' && ci.seat && !ci.playerId) {
              try { ws.close(1001, 'lobbyConnectionLost'); } catch (err) { ws.terminate(); }
            } else {
              ws.terminate();
            }
          }
          wss.close(() => httpServer.close(done));
        })
      });
    });
  });
}

// --- CLI ----------------------------------------------------------------
// Referenced by the unknown-argument WARN, so it must stay in sync with the
// parse loop below. Full prose: docs/how-to-host.md § "Server flags".
const USAGE = `RetroMultiCiv server — node server/index.js [flags]

Game:
  --port N              listen port (default 8123)
  --seed N              world seed for the default game
  --civs N              civilizations in the default game
  --humans N            human seats in the default game
  --size NAME           xsmall|small|medium|large|huge (default medium)
  --game FILE           resume from a save
  --host ADDR           bind address (use 127.0.0.1 behind a proxy)
  --no-save             disable autosave
  --no-spectators       refuse tokenless spectators
  --no-auto-takeover    new games default OFF: a dropped seat is auto-SKIPPED, not AI-driven (host can still opt in per-game; default is ON = AI takeover)
  --debug               dev conveniences — NEVER on a public host

Public hosting (docs/12, docs/16):
  --trust-proxy         behind one reverse proxy (per-IP limits need this)
  --trust-proxy-hops N  behind N proxies
  --origin-allowlist L  CSV of exact allowed browser origins
  --announce URL        heartbeat to a master index
  --public-addr HOST:PORT   bare host:port, NO scheme (e.g. example.com:443)
  --public-name NAME    listing name on the master index
  --share-reports DIR   write anonymized match reports (off by default)
  --bug-reports DIR     accept in-client bug reports, write-only to DIR (off by default)

Caps and budgets (docs/how-to-host.md § "Sizing by RAM"):
  --max-games N         --max-conns N         --max-conns-per-ip N
  --max-turns N         --max-civs N          --max-size NAME
  --max-saves N         --max-saves-mb N      --max-outbuf-mb N
  --creates-per-hour N  --joins-per-min N     --chat-per-min N
  --cmd-burst N         --cmd-per-sec N       --connects-per-sec N
  --connect-burst N     --unauth-timeout-sec N
  --heartbeat-sec N     --heartbeat-misses N  --seat-grace-sec N
  --lobby-ttl-min N     --abandoned-hours N
  --mem-soft-pct N      --mem-check-sec N
  --regency-min-turn-ms N   total ms a regent round takes (÷ regents; default 1000, 0 = instant)

Unknown flags WARN and are ignored; effective caps print on boot.`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = { port: 8123, seed: Date.now() % 1000000, civs: 2, humans: 1, size: 'medium' };
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else if (a === '--port') opts.port = Number(argv[++i]);
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
    else if (a === '--no-auto-takeover') opts.autoTakeover = false; // XIV §30: default OFF for new games (host can still opt in per-game)
    // Part A (mobile): ws heartbeat — detect half-open sockets (a locked phone)
    else if (a === '--heartbeat-sec') opts.heartbeatMs = Number(argv[++i]) * 1000;
    else if (a === '--heartbeat-misses') opts.heartbeatMisses = Number(argv[++i]);
    else if (a === '--seat-grace-sec') opts.seatGraceMs = Number(argv[++i]) * 1000; // Part B lobby seat-grace
    // Slice 3a: per-IP connect-rate + proxy-aware client IP
    else if (a === '--connects-per-sec') (opts.limits = opts.limits || {}).connectsPerSec = Number(argv[++i]);
    else if (a === '--connect-burst') (opts.limits = opts.limits || {}).connectBurst = Number(argv[++i]);
    else if (a === '--trust-proxy') opts.trustProxyHops = 1;
    else if (a === '--trust-proxy-hops') opts.trustProxyHops = Number(argv[++i]);
    // Slice 3b: WS Origin allow-list (CSV of exact origins; empty = permissive)
    else if (a === '--origin-allowlist') opts.originAllowlist = String(argv[++i] || '').split(',').map(s => s.trim());
    // Slice 3c: outbound backpressure + silent-squatter timeout
    else if (a === '--max-outbuf-mb') opts.maxOutBufferBytes = Number(argv[++i]) * 1024 * 1024;
    else if (a === '--unauth-timeout-sec') opts.unauthTimeoutMs = Number(argv[++i]) * 1000;
    // Crash resilience (server/crash.js): OOM memory watchdog tuning
    else if (a === '--mem-soft-pct') opts.memSoftPct = Number(argv[++i]);
    else if (a === '--mem-check-sec') opts.memCheckMs = Number(argv[++i]) * 1000;
    // A50 item 5: structured one-line JSON ops logs (default = human output)
    else if (a === '--log-json') opts.logJson = true;
    // A50 item 6: closed-group invite gate — CSV of accepted ?invite= codes
    else if (a === '--invite-code') opts.inviteCodes = String(argv[++i] || '').split(',').map(s => s.trim());
    // late-join §1: host-wide off-switch for late-join takeover (default ON per-game)
    else if (a === '--no-late-join') opts.noLateJoin = true;
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
    // #1875 operator resource caps (per-game bounds on log growth / state / CPU)
    else if (a === '--max-turns') opts.maxTurns = Number(argv[++i]);
    else if (a === '--max-civs') opts.maxCivs = Number(argv[++i]);
    else if (a === '--max-size') {
      const s = argv[++i];
      if (!SIZES[s]) { console.error(`--max-size must be one of ${SIZE_ORDER.join('/')}`); process.exit(1); }
      opts.maxSize = s;
    }
    // A51b: master-index announce (docs/12 §6) — one flag = listed; stop = gone
    else if (a === '--announce') opts.announce = argv[++i];
    else if (a === '--public-name') opts.publicName = argv[++i];
    else if (a === '--public-addr') opts.publicAddr = argv[++i];
    else if (a === '--share-reports') opts.shareReports = argv[++i]; // S1: match-report dir (OFF by default)
    else if (a === '--bug-reports') opts.bugReports = argv[++i]; // #3: in-client bug-report sink (write-only, OFF by default)
    else if (a === '--regency-min-turn-ms') opts.regencyMinTurnMs = Number(argv[++i]); // XIV §3: total ms per regent round (÷ regents); 0 = instant
    else if (a === '--debug') opts.debug = true; // A61: dev conveniences (whole-repo static, verbose)
    // A101 rider: WARN, don't fail. A cloud-init unit can then carry a future
    // (not-yet-merged) flag without crash-looping the deploy (the S0 the Hetzner
    // box hit); a typo'd flag no-ops and shows up on the boot `caps:` line below.
    else { console.error(`WARN: unknown argument ${a} — ignored; see --help`); }
  }
  // Crash resilience: install fatal-error handlers EARLY (deps filled after boot,
  // read by reference at crash-time) so even a boot crash writes a crashdump.
  const crashDeps = {};
  installCrashHandlers(crashDeps);
  Promise.resolve().then(() => startServer(opts)).then((server) => {
    const { port, game } = server;
    crashDeps.gameProbe = server.gameProbe;
    crashDeps.autosaveAll = server.autosaveAll;
    // OOM graceful-exit watchdog: exit(70) before V8's fatal heap-OOM, after a
    // final save-all. Games resume from per-command autosave via the wrapper.
    startMemoryWatchdog({
      softPct: opts.memSoftPct, checkMs: opts.memCheckMs,
      gameProbe: server.gameProbe, autosaveAll: server.autosaveAll
    });
    console.log(`RetroMultiCiv server: http://localhost:${port}/client/ (default game ${game.gameId}, turn ${game.state.turn})`);
    console.log(`WebSocket: ws://localhost:${port}/ws — autosave ${opts.autosave === false ? 'OFF' : 'on'} — static ${opts.debug ? 'WHOLE-REPO (--debug)' : 'hardened (client/engine/shared/data)'} — lobby: create/list/join-code/start`);
    // Slice 3c: one-line posture summary so an operator sees the active guards.
    console.log(`posture: trust-proxy ${opts.trustProxyHops ? 'ON(' + opts.trustProxyHops + ')' : 'off'} — origin-allowlist ${(opts.originAllowlist && opts.originAllowlist.filter(Boolean).length) ? opts.originAllowlist.filter(Boolean).join(',') : 'permissive'} — invite-gate ${(opts.inviteCodes && opts.inviteCodes.filter(Boolean).length) ? 'ON(' + opts.inviteCodes.filter(Boolean).length + ' code' + (opts.inviteCodes.filter(Boolean).length > 1 ? 's' : '') + ')' : 'open'} — bug-reports ${opts.bugReports ? 'ON(' + opts.bugReports + ')' : 'off'} — connect-rate + cmd/seat/msg budgets + heartbeat + backpressure ON`);
    // A101 rider: the EFFECTIVE operator caps. Because unknown args now only WARN,
    // a typo'd cap flag no-ops silently — this line is the operator's confirmation
    // that a cap actually took (a typo shows the value as `unset`).
    {
      const cap = v => (v === undefined || v === null ? 'unset' : v);
      const lim = opts.limits || {}, rot = opts.rotation || {};
      console.log(`caps: maxGames=${cap(lim.maxGames)} maxSavesMb=${cap(rot.maxSavesMb)} maxTurns=${cap(opts.maxTurns)} maxCivs=${cap(opts.maxCivs)} maxSize=${cap(opts.maxSize)} memSoftPct=${cap(opts.memSoftPct)}`);
    }
    if (opts.host !== '127.0.0.1' && opts.host !== 'localhost' && !opts.trustProxyHops) {
      console.log('note: reachable on the network over plain ws:// — for PUBLIC hosting terminate TLS at a reverse proxy (tokens travel the socket); LAN is fine. See docs/how-to-host.md.');
    }
    // Slice 3c: graceful shutdown — close sockets + exit (state already durable
    // via autosave-per-command; 5s hard-exit guard if close hangs).
    let down = false;
    const shutdown = sig => {
      if (down) return; down = true;
      console.log(`\n${sig} — closing sockets and shutting down…`);
      setTimeout(() => process.exit(0), 5000).unref();
      server.close().then(() => process.exit(0));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch(err => {
    console.error(`cannot start: ${err.message}`);
    process.exit(1);
  });
}
