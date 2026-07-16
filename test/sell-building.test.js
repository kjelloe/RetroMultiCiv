// A86: the player can sell a city building for gold (Civ 1). The `sellBuilding`
// command removes the improvement, credits its shield cost × rules.sellPriceRatio,
// and enforces ONE sale per city per turn (omit-safe city.soldThisTurn, cleared
// at the wrap). It shares the removal+credit helper with the B13/A63 tech-
// obsolescence auto-sell — one implementation, two triggers. Cross-language:
// test/scenarios/025-sell-building.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

function craft(buildings) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 20, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {},
    cities: { c1: { id: 'c1', name: 'Rome', owner: 'p1', x: 2, y: 2, pop: 3, food: 0, shields: 0, buildings: buildings.slice(), producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 5, nextCityId: 5,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

test('A86: selling a building credits its shield cost and removes it', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(['barracks']), { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'barracks' });
  assert.ok(res.ok, `sell ok: ${res.reason}`);
  const st = res.state;
  assert.strictEqual(st.cities.c1.buildings.indexOf('barracks'), -1, 'barracks removed');
  assert.strictEqual(st.players.p1.gold, RULESET.buildings.barracks.cost * RULESET.rules.sellPriceRatio, 'gold credited = cost × ratio');
  assert.strictEqual(st.cities.c1.soldThisTurn, true, 'the one-sale flag is set');
  const ev = res.events.find(e => e.type === 'buildingSold' && e.building === 'barracks');
  assert.ok(ev && ev.reason === 'manual' && ev.playerId === 'p1', 'buildingSold event (manual)');
});

test('A86: only one sale per city per turn', async () => {
  const engine = await load();
  const first = engine.applyCommand(craft(['barracks', 'granary']), { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'barracks' });
  const second = engine.applyCommand(first.state, { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'granary' });
  assert.ok(!second.ok, 'a second sale is rejected');
  assert.strictEqual(second.reason, 'alreadySoldThisTurn');
});

test('A86: the turn wrap clears the sold flag — sell again next turn', async () => {
  const engine = await load();
  const sold = engine.applyCommand(craft(['barracks', 'granary']), { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'barracks' });
  const wrapped = engine.applyCommand(sold.state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(wrapped.state.cities.c1.soldThisTurn, undefined, 'flag cleared at the wrap (omit-safe)');
  const again = engine.applyCommand(wrapped.state, { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'granary' });
  assert.ok(again.ok, 'can sell again the next turn');
});

test('A86: cannot sell the palace, or a building the city lacks', async () => {
  const engine = await load();
  const noPalace = engine.applyCommand(craft(['palace']), { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'palace' });
  assert.ok(!noPalace.ok && noPalace.reason === 'cannotSellPalace', 'the palace is not sellable');
  const missing = engine.applyCommand(craft(['barracks']), { type: 'sellBuilding', playerId: 'p1', cityId: 'c1', building: 'granary' });
  assert.ok(!missing.ok && missing.reason === 'noSuchBuilding', 'cannot sell what is not built');
});

test('A86 shared-path guard: the B13 tech-obsolescence auto-sell still works', async () => {
  const engine = await load();
  // p1 one endTurn from gunpowder (obsoletes barracks); the auto-sell uses the
  // SAME helper and must still remove + credit exactly as before (reason obsolete).
  const st = craft(['barracks']);
  st.players.p1.techs = ['iron-working', 'invention', 'feudalism'];
  st.players.p1.researching = 'gunpowder';
  st.players.p1.bulbs = 99999;
  const res = engine.applyCommand(st, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.cities.c1.buildings.indexOf('barracks'), -1, 'barracks auto-sold on gunpowder');
  const ev = res.events.find(e => e.type === 'buildingSold' && e.building === 'barracks');
  assert.ok(ev && ev.reason === 'obsolete', 'auto-sell tagged obsolete');
  assert.strictEqual(res.state.cities.c1.soldThisTurn, undefined, 'auto-sell does NOT consume the manual one-sale slot');
});
