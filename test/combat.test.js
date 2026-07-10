const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');
const TERRAIN = RULESET.terrain;
const UNITS = RULESET.units;

async function load() {
  const combat = await import('../engine/combat.js');
  const { createEngine } = await import('../engine/index.js');
  return { combat, engine: createEngine(RULESET) };
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

test('strength math: veteran, terrain, river, fortified multipliers', async () => {
  const { combat } = await load();
  const legion = { type: 'legion', veteran: false };
  assert.strictEqual(combat.attackStrength(legion, RULESET), 3 * 100 * 100);
  assert.strictEqual(combat.attackStrength({ ...legion, veteran: true }, RULESET), 3 * 150 * 100);

  const grass = miniState([{ t: 'grassland' }], 1, 1, {});
  const militia = { type: 'militia', x: 0, y: 0, fortified: false };
  assert.strictEqual(combat.defenseStrength(grass, militia, RULESET), 1 * 100 * 100);
  assert.strictEqual(combat.defenseStrength(grass, { ...militia, fortified: true }, RULESET), 1 * 100 * 150);

  const mountain = miniState([{ t: 'mountains' }], 1, 1, {});
  assert.strictEqual(combat.defenseStrength(mountain, militia, RULESET), 1 * 300 * 100, 'mountains +200%');

  const river = miniState([{ t: 'grassland', river: true }], 1, 1, {});
  assert.strictEqual(combat.defenseStrength(river, militia, RULESET), 1 * 150 * 100, 'river +50%');
});

test('bestDefender picks the strongest unit on the tile', async () => {
  const { combat } = await load();
  const state = miniState([{ t: 'grassland' }], 1, 1, {
    u1: { id: 'u1', type: 'militia', owner: 'p2', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
    u2: { id: 'u2', type: 'phalanx', owner: 'p2', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
  });
  assert.strictEqual(combat.bestDefender(state, 0, 0, RULESET).id, 'u2', 'phalanx (D2) over militia (D1)');
});

test('land units cannot attack ships at sea; ships can bombard the shore', async () => {
  const { engine } = await load();
  const tiles = [{ t: 'grassland' }, { t: 'ocean' }];
  const state = miniState(tiles, 2, 1, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
    u2: { id: 'u2', type: 'trireme', owner: 'p2', x: 1, y: 0, moves: 3, fortified: false, veteran: false }
  });
  const res = engine.applyCommand(state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'cannotAttackThere');

  // reverse: the ship attacks the legion on land (shore bombardment is legal)
  const state2 = miniState(tiles, 2, 1, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
    u2: { id: 'u2', type: 'frigate', owner: 'p2', x: 1, y: 0, moves: 4, fortified: false, veteran: false }
  }, { activePlayer: 'p2', playerOrder: ['p2', 'p1'] });
  const res2 = engine.applyCommand(state2, { type: 'moveUnit', playerId: 'p2', unitId: 'u2', dir: 'W' });
  assert.strictEqual(res2.ok, true);
  assert.strictEqual(res2.events[0].type, 'combatResolved');
});

test('ZOC exemption: a unit may still move onto its own unit or city', async () => {
  const { engine } = await load();
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  // p1 militia at (0,1) is in the ZOC of the enemy phalanx at (1,0);
  // moving E to (1,1) is also in ZOC — but a friendly unit holds that tile.
  const state = {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 1, moves: 1, fortified: false, veteran: false },
      u2: { id: 'u2', type: 'militia', owner: 'p1', x: 1, y: 1, moves: 1, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'phalanx', owner: 'p2', x: 1, y: 0, moves: 1, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], nextUnitId: 4, nextCityId: 1,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, gold: 0, techs: [], researching: '' },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '' }
    },
    rngState: 1
  };
  const onto = engine.applyCommand(state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(onto.ok, true, 'stacking with own unit is exempt from ZOC');

  // the same move without the friendly unit is blocked
  delete state.units.u2;
  const blocked = engine.applyCommand(state, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reason, 'zoc');
});

test('sortIds orders numerically-suffixed ids portably', async () => {
  const { combat } = await load();
  assert.deepStrictEqual(combat.sortIds(['u10', 'u2', 'u1']), ['u1', 'u2', 'u10']);
});

test('barbarians spawn at the gate turn and hunt nearby units', async () => {
  const { engine } = await load();
  const barb = await import('../engine/barbarians.js');
  // 10x6 all-grassland world, one lonely militia; find a seed that spawns
  const tiles = [];
  for (let i = 0; i < 60; i++) tiles.push({ t: 'grassland' });
  let spawned = null;
  for (let seed = 1; seed < 60 && !spawned; seed++) {
    const state = miniState(tiles.map(t => ({ ...t })), 10, 6, {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 5, y: 3, moves: 1, fortified: false, veteran: false }
    }, { turn: barb.FIRST_TURN, rngState: seed });
    const events = [];
    barb.process(state, RULESET, events);
    if (events.some(e => e.type === 'barbariansSpawned')) spawned = state;
  }
  assert.ok(spawned, 'some seed under 60 must spawn barbarians');
  assert.ok(spawned.players.barb, 'barbarian player created on first spawn');
  const barbUnits = Object.values(spawned.units).filter(u => u.owner === 'barb');
  assert.strictEqual(barbUnits.length, 1);

  // before the gate turn: no rng consumed, no spawn — protects scenario hashes
  const early = miniState(tiles.map(t => ({ ...t })), 10, 6, {}, { turn: 6, rngState: 42 });
  barb.process(early, RULESET, []);
  assert.strictEqual(early.rngState, 42, 'no RNG consumption before FIRST_TURN');
  assert.strictEqual(early.players.barb, undefined);
});
