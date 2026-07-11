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
  const evt = res2.events[0];
  assert.strictEqual(evt.type, 'combatResolved');
  // the client combat log depends on these enriched fields
  assert.strictEqual(evt.attackerType, 'frigate');
  assert.strictEqual(evt.attackerOwner, 'p2');
  assert.strictEqual(evt.defenderType, 'legion');
  assert.strictEqual(evt.defenderOwner, 'p1');
  assert.ok(Number.isInteger(evt.x) && Number.isInteger(evt.y));
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

test('fortify: sets the flag, ends the turn, and moving clears it', async () => {
  const { engine } = await load();
  const tiles = [{ t: 'grassland' }, { t: 'grassland' }];
  const state = miniState(tiles, 2, 1, {
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
  });
  const res = engine.applyCommand(state, { type: 'fortify', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.units.u1.fortified, true);
  assert.strictEqual(res.state.units.u1.moves, 0, 'fortifying ends the turn');

  const again = engine.applyCommand(res.state, { type: 'fortify', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(again.reason, 'alreadyFortified');

  // next turn: moving drops the fortification
  let s = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p1' }).state;
  s = engine.applyCommand(s, { type: 'endTurn', playerId: 'p2' }).state;
  const moved = engine.applyCommand(s, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
  assert.strictEqual(moved.state.units.u1.fortified, false);
});

test('wait: the unit is done for this turn, nothing else changes', async () => {
  const { engine } = await load();
  const state = miniState([{ t: 'grassland' }], 1, 1, {
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
  });
  const res = engine.applyCommand(state, { type: 'wait', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.units.u1.moves, 0);
  assert.strictEqual(res.state.units.u1.fortified, false, 'waiting is not fortifying');
  assert.strictEqual(res.events[0].type, 'unitWaited');

  const again = engine.applyCommand(res.state, { type: 'wait', playerId: 'p1', unitId: 'u1' });
  assert.strictEqual(again.reason, 'noMovesLeft');
});

test('sortIds orders numerically-suffixed ids portably', async () => {
  const { combat } = await load();
  assert.deepStrictEqual(combat.sortIds(['u10', 'u2', 'u1']), ['u1', 'u2', 'u10']);
});

test('city walls triple defense; Great Wall extends it until Gunpowder', async () => {
  const { combat } = await load();
  const state = miniState([{ t: 'grassland' }], 1, 1, {}, {
    cities: { c1: { id: 'c1', name: 'K', owner: 'p2', x: 0, y: 0, pop: 1, food: 0, shields: 0, buildings: ['city-walls'], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'], wonders: {}
  });
  const militia = { type: 'militia', x: 0, y: 0, fortified: false };
  assert.strictEqual(combat.defenseStrength(state, militia, RULESET), 1 * 100 * 100 * 3);

  // Great Wall: walls everywhere for its owner...
  state.cities.c1.buildings = [];
  state.cities.c2 = { id: 'c2', name: 'W', owner: 'p2', x: 0, y: 0, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
  state.wonders['great-wall'] = 'c2';
  assert.strictEqual(combat.defenseStrength(state, militia, RULESET), 1 * 100 * 100 * 3);

  // ...until anyone discovers Gunpowder (obsoleteBy)
  state.players.p1.techs = ['gunpowder'];
  assert.strictEqual(combat.defenseStrength(state, militia, RULESET), 1 * 100 * 100);
});

test('fortress: doubles defense (walls win) and stops stack death', async () => {
  const { combat, engine } = await load();
  const state = miniState([{ t: 'grassland', fortress: true }], 1, 1, {});
  const militia = { type: 'militia', x: 0, y: 0, fortified: false };
  assert.strictEqual(combat.defenseStrength(state, militia, RULESET), 1 * 100 * 100 * 2);

  // attacker guaranteed to win (huge attack): only ONE defender dies in a fortress
  const tiles = [{ t: 'grassland' }, { t: 'grassland', fortress: true }];
  const s2 = miniState(tiles, 2, 1, {
    u1: { id: 'u1', type: 'armor', owner: 'p1', x: 0, y: 0, moves: 8, fortified: false, veteran: true },
    u2: { id: 'u2', type: 'militia', owner: 'p2', x: 1, y: 0, moves: 1, fortified: false, veteran: false },
    u3: { id: 'u3', type: 'militia', owner: 'p2', x: 1, y: 0, moves: 1, fortified: false, veteran: false }
  });
  // find a seed where the attacker wins, then count survivors
  for (let seed = 1; seed < 50; seed++) {
    s2.rngState = seed;
    const res = engine.applyCommand(s2, { type: 'moveUnit', playerId: 'p1', unitId: 'u1', dir: 'E' });
    const evt = res.events[0];
    if (evt.winner !== 'attacker') continue;
    assert.strictEqual(evt.unitsLost, 1, 'fortress: single loss, no stack death');
    assert.strictEqual(Object.keys(res.state.units).filter(id => res.state.units[id].owner === 'p2').length, 1);
    return;
  }
  assert.fail('no winning seed found under 50');
});

test('capture clears manual workers and specialists (pop drops beneath them)', async () => {
  const { combat } = await load();
  const state = miniState([{ t: 'grassland' }, { t: 'grassland' }], 2, 1, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
  }, {
    cities: {
      c1: { id: 'c1', name: 'T', owner: 'p2', x: 1, y: 0, pop: 5, food: 0, shields: 7, buildings: [], producing: { kind: 'unit', id: 'settlers' }, workers: [0, 1], taxmen: 2, scientists: 1 }
    },
    cityOrder: ['c1']
  });
  const events = [];
  combat.captureCity(state, state.units.u1, state.cities.c1, events);
  const c = state.cities.c1;
  assert.strictEqual(c.owner, 'p1');
  assert.strictEqual(c.pop, 4);
  assert.strictEqual(c.workers, undefined, 'manual assignment does not survive capture');
  assert.strictEqual(c.taxmen, undefined);
  assert.strictEqual(c.scientists, undefined);
  assert.ok(events.find(e => e.type === 'cityCaptured'));
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
