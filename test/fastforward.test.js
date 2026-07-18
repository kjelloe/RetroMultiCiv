// A20: the starting-age fast-forward helper (shared/fastforward.js) — a pure
// engine-API consumer, so it must be exactly deterministic and its tech grant
// exactly the era union.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');
const ff = import('../shared/fastforward.js');
const eng = import('../engine/index.js');
const sh = import('../shared/statehash.js');
let fastForwardTo, applyAgeGrant, createEngine, hashState;
test.before(async () => {
  ({ fastForwardTo, applyAgeGrant } = await ff);
  ({ createEngine } = await eng);
  ({ hashState } = await sh);
});

function freshWorld(seed) {
  // 56x35 with 4 civs: room enough that the fixture seed survives to turn 190.
  // Re-pinned to seed 2 on 2026-07-18 for the N13/A4 goody-hut golden move (the
  // village sprinkle + advances reshuffled seed 1 into an early conquest / abort
  // path; small worlds often end in conquest first — that is the abort path).
  // (Was seed 1 for the 2026-07-17 stance-mix v1 move.)
  const players = [];
  for (let i = 0; i < 4; i++) {
    players.push({ id: 'p' + (i + 1), name: 'Civ' + (i + 1), color: '#3b7dd8', human: false });
  }
  return createEngine(RULESET).createGame({ seed, options: { width: 56, height: 35, players } });
}

function ageById(id) {
  return RULESET.rules.ages.find(a => a.id === id);
}

test('era guard: all 68 techs classified, bucket sizes 22/15/14/17', () => {
  const sizes = {};
  for (const id of Object.keys(RULESET.techs)) {
    const era = RULESET.techs[id].era;
    assert.ok(era, `tech ${id} has no era`);
    sizes[era] = (sizes[era] || 0) + 1;
  }
  assert.deepStrictEqual(sizes,
    { ancient: 22, renaissance: 15, industrial: 14, modern: 17 });
});

test('fast-forward is deterministic: same seed + age → identical state hash', () => {
  const age = ageById('renaissance');
  const a = fastForwardTo(RULESET, freshWorld(2), age, ['p1']);
  const b = fastForwardTo(RULESET, freshWorld(2), age, ['p1']);
  assert.ok(!a.aborted && !b.aborted, 'both runs complete');
  assert.strictEqual(a.state.turn, age.turn, 'stops at the age turn');
  assert.strictEqual(hashState(a.state), hashState(b.state), 'byte-identical worlds');
  assert.strictEqual(a.state.players.p1.human, true, 'the chosen seat is human at takeover');
  assert.strictEqual(a.state.players.p2.human, false, 'others stay AI');
});

test('the grant is the era union for EVERY player, research reset', () => {
  const age = ageById('renaissance'); // grants the 22 ancient techs
  const r = fastForwardTo(RULESET, freshWorld(2), age, ['p1']);
  const ancient = Object.keys(RULESET.techs).filter(t => RULESET.techs[t].era === 'ancient').sort();
  assert.deepStrictEqual(r.grant, ancient);
  for (const pid of r.state.playerOrder) {
    const p = r.state.players[pid];
    for (const t of ancient) assert.ok(p.techs.includes(t), `${pid} missing granted ${t}`);
    assert.strictEqual(p.researching, '', `${pid} picks research fresh`);
    assert.strictEqual(p.bulbs, 0, `${pid} carries no bulbs`);
  }
});

test('Space Age grants everything except Future Tech', () => {
  const state = freshWorld(5);
  const grant = applyAgeGrant(state, ageById('space'), RULESET);
  assert.strictEqual(grant.includes('future-tech'), false, 'future-tech excluded');
  assert.strictEqual(grant.length, 67, '68 advances minus future-tech');
});

test('a to-be-human civ dying aborts with its name — never a silent re-roll', () => {
  // seed re-verified 2026-07-17 after B23b (phased scouting reshuffled early
  // conquest: seed 23's p1 now survives, seed 42 conquers Civ1 early again —
  // the abort path). The seed is a fixture, re-pinned whenever war/scout goldens move.
  const r = fastForwardTo(RULESET, freshWorld(42), ageById('renaissance'), ['p1']);
  assert.ok(r.aborted, 'seed 42 eliminates p1 early');
  assert.strictEqual(r.aborted.reason, 'civEliminated');
  assert.strictEqual(r.aborted.name, 'Civ1', 'the message can name the dead civ');
});

test('Ancient age is a no-op (today\'s behavior)', () => {
  const w = freshWorld(9);
  const before = hashState(w);
  const r = fastForwardTo(RULESET, w, ageById('ancient'), ['p1']);
  assert.strictEqual(hashState(r.state), before, 'state untouched');
});
