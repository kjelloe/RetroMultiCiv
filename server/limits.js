// Per-IP rate limits + global caps for the public host (A50 item 2, docs/16
// gap 1). Pure and clock-injectable (deps.now) so every limit has a red case
// with time advanced by hand — no sleeps in tests. LAN-safe defaults: a normal
// LAN game never approaches them; they exist to blunt PUBLIC abuse (gameId
// enumeration floods, game-spam, connection exhaustion). All caps overridable
// via startServer({ limits: {...} }) / CLI flags (see server/index.js).
//
// The per-CONNECTION command-budget fairness guard lives here too
// (createCommandBudget) — a MEASURED requirement (docs/16 §2.4, docs/17 item 0):
// one socket flooding cheap `cmd`/`endTurn` frames must not starve co-players'
// command→ack time (measured 1 ms → 4.5 s). It is per CONNECTION, not per IP, so
// it is a small self-contained factory rather than limiter state.

export const DEFAULT_LIMITS = {
  maxConns: 200,        // global concurrent connections (the scale-test plateau)
  maxConnsPerIp: 16,    // concurrent connections from one IP (NAT/household-generous)
  maxGames: 50,         // global concurrent registered games
  createsPerHour: 20,   // new games created per IP per hour
  joinsPerMin: 30,      // join/reserve attempts per IP per minute
  chatPerMin: 60,       // chat messages per IP per minute
  connectsPerSec: 10,   // Slice 3a: per-IP new-connection refill rate (handshake, pre-alloc)
  connectBurst: 30,     // Slice 3a: per-IP connection-attempt burst
  cmdBurst: 40,         // per-connection command bucket capacity (a busy turn's burst)
  cmdRefillPerSec: 20,  // per-connection sustained commands/sec (LAN-generous; a flood is orders above)
  // docs/17 layered budget (createBudgets) — the PRIMARY layer over the
  // per-connection createCommandBudget backstop. The seat bucket is keyed by
  // SEAT (shared across a seat's sockets), so a second socket/reconnect cannot
  // buy extra budget. The message bucket bounds EVERY frame (closes a vote/ping
  // flood the cmd-only budget misses). Candidate defaults; the combined sweep
  // tunes them (the seat rate is the binding one — 15/s < the 20/s backstop).
  seatCmdBurst: 40,          // per-seat command burst (shared across the seat's sockets)
  seatCmdRefillPerSec: 15,   // per-seat sustained commands/sec (the binding rate)
  endTurnBurst: 4,           // per-seat endTurn burst (endTurn drives the AI chain)
  endTurnRefillPerSec: 2,    // per-seat sustained endTurns/sec
  msgBurst: 60,              // per-connection all-message burst (any frame type)
  msgRefillPerSec: 30        // per-connection sustained messages/sec
};

// Sliding-window widths + which config field caps each rate-limited action.
const WINDOW_MS = { create: 3600000, join: 60000, chat: 60000 };
const CAP_FIELD = { create: 'createsPerHour', join: 'joinsPerMin', chat: 'chatPerMin' };

export function createLimiter(deps) {
  const opts = deps || {};
  const now = opts.now || Date.now;
  const cfg = Object.assign({}, DEFAULT_LIMITS, opts.limits || {});
  const conns = {};    // ip -> concurrent connection count
  let totalConns = 0;
  const windows = {};  // "ip|action" -> ascending array of event timestamps (ms)

  function onConnect(ip) {
    if (totalConns >= cfg.maxConns) return { ok: false, reason: 'serverFull' };
    if ((conns[ip] || 0) >= cfg.maxConnsPerIp) return { ok: false, reason: 'tooManyConns' };
    conns[ip] = (conns[ip] || 0) + 1;
    totalConns += 1;
    return { ok: true };
  }

  function onDisconnect(ip) {
    if (conns[ip] !== undefined) {
      conns[ip] -= 1;
      if (conns[ip] <= 0) delete conns[ip];
    }
    if (totalConns > 0) totalConns -= 1;
  }

  // Rate-limited action (create/join/chat): true unless the IP has already hit
  // its window cap. Unknown actions are unthrottled (return ok).
  function allow(ip, action) {
    const w = WINDOW_MS[action];
    if (w === undefined) return { ok: true };
    const lim = cfg[CAP_FIELD[action]];
    const key = ip + '|' + action;
    const t = now();
    const arr = (windows[key] || []).filter(ts => t - ts < w);
    if (arr.length >= lim) { windows[key] = arr; return { ok: false, reason: 'rateLimited' }; }
    arr.push(t);
    windows[key] = arr;
    return { ok: true };
  }

  // Global game cap — called at create time with the live game count.
  function canCreateGame(gameCount) {
    if (gameCount >= cfg.maxGames) return { ok: false, reason: 'tooManyGames' };
    return { ok: true };
  }

  // Slice 3a: per-IP connect-attempt token bucket — enforced in the WS handshake
  // (verifyClient) BEFORE the socket is allocated, so open/close churn cannot
  // pile up ws objects (the concurrency cap alone never trips on short-lived
  // sockets). O(1); idle buckets swept.
  const connectBuckets = {}; // ip -> { tokens, last }
  let connectRejected = 0;
  function allowConnect(ip) {
    const cap = cfg.connectBurst, rate = cfg.connectsPerSec, t = now();
    let b = connectBuckets[ip];
    if (b === undefined) b = connectBuckets[ip] = { tokens: cap, last: t };
    if (t > b.last) { b.tokens = Math.min(cap, b.tokens + ((t - b.last) / 1000) * rate); b.last = t; }
    if (b.tokens >= 1) { b.tokens -= 1; return { ok: true }; }
    connectRejected += 1;
    return { ok: false, reason: 'connectRateLimited' };
  }

  // Drop expired window entries so memory stays bounded under connect/disconnect
  // churn (a periodic caller in index.js, and cheap to call).
  function sweep() {
    const t = now();
    for (const key of Object.keys(windows)) {
      const action = key.slice(key.indexOf('|') + 1);
      const w = WINDOW_MS[action] || 0;
      const arr = windows[key].filter(ts => t - ts < w);
      if (arr.length === 0) delete windows[key]; else windows[key] = arr;
    }
    // Slice 3a: an idle connect bucket (60s untouched) has fully refilled — drop it.
    for (const ip of Object.keys(connectBuckets)) if (t - connectBuckets[ip].last > 60000) delete connectBuckets[ip];
  }

  return {
    onConnect, onDisconnect, allow, allowConnect, canCreateGame, sweep, cfg,
    counters: () => ({ connectRejected }),
    stats: () => ({ totalConns, ips: Object.keys(conns).length, windows: Object.keys(windows).length, connectBuckets: Object.keys(connectBuckets).length })
  };
}

// Per-CONNECTION command token-bucket (A50 item 0, docs/17 lane — folded into the
// game stream while no hardening agent exists; the reviewer is flagged). One
// bucket per admitted socket (attached to its conn record in server/index.js).
// take() is O(1) and clock-injectable (deps.now) — no per-command timestamp
// array, so a flood cannot grow memory. Over budget → { ok:false,
// reason:'rateLimited' }: the caller cheap-rejects with the existing
// { t:'rejected', code:'rateLimited' } frame and does NOT route the command, so
// the flooder's excess never reaches the expensive game path. Tokens refill
// continuously up to cmdBurst; a legit fast player stays comfortably under.
export function createCommandBudget(deps) {
  const opts = deps || {};
  const now = opts.now || Date.now;
  const cfg = Object.assign({}, DEFAULT_LIMITS, opts.limits || {});
  const cap = cfg.cmdBurst;
  const rate = cfg.cmdRefillPerSec;
  let tokens = cap;
  let last = now();
  function take() {
    const t = now();
    tokens = tokens + ((t - last) / 1000) * rate;
    if (tokens > cap) tokens = cap;
    last = t;
    if (tokens >= 1) { tokens = tokens - 1; return { ok: true }; }
    return { ok: false, reason: 'rateLimited' };
  }
  return { take, stats: () => ({ tokens }) };
}

// Layered command budget (docs/17 P0 primary layer, on TOP of the shipped
// per-connection createCommandBudget backstop). Two bucket families in one
// bounded map:
//   seatCmd(gameId, pid, kind) — the SEAT bucket (kind 'cmd'|'endTurn'), SHARED
//     across every socket holding that seat's token, so opening a second socket
//     or reconnecting cannot buy a seat extra budget (the multi-socket bypass a
//     per-connection-only guard misses). endTurn has its own tighter bucket.
//   message(connId) — a per-connection ALL-MESSAGE bucket over EVERY frame type
//     (ping/list/join/vote/cmd/malformed), so no socket saturates the loop with
//     cheap non-cmd frames (closes the vote-flood the cmd-only budget misses).
// take() is O(1); sweep() drops idle-full buckets (a bucket untouched for 60s
// has fully refilled, so it is indistinguishable from fresh). Clock-injectable.
export function createBudgets(deps) {
  const opts = deps || {};
  const now = opts.now || Date.now;
  const cfg = Object.assign({}, DEFAULT_LIMITS, opts.limits || {});
  const buckets = {}; // key -> { tokens, last }
  let rejected = 0;
  function take(key, cap, rate) {
    const t = now();
    let b = buckets[key];
    if (b === undefined) b = buckets[key] = { tokens: cap, last: t };
    b.tokens = Math.min(cap, b.tokens + ((t - b.last) / 1000) * rate);
    b.last = t;
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    rejected += 1;
    return false;
  }
  function seatCmd(gameId, pid, kind) {
    const cap = kind === 'endTurn' ? cfg.endTurnBurst : cfg.seatCmdBurst;
    const rate = kind === 'endTurn' ? cfg.endTurnRefillPerSec : cfg.seatCmdRefillPerSec;
    return { ok: take('s:' + gameId + '|' + pid + '|' + kind, cap, rate), reason: 'rateLimited' };
  }
  function message(connId) {
    return { ok: take('m:' + connId, cfg.msgBurst, cfg.msgRefillPerSec), reason: 'rateLimited' };
  }
  function dropGame(gameId) {
    const pre = 's:' + gameId + '|';
    for (const k of Object.keys(buckets)) if (k.startsWith(pre)) delete buckets[k];
  }
  function dropConn(connId) { delete buckets['m:' + connId]; }
  function sweep() {
    const t = now();
    for (const k of Object.keys(buckets)) if (t - buckets[k].last > 60000) delete buckets[k];
  }
  return {
    seatCmd, message, dropGame, dropConn, sweep,
    counters: () => ({ budgetRejected: rejected }),
    stats: () => ({ buckets: Object.keys(buckets).length })
  };
}

// Slice 3a: proxy-aware client IP. Behind a reverse proxy every socket's TCP
// peer is the proxy, so per-IP limits need the FORWARDED client IP — but
// X-Forwarded-For is client-settable, so it is trusted ONLY when hops>0 AND the
// immediate peer is private/loopback (the same-box proxy). A direct client's
// forged XFF is always ignored. Pure + exported for deterministic tests.
export function isPrivatePeer(ip) {
  const a = String(ip || '').replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || a.startsWith('127.')
    || a.startsWith('10.') || a.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(a) || a.startsWith('fc') || a.startsWith('fd');
}
export function clientIpFrom(req, hops) {
  const peer = (req && req.socket && req.socket.remoteAddress) || '';
  const h = Number(hops) || 0;
  if (h <= 0 || !isPrivatePeer(peer)) return peer; // direct: never trust XFF
  const xff = String((req.headers && req.headers['x-forwarded-for']) || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (xff.length === 0) return peer;
  const chain = xff.concat(peer);          // [client, ...proxies, peer]
  const idx = chain.length - 1 - h;
  return idx >= 0 ? chain[idx] : chain[0];
}

// Slice 3b: WS Origin allow-list. Empty/absent list = PERMISSIVE (the LAN
// default — WebSockets are CORS-exempt, so this is opt-in browser-abuse
// mitigation, not authentication). When set: EXACT match required (no
// substring), and a MISSING Origin is rejected (browsers always send one).
export function originAllowed(origin, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  if (!origin) return false;
  return allowlist.indexOf(origin) !== -1;
}

// A50 item 6: closed-group invite gate. Empty/absent list = OPEN (the default —
// a public host is world-joinable). When set: the ws upgrade URL must carry
// ?invite=<code> matching one entry, else the handshake is refused before the
// socket is allocated. reqUrl is the upgrade request path (info.req.url), e.g.
// "/ws?invite=abc". This is a lightweight access gate (share the code with
// friends), NOT cryptographic auth — pair it with TLS + --origin-allowlist.
export function inviteAllowed(reqUrl, codes) {
  if (!codes || codes.length === 0) return true;
  let code = null;
  try { code = new URL(reqUrl || '', 'http://x').searchParams.get('invite'); } catch (e) { return false; }
  return code !== null && codes.indexOf(code) !== -1;
}
