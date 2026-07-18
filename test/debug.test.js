// N12 / A92 debug commands (engine/debug.js): the debugEnabled gate, each action,
// the rejections, and the permanent debugUsed taint. Cross-language behaviour is
// pinned by scenario 040; these are the JS-side unit rows.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

function state(debugEnabled) {
  const tiles = [];
  for (let i = 0; i < 9; i++) tiles.push({ t: 'grassland' });
  const s = {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 3, height: 3, wrapX: false, tiles }, units: {}, cities: {}, cityOrder: [], wonders: {},
    nextUnitId: 1, nextCityId: 1,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, gold: 10, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    }, rngState: 1
  };
  if (debugEnabled) s.debugEnabled = true;
  return s;
}

test('debug commands are rejected unless the game is debugEnabled', async () => {
  const eng = await load();
  const r = eng.applyCommand(state(false), { type: 'debug', playerId: 'p1', action: 'grantGold', amount: 100 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'debugDisabled');
  assert.strictEqual(r.state.debugUsed, undefined, 'a rejected debug command sets no taint');
});

test('grantGold adds (clamped >= 0) and taints; unknown player rejected', async () => {
  const eng = await load();
  const a = eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'grantGold', amount: 500 });
  assert.strictEqual(a.state.players.p1.gold, 510);
  assert.strictEqual(a.state.debugUsed, true);
  const b = eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'grantGold', amount: -1000 });
  assert.strictEqual(b.state.players.p1.gold, 0, 'gold clamps at 0');
  const c = eng.applyCommand(state(true), { type: 'debug', playerId: 'ghost', action: 'grantGold', amount: 5 });
  assert.strictEqual(c.reason, 'unknownPlayer');
});

test('spawnUnit creates a fresh unit; badUnitType / outOfBounds / occupiedByEnemy rejected', async () => {
  const eng = await load();
  const ok = eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'spawnUnit', unitType: 'militia', x: 2, y: 2 });
  const u = ok.state.units.u1;
  assert.strictEqual(u.type, 'militia');
  assert.strictEqual(u.owner, 'p1');
  assert.strictEqual(u.veteran, false, 'spawned fresh, not veteran');
  assert.strictEqual(u.moves, RULESET.units.militia.moves);
  assert.strictEqual(u.home, undefined, 'no home city');
  assert.strictEqual(eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'spawnUnit', unitType: 'nope', x: 0, y: 0 }).reason, 'badUnitType');
  assert.strictEqual(eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'spawnUnit', unitType: 'militia', x: 9, y: 0 }).reason, 'outOfBounds');
  const s = state(true);
  s.units.e = { id: 'e', type: 'militia', owner: 'p2', x: 1, y: 1, moves: 1, fortified: false, veteran: false };
  assert.strictEqual(eng.applyCommand(s, { type: 'debug', playerId: 'p1', action: 'spawnUnit', unitType: 'militia', x: 1, y: 1 }).reason, 'occupiedByEnemy');
});

test('grantTech routes through the acquisition seam; unknown / already-known rejected', async () => {
  const eng = await load();
  const r = eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'grantTech', tech: 'gunpowder' });
  assert.ok(r.state.players.p1.techs.includes('gunpowder'));
  assert.ok(r.events.some(e => e.type === 'techDiscovered'), 'emits techDiscovered via grantTech');
  assert.ok(r.events.some(e => e.type === 'debugCommand'));
  assert.strictEqual(eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'grantTech', tech: 'nope' }).reason, 'unknownTech');
  const known = state(true); known.players.p1.techs = ['gunpowder'];
  assert.strictEqual(eng.applyCommand(known, { type: 'debug', playerId: 'p1', action: 'grantTech', tech: 'gunpowder' }).reason, 'alreadyKnown');
});

test('revealMap fills the explored mask; unknown action rejected', async () => {
  const eng = await load();
  const r = eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'revealMap' });
  assert.deepStrictEqual(r.state.players.p1.explored, [1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.strictEqual(r.state.debugUsed, true);
  assert.strictEqual(eng.applyCommand(state(true), { type: 'debug', playerId: 'p1', action: 'frobnicate' }).reason, 'unknownDebugAction');
});
