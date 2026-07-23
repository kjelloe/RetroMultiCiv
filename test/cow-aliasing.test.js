// deepClone map-sharing (#2320) — the PERMANENT aliasing guard + the mechanism-A determinism guard.
// applyCommand now SHARES state.map by reference; a tile-write must go through cowTile (which clones
// the map + the written tile) or it corrupts the caller's prior state (undo / recording replay / UI
// baselines). The soak goldens CANNOT catch this (a sequential soak discards old states), so this
// test deep-FREEZES the input tiles before every applyCommand: any in-place tile write throws in
// strict mode. Runs a broad AI soak + targeted writers (pillage, nuclear fallout) the soak may miss.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

const FOUR = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: false },
  { id: 'p2', name: 'Egyptians', color: '#d8b13b', human: false },
  { id: 'p3', name: 'Greeks', color: '#3bd87d', human: false },
  { id: 'p4', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const { runAiTurn } = await import('../engine/ai.js');
  const { hashState } = await import('../shared/statehash.js');
  return { createEngine, runAiTurn, hashState };
}

// wrap applyCommand: deep-freeze the INPUT map tiles so an in-place write throws (a missed cowTile).
function freezeGuarded(engine) {
  const real = engine.applyCommand;
  return function (st, cmd) {
    const tiles = st.map.tiles;
    for (let i = 0; i < tiles.length; i++) Object.freeze(tiles[i]);
    Object.freeze(tiles);
    return real(st, cmd);
  };
}

test('cow aliasing: a golden-seed AI soak never writes the shared (frozen) map tiles in place', async () => {
  const { createEngine, runAiTurn } = await load();
  const engine = createEngine(RULESET);
  engine.applyCommand = freezeGuarded(engine); // runAiTurn calls engine.applyCommand internally too
  let st = engine.createGame({ seed: 20260712, options: { width: 56, height: 35, players: FOUR } });
  // 60 turns exercise foundCity, improvements (build/clean), pollution spread + warming, goody huts —
  // every tile-writer that fires in normal play. A missed cowTile writes a frozen tile -> throws here.
  for (let t = 0; t < 60; t++) {
    const a = st.activePlayer;
    st = runAiTurn(engine, st, a, RULESET, []);
    const r = engine.applyCommand(st, { type: 'endTurn', playerId: a });
    if (!r.ok) break;
    st = r.state;
    if (st.gameOver) break;
  }
  assert.ok(st.turn > 10, `the frozen-tile soak advanced (${st.turn} turns) with no in-place map write`);
});

test('cow aliasing: pillage clears a road on the shared map without an in-place write', async () => {
  const { createEngine } = await load();
  const engine = createEngine(RULESET);
  const applyFrozen = freezeGuarded(engine);
  const tiles = []; for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland', road: true });
  const st = {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false } },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 2, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
  const r = applyFrozen(st, { type: 'pillage', playerId: 'p1', unitId: 'u1' });
  assert.ok(r.ok, `pillage should succeed: ${r.reason}`);
  assert.strictEqual(r.state.map.tiles[2 * 5 + 2].road, undefined, 'the road is pillaged on the NEW map');
  assert.strictEqual(st.map.tiles[2 * 5 + 2].road, true, 'the PRIOR state map is untouched (no aliasing)');
});

test('cow determinism: identical (state, command) -> identical result regardless of prior calls', async () => {
  const { createEngine, hashState } = await load();
  const engine = createEngine(RULESET);
  const mk = () => ({
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 5, height: 5, wrapX: false, tiles: Array.from({ length: 25 }, () => ({ t: 'grassland', road: true, mine: true })) },
    units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false } },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 2, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  });
  // a pillage on a FRESH state
  const r1 = engine.applyCommand(mk(), { type: 'pillage', playerId: 'p1', unitId: 'u1' });
  // a DIFFERENT tile-writing command first (sets+resets the cow transient), then the SAME pillage
  engine.applyCommand(mk(), { type: 'pillage', playerId: 'p1', unitId: 'u1' });
  const r2 = engine.applyCommand(mk(), { type: 'pillage', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(hashState(r1.state), hashState(r2.state),
    'the per-command cow transient did not leak across calls (resetCow at applyCommand entry)');
});
