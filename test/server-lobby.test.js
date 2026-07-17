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
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
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
    // A24: every seat has a DISTINCT civilization; colors come from the civ;
    // the joined reply carries the pid->civ map for client rosters/visuals
    const civIds = Object.values(gj.civs || {});
    assert.strictEqual(civIds.length, 3, 'all three players have civs');
    assert.strictEqual(new Set(civIds).size, 3, 'civs are distinct');
    assert.strictEqual(gj.view.players.p2.color, RULESET.civs[gj.civs.p2].color, 'color from the civ');
    assert.strictEqual(gj.view.players.p3.name, RULESET.civs[gj.civs.p3].name, 'AI seats take the civ name');
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

test('A27 host controls: slot modes, civ picks, resize, no-kick, honored at start', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Kjell', options: { civs: 4, humans: 3, size: 'xsmall', seed: 99 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const ada = await connect(s.port);
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada', seat: 'p2' });
    await ada.expect(m => m.t === 'joinedLobby', 'ada seated');
    await host.expect(m => m.t === 'lobby', 'roster broadcast');

    // auth: only the creator may edit slots
    ada.send({ t: 'setSlot', seat: 'p3', mode: 'ai' });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'non-host')).code, 'notCreator');
    // shape: parseMessage rejects an empty patch
    host.send({ t: 'setSlot', seat: 'p3' });
    assert.strictEqual((await host.expect(m => m.t === 'rejected', 'empty patch')).code, 'badShape');
    // NO-KICK (@3b520ebc): a reserved seat cannot be flipped to AI
    host.send({ t: 'setSlot', seat: 'p2', mode: 'ai' });
    assert.strictEqual((await host.expect(m => m.t === 'rejected', 'kick blocked')).code, 'seatReserved');

    // legit edits: p3 → AI with Romans; duplicate civ pick rejected; resize 4→5→4
    host.send({ t: 'setSlot', seat: 'p3', mode: 'ai', civ: 'romans' });
    const rosterMsg = await ada.expect(m => m.t === 'lobby'
      && m.lobby.seats.some(x => x.seat === 'p3' && x.mode === 'ai' && x.civ === 'romans'), 'joiner sees the edit live');
    assert.ok(rosterMsg);
    host.send({ t: 'setSlot', seat: 'p4', civ: 'romans' });
    assert.strictEqual((await host.expect(m => m.t === 'rejected', 'dupe civ')).code, 'civTaken');
    host.send({ t: 'setSlots', civs: 5 });
    await host.expect(m => m.t === 'lobby' && m.lobby.seats.length === 5, 'grown to 5');
    host.send({ t: 'setSlots', civs: 4 });
    await host.expect(m => m.t === 'lobby' && m.lobby.seats.length === 4, 'shrunk to 4');

    // start: the edits are honored, and Ada is UNDISTURBED on her seat
    host.send({ t: 'start' });
    const hj = await host.expect(m => m.t === 'joined', 'host joined');
    const aj = await ada.expect(m => m.t === 'joined', 'ada joined');
    assert.strictEqual(aj.playerId, 'p2', 'the occupant kept her seat through the blocked kick');
    assert.strictEqual(aj.view.players.p2.name, 'Ada');
    assert.strictEqual(hj.view.players.p3.human, false, 'p3 started as AI (host flip)');
    assert.strictEqual(hj.civs.p3, 'romans', 'p3 carries the picked civ');
    assert.strictEqual(new Set(Object.values(hj.civs)).size, 4, 'civs stay distinct around the pick');
    host.close(); ada.close();
  } finally {
    await s.close();
  }
});

test('A38 big lobbies: seats-per-size gate, resize clamp, 12 civs start distinct', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
  try {
    // the measured table gates create: 13 civs never fit a small map
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Kjell', options: { civs: 13, humans: 1, size: 'small', seed: 5 } });
    const rej = await host.expect(m => m.t === 'rejected', 'mapTooSmall');
    assert.strictEqual(rej.code, 'mapTooSmall');
    assert.strictEqual(rej.maxCivs, 12, 'the rejection carries the size limit');

    // 12 civs on a medium map create, resize clamps at the size cap, start
    host.send({ t: 'create', name: 'Kjell', options: { civs: 12, humans: 1, size: 'medium', seed: 5 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    assert.strictEqual(created.lobby.seats.length, 12, 'twelve seats');
    host.send({ t: 'setSlots', civs: 99 }); // greedy resize clamps to medium's 14
    await host.expect(m => m.t === 'lobby' && m.lobby.seats.length === 14, 'clamped to 14');
    host.send({ t: 'setSlots', civs: 12 });
    await host.expect(m => m.t === 'lobby' && m.lobby.seats.length === 12, 'back to 12');
    host.send({ t: 'start' });
    const hj = await host.expect(m => m.t === 'joined', 'host joined');
    assert.strictEqual(Object.keys(hj.view.players).length, 12, 'twelve players in the world');
    const civIds = Object.values(hj.civs || {});
    assert.strictEqual(new Set(civIds).size, 12, 'twelve DISTINCT civilizations (A24 shuffle at scale)');
    await host.expect(m => m.t === 'started', 'started');
    host.close();
  } finally {
    await s.close();
  }
});

test('A37 lobby chat + moderation: cap, rate, toggle, kick frees the seat, block bounces the rejoin', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Kjell', options: { civs: 3, humans: 3, size: 'xsmall', seed: 9 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const ada = await connect(s.port);
    ada.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    const aj = await ada.expect(m => m.t === 'joinedLobby', 'ada seated');
    await host.expect(m => m.t === 'lobby', 'roster');

    // chat: both directions, name attached; parseMessage hard-caps 200
    ada.send({ t: 'chat', text: 'hello from Ada' });
    const heard = await host.expect(m => m.t === 'chat', 'host hears');
    assert.deepStrictEqual({ seat: heard.seat, name: heard.name, text: heard.text },
      { seat: aj.seat, name: 'Ada', text: 'hello from Ada' });
    await ada.expect(m => m.t === 'chat', 'echo to sender too');
    ada.send({ t: 'chat', text: 'x'.repeat(201) });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'cap')).code, 'badShape');
    ada.send({ t: 'chat', text: 'too quick' }); // < 1s after "hello from Ada"
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'rate')).code, 'tooFast');

    // moderation is host-only; the live toggle silences the room
    ada.send({ t: 'setChat', on: false });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'non-host toggle')).code, 'notCreator');
    ada.send({ t: 'kick', seat: 'p1' });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'non-host kick')).code, 'notCreator');
    host.send({ t: 'setChat', on: false });
    await host.expect(m => m.t === 'lobby' && m.lobby.options.chat === false, 'chat off broadcast');
    await new Promise(r => setTimeout(r, 1100)); // clear Ada's rate window
    ada.send({ t: 'chat', text: 'anyone?' });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'chat off')).code, 'chatOff');
    host.send({ t: 'kick', seat: created.seat });
    assert.strictEqual((await host.expect(m => m.t === 'rejected', 'self-kick')).code, 'cannotKickHost');

    // kick-and-block: Ada is removed, notified, her seat frees, rejoin bounces
    host.send({ t: 'kick', seat: aj.seat, block: true });
    await ada.expect(m => m.t === 'kicked', 'ada notified');
    const after = await host.expect(m => m.t === 'lobby'
      && m.lobby.seats.some(x => x.seat === aj.seat && x.reserved === false), 'seat freed');
    assert.ok(after);
    const adaAgain = await connect(s.port);
    adaAgain.send({ t: 'join', joinCode: created.joinCode, name: 'Ada' });
    assert.strictEqual((await adaAgain.expect(m => m.t === 'rejected', 'blocked rejoin')).code, 'blocked',
      'the per-game blocklist bounces the rejoin');
    host.close(); ada.close(); adaAgain.close();
  } finally {
    await s.close();
  }
});

test('A34 resume from the host flow: listSaves inventory, resume loads + seats reset, codes match', async () => {
  const fs = require('fs');
  const path = require('path');
  const { createGame } = await import('../server/game.js');
  const { startServer } = await import('../server/index.js');
  // a real server save on disk, uniquely named (no cross-test races)
  const game0 = createGame({
    ruleset: RULESET, gameId: 'a34resume',
    setup: { seed: 777, options: { width: 40, height: 25, players: [
      { id: 'p1', name: 'Kjell', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ] } }
  });
  const saveFile = path.join(__dirname, '..', 'saves', 'a34resume.json');
  game0.saveTo(saveFile);
  const wantCode = game0.code();
  // L2: the inventory (codes included) answers only under --debug — on a
  // production server listSaves is an information leak, so it returns empty
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, debug: true,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
  const sPlain = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    const plain = await connect(sPlain.port);
    plain.send({ t: 'listSaves' });
    const gated = await plain.expect(m => m.t === 'saves', 'gated inventory');
    assert.deepStrictEqual(gated.saves, [], 'no --debug: the saves inventory stays closed');
    plain.close();
    const host = await connect(s.port);
    // inventory: shape + the docs/07 code so the host can verify BEFORE playing
    host.send({ t: 'listSaves' });
    const inv = await host.expect(m => m.t === 'saves', 'inventory');
    const mine = inv.saves.find(x => x.gameId === 'a34resume');
    assert.ok(mine, 'the crafted save is listed');
    assert.deepStrictEqual(
      { file: mine.file, turn: mine.turn, code: mine.code, loaded: mine.loaded,
        humans: mine.players.filter(p => p.human).map(p => p.name) },
      { file: 'a34resume.json', turn: 1, code: wantCode, loaded: false, humans: ['Kjell'] });

    // security: client-supplied paths never resolve outside saves/
    host.send({ t: 'resume', file: '../package.json' });
    assert.strictEqual((await host.expect(m => m.t === 'rejected', 'traversal')).code, 'badShape');

    // resume: loads via the --game path with seats RESET; the code survives
    host.send({ t: 'resume', file: 'a34resume.json' });
    const resumed = await host.expect(m => m.t === 'resumed', 'resumed');
    assert.strictEqual(resumed.gameId, 'a34resume');
    assert.strictEqual(resumed.code, wantCode, 'the resumed game carries the SAME verification code');

    // the host joins by gameId and lands on the (reset) seat by name
    host.send({ t: 'join', joinCode: 'a34resume', name: 'Kjell' });
    const hj = await host.expect(m => m.t === 'joined', 'joined the resumed game');
    assert.strictEqual(hj.view.players[hj.playerId].name, 'Kjell', 'seat re-picked by name');
    assert.strictEqual(hj.code, wantCode, 'the docs/07 trust loop: code visible on join');

    // a second resume of the live game just points at it (no clobber)
    host.send({ t: 'resume', file: 'a34resume.json' });
    const again = await host.expect(m => m.t === 'resumed', 'already live');
    assert.strictEqual(again.gameId, 'a34resume');
    host.close();
  } finally {
    await s.close();
    await sPlain.close();
    fs.rmSync(saveFile, { force: true });
  }
});

test('A41 find-a-game: public-only listing, no codes leaked, joinListed = the reservation path, rate limit', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
  try {
    // one PRIVATE lobby (default) and one PUBLIC one
    const hostA = await connect(s.port);
    hostA.send({ t: 'create', name: 'Secret', options: { civs: 2, humans: 2, size: 'xsmall', seed: 1 } });
    await hostA.expect(m => m.t === 'created', 'private created');
    const hostB = await connect(s.port);
    hostB.send({ t: 'create', name: 'Kjell', options: { civs: 3, humans: 3, size: 'medium', seed: 2, public: true } });
    const pub = await hostB.expect(m => m.t === 'created', 'public created');

    const ada = await connect(s.port);
    ada.send({ t: 'listGames' });
    const listing = await ada.expect(m => m.t === 'openGames', 'browse');
    assert.strictEqual(listing.games.length, 1, 'private lobbies NEVER appear (nor the default started game)');
    const g = listing.games[0];
    assert.deepStrictEqual(
      { hostName: g.hostName, openSeats: g.openSeats, totalSeats: g.totalSeats, size: g.size, status: g.status },
      { hostName: 'Kjell', openSeats: 2, totalSeats: 3, size: 'medium', status: 'lobby' });
    assert.strictEqual(g.joinCode, undefined, 'the code stays the host secret');
    assert.strictEqual(g.ip, undefined, 'no addresses in listings');

    // rate limit: an immediate second browse bounces
    ada.send({ t: 'listGames' });
    assert.strictEqual((await ada.expect(m => m.t === 'rejected', 'rate')).code, 'tooFast');

    // joinListed lands on the SAME reservation path — seat pick honored
    ada.send({ t: 'joinListed', gameId: g.gameId, name: 'Ada', seat: 'p3' });
    const aj = await ada.expect(m => m.t === 'joinedLobby', 'joined from the list');
    assert.strictEqual(aj.seat, 'p3', 'the seat pick behaves exactly like a code join');
    const roster = await hostB.expect(m => m.t === 'lobby'
      && m.lobby.seats.some(x => x.seat === 'p3' && x.name === 'Ada' && x.reserved), 'reserved like any join');
    assert.ok(roster);

    // a PRIVATE gameId through the listed path is refused
    const bo = await connect(s.port);
    bo.send({ t: 'joinListed', gameId: 'g1', name: 'Bo' });
    assert.strictEqual((await bo.expect(m => m.t === 'rejected', 'private')).code, 'notPublic');
    hostA.close(); hostB.close(); ada.close(); bo.close();
  } finally {
    await s.close();
  }
});

test('turn flow: presence, host skip, propose→vote >2/3, spectator view (docs/08 §4+§6)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: deterministic ids for the literal-g1 probe
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
