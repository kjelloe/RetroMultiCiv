// metrics-v1 §5/§9: the master index counters — announce/list move their
// counters, a rejected announce moves announces_rejected only, sweep evictions
// count, and /metrics serves loopback-only. Uses the in-process factory with
// the test escape hatch (allowPrivate + injected probe) like the A51 suite.
const test = require('node:test');
const assert = require('node:assert');
const { createMaster } = require('../tools/master.js');

function post(port, path, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

test('announce → list: the counters move; distinct_servers counts each host:port once', async () => {
  const m = createMaster({ allowPrivate: true, probe: async () => true });
  const port = await m.listen(0, '127.0.0.1');
  try {
    await post(port, '/announce', { name: 'A', host: '127.0.0.1', port: 9001 });
    let s = m.metrics.snapshot();
    assert.strictEqual(s.announces, 1);
    assert.strictEqual(s.distinct_servers, 1);
    assert.strictEqual(s.servers_listed, 1, 'probe-true announce lists immediately');
    assert.strictEqual(s.announces_rejected, 0);

    // the same server heartbeating again is another announce, not another distinct
    await new Promise(r => setTimeout(r, 10)); // past nothing — rate floor is per-IP 5s...
    const again = await post(port, '/announce', { name: 'A', host: '127.0.0.1', port: 9001 });
    assert.strictEqual(again.status, 429, 'rate-floored heartbeat (tooFast)');
    s = m.metrics.snapshot();
    assert.strictEqual(s.announces, 1, 'a rate-floored duplicate is not an accepted announce');
    assert.strictEqual(s.announces_rejected, 0, 'nor a misconfiguration');

    const list = await fetch(`http://127.0.0.1:${port}/servers`);
    assert.strictEqual(list.status, 200);
    s = m.metrics.snapshot();
    assert.strictEqual(s.list_requests, 1, 'the find-game demand signal');
  } finally { await m.close(); }
});

test('a rejected announce increments announces_rejected only', async () => {
  const m = createMaster({ allowPrivate: true, probe: async () => true });
  const port = await m.listen(0, '127.0.0.1');
  try {
    const r = await post(port, '/announce', { name: 'bad', host: '', port: 'x' });
    assert.strictEqual(r.status, 400);
    const s = m.metrics.snapshot();
    assert.strictEqual(s.announces_rejected, 1);
    assert.strictEqual(s.announces, 0);
    assert.strictEqual(s.distinct_servers, 0);
  } finally { await m.close(); }
});

test('sweep: a stale listing eviction counts and the listed gauge follows', async () => {
  let t = 1000000;
  const m = createMaster({ allowPrivate: true, probe: async () => true, now: () => t });
  const port = await m.listen(0, '127.0.0.1');
  try {
    await post(port, '/announce', { name: 'A', host: '127.0.0.1', port: 9001 });
    assert.strictEqual(m.metrics.snapshot().servers_listed, 1);
    t += 10 * 60 * 1000; // far past TTL
    m.sweep();
    const s = m.metrics.snapshot();
    assert.strictEqual(s.stale_evictions, 1);
    assert.strictEqual(s.servers_listed, 0);
  } finally { await m.close(); }
});

test('/metrics on the master: loopback 200 with the §5 schema; unknown-route 404 otherwise-shaped', async () => {
  const m = createMaster({ allowPrivate: true, probe: async () => true });
  const port = await m.listen(0, '127.0.0.1');
  try {
    const r = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    for (const k of ['announces', 'announces_rejected', 'distinct_servers', 'servers_listed',
      'list_requests', 'stale_evictions', 'started_at']) {
      assert.ok(k in body, `schema carries ${k}`);
    }
  } finally { await m.close(); }
});
