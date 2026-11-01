// fe-R13 + fe-R2 (specs/fastengine-requests.md, A107): client text that would
// reach game state must be printable ASCII (statehash.js canonical() throws on
// anything else and used to take the whole process down), engine-internal
// command types are refused at the socket, and a throw inside one frame's
// handling answers `internal` instead of ending the server.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const RULESET = require('./ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
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
    ws.on('open', () => resolve({ send: msg => ws.send(JSON.stringify(msg)), expect, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

test('parseMessage: non-ASCII names and command strings are refused at the door', async () => {
  const { parseMessage } = await import('../server/protocol.js');
  const p = o => parseMessage(JSON.stringify(o));
  for (const name of ['Åse', '\ud800', 'tab\there']) {
    assert.strictEqual(p({ t: 'join', name }).code, 'badName', `join ${JSON.stringify(name)}`);
    assert.strictEqual(p({ t: 'create', name }).code, 'badName', `create ${JSON.stringify(name)}`);
    assert.strictEqual(p({ t: 'joinListed', gameId: 'g', name }).code, 'badName', `joinListed ${JSON.stringify(name)}`);
  }
  assert.strictEqual(p({ t: 'join' }).code, 'badName', 'a missing name is still badName, not a throw');
  assert.strictEqual(p({ t: 'join', name: 'Ase' }).ok, true);
  const cmd = c => p({ t: 'cmd', token: 'x', commandId: 1, cmd: c });
  assert.strictEqual(cmd({ type: 'foundCity', unitId: 'u1', name: 'Åse' }).code, 'badShape');
  assert.strictEqual(cmd({ type: 'foundCity', unitId: 'u1', name: 'x'.repeat(25) }).code, 'badShape', 'city name length bound');
  assert.strictEqual(cmd({ type: 'diplomacy', payload: { note: ['ok', 'Ø'] } }).code, 'badShape', 'nested strings too');
  // A116: a float or null would sit in state and throw at the next hash
  assert.strictEqual(cmd({ type: 'setRates', tax: 50.5, sci: 49.5 }).code, 'badShape', 'a float');
  assert.strictEqual(cmd({ type: 'wait', unitId: null }).code, 'badShape', 'null');
  assert.strictEqual(cmd({ type: 'setRates', tax: 60, sci: 40 }).ok, true, 'integers pass');
  assert.strictEqual(cmd({ type: 'foundCity', unitId: 'u1', name: 'Ase' }).ok, true);
  assert.strictEqual(p({ t: 'create', name: 'Host', options: { maptype: 'Å' } }).code, 'badShape');
});

test('parseMessage: claimSeat is server-only (notAllowed over the socket)', async () => {
  const { parseMessage } = await import('../server/protocol.js');
  const r = parseMessage(JSON.stringify({ t: 'cmd', token: 'x', commandId: 1, cmd: { type: 'claimSeat', player: 'p2' } }));
  assert.strictEqual(r.code, 'notAllowed');
});

test('every engine command type is classified client-sendable or server-only', async () => {
  const { CLIENT_COMMANDS, SERVER_ONLY_COMMANDS } = await import('../server/protocol.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'engine', 'index.js'), 'utf8');
  const types = [...src.matchAll(/cmd\.type === '(\w+)'\) result =/g)].map(m => m[1]);
  assert.ok(types.length > 20, 'found the engine dispatch table');
  for (const t of types) {
    const n = (CLIENT_COMMANDS.includes(t) ? 1 : 0) + (SERVER_ONLY_COMMANDS.includes(t) ? 1 : 0);
    assert.strictEqual(n, 1, `engine command "${t}" must be in exactly one of CLIENT_COMMANDS / SERVER_ONLY_COMMANDS`);
  }
});

test('socket: claimSeat refused, non-ASCII city refused, a handler throw is contained', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 424242, civs: 2, humans: 1, size: 'xsmall', autosave: false });
  try {
    const c = await connect(s.port);
    c.send({ t: 'join', name: 'Kjell' });
    const joined = await c.expect(m => m.t === 'joined', 'joined');
    const { token } = joined;

    c.send({ t: 'cmd', token, commandId: 1, cmd: { type: 'claimSeat', player: 'p2' } });
    assert.strictEqual((await c.expect(m => m.t === 'rejected', 'claimSeat rejected')).code, 'notAllowed');
    assert.strictEqual(s.game.state.players.p2.human, false, 'the AI seat stays AI');

    const settlers = Object.values(joined.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    c.send({ t: 'cmd', token, commandId: 2, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Åse' } });
    assert.strictEqual((await c.expect(m => m.t === 'rejected', 'foundCity rejected')).code, 'badShape');

    const realApply = s.game.apply;
    s.game.apply = () => { throw new Error('forced fault'); };
    const realError = console.error;
    console.error = () => {};
    try {
      c.send({ t: 'cmd', token, commandId: 3, cmd: { type: 'wait', unitId: settlers.id } });
      assert.strictEqual((await c.expect(m => m.t === 'rejected', 'contained')).code, 'internal');
    } finally { s.game.apply = realApply; console.error = realError; }

    c.send({ t: 'ping' });
    await c.expect(m => m.t === 'pong', 'server still answering after the fault');
    c.close();
  } finally { await s.close(); }
});

test('socket: lobby join under a non-ASCII name is refused before it can reach state', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const guest = await connect(s.port);
    guest.send({ t: 'join', joinCode: created.joinCode, name: 'Åse' });
    assert.strictEqual((await guest.expect(m => m.t === 'rejected', 'join rejected')).code, 'badName');
    host.close(); guest.close();
  } finally { await s.close(); }
});
