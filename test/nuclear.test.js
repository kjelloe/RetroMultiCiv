// A72 slice 4: the nuclear missile is a one-shot air weapon (Civ 1). It flies
// (air movement), strikes once, and is CONSUMED — win or lose — instead of
// surviving on a win like a normal attacker. Area damage / pollution is a
// deferred follow-up. Cross-language: test/scenarios/024-nuclear.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine(RULESET);
}

// a nuke adjacent to an enemy defender on land.
function craft(attackerType) {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {
      n1: { id: 'n1', type: attackerType, owner: 'p1', x: 1, y: 2, moves: RULESET.units[attackerType].moves, fortified: false, veteran: false },
      d1: { id: 'd1', type: 'militia', owner: 'p2', x: 2, y: 2, moves: 0, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('A72: a nuclear missile strikes and is consumed (one-shot)', async () => {
  const engine = await load();
  const res = engine.applyCommand(craft('nuclear'), { type: 'moveUnit', playerId: 'p1', unitId: 'n1', dir: 'E' });
  assert.ok(res.ok, `nuke ok: ${res.reason}`);
  assert.strictEqual(res.state.units.n1, undefined, 'the missile was consumed by its strike');
  assert.ok(res.events.some(e => e.type === 'combatResolved'), 'combat happened');
  assert.ok(res.events.some(e => e.type === 'unitConsumed' && e.unitId === 'n1' && e.owner === 'p1'), 'unitConsumed event');
});

test('A72 revert-proof: a normal attacker survives its winning strike', async () => {
  const engine = await load();
  // a legion (attack 4) vs a militia — with rngState 1 the attacker wins and,
  // being non-oneShot, remains on its own tile.
  const res = engine.applyCommand(craft('legion'), { type: 'moveUnit', playerId: 'p1', unitId: 'n1', dir: 'E' });
  assert.ok(res.ok);
  const won = res.events.find(e => e.type === 'combatResolved' && e.winner === 'attacker');
  if (won) {
    assert.ok(res.state.units.n1, 'a normal attacker is NOT consumed on a win');
    assert.ok(!res.events.some(e => e.type === 'unitConsumed'), 'no unitConsumed for a normal unit');
  }
});
