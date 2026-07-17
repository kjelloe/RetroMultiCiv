// A19 movement affordance: is hovering tile (x,y) a "click will move here"
// step for the selected unit? PURE — state + ruleset in, boolean out — so
// Node unit-tests it directly. Mirrors engine/movement.js legality (domain
// match), never invents cost math: cost/ZOC subtleties stay the engine's
// verdict at click time; this is only the affordance.
import { unitsAt } from '../../engine/combat.js';

// eight neighbors with x-wrap; returns the direction key or null
export function stepDir(map, unit, x, y) {
  let dx = x - unit.x;
  if (map.wrapX) {
    if (dx > 1) dx -= map.width;
    if (dx < -1) dx += map.width;
  }
  const dy = y - unit.y;
  const key = {
    '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE',
    '0,1': 'S', '-1,1': 'SW', '-1,0': 'W', '-1,-1': 'NW'
  }[dx + ',' + dy];
  return key === undefined ? null : key;
}

// A65: can a unit of this type ENTER tile (x,y) at all? — the tile-entry
// legality shared by the affordance and the GoTo pathfinder (shared/
// pathfind.js): known (not fog), domain match, no enemy. Position- and
// moves-INDEPENDENT (a path plans through tiles the unit isn't adjacent to,
// and across turns when moves are spent), so canStepTo layers those on top.
export function tileEnterable(state, unit, x, y, ruleset) {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return false;
  const tile = state.map.tiles[y * state.map.width + x];
  if (tile === undefined || tile.t === 'unknown') return false; // fog is the law
  const terrain = ruleset.terrain.terrains[tile.t];
  if (terrain === undefined || terrain.domain !== ruleset.units[unit.type].domain) return false;
  for (const u of unitsAt(state, x, y)) {
    if (u.owner !== unit.owner) return false; // enemy tile = the red attack ring
  }
  return true;
}

// true iff the hover should show the move arrow: adjacent, moves left, and
// the tile is enterable (domain / fog / enemy — via tileEnterable above)
export function canStepTo(state, unit, x, y, ruleset) {
  if (!unit || unit.moves <= 0) return false;
  if (stepDir(state.map, unit, x, y) === null) return false;
  return tileEnterable(state, unit, x, y, ruleset);
}

// wrap-aware Chebyshev distance (the GoTo distance rule)
function wrapDist(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

const STEP_VECS = {
  N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
  S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1]
};

// A68 (VIII.17): the GoTo greedy fallback's candidate steps — distance-
// decreasing, in-bounds, sorted nearest-first, and DOMAIN-checked: a ship's
// fallback must never even attempt a land step (the old filter let the
// engine bounce them one by one). UNKNOWN tiles stay candidates — the
// fallback exists precisely for fogged targets ("GoTo into the dark", server
// games), and there the engine is the judge. PURE: input.js applies the
// steps in order until one is accepted; the route preview draws the same walk.
export function greedySteps(state, unit, target, ruleset) {
  const here = wrapDist(state.map, unit.x, unit.y, target.x, target.y);
  const options = [];
  for (const dir of Object.keys(STEP_VECS)) {
    const v = STEP_VECS[dir];
    let nx = unit.x + v[0];
    if (state.map.wrapX) nx = ((nx % state.map.width) + state.map.width) % state.map.width;
    const ny = unit.y + v[1];
    if (ny < 0 || ny >= state.map.height) continue;
    const d = wrapDist(state.map, nx, ny, target.x, target.y);
    if (d >= here) continue;
    const tile = state.map.tiles[ny * state.map.width + nx];
    const enterable = tile !== undefined && tile.t === 'unknown'
      ? true // fog: venture toward the target, the engine validates each step
      : tileEnterable(state, unit, nx, ny, ruleset);
    if (!enterable) continue;
    options.push({ dir, nx, ny, d });
  }
  return options.sort((a, b) => a.d - b.d);
}
