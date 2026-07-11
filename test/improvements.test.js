const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const WORK_TURNS = RULESET.rules.workTurns;

async function load() {
  const improvements = await import('../engine/improvements.js');
  const cities = await import('../engine/cities.js');
  const { createEngine } = await import('../engine/index.js');
  return { improvements, cities, engine: createEngine(RULESET) };
}

function miniState(tiles, width, height, units, extra) {
  return Object.assign({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities: {}, cityOrder: [], nextUnitId: 99, nextCityId: 1,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, gold: 0, techs: [], researching: '' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '' }
    },
    rngState: 1
  }, extra || {});
}

function settler(x, y) {
  return { id: 'u1', type: 'settlers', owner: 'p1', x, y, moves: 1, fortified: false, veteran: false };
}

test('startWork validation: unit type, terrain support, water source, duplicates', async () => {
  const { engine } = await load();
  // desert inland (no water anywhere), grassland, ocean
  const tiles = [{ t: 'desert' }, { t: 'grassland' }, { t: 'desert' }];
  const base = () => miniState(tiles.map(t => ({ ...t })), 3, 1, {
    u1: settler(0, 0),
    u2: { id: 'u2', type: 'militia', owner: 'p1', x: 1, y: 0, moves: 1, fortified: false, veteran: false }
  });

  let res = engine.applyCommand(base(), { type: 'startWork', playerId: 'p1', unitId: 'u2', work: 'road' });
  assert.strictEqual(res.reason, 'notSettlers');

  res = engine.applyCommand(base(), { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'castle' });
  assert.strictEqual(res.reason, 'badWork');

  // desert with no adjacent water cannot irrigate...
  res = engine.applyCommand(base(), { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'irrigate' });
  assert.strictEqual(res.reason, 'noWater');

  // ...but a river on the tile is a water source
  const river = base();
  river.map.tiles[0].river = true;
  res = engine.applyCommand(river, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'irrigate' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.units.u1.working, 'irrigate');
  assert.strictEqual(res.state.units.u1.workLeft, WORK_TURNS.irrigate);
  assert.strictEqual(res.state.units.u1.moves, 0, 'starting work consumes the turn');

  // grassland supports no mine (Civ 1: mining grassland plants forest — later slice)
  const grass = base();
  grass.units.u1.x = 1;
  res = engine.applyCommand(grass, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'mine' });
  assert.strictEqual(res.reason, 'badTerrain');

  // an existing road rejects a second one
  const roaded = base();
  roaded.map.tiles[0].road = true;
  res = engine.applyCommand(roaded, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'road' });
  assert.strictEqual(res.reason, 'alreadyImproved');
});

test('work completes at the turn wrap after workTurns turns; unit is freed', async () => {
  const { engine } = await load();
  const tiles = [{ t: 'grassland' }, { t: 'grassland' }];
  let state = miniState(tiles, 2, 1, { u1: settler(0, 0) });

  state = engine.applyCommand(state, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'road' }).state;
  let built = null;
  for (let i = 0; i < WORK_TURNS.road; i++) {
    assert.strictEqual(state.map.tiles[0].road, undefined, `no road before wrap ${i + 1}`);
    state = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' }).state;
    const res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p2' });
    state = res.state;
    built = built || res.events.find(e => e.type === 'improvementBuilt');
  }
  assert.strictEqual(state.map.tiles[0].road, true);
  assert.ok(built, 'improvementBuilt event fired');
  assert.strictEqual(built.work, 'road');
  assert.strictEqual(built.owner, 'p1');
  assert.strictEqual(state.units.u1.working, undefined, 'settler freed after completion');
  assert.strictEqual(state.units.u1.workLeft, undefined);
});

test('tileYields: irrigation, mine, road bonuses; no road trade on river tiles', async () => {
  const { cities } = await load();
  const y = (tile) => cities.tileYields(tile, RULESET);

  assert.deepStrictEqual(y({ t: 'grassland', irrigation: true }), { food: 3, shields: 0, trade: 0 });
  assert.deepStrictEqual(y({ t: 'hills', mine: true }), { food: 1, shields: 3, trade: 0 });
  assert.deepStrictEqual(y({ t: 'mountains', mine: true }), { food: 0, shields: 2, trade: 0 });
  assert.deepStrictEqual(y({ t: 'grassland', road: true }), { food: 2, shields: 0, trade: 1 });
  // Civ 1: the river already carries the trade — roads add none there
  assert.deepStrictEqual(y({ t: 'grassland', road: true, river: true }), { food: 2, shields: 0, trade: 1 });
  // hills have no road trade bonus at all
  assert.deepStrictEqual(y({ t: 'hills', road: true }), { food: 1, shields: 0, trade: 0 });
});

test('mine and irrigation replace each other on completion (Civ 1)', async () => {
  const { engine } = await load();
  // desert supports both; river flag supplies the irrigation water source
  const tiles = [{ t: 'desert', river: true, mine: true }, { t: 'grassland' }];
  let state = miniState(tiles, 2, 1, { u1: settler(0, 0) });
  state = engine.applyCommand(state, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'irrigate' }).state;
  for (let i = 0; i < RULESET.rules.workTurns.irrigate; i++) {
    state = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' }).state;
    state = engine.applyCommand(state, { type: 'endTurn', playerId: 'p2' }).state;
  }
  assert.strictEqual(state.map.tiles[0].irrigation, true);
  assert.strictEqual(state.map.tiles[0].mine, undefined, 'irrigating removed the mine');
});

test('pillage: sea units cannot pillage the shore', async () => {
  const { engine } = await load();
  const tiles = [{ t: 'grassland', road: true }, { t: 'ocean' }];
  const state = miniState(tiles, 2, 1, {
    u1: { id: 'u1', type: 'trireme', owner: 'p1', x: 1, y: 0, moves: 3, fortified: false, veteran: false }
  });
  const res = engine.applyCommand(state, { type: 'pillage', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'badTerrain');
});

test('road-to-road movement costs 1 regardless of terrain; moving cancels work', async () => {
  const { engine } = await load();
  const tiles = [{ t: 'hills', road: true }, { t: 'hills', road: true }, { t: 'hills' }];
  // 2 movement points: normally the first hills step (cost 2) would spend both
  const state = miniState(tiles, 3, 1, {
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 2, fortified: false, veteran: false }
  });
  let res = engine.applyCommand(state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(res.state.units.u1.moves, 1, 'road-to-road hills step costs 1');
  res = engine.applyCommand(res.state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(res.state.units.u1.moves, 0, 'stepping off the road pays terrain cost');

  // a working settler that moves abandons the job
  const tiles2 = [{ t: 'grassland' }, { t: 'grassland' }];
  let s2 = miniState(tiles2, 2, 1, { u1: settler(0, 0) });
  s2 = engine.applyCommand(s2, { type: 'startWork', playerId: 'p1', unitId: 'u1', work: 'road' }).state;
  s2 = engine.applyCommand(s2, { type: 'endTurn', playerId: 'p1' }).state;
  s2 = engine.applyCommand(s2, { type: 'endTurn', playerId: 'p2' }).state; // moves refresh
  s2 = engine.applyCommand(s2, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' }).state;
  assert.strictEqual(s2.units.u1.working, undefined, 'moving cancels the work');
  assert.strictEqual(s2.units.u1.workLeft, undefined);
  for (let i = 0; i < WORK_TURNS.road + 1; i++) {
    s2 = engine.applyCommand(s2, { type: 'endTurn', playerId: 'p1' }).state;
    s2 = engine.applyCommand(s2, { type: 'endTurn', playerId: 'p2' }).state;
  }
  assert.strictEqual(s2.map.tiles[0].road, undefined, 'abandoned work never completes');
});
