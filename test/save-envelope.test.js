// B16: the A47 history block inside a Shift+S save must carry EVERYTHING a
// replay needs to rebuild the ruleset the game ran with — the turn-371 hunt
// traced a "divergence at turn 328" to a save whose diag block dropped the
// difficulty override, so every extraction replayed under the wrong rules
// (the recording itself was perfect: contentCitizens 6 replays all 721
// entries clean to the save's own hash). These tests pin the envelope, the
// replay tool's native save support, and — self-skipping on the real file —
// the finding itself.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const RULESET = require('./ruleset.js');
const { replayDiagnostics, normalizeReplayInput } = require('../tools/replay.js');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function makeSession() {
  const { createEngine, deepClone } = await import('../engine/index.js');
  const { createSession } = await import('../client/session.js');
  const engine = createEngine(RULESET);
  const initial = engine.createGame({
    seed: 40, options: { width: 30, height: 20, players: PLAYERS }
  });
  return createSession(RULESET, deepClone(initial), {});
}

test('B16: the save envelope records the rules overrides the game ran with', async () => {
  const { buildSaveEnvelope } = await import('../client/ui/saves.js');
  const session = await makeSession();
  await session.endTurn();
  const ctx = { gameCode: () => 'AAAA-BBBB-CCCCC', rulesOverrides: { contentCitizens: 6 } };
  const envelope = buildSaveEnvelope(session, ctx);
  assert.strictEqual(envelope.format, 'retromulticiv-save');
  assert.ok(envelope.diag && Array.isArray(envelope.diag.log), 'the A47 history block is embedded');
  assert.deepStrictEqual(envelope.diag.rulesOverrides, { contentCitizens: 6 },
    'the difficulty the game ran with must travel WITH the history — '
    + 'without it every replay reconstructs the wrong ruleset (the turn-371 hunt)');
  // a default game embeds an empty object, still explicit
  const plain = buildSaveEnvelope(session, { gameCode: () => null });
  assert.deepStrictEqual(plain.diag.rulesOverrides, {},
    'no overrides is recorded as {}, not omitted — omission means pre-B16');
});

test('B16: tools/replay.js accepts a local save envelope natively', async () => {
  const { hashState } = await import('../shared/statehash.js');
  const { buildSaveEnvelope } = await import('../client/ui/saves.js');
  const session = await makeSession();
  await session.endTurn();
  const envelope = buildSaveEnvelope(session,
    { gameCode: () => null, rulesOverrides: {} });
  const { note, diag } = await normalizeReplayInput(JSON.parse(JSON.stringify(envelope)));
  assert.strictEqual(diag.format, 'retromulticiv-diagnostics', 'unwrapped to a replayable shape');
  assert.strictEqual(diag.finalHash, hashState(session.state),
    "the save's own state hash is the recorded truth to replay against");
  assert.match(note, /local save/, 'the CLI says what it is replaying');
  const report = await replayDiagnostics(diag, RULESET);
  assert.deepStrictEqual(report.problems, [], 'a fresh envelope replays clean');
  // pre-B16 envelope: no rulesOverrides in the diag block — warn, never guess
  delete envelope.diag.rulesOverrides;
  const old = await normalizeReplayInput(JSON.parse(JSON.stringify(envelope)));
  assert.match(old.note, /pre-B16/, 'older saves warn that difficulty was not recorded');
  assert.strictEqual(old.diag.rulesOverrides, undefined);
});

// B16 apply-on-load (architect ruling): loading a save that records its
// rules overrides must swap the LIVE rules to the save's — in place, so the
// engine closure and the next save envelope both see the loaded game's truth.
test('B16: loading a save applies its recorded rules overrides in place', async () => {
  const { applyLoadedRules, buildSaveEnvelope } = await import('../client/ui/saves.js');
  const baseRules = { contentCitizens: 4, combatRounds: 1, endYear: 2100 };
  // a session booted on god-emperor (URL override), loading a TRAINER save
  const liveRules = Object.assign({}, baseRules, { contentCitizens: 2 });
  const session = { ruleset: { rules: liveRules }, state: { turn: 5 } };
  const ctx = { baseRules, rulesOverrides: { contentCitizens: 2 }, gameCode: () => null };
  const notice = applyLoadedRules(session, ctx, {
    initialState: {}, log: [], rulesOverrides: { contentCitizens: 6 }
  });
  assert.strictEqual(session.ruleset.rules, liveRules,
    'the SAME object mutates — the engine closure reads it live');
  assert.strictEqual(liveRules.contentCitizens, 6, "the save's difficulty applies");
  assert.strictEqual(liveRules.endYear, 2100, 'untouched base keys survive');
  assert.strictEqual(liveRules.combatRounds, 1,
    "the URL-era override family resets to base where the save doesn't override");
  assert.match(notice, /Trainer/, 'the visible notice names the loaded difficulty');
  assert.deepStrictEqual(ctx.rulesOverrides, { contentCitizens: 6 },
    'the next Shift+S envelope must stamp the LOADED overrides');
  // and it composes: a save built now records the loaded game's rules
  session.exportDiagnostics = () => ({ initialState: {}, log: [{}] });
  const envelope = buildSaveEnvelope(session, ctx);
  assert.deepStrictEqual(envelope.diag.rulesOverrides, { contentCitizens: 6 });
  // default-rules save ({}): applies too, resetting the URL override
  const notice2 = applyLoadedRules(session, ctx, {
    initialState: {}, log: [], rulesOverrides: {}
  });
  assert.strictEqual(liveRules.contentCitizens, 4, 'back to base rules');
  assert.strictEqual(notice2, null, 'default rules need no notice line');
  // pre-B16 save (no field): status quo, no notice
  liveRules.contentCitizens = 2;
  ctx.rulesOverrides = { contentCitizens: 2 };
  assert.strictEqual(applyLoadedRules(session, ctx, { initialState: {}, log: [] }), null);
  assert.strictEqual(liveRules.contentCitizens, 2, 'unknowable rules stay untouched');
});

// the finding itself, pinned on the real artifact (self-skips if absent):
// the user's turn-371 recording is SOUND — under the trainer ruleset it
// replays every entry clean to the save's own hash. If this ever reds, the
// engine changed behavior for this game's history (a real regression).
// The B16 finding (the envelope lost its difficulty, the recording itself is
// sound) still stands — the pre-B16 warning fires and applying the recorded
// difficulty is the fix. But this all-techs turn-325+ recording was captured
// with the PRE-B13 AI, which built obsolete phalanx late-game; B13's era-
// scaling makes the AI build the era successor, so the re-derived AI rounds
// now diverge from the recorded ones at the FIRST round (turn 326). The
// recording predates an intentional AI change — a revert of B13 would make it
// replay clean again, so this stays a live regression guard for B13's late-era
// AI (architect flagged @<B13 window> — re-record a fresh post-B13 witness if
// a clean-replay artifact is wanted).
test('B16/B13: the turn-371 save carries its difficulty; B13 re-scaled its late-era AI', async (t) => {
  const file = path.join(__dirname, '..', 'debugging', 'logs', 'retromulticiv-turn371.json');
  if (!fs.existsSync(file)) {
    t.skip('debugging/logs/retromulticiv-turn371.json not present');
    return;
  }
  const save = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { note, diag } = await normalizeReplayInput(save);
  assert.match(note, /pre-B16/, 'the artifact predates the fix — the warning must fire');
  diag.rulesOverrides = { contentCitizens: 6 }; // the measured actual difficulty
  const report = await replayDiagnostics(diag, JSON.parse(JSON.stringify(RULESET)));
  // (b) the pre-B13 late-era recording no longer replays identically
  assert.ok(report.problems.length > 0,
    '(b) B13 intentionally re-scaled the late-era AI — the recording diverges');
  // (a)+(b) explicit: the FIRST divergence is entry 28, the turn-326 ROUND.
  // Because problems are in entry order, entry 28 being first proves every
  // prior entry (0-27: the turn-325 HUMAN commands, plus the envelope
  // difficulty applied on load) replayed EXACT — the B16 property, still fully
  // witnessed. That the divergence is an AI ROUND (not a human cmd) is B13's
  // expected consequence; a revert of B13 removes it and this test screams.
  assert.match(report.problems[0], /^entry 28 \(round -> turn 326\)/,
    '(a) all turn-325 human commands replay exact; (b) the first AI round (326) diverges — B13 era-scaling');
});

// B13 fresh witness (architect @beaba272): a POST-B13 late-era all-AI recording
// carrying its trainer-difficulty rulesOverrides, generated after the era-
// scaling re-record. It replays CLEAN through the current engine — the live
// guard that succeeds the turn-371 artifact (which now witnesses B13's change
// rather than a clean replay). Self-skips if absent. Regenerate with
// debugging/ tooling if an intentional engine change invalidates it.
test('B13 witness: the post-B13 rulesOverrides recording replays clean', async (t) => {
  const file = path.join(__dirname, '..', 'debugging', 'logs', 'retromulticiv-witness-b13.json');
  if (!fs.existsSync(file)) {
    t.skip('debugging/logs/retromulticiv-witness-b13.json not present');
    return;
  }
  const save = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { note, diag } = await normalizeReplayInput(save);
  // it CARRIES its rulesOverrides (post-B16 envelope) — no pre-B16 warning
  assert.doesNotMatch(note, /pre-B16/, 'the witness records its own difficulty');
  assert.deepStrictEqual(diag.rulesOverrides, { contentCitizens: 6 }, 'trainer difficulty travels with the recording');
  const report = await replayDiagnostics(diag, JSON.parse(JSON.stringify(RULESET)));
  assert.deepStrictEqual(report.problems, [],
    'the post-B13 recording reproduces exactly — the fresh live guard');
  assert.ok(report.turn > 100, 'a genuine late-era game (100+ turns)');
});
