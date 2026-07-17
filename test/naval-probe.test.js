// N3 (Wave-2 #1): the naval probe. A civ whose cities sit on a watery map
// (sea tiles within rules.aiNavyRadius over rules.aiNavyWaterPct) is NAVAL: once
// it holds a land core (>= rules.aiNavyAfterLandUnits) it builds ships in its
// COASTAL cities (bestSeaUnit, earliest-available) up to 1 per coastal city
// capped at rules.aiNavyTargetCap, and beelines the ship tech after monarchy.
// Those ships range as B23b boat-scouts. Scope: BUILD + SCOUT only — no
// cross-water troop logistics. All knobs are rules.json, sim-runner-swept.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/ai.js');
}

function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

// WxH map: columns >= landCols are ocean, the rest grassland. A city at
// (landCols-1, y) sits on the coast (its east neighbour is sea).
function seaMap(W, H, landCols) {
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x >= landCols ? 'ocean' : 'grassland' });
  return { width: W, height: H, wrapX: false, tiles };
}

function navalState(map, cityX, units, techs) {
  const cityY = 5;
  const unitObj = {};
  for (const u of units) unitObj[u.id] = Object.assign({ owner: 'p1', moves: 1, fortified: false, veteran: false }, u);
  return {
    version: 1, turn: 30, year: -1500, activePlayer: 'p1', playerOrder: ['p1'],
    map,
    units: unitObj,
    cities: { c1: { id: 'c1', name: 'Port', owner: 'p1', x: cityX, y: cityY, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 20, nextCityId: 2,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: techs || [], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

test('N3: navyPriorityOf — a watery map trips the flag, a dry one does not', async () => {
  const ai = await load();
  const wet = navalState(seaMap(14, 12, 6), 5, [], []); // ~half the radius box is sea
  assert.strictEqual(ai.navyPriorityOf(wet, 'p1', RULESET), true, 'coast city, >30% water in radius');
  const dry = navalState(seaMap(14, 12, 14), 5, [], []); // no ocean at all
  assert.strictEqual(ai.navyPriorityOf(dry, 'p1', RULESET), false, 'landlocked -> not naval');
  const off = withRules({ aiNavyWaterPct: undefined });
  assert.strictEqual(ai.navyPriorityOf(wet, 'p1', off), false, 'knob absent -> feature off');
});

test('N3: bestSeaUnit — earliest ship once its tech is known, null before', async () => {
  const ai = await load();
  const me = { techs: [] };
  assert.strictEqual(ai.bestSeaUnit(me, RULESET), null, 'no naval tech -> no ship');
  assert.strictEqual(ai.bestSeaUnit({ techs: ['map-making'] }, RULESET), 'trireme', 'map-making unlocks the trireme');
});

test('N3: a coastal naval civ with a land core builds a ship (above buildings)', async () => {
  const ai = await load();
  // 3 land militia (the land core, one garrisons the city) + 2 settlers (so the
  // settler target is met); monarchy + map-making known but NO attacker tech ->
  // the want-decision falls through walls/attacker to the naval slot.
  const units = [
    { id: 'u1', type: 'militia', x: 5, y: 5 },
    { id: 'u2', type: 'militia', x: 4, y: 5 },
    { id: 'u3', type: 'militia', x: 4, y: 4 },
    { id: 'u4', type: 'settlers', x: 3, y: 5 },
    { id: 'u5', type: 'settlers', x: 3, y: 4 }
  ];
  const st = navalState(seaMap(14, 12, 6), 5, units, ['monarchy', 'map-making']);
  const cmd = ai.pickCommand(st, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'setProduction', 'the coastal city sets production');
  assert.strictEqual(cmd.cityId, 'c1');
  assert.deepStrictEqual(cmd.item, { kind: 'unit', id: 'trireme' }, 'it builds the earliest ship');
});

test('N3: a landlocked civ never builds a ship', async () => {
  const ai = await load();
  const units = [
    { id: 'u1', type: 'militia', x: 5, y: 5 },
    { id: 'u2', type: 'militia', x: 4, y: 5 },
    { id: 'u3', type: 'militia', x: 4, y: 4 },
    { id: 'u4', type: 'settlers', x: 3, y: 5 },
    { id: 'u5', type: 'settlers', x: 3, y: 4 }
  ];
  const st = navalState(seaMap(14, 12, 14), 5, units, ['monarchy', 'map-making']); // all land
  const cmd = ai.pickCommand(st, 'p1', RULESET, {});
  if (cmd && cmd.type === 'setProduction' && cmd.cityId === 'c1') {
    assert.notStrictEqual(cmd.item.id, 'trireme', 'dry map -> no ship');
  }
});

test('N3: the land-core floor and target-cap are sweepable knobs', async () => {
  const ai = await load();
  const units = [
    { id: 'u1', type: 'militia', x: 5, y: 5 },
    { id: 'u2', type: 'militia', x: 4, y: 5 },
    { id: 'u3', type: 'militia', x: 4, y: 4 },
    { id: 'u4', type: 'settlers', x: 3, y: 5 },
    { id: 'u5', type: 'settlers', x: 3, y: 4 }
  ];
  // raise the land-core floor above what the civ has -> the ship is withheld
  const strict = withRules({ aiNavyAfterLandUnits: 99 });
  const st = navalState(seaMap(14, 12, 6), 5, units, ['monarchy', 'map-making']);
  const cmd = ai.pickCommand(st, 'p1', strict, {});
  if (cmd && cmd.type === 'setProduction' && cmd.cityId === 'c1') {
    assert.notStrictEqual(cmd.item.id, 'trireme', 'floor 99 -> not yet naval');
  }
});

test('N3 guard: a land scout will NOT step onto sea (no auto-board), even beside a friendly ship', async () => {
  const ai = await load();
  // 6x3: land cols 0-3, sea cols 4-5. A land legion scout sits at the coast (3,1);
  // the ONLY fog is across the sea (a friendly trireme waits at (4,1)). Greedy
  // explore would step E onto sea and A69-board the trireme — the guard forbids it.
  const W = 6, H = 3;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x >= 4 ? 'ocean' : 'grassland' });
  const explored = new Array(W * H).fill(1);
  explored[1 * W + 5] = 0; // the only fog: sea tile (5,1), reachable only across water
  const st = {
    version: 1, turn: 30, year: -1500, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'legion', owner: 'p1', x: 3, y: 1, moves: 1, fortified: false, veteran: false },
      u2: { id: 'u2', type: 'trireme', owner: 'p1', x: 4, y: 1, moves: 3, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['map-making'], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50, explored } },
    rngState: 1
  };
  const greedy = withRules({ aiExploreMode: 'greedy', aiScoutSharePct: 100 });
  const cmd = ai.pickCommand(st, 'p1', greedy, {}, undefined);
  // whatever u1 does, it must not move EAST onto the sea tile (4,1) and board u2
  if (cmd && cmd.type === 'moveUnit' && cmd.unitId === 'u1') {
    assert.notStrictEqual(cmd.dir, 'E', 'the land scout must not step onto the sea tile (would auto-board)');
  }
});

test('N3: a naval civ that lacks the ship tech beelines it — after monarchy', async () => {
  const ai = await load();
  const { createEngine } = await import('../engine/index.js');
  void createEngine;
  // monarchy + alphabet known so map-making (level 2) is DIRECTLY available; the
  // attacker beeline is off (weight 0). The naval beeline must pull the civ onto
  // map-making even though cheaper level-1 techs exist — proving it is live and
  // load-bearing (without it the AI would take the globally-cheapest tech).
  const noAtk = withRules({ aiAttackerTechWeight: 0 });
  const st = navalState(seaMap(14, 12, 6), 5, [{ id: 'u1', type: 'militia', x: 5, y: 5 }], ['monarchy', 'alphabet']);
  st.players.p1.researching = '';
  const cmd = ai.pickCommand(st, 'p1', noAtk, {});
  assert.strictEqual(cmd.type, 'setResearch', 'it picks a research target');
  assert.strictEqual(cmd.tech, 'map-making', 'the naval beeline targets the ship tech over cheaper options');
});
