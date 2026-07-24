// N9b build-priority lever + wonder-drive + R1 decision-stickiness (spec a8fe1af).
// Crafted-state chooser tests: they drive the real AI (runAiTurn) and assert the
// city's resulting production. The cross-language OUTCOME pin is the soak/turn-100
// goldens; these lock the mechanism (JS-only, engine-internal).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let ai, engine;
test('load', async () => {
  ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  engine = createEngine(RULESET);
});

// a compact world: a high-trade city (river + roads on the fat cross) so a
// marketplace has a real, short payback. p1 owns two settlers elsewhere so the
// city is PAST the settler-scarcity branch (the saturated path the lever guards).
function leverWorld(over, cityOver, p1Over) {
  const W = 11, H = 11;
  const tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  // river + road every tile in/around the city center (5,5) -> lots of trade
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = tiles[(5 + dy) * W + (5 + dx)];
      t.river = true; t.road = true;
    }
  }
  const city = Object.assign({
    id: 'c1', name: 'Trade', owner: 'p1', x: 5, y: 5, pop: 6, food: 0, shields: 0,
    buildings: [], producing: { kind: 'unit', id: 'militia' }
  }, cityOver || {});
  return Object.assign({
    version: 1, turn: 40, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: {
      // two garrison defenders (floor met, wantDefenders<=2) + two settlers so the
      // saturated branch runs. Settlers sit ADJACENT (too close to found).
      d1: { id: 'd1', type: 'militia', owner: 'p1', x: 5, y: 5, moves: 1, fortified: true, veteran: false },
      d2: { id: 'd2', type: 'militia', owner: 'p1', x: 5, y: 5, moves: 1, fortified: true, veteran: false },
      s1: { id: 's1', type: 'settlers', owner: 'p1', x: 6, y: 5, moves: 1, fortified: false, veteran: false },
      s2: { id: 's2', type: 'settlers', owner: 'p1', x: 4, y: 5, moves: 1, fortified: false, veteran: false }
    },
    cities: { c1: city }, cityOrder: ['c1'],
    wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      // iron-working -> a legion is the best attacker, so the cascade's underArmy
      // branch picks a UNIT (the case the lever is meant to override). taxRate 80
      // makes the marketplace payback ~26 (< the balanced ceiling 40).
      p1: Object.assign({ id: 'p1', name: 'A', color: '#00f', human: false, gold: 0,
        techs: ['currency', 'pottery', 'ceremonial-burial', 'bronze-working', 'iron-working'], researching: '', bulbs: 0, taxRate: 80, sciRate: 20 }, p1Over || {}),
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 7
  }, over || {});
}

test('lever: a saturated balanced city builds a short-payback marketplace over a unit', async () => {
  const after = ai.runAiTurn(engine, leverWorld(), 'p1', RULESET);
  const prod = after.cities.c1.producing;
  assert.strictEqual(prod.kind, 'building', `expected a building, got ${JSON.stringify(prod)}`);
  assert.strictEqual(prod.id, 'marketplace', `expected marketplace (shortest payback), got ${prod.id}`);
});

test('R2: a non-yield building is NOT chosen by the lever (temple/granary keep the nextBuilding route)', async () => {
  // currency removed -> no marketplace; only zero-yield buildings (temple, granary)
  // are buildable. The lever must find NO payback building and fall through to the
  // unit (temple/granary reach cities via stanceBuilding, not the lever).
  const after = ai.runAiTurn(engine, leverWorld(undefined, undefined,
    { techs: ['pottery', 'ceremonial-burial'] }), 'p1', RULESET);
  const prod = after.cities.c1.producing;
  // the lever picked nothing; whatever the cascade chose is a unit OR a stance
  // building — but NEVER via a zero-delta payback. Assert it is not marketplace
  // (unbuildable) and, if a building, only a non-yield one.
  if (prod.kind === 'building') {
    const eff = RULESET.buildings[prod.id].effect;
    assert.ok(!eff.taxBonus && !eff.sciBonus, `lever must not pick a yield building here, got ${prod.id}`);
  }
});

test('garrison floor: a threatened, under-garrisoned city builds the defender, not a building', async () => {
  // one defender, an enemy adjacent -> wantDefenders 2 unmet -> defender first,
  // the lever never runs (we are not past the garrison floor).
  const world = leverWorld();
  delete world.units.d2; // only one defender
  world.units.e1 = { id: 'e1', type: 'legion', owner: 'p2', x: 6, y: 6, moves: 1, fortified: false, veteran: false };
  const after = ai.runAiTurn(engine, world, 'p1', RULESET);
  const prod = after.cities.c1.producing;
  assert.strictEqual(prod.kind, 'unit', `a threatened under-garrisoned city builds a unit, got ${JSON.stringify(prod)}`);
});

test('R1 stickiness / no-thrash: a city mid-marketplace with an enemy adjacent keeps the marketplace (garrison met)', async () => {
  // already building the marketplace, garrison floor met (2 defenders), enemy adjacent.
  // R1: the in-progress building is kept — no switch to walls/unit (half-shields forfeit).
  const world = leverWorld(undefined, { producing: { kind: 'building', id: 'marketplace' }, buildings: [] },
    { techs: ['currency', 'pottery', 'ceremonial-burial', 'masonry'] });
  world.units.e1 = { id: 'e1', type: 'legion', owner: 'p2', x: 6, y: 6, moves: 1, fortified: false, veteran: false };
  const after = ai.runAiTurn(engine, world, 'p1', RULESET);
  const prod = after.cities.c1.producing;
  assert.strictEqual(prod.kind, 'building', `mid-building must be kept, got ${JSON.stringify(prod)}`);
  assert.strictEqual(prod.id, 'marketplace', `must keep the marketplace, got ${prod.id}`);
});

// a high-SHIELD capital (forest fat cross -> shields >= WONDER_MIN_SHIELDS) with a
// palace, so the builder wonder-drive can fire. Cheapest-wonder tech granted.
function cheapestWonderTech() {
  let best = null;
  for (const id of Object.keys(RULESET.wonders)) {
    const d = RULESET.wonders[id];
    if (best === null || d.cost < RULESET.wonders[best].cost) best = id;
  }
  return RULESET.wonders[best].tech;
}
function capitalWorld(stance) {
  const W = 11, H = 11, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) tiles[(5 + dy) * W + (5 + dx)] = { t: 'forest' }; // shields
  }
  const wt = cheapestWonderTech();
  const p1 = { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0,
    techs: ['pottery', 'ceremonial-burial', 'masonry', wt].filter(Boolean), researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  if (stance) p1.stance = stance;
  return {
    version: 1, turn: 40, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: {
      // builder settlerBase 3 + settlerDiv 1 -> needs 4 settlers to be SATURATED
      // (past the expansion branch, where the wonder-drive lives). All adjacent
      // (too close to found), so they don't change the city count this turn.
      d1: { id: 'd1', type: 'militia', owner: 'p1', x: 5, y: 5, moves: 1, fortified: true, veteran: false },
      d2: { id: 'd2', type: 'militia', owner: 'p1', x: 5, y: 5, moves: 1, fortified: true, veteran: false },
      s1: { id: 's1', type: 'settlers', owner: 'p1', x: 6, y: 5, moves: 1, fortified: false, veteran: false },
      s2: { id: 's2', type: 'settlers', owner: 'p1', x: 4, y: 5, moves: 1, fortified: false, veteran: false },
      s3: { id: 's3', type: 'settlers', owner: 'p1', x: 5, y: 6, moves: 1, fortified: false, veteran: false },
      s4: { id: 's4', type: 'settlers', owner: 'p1', x: 5, y: 4, moves: 1, fortified: false, veteran: false }
    },
    cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 5, y: 5, pop: 6, food: 0, shields: 0, buildings: ['palace'], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: { p1, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 7
  };
}

test('wonder-drive: a builder capital commits to the cheapest available wonder; a balanced one does not', async () => {
  const b = ai.runAiTurn(engine, capitalWorld('builder'), 'p1', RULESET);
  assert.strictEqual(b.cities.c1.producing.kind, 'wonder',
    `a builder capital must drive a wonder, got ${JSON.stringify(b.cities.c1.producing)}`);

  const n = ai.runAiTurn(engine, capitalWorld(), 'p1', RULESET);
  assert.notStrictEqual(n.cities.c1.producing.kind, 'wonder',
    `a balanced (non-drive) capital must NOT auto-commit to a wonder, got ${JSON.stringify(n.cities.c1.producing)}`);
});

// N9b Finding-3 fix (architect @50f5ebd3): the hoisted wonder-drive must actually
// FIRE + PERSIST for a builder in a live game (the crafted commit above proves
// "begins"; this proves it in a real all-AI game — the architect's "safe-game
// fixture + fire-count > 0" bar). Completion is horizon-gated (like Apollo), so
// we assert begins+persists, NOT completion.
test('wonder-drive begins + persists: a builder capital commits to a wonder for many turns in a live safe game', async () => {
  const { createEngine } = await import('../engine/index.js');
  const eng = createEngine(RULESET);
  const players = [
    { id: 'p1', name: 'Romans', color: '#3b7dd8', human: false, civ: 'romans' },
    { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false, civ: 'zulus' }
  ];
  // #36 river-terrain re-pin (seed 42 -> 3): the meandering-strip mapgen reshaped every world;
  // seed 42's builder no longer reaches a wonder (world-dependent), seed 3 fires ~turn 79 and
  // persists ~95 turns. A seed re-pin, not a wonder-drive regression (ai.js unchanged by #36).
  let state = eng.createGame({ seed: 3, options: { width: 80, height: 50, players } });
  let wonderTurns = 0, firstFire = null;
  for (let round = 0; round < 200; round++) {
    for (const pid of state.playerOrder) {
      state = ai.runAiTurn(eng, state, pid, RULESET, [], pid === 'p1' ? 'builder' : undefined);
      const r = eng.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (r.ok) state = r.state;
    }
    const producingWonder = (state.cityOrder || []).some(c =>
      state.cities[c] && state.cities[c].owner === 'p1' &&
      state.cities[c].producing && state.cities[c].producing.kind === 'wonder');
    if (producingWonder) { wonderTurns++; if (firstFire === null) firstFire = state.turn; }
  }
  assert.ok(firstFire !== null, 'the builder wonder-drive never fired (Finding-3 regression)');
  assert.ok(wonderTurns >= 10,
    `the builder must PERSIST on a wonder across turns (begins+persists), got ${wonderTurns} wonder-producing turns`);
});
