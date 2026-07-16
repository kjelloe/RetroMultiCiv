// B13/A63: discovering an obsoleting tech SELLS the buildings it retires —
// barracks at Gunpowder (and again at Combustion). The building is removed and
// its full build cost (rules.sellPriceRatio) credited as gold with a
// buildingSold event. Unit-obsolescence (units leave the catalog) is pinned
// cross-language in test/scenarios/015-obsolescence.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// single-player so one endTurn wraps the turn and runs processResearch
function craft(cityBuildings, researching) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 50, year: -2000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {},
    cities: { c1: { id: 'c1', name: 'Rome', owner: 'p1', x: 2, y: 2, pop: 3, food: 0, shields: 0, buildings: cityBuildings, producing: { kind: 'unit', id: 'settlers' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: { p1: { id: 'p1', name: 'Romans', color: '#00f', human: false, gold: 0, techs: ['iron-working', 'invention', 'feudalism'], researching, bulbs: 99999, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

test('B13: discovering gunpowder sells barracks for gold with a buildingSold event', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(['barracks'], 'gunpowder'), { type: 'endTurn', playerId: 'p1' });
  assert.ok(res.ok, 'endTurn ok');
  const st = res.state;
  assert.ok(st.players.p1.techs.indexOf('gunpowder') !== -1, 'gunpowder discovered');
  assert.strictEqual(st.cities.c1.buildings.indexOf('barracks'), -1, 'barracks removed (sold)');
  const sold = res.events.find(e => e.type === 'buildingSold' && e.building === 'barracks');
  assert.ok(sold, 'a buildingSold event fires');
  assert.strictEqual(sold.gold, 40, 'credited the full build cost (sellPriceRatio 1)');
  assert.strictEqual(sold.cityId, 'c1');
  assert.strictEqual(sold.playerId, 'p1');
});

test('B13: no barracks means nothing to sell; an unrelated tech sells nothing', async () => {
  const engine = await load();
  const r1 = engine.applyCommand(craft([], 'gunpowder'), { type: 'endTurn', playerId: 'p1' });
  assert.ok(!r1.events.some(e => e.type === 'buildingSold'), 'no barracks: nothing sold');
  // a barracks survives a NON-obsoleting discovery
  const r2 = engine.applyCommand(craft(['barracks'], 'feudalism2'), { type: 'endTurn', playerId: 'p1' });
  assert.ok(r2.state.cities.c1.buildings.indexOf('barracks') !== -1, 'barracks survives a non-obsoleting tech');
});
