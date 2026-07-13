const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const scoring = await import('../engine/score.js');
  const { createEngine } = await import('../engine/index.js');
  return { scoring, engine: createEngine(RULESET) };
}

function duelState(extra) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 5, year: -3920, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false }
    },
    cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 1, y: 1, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1'], wonders: { pyramids: 'c1' }, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, alive: true, gold: 0, techs: ['alphabet', 'pottery'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  }, extra || {});
}

test('score: citizens, techs, and wonders weighted per rules.json', async () => {
  const { scoring } = await load();
  const state = duelState();
  // 4 citizens*2 + 2 techs*5 + 1 wonder*20 = 38
  assert.strictEqual(scoring.score(state, 'p1', RULESET), 38);
  assert.strictEqual(scoring.score(state, 'p2', RULESET), 0);
});

test('conquest: last civilization standing wins at turn wrap', async () => {
  const { engine } = await load();
  const state = duelState(); // p2 has no assets at all
  let res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.ok, true);
  res = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p2' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.gameOver, true);
  assert.strictEqual(res.state.winner, 'p1');
  const over = res.events.find(e => e.type === 'gameOver');
  assert.strictEqual(over.victory, 'conquest');
  // no further commands accepted
  const dead = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(dead.reason, 'gameOver');
});

test('score victory at the end year', async () => {
  const { engine } = await load();
  const state = duelState({
    year: 2099, // the A21 curve steps +2 here → 2101 crosses endYear 2100
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
      u2: { id: 'u2', type: 'militia', owner: 'p2', x: 4, y: 4, moves: 1, fortified: false, veteran: false }
    }
  });
  let res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  res = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p2' });
  assert.strictEqual(res.state.gameOver, true, 'year 2101 >= endYear 2100');
  assert.strictEqual(res.state.winner, 'p1', 'higher score wins');
  assert.strictEqual(res.events.find(e => e.type === 'gameOver').victory, 'score');
});

test('crafted states without alive flags never trigger game end', async () => {
  const { engine } = await load();
  const state = duelState();
  state.players.p1.alive = undefined;
  state.players.p2.alive = undefined;
  delete state.players.p1.alive;
  delete state.players.p2.alive;
  let res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
  res = engine.applyCommand(res.state, { type: 'endTurn', playerId: 'p2' });
  assert.strictEqual(res.state.gameOver, undefined);
});

test('save round-trip: serialized state replays to the same hash', async () => {
  const { engine } = await load();
  const { hashState } = await import('../shared/statehash.js');
  const state = engine.createGame({ seed: 99, options: { width: 24, height: 16, players: [
    { id: 'p1', name: 'A', color: '#00f', human: true },
    { id: 'p2', name: 'B', color: '#f00', human: false }
  ] } });
  const restored = JSON.parse(JSON.stringify(state)); // what S/L does in the client
  assert.strictEqual(hashState(restored), hashState(state));
  // and the restored state is fully playable
  const res = engine.applyCommand(restored, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.ok, true);
});
