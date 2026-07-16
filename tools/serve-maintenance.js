#!/usr/bin/env node
// A96 maintenance watchdog — a dependency-free wrapper around the game server.
// It spawns `node server/index.js <args>` and supervises it. If the server
// exits non-zero MULTICIV_MAX_FAILURES times in a row, the wrapper binds the
// same port itself and serves a static "down for maintenance" page (503), then
// keeps retrying the real server every MULTICIV_RETRY_MS — when a retry stays
// up long enough it hands the port back automatically. Uses ONLY Node built-ins
// so it cannot fail for a missing dependency; every error path logs and retries
// rather than throwing.
//
//   node tools/serve-maintenance.js [server args...]
//     e.g. node tools/serve-maintenance.js --port 8123 --civs 4
//
// Env:
//   MAINTENANCE_CONTACT   shown on the page when set (email / discord / URL)
//   MULTICIV_MAX_FAILURES consecutive non-zero exits before the page (default 3)
//   MULTICIV_RETRY_MS     how often to retry the real server once down (60000)
//   MULTICIV_STABILIZE_MS uptime that counts as "recovered" (10000)
'use strict';
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const serverArgs = process.argv.slice(2);
// the entrypoint to supervise; overridable for alternate deployments/tests
const SERVER = process.env.MULTICIV_SERVER_ENTRY
  ? path.resolve(process.env.MULTICIV_SERVER_ENTRY)
  : path.join(__dirname, '..', 'server', 'index.js');

function intEnv(name, def) {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : def;
}
const MAX_FAILURES = intEnv('MULTICIV_MAX_FAILURES', 3);
const RETRY_MS = intEnv('MULTICIV_RETRY_MS', 60000);
const STABILIZE_MS = intEnv('MULTICIV_STABILIZE_MS', 10000);
const CONTACT = (process.env.MAINTENANCE_CONTACT || '').trim();

// the port the real server uses (so the maintenance page binds the same one)
function parsePort(args) {
  const i = args.indexOf('--port');
  if (i !== -1 && args[i + 1] !== undefined) {
    const p = Number(args[i + 1]);
    if (Number.isInteger(p) && p > 0) return p;
  }
  return 8123;
}
const PORT = parsePort(serverArgs);

function log(msg) {
  console.log(`[watchdog ${new Date().toISOString()}] ${msg}`);
}

// --- the maintenance page (only served while the real server is down) --------
function contactHtml() {
  if (!CONTACT) return '';
  // escape the operator-provided contact before it touches the page
  const esc = CONTACT.replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<p class="contact">Questions? <strong>${esc}</strong></p>`;
}
function maintenancePage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RetroMultiCiv — down for maintenance</title>
<style>
  body { margin:0; background:#10131a; color:#dfe6f2;
    font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;
    display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { max-width:460px; padding:36px; text-align:center; }
  h1 { color:#e8c15a; font-size:24px; margin:0 0 12px; }
  p { color:#9aa6bd; margin:8px 0; }
  .contact strong { color:#dfe6f2; }
</style></head>
<body><div class="card">
  <h1>Down for maintenance</h1>
  <p>The RetroMultiCiv server is temporarily unavailable and will be back soon.</p>
  ${contactHtml()}
</div></body></html>`;
}

// --- supervisor state --------------------------------------------------------
let child = null;
let maint = null;          // the maintenance http.Server, when down
let consecutiveFailures = 0;
let shuttingDown = false;

function startServer() {
  if (shuttingDown) return;
  log(`starting server: node ${SERVER} ${serverArgs.join(' ')}`);
  const startedAt = Date.now();
  child = spawn(process.execPath, [SERVER, ...serverArgs], { stdio: 'inherit' });

  child.on('error', err => {
    // spawn itself failed (e.g. node missing) — treat as a crash
    log(`spawn error: ${err.message}`);
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;
    const uptime = Date.now() - startedAt;
    if (code === 0 && signal === null) {
      log('server exited cleanly (code 0) — stopping the watchdog too');
      process.exit(0);
    }
    // a server that ran a good while then died is a FRESH incident
    if (uptime >= STABILIZE_MS) consecutiveFailures = 0;
    consecutiveFailures++;
    log(`server exited (code ${code}, signal ${signal}) after ${Math.round(uptime / 1000)}s`
      + ` — failure ${consecutiveFailures}/${MAX_FAILURES}`);
    if (consecutiveFailures >= MAX_FAILURES) {
      serveMaintenance();
      scheduleRetry();
    } else {
      setTimeout(startServer, 1000); // brief backoff, then respawn
    }
  });
}

function serveMaintenance() {
  if (maint) return; // already up
  const page = maintenancePage();
  maint = http.createServer((req, res) => {
    res.writeHead(503, {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(Math.ceil(RETRY_MS / 1000))
    });
    res.end(page);
  });
  maint.on('error', err => {
    // most likely the port is still held (a lingering child) — log, drop it,
    // and let the retry loop try again; never throw
    log(`maintenance page could not bind :${PORT} (${err.code || err.message})`);
    maint = null;
  });
  maint.listen(PORT, () => log(`serving maintenance page on :${PORT}`));
}

function closeMaintenance(done) {
  if (!maint) return done();
  const s = maint;
  maint = null;
  s.close(() => done());
}

function scheduleRetry() {
  setTimeout(() => {
    if (shuttingDown) return;
    log('retrying the real server…');
    closeMaintenance(startServer); // free the port before the child rebinds it
  }, RETRY_MS);
}

// --- clean shutdown ----------------------------------------------------------
function shutdown(sig) {
  shuttingDown = true;
  log(`received ${sig} — shutting down`);
  if (child) child.kill(sig);
  closeMaintenance(() => process.exit(0));
  // safety: exit even if close hangs
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
