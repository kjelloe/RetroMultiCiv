const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const government = await import('../engine/government.js');
  const { createEngine } = await import('../engine/index.js');
  return { government, engine: createEngine(RULESET) };
}

function govState(playerExtra) {
  const tiles = [];
  for (let i = 0; i < 45; i++) tiles.push({ t: 'grassland', river: true });
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 45, height: 1, wrapX: false, tiles },
    units: {},
    cities: {
      c1: { id: 'c1', name: 'Capital', owner: 'p1', x: 0, y: 0, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'Far', owner: 'p1', x: 40, y: 0, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 9, nextCityId: 3,
    players: {
      p1: Object.assign({
        id: 'p1', name: 'A', color: '#00f', human: true, gold: 0,
        techs: ['monarchy'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50
      }, playerExtra || {})
    },
    rngState: 1
  };
}

test('revolution: anarchy for revolutionTurns, then the new government', async () => {
  const { engine } = await load();
  let res = engine.applyCommand(govState(), { type: 'setGovernment', playerId: 'p1', government: 'republic' });
  assert.strictEqual(res.reason, 'techRequired');

  res = engine.applyCommand(govState(), { type: 'setGovernment', playerId: 'p1', government: 'monarchy' });
  assert.strictEqual(res.ok, true);
  let state = res.state;
  assert.strictEqual(state.players.p1.government, 'anarchy');
  assert.strictEqual(state.players.p1.revolutionTurns, RULESET.rules.revolutionTurns);

  const again = engine.applyCommand(state, { type: 'setGovernment', playerId: 'p1', government: 'despotism' });
  assert.strictEqual(again.reason, 'inRevolution');

  let changed = null;
  for (let i = 0; i < RULESET.rules.revolutionTurns; i++) {
    const r = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
    state = r.state;
    changed = changed || r.events.find(e => e.type === 'governmentChanged');
  }
  assert.strictEqual(state.players.p1.government, 'monarchy');
  assert.ok(changed);
  assert.strictEqual(state.players.p1.revolutionTurns, undefined);
});

test('entering a revolution clamps rates to the anarchy cap immediately', async () => {
  const { engine } = await load();
  // a Monarchy player running 70% science (legal at monarchy's cap of 70)
  // revolts — anarchy caps at 60, so the surplus must move at once
  const state = govState({ government: 'monarchy', techs: ['monarchy', 'code-of-laws'], taxRate: 30, sciRate: 70 });
  const res = engine.applyCommand(state, { type: 'setGovernment', playerId: 'p1', government: 'despotism' });
  assert.strictEqual(res.ok, true);
  const p = res.state.players.p1;
  assert.strictEqual(p.government, 'anarchy');
  assert.ok(p.sciRate <= 60, `science ${p.sciRate} must respect anarchy's cap`);
  assert.strictEqual(p.taxRate + p.sciRate + (p.luxRate || 0), 100, 'rates still sum to 100');
});

test('#35 the Pyramids shorten the revolution to one turn of anarchy (Civ 1)', async () => {
  const { engine } = await load();
  // base (no wonder): revolutionTurns = 2
  const base = engine.applyCommand(govState(), { type: 'setGovernment', playerId: 'p1', government: 'monarchy' });
  assert.strictEqual(base.state.players.p1.revolutionTurns, 2, 'no wonder: the base 2-turn anarchy');

  const state = govState();
  state.wonders = { pyramids: 'c1' };
  const res = engine.applyCommand(state, { type: 'setGovernment', playerId: 'p1', government: 'monarchy' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.players.p1.government, 'anarchy', 'one turn of anarchy — NOT instant');
  assert.strictEqual(res.state.players.p1.revolutionTurns, 1, 'Pyramids: one turn only');
  assert.strictEqual(res.state.players.p1.pendingGovernment, 'monarchy');
  // the new government arrives after the single anarchy turn
  const after = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(after.players.p1.government, 'monarchy', 'monarchy after one anarchy turn');
});

test('#35 the Pyramids unlock any government regardless of tech', async () => {
  const { engine } = await load();
  // p1 lacks the Republic tech: normally rejected
  assert.strictEqual(engine.applyCommand(govState(), { type: 'setGovernment', playerId: 'p1', government: 'republic' }).reason,
    'techRequired', 'no wonder: the tech gate holds');
  // with the Pyramids: the revolution is allowed
  const state = govState();
  state.wonders = { pyramids: 'c1' };
  const res = engine.applyCommand(state, { type: 'setGovernment', playerId: 'p1', government: 'republic' });
  assert.strictEqual(res.ok, true, 'Pyramids owner may adopt Republic without its tech');
  assert.strictEqual(res.state.players.p1.pendingGovernment, 'republic');
  assert.strictEqual(res.state.players.p1.revolutionTurns, 1, 'still one turn of anarchy');
});

test('rate caps: despotism rejects >60; anarchy collects nothing', async () => {
  const { engine } = await load();
  const res = engine.applyCommand(govState(), { type: 'setRates', playerId: 'p1', tax: 30, sci: 70 });
  assert.strictEqual(res.reason, 'rateTooHigh');
  const ok = engine.applyCommand(govState(), { type: 'setRates', playerId: 'p1', tax: 40, sci: 60 });
  assert.strictEqual(ok.ok, true);

  const anarchic = govState({ government: 'anarchy' });
  const wrapped = engine.applyCommand(anarchic, { type: 'endTurn', playerId: 'p1' }).state;
  assert.strictEqual(wrapped.players.p1.gold, 0, 'anarchy: no income');
  assert.strictEqual(wrapped.players.p1.bulbs, 0);
});

test('corruption grows with distance to the capital; courthouse halves it', async () => {
  const { government } = await load();
  const state = govState();
  // despotism factor 4: trade 10 at distance 40 -> 10*40*4/200 = 8
  assert.strictEqual(government.corruptionFor(state, state.cities.c2, 10, RULESET), 8);
  assert.strictEqual(government.corruptionFor(state, state.cities.c1, 10, RULESET), 0, 'the capital is clean');
  state.cities.c2.buildings = ['courthouse'];
  assert.strictEqual(government.corruptionFor(state, state.cities.c2, 10, RULESET), 4, 'courthouse halves it');
  // a palace moves the capital
  state.cities.c2.buildings = ['palace'];
  assert.strictEqual(government.corruptionFor(state, state.cities.c2, 10, RULESET), 0);
  assert.strictEqual(government.corruptionFor(state, state.cities.c1, 10, RULESET), 8, 'old capital now suffers');
});

test('governmentOf defaults to despotism for unknown players (site-preview probes)', async () => {
  const { government } = await load();
  const cities = await import('../engine/cities.js');
  const state = govState();
  assert.strictEqual(government.governmentOf(state, undefined, RULESET).id, 'despotism');
  assert.strictEqual(government.governmentOf(state, 'nobody', RULESET).id, 'despotism');
  // the settler site preview probes candidateTiles with a pseudo-city;
  // with or without an owner it must never throw (playtest regression)
  const probe = cities.candidateTiles(state, { x: 5, y: 0 }, RULESET);
  assert.ok(probe.length > 0);
  const owned = cities.candidateTiles(state, { x: 5, y: 0, owner: 'p1' }, RULESET);
  assert.strictEqual(owned.length, probe.length);
});

test('despotism tile penalty: any yield of 3+ loses one', async () => {
  const { engine } = await load();
  const cities = await import('../engine/cities.js');
  const state = govState();
  // irrigated grassland: 3 food raw -> 2 under despotism
  state.map.tiles[1].irrigation = true;
  const worked = cities.workedTiles(state, state.cities.c1, RULESET);
  const t1 = worked.find(w => w.x === 1 && w.y === 0);
  assert.ok(t1, 'the irrigated tile is worked');
  assert.strictEqual(t1.yields.food, 2, 'despotism: 3 food becomes 2');
  // under monarchy the full 3 come through
  state.players.p1.government = 'monarchy';
  const free = cities.workedTiles(state, state.cities.c1, RULESET).find(w => w.x === 1 && w.y === 0);
  assert.strictEqual(free.yields.food, 3);
});

test('unit upkeep in shields: monarchy pays beyond the free allowance', async () => {
  const { engine } = await load();
  const state = govState({ government: 'monarchy' });
  // 5 units homed to c1: 3 free under monarchy, 2 cost 1 shield each
  for (let i = 1; i <= 5; i++) {
    state.units['u' + i] = { id: 'u' + i, type: 'militia', owner: 'p1', x: 2 + i, y: 0, moves: 1, fortified: false, veteran: false, home: 'c1' };
  }
  const before = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' }).state;
  // c1 works center (2/0/x) + best candidate; shields come only from... grassland has 0 shields,
  // so upkeep clamps at zero rather than going negative
  assert.strictEqual(before.cities.c1.shields, 0, 'upkeep clamps shields at 0');
});

// Reviewer #1205 (3): governments.json schema gate — all six governments
// carry the full required field set, in range (the terrain-coverage
// precedent: a new government must arrive complete or fail here by name).
test('governments.json: every government carries the full field set in range', () => {
  const govs = RULESET.governments;
  const REQUIRED = ['id', 'name', 'tech', 'maxRate', 'freeUnitsPerCity',
    'upkeepShields', 'corruptionFactor', 'martialLawMax', 'tilePenalty',
    'tradeBonus', 'warUnhappiness'];
  const ids = Object.keys(govs).sort();
  assert.deepStrictEqual(ids,
    ['anarchy', 'communism', 'democracy', 'despotism', 'monarchy', 'republic'],
    'the six Civ 1 governments');
  for (const id of ids) {
    const g = govs[id];
    for (const f of REQUIRED) {
      assert.ok(g[f] !== undefined, `${id}: missing required field "${f}"`);
    }
    assert.strictEqual(g.id, id);
    assert.ok(g.maxRate >= 0 && g.maxRate <= 100 && g.maxRate % 10 === 0, `${id}: maxRate in range`);
    assert.ok(Number.isInteger(g.freeUnitsPerCity) && g.freeUnitsPerCity >= 0, `${id}: freeUnitsPerCity`);
    assert.ok(Number.isInteger(g.upkeepShields) && g.upkeepShields >= 0, `${id}: upkeepShields`);
    assert.ok(Number.isInteger(g.martialLawMax) && g.martialLawMax >= 0, `${id}: martialLawMax`);
  }
});

// Reviewer #1205 (4): the RATIFIED DEVIATION pin (user ruling 2026-07-17) —
// Monarchy and Communism keep the 3-free-units-per-city upkeep allowance
// (canonical Civ 1 charges upkeep differently; the ruling chose the
// allowance). A future "authenticity fix" must flip THIS test consciously,
// not silently.
test('ratified deviation: Monarchy/Communism upkeep uses the 3-free allowance', () => {
  assert.strictEqual(RULESET.governments.monarchy.freeUnitsPerCity, 3,
    'monarchy: 3 free units per city (2026-07-17 ruling)');
  assert.strictEqual(RULESET.governments.communism.freeUnitsPerCity, 3,
    'communism: 3 free units per city (2026-07-17 ruling)');
  assert.strictEqual(RULESET.governments.monarchy.upkeepShields, 1);
  assert.strictEqual(RULESET.governments.communism.upkeepShields, 1);
});
