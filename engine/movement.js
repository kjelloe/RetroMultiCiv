// Unit movement: 8-directional, terrain move costs (road-to-road costs 1),
// Civ 1 partial-move rule (a unit may enter any passable tile as long as it
// has ANY movement left), zone of control, and attack-by-moving (delegated
// to combat.js). Railroads arrive in a later slice.
import { reveal } from './visibility.js';
import { resolveAttack, captureCity, unitsAt, cityAt } from './combat.js';

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

// Is any enemy unit adjacent to (x, y)?  Used for the Civ 1 zone of control:
// moving directly between two enemy-controlled tiles is forbidden unless the
// destination holds your own unit or city (attacks never reach this check).
function inEnemyZoc(state, x, y, owner) {
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (u.owner === owner) continue;
    let dx = Math.abs(u.x - x);
    if (state.map.wrapX && state.map.width - dx < dx) dx = state.map.width - dx;
    const dy = Math.abs(u.y - y);
    if (dx <= 1 && dy <= 1 && (dx + dy) > 0) return true;
  }
  return false;
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
  // NOTE: the moves check happens after the cost is known — free road/rail
  // steps are legal at 0 moves; attacks and paid steps are not

  const map = state.map;
  const nx = wrapX(map, unit.x + dir.dx);
  const ny = unit.y + dir.dy;
  if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) {
    return { ok: false, reason: 'outOfBounds' };
  }

  // enemy units on the target tile: this move is an attack, not a move
  const hostiles = unitsAt(state, nx, ny).filter(u => u.owner !== unit.owner);
  if (hostiles.length > 0) {
    return resolveAttack(state, unit, nx, ny, ruleset); // rejects at 0 moves
  }

  const terrain = ruleset.terrain.terrains[tileAt(map, nx, ny).t];
  const unitType = ruleset.units[unit.type];
  if (!terrain || !unitType) return { ok: false, reason: 'badRuleset' };
  if (terrain.domain !== unitType.domain) return { ok: false, reason: 'impassable' };

  const targetCity = cityAt(state, nx, ny);
  const ownAtTarget = unitsAt(state, nx, ny).length > 0
    || (targetCity !== null && targetCity.owner === unit.owner);
  if (!ownAtTarget
      && inEnemyZoc(state, unit.x, unit.y, unit.owner)
      && inEnemyZoc(state, nx, ny, unit.owner)) {
    return { ok: false, reason: 'zoc' };
  }

  const fromX = unit.x, fromY = unit.y;
  // rail-to-rail is free (Civ 1); road-to-road grants 2 FREE steps per base
  // move point — 3x road range — tracked in the transient integer counter
  // unit.roadSteps (no thirds: Luau-portable, cleared at every turn wrap;
  // only present mid-turn, so crafted-state hashes stay stable). Past the
  // free allowance a road step costs 1 like before.
  let cost = terrain.move;
  const from = tileAt(map, fromX, fromY);
  const to = tileAt(map, nx, ny);
  if (from.railroad === true && to.railroad === true) {
    cost = 0;
  } else if (from.road === true && to.road === true) {
    const used = unit.roadSteps === undefined ? 0 : unit.roadSteps;
    if (used < ruleset.units[unit.type].moves * 2) {
      cost = 0;
      unit.roadSteps = used + 1;
    } else {
      cost = 1;
    }
  }
  if (cost > 0 && unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  unit.x = nx;
  unit.y = ny;
  unit.fortified = false;
  delete unit.working; // moving abandons any improvement in progress
  delete unit.workLeft;
  unit.moves = unit.moves - cost;
  if (unit.moves < 0) unit.moves = 0;
  reveal(state, unit.owner, nx, ny, 1);

  const events = [{ type: 'unitMoved', unitId: unit.id, fromX, fromY, toX: nx, toY: ny }];
  if (targetCity && targetCity.owner !== unit.owner) {
    captureCity(state, unit, targetCity, events);
  }
  return { ok: true, events };
}

// Disband: the unit is removed for nothing in return (Civ 1: shed upkeep,
// clear a tile, or retire obsolete units).
function disband(state, cmd, _ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  delete state.units[cmd.unitId];
  return { ok: true, events: [{ type: 'unitDisbanded', unitId: cmd.unitId, x: unit.x, y: unit.y }] };
}

// Wait/skip: the unit stays put and is done for this turn (Civ 1 space bar).
function wait(state, cmd, _ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  unit.moves = 0;
  return { ok: true, events: [{ type: 'unitWaited', unitId: unit.id }] };
}

// Fortify: dig in for the ×1.5 defense bonus; ends the unit's turn (Civ 1).
function fortify(state, cmd, _ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.fortified) return { ok: false, reason: 'alreadyFortified' };
  unit.fortified = true;
  delete unit.working; // fortifying abandons any improvement in progress
  delete unit.workLeft;
  unit.moves = 0;
  return { ok: true, events: [{ type: 'unitFortified', unitId: unit.id }] };
}

export { moveUnit, fortify, wait, disband, tileAt, wrapX, DIRS };
