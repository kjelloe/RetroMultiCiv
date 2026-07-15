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
test('B16: the turn-371 save replays clean under its actual difficulty', async (t) => {
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
  assert.deepStrictEqual(report.problems, [],
    'the recording was never divergent — only the extraction lost the difficulty');
  assert.strictEqual(report.turn, 371);
});
