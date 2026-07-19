// Server crash resilience (docs specs/server-crash-resilience.md, hardening lane).
// GOLDEN-NEUTRAL server ops: no engine/state/save-format touch. Two mechanisms:
//   - crash observability: uncaughtException/unhandledRejection -> a structured
//     crashdump FILE + a one-line stderr mirror, then exit(70) so the wrapper
//     knows to restart.
//   - OOM graceful-exit: a polling memory watchdog that exits BEFORE V8's fatal
//     (uncatchable) heap-OOM, after a best-effort autosave-all (games are
//     already durable via per-command autosave, so at most the in-flight
//     command is lost).
// All formatting/IO is wrapped so a crashdump failure never masks the original
// crash. Every side-effecting dependency (memory readers, exit, clock, IO) is
// injectable so the paths are testable without a real crash or real OOM.
import fs from 'node:fs';
import v8 from 'node:v8';

const EXIT_RESTART = 70; // distinct "crash/OOM — restart me" code the wrapper keys on

function defaultHeapStats() { return v8.getHeapStatistics(); }

// Never throws. Writes crashdumps/<kind>-<ISO>.log + mirrors a one-line summary
// to stderr. Returns { path, body } for tests (path null if the file write failed).
export function writeCrashdump(err, origin, deps = {}) {
  const dir = deps.dir || 'crashdumps';
  const kind = deps.kind || 'crash';
  const nowIso = deps.nowIso || (() => new Date().toISOString());
  const memoryUsage = deps.memoryUsage || process.memoryUsage;
  const heapStats = deps.heapStats || defaultHeapStats;
  const iso = nowIso();
  let body;
  try {
    const mem = memoryUsage();
    const heap = heapStats();
    const limit = heap.heap_size_limit || 0;
    const pct = limit ? Math.round((mem.heapUsed / limit) * 100) : 0;
    const e = err || {};
    const lines = [
      `# ${kind} ${iso}`,
      `origin: ${origin}`,
      `name: ${e.name || typeof err}`,
      `message: ${e.message != null ? e.message : String(err)}`,
      `stack:`,
      e.stack || '(no stack)',
      ``,
      `memory: rss=${mem.rss} heapTotal=${mem.heapTotal} heapUsed=${mem.heapUsed} external=${mem.external} arrayBuffers=${mem.arrayBuffers}`,
      `heap_size_limit: ${limit}  heapUsed%: ${pct}`,
      `uptime_s: ${Math.round(process.uptime())}  pid: ${process.pid}  node: ${process.version}`,
      `argv: ${process.argv.join(' ')}`,
      ``,
      `games:`
    ];
    // Best-effort game context — the biggest signal for scale crashes (turn-2623).
    // Wrapped so a probe failure adds a note instead of throwing out of the dump.
    try {
      const games = deps.gameProbe ? deps.gameProbe() : [];
      if (!games.length) lines.push('  (none)');
      for (const g of games) lines.push(`  ${g.gameId} turn=${g.turn} units=${g.units} cities=${g.cities}`);
    } catch (probeErr) {
      lines.push(`  (game probe failed: ${probeErr && probeErr.message})`);
    }
    body = lines.join('\n') + '\n';
  } catch (fmtErr) {
    body = `# ${kind} ${iso}\norigin: ${origin}\n(crashdump formatting failed: ${fmtErr && fmtErr.message})\nraw: ${String((err && err.stack) || err)}\n`;
  }
  let path = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    path = `${dir}/${kind}-${iso.replace(/[:.]/g, '-')}.log`;
    fs.writeFileSync(path, body);
  } catch (_) {
    path = null; // fall back to the stderr mirror only
  }
  try {
    process.stderr.write(`[${kind}] ${iso} ${origin}: ${(err && err.message) || err}${path ? ` -> ${path}` : ' (crashdump file write failed)'}\n`);
  } catch (_) { /* stderr itself is failing; nothing more we can do */ }
  return { path, body };
}

// Registers the fatal-error handlers. deps is held by reference and read at
// crash-time, so the CLI can install early (catching boot crashes) and fill in
// gameProbe/autosaveAll once the server is up.
export function installCrashHandlers(deps = {}) {
  const exit = deps.exit || process.exit;
  process.on('uncaughtException', (err, origin) => {
    writeCrashdump(err, origin || 'uncaughtException', { ...deps, kind: 'crash' });
    exit(EXIT_RESTART);
  });
  process.on('unhandledRejection', (reason) => {
    writeCrashdump(reason, 'unhandledRejection', { ...deps, kind: 'crash' });
    exit(EXIT_RESTART);
  });
}

// Polling watchdog: exits gracefully once heapUsed crosses softPct of V8's heap
// limit, BEFORE the fatal uncatchable OOM. Returns { timer, check } — check() is
// the one-shot test seam (call it with a mocked high memoryUsage).
export function startMemoryWatchdog(deps = {}) {
  const softPct = deps.softPct != null ? deps.softPct : 85;
  const checkMs = deps.checkMs != null ? deps.checkMs : 20000;
  const memoryUsage = deps.memoryUsage || process.memoryUsage;
  const heapStats = deps.heapStats || defaultHeapStats;
  const exit = deps.exit || process.exit;
  const setIntervalFn = deps.setInterval || setInterval;
  let fired = false;
  const check = () => {
    if (fired) return false;
    let pct;
    try {
      const limit = heapStats().heap_size_limit || 0;
      if (!limit) return false;
      pct = (memoryUsage().heapUsed / limit) * 100;
    } catch (_) {
      return false; // a reader failure must not itself take the process down
    }
    if (pct < softPct) return false;
    fired = true;
    writeCrashdump(new Error(`heap soft-limit crossed: ${pct.toFixed(1)}% >= ${softPct}%`),
      'memory-watchdog', { ...deps, kind: 'oom' });
    try { if (deps.autosaveAll) deps.autosaveAll(); } catch (_) { /* best-effort */ }
    exit(EXIT_RESTART);
    return true;
  };
  const timer = setIntervalFn(check, checkMs);
  if (timer && timer.unref) timer.unref();
  return { timer, check };
}
