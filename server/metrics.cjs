// Usage metrics for the hosted services (specs/metrics-v1.md, v1.0 scope).
// COUNTS ONLY — the privacy contract is binding: no IPs, no user agents, no
// tokens, no names, no game ids, no seeds, no per-request rows. One instance
// per service via createMetrics(); the game server (ESM) imports this and the
// master index (CJS tools/) requires it — hence .cjs, the one dual-consumable
// module form (the spec named metrics.js; the extension is the mechanical fix).
// A metrics failure must never affect serving: load/save catch everything,
// warn once, and carry on. Persistence is dirty-flagged, at most one write per
// interval, never in a request path.
const fs = require('node:fs');

const FORMAT = 'retromulticiv-metrics';

// loopback-only exposure guard for GET /metrics (spec §3): the SOCKET address,
// never XFF — a proxy hop is by definition not the operator's own shell.
function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// deps: { now?, warn?, defaults? } — defaults pre-seeds the counter schema so
// a snapshot always shows every counter (zeros included), which keeps the
// endpoint self-describing. Clock-injectable like limits.js (no sleeps in tests).
function createMetrics(deps) {
  deps = deps || {};
  const now = deps.now || Date.now;
  const warn = deps.warn || (m => console.log(m));
  const counters = {};
  for (const k of Object.keys(deps.defaults || {})) counters[k] = deps.defaults[k] | 0;
  let startedAt = Math.floor(now() / 1000);
  let filePath = null;
  let dirty = false;
  let lastSaveAt = 0;
  let warnedSave = false;

  function bump(name, n) {
    counters[name] = (counters[name] | 0) + (n === undefined ? 1 : n | 0);
    dirty = true;
  }
  function setPeak(name, v) {
    if ((v | 0) > (counters[name] | 0)) { counters[name] = v | 0; dirty = true; }
  }
  function set(name, v) { // plain gauge (e.g. servers_listed)
    if ((counters[name] | 0) !== (v | 0)) { counters[name] = v | 0; dirty = true; }
  }
  function snapshot() {
    const out = { started_at: startedAt };
    for (const k of Object.keys(counters).sort()) out[k] = counters[k] | 0;
    return out;
  }
  // Load previous totals and continue; a missing/corrupt file starts fresh at
  // the defaults with ONE warning. Never throws.
  function load(path) {
    filePath = path;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) {
      if (fs.existsSync(path)) warn(`metrics: ${path} unreadable — starting fresh (${e.message})`);
      return false;
    }
    if (!parsed || parsed.format !== FORMAT || typeof parsed.counters !== 'object') {
      warn(`metrics: ${path} is not a ${FORMAT} file — starting fresh`);
      return false;
    }
    if (Number.isInteger(parsed.started_at)) startedAt = parsed.started_at;
    for (const k of Object.keys(parsed.counters)) {
      if (Number.isInteger(parsed.counters[k])) counters[k] = parsed.counters[k];
    }
    return true;
  }
  // Atomic write (tmp+rename, the bug-report.js pattern). Never throws; a
  // failing disk warns once and the service keeps serving.
  function save(path) {
    const p = path || filePath;
    if (!p) return false;
    try {
      const tmp = p + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ format: FORMAT, version: 1, started_at: startedAt, counters }));
      fs.renameSync(tmp, p);
      dirty = false;
      lastSaveAt = now();
      return true;
    } catch (e) {
      if (!warnedSave) { warnedSave = true; warn(`metrics: cannot write ${p} — metrics unpersisted (${e.message})`); }
      return false;
    }
  }
  // The autosave tick body: dirty-flagged, at most one write per intervalMs.
  function maybeSave(intervalMs) {
    if (!dirty || !filePath) return false;
    if (now() - lastSaveAt < (intervalMs === undefined ? 60000 : intervalMs)) return false;
    return save();
  }
  return { bump, setPeak, set, snapshot, load, save, maybeSave };
}

module.exports = { createMetrics, isLoopback, FORMAT };
