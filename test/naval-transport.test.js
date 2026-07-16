// A69: naval transport — ships with a `transport` capacity carry land units.
// A land unit moving onto a friendly transport's tile LOADS (aboard:<shipId>);
// it rides the ship, is hidden from combat and exerts no ZOC, unloads onto
// adjacent land, and dies with the ship if it sinks. No amphibious assault
// (Civ 1 has no Marines): an aboard unit cannot move onto a hostile tile.
// Cross-language contract: test/scenarios/019-naval-transport.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// columns 0-2 grassland (land), 3-4 ocean (sea). A ship at the coast (3,2) and
// a militia on the adjacent land (2,2).
function craft(overrides) {
  overrides = overrides || {};
  const W = 5, H = 5;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x >= 3 ? 'ocean' : 'grassland' });
  const shipType = overrides.shipType || 'transport';
  const units = {
    s1: { id: 's1', type: shipType, owner: 'p1', x: 3, y: 2, moves: RULESET.units[shipType].moves, fortified: false, veteran: false },
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false }
  };
  if (overrides.units) Object.assign(units, overrides.units);
  const players = {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
  };
  if (overrides.p2) players.p2 = { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  return {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: Object.keys(players),
    map: { width: W, height: H, wrapX: false, tiles },
    units, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players, rngState: 1
  };
}

test('A69: a land unit moving onto a friendly transport LOADS (aboard set, move spent)', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(), { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.ok(res.ok, `load ok: ${res.reason}`);
  const u = res.state.units.u1;
  assert.strictEqual(u.aboard, 's1', 'militia is aboard the ship');
  assert.strictEqual(u.x, 3, 'militia rides the ship tile');
  assert.strictEqual(u.y, 2);
  assert.strictEqual(u.moves, 0, 'the load spent the move');
  assert.ok(res.events.some(e => e.type === 'unitLoaded' && e.unitId === 'u1' && e.shipId === 's1'), 'unitLoaded event');
});

test('A69: the cargo rides the ship — a ship move syncs aboard x/y', async () => {
  const engine = await load();
  const loaded = engine.applyCommand(craft(), { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  // sail the ship east into open ocean
  const sailed = engine.applyCommand(loaded.state, { type: 'moveUnit', playerId: 'p1', unitId: 's1', dir: 'E' });
  assert.ok(sailed.ok, `sail ok: ${sailed.reason}`);
  assert.strictEqual(sailed.state.units.s1.x, 4, 'ship moved east');
  assert.strictEqual(sailed.state.units.u1.x, 4, 'cargo tracks the ship');
  assert.strictEqual(sailed.state.units.u1.y, 2);
});

test('A69: an aboard unit unloads onto adjacent land and is freed', async () => {
  const engine = await load();
  const loaded = engine.applyCommand(craft(), { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  // refresh the cargo's move (loading spent it); unload west onto land
  loaded.state.units.u1.moves = 1;
  const res = engine.applyCommand(loaded.state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'W' });
  assert.ok(res.ok, `unload ok: ${res.reason}`);
  const u = res.state.units.u1;
  assert.strictEqual(u.aboard, undefined, 'no longer aboard');
  assert.strictEqual(u.x, 2, 'stepped onto land');
  assert.ok(res.events.some(e => e.type === 'unitUnloaded' && e.unitId === 'u1'), 'unitUnloaded event');
});

test('A69: a sunk ship takes its cargo down with it', async () => {
  const engine = await load();
  // an enemy attacker adjacent to the ship; the ship is the defender
  const st = craft({ p2: true, units: {
    e1: { id: 'e1', type: 'ironclad', owner: 'p2', x: 4, y: 2, moves: 1, fortified: false, veteran: false }
  } });
  const loaded = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  let s = loaded.state;
  s.activePlayer = 'p2';
  // roll the attack until the ship dies (ironclad 4 vs transport 3, defender in open sea)
  let sunk = false;
  for (let i = 0; i < 200 && !sunk; i++) {
    const r = engine.applyCommand(s, { type: 'moveUnit', playerId: 'p2', unitId: 'e1', dir: 'W' });
    if (r.ok && r.state.units.s1 === undefined) { s = r.state; sunk = true; break; }
    // reset for another attempt: restore ship+cargo, give the attacker moves, bump rng
    s = JSON.parse(JSON.stringify(loaded.state));
    s.activePlayer = 'p2';
    s.rngState = 100 + i;
  }
  assert.ok(sunk, 'the ship sank in one of the attempts');
  assert.strictEqual(s.units.u1, undefined, 'the cargo went down with the ship');
});

test('A69: no amphibious assault — an aboard unit cannot move onto a hostile tile', async () => {
  const engine = await load();
  // enemy on the land tile west of the coast; the militia loads, then tries to
  // "unload" straight into the enemy — Civ 1 forbids attacking from a ship.
  const st = craft({ p2: true, units: {
    e1: { id: 'e1', type: 'phalanx', owner: 'p2', x: 2, y: 2, moves: 0, fortified: true, veteran: false },
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 3, y: 1, moves: 1, fortified: false, veteran: false }
  } });
  // load from the north (3,1)->(3,2)? simpler: place militia already aboard
  st.units.u1 = { id: 'u1', type: 'militia', owner: 'p1', x: 3, y: 2, moves: 1, fortified: false, veteran: false, aboard: 's1' };
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'W' });
  assert.ok(!res.ok, 'amphibious assault rejected');
  assert.strictEqual(res.reason, 'noAmphibiousAssault');
});

test('A69: capacity is enforced — the transport fills up', async () => {
  const engine = await load();
  // a trireme (transport 2) already holding two units; a third cannot board
  const st = craft({ shipType: 'trireme', units: {
    a: { id: 'a', type: 'militia', owner: 'p1', x: 3, y: 2, moves: 0, fortified: false, veteran: false, aboard: 's1' },
    b: { id: 'b', type: 'militia', owner: 'p1', x: 3, y: 2, moves: 0, fortified: false, veteran: false, aboard: 's1' }
  } });
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.ok(!res.ok, 'a full transport rejects boarding');
  assert.strictEqual(res.reason, 'transportFull');
});

test('A69 revert proof: a ship with no transport capacity cannot be boarded', async () => {
  const engine = await load();
  // ironclad has no transport field -> moving onto it is a normal impassable-sea reject
  const res = engine.applyCommand(craft({ shipType: 'ironclad' }), { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.ok(!res.ok, 'cannot board a non-transport');
  assert.strictEqual(res.reason, 'impassable');
});
