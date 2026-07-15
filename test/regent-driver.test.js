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
