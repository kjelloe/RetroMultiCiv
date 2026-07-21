// NAVAL-TRUTH (Bundle 2): per-unit sight, submarine invisibility + no-land-attack, the
// trireme open-sea gamble, and Lighthouse/Magellan ship movement. Replay-fixture-FIRST
// (#1989): the pre-naval-truth engine had none of this.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const naval = await import('../engine/naval.js');
  const vis = await import('../engine/visibility.js');
  const combat = await import('../engine/combat.js');
  const { createEngine } = await import('../engine/index.js');
  return { naval, vis, combat, engine: createEngine(RULESET) };
}

// a small ocean board with a coastal strip so we can place a ship at open sea or hugging land.
function seaBoard() {
  const W = 6, H = 6, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'ocean' });
  for (let x = 0; x < W; x++) tiles[0 * W + x] = { t: 'grassland' }; // land along row y=0
  return { width: W, height: H, wrapX: false, tiles };
}
function craft(units, extra) {
  return Object.assign({
    version: 1, turn: 200, year: 1000, activePlayer: 'p1', playerOrder: ['p1'],
    map: seaBoard(), units, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 50, nextCityId: 5,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  }, extra || {});
}
function always() { const r = JSON.parse(JSON.stringify(RULESET)); r.rules.trireme.lossChancePct = 100; return r; }
function never() { const r = JSON.parse(JSON.stringify(RULESET)); r.rules.trireme.lossChancePct = 0; return r; }

test('trireme: an open-sea trireme is lost (not adjacent to land)', async () => {
  const { naval } = await load();
  // trireme at (3,3) — surrounded by ocean (land is only at y=0). lossChancePct 100 -> lost.
  const st = craft({ u1: { id: 'u1', type: 'trireme', owner: 'p1', x: 3, y: 3, moves: 3 } });
  const events = [];
  naval.process(st, always(), events);
  assert.strictEqual(st.units.u1, undefined, 'the open-sea trireme drowns');
  assert.ok(events.some(e => e.type === 'triremeLost' && e.unitId === 'u1'), 'triremeLost emitted');
});

test('trireme: a coastal trireme is safe (adjacent to land) — and draws ZERO rng', async () => {
  const { naval } = await load();
  // trireme at (2,1) — row y=0 is land, so it is adjacent to land. Even lossChancePct 100 spares it.
  const st = craft({ u1: { id: 'u1', type: 'trireme', owner: 'p1', x: 2, y: 1, moves: 3 } });
  const before = st.rngState;
  naval.process(st, always(), []);
  assert.ok(st.units.u1 !== undefined, 'a coast-hugging trireme survives');
  assert.strictEqual(st.rngState, before, 'no roll for a safe trireme (RNG-when-eligible)');
});

test('trireme: lossChancePct 0 never loses (still draws the eligible roll)', async () => {
  const { naval } = await load();
  const st = craft({ u1: { id: 'u1', type: 'trireme', owner: 'p1', x: 3, y: 3, moves: 3 } });
  naval.process(st, never(), []);
  assert.ok(st.units.u1 !== undefined, 'chance 0 -> never lost');
});

test('trireme: a lost trireme drowns its cargo', async () => {
  const { naval } = await load();
  const st = craft({
    u1: { id: 'u1', type: 'trireme', owner: 'p1', x: 3, y: 3, moves: 3 },
    u2: { id: 'u2', type: 'legion', owner: 'p1', x: 3, y: 3, moves: 1, aboard: 'u1' }
  });
  const events = [];
  naval.process(st, always(), events);
  assert.strictEqual(st.units.u1, undefined, 'the trireme is lost');
  assert.strictEqual(st.units.u2, undefined, 'the cargo drowns with it');
  assert.ok(events.some(e => e.type === 'cargoLost' && e.unitId === 'u2'), 'cargoLost emitted');
});

test('sight: a submarine sees at radius 2, a militia at radius 1', async () => {
  const { vis } = await load();
  const sub = { id: 's', type: 'submarine', owner: 'p1', x: 3, y: 3 };
  const mil = { id: 'm', type: 'militia', owner: 'p1', x: 3, y: 3 };
  assert.strictEqual(vis.unitSight(sub, RULESET), 2, 'submarine sight 2');
  assert.strictEqual(vis.unitSight(mil, RULESET), 1, 'militia sight 1');
});

test('submarine: invisible to a rival LAND unit, visible to a rival ADJACENT ship', async () => {
  const { vis } = await load();
  const base = () => craft({
    sub: { id: 'sub', type: 'submarine', owner: 'p2', x: 3, y: 3, moves: 3 },
    watcher: { id: 'watcher', owner: 'p1', type: 'militia', x: 3, y: 2, moves: 1 }
  }, {
    playerOrder: ['p1', 'p2'],
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, explored: new Array(36).fill(1) },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
    }
  });
  // a LAND watcher adjacent to the sub cannot see it
  const land = base();
  assert.strictEqual(vis.filterView(land, 'p1', RULESET).units.sub, undefined, 'a land unit never spots a submarine');
  // swap the watcher for a destroyer/ironclad (sea) adjacent -> spotted
  const sea = base();
  sea.units.watcher.type = 'ironclad';
  assert.ok(vis.filterView(sea, 'p1', RULESET).units.sub !== undefined, 'an adjacent ship spots the submarine');
});

test('submarine: may not attack a land tile', async () => {
  const { combat } = await load();
  const st = craft({
    sub: { id: 'sub', type: 'submarine', owner: 'p1', x: 2, y: 1, moves: 3 },
    def: { id: 'def', type: 'militia', owner: 'p2', x: 2, y: 0, moves: 1 } // on land (y=0)
  }, { playerOrder: ['p1', 'p2'], players: {
    p1: { id: 'p1', techs: [] }, p2: { id: 'p2', techs: [] }
  } });
  const res = combat.resolveAttack(st, st.units.sub, 2, 0, RULESET);
  assert.strictEqual(res.ok, false, 'a submarine cannot bombard land');
  assert.strictEqual(res.reason, 'cannotAttackThere');
});

test('Lighthouse + Magellan: additive +2 ship movement for the owner', async () => {
  const { engine } = await load();
  // a coastal city holds both wonders; a trireme (base 3 moves) refreshes to 3+2 on the wrap.
  const tiles = [];
  for (let i = 0; i < 36; i++) tiles.push({ t: 'ocean' });
  for (let x = 0; x < 6; x++) tiles[x] = { t: 'grassland' };
  const st = {
    version: 1, turn: 200, year: 1000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 6, height: 6, wrapX: false, tiles },
    units: { t1: { id: 't1', type: 'trireme', owner: 'p1', x: 2, y: 1, moves: 0 }, l1: { id: 'l1', type: 'legion', owner: 'p1', x: 2, y: 0, moves: 0 } },
    cities: { c1: { id: 'c1', name: 'Port', owner: 'p1', x: 3, y: 0, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' } } },
    cityOrder: ['c1'], wonders: { lighthouse: 'c1', 'magellan-s-expedition': 'c1' }, nextUnitId: 50, nextCityId: 5,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const r = engine.applyCommand(st, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(r.state.units.t1.moves, 5, 'trireme base 3 + Lighthouse 1 + Magellan 1 = 5');
  assert.strictEqual(r.state.units.l1.moves, 1, 'the land legion is unaffected (base 1)');
});
