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
  cmdBurst: 40,         // per-connection command bucket capacity (a busy turn's burst)
  cmdRefillPerSec: 20   // per-connection sustained commands/sec (LAN-generous; a flood is orders above)
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
  }

  return {
    onConnect, onDisconnect, allow, canCreateGame, sweep, cfg,
    stats: () => ({ totalConns, ips: Object.keys(conns).length, windows: Object.keys(windows).length })
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
