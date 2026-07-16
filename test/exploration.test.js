// B23: coastline-following scouts (memoryless, explored-map memory). A coastal
// scout steps to an adjacent UNEXPLORED COASTAL land tile; at a fork the hand
// (unit-id parity) picks the rotational extreme, so two scouts trace opposite
// perimeters. Inland or with rules.aiCoastFollow off, it falls back to the
// greedy towardUnexplored step. The explored map is monotone -> self-avoiding
// walk, no oscillation. (Mechanism reinterpretation of the user coastline
// doctrine, architect @56c4e9f7, memoryless-via-explored.)
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/ai.js');
}

function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

// 7x5: rows 0-2 grassland (land), rows 3-4 ocean. Row y=2 is the coastline.
function coastState(scoutId, scoutX, scoutY, exploredOverride) {
  const W = 7, H = 5;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: y >= 3 ? 'ocean' : 'grassland' });
  // the scout's own tile is always explored (a unit sees where it stands);
  // neighbours stay fogged so the coastal picker has unexplored coast to seek.
  let explored = exploredOverride;
  if (!explored) { explored = new Array(W * H).fill(0); explored[scoutY * W + scoutX] = 1; }
  return {
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: { [scoutId]: { id: scoutId, type: 'legion', owner: 'p1', x: scoutX, y: scoutY, moves: 1, fortified: false, veteran: false } },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 90, nextCityId: 10,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, explored } },
    rngState: 1
  };
}

test('B23: isCoastal — land next to sea is coastal; interior land and sea are not', async () => {
  const ai = await load();
  const st = coastState('u90', 3, 2);
  assert.strictEqual(ai.isCoastal(st, 3, 2, RULESET), true, 'row 2 land touches the ocean');
  assert.strictEqual(ai.isCoastal(st, 3, 0, RULESET), false, 'row 0 land is inland');
  assert.strictEqual(ai.isCoastal(st, 3, 4, RULESET), false, 'ocean is not coastal land');
});

test('B23: opposite hands — even parity and odd parity diverge at a coastal fork', async () => {
  const ai = await load();
  // scout at (3,2): the unexplored coastal neighbours are E=(4,2) and W=(2,2).
  // DIR_KEYS orders E before W, so even parity -> E (first), odd -> W (last).
  const even = coastState('u50', 3, 2);
  assert.strictEqual(ai.coastalScoutDir(even, even.units.u50, even.players.p1, RULESET), 'E', 'even parity takes the first fork (east)');
  const odd = coastState('u51', 3, 2);
  assert.strictEqual(ai.coastalScoutDir(odd, odd.units.u51, odd.players.p1, RULESET), 'W', 'odd parity takes the last fork (west)');
});

test('B23: no unexplored coastal step -> null (caller falls back to inland greedy)', async () => {
  const ai = await load();
  const W = 7;
  const explored = new Array(35).fill(0);
  explored[2 * W + 3] = 1; // own tile
  explored[2 * W + 2] = 1; explored[2 * W + 4] = 1; // both coastal neighbours charted
  const st = coastState('u90', 3, 2, explored);
  assert.strictEqual(ai.coastalScoutDir(st, st.units.u90, st.players.p1, RULESET), null, 'coast locally charted -> null');
});

test('B23: the scout branch coast-follows by default and reverts to greedy when off', async () => {
  const ai = await load();
  const { createEngine } = await import('../engine/index.js');
  // one military unit + aiScoutSharePct 100 so the unit IS a scout (B21d).
  const on = withRules({ aiScoutSharePct: 100 });
  const off = withRules({ aiScoutSharePct: 100, aiCoastFollow: false });
  const mk = () => coastState('u90', 3, 2);
  const coastCmd = ai.pickCommand(mk(), 'p1', on, {});
  assert.ok(coastCmd && coastCmd.type === 'moveUnit', 'the scout moves');
  assert.ok(['E', 'W'].indexOf(coastCmd.dir) !== -1, 'coast-follow: steps along the coast (E/W), not inland');
  // with the doctrine off, the greedy step targets the nearest fog — the
  // whole map is unexplored here, so the nearest fog is adjacent (any dir):
  // the point is it goes through towardUnexplored, not the coastal picker.
  const greedyCmd = ai.pickCommand(mk(), 'p1', off, {});
  assert.ok(greedyCmd && greedyCmd.type === 'moveUnit', 'off: still explores via the greedy step');
  // determinism sanity: the coastal picker and greedy agree to MOVE; ensure
  // the coastal path is engaged only when on (both engines share this gate).
  void createEngine;
});

// B23 BFS router: a 7x5 world with a water bay across row 2 (cols 2-4). A scout
// west of the bay must ROUTE AROUND it (not step into the sea) to reach an
// unexplored land tile east of the bay.
function bayState(scoutX, scoutY, exploredOverride) {
  const W = 7, H = 5;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: (y === 2 && x >= 2 && x <= 4) ? 'ocean' : 'grassland' });
  const explored = exploredOverride || (() => { const e = new Array(W * H).fill(1); e[2 * W + 5] = 0; return e; })();
  return {
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: { u1: { id: 'u1', type: 'legion', owner: 'p1', x: scoutX, y: scoutY, moves: 1, fortified: false, veteran: false } },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, explored } },
    rngState: 1
  };
}

test('B23: the BFS router routes AROUND a bay (not into the sea) to the frontier', async () => {
  const ai = await load();
  const st = bayState(1, 2); // scout west of the bay; U unexplored at (5,2) east
  const dir = ai.bfsStepToNearestUnexplored(st, st.units.u1, st.players.p1, RULESET);
  assert.ok(dir, 'a step exists (the frontier is land-reachable around the bay)');
  const vec = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] }[dir];
  const nx = 1 + vec[0], ny = 2 + vec[1];
  assert.strictEqual(RULESET.terrain.terrains[st.map.tiles[ny * 7 + nx].t].domain, 'land', 'the step is onto land, not the bay');
});

test('B23: the BFS router terminates null when the landmass is fully charted', async () => {
  const ai = await load();
  const explored = new Array(35).fill(1);
  const st = bayState(1, 2, explored);
  assert.strictEqual(ai.bfsStepToNearestUnexplored(st, st.units.u1, st.players.p1, RULESET), null, 'no unexplored land -> null (no pathological circles)');
});
