// A91 pollution (Civ 1): per-city smokestack pollution (industrial shields + pop,
// less a tolerance) rolls a nearby land square dirty; Mass Transit zeroes the pop
// term; a power plant / recycling centre divides the industrial term; a nuclear-plant
// city in disorder before Fusion Power can melt down. Replay-fixture-FIRST (#1989):
// these assert the mechanic the pre-A91 engine had none of.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return import('../engine/pollution.js');
}
async function loadImpr() {
  return import('../engine/improvements.js');
}

// a 5x5 board: all ocean except the city tile (2,2) and ONE land square at (2,1) —
// so any fouling is deterministic (a single candidate in both FAT_CROSS and ADJ).
function board() {
  const W = 5, H = 5, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'ocean' });
  tiles[2 * W + 2] = { t: 'grassland' }; // city centre
  tiles[1 * W + 2] = { t: 'grassland' }; // the sole pollutable land tile (dy=-1)
  return { width: W, height: H, wrapX: false, tiles };
}
const TARGET = 1 * 5 + 2; // index of (2,1)

function craft(city, techs, rng) {
  return {
    version: 1, turn: 300, year: 1990, activePlayer: 'p1', playerOrder: ['p1'],
    map: board(), units: {}, wonders: {}, nextUnitId: 10, nextCityId: 5,
    cities: { c1: Object.assign({ id: 'c1', name: 'C', owner: 'p1', x: 2, y: 2, pop: 5, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' }, workers: [] }, city) },
    cityOrder: ['c1'],
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 0, techs: techs || [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: rng === undefined ? 1 : rng
  };
}
// a ruleset clone with meltdownChance forced (rollRange(_,1) always hits) for the
// deterministic meltdown tests.
function meltdownAlways() {
  const r = JSON.parse(JSON.stringify(RULESET));
  r.rules.pollution.meltdownChance = 1;
  return r;
}

test('A91: a big industrial-era city fouls a nearby square (pop pollution over tolerance)', async () => {
  const { process } = await load();
  // pop 130 + Plastics (100% modifier) -> popPollution 130, far over tolerance 20 ->
  // chance caps at 100% -> always fouls; the sole land candidate is (2,1).
  const st = craft({ pop: 130 }, ['plastics']);
  const events = [];
  process(st, RULESET, events);
  assert.strictEqual(st.map.tiles[TARGET].polluted, true, 'the one land square is fouled');
  assert.ok(events.some(e => e.type === 'pollutionSpread' && e.x === 2 && e.y === 1), 'pollutionSpread emitted');
});

test('A91: under the tolerance nothing is fouled', async () => {
  const { process } = await load();
  const st = craft({ pop: 5 }, ['plastics']); // popPollution 5 < tolerance 20
  process(st, RULESET, []);
  assert.notStrictEqual(st.map.tiles[TARGET].polluted, true, 'a small city fouls nothing');
});

test('A91: Mass Transit zeroes the population pollution term', async () => {
  const { process } = await load();
  const st = craft({ pop: 130, buildings: ['mass-transit'] }, ['plastics']);
  process(st, RULESET, []);
  assert.notStrictEqual(st.map.tiles[TARGET].polluted, true, 'mass-transit eliminates pop pollution');
});

test('A91: population pollution is tech-gated (no industrial tech -> none)', async () => {
  const { process } = await load();
  const st = craft({ pop: 130 }, []); // no industrialization/.../plastics -> modifier 0
  process(st, RULESET, []);
  assert.notStrictEqual(st.map.tiles[TARGET].polluted, true, 'no industrial tech -> no pop pollution');
});

test('A91 meltdown: a nuclear-plant city in disorder before Fusion Power fouls a square', async () => {
  const { process } = await load();
  const st = craft({ pop: 4, buildings: ['nuclear-plant'], disorder: true }, []);
  const events = [];
  process(st, meltdownAlways(), events);
  assert.strictEqual(st.map.tiles[TARGET].polluted, true, 'the meltdown fouls an adjacent square');
  assert.ok(events.some(e => e.type === 'cityMeltdown' && e.cityId === 'c1'), 'cityMeltdown emitted');
});

test('A91 meltdown: Fusion Power prevents it', async () => {
  const { process } = await load();
  const st = craft({ pop: 4, buildings: ['nuclear-plant'], disorder: true }, ['fusion-power']);
  process(st, meltdownAlways(), []);
  assert.notStrictEqual(st.map.tiles[TARGET].polluted, true, 'Fusion Power -> no meltdown');
});

test('A91 meltdown: a calm nuclear-plant city does not melt down', async () => {
  const { process } = await load();
  const st = craft({ pop: 4, buildings: ['nuclear-plant'], disorder: false }, []);
  process(st, meltdownAlways(), []);
  assert.notStrictEqual(st.map.tiles[TARGET].polluted, true, 'no disorder -> no meltdown');
});

test('A91 clean: a settler scrubs a polluted tile in cleanTurns and survives', async () => {
  const { startWork, processWork } = await loadImpr();
  const st = craft({ pop: 4 }, []);
  st.map.tiles[2 * 5 + 2].polluted = true; // the city centre tile is fouled
  st.units.u1 = { id: 'u1', type: 'settlers', owner: 'p1', x: 2, y: 2, moves: 1 };
  const r = startWork(st, { unitId: 'u1', playerId: 'p1', work: 'clean' }, RULESET);
  assert.strictEqual(r.ok, true, 'clean order accepted on a polluted tile');
  assert.strictEqual(st.units.u1.workLeft, RULESET.rules.workTurns.clean, 'workLeft = cleanTurns');
  // run cleanTurns of processWork
  for (let i = 0; i < RULESET.rules.workTurns.clean; i++) processWork(st, RULESET, []);
  assert.notStrictEqual(st.map.tiles[2 * 5 + 2].polluted, true, 'the tile is scrubbed clean');
  assert.ok(st.units.u1 !== undefined, 'the settler SURVIVES (repeatable order)');
});

test('A91 clean: rejected on a tile that is not polluted', async () => {
  const { startWork } = await loadImpr();
  const st = craft({ pop: 4 }, []);
  st.units.u1 = { id: 'u1', type: 'settlers', owner: 'p1', x: 2, y: 2, moves: 1 };
  const r = startWork(st, { unitId: 'u1', playerId: 'p1', work: 'clean' }, RULESET);
  assert.strictEqual(r.ok, false, 'nothing to clean');
  assert.strictEqual(r.reason, 'notPolluted');
});

// A91b: a warming board of `pollutedCount` fouled plains tiles, no cities.
function warmingBoard(pollutedCount) {
  const W = 6, H = 6, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'plains' });
  for (let i = 0; i < pollutedCount; i++) tiles[i].polluted = true;
  return {
    version: 1, turn: 300, year: 1990, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles }, units: {}, wonders: {}, nextUnitId: 5, nextCityId: 5,
    cities: {}, cityOrder: [], players: { p1: { id: 'p1', alive: true, techs: [], government: 'despotism' } }, rngState: 1
  };
}

test('A91b warming: sustained pollution over the threshold triggers a greenhouse transform', async () => {
  const { process } = await load();
  const poll = RULESET.rules.pollution;
  const st = warmingBoard(poll.warmingThreshold + 2); // over threshold
  let warmed = false;
  for (let turn = 0; turn < poll.warmingStageTurns * poll.warmingStages; turn++) {
    const events = [];
    process(st, RULESET, events);
    if (events.some(e => e.type === 'terrainWarmed')) warmed = true;
  }
  assert.ok(warmed, 'a greenhouse event fired after warmingStages*warmingStageTurns of pollution');
  assert.ok(st.map.tiles.some(t => t.t === 'desert'), 'some plains degraded to desert (plains->desert)');
});

test('A91b warming: below the threshold the clock idles (no warming, no state fields)', async () => {
  const { process } = await load();
  const poll = RULESET.rules.pollution;
  const st = warmingBoard(poll.warmingThreshold - 5); // under threshold
  let warmed = false;
  for (let turn = 0; turn < poll.warmingStageTurns * poll.warmingStages * 2; turn++) {
    const events = [];
    process(st, RULESET, events);
    if (events.some(e => e.type === 'terrainWarmed')) warmed = true;
  }
  assert.strictEqual(warmed, false, 'no greenhouse below the threshold');
  assert.notStrictEqual(st.map.tiles.some(t => t.t === 'desert'), true, 'no terrain degraded');
  assert.strictEqual(st.warmingStage, undefined, 'the warming clock never started (fields absent)');
});
