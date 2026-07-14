// Phase-3 slice 1 (docs/06-phase3-server.md §7): the authoritative core —
// seat binding, playerId stamping (the tamper-rejection acceptance case),
// message validation, routing, and save/resume whose diagnostics recording
// verifies through tools/replay.js ACROSS a simulated server restart.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RULESET = require('./ruleset.js');
const { replayDiagnostics } = require('../tools/replay.js');

const SETUP = {
  seed: 424242,
  options: {
    width: 24, height: 16,
    players: [
      { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ]
  }
};

async function freshGame(extra) {
  const { createGame } = await import('../server/game.js');
  let n = 0;
  let c = 0;
  return createGame(Object.assign({
    ruleset: RULESET, setup: SETUP, gameId: 'test1',
    tokenFn: () => `tok${++n}`,        // deterministic tokens for assertions
    seatCodeFn: () => `SC0${++c}-TEST` // A46: deterministic seat codes too
  }, extra || {}));
}

test('seats: first join binds the first human seat; tokens reclaim; full is full', async () => {
  const game = await freshGame();
  const a = game.bindSeat('Kjell');
  assert.deepStrictEqual(a, { playerId: 'p1', token: 'tok1', seatCode: 'SC01-TEST' });
  const again = game.bindSeat('Kjell', 'tok1');
  assert.deepStrictEqual(again, { playerId: 'p1', token: 'tok1', seatCode: 'SC01-TEST' },
    'token reclaims the same seat (and re-shows its code)');
  assert.deepStrictEqual(game.bindSeat('Late'), { error: 'gameFull' }, 'one human seat in this setup');
  assert.deepStrictEqual(game.bindSeat('X', 'forged'), { error: 'badToken' });
  // A46: the code reclaims WITHOUT the token, rotating it
  const reclaimed = game.bindSeat('Kjell', undefined, 'SC01-TEST');
  assert.deepStrictEqual(reclaimed, { playerId: 'p1', token: 'tok2', seatCode: 'SC01-TEST' },
    'the seat code reclaims the seat with a ROTATED token');
  assert.strictEqual(game.seatOf('tok1'), null, 'the old device token died with the move');
  assert.deepStrictEqual(game.bindSeat('X', undefined, 'ZZZZ-ZZZZ'), { error: 'badSeatCode' });
});

test('resetSeats: a resumed game can hand its seats out fresh (--reset-seats)', async () => {
  const game = await freshGame();
  game.bindSeat('Kjell'); // p1 bound to tok1
  assert.deepStrictEqual(game.bindSeat('OtherBrowser'), { error: 'gameFull' },
    'without the token the seat is unreachable (per-origin localStorage)');
  game.resetSeats();
  assert.deepStrictEqual(game.bindSeat('OtherBrowser'), { playerId: 'p1', token: 'tok2', seatCode: 'SC02-TEST' },
    'after the reset the next joiner takes the seat with a fresh token AND a fresh code');
  assert.strictEqual(game.seatOf('tok1'), null, 'the old token is dead');
  assert.strictEqual(game.seatOfCode('SC01-TEST'), null, 'the old seat code is dead too (A46)');
});

test('tamper rejection: a forged playerId inside the command is stamped over', async () => {
  const { hashState } = await import('../shared/statehash.js');
  const game = await freshGame();
  game.bindSeat('Kjell');
  const p2unit = Object.values(game.state.units).find(u => u.owner === 'p2');
  const before = hashState(game.state);
  // the client claims to be p2 and tries to move p2's settlers
  const res = game.apply('p1', { type: 'moveUnit', playerId: 'p2', unitId: p2unit.id, dir: 'E' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'notYourUnit', 'stamped to p1, then engine-rejected');
  assert.strictEqual(hashState(game.state), before, 'state untouched');
});

test('endTurn drives the AI round back to the human, like the client session', async () => {
  const game = await freshGame();
  game.bindSeat('Kjell');
  const res = game.endTurn('p1');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(game.state.turn, 2, 'AI (p2) played and the turn wrapped');
  assert.strictEqual(game.state.activePlayer, 'p1');
  assert.ok(Array.isArray(res.events));
  // out-of-turn endTurn is rejected by the engine, not trusted state
  assert.strictEqual(game.endTurn('p2').ok, false);
});

test('views are fog-filtered per seat and never leak rngState', async () => {
  const game = await freshGame();
  const view = game.view('p1');
  assert.strictEqual(view.rngState, undefined);
  assert.strictEqual(view.you, 'p1');
  assert.strictEqual(view.players.p2.gold, undefined, 'rival internals stay hidden');
  assert.ok(view.map.tiles.some(t => t.t === 'unknown'), 'fog exists at game start');
});

test('parseMessage: rejects garbage, oversized, and unknown frames', async () => {
  const { parseMessage } = await import('../server/protocol.js');
  assert.strictEqual(parseMessage('not json').code, 'badJson');
  assert.strictEqual(parseMessage('x'.repeat(70000)).code, 'badFrame');
  assert.strictEqual(parseMessage('').code, 'badFrame');
  assert.strictEqual(parseMessage('[1,2]').code, 'badShape');
  assert.strictEqual(parseMessage('{"t":"launchNukes"}').code, 'unknownType');
  assert.strictEqual(parseMessage(JSON.stringify({ t: 'join', name: '' })).code, 'badName');
  assert.strictEqual(parseMessage(JSON.stringify({ t: 'cmd', token: 't', commandId: 1.5, cmd: { type: 'wait' } })).code, 'badShape');
  assert.strictEqual(parseMessage(JSON.stringify({ t: 'cmd', token: 't', commandId: 1, cmd: { type: 'wait' } })).ok, true);
});

test('route: join → play a command → applied + turn broadcast + views flag', async () => {
  const { route } = await import('../server/protocol.js');
  const game = await freshGame();

  const joined = route(game, { t: 'join', name: 'Kjell' });
  assert.strictEqual(joined.reply[0].t, 'joined');
  const token = joined.reply[0].token;
  assert.strictEqual(joined.reply[0].view.you, 'p1');
  assert.strictEqual(joined.viewsChanged, false);

  const bad = route(game, { t: 'cmd', token: 'nope', commandId: 7, cmd: { type: 'wait' } });
  assert.strictEqual(bad.reply[0].t, 'rejected');
  assert.strictEqual(bad.reply[0].code, 'badToken');

  const myUnit = Object.values(game.state.units).find(u => u.owner === 'p1');
  const moved = route(game, { t: 'cmd', token, commandId: 8, cmd: { type: 'fortify', unitId: myUnit.id } });
  assert.strictEqual(moved.reply[0].t, 'applied');
  assert.strictEqual(moved.reply[0].commandId, 8);
  assert.strictEqual(moved.viewsChanged, true);
  assert.strictEqual(moved.broadcast[0].t, 'turn');

  const ended = route(game, { t: 'endTurn', token, commandId: 9 });
  assert.strictEqual(ended.reply[0].t, 'applied');
  assert.strictEqual(game.state.turn, 2);
});

test('save/resume: state, seats, and the diagnostics recording span a restart', async () => {
  const { hashState } = await import('../shared/statehash.js');
  const game = await freshGame();
  const { token } = game.bindSeat('Kjell');

  // play: found a city, run two rounds
  const settlers = Object.values(game.state.units).find(u => u.owner === 'p1' && u.type === 'settlers');
  assert.strictEqual(game.apply('p1', { type: 'foundCity', unitId: settlers.id, name: 'Servertown' }).ok, true);
  assert.strictEqual(game.endTurn('p1').ok, true);
  assert.strictEqual(game.endTurn('p1').ok, true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-save-'));
  const file = path.join(dir, 'game.json');
  try {
    game.saveTo(file);
    const beforeHash = hashState(game.state);

    // "restart": a brand-new process would do exactly this
    const { createGame } = await import('../server/game.js');
    const resumed = createGame({ ruleset: RULESET, save: JSON.parse(fs.readFileSync(file, 'utf8')) });
    assert.strictEqual(hashState(resumed.state), beforeHash, 'resumed state is bit-identical');
    assert.strictEqual(resumed.seatOf(token), 'p1', 'the old token still owns its seat');

    // the game CONTINUES after the restart, and the one diagnostics
    // recording covers both lives of the server
    assert.strictEqual(resumed.endTurn('p1').ok, true);
    const diag = resumed.toSave().diag;
    const report = await replayDiagnostics(JSON.parse(JSON.stringify(diag)), RULESET);
    assert.deepStrictEqual(report.problems, [], 'replay verifies across the restart');
    assert.strictEqual(report.rounds, 3);
    assert.strictEqual(report.finalHash, hashState(resumed.state));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
