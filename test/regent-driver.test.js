// B11: the regency drive-loop mechanics, against the REAL driver module and
// a REAL local session. The user's playtest (turn-264 recording) showed the
// armed regent playing exactly ONE turn then stalling — every later turn
// waited for a manual command, whose onChange re-kick then swept the whole
// seat and ended the turn ("when I moved them, it turned into a kind of
// auto-end-turn"). These tests pin the intended contract: armed = turns keep
// playing on their own; take-back = full manual control, nothing auto-ends.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const { createEngine, deepClone } = await import('../engine/index.js');
  const { createSession } = await import('../client/session.js');
  const { createRegentDriver } = await import('../client/ui/regent-driver.js');
  return { createEngine, deepClone, createSession, createRegentDriver };
}

function makeGame(mods) {
  return load().then(({ createEngine, deepClone, createSession, createRegentDriver }) => {
    const engine = createEngine(RULESET);
    const initial = engine.createGame({
      seed: 40, options: { width: 30, height: 20, players: PLAYERS }
    });
    const session = createSession(RULESET, deepClone(initial), {});
    const driver = createRegentDriver(session, () => 'p1');
    // regency.js wiring: every onChange kicks the driver
    session.onChange(() => { driver.kick(); });
    return { session, driver };
  });
}

// poll until cond() or the deadline — the loop yields real macrotasks, the
// same lane the driver's own yields ride
async function until(cond, ms) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) return false;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return true;
}

// settle: no round in flight and the driver idle
function settled(session, driver) {
  return !session.busy && !driver.kicking;
}

test('B11: an armed regent plays turn after turn without user input', async () => {
  const { session, driver } = await makeGame();
  assert.strictEqual(session.state.turn, 1);
  session.setRegent('p1', 'balanced');
  driver.kick(); // the single arming kick (regency.js setRegent path)
  const reached = await until(
    () => session.state.turn >= 5 || session.state.gameOver, 8000);
  assert.ok(reached,
    `armed regency must keep ending turns on its own — stalled at turn ${session.state.turn}`);
  assert.ok(!session.state.gameOver, 'the game is still running at turn 5');
});

test('XIV §2: an armed regent never advances a finished game (turn frozen at gameOver)', async () => {
  const { session, driver } = await makeGame();
  session.setRegent('p1', 'balanced');
  driver.kick(); // arming kick (regency.js setRegent path)
  // run a few real turns, then settle before ending the game
  assert.ok(await until(() => session.state.turn >= 3, 8000), 'regency ran a few turns');
  session.setRegent('p1', null); // stop the loop so no round is mid-flight
  assert.ok(await until(() => settled(session, driver), 8000), 'in-flight turn settled');
  session.setRegent('p1', 'balanced'); // re-arm — the game itself is what's over, not the seat
  session.state.gameOver = true; // session.state is the live ref; mark it finished
  const frozen = session.state.turn;
  driver.kick(); // a fresh kick must NOT advance a finished game
  // regentTurn itself refuses (the direct §2 guard, not just the driver loop)
  const rt = await session.regentTurn();
  assert.strictEqual(rt.ok, false, 'regentTurn refuses once the game is over');
  assert.strictEqual(rt.reason, 'gameOver');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.strictEqual(session.state.turn, frozen, 'the turn number stays frozen after gameOver');
});

test('XIV §3: paced play takes real wall-clock time vs instant play', async () => {
  const { createEngine, deepClone, createSession, createRegentDriver } = await load();
  async function runToTurn(paceMs, target) {
    const engine = createEngine(RULESET);
    const initial = engine.createGame({ seed: 40, options: { width: 30, height: 20, players: PLAYERS } });
    const session = createSession(RULESET, deepClone(initial), {});
    const driver = createRegentDriver(session, () => 'p1', () => paceMs);
    session.onChange(() => driver.kick());
    session.setRegent('p1', 'balanced');
    const t0 = Date.now();
    driver.kick();
    await until(() => session.state.turn >= target || session.state.gameOver, 12000);
    const elapsed = Date.now() - t0;
    session.setRegent('p1', null); // stop the loop so the process can settle/exit
    await until(() => settled(session, driver), 8000);
    return elapsed;
  }
  // reaching turn 3 completes ≥1 full pace interval (the last wait is still
  // pending when the turn lands), so a 250 ms pace clears 150 ms comfortably
  // while instant (0 ms) play returns in tens of ms.
  const paced = await runToTurn(250, 3);
  assert.ok(paced >= 150, `paced regency must spend real wall-clock time (was ${paced} ms)`);
});

test('B11: take-back stops the loop and manual commands never auto-end the turn', async () => {
  const { session, driver } = await makeGame();
  session.setRegent('p1', 'balanced');
  driver.kick();
  assert.ok(await until(() => session.state.turn >= 3, 8000), 'regency ran');
  // take back control (regency.js setRegent(null) path)
  session.setRegent('p1', null);
  assert.ok(await until(() => settled(session, driver), 8000), 'in-flight turn settled');
  const turnAfterTakeBack = session.state.turn;
  // idle: nothing may end turns on its own any more
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.strictEqual(session.state.turn, turnAfterTakeBack,
    'no auto-end while idle after take-back');
  // the user's exact reproduction: move (poke) a unit — its onChange kick
  // must NOT sweep the seat or end the turn
  const uid = Object.keys(session.state.units).find(k => {
    const u = session.state.units[k];
    return u.owner === 'p1' && u.moves > 0;
  });
  if (uid) {
    await session.apply({ type: 'wait', playerId: 'p1', unitId: uid });
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.strictEqual(session.state.turn, turnAfterTakeBack,
    'a manual command after take-back must not trigger an auto-end-turn');
  const logTail = session.log.slice(-3).filter(e => e.t === 'round');
  assert.ok(logTail.every(e => e.turn <= turnAfterTakeBack),
    'no regent round entries appended after take-back');
});

// #37 regent-stall: the AI-round traversal guard must cover a FULL round of AI seats. With the
// old fixed guard of 10, a game with > 10 AI seats (≥ 12 civs; medium/large default to 14) left
// the round loop exiting with activePlayer STUCK on an AI seat and the turn not advanced — the
// game froze (the regent driver breaks since activePlayer ≠ human, and no driver advances an AI
// seat). This drives a 14-civ regent round and asserts it returns to the human seat.
test('#37 regent-stall: a 14-civ round completes without stranding activePlayer on an AI seat', async () => {
  const { createEngine, deepClone, createSession } = await load();
  const engine = createEngine(RULESET);
  const players = [];
  for (let i = 1; i <= 14; i++) players.push({ id: 'p' + i, name: 'Civ' + i, color: '#3b7dd8', human: i === 1 });
  const initial = engine.createGame({ seed: 40, options: { width: 56, height: 35, players } });
  assert.ok(initial.playerOrder.length >= 12, `needs ≥12 seats to exercise the guard (got ${initial.playerOrder.length})`);
  const session = createSession(RULESET, deepClone(initial), {});
  session.setRegent('p1', 'balanced');
  await session.regentTurn();
  assert.ok(session.state.gameOver || session.state.players[session.state.activePlayer].human,
    `the round stranded activePlayer on AI seat ${session.state.activePlayer} (turn ${session.state.turn}) — the guard did not cover a full round`);
  assert.strictEqual(session.state.turn, 2, 'the round advanced to turn 2 (back to the human/regent seat)');
});
