// XIV §31: the session-remote OFF-TURN QUEUE (mirror of the local A54) — a
// whitelisted self-scoped command issued when it is NOT my turn is HELD, then
// flushed the moment my turn starts. Driven with a mock WebSocket (no server):
// the exact protocol session-remote speaks (join → cmd/applied/view).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

// a mock WebSocket matching session-remote's usage (addEventListener open/
// message/close/error, send, readyState, WebSocket.OPEN, JSON frames)
class MockWS {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this._l = {}; MockWS.last = this; setTimeout(() => this._l.open && this._l.open(), 0); }
  addEventListener(ev, cb) { this._l[ev] = cb; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this._l.close && this._l.close(); }
  recv(obj) { this._l.message && this._l.message({ data: JSON.stringify(obj) }); }
  cmds() { return this.sent.filter(f => f.t === 'cmd'); }
}
MockWS.OPEN = 1;

const tick = () => new Promise(r => setTimeout(r, 0));
const memLocal = () => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; };
const view = active => ({
  you: 'p2', activePlayer: active, turn: 1, playerOrder: ['p1', 'p2'],
  players: { p1: { id: 'p1', name: 'A' }, p2: { id: 'p2', name: 'B', techs: [] } },
  cities: {}, units: {}, wonders: {},
  map: { width: 2, height: 2, wrapX: false, tiles: [{ t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }] }
});

async function joinAt(active) {
  global.WebSocket = MockWS;
  global.localStorage = memLocal();
  const { createRemoteSession } = await import('../client/session-remote.js');
  const p = createRemoteSession({ ruleset: RULESET, wsUrl: 'ws://mock', name: 'B' });
  const ws = MockWS.last;
  await tick(); // 'open' → join frame sent
  ws.recv({ t: 'joined', playerId: 'p2', gameId: 'g1', token: 'tok', view: view(active) });
  const session = await p;
  return { session, ws };
}

test('§31: an off-turn whitelisted cmd is QUEUED, then flushed at turn start', async () => {
  const { session, ws } = await joinAt('p1'); // NOT my turn (p1 active)
  assert.strictEqual(session.state.activePlayer, 'p1');
  session.apply({ type: 'setResearch', playerId: 'p2', tech: 'pottery' });
  assert.strictEqual(session.pendingOffturn, 1, 'off-turn setResearch is queued');
  assert.strictEqual(ws.cmds().length, 0, 'nothing is sent while off-turn');
  ws.recv({ t: 'view', view: view('p2') }); // my turn starts
  await tick(); await tick();
  assert.strictEqual(session.pendingOffturn, 0, 'the queue flushed');
  const cmds = ws.cmds();
  assert.ok(cmds.length >= 1 && cmds[0].cmd.type === 'setResearch', 'the queued setResearch was sent at turn start');
});

test('§31: a NON-whitelisted off-turn cmd is not queued (engine, not client, rejects)', async () => {
  const { session, ws } = await joinAt('p1');
  session.apply({ type: 'moveUnit', playerId: 'p2', unitId: 'u', dir: 'N' });
  assert.strictEqual(session.pendingOffturn, 0, 'moveUnit is never held client-side');
  assert.strictEqual(ws.cmds().length, 1, 'moveUnit is sent straight through');
});

test('§31: a whitelisted cmd on MY turn is sent immediately, not queued', async () => {
  const { session, ws } = await joinAt('p2'); // it IS my turn
  session.apply({ type: 'setResearch', playerId: 'p2', tech: 'pottery' });
  assert.strictEqual(session.pendingOffturn, 0, 'on-turn → not queued');
  assert.strictEqual(ws.cmds().length, 1, 'sent immediately');
});
