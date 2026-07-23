// late-join §3 (specs/late-join-pause.md): claimSeat flips an AI seat to human so a
// late joiner takes over an AI civ through the normal (stamped + logged) command path.
// New engine command (engine/index.js) + luau twin + scenario 061; the semantics +
// rejections live here. Deterministic, no RNG; sets players[player].human = true only.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

function mk() {
  const tiles = []; for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 10, year: -3000, activePlayer: 'p2', playerOrder: ['p1', 'p2', 'p3'],
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: {}, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 1, nextCityId: 1,
    players: {
      p1: { id: 'p1', name: 'Human', color: '#00f', human: true, gold: 0, techs: [], researching: 'pottery', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'AI-Two', color: '#f00', human: false, gold: 0, techs: [], researching: 'pottery', bulbs: 0, taxRate: 50, sciRate: 50 },
      p3: { id: 'p3', name: 'Dead', color: '#0f0', human: false, alive: false, gold: 0, techs: [], researching: 'pottery', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('claimSeat flips an AI seat to human and emits seatClaimed', async () => {
  const engine = await load();
  const r = engine.applyCommand(mk(), { type: 'claimSeat', player: 'p2' });
  assert.ok(r.ok, `claimSeat should succeed: ${r.reason}`);
  assert.strictEqual(r.state.players.p2.human, true, 'the seat becomes human');
  assert.strictEqual(r.state.players.p1.human, true, 'other seats untouched');
  assert.ok(r.events.some(e => e.type === 'seatClaimed' && e.player === 'p2'), 'a seatClaimed event names the seat');
});

test('claimSeat rejections: unknown player / dead / already human / game over', async () => {
  const engine = await load();
  assert.strictEqual(engine.applyCommand(mk(), { type: 'claimSeat', player: 'p9' }).reason, 'unknownPlayer');
  assert.strictEqual(engine.applyCommand(mk(), { type: 'claimSeat', player: 'p3' }).reason, 'playerDead');
  assert.strictEqual(engine.applyCommand(mk(), { type: 'claimSeat', player: 'p1' }).reason, 'alreadyHuman');
  // gameOver is rejected at applyCommand entry (before dispatch) — the seat never flips
  const over = mk(); over.gameOver = true;
  const r = engine.applyCommand(over, { type: 'claimSeat', player: 'p2' });
  assert.strictEqual(r.reason, 'gameOver');
  assert.strictEqual(r.state.players.p2.human, false, 'a game-over claim does not flip the seat');
});

test('claimSeat has no reverse flip: a second claim on a now-human seat is rejected', async () => {
  const engine = await load();
  const first = engine.applyCommand(mk(), { type: 'claimSeat', player: 'p2' });
  const second = engine.applyCommand(first.state, { type: 'claimSeat', player: 'p2' });
  assert.strictEqual(second.reason, 'alreadyHuman', 'no un-claim; the seat stays human');
  assert.strictEqual(second.state.players.p2.human, true);
});
