// A51b: the game server's --announce heartbeat against a REAL local master
// (tools/master.js with allowPrivate — the deployed guard rejects loopback).
// Asserts the announced payload (name, address, the eight ruleset hashes, the
// public-open-games count), the healthz route the master probes, and the
// held-reason surfacing when the master's probe fails.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const RULESET = require('./ruleset.js');
const { createMaster } = require('../tools/master.js');

const getJson = (port, path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path }, res => {
    let out = '';
    res.on('data', c => { out += c; });
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(out || '{}') }));
  }).on('error', reject);
});

const until = async (fn, label, ms) => {
  const deadline = Date.now() + (ms || 15000);
  for (;;) {
    const v = await fn();
    if (v) return v;
    assert.ok(Date.now() < deadline, `timeout: ${label}`);
    await new Promise(r => setTimeout(r, 100));
  }
};

test('A51b: the server announces, the master lists it with hashes + open-games count', async () => {
  const { startServer } = await import('../server/index.js');
  const { hashState } = await import('../shared/statehash.js');
  const master = createMaster({ allowPrivate: true, probe: async () => true });
  const masterPort = await master.listen(0);
  const s = await startServer({
    ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1',
    announce: `http://127.0.0.1:${masterPort}`, publicAddr: '127.0.0.1',
    publicName: 'Announce Test Server', announceIntervalMs: 500
  });
  try {
    // the /healthz the master probes answers on the game server
    const hz = await getJson(s.port, '/healthz');
    assert.strictEqual(hz.status, 200);
    assert.deepStrictEqual(hz.body, { ok: true });

    const listed = await until(async () => {
      const l = await getJson(masterPort, '/servers');
      return l.body.servers.length === 1 ? l.body.servers[0] : null;
    }, 'the server appears on the master list');
    assert.strictEqual(listed.name, 'Announce Test Server');
    assert.strictEqual(listed.host, '127.0.0.1');
    assert.strictEqual(listed.port, s.port, 'the advertised port defaults to the listen port');
    assert.strictEqual(listed.protocolVersion, '1');
    // the eight canonical ruleset hashes, same hashState both sides
    assert.deepStrictEqual(Object.keys(listed.dataHashes).sort(), Object.keys(RULESET).sort());
    assert.strictEqual(listed.dataHashes.rules, hashState(RULESET.rules));
    assert.strictEqual(listed.openGames, 0, 'no public games yet');
    assert.strictEqual(s.announceStatus().listed, true);
  } finally { await s.close(); await master.close(); }
});

test('A51b: a failing master probe holds the listing and the server surfaces the reason', async () => {
  const { startServer } = await import('../server/index.js');
  const master = createMaster({ allowPrivate: true, probe: async () => false });
  const masterPort = await master.listen(0);
  const s = await startServer({
    ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1',
    announce: `http://127.0.0.1:${masterPort}`, publicAddr: '127.0.0.1', announceIntervalMs: 500
  });
  try {
    await until(async () => s.announceStatus().listed === false && s.announceStatus().reason !== null,
      'the held reason reaches announceStatus');
    assert.match(s.announceStatus().reason, /unreachable/, 'the operator sees the why');
    const l = await getJson(masterPort, '/servers');
    assert.deepStrictEqual(l.body.servers, [], 'held off the list');
  } finally { await s.close(); await master.close(); }
});

test('A51b: --announce without --public-addr fails loudly at boot', async () => {
  const { startServer } = await import('../server/index.js');
  await assert.rejects(
    async () => startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', announce: 'http://127.0.0.1:1' }),
    /--public-addr/);
});
