// A50 item 5: /healthz is a first-class ops endpoint (the master index probes it)
// — liveness + an operational snapshot (games/conns/memory). Counts + process
// stats only: no secrets, no game state.
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

test('/healthz returns a first-class ops snapshot (JSON, no-store, real fields)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const r = await get(s.port, '/healthz');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'application/json');
    assert.strictEqual(r.headers['cache-control'], 'no-store');
    assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
    const h = JSON.parse(r.body);
    assert.strictEqual(h.ok, true);
    assert.strictEqual(typeof h.uptime_s, 'number');
    assert.ok(h.games >= 1, 'the boot game is counted');
    assert.strictEqual(h.conns, 0, 'no ws clients yet');
    assert.ok(h.rss_mb > 0 && typeof h.rss_mb === 'number');
    assert.ok(h.heap_pct >= 0 && h.heap_pct <= 100);
    // self-audit #2143: NO version/pid disclosure (fingerprinting), no secrets
    assert.ok(!('node' in h) && !('pid' in h), 'no version/pid fingerprinting');
    assert.ok(!('seats' in h) && !('tokens' in h) && !('saves' in h));
  } finally { await s.close(); }
});

test('healthSnapshot reflects live connection + game counts', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 6, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const before = s.healthSnapshot();
    assert.strictEqual(before.conns, 0);
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
    await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
    // give the server's connection handler a tick to register
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(s.healthSnapshot().conns, 1, 'the live socket is counted');
    ws.close();
  } finally { await s.close(); }
});
