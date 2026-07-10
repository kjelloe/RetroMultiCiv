// Unit movement: 8-directional, terrain move costs, Civ 1 partial-move rule
// (a unit may enter any passable tile as long as it has ANY movement left).
// Roads, railroads, ZOC and combat arrive in later slices.

const DIRS = {
  N: { dx: 0, dy: -1 }, NE: { dx: 1, dy: -1 }, E: { dx: 1, dy: 0 },
  SE: { dx: 1, dy: 1 }, S: { dx: 0, dy: 1 }, SW: { dx: -1, dy: 1 },
  W: { dx: -1, dy: 0 }, NW: { dx: -1, dy: -1 }
};

function tileAt(map, x, y) {
  return map.tiles[y * map.width + x];
}

function wrapX(map, x) {
  if (!map.wrapX) return x;
  return ((x % map.width) + map.width) % map.width;
}

// Mutates `state` (the dispatcher hands us a fresh clone). Returns
// { ok, reason?, events }.
function moveUnit(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const dir = DIRS[cmd.dir];
  if (!dir) return { ok: false, reason: 'badDirection' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };

  const map = state.map;
  const nx = wrapX(map, unit.x + dir.dx);
  const ny = unit.y + dir.dy;
  if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) {
    return { ok: false, reason: 'outOfBounds' };
  }

  const terrain = ruleset.terrain.terrains[tileAt(map, nx, ny).t];
  const unitType = ruleset.units[unit.type];
  if (!terrain || !unitType) return { ok: false, reason: 'badRuleset' };
  if (terrain.domain !== unitType.domain) return { ok: false, reason: 'impassable' };

  const fromX = unit.x, fromY = unit.y;
  unit.x = nx;
  unit.y = ny;
  unit.fortified = false;
  const cost = terrain.move;
  unit.moves = unit.moves - cost;
  if (unit.moves < 0) unit.moves = 0;

  return {
    ok: true,
    events: [{ type: 'unitMoved', unitId: unit.id, fromX, fromY, toX: nx, toY: ny }]
  };
}

export { moveUnit, tileAt, wrapX, DIRS };
