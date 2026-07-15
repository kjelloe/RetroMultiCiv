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
