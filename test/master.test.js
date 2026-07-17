// A51a: the master-index service (tools/master.js) — announce/list round-trip,
// probe-gated listing, the anti-relay address guard, TTL delisting, rate
// limit, size cap. All over real HTTP against an ephemeral port; the probe and
// the clock are injected.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const { createMaster, isPublicAddress, TTL_MS, MIN_ANNOUNCE_GAP_MS } = require('../tools/master.js');

function post(port, path, body, ip) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST' }, res => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(out || '{}') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, res => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(out || '{}') }));
    }).on('error', reject);
  });
}

const ANNOUNCE = over => JSON.stringify(Object.assign({
  name: "Kjell's Friday server", host: '203.0.113.7', port: 8123,
  protocolVersion: '1', dataHashes: { rules: 123 }, openGames: 2
}, over || {}));

test('announce → probe pass → listed; the listing carries the entry + CORS', async () => {
  let t = 1000000;
  const m = createMaster({ now: () => t, probe: async () => true });
  const port = await m.listen(0);
  try {
    const a = await post(port, '/announce', ANNOUNCE());
    assert.strictEqual(a.status, 200);
    assert.deepStrictEqual(a.body, { ok: true, listed: true });
    const l = await get(port, '/servers');
    assert.strictEqual(l.headers['access-control-allow-origin'], '*', 'the client is a static page from anywhere');
    assert.strictEqual(l.body.servers.length, 1);
    const s = l.body.servers[0];
    assert.strictEqual(s.name, "Kjell's Friday server");
    assert.strictEqual(s.host, '203.0.113.7');
    assert.strictEqual(s.openGames, 2);
    assert.deepStrictEqual(s.dataHashes, { rules: 123 });
  } finally { await m.close(); }
});

test('probe failure holds the entry OFF the list, with the reason for the announcer', async () => {
  let t = 1000000;
  const m = createMaster({ now: () => t, probe: async () => false });
  const port = await m.listen(0);
  try {
    const a = await post(port, '/announce', ANNOUNCE());
    assert.strictEqual(a.body.ok, true);
    assert.strictEqual(a.body.listed, false);
    assert.match(a.body.reason, /unreachable/, 'the announcer can surface the why');
    const l = await get(port, '/servers');
    assert.deepStrictEqual(l.body.servers, [], 'held off the list');
  } finally { await m.close(); }
});

test('anti-relay guard: loopback/private/link-local announces are refused BEFORE any probe', async () => {
  let probed = 0;
  let t = 1000000;
  const m = createMaster({ now: () => t, probe: async () => { probed++; return true; } });
  const port = await m.listen(0);
  try {
    for (const host of ['127.0.0.1', 'localhost', '10.1.2.3', '172.16.0.9', '192.168.1.4', '169.254.0.5', 'fe80::1', 'fc00::2', '::1']) {
      const a = await post(port, '/announce', ANNOUNCE({ host }));
      assert.strictEqual(a.body.listed, false, `${host} must not list`);
      assert.match(a.body.reason, /publicly routable/, `${host} gets the address reason`);
      t += MIN_ANNOUNCE_GAP_MS + 1; // stay under the rate floor between hosts
    }
    assert.strictEqual(probed, 0, 'the probe NEVER fires for non-public addresses (no relay)');
    // pure-function spot checks incl. the public side
    assert.ok(isPublicAddress('203.0.113.7'));
    assert.ok(isPublicAddress('play.example.org'), 'DNS hostnames pass in v1 (resolution check = follow-up)');
    assert.ok(!isPublicAddress('172.31.255.1'));
    assert.ok(isPublicAddress('172.32.0.1'), 'the 172 private band ends at .31');
  } finally { await m.close(); }
});

test('allowPrivate (the local test harness escape hatch) lists a loopback announce', async () => {
  const m = createMaster({ allowPrivate: true, probe: async () => true });
  const port = await m.listen(0);
  try {
    const a = await post(port, '/announce', ANNOUNCE({ host: '127.0.0.1' }));
    assert.strictEqual(a.body.listed, true);
  } finally { await m.close(); }
});

test('TTL: no heartbeat past the window → the sweep delists', async () => {
  let t = 1000000;
  const m = createMaster({ now: () => t, probe: async () => true });
  const port = await m.listen(0);
  try {
    await post(port, '/announce', ANNOUNCE());
    assert.strictEqual((await get(port, '/servers')).body.servers.length, 1);
    t += TTL_MS + 1000; // silence past the TTL
    m.sweep();
    assert.strictEqual((await get(port, '/servers')).body.servers.length, 0, 'delisted');
    // a fresh heartbeat re-lists within a minute of a master restart — same path
    await post(port, '/announce', ANNOUNCE());
    assert.strictEqual((await get(port, '/servers')).body.servers.length, 1);
  } finally { await m.close(); }
});

test('per-IP rate floor: a hammered /announce gets 429, the heartbeat cadence never does', async () => {
  let t = 1000000;
  const m = createMaster({ now: () => t, probe: async () => true });
  const port = await m.listen(0);
  try {
    assert.strictEqual((await post(port, '/announce', ANNOUNCE())).status, 200);
    const fast = await post(port, '/announce', ANNOUNCE());
    assert.strictEqual(fast.status, 429);
    assert.strictEqual(fast.body.reason, 'tooFast');
    t += 60 * 1000; // the ~60s heartbeat
    assert.strictEqual((await post(port, '/announce', ANNOUNCE())).status, 200);
  } finally { await m.close(); }
});

test('size cap: an oversized announce is cut off with 413', async () => {
  const m = createMaster({ probe: async () => true });
  const port = await m.listen(0);
  try {
    const r = await post(port, '/announce', ANNOUNCE({ name: 'x'.repeat(8000) }));
    assert.strictEqual(r.status, 413);
    assert.strictEqual(r.body.reason, 'tooLarge');
    const l = await get(port, '/servers');
    assert.deepStrictEqual(l.body.servers, [], 'nothing listed from the oversized announce');
  } finally { await m.close(); }
});
