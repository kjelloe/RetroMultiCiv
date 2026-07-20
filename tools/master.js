// A51 (docs/12 §6): the MASTER INDEX — a bulletin board, not a broker. Game
// servers announce themselves here over plain HTTP; players' clients fetch the
// listing and connect DIRECTLY to a chosen host. Game traffic never touches
// this process. Plain node, zero dependencies, in-memory registry — a restart
// just means hosts re-announce within a heartbeat.
//
//   node tools/master.js [--port 8200] [--host 0.0.0.0]
//     --host binds the listener; default 0.0.0.0. Use 127.0.0.1 to keep the
//     index off the public interface (behind a reverse proxy / firewall).
//
// Protocol:
//   POST /announce  {name, host, port, protocolVersion, dataHashes, openGames}
//     -> {ok, listed, reason?}   (listed:false + reason while the probe holds
//        the entry off the list — the announcer surfaces the reason)
//   GET  /servers   -> {servers:[{name, host, port, protocolVersion,
//        dataHashes, openGames, ageSeconds}]}  (listed entries only; CORS *)
//
// Validation (the classic master behavior): on first announce — and again
// when the last probe is stale — the master probes the ADVERTISED address
// (GET /healthz, any HTTP response counts as reachable; a connect error does
// not). Dead listings were the old master lists' curse; they die at the door.
// No heartbeat for TTL_MS → delisted by the sweep.
const http = require('http');

const TTL_MS = 3 * 60 * 1000;        // no heartbeat this long -> delisted
const REPROBE_MS = 5 * 60 * 1000;    // periodic revalidation cadence
const MIN_ANNOUNCE_GAP_MS = 5 * 1000; // per-IP announce rate floor (heartbeat is ~60s)
const MAX_BODY = 4096;               // an entry is a few hundred bytes; cap hard
const MAX_NAME = 80;

// Address-scope guard (#1077 note 2): the master must only ever PROBE
// publicly routable addresses — otherwise an announcer can aim the probe at
// an internal address and use the index as an outbound request relay. Reject
// loopback (127/8, ::1, localhost), private (10/8, 172.16/12, 192.168/16,
// fc00::/7), and link-local (169.254/16, fe80::/10) as LITERALS; hostname
// resolution checks are a hardening-lane follow-up (flagged). Refused hosts
// are held off-list with the reason, like unreachable ones.
function isPublicAddress(host) {
  const h = String(host).toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '[::1]') return false;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 0) return false;
    return true;
  }
  const bare = h.replace(/^\[|\]$/g, '');
  if (bare.includes(':')) { // IPv6 literal
    if (bare.startsWith('fc') || bare.startsWith('fd')) return false; // fc00::/7
    if (bare.startsWith('fe8') || bare.startsWith('fe9')
      || bare.startsWith('fea') || bare.startsWith('feb')) return false; // fe80::/10
    return true;
  }
  return true; // a DNS hostname: allowed in v1 (resolution check = follow-up)
}

// default reachability probe: any HTTP response from the advertised address
// proves the host answers from here; only a connect/timeout failure holds it.
function httpProbe(host, port) {
  return new Promise(resolve => {
    const req = http.get({ host, port, path: '/healthz', timeout: 3000 }, res => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function createMaster(opts) {
  opts = opts || {};
  const now = opts.now || Date.now;
  const probe = opts.probe || httpProbe;
  const registry = {};   // "host:port" -> entry
  const lastAnnounceByIp = {};

  function sweep(t) {
    const cut = (t !== undefined ? t : now()) - TTL_MS;
    for (const key of Object.keys(registry)) {
      if (registry[key].lastSeen < cut) delete registry[key];
    }
  }

  async function handleAnnounce(body, ip) {
    const t = now();
    if (lastAnnounceByIp[ip] !== undefined && t - lastAnnounceByIp[ip] < MIN_ANNOUNCE_GAP_MS) {
      return { status: 429, out: { ok: false, reason: 'tooFast' } };
    }
    lastAnnounceByIp[ip] = t;
    let a;
    try { a = JSON.parse(body); } catch (e) { return { status: 400, out: { ok: false, reason: 'badJson' } }; }
    if (typeof a.host !== 'string' || a.host === '' || !Number.isInteger(a.port)) {
      return { status: 400, out: { ok: false, reason: 'badAddress' } };
    }
    // the anti-relay guard runs BEFORE any probe (opts.allowPrivate is the
    // local test harness's escape hatch — never set in a deployed master)
    if (!opts.allowPrivate && !isPublicAddress(a.host)) {
      return { status: 200, out: { ok: true, listed: false,
        reason: 'not a publicly routable address — the index only lists public hosts' } };
    }
    const key = `${a.host}:${a.port}`;
    const prior = registry[key];
    const entry = {
      name: String(a.name || key).slice(0, MAX_NAME),
      host: a.host, port: a.port,
      protocolVersion: String(a.protocolVersion || ''),
      dataHashes: a.dataHashes && typeof a.dataHashes === 'object' ? a.dataHashes : {},
      openGames: Number.isInteger(a.openGames) ? a.openGames : 0,
      lastSeen: t,
      listed: prior ? prior.listed : false,
      reason: prior ? prior.reason : 'probePending',
      lastProbe: prior ? prior.lastProbe : 0
    };
    registry[key] = entry;
    if (entry.lastProbe === 0 || t - entry.lastProbe > REPROBE_MS) {
      entry.lastProbe = t;
      const reachable = await probe(a.host, a.port);
      // re-read: the sweep may have removed the entry while the probe ran
      if (registry[key] === entry) {
        entry.listed = reachable;
        entry.reason = reachable ? '' :
          'unreachable from the master — check port forwarding / firewall';
      }
    }
    return { status: 200, out: { ok: true, listed: entry.listed, reason: entry.reason || undefined } };
  }

  function listServers() {
    sweep();
    const t = now();
    const servers = [];
    for (const key of Object.keys(registry).sort()) {
      const e = registry[key];
      if (!e.listed) continue;
      servers.push({
        name: e.name, host: e.host, port: e.port,
        protocolVersion: e.protocolVersion, dataHashes: e.dataHashes,
        openGames: e.openGames, ageSeconds: Math.floor((t - e.lastSeen) / 1000)
      });
    }
    return { servers };
  }

  const server = http.createServer((req, res) => {
    const reply = (status, obj, cors) => {
      const headers = { 'Content-Type': 'application/json' };
      if (cors) headers['Access-Control-Allow-Origin'] = '*'; // the client is a static page from anywhere
      res.writeHead(status, headers);
      res.end(JSON.stringify(obj));
    };
    if (req.method === 'POST' && req.url === '/announce') {
      let body = '';
      let total = 0;
      let dropped = false;
      req.on('data', chunk => {
        total += chunk.length;
        if (total > 16 * MAX_BODY) { req.destroy(); return; } // hard abort on a flood
        if (dropped) return;
        body += chunk;
        if (body.length > MAX_BODY) { dropped = true; body = ''; } // discard, 413 at end
      });
      req.on('end', () => {
        if (dropped) { reply(413, { ok: false, reason: 'tooLarge' }); return; }
        const ip = req.socket.remoteAddress || '?';
        handleAnnounce(body, ip).then(r => reply(r.status, r.out));
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/servers') { reply(200, listServers(), true); return; }
    if (req.method === 'GET' && req.url === '/healthz') { reply(200, { ok: true }); return; }
    reply(404, { ok: false, reason: 'noSuchRoute' });
  });

  const sweeper = setInterval(() => sweep(), 30 * 1000);
  if (sweeper.unref) sweeper.unref();

  return {
    server, registry, sweep,
    listen(port, host) {
      return new Promise(resolve => server.listen(port || 0, host || '127.0.0.1', () => resolve(server.address().port)));
    },
    close() {
      clearInterval(sweeper);
      return new Promise(resolve => server.close(resolve));
    }
  };
}

if (require.main === module) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg !== -1 ? Number(process.argv[portArg + 1]) : 8200;
  // --host binds the listener (default 0.0.0.0, back-compat). Pass 127.0.0.1 to
  // keep the index off the public interface — defense-in-depth behind a reverse
  // proxy / firewall (#1894), so a flushed ufw doesn't leave :8200 world-open.
  const hostArg = process.argv.indexOf('--host');
  const host = hostArg !== -1 ? process.argv[hostArg + 1] : '0.0.0.0';
  createMaster().listen(port, host).then(p =>
    console.log(`master index listening on ${host}:${p} — POST /announce · GET /servers`));
}

module.exports = { createMaster, isPublicAddress, TTL_MS, REPROBE_MS, MIN_ANNOUNCE_GAP_MS };
