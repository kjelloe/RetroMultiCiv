// A65 cost-aware GoTo: a real least-cost path over movement costs so roads
// and rails are preferred exactly as much as they are cheaper (Civ 1: rail
// between railed tiles is free, road between roaded tiles is 1/3, else the
// terrain's move cost). PURE — (state, ruleset, unit, target, canEnter) in,
// a point list out — and written in the LUA-PORTABLE subset (no class/this,
// no Map/Set, integer math): the Roblox client wants this next (docs/13
// Tier 1), and it only chooses which ordinary move commands the CLIENT
// issues (the engine still validates each; replays record the moves), so it
// is golden-safe by construction until the AI adopts it.
//
// LEGALITY is INJECTED, never re-implemented here: `canEnter(x, y)` is the
// same tile-entry verdict the client's move affordance uses (domain, fog —
// unexplored is untraversable, enemy occupancy). Fog honesty falls out of
// canEnter; GoTo already replans each turn as fog lifts.
//
// COSTS are scaled by 3 so thirds stay integers: rail-to-rail 0, road-to-road
// 1 (=1/3), else terrain.move * 3.

const DIR_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIR_VECS = {
  N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
  S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1]
};

function stepCost(fromTile, toTile, ruleset) {
  if (fromTile.railroad === true && toTile.railroad === true) return 0;
  if (fromTile.road === true && toTile.road === true) return 1; // 1/3 * 3
  const terr = ruleset.terrain.terrains[toTile.t];
  return (terr !== undefined && terr.move !== undefined ? terr.move : 1) * 3;
}

// Returns { points: [{x,y}, ...] from the unit through the target, cost } or
// null when the target is unreachable through explored, legal tiles.
export function findPath(state, ruleset, unit, target, canEnter) {
  const map = state.map;
  const W = map.width, H = map.height;
  if (target.x < 0 || target.x >= W || target.y < 0 || target.y >= H) return null;
  if (!canEnter(target.x, target.y)) return null; // fog / enemy / bad domain
  const startIdx = unit.y * W + unit.x;
  const goalIdx = target.y * W + target.x;
  if (startIdx === goalIdx) return { points: [{ x: unit.x, y: unit.y }], cost: 0 };

  const dist = {}; dist[startIdx] = 0;
  const prev = {};
  const visited = {};
  const open = [{ idx: startIdx, x: unit.x, y: unit.y, cost: 0 }];
  let expansions = 0;
  const CAP = 8000; // bound the worst case; GoTo distances are modest

  while (open.length > 0 && expansions < CAP) {
    // extract-min by linear scan; deterministic tie-break on tile index so
    // equal-cost routes are stable (visual, not hashed — but stable is nice)
    let mi = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].cost < open[mi].cost
          || (open[i].cost === open[mi].cost && open[i].idx < open[mi].idx)) mi = i;
    }
    const cur = open.splice(mi, 1)[0];
    if (visited[cur.idx] === true) continue;
    visited[cur.idx] = true;
    expansions = expansions + 1;
    if (cur.idx === goalIdx) break;
    const fromTile = map.tiles[cur.idx];
    for (const key of DIR_KEYS) {
      const v = DIR_VECS[key];
      let nx = cur.x + v[0];
      if (map.wrapX === true) nx = ((nx % W) + W) % W;
      const ny = cur.y + v[1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (visited[nIdx] === true) continue;
      if (!canEnter(nx, ny)) continue; // the injected legality verdict
      const nd = cur.cost + stepCost(fromTile, map.tiles[nIdx], ruleset);
      if (dist[nIdx] === undefined || nd < dist[nIdx]) {
        dist[nIdx] = nd;
        prev[nIdx] = { x: cur.x, y: cur.y };
        open.push({ idx: nIdx, x: nx, y: ny, cost: nd });
      }
    }
  }

  if (dist[goalIdx] === undefined) return null; // boxed in / out of budget
  const points = [];
  let cx = target.x, cy = target.y, guard = W * H;
  while (guard > 0) {
    guard = guard - 1;
    points.unshift({ x: cx, y: cy });
    if (cx === unit.x && cy === unit.y) break;
    const p = prev[cy * W + cx];
    if (p === undefined) return null;
    cx = p.x; cy = p.y;
  }
  return { points, cost: dist[goalIdx] };
}
