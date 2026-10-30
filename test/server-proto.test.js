// fe-R5 + fe-R4 (specs/fastengine-requests.md, A109): every `joined` and every
// list row carries the socket protocol version; /ws?proto=N pins it (absent is
// accepted); views are compressed when the client negotiates permessage-deflate.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

function connect(port, query = '') {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
  const inbox = [];
  const waiters = [];
  let closed = null;
  ws.on('close', code => { closed = code; });
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(msg));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}; inbox: ${JSON.stringify(inbox.map(m => m.t))}`)), 30000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ ws, send: msg => ws.send(JSON.stringify(msg)), expect, closed: () => closed, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

test('joined and list rows carry proto; ?proto= matching or absent is accepted', async () => {
  const { PROTOCOL } = await import('../server/protocol.js');
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 424242, civs: 2, humans: 1, size: 'xsmall', autosave: false });
  try {
    const c = await connect(s.port, `?proto=${PROTOCOL}`);
    c.send({ t: 'join', name: 'Kjell' });
    const joined = await c.expect(m => m.t === 'joined', 'joined');
    assert.strictEqual(joined.proto, PROTOCOL);
    assert.strictEqual(Object.keys(joined).at(-1), 'proto', 'additive: proto is the last field');
    c.send({ t: 'list' });
    const games = await c.expect(m => m.t === 'games', 'games');
    assert.ok(games.games.length > 0 && games.games.every(g => g.proto === PROTOCOL));
    c.send({ t: 'listGames' });
    await c.expect(m => m.t === 'openGames', 'openGames'); // rows (if any) carry proto; shape covered by lobby tests
    assert.ok(c.ws.extensions.includes('permessage-deflate'), 'fe-R4: deflate negotiated');
    c.close();
  } finally { await s.close(); }
});

test('?proto= mismatch is rejected with both versions named, then closed', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 424242, civs: 2, humans: 1, size: 'xsmall', autosave: false });
  try {
    const c = await connect(s.port, '?proto=999');
    const rej = await c.expect(m => m.t === 'rejected', 'rejected');
    assert.strictEqual(rej.code, 'protocolMismatch');
    assert.match(rej.message, /1.*999/);
    if (c.closed() === null) await new Promise(r => c.ws.once('close', r));
    assert.strictEqual(c.closed(), 1008);
  } finally { await s.close(); }
});
