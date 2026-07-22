// A65: cost-aware GoTo pathfinding (shared/pathfind.js) — least-cost routing
// over terrain / road / rail, fog-honest, wrap-aware. Pure, headless.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../shared/pathfind.js'); }

// a compact ruleset: grassland cheap (move 1), hills rough (move 3), ocean
// impassable to land units. Only what stepCost + domain need.
const RULESET = {
  terrain: { terrains: {
    grassland: { move: 1, domain: 'land' },
    hills: { move: 3, domain: 'land' },
    ocean: { move: 1, domain: 'sea' },
    unknown: { move: 1, domain: 'land' }
  } },
  units: { settlers: { domain: 'land' } }
};

// build a WxH grid; `paint(x,y)` returns a tile override (t/road/railroad)
function grid(W, H, paint) {
  const tiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      tiles.push(Object.assign({ t: 'grassland' }, paint ? paint(x, y) : {}));
    }
  }
  return { width: W, height: H, wrapX: false, tiles };
}
const unit = (x, y) => ({ id: 'u1', type: 'settlers', owner: 'p1', x, y, moves: 1 });
const allExplored = () => true;
// a land-domain canEnter (mirrors the client's tileEnterable — the injected
// legality) for tests that need ocean/fog to actually block
function landCanEnter(map) {
  return (x, y) => {
    const t = map.tiles[y * map.width + x];
    return t !== undefined && t.t !== 'unknown' && RULESET.terrain.terrains[t.t].domain === 'land';
  };
}

test('road detour beats the short rough path', async () => {
  const { findPath } = await load();
  // a HILLS wall (move 3) fills the direct row between start and goal; a road
  // detour along the row below is longer in tiles but cheaper in cost.
  const W = 6, H = 3;
  const road = new Set(['0,1', '1,1', '2,1', '3,1', '4,1', '5,1']);
  const map = grid(W, H, (x, y) => {
    if (y === 0 && x >= 1 && x <= 4) return { t: 'hills' };           // the wall on the direct row
    if (road.has(`${x},${y}`)) return { t: 'grassland', road: true }; // the detour road
    return { t: 'grassland' };
  });
  const state = { map, units: {} };
  const p = findPath(state, RULESET, unit(0, 0), { x: 5, y: 0 }, allExplored);
  assert.ok(p, 'a path exists');
  // straight across the hills: (0,0)→4×hills→(5,0) = 3*3*4 + 3 = 39;
  // the road detour is much cheaper — the route must dip onto the road row
  assert.ok(p.points.some(pt => pt.y === 1), `the route dips onto the road row (points: ${JSON.stringify(p.points)})`);
  assert.ok(p.cost < 39, `the cost-aware route (${p.cost}) beats punching through the hills (39)`);
});

// XIV §37: road-aware goto. The A65 costing (road-to-road = 1 = 1/3 of a plain
// step) already gives roads ~3x range over NORMAL terrain; the detour test above
// uses rough HILLS, so this pins the plains case the spec's "3x range" names.
test('road detour beats a shorter roadless PLAINS path (3x range over normal terrain)', async () => {
  const { findPath } = await load();
  // the direct lane (row 0) is plain grassland, roadless; a road spans row 1.
  // Reaching the road and returning to the goal is off the straight line, yet
  // the road-to-road steps (cost 1) make it cheaper than the plain lane.
  const W = 8, H = 3;
  const map = grid(W, H, (x, y) => y === 1 ? { t: 'grassland', road: true } : { t: 'grassland' });
  const state = { map, units: {} };
  const p = findPath(state, RULESET, unit(0, 0), { x: 7, y: 0 }, allExplored);
  assert.ok(p, 'a path exists');
  // the straight roadless lane across row 0 is 7 grassland steps × 3 = cost 21
  assert.ok(p.points.some(pt => pt.y === 1), `the route drops to the road row (points: ${JSON.stringify(p.points)})`);
  assert.ok(p.cost < 21, `the road route (${p.cost}) beats the straight roadless plains lane (21)`);
});

test('a rail corridor is chosen (free movement between railed tiles)', async () => {
  const { findPath } = await load();
  // a straight rail line row 0; everything else grassland. The rail path is
  // free (cost 0 between railed tiles) so it wins outright.
  const W = 8, H = 3;
  const map = grid(W, H, (x, y) => y === 0 ? { t: 'grassland', railroad: true } : { t: 'grassland' });
  const state = { map, units: {} };
  const p = findPath(state, RULESET, unit(0, 0), { x: 7, y: 0 }, allExplored);
  assert.ok(p, 'a path exists');
  assert.strictEqual(p.cost, 0, 'rail-to-rail steps are free');
  assert.ok(p.points.every(pt => pt.y === 0), 'the route stays on the rail line');
});

test('fog blocks planning: an unexplored target or wall of fog is unreachable', async () => {
  const { findPath } = await load();
  const W = 5, H = 3;
  const map = grid(W, H, (x) => x === 2 ? { t: 'unknown' } : {}); // a fog column splits the map
  const state = { map, units: {} };
  const canEnter = (x, y) => map.tiles[y * W + x].t !== 'unknown';
  // target beyond the fog wall is unreachable through explored tiles
  const p = findPath(state, RULESET, unit(0, 1), { x: 4, y: 1 }, canEnter);
  assert.strictEqual(p, null, 'no route through the fog');
  // an unexplored TARGET itself is refused
  const q = findPath(state, RULESET, unit(0, 1), { x: 2, y: 1 }, canEnter);
  assert.strictEqual(q, null, 'an unexplored target cannot be planned to');
});

test('wrap seam: the east-west route crosses the x-wrap (ties into B12)', async () => {
  const { findPath } = await load();
  const W = 10, H = 1;
  const map = grid(W, H); map.wrapX = true;
  const state = { map, units: {} };
  // from x=1 to x=9: the short way is WEST across the seam (1→0→9, 2 steps),
  // not east (1→…→9, 8 steps)
  const p = findPath(state, RULESET, unit(1, 0), { x: 9, y: 0 }, allExplored);
  assert.ok(p, 'a path exists');
  assert.strictEqual(p.points.length, 3, 'three points: x=1, x=0, x=9 (2 steps across the seam)');
  assert.deepStrictEqual(p.points.map(pt => pt.x), [1, 0, 9], 'routes west over the wrap');
});

test('domain is respected: a land unit routes around ocean', async () => {
  const { findPath } = await load();
  const W = 5, H = 3;
  const map = grid(W, H, (x, y) => x === 2 && y !== 2 ? { t: 'ocean' } : {}); // ocean wall with a southern gap
  const state = { map, units: {} };
  const p = findPath(state, RULESET, unit(0, 0), { x: 4, y: 0 }, landCanEnter(map));
  assert.ok(p, 'a path exists around the ocean');
  assert.ok(p.points.some(pt => pt.y === 2), 'the route dips to the land gap at y=2');
  assert.ok(!p.points.some(pt => map.tiles[pt.y * W + pt.x].t === 'ocean'), 'never steps on ocean');
});

// A68 (VIII.17-verify): SHIP GoTo through the real injected legality
// (client tileEnterable). The peninsula case proves domain-aware routing;
// the city case PINS today's engine truth — sea units cannot enter ANY land
// tile, own coastal cities included (no docking mechanic exists yet; see the
// A68 slice-d report). If docking ever lands, that pin flips deliberately.
const SEA_RULESET = {
  terrain: { terrains: {
    grassland: { move: 1, domain: 'land' },
    ocean: { move: 1, domain: 'sea' }
  } },
  units: { frigate: { domain: 'sea' }, settlers: { domain: 'land' } }
};

test('A68: ship GoTo routes around a peninsula through water only', async () => {
  const { findPath } = await load();
  const { tileEnterable } = await import('../client/ui/move-hints.js');
  // a 7x5 sea with a land finger across the middle row (x 1..5): the direct
  // lane is blocked, the route must arc over or under the peninsula
  const W = 7, H = 5;
  const map = grid(W, H, (x, y) =>
    (y === 2 && x >= 1 && x <= 5) ? { t: 'grassland' } : { t: 'ocean' });
  const state = { map, units: {} };
  const ship = { id: 's1', type: 'frigate', owner: 'p1', x: 0, y: 2, moves: 1 };
  const canEnter = (x, y) => tileEnterable(state, ship, x, y, SEA_RULESET);
  const p = findPath(state, SEA_RULESET, ship, { x: 6, y: 2 }, canEnter);
  assert.ok(p, 'a water route exists around the peninsula');
  for (const pt of p.points) {
    assert.strictEqual(map.tiles[pt.y * W + pt.x].t, 'ocean',
      `the route must stay on water (touched ${pt.x},${pt.y})`);
  }
  // 8-directional moves make the arc the same STEP count as the straight
  // lane — the proof is the detour itself: the route leaves row 2 while
  // crossing the peninsula's span
  assert.ok(p.points.some(pt => pt.y !== 2 && pt.x >= 1 && pt.x <= 5),
    `the route arcs off the blocked lane (points: ${JSON.stringify(p.points)})`);
});

test('A68 pin: a ship cannot path INTO an own coastal city tile (no docking mechanic)', async () => {
  const { findPath } = await load();
  const { tileEnterable } = await import('../client/ui/move-hints.js');
  const W = 7, H = 5;
  const map = grid(W, H, (x, y) =>
    (y === 2 && x >= 1 && x <= 5) ? { t: 'grassland' } : { t: 'ocean' });
  const state = {
    map, units: {},
    cities: { c1: { id: 'c1', name: 'Port', owner: 'p1', x: 5, y: 2, pop: 3 } }
  };
  const ship = { id: 's1', type: 'frigate', owner: 'p1', x: 0, y: 2, moves: 1 };
  const canEnter = (x, y) => tileEnterable(state, ship, x, y, SEA_RULESET);
  // engine/movement.js line ~103 rejects sea units on ANY land tile — own
  // city or not — so the planner must refuse the target outright
  assert.strictEqual(findPath(state, SEA_RULESET, ship, { x: 5, y: 2 }, canEnter), null);
});
