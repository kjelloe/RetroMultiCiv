// A83: a caravan standing in a DOMESTIC city that is building a wonder adds its
// build cost in shields (units.json caravan.cost = 50) and is consumed — Civ 1's
// "help build wonder?" prompt. Human-only command (helpWonder); the AI never
// builds caravans, so the sim goldens are untouched. Cross-language contract is
// pinned in test/scenarios/018-caravan-wonder.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// single-player grassland; a caravan parked on the city's own tile (legal
// stacking) and the city one caravan short of a Pyramid (250/300).
function craft(overrides) {
  overrides = overrides || {};
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  const producing = overrides.producing || { kind: 'wonder', id: 'pyramids' };
  const unitType = overrides.unitType || 'caravan';
  const unitOwner = overrides.unitOwner || 'p1';
  const cityOwner = overrides.cityOwner || 'p1';
  const ux = overrides.ux === undefined ? 2 : overrides.ux;
  const uy = overrides.uy === undefined ? 2 : overrides.uy;
  const players = {
    p1: { id: 'p1', name: 'Romans', color: '#00f', human: false, gold: 0, techs: ['masonry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
  };
  if (cityOwner === 'p2' || unitOwner === 'p2') {
    players.p2 = { id: 'p2', name: 'Greeks', color: '#0f0', human: false, gold: 0, techs: ['masonry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  }
  return {
    version: 1, turn: 50, year: -2000, activePlayer: 'p1',
    playerOrder: Object.keys(players),
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: unitType, owner: unitOwner, x: ux, y: uy, moves: 1, fortified: false, veteran: false } },
    cities: { c1: { id: 'c1', name: 'Rome', owner: cityOwner, x: 2, y: 2, pop: 3, food: 0, shields: 250, buildings: [], producing } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players, rngState: 1
  };
}

test('A83: a caravan in a wonder-building home city adds its cost and is consumed', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(res.ok, `helpWonder ok: ${res.reason}`);
  const st = res.state;
  assert.strictEqual(st.units.u1, undefined, 'caravan consumed');
  assert.strictEqual(st.cities.c1.shields, 300, '250 + caravan cost 50');
  const ev = res.events.find(e => e.type === 'wonderHelped');
  assert.ok(ev, 'a wonderHelped event fires');
  assert.strictEqual(ev.cityId, 'c1');
  assert.strictEqual(ev.unitId, 'u1');
  assert.strictEqual(ev.wonder, 'pyramids');
  assert.strictEqual(ev.shields, 50, 'shields added = caravan build cost (data-driven)');
});

test('A83: the filled box completes the wonder at the next turn wrap', async () => {
  const engine = await load();
  const helped = engine.applyCommand(craft(), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(helped.ok);
  const wrap = engine.applyCommand(helped.state, { type: 'endTurn', playerId: 'p1' });
  assert.ok(wrap.ok);
  assert.strictEqual(wrap.state.wonders.pyramids, 'c1', 'Pyramids built');
  assert.ok(wrap.events.some(e => e.type === 'wonderBuilt' && e.wonder === 'pyramids'), 'wonderBuilt fires at the wrap');
});

test('A83: rejected when the city is not building a wonder', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft({ producing: { kind: 'unit', id: 'militia' } }), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(!res.ok, 'rejected');
  assert.strictEqual(res.reason, 'notBuildingWonder');
});

test('A83: only helpsWonder units qualify — a militia cannot help', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft({ unitType: 'militia' }), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(!res.ok, 'rejected');
  assert.strictEqual(res.reason, 'cannotHelpWonder');
});

test('A83: rejected when the caravan stands on no city', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft({ ux: 0, uy: 0 }), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(!res.ok, 'rejected');
  assert.strictEqual(res.reason, 'noCityHere');
});

test('A83: a caravan cannot help a foreign city (domestic only)', async () => {
  const engine = await load();
  // p1's caravan on a p2 city tile — unrepresentable in play, but the guard holds
  const res = engine.applyCommand(craft({ cityOwner: 'p2' }), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(!res.ok, 'rejected');
  assert.strictEqual(res.reason, 'notYourCity');
});

test('A83: revert proof — an unpowered caravan (no helpsWonder) leaves the box untouched', async () => {
  const engine = await load();
  // simulate the pre-A83 world: strip the flag from the ruleset caravan
  const noFlag = JSON.parse(JSON.stringify(RULESET));
  delete noFlag.units.caravan.helpsWonder;
  const { createEngine } = await import('../engine/index.js');
  const eng2 = createEngine(noFlag);
  const res = eng2.applyCommand(craft(), { type: 'helpWonder', playerId: 'p1', unitId: 'u1' });
  assert.ok(!res.ok, 'without the flag, the caravan cannot help');
  assert.strictEqual(res.reason, 'cannotHelpWonder');
});
