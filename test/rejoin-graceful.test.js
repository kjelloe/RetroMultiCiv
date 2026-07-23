// The rejoin card must fail GRACEFULLY: a definitive server answer (game ended
// / gone) downgrades to a plain notice and clears the stored record; a
// non-definitive code (network hiccup, unknown) must NOT be treated as
// definitive (so a still-valid game is never wiped). And session-remote must
// carry the reject CODE on the error, not surface a raw "join rejected" string.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

test('classifyRejoinReject: gameEnded / noSuchGame are DEFINITIVE, others are not', async () => {
  const { classifyRejoinReject } = await import('../client/ui/rejoin.js');
  const ended = classifyRejoinReject('gameEnded');
  assert.strictEqual(ended.definitive, true);
  assert.strictEqual(ended.offerEnd, true);
  assert.match(ended.label, /ENDED/);

  const gone = classifyRejoinReject('noSuchGame');
  assert.strictEqual(gone.definitive, true);
  assert.strictEqual(gone.offerEnd, false);

  // non-definitive: a transient/unknown code must never be treated as a
  // definitive server answer (the caller keeps its record + normal error path)
  for (const code of ['socketError', 'tooFast', 'blocked', 'notStarted', undefined, '']) {
    assert.strictEqual(classifyRejoinReject(code).definitive, false, `${code} is not definitive`);
  }
});

// a mock WebSocket matching session-remote's usage (open/message/close/error,
// send, readyState, WebSocket.OPEN, JSON frames) — mirrors session-remote-offturn
class MockWS {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this._l = {}; MockWS.last = this; setTimeout(() => this._l.open && this._l.open(), 0); }
  addEventListener(ev, cb) { this._l[ev] = cb; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this._l.close && this._l.close(); }
  recv(obj) { this._l.message && this._l.message({ data: JSON.stringify(obj) }); }
}
MockWS.OPEN = 1;
const tick = () => new Promise(r => setTimeout(r, 0));
const memLocal = () => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; };

test('a join reject carries the CODE on the error (not a raw string)', async () => {
  global.WebSocket = MockWS;
  global.localStorage = memLocal();
  const { createRemoteSession } = await import('../client/session-remote.js');
  const p = createRemoteSession({ ruleset: RULESET, wsUrl: 'ws://mock', name: 'B', gameId: 'g1' });
  await tick(); // 'open' → join frame sent
  MockWS.last.recv({ t: 'rejected', commandId: -1, code: 'noSuchGame' });
  await assert.rejects(p, err => {
    assert.strictEqual(err.joinRejected, true, 'flagged as a join reject');
    assert.strictEqual(err.code, 'noSuchGame', 'the server code is carried');
    return true;
  });
});

test('a gameEnded reject carries the gameId + gameCode (for the final-result fetch)', async () => {
  global.WebSocket = MockWS;
  global.localStorage = memLocal();
  const { createRemoteSession } = await import('../client/session-remote.js');
  const p = createRemoteSession({ ruleset: RULESET, wsUrl: 'ws://mock', name: 'B', gameId: 'g1' });
  await tick();
  // the exact server contract (server/index.js:868)
  MockWS.last.recv({ t: 'rejected', commandId: -1, code: 'gameEnded', gameId: 'g1', gameCode: 'ABCDE' });
  await assert.rejects(p, err => {
    assert.strictEqual(err.code, 'gameEnded');
    assert.strictEqual(err.gameId, 'g1');
    assert.strictEqual(err.gameCode, 'ABCDE');
    return true;
  });
});

test('loadFinalResult: fetches the ended save by gameId, stashes it, and boots ?resume=local', async () => {
  const { loadFinalResult } = await import('../client/ui/rejoin.js');
  const calls = { stored: {}, nav: null, fetched: null };
  const io = {
    fetchJson: url => { calls.fetched = url; return Promise.resolve({ format: 'retromulticiv-server-save', state: { gameOver: true, turn: 42, winner: 'p1' } }); },
    setItem: (k, v) => { calls.stored[k] = v; },
    navigate: s => { calls.nav = s; }
  };
  const ok = await loadFinalResult('g1', 'http://host:8123', io);
  assert.strictEqual(ok, true);
  assert.strictEqual(calls.fetched, 'http://host:8123/saves/g1.json');
  assert.ok(calls.stored.rmc_local_autosave, 'the final state is stashed for the resume boot');
  assert.strictEqual(JSON.parse(calls.stored.rmc_local_autosave).state.winner, 'p1');
  assert.strictEqual(calls.nav, '?resume=local');
});

test('loadFinalResult: a non-finished / missing save does NOT navigate (graceful)', async () => {
  const { loadFinalResult } = await import('../client/ui/rejoin.js');
  let navd = false;
  const io = { fetchJson: () => Promise.resolve(null), setItem: () => {}, navigate: () => { navd = true; } };
  assert.strictEqual(await loadFinalResult('g1', '', io), false, 'missing save → false');
  assert.strictEqual(navd, false, 'never navigates on a missing save');
  const io2 = { fetchJson: () => Promise.resolve({ state: { gameOver: false } }), setItem: () => {}, navigate: () => { navd = true; } };
  assert.strictEqual(await loadFinalResult('g1', '', io2), false, 'a still-running game → false');
  assert.strictEqual(navd, false);
});
