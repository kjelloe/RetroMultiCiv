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

test('trade converts to bulbs and discovers techs with overflow carry', async () => {
  const { engine } = await load();
  let state = labState({ researching: 'bronze-working' });
  // 3 trade × 100% sci = 3 bulbs/turn; first tech costs 10 → discovered on turn 4 (12 bulbs)
  for (let i = 0; i < 4; i++) {
    const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
    assert.strictEqual(res.ok, true);
    state = res.state;
  }
  assert.deepStrictEqual(state.players.p1.techs, ['bronze-working']);
  assert.strictEqual(state.players.p1.bulbs, 2, 'overflow carries');
  assert.strictEqual(state.players.p1.researching, '');
  assert.strictEqual(state.players.p1.gold, 0, 'tax rate 0 yields no gold');
});

test('tax rate converts trade to gold; setRates validates', async () => {
  const { engine } = await load();
  let state = labState({ taxRate: 100, sciRate: 0 });
  assert.strictEqual(engine.applyCommand(state, { type: 'setRates', playerId: 'p1', tax: 55, sci: 45 }).reason, 'badRates');
  assert.strictEqual(engine.applyCommand(state, { type: 'setRates', playerId: 'p1', tax: 90, sci: 20 }).reason, 'badRates');
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.players.p1.gold, 3);
  assert.strictEqual(res.state.players.p1.bulbs, 0);
});

test('marketplace boosts tax gold; maintenance drains it', async () => {
  const { engine } = await load();
  // 3 trade, 100% tax: base 3 gold; marketplace +50% => 4; maintenance 1 => +3/turn
  let state = labState({ taxRate: 100, sciRate: 0 });
  state.cities.c1.buildings = ['marketplace'];
  const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.players.p1.gold, 3);

  // maintenance alone can never push gold below zero (clamped)
  let poor = labState({ taxRate: 0, sciRate: 100 });
  poor.cities.c1.buildings = ['city-walls']; // maintenance 2, no income
  const drained = engine.applyCommand(poor, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(drained.state.players.p1.gold, 0);
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
