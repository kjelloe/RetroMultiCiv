// A72 slice 1: air movement. Air units (domain 'air') were grounded — the
// movement domain check rejected every tile because no terrain is domain 'air'.
// Now they fly over ANY tile (land + sea), ignore zones of control (Civ 1), and
// attack ground/sea targets. Fuel/crash, carriers, and nuclear one-shot are
// later slices. Cross-language: test/scenarios/021-air-movement.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// columns 0-2 grassland (land), 3-4 ocean (sea). A fighter on land at (1,2).
function craft(overrides) {
  overrides = overrides || {};
  const W = 5, H = 5;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x >= 3 ? 'ocean' : 'grassland' });
  const units = {
    f1: { id: 'f1', type: 'fighter', owner: 'p1', x: 1, y: 2, moves: RULESET.units.fighter.moves, fortified: false, veteran: false }
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

test('A72: an air unit flies over land', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft(), { type: 'moveUnit', playerId: 'p1', unitId: 'f1', dir: 'E' });
  assert.ok(res.ok, `fly ok: ${res.reason}`);
  assert.strictEqual(res.state.units.f1.x, 2, 'moved east over land');
});

test('A72: an air unit flies out over the sea (no domain block)', async () => {
  const engine = await load();
  // f1 at (2,2) land; move E to (3,2) ocean — a fighter is not a sea unit but flies
  const st = craft();
  st.units.f1.x = 2;
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'f1', dir: 'E' });
  assert.ok(res.ok, `fly-over-sea ok: ${res.reason}`);
  assert.strictEqual(res.state.units.f1.x, 3, 'flew over the ocean');
});

test('A72: an air unit attacks a ground target', async () => {
  const engine = await load();
  const st = craft({ p2: true, units: {
    g1: { id: 'g1', type: 'militia', owner: 'p2', x: 2, y: 2, moves: 0, fortified: false, veteran: false }
  } });
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'f1', dir: 'E' });
  assert.ok(res.ok, `air strike ok: ${res.reason}`);
  assert.ok(res.events.some(e => e.type === 'combatResolved'), 'combat resolved from the air');
});

test('A72: an air unit ignores zones of control', async () => {
  const engine = await load();
  // an enemy unit next to both f1 and the destination — a land unit would be
  // ZOC-locked, but air flies through.
  const st = craft({ p2: true, units: {
    e1: { id: 'e1', type: 'phalanx', owner: 'p2', x: 1, y: 1, moves: 0, fortified: true, veteran: false }
  } });
  // f1 at (1,2), move E to (2,2); e1 at (1,1) is adjacent to both — ZOC for a land unit
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'f1', dir: 'E' });
  assert.ok(res.ok, `air ignores ZOC: ${res.reason}`);
  assert.strictEqual(res.state.units.f1.x, 2, 'flew through the ZOC');
});

test('A72 revert-guard: a LAND unit still cannot fly over sea', async () => {
  const engine = await load();
  const st = craft({ units: {
    l1: { id: 'l1', type: 'militia', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false }
  } });
  // no transport at (3,2) ocean -> a militia cannot enter the sea
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'l1', dir: 'E' });
  assert.ok(!res.ok, 'land unit blocked at the coast');
  assert.strictEqual(res.reason, 'impassable');
});
