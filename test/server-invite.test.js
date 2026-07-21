// A50 item 6: --invite-code closed-group gate. When set, the ws upgrade must
// carry ?invite=<code> matching the allowlist, rejected at the handshake before
// the socket is allocated. Empty = open (the default public posture).
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');

const RULESET = require('./ruleset.js');

// resolve to true if the ws OPENED, false if the handshake was refused
function tryConnect(port, urlPath) {
  return new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${urlPath}`);
    let done = false;
    const finish = v => { if (!done) { done = true; try { ws.close(); } catch (e) {} resolve(v); } };
    ws.on('open', () => finish(true));
    ws.on('error', () => finish(false));       // 401/verifyClient refusal surfaces as an error
    ws.on('unexpected-response', () => finish(false));
    setTimeout(() => finish(false), 2000);
  });
}

test('invite gate: refuses a ws upgrade without a valid ?invite= when set; accepts a good one', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1', inviteCodes: ['friday22'] });
  try {
    assert.strictEqual(await tryConnect(s.port, '/ws'), false, 'no invite -> refused');
    assert.strictEqual(await tryConnect(s.port, '/ws?invite=nope'), false, 'wrong invite -> refused');
    assert.strictEqual(await tryConnect(s.port, '/ws?invite=friday22'), true, 'valid invite -> connects');
  } finally { await s.close(); }
});

test('invite gate: wrong-invite attempts spend the connect-rate budget (brute-force throttle, #2143)', async () => {
  const { startServer } = await import('../server/index.js');
  // tiny per-IP connect budget so a burst of wrong-invite tries exhausts it:
  // the invite check runs AFTER allowConnect, so failed guesses are throttled.
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1', inviteCodes: ['secret'],
    limits: { connectsPerSec: 1, connectBurst: 3 } });
  try {
    // all refused (wrong code), but the first few consume the connect tokens…
    for (let i = 0; i < 3; i++) assert.strictEqual(await tryConnect(s.port, '/ws?invite=guess' + i), false);
    // …so even the CORRECT code is now connect-rate-limited: brute force can't
    // run free — an attacker's IP is throttled regardless of guessing.
    assert.strictEqual(await tryConnect(s.port, '/ws?invite=secret'), false,
      'connect-rate exhausted by the wrong-invite burst — the throttle bit');
  } finally { await s.close(); }
});

test('invite gate: OPEN by default (no --invite-code) — a bare /ws connects', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1' });
  try {
    assert.strictEqual(await tryConnect(s.port, '/ws'), true, 'no allowlist -> world-joinable');
  } finally { await s.close(); }
});
