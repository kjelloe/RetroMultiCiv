// Ruleset-compatibility pin (specs/ruleset-compat-policy.md): createGame stamps
// state.rulesetHash (the statehash of the creation ruleset); load is strict by
// default (mismatch refuses, --allow-ruleset-drift overrides); omit-safe for
// older/crafted saves without the field. Fixture-first for the golden window.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function loadMods() {
  const mapgen = await import('../engine/mapgen.js');
  const { hashState } = await import('../shared/statehash.js');
  const server = await import('../server/game.js');
  return { engineCreate: mapgen.createGame, hashState, serverCreate: server.createGame };
}

const SETUP = { seed: 7, options: { width: 40, height: 30, players: [
  { id: 'p1', name: 'R', color: '#3b7dd8', human: true },
  { id: 'p2', name: 'Z', color: '#d84a3b', human: false }
] } };

test('ruleset-pin: createGame stamps state.rulesetHash = the ruleset statehash', async () => {
  const { engineCreate, hashState } = await loadMods();
  const state = engineCreate(SETUP, RULESET);
  const expected = '0x' + (hashState(RULESET) >>> 0).toString(16).padStart(8, '0');
  assert.strictEqual(state.rulesetHash, expected, 'the pin equals the ruleset hash');
  assert.match(state.rulesetHash, /^0x[0-9a-f]{8}$/, 'printable-ASCII 0x-hex form');
});

test('ruleset-pin: server load is strict — match loads, mismatch refuses without the override', async () => {
  const { serverCreate } = await loadMods();
  const g = serverCreate({ ruleset: RULESET, gameId: 'rc', setup: SETUP });
  const save = g.toSave();
  assert.ok(save.state.rulesetHash, 'the save envelope carries the pin');
  // matching hash -> loads
  assert.doesNotThrow(() => serverCreate({ ruleset: RULESET, save }), 'a matching ruleset resumes');
  // mismatch -> refuses (a mid-game rules upgrade would diverge silently)
  const drifted = JSON.parse(JSON.stringify(save));
  drifted.state.rulesetHash = '0xdeadbeef';
  assert.throws(() => serverCreate({ ruleset: RULESET, save: drifted }), /ruleset drift/,
    'a drifted ruleset is refused by default');
  // mismatch + --allow-ruleset-drift -> loads anyway
  assert.doesNotThrow(() => serverCreate({ ruleset: RULESET, save: drifted, allowRulesetDrift: true }),
    'the override loads a drifted save');
});

test('ruleset-pin: omit-safe — a save without the field loads unchecked (back-compat)', async () => {
  const { serverCreate } = await loadMods();
  const g = serverCreate({ ruleset: RULESET, gameId: 'rc2', setup: SETUP });
  const save = g.toSave();
  delete save.state.rulesetHash; // an older, pre-pin save
  assert.doesNotThrow(() => serverCreate({ ruleset: RULESET, save }), 'no pin -> no check');
});
