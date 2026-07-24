// XVII §3 (spec specs/refinement-xvii.md): the pre-start lobby joining
// open/closed toggle, server half. Default OPEN: a joiner overflowing the human
// seats flips a free AI-configured seat (seat becomes the joiner's). Host-only
// setJoining closes it -> fresh joins reject with `joiningClosed`. The lobby
// broadcast carries a `joiningOpen` field (the client's toggle + reject copy).
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const RULESET = require('./ruleset.js');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(m));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  function expect(match, ms) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms || 3000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } }); });
  }
  return new Promise(resolve => ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() })));
}

test('§3 default OPEN: a joiner overflowing the human seats flips a free AI seat', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    // civs 3, humans 1 -> p1 human (host), p2/p3 AI-configured
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 3, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    assert.strictEqual(created.lobby.joiningOpen, true, 'joining defaults OPEN');

    // the only human seat is the host's -> the joiner takes an AI seat (flipped)
    const joiner = await client(s.port);
    joiner.send({ t: 'join', name: 'Bo', joinCode: created.joinCode });
    const jl = await joiner.expect(m => m.t === 'joinedLobby');
    assert.notStrictEqual(jl.seat, 'p1', 'did not take the host seat');
    const seat = jl.lobby.seats.find(x => x.seat === jl.seat);
    assert.strictEqual(seat.mode, 'open', 'the AI seat flipped to a human seat');
    assert.strictEqual(seat.reserved, true, 'and is reserved by the joiner');
    host.close(); joiner.close();
  } finally { await s.close(); }
});

test('§3 CLOSED: a host-closed lobby rejects a fresh join with joiningClosed', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 3, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');

    host.send({ t: 'setJoining', open: false });
    const lob = await host.expect(m => m.t === 'lobby');
    assert.strictEqual(lob.lobby.joiningOpen, false, 'the broadcast flips joiningOpen to false');

    const joiner = await client(s.port);
    joiner.send({ t: 'join', name: 'Bo', joinCode: created.joinCode });
    const j = await joiner.expect(m => m.t === 'joinedLobby' || m.t === 'rejected');
    assert.strictEqual(j.t, 'rejected');
    assert.strictEqual(j.code, 'joiningClosed', 'the reason contract for the client half');
    host.close(); joiner.close();
  } finally { await s.close(); }
});

test('§3 re-open: after re-opening, a fresh join is accepted again', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 3, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    host.send({ t: 'setJoining', open: false });
    await host.expect(m => m.t === 'lobby');
    host.send({ t: 'setJoining', open: true });
    const reopened = await host.expect(m => m.t === 'lobby' && m.lobby.joiningOpen === true);
    assert.strictEqual(reopened.lobby.joiningOpen, true);

    const joiner = await client(s.port);
    joiner.send({ t: 'join', name: 'Bo', joinCode: created.joinCode });
    const jl = await joiner.expect(m => m.t === 'joinedLobby' || m.t === 'rejected');
    assert.strictEqual(jl.t, 'joinedLobby', 'joining works after re-open');
    host.close(); joiner.close();
  } finally { await s.close(); }
});

test('§3 host-only: a non-creator setJoining is rejected notCreator', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 3, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    const joiner = await client(s.port);
    joiner.send({ t: 'join', name: 'Bo', joinCode: created.joinCode });
    await joiner.expect(m => m.t === 'joinedLobby');

    joiner.send({ t: 'setJoining', open: false });
    const rej = await joiner.expect(m => m.t === 'rejected');
    assert.strictEqual(rej.code, 'notCreator', 'only the host toggles joining');
    host.close(); joiner.close();
  } finally { await s.close(); }
});
