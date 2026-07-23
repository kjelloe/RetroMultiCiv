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

test('a gameEnded reject carries an attached final-record payload when the server provides one', async () => {
  global.WebSocket = MockWS;
  global.localStorage = memLocal();
  const { createRemoteSession } = await import('../client/session-remote.js');
  const p = createRemoteSession({ ruleset: RULESET, wsUrl: 'ws://mock', name: 'B', gameId: 'g1' });
  await tick();
  MockWS.last.recv({ t: 'rejected', commandId: -1, code: 'gameEnded', save: { turn: 42 } });
  await assert.rejects(p, err => {
    assert.strictEqual(err.code, 'gameEnded');
    assert.deepStrictEqual(err.save, { turn: 42 });
    return true;
  });
});
