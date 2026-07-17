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

// B12: the seam-crossing verdict — the AFFORDANCE MATH is seam-correct in
// BOTH directions (including diagonals), so "no arrow at the seam" can never
// be this layer's fault. The user-visible gap is upstream: the renderer draws
// no geometry beyond x = width-1, so the wrapped column cannot be hovered at
// all (the raycast misses — the "black tile"). Pinned here so any future
// seam-rendering work (ghost columns etc.) inherits a proven predicate.
test('B12: seam steps show the arrow both directions on a wrapping map', () => {
  const tiles = [];
  for (let i = 0; i < 10 * 5; i++) tiles.push({ t: 'grassland', visible: true });
  const s = {
    map: { width: 10, height: 5, wrapX: true, tiles },
    units: { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 2, moves: 1 } },
    players: { p1: { id: 'p1' } }
  };
  // west across the seam: unit at x=0, hover x=width-1
  assert.strictEqual(stepDir(s.map, s.units.u1, 9, 2), 'W');
  assert.strictEqual(canStepTo(s, s.units.u1, 9, 2, RULESET), true, 'W across the seam');
  assert.strictEqual(canStepTo(s, s.units.u1, 9, 1, RULESET), true, 'NW across the seam');
  assert.strictEqual(canStepTo(s, s.units.u1, 9, 3, RULESET), true, 'SW across the seam');
  // east across the seam: unit at x=width-1, hover x=0
  s.units.u1.x = 9;
  assert.strictEqual(stepDir(s.map, s.units.u1, 0, 2), 'E');
  assert.strictEqual(canStepTo(s, s.units.u1, 0, 2, RULESET), true, 'E across the seam');
  // and NOT on a flat map: the same hover is a full map away
  s.map.wrapX = false;
  assert.strictEqual(stepDir(s.map, s.units.u1, 0, 2), null, 'no wrap on a flat map');
  assert.strictEqual(canStepTo(s, s.units.u1, 0, 2, RULESET), false);
});

// A68 (VIII.17): greedySteps — the GoTo fallback's candidate rule. Ships must
// never receive land candidates; fog stays ventureable; enemies stay excluded.
test('A68 greedySteps: a ship gets water-only candidates, stops when only land decreases distance', async () => {
  const { greedySteps } = await import('../client/ui/move-hints.js');
  const RS = {
    terrain: { terrains: {
      grassland: { move: 1, domain: 'land' }, ocean: { move: 1, domain: 'sea' }
    } },
    units: { frigate: { domain: 'sea' } }
  };
  // 3x3: top row land, rest ocean; the frigate sits center
  const tiles = [
    { t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' },
    { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' },
    { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' }
  ];
  const state = { map: { width: 3, height: 3, wrapX: false, tiles }, units: {} };
  const ship = { id: 's1', type: 'frigate', owner: 'p1', x: 1, y: 1, moves: 1 };
  // toward a WATER tile east: exactly the east options, all ocean
  const east = greedySteps(state, ship, { x: 2, y: 1 }, RS);
  assert.ok(east.length > 0 && east.every(o => tiles[o.ny * 3 + o.nx].t === 'ocean'));
  assert.strictEqual(east[0].nx + ',' + east[0].ny, '2,1', 'nearest water step first');
  // toward a LAND tile north: every distance-decreasing step is land — the
  // old filter would offer them for the engine to bounce; now: none at all
  assert.deepStrictEqual(greedySteps(state, ship, { x: 1, y: 0 }, RS), []);
});

test('A68 greedySteps: fog tiles stay candidates, enemy tiles never do', async () => {
  const { greedySteps } = await import('../client/ui/move-hints.js');
  const RS = {
    terrain: { terrains: {
      grassland: { move: 1, domain: 'land' }, ocean: { move: 1, domain: 'sea' },
      unknown: { move: 1, domain: 'land' }
    } },
    units: { frigate: { domain: 'sea' } }
  };
  const tiles = [
    { t: 'ocean' }, { t: 'unknown' }, { t: 'ocean' },
    { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' },
    { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' }
  ];
  const state = {
    map: { width: 3, height: 3, wrapX: false, tiles },
    units: { e1: { id: 'e1', type: 'frigate', owner: 'p2', x: 2, y: 1 } }
  };
  const ship = { id: 's1', type: 'frigate', owner: 'p1', x: 1, y: 1, moves: 1 };
  // toward the fogged tile north: the unknown tile IS offered (the engine
  // will judge it — "GoTo into the dark" must keep working on server views)
  const fog = greedySteps(state, ship, { x: 1, y: 0 }, RS);
  assert.ok(fog.some(o => o.nx === 1 && o.ny === 0), 'fog stays ventureable');
  // toward the enemy-held water tile east: the occupied tile itself is
  // excluded (never auto-attack)
  const foe = greedySteps(state, ship, { x: 2, y: 1 }, RS);
  assert.ok(!foe.some(o => o.nx === 2 && o.ny === 1), 'enemy tile excluded');
});
