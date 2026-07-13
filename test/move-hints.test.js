// A19: the pure movement-affordance predicate (client/ui/move-hints.js).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');
const mod = import('../client/ui/move-hints.js');
let canStepTo, stepDir;
test.before(async () => { ({ canStepTo, stepDir } = await mod); });

function world() {
  // 4x3: land everywhere except an ocean tile at (2,1)
  const tiles = [];
  for (let i = 0; i < 12; i++) tiles.push({ t: 'grassland', visible: true });
  tiles[1 * 4 + 2] = { t: 'ocean', visible: true };
  return {
    map: { width: 4, height: 3, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 1, y: 1, moves: 1 },
      e1: { id: 'e1', type: 'militia', owner: 'p2', x: 1, y: 0, moves: 1 },
      s1: { id: 's1', type: 'trireme', owner: 'p1', x: 2, y: 1, moves: 3 }
    },
    players: { p1: { id: 'p1' }, p2: { id: 'p2' } }
  };
}

test('arrow shows for a legal adjacent land step', () => {
  const s = world();
  assert.strictEqual(canStepTo(s, s.units.u1, 0, 1, RULESET), true);
  assert.strictEqual(stepDir(s.map, s.units.u1, 0, 1), 'W');
});

test('no arrow: land unit onto ocean, ship onto land', () => {
  const s = world();
  assert.strictEqual(canStepTo(s, s.units.u1, 2, 1, RULESET), false, 'militia cannot enter ocean');
  assert.strictEqual(canStepTo(s, s.units.s1, 1, 1, RULESET), false, 'trireme cannot enter land');
});

test('no arrow: zero moves, non-adjacent, enemy tile, off-map', () => {
  const s = world();
  s.units.u1.moves = 0;
  assert.strictEqual(canStepTo(s, s.units.u1, 0, 1, RULESET), false, 'spent unit');
  s.units.u1.moves = 1;
  assert.strictEqual(canStepTo(s, s.units.u1, 3, 1, RULESET), false, 'two tiles away');
  assert.strictEqual(canStepTo(s, s.units.u1, 1, 0, RULESET), false, 'enemy tile is the attack ring');
  assert.strictEqual(canStepTo(s, s.units.u1, 1, -1, RULESET), false, 'off the map');
});

test('x-wrap adjacency counts', () => {
  const s = world();
  s.map.wrapX = true;
  s.units.u1.x = 0;
  assert.strictEqual(stepDir(s.map, s.units.u1, 3, 1), 'W', 'wrapped neighbor');
  assert.strictEqual(canStepTo(s, s.units.u1, 3, 1, RULESET), true);
});
