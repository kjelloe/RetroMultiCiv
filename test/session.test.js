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

test('A40 regent turn: the recording replays hash-exact (individual cmd entries, not a round)', async () => {
  const { createEngine, deepClone, hashState, createSession } = await load();
  const { replayDiagnostics } = require('../tools/replay.js');
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 40, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  // hand p1 (the human) to the AI, then play a regent turn: its commands log
  // as cmd entries, the AI chain that follows logs a round entry
  session.setRegent('p1', 'balanced');
  await session.regentTurn();
  assert.strictEqual(session.state.activePlayer, 'p1', 'the round came back to p1');
  const liveHash = hashState(session.state);
  // the recording (initial + the regent's cmd entries + the round) must
  // re-derive the exact same state through tools/replay.js — regent turns
  // are re-APPLIED (cmd), the AI chain is re-DERIVED (round)
  const diag = session.exportDiagnostics();
  const report = await replayDiagnostics(JSON.parse(JSON.stringify(diag)), RULESET);
  assert.deepStrictEqual(report.problems, [], 'the regent recording diverged on replay');
  assert.ok(session.log.some(e => e.t === 'cmd'), 'the regent commands are individual cmd entries');
  assert.ok(session.log.some(e => e.t === 'round'), 'the following AI chain is a round entry');
  assert.strictEqual(report.finalHash, liveHash, 'replay reproduced the live hash');
});

test('B11: regentTurn narrates itself with a synthetic summary event (never recorded)', async () => {
  const { createEngine, deepClone, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 40, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  const summaries = [];
  session.onChange((_state, events) => {
    for (const e of events) if (e.type === 'regentTurn') summaries.push(e);
  });
  session.setRegent('p1', 'balanced');
  await session.regentTurn();
  assert.strictEqual(summaries.length, 1, 'exactly one summary per regent turn');
  const s = summaries[0];
  assert.strictEqual(s.playerId, 'p1', 'the summary names the seat');
  // the tally mirrors the cmd entries the recorder logged for this turn
  const applied = session.log.filter(e => e.t === 'cmd' && e.ok);
  assert.strictEqual(s.applied, applied.length, 'applied count matches the recording');
  const moves = applied.filter(e => e.cmd.type === 'moveUnit').length;
  assert.strictEqual(s.byType.moveUnit === undefined ? 0 : s.byType.moveUnit, moves,
    'per-type counts match the recording');
  // synthetic = client-side only: never a log entry, never in the export
  const diag = session.exportDiagnostics();
  assert.ok(!diag.log.some(e => e.t !== 'cmd' && e.t !== 'round'),
    'the recording carries only cmd/round entries — the summary is not recorded');
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

test('A54: a whitelisted command QUEUES during the round and flushes replay-exact after it', async () => {
  const { createEngine, deepClone, hashState, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 20260714, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  const roundPromise = session.endTurn(); // in flight
  const queued = session.apply({ type: 'setRates', playerId: 'p1', tax: 40, sci: 60 });
  assert.strictEqual(session.pendingOffturn, 1, 'the queued tick is visible');
  const res = await queued; // resolves when the round flushes
  assert.strictEqual(res.ok, true, 'the queued command applied for real');
  await roundPromise;
  assert.strictEqual(session.state.players.p1.taxRate, 40);
  assert.strictEqual(session.pendingOffturn, 0);
  // recording shape: the round entry FIRST, then the flushed cmd entry —
  // replaying that order reproduces the final state exactly
  assert.strictEqual(session.log.length, 2);
  assert.strictEqual(session.log[0].t, 'round');
  assert.deepStrictEqual(session.log[1].cmd, { type: 'setRates', playerId: 'p1', tax: 40, sci: 60 });
  let replayed = deepClone(initial);
  const first = engine.applyCommand(replayed, { type: 'endTurn', playerId: 'p1' });
  replayed = first.state;
  const { runAiTurn } = await import('../engine/ai.js');
  let guard = 10;
  while (!replayed.gameOver && !replayed.players[replayed.activePlayer].human && guard-- > 0) {
    replayed = runAiTurn(engine, replayed, replayed.activePlayer, RULESET, []);
    const r = engine.applyCommand(replayed, { type: 'endTurn', playerId: replayed.activePlayer });
    if (!r.ok) break;
    replayed = r.state;
  }
  const after = engine.applyCommand(replayed, session.log[1].cmd);
  assert.strictEqual(hashState(after.state), hashState(session.state),
    'round-then-flushed-cmd replays to the exact final hash');
});

test('A54: a NON-whitelisted command still rejects mid-round (the queue is not a bypass)', async () => {
  const { createEngine, deepClone, createSession } = await load();
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 20260714, options: { width: 30, height: 20, players: PLAYERS }
  });
  const session = createSession(RULESET, deepClone(initial), {});
  const settlers = Object.values(session.state.units).find(
    u => u.owner === 'p1' && u.type === 'settlers');
  const roundPromise = session.endTurn();
  const busy = await session.apply({ type: 'foundCity', playerId: 'p1', unitId: settlers.id, name: 'Nope' });
  assert.strictEqual(busy.reason, 'roundInFlight');
  await roundPromise;
});
