// A30: the local session's AI round is CHUNKED (one macrotask per AI player
// so the HUD repaints between them) — these tests pin that chunking changed
// NOTHING observable by the engine or the recorder: same commands, same
// order, same round hash as an unchunked twin, and the diagnostics log is
// byte-identical. Plus the two contracts the chunking introduced: commands
// are rejected while a round is in flight, and loads announce themselves
// with the synthetic stateReplaced event (empty notifies are mere repaints).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false },
  { id: 'p3', name: 'Aztecs', color: '#3fae6a', human: false }
];

async function load() {
  const { createEngine, deepClone } = await import('../engine/index.js');
  const ai = await import('../engine/ai.js');
  const { hashState } = await import('../shared/statehash.js');
  const { createSession } = await import('../client/session.js');
  return { createEngine, deepClone, ai, hashState, createSession };
}

test('chunked AI round: hash, events, and recording match the unchunked twin', async () => {
  const { createEngine, deepClone, ai, hashState, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 20260714, options: { width: 30, height: 20, players: PLAYERS }
  });

  // the UNCHUNKED TWIN: the exact pre-A30 synchronous loop
  let twin = deepClone(initial);
  const twinEvents = [];
  const twinFirst = engine.applyCommand(twin, { type: 'endTurn', playerId: twin.activePlayer });
  assert.ok(twinFirst.ok);
  twin = twinFirst.state;
  for (const e of twinFirst.events) twinEvents.push(e);
  let guard = 10;
  while (!twin.gameOver && !twin.players[twin.activePlayer].human && guard-- > 0) {
    twin = ai.runAiTurn(engine, twin, twin.activePlayer, RULESET, twinEvents);
    const res = engine.applyCommand(twin, { type: 'endTurn', playerId: twin.activePlayer });
    if (!res.ok) break;
    twin = res.state;
    for (const e of res.events) twinEvents.push(e);
  }
  const twinHash = hashState(twin);

  // the CHUNKED session round, collecting every notify delta in order
  const session = createSession(RULESET, deepClone(initial), {});
  const notified = [];
  session.onChange((_state, events) => { for (const e of events) notified.push(e); });
  await session.endTurn();

  assert.strictEqual(hashState(session.state), twinHash,
    'the chunked round must land on the unchunked state hash');
  assert.strictEqual(session.state.activePlayer, 'p1', 'the round stops at the human');
  assert.deepStrictEqual(notified, twinEvents,
    'the notify deltas reassemble to exactly the unchunked event stream');
  assert.strictEqual(session.log.length, 1, 'one recording entry for the round');
  assert.deepStrictEqual(session.log[0],
    { t: 'round', turn: twin.turn, activePlayer: 'p1', hash: twinHash },
    'the diagnostics recording is byte-identical to the unchunked shape');
});

test('commands are rejected while the chunked round is in flight', async () => {
  const { createEngine, deepClone, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 20260714, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  const settlers = Object.values(session.state.units).find(
    u => u.owner === 'p1' && u.type === 'settlers');
  const roundPromise = session.endTurn(); // NOT awaited: the round is in flight
  const busy = await session.apply({
    type: 'foundCity', playerId: 'p1', unitId: settlers.id, name: 'Sneaked'
  });
  assert.strictEqual(busy.ok, false);
  assert.strictEqual(busy.reason, 'roundInFlight',
    'mid-round commands must not slip into the recording');
  const second = await session.endTurn();
  assert.strictEqual(second.reason, 'roundInFlight', 'endTurn does not re-enter either');
  await roundPromise;
  assert.strictEqual(session.log.length, 1,
    'the rejected intruders left no trace in the recording');
});

test('replaceState announces itself with the stateReplaced marker', async () => {
  const { createEngine, deepClone, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 7, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  let markers = 0;
  session.onChange((_state, events) => {
    if (events.some(e => e.type === 'stateReplaced')) markers++;
  });
  session.replaceState(deepClone(initial));
  assert.strictEqual(markers, 1, 'loads carry the synthetic marker (turn-log re-baseline)');
  assert.strictEqual(session.log.length, 0, 'the recording restarted at the load point');
});
