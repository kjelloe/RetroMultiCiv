const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const tech = await import('../engine/tech.js');
  const { createEngine } = await import('../engine/index.js');
  return { tech, engine: createEngine(RULESET) };
}

function labState(extraPlayer) {
  // one-tile island city with 3 trade/turn: river shield-grassland center (1)
  // + one worked ocean tile (2)
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'ocean' });
  tiles[4] = { t: 'grassland', river: true, special: true };
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {},
    cities: {
      c1: { id: 'c1', name: 'Lab', owner: 'p1', x: 1, y: 1, pop: 1, food: 0, shields: 0, producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], nextUnitId: 1, nextCityId: 2,
    players: {
      p1: Object.assign({
        id: 'p1', name: 'A', color: '#00f', human: true, gold: 0,
        techs: [], researching: '', bulbs: 0, taxRate: 0, sciRate: 100
      }, extraPlayer || {})
    },
    rngState: 1
  };
}

test('tech dataset: 68 advances, resolvable prereqs, seven Civ 1 roots', () => {
  const ids = Object.keys(RULESET.techs);
  assert.strictEqual(ids.length, 68);
  for (const id of ids) {
    for (const p of RULESET.techs[id].prereqs) {
      assert.ok(RULESET.techs[p], `${id} prereq ${p} must exist`);
    }
  }
  const roots = ids.filter(id => RULESET.techs[id].prereqs.length === 0).sort();
  assert.deepStrictEqual(roots, ['alphabet', 'bronze-working', 'ceremonial-burial',
    'horseback-riding', 'masonry', 'pottery', 'wheel']);
});

test('availableTechs: roots first, prereqs unlock children', async () => {
  const { tech } = await load();
  const state = labState();
  const roots = tech.availableTechs(state, 'p1', RULESET);
  assert.ok(roots.includes('alphabet') && !roots.includes('writing'));

  state.players.p1.techs = ['alphabet'];
  const next = tech.availableTechs(state, 'p1', RULESET);
  assert.ok(next.includes('writing'), 'Writing unlocks after Alphabet');
  assert.ok(!next.includes('alphabet'), 'known techs are not offered');
});

test('research cost escalates with techs known (Civ 1 global escalation)', async () => {
  const { tech } = await load();
  const state = labState();
  assert.strictEqual(tech.researchCost(state, 'p1', RULESET), 10);
  state.players.p1.techs = ['alphabet', 'pottery', 'masonry'];
  assert.strictEqual(tech.researchCost(state, 'p1', RULESET), 40);
});

test('setResearch validates prereqs and duplicates', async () => {
  const { engine } = await load();
  const state = labState();
  assert.strictEqual(engine.applyCommand(state, { type: 'setResearch', playerId: 'p1', tech: 'writing' }).reason, 'prereqsMissing');
  assert.strictEqual(engine.applyCommand(state, { type: 'setResearch', playerId: 'p1', tech: 'nonsense' }).reason, 'unknownTech');
  const ok = engine.applyCommand(state, { type: 'setResearch', playerId: 'p1', tech: 'alphabet' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.state.players.p1.researching, 'alphabet');
});

test('#29 science wonders compose on the city science (copernicus/seti/newton, R3 non-cumulative)', async () => {
  const { tech } = await load();
  const ps = RULESET.rules.specialistOutput;
  const bulbs = (buildings, wonders) => {
    const s = labState();
    s.cities.c1.buildings = buildings;
    s.wonders = wonders;
    return tech.cityEconOutput(s, s.cities.c1, 0, 100, ps, RULESET).bulbs;
  };
  assert.strictEqual(bulbs([], {}), 4, 'base: 4 trade x 100% sci');
  assert.strictEqual(bulbs([], { 'copernicus-observatory': 'c1' }), 8, 'copernicus +100% in its city');
  assert.strictEqual(bulbs([], { 'seti-program': 'c1' }), 6, 'seti +50% every city');
  assert.strictEqual(bulbs(['library'], {}), 6, 'library +50% sciBonus');
  assert.strictEqual(bulbs(['library'], { 'isaac-newton-s-college': 'c1' }), 7, 'newton +66% of the library science');
  assert.strictEqual(bulbs(['library'], { 'isaac-newton-s-college': 'c1', 'seti-program': 'c1' }), 8,
    'R3: seti supersedes newton — newton +66% suppressed (8 = seti-only, not 7+seti)');
});

test('#29 darwin: 2 free advances on completion (lowest-level, sortIds tie-break, one-time)', async () => {
  const { tech } = await load();
  const s = labState();
  s.wonders = {};
  s.players.p1.techs = [];
  // the build emits wonderBuilt; processWonderTechs grants the 2 lowest-LEVEL researchable
  // techs (all 7 roots are level 1, so the sortIds tie-break — length then alpha — decides).
  const events = [{ type: 'wonderBuilt', cityId: 'c1', wonder: 'darwin-s-voyage' }];
  tech.processWonderTechs(s, RULESET, events);
  assert.strictEqual(s.players.p1.techs.length, 2, 'darwin grants exactly 2');
  assert.deepStrictEqual(s.players.p1.techs, ['wheel', 'masonry'], 'the 2 lowest by level then sortIds');
  for (const t of s.players.p1.techs) assert.strictEqual(RULESET.techs[t].level, 1, 'both level-1 roots');
  // one-time: re-running with no fresh wonderBuilt event grants nothing more
  tech.processWonderTechs(s, RULESET, []);
  assert.strictEqual(s.players.p1.techs.length, 2, 'no wonderBuilt event -> no further grant');
});

test('#29 great-library: lowest sorted tech id known by >=2 OTHER civs, one per turn', async () => {
  const { tech } = await load();
  const s = labState();
  s.playerOrder = ['p1', 'p2', 'p3'];
  s.players.p1.techs = [];
  s.players.p2 = { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: ['alphabet', 'pottery'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  s.players.p3 = { id: 'p3', name: 'C', color: '#0f0', human: false, gold: 0, techs: ['alphabet', 'writing'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  s.wonders = { 'great-library': 'c1' }; // owner p1, active (no one has university)
  tech.processWonderTechs(s, RULESET, []);
  // alphabet is known by p2 AND p3 (>=2 others); pottery/writing only one each.
  assert.deepStrictEqual(s.players.p1.techs, ['alphabet'], 'grants alphabet (>=2 others), one per turn');
  // once p1 has alphabet, the next turn finds no new >=2-other tech -> no grant
  tech.processWonderTechs(s, RULESET, []);
  assert.deepStrictEqual(s.players.p1.techs, ['alphabet'], 'no further catch-up available');
});

test('trade converts to bulbs and discovers techs with overflow carry', async () => {
  const { engine } = await load();
  let state = labState({ researching: 'bronze-working' });
  // 4 trade (3 worked + 1 capital bonus, VI.2) × 100% sci = 4 bulbs/turn;
  // first tech costs 10 → discovered on turn 3 (12 bulbs), carry 2 + 4 more
  for (let i = 0; i < 4; i++) {
    const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
    assert.strictEqual(res.ok, true);
    state = res.state;
  }
  assert.deepStrictEqual(state.players.p1.techs, ['bronze-working']);
  assert.strictEqual(state.players.p1.bulbs, 6, 'overflow carries (2) + one more 4-bulb turn');
  assert.strictEqual(state.players.p1.researching, '');
  assert.strictEqual(state.players.p1.gold, 0, 'tax rate 0 yields no gold');
});

test('tax rate converts trade to gold; setRates validates', async () => {
  const { engine } = await load();
  let state = labState({ taxRate: 100, sciRate: 0 });
  assert.strictEqual(engine.applyCommand(state, { type: 'setRates', playerId: 'p1', tax: 55, sci: 45 }).reason, 'badRates');
  assert.strictEqual(engine.applyCommand(state, { type: 'setRates', playerId: 'p1', tax: 90, sci: 20 }).reason, 'badRates');
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.players.p1.gold, 4, '3 worked + 1 capital bonus (VI.2)');
  assert.strictEqual(res.state.players.p1.bulbs, 0);
});

test('marketplace boosts tax gold; maintenance drains it', async () => {
  const { engine } = await load();
  // 4 trade (3 worked + 1 capital, VI.2), 100% tax: base 4 gold;
  // marketplace +50% => 6; maintenance 1 => +5/turn
  let state = labState({ taxRate: 100, sciRate: 0 });
  state.cities.c1.buildings = ['marketplace'];
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.players.p1.gold, 5);

  // maintenance alone can never push gold below zero (clamped)
  let poor = labState({ taxRate: 0, sciRate: 100 });
  poor.cities.c1.buildings = ['city-walls']; // maintenance 2, no income
  const drained = engine.applyCommand(poor, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(drained.state.players.p1.gold, 0);
});

test('playerIncome forecasts exactly what processResearch applies (HUD contract)', async () => {
  const { tech, engine } = await load();
  const state = labState({ taxRate: 50, sciRate: 50 });
  state.cities.c1.buildings = ['marketplace']; // taxBonus 50, maintenance 1
  const income = tech.playerIncome(state, 'p1', RULESET);
  const after = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(after.players.p1.gold, income.gold - income.maintenance);
  assert.strictEqual(after.players.p1.bulbs, income.bulbs);
  // pure: forecasting must not touch the state
  assert.strictEqual(state.players.p1.gold, 0);
  assert.strictEqual(state.players.p1.bulbs, 0);
});

test('production is tech-gated', async () => {
  const { engine } = await load();
  const state = labState();
  const blocked = engine.applyCommand(state, { type: 'setProduction', playerId: 'p1', cityId: 'c1', item: { kind: 'unit', id: 'phalanx' } });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reason, 'techRequired');

  state.players.p1.techs = ['bronze-working'];
  const allowed = engine.applyCommand(state, { type: 'setProduction', playerId: 'p1', cityId: 'c1', item: { kind: 'unit', id: 'phalanx' } });
  assert.strictEqual(allowed.ok, true);
});

// XII.2 Future Tech (specs/xii2-future-tech.md): the repeatable end-of-tree science sink.
function exhaustedState() {
  return labState({ techs: Object.keys(RULESET.techs).slice(), researching: '', bulbs: 0, taxRate: 0, sciRate: 100 });
}

test('XII.2: an exhausted tree offers ONLY the Future Tech sentinel; a live tree never does', async () => {
  const { tech } = await load();
  assert.deepStrictEqual(tech.availableTechs(exhaustedState(), 'p1', RULESET), [tech.FUTURE_TECH_ID]);
  const avail = tech.availableTechs(labState({ techs: [] }), 'p1', RULESET);
  assert.ok(avail.length > 1 && avail.indexOf(tech.FUTURE_TECH_ID) === -1, 'a live tree returns real techs, no sentinel');
});

test('XII.2: setResearch accepts the sentinel only when the tree is exhausted', async () => {
  const { tech, engine } = await load();
  const ok = engine.applyCommand(exhaustedState(), { type: 'setResearch', playerId: 'p1', tech: tech.FUTURE_TECH_ID });
  assert.ok(ok.ok, `sentinel accepted when exhausted: ${ok.reason}`);
  assert.strictEqual(ok.state.players.p1.researching, tech.FUTURE_TECH_ID);
  const no = engine.applyCommand(labState({ techs: [] }), { type: 'setResearch', playerId: 'p1', tech: tech.FUTURE_TECH_ID });
  assert.strictEqual(no.reason, 'treeNotExhausted', 'the sentinel is rejected while real techs remain');
});

test('XII.2: completing Future Tech increments the counter, repeats, and escalates cost — never enters techs', async () => {
  const { tech } = await load();
  const s = exhaustedState();
  s.players.p1.researching = tech.FUTURE_TECH_ID;
  const known = s.players.p1.techs.length;
  const cost1 = tech.researchCost(s, 'p1', RULESET);
  assert.strictEqual(cost1, RULESET.rules.techBaseCost * (known + 1), 'first Future Tech costs techBaseCost*(known+1)');
  s.players.p1.bulbs = cost1;
  const events = [];
  tech.processResearch(s, RULESET, events);
  assert.strictEqual(s.players.p1.futureTech, 1, 'the counter increments');
  assert.strictEqual(s.players.p1.researching, tech.FUTURE_TECH_ID, 'the sink repeats immediately');
  assert.strictEqual(s.players.p1.techs.length, known, 'no synthetic id enters player.techs');
  assert.ok(events.some(e => e.type === 'futureTechResearched' && e.playerId === 'p1' && e.n === 1), 'a futureTechResearched event carries N');
  assert.strictEqual(tech.researchCost(s, 'p1', RULESET), RULESET.rules.techBaseCost * (known + 2), 'the next level costs one step more');
});
