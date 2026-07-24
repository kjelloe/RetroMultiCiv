// lobby-robustness (#2544): the lobby paths that only misbehave under adverse
// sequencing. Items 1-3 are already robust by construction (the message handler
// is synchronous, so there is no interleave window; the Part-B grace mechanism
// covers lobby drops; a stale token is a clean badToken) — these tests LOCK
// that. Item 4 is a real fix: an open skip-vote is re-evaluated when a voter
// disconnects, so a departure that tips the tally no longer wedges the turn.
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const RULESET = require('./ruleset.js');

function connect(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(m));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout: ' + (label || ''))), 8000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } });
    });
  }
  return new Promise(resolve => ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() })));
}

test('#1 join-code race: two clients on the same code get DISTINCT seats; a full lobby cleanly rejects', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 3, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 3 } });
    const created = await host.expect(m => m.t === 'created', 'created');

    // two joiners submit the SAME code back-to-back (no await between sends)
    const a = await connect(s.port), b = await connect(s.port);
    a.send({ t: 'join', joinCode: created.joinCode, name: 'A' });
    b.send({ t: 'join', joinCode: created.joinCode, name: 'B' });
    const ja = await a.expect(m => m.t === 'joinedLobby', 'a lobby');
    const jb = await b.expect(m => m.t === 'joinedLobby', 'b lobby');
    assert.notStrictEqual(ja.seat, jb.seat, 'one seat each — never a double-seat');

    // lobby now full (p1 host + p2 + p3, all human seats) -> a fresh join is a clean reject, no hang
    const c = await connect(s.port);
    c.send({ t: 'join', joinCode: created.joinCode, name: 'C' });
    const rej = await c.expect(m => m.t === 'joinedLobby' || m.t === 'rejected', 'c answer');
    assert.strictEqual(rej.t, 'rejected');
    assert.strictEqual(rej.code, 'gameFull', 'a known reject reason, cleanly returned');
    host.close(); a.close(); b.close(); c.close();
  } finally { await s.close(); }
});

test('#2 lobby-drop window: a dropped seat becomes claimable, then frees after grace (never wedges)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 3, size: 'xsmall', autosave: false, host: '127.0.0.1', seatGraceMs: 150 });
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Host', options: { civs: 3, humans: 3, size: 'xsmall', seed: 3 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const a = await connect(s.port);
    a.send({ t: 'join', joinCode: created.joinCode, name: 'A' });
    const ja = await a.expect(m => m.t === 'joinedLobby', 'a lobby');

    // drop right after join-accept: the seat holds as disconnected (reclaimable)...
    a.close();
    const held = await host.expect(m => m.t === 'lobby' && m.lobby.seats.some(x => x.seat === ja.seat && x.disconnected), 'seat held');
    assert.ok(held, 'the dropped seat is grace-held, not lost');
    // ...then the grace window frees it back to the pool
    const freed = await host.expect(m => m.t === 'lobby' && m.lobby.seats.some(x => x.seat === ja.seat && !x.reserved), 'seat freed');
    assert.ok(freed, 'the seat returns to the pool after grace — no wedge');
    host.close();
  } finally { await s.close(); }
});

test('#3 stale token: a command carrying an unknown/stale seat token is a clean badToken reject', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const p = await connect(s.port);
    p.send({ t: 'join', name: 'Ada' });
    await p.expect(m => m.t === 'joined', 'joined');
    // a token from an old process generation never matches the live game's seats
    p.send({ t: 'endTurn', token: 'stale-generation-token', commandId: 7 });
    const rej = await p.expect(m => m.t === 'rejected', 'rejected');
    assert.strictEqual(rej.code, 'badToken', 'the client already knows how to render badToken');
    assert.strictEqual(rej.commandId, 7, 'the reject echoes the commandId (no silent hang)');
    p.close();
  } finally { await s.close(); }
});

test('#4 skip-vote wedge: a voter leaving mid-vote re-tallies and resolves the turn', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const p1 = await connect(s.port);
    p1.send({ t: 'create', name: 'P1', options: { civs: 3, humans: 3, size: 'xsmall', seed: 55 } });
    const created = await p1.expect(m => m.t === 'created', 'created');
    const p2 = await connect(s.port); p2.send({ t: 'join', joinCode: created.joinCode, name: 'P2' });
    await p2.expect(m => m.t === 'joinedLobby', 'p2 lobby');
    const p3 = await connect(s.port); p3.send({ t: 'join', joinCode: created.joinCode, name: 'P3' });
    await p3.expect(m => m.t === 'joinedLobby', 'p3 lobby');
    p1.send({ t: 'start' });
    await p1.expect(m => m.t === 'joined', 'p1 joined');
    await p2.expect(m => m.t === 'joined', 'p2 joined');
    await p3.expect(m => m.t === 'joined', 'p3 joined');

    // host skips p1 -> turn to p2 (the vote target); eligible = {p1, p3}, needed = 2
    p1.send({ t: 'skipTurn' });
    await p1.expect(m => m.t === 'turn' && m.activePlayerId === 'p2', 'turn p2');
    p1.send({ t: 'proposeSkip' });
    const sv = await p1.expect(m => m.t === 'skipVote', 'vote opened');
    assert.deepStrictEqual({ yes: sv.yes, needed: sv.needed }, { yes: 1, needed: 2 }, 'one yes, needs two');

    // p3 (an outstanding voter) drops -> electorate shrinks to {p1}, needed 1, yes 1
    // -> the vote must RESOLVE on the disconnect, with no further vote frame.
    p3.close();
    const skipped = await p1.expect(m => m.t === 'turnSkipped' && m.playerId === 'p2', 'resolved on drop');
    assert.ok(skipped, 'the departure re-tallied the vote and skipped the stalled turn');
    p1.close(); p2.close();
  } finally { await s.close(); }
});
