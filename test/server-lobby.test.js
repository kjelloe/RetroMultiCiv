// Phase-4 slice 1 integration (docs/08 §2): drive real ws clients through the
// LOBBY — create a game, join it BY CODE picking a seat, start it (an unfilled
// human seat becomes AI), and play a command. The seating chart the lobby
// authors (mail @e82e7068) must land each connection on its charted seat.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

// minimal promise wrapper around the ws client (mirrors test/server.test.js)
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
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 5000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: msg => ws.send(JSON.stringify(msg)), expect, inbox, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

test('lobby: create → join-by-code (seat pick) → start → play; unfilled seat is AI', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    // host creates a 3-civ, 3-human game
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Kjell', options: { civs: 3, humans: 3, size: 'xsmall', seed: 424242 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    assert.strictEqual(created.seat, 'p1', 'creator holds p1');
    assert.match(created.joinCode, /^[0-9A-HJKMNP-TV-Z]{5}$/, '5-char Crockford join code');
    const { gameId, joinCode } = created;

    // list shows the pre-start lobby alongside the default game
    host.send({ t: 'list' });
    const games = await host.expect(m => m.t === 'games', 'games');
    assert.ok(games.games.some(g => g.gameId === gameId && g.started === false), 'lobby is listed, not started');

    // a friend joins BY CODE and picks p2; the host sees the roster update
    const guest = await connect(s.port);
    guest.send({ t: 'join', joinCode, name: 'Ada', seat: 'p2' });
    const jl = await guest.expect(m => m.t === 'joinedLobby', 'joinedLobby');
    assert.strictEqual(jl.seat, 'p2', 'seat pick honored');
    const lob = await host.expect(m => m.t === 'lobby', 'lobby broadcast');
    assert.ok(lob.lobby.seats.find(x => x.seat === 'p2' && x.name === 'Ada' && x.reserved), 'roster shows Ada on p2');

    // host starts; p3 was never filled → AI. Each seated client gets {joined}.
    host.send({ t: 'start' });
    const hj = await host.expect(m => m.t === 'joined', 'host joined');
    assert.strictEqual(hj.playerId, 'p1');
    assert.strictEqual(hj.view.players.p1.name, 'Kjell', 'names come from the lobby, not "Player N"');
    const gj = await guest.expect(m => m.t === 'joined', 'guest joined');
    assert.strictEqual(gj.playerId, 'p2', 'the picked seat lands on p2');
    assert.strictEqual(gj.view.players.p2.name, 'Ada', 'p2 carries the picker name');
    assert.strictEqual(gj.view.players.p3.human, false, 'the unfilled human seat started as AI');
    await host.expect(m => m.t === 'started', 'started broadcast');

    // and it plays: the host founds a city through the socket
    const settlers = Object.values(hj.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    host.send({ t: 'cmd', token: hj.token, commandId: 1, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Lobbytown' } });
    const applied = await host.expect(m => m.t === 'applied' && m.commandId === 1, 'applied');
    assert.ok(applied.events.some(e => e.type === 'cityFounded'), 'the city was founded on the lobby game');

    host.close(); guest.close();
  } finally {
    await s.close();
  }
});

test('turn flow: presence, host skip, propose→vote >2/3, spectator view (docs/08 §4+§6)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    // 3 humans: Kjell hosts p1, Ada takes p2, Bo takes p3; spectators allowed
    const kjell = await connect(s.port);
    kjell.send({ t: 'create', name: 'Kjell', options: { civs: 3, humans: 3, size: 'xsmall', seed: 55, allowSpectators: true } });
    const created = await kjell.expect(m => m.t === 'created', 'created');
    const ada = await connect(s.port);
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    await ada.expect(m => m.t === 'joinedLobby', 'ada in lobby');
    const bo = await connect(s.port);
    bo.send({ t: 'join', joinCode: created.joinCode, name: 'Bo' });
    await bo.expect(m => m.t === 'joinedLobby', 'bo in lobby');

    kjell.send({ t: 'start' });
    const kj = await kjell.expect(m => m.t === 'joined', 'kjell joined');
    const aj = await ada.expect(m => m.t === 'joined', 'ada joined');
    await bo.expect(m => m.t === 'joined', 'bo joined');
    // presence snapshot after start: all three connected
    const snap = await kjell.expect(m => m.t === 'presence' && m.all, 'presence snapshot');
    assert.deepStrictEqual(snap.all, { p1: true, p2: true, p3: true });

    // non-host guard: Ada may not use the host skip
    ada.send({ t: 'skipTurn' });
    const rej = await ada.expect(m => m.t === 'rejected' && m.code === 'notHost', 'notHost');
    assert.ok(rej);

    // host skip: it is p1's turn; Kjell (host) skips himself → turn moves to p2
    assert.strictEqual(kj.view.activePlayer, 'p1');
    kjell.send({ t: 'skipTurn' });
    await kjell.expect(m => m.t === 'turnSkipped' && m.playerId === 'p1', 'p1 skipped');
    await kjell.expect(m => m.t === 'turn' && m.activePlayerId === 'p2', 'turn to p2');

    // propose→vote: target p2; eligible = {p1, p3} → needed = 2 (strictly > 2/3)
    kjell.send({ t: 'proposeSkip' });
    const sv = await bo.expect(m => m.t === 'skipVote', 'vote opened');
    assert.deepStrictEqual({ target: sv.target, yes: sv.yes, needed: sv.needed },
      { target: 'p2', yes: 1, needed: 2 }, 'proposer counts as yes');
    bo.send({ t: 'vote', yes: true });
    await ada.expect(m => m.t === 'turnSkipped' && m.playerId === 'p2', 'vote passed, p2 skipped');
    await ada.expect(m => m.t === 'turn' && m.activePlayerId === 'p3', 'turn to p3');

    // spectator: omniscient view, no token, no rngState, no unknown tiles
    const spec = await connect(s.port);
    spec.send({ t: 'join', joinCode: created.joinCode, name: 'Watcher', spectator: true });
    const sj = await spec.expect(m => m.t === 'joined', 'spectator joined');
    assert.strictEqual(sj.playerId, 'spectator');
    assert.strictEqual(sj.token, undefined, 'spectators get no seat token');
    assert.strictEqual(sj.view.rngState, undefined, 'no rngState even omnisciently');
    assert.ok(!sj.view.map.tiles.some(t => t.t === 'unknown'), 'the spectator view is omniscient');

    // presence: Bo drops → the others are told (the "waiting for Bo" banner)
    bo.close();
    const gone = await kjell.expect(m => m.t === 'presence' && m.playerId === 'p3', 'p3 presence');
    assert.strictEqual(gone.connected, false);

    kjell.close(); ada.close(); spec.close();
  } finally {
    await s.close();
  }
});
