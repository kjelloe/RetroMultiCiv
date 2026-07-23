// master-proxy (reviewer #2446): a self-hosted box that announces to a master
// serves the server list SAME-ORIGIN via GET /master/servers -> the game server
// fetches the configured master's /servers and passes the JSON through. SSRF-safe
// (only the --announce URL, never caller-supplied). 404 masterNotConfigured when
// no master is set; 502 on a dead master.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const RULESET = require('./ruleset.js');

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

// a stand-in master: /servers returns a list; /announce (the game's heartbeat) is a no-op
function mockMaster(serversPayload) {
  const srv = http.createServer((req, res) => {
    if (req.url === '/servers') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(serversPayload)); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"listed":true}');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

test('GET /master/servers proxies the configured master\'s list (same-origin, no CORS)', async () => {
  const { startServer } = await import('../server/index.js');
  const master = await mockMaster([{ name: 'Friday', host: 'x.example', port: 8123, openGames: 2 }]);
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1',
    announce: `http://127.0.0.1:${master.port}`, publicAddr: '127.0.0.1:9999' });
  try {
    const r = await get(s.port, '/master/servers');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'application/json');
    assert.strictEqual(r.headers['cache-control'], 'no-store');
    const list = JSON.parse(r.body);
    assert.ok(Array.isArray(list) && list.length === 1 && list[0].name === 'Friday', 'the master list is passed through verbatim');
  } finally { await s.close(); master.srv.close(); }
});

test('GET /master/servers -> 404 masterNotConfigured when no --master is set', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const r = await get(s.port, '/master/servers');
    assert.strictEqual(r.status, 404);
    assert.strictEqual(JSON.parse(r.body).reason, 'masterNotConfigured', 'the helper error text keys off this reason');
  } finally { await s.close(); }
});

test('GET /master/servers -> 502 when the configured master is unreachable', async () => {
  const { startServer } = await import('../server/index.js');
  // announce points at a closed port -> the proxy fetch fails
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1',
    announce: 'http://127.0.0.1:1', publicAddr: '127.0.0.1:9999' });
  try {
    const r = await get(s.port, '/master/servers');
    assert.strictEqual(r.status, 502);
    assert.ok(['masterUnreachable', 'masterError'].includes(JSON.parse(r.body).reason));
  } finally { await s.close(); }
});
