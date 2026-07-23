// late-join §4: a takeover joiner's `joined` answer carries `assignedCiv` (the AI
// civ the server handed it, §3). session-remote captures it → session.assignedCiv,
// which main.js reads to show the post-join reveal banner. Driven with a mock
// WebSocket (no server) — the exact join protocol session-remote speaks. The DOM
// banner itself is boot-time (a live takeover is the integration realm).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

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
const view = () => ({
  you: 'p3', activePlayer: 'p1', turn: 42, playerOrder: ['p1', 'p2', 'p3'],
  players: { p1: { id: 'p1' }, p2: { id: 'p2' }, p3: { id: 'p3' } },
  cities: {}, units: {}, wonders: {},
  map: { width: 2, height: 2, wrapX: false, tiles: [{ t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }] }
});

async function join(joinedExtra) {
  global.WebSocket = MockWS;
  global.localStorage = memLocal();
  const { createRemoteSession } = await import('../client/session-remote.js');
  const p = createRemoteSession({ ruleset: RULESET, wsUrl: 'ws://mock', name: 'Late' });
  await tick();
  MockWS.last.recv(Object.assign({ t: 'joined', playerId: 'p3', gameId: 'g1', token: 'tok', view: view() }, joinedExtra));
  return p;
}

test('§4: a takeover joined answer sets session.assignedCiv', async () => {
  const session = await join({ assignedCiv: 'zulus' });
  assert.strictEqual(session.assignedCiv, 'zulus');
});

test('§4: an ordinary joined answer leaves assignedCiv null (no reveal)', async () => {
  const session = await join({}); // no assignedCiv
  assert.strictEqual(session.assignedCiv, null);
});
