// Difficulty ladder (rulings #2155 + #2158): a 7-level rules.json `difficulties`
// table keyed by state.difficulty (ascii id). Knob CLASS split — WORLD knobs
// (contentCitizens/startGold/barbAtkPct) apply always (all-AI included); ASYMMETRIC
// AI-vs-human knobs (aiCostPct/aiFoodRows/bulb split) apply ONLY when a human seat
// exists. Fixture-FIRST (#1989): these assert behaviour the pre-difficulty engine
// (contentCitizens-only, no state.difficulty) had none of.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function mods() {
  return {
    diff: await import('../engine/difficulty.js'),
    happy: await import('../engine/happiness.js'),
    cities: await import('../engine/cities.js'),
    tech: await import('../engine/tech.js'),
    combat: await import('../engine/combat.js'),
    index: await import('../engine/index.js')
  };
}

// minimal all-grassland board
function board(w, h) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'grassland' });
  return { width: w, height: h, wrapX: false, tiles };
}

function baseState(players, playerOrder, difficulty) {
  const s = {
    version: 1, turn: 1, year: -4000, activePlayer: playerOrder[0], playerOrder,
    map: board(6, 6), units: {}, cities: {}, cityOrder: [], wonders: {},
    nextUnitId: 20, nextCityId: 5, players, rngState: 1
  };
  if (difficulty !== undefined) s.difficulty = difficulty;
  return s;
}
function mkPlayer(id, human) {
  return { id, name: id, color: '#00f', human, alive: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
}

test('difficultyOf + hasHumanSeat', async () => {
  const { diff } = await mods();
  const s = baseState({ p1: mkPlayer('p1', false) }, ['p1'], 'prince');
  assert.strictEqual(diff.difficultyOf(s, RULESET).barbAtkPct, 75, 'prince row read');
  assert.strictEqual(diff.hasHumanSeat(s), false, 'all-AI => no human seat');
  const s2 = baseState({ p1: mkPlayer('p1', true), p2: mkPlayer('p2', false) }, ['p1', 'p2'], 'prince');
  assert.strictEqual(diff.hasHumanSeat(s2), true, 'human present');
  const sNone = baseState({ p1: mkPlayer('p1', false) }, ['p1']);
  assert.strictEqual(diff.difficultyOf(sNone, RULESET), null, 'undefined difficulty => null (neutral)');
});

test('contentCitizens is a WORLD knob — applies in all-AI', async () => {
  const { happy } = await mods();
  // a pop-8 city working 8 tiles (no specialists): workers = 8, so
  // unhappy = 8 - contentCitizens exposes the difficulty knob.
  const workers = [18, 19, 20, 26, 28, 34, 35, 36]; // radius-2 tiles around (3,3) on 8x8
  const mkCity = () => ({ id: 'c1', name: 'C', owner: 'p1', x: 3, y: 3, pop: 8, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' }, workers: workers.slice() });
  const players = { p1: mkPlayer('p1', false) };
  const mkS = (d) => { const s = baseState(players, ['p1'], d); s.map = board(8, 8); s.cities = { c1: mkCity() }; s.cityOrder = ['c1']; return s; };
  const sGod = mkS('godemperor');
  const sPri = mkS('prince');
  const sNone = mkS(undefined);
  const god = happy.cityMood(sGod, sGod.cities.c1, RULESET);
  const pri = happy.cityMood(sPri, sPri.cities.c1, RULESET);
  const none = happy.cityMood(sNone, sNone.cities.c1, RULESET);
  // godemperor contentCitizens 1 => more unhappy than prince (4) even all-AI (world knob)
  assert.ok(god.unhappy > pri.unhappy, `godemperor unhappier all-AI (${god.unhappy} > ${pri.unhappy})`);
  assert.strictEqual(pri.unhappy, none.unhappy, 'prince == neutral (contentCitizens 4 both)');
});

test('aiCostPct is ASYMMETRIC — AI-only, human-gated', async () => {
  const { cities } = await mods();
  const def = { cost: 100 };
  const ai = mkPlayer('p2', false), human = mkPlayer('p1', true);
  // human game (human present): AI pays trainer aiCostPct 180%; human pays base.
  const sHuman = baseState({ p1: human, p2: ai }, ['p1', 'p2'], 'trainer');
  assert.strictEqual(cities.itemCost('unit', 'legion', def, ai, RULESET, sHuman), 180, 'AI cost *180% when human present');
  assert.strictEqual(cities.itemCost('unit', 'legion', def, human, RULESET, sHuman), 100, 'human pays base');
  // all-AI (no human): neutral, even at trainer.
  const sAllAi = baseState({ p2: ai }, ['p2'], 'trainer');
  assert.strictEqual(cities.itemCost('unit', 'legion', def, ai, RULESET, sAllAi), 100, 'all-AI => neutral base');
  // undefined difficulty => base
  const sNone = baseState({ p1: human, p2: ai }, ['p1', 'p2']);
  assert.strictEqual(cities.itemCost('unit', 'legion', def, ai, RULESET, sNone), 100, 'no difficulty => base');
});

test('growthThreshold aiFoodRows is ASYMMETRIC — AI-only, human-gated', async () => {
  const { cities } = await mods();
  const ai = mkPlayer('p2', false), human = mkPlayer('p1', true);
  const city = { id: 'c1', owner: 'p2', pop: 1 };
  const hCity = { id: 'c2', owner: 'p1', pop: 1 };
  // human game, godemperor aiFoodRows 6 => AI threshold 6*(1+1)=12; human 10*2=20
  const sHuman = baseState({ p1: human, p2: ai }, ['p1', 'p2'], 'godemperor');
  assert.strictEqual(cities.growthThreshold(sHuman, city, RULESET), 12, 'AI godemperor rows 6');
  assert.strictEqual(cities.growthThreshold(sHuman, hCity, RULESET), 20, 'human always rows 10');
  // all-AI => neutral 10 rows => 20
  const sAllAi = baseState({ p2: ai }, ['p2'], 'godemperor');
  assert.strictEqual(cities.growthThreshold(sAllAi, city, RULESET), 20, 'all-AI neutral rows 10');
  // undefined => 20
  const sNone = baseState({ p2: ai }, ['p2']);
  assert.strictEqual(cities.growthThreshold(sNone, city, RULESET), 20, 'no difficulty => rows 10');
});

test('bulb split is ASYMMETRIC — coeff swap, human-gated', async () => {
  const { tech } = await mods();
  const ai = mkPlayer('p2', false), human = mkPlayer('p1', true);
  ai.techs = ['a', 'b']; human.techs = ['a', 'b']; // known=2 => *(known+1)=3
  // human game, emperor aiBulbInc 10 / humanBulbInc 14
  const sHuman = baseState({ p1: human, p2: ai }, ['p1', 'p2'], 'emperor');
  assert.strictEqual(tech.researchCost(sHuman, 'p2', RULESET), 30, 'AI coeff aiBulbInc 10 *3');
  assert.strictEqual(tech.researchCost(sHuman, 'p1', RULESET), 42, 'human coeff humanBulbInc 14 *3');
  // all-AI => techBaseCost 10 *3 = 30
  const sAllAi = baseState({ p2: ai }, ['p2'], 'emperor');
  assert.strictEqual(tech.researchCost(sAllAi, 'p2', RULESET), 30, 'all-AI neutral techBaseCost 10');
  // undefined => techBaseCost 10
  const sNone = baseState({ p2: ai }, ['p2']); sNone.players.p2.techs = ['a', 'b'];
  assert.strictEqual(tech.researchCost(sNone, 'p2', RULESET), 30, 'no difficulty => techBaseCost');
});

test('startGold is a WORLD knob — createGame stamps difficulty + adds gold (all-AI too)', async () => {
  const { index } = await mods();
  const eng = index.createEngine(RULESET);
  const setup = (difficulty) => ({ seed: 7, options: { width: 20, height: 16, difficulty, players: [
    { id: 'p1', name: 'A', color: '#f00', human: false },
    { id: 'p2', name: 'B', color: '#00f', human: false }
  ] } });
  const chief = eng.createGame(setup('chieftain'));
  assert.strictEqual(chief.difficulty, 'chieftain', 'difficulty stamped');
  assert.strictEqual(chief.players.p1.gold, 50, 'chieftain startGold 50 (all-AI, world knob)');
  const prince = eng.createGame(setup('prince'));
  assert.strictEqual(prince.players.p1.gold, 0, 'prince startGold 0');
  // default + unknown => prince
  const dflt = eng.createGame(setup(undefined));
  assert.strictEqual(dflt.difficulty, 'prince', 'default difficulty prince');
  const bogus = eng.createGame(setup('bogus'));
  assert.strictEqual(bogus.difficulty, 'prince', 'unknown difficulty => prince');
});

test('barbAtkPct is a WORLD knob — barb attacker strength scales (win-rate)', async () => {
  const { combat } = await mods();
  // a barb legion (attack 4) strikes a lone militia (defense 1) on grassland; run
  // many seeds at trainer (barbAtkPct 10) vs godemperor (150) — barbs win strictly
  // more at godemperor. World knob: applies all-AI.
  function trial(difficulty, seed) {
    const s = baseState({ p1: mkPlayer('p1', false) }, ['p1'], difficulty);
    s.players.barb = { id: 'barb', name: 'Barbarians', color: '#000', human: false, alive: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 0, sciRate: 0 };
    s.playerOrder = ['p1', 'barb'];
    s.rngState = seed;
    s.units = {
      a: { id: 'a', type: 'legion', owner: 'barb', x: 2, y: 2, moves: 1, fortified: false, veteran: false },
      d: { id: 'd', type: 'militia', owner: 'p1', x: 3, y: 2, moves: 0, fortified: false, veteran: false }
    };
    const r = combat.resolveAttack(s, s.units.a, 3, 2, RULESET);
    return r.ok !== false && s.units.d === undefined; // defender destroyed => barb won
  }
  let winT = 0, winG = 0, N = 300;
  for (let seed = 1; seed <= N; seed++) {
    if (trial('trainer', seed)) winT++;
    if (trial('godemperor', seed)) winG++;
  }
  assert.ok(winG > winT + 50, `godemperor barbs win far more (${winG} vs ${winT} of ${N})`);
});
