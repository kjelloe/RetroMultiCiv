// Unit movement: 8-directional, terrain move costs (road-to-road costs 1),
// Civ 1 partial-move rule (a unit may enter any passable tile as long as it
// has ANY movement left), zone of control, and attack-by-moving (delegated
// to combat.js). Railroads arrive in a later slice.
import { reveal } from './visibility.js';
import { resolveAttack, captureCity, unitsAt, cityAt, sortIds } from './combat.js';
import { rollHut } from './huts.js';

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

// Is any enemy unit OR CITY adjacent to (x, y)? Used for the Civ 1 zone of
// control: moving directly between two enemy-controlled tiles is forbidden
// unless the destination holds your own unit or city (attacks never reach
// this check). B18: enemy CITIES exert ZOC too (wiki: "adjacent to an enemy
// unit OR CITY") — an undefended city still projects it.
function inEnemyZoc(state, x, y, owner) {
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (u.owner === owner) continue;
    if (u.aboard !== undefined) continue; // A69: cargo exerts no ZOC
    let dx = Math.abs(u.x - x);
    if (state.map.wrapX && state.map.width - dx < dx) dx = state.map.width - dx;
    const dy = Math.abs(u.y - y);
    if (dx <= 1 && dy <= 1 && (dx + dy) > 0) return true;
  }
  for (const cid of Object.keys(state.cities)) {
    const c = state.cities[cid];
    if (!c || c.owner === owner) continue;
    let dx = Math.abs(c.x - x);
    if (state.map.wrapX && state.map.width - dx < dx) dx = state.map.width - dx;
    const dy = Math.abs(c.y - y);
    if (dx <= 1 && dy <= 1 && (dx + dy) > 0) return true;
  }
  return false;
}

// A69: the friendly transport at (x, y) with a free cargo slot — deterministic
// (first by sorted id). Returns the ship, 'full' if transports exist but all
// are laden, or null if no transport is here at all.
function pickTransport(state, x, y, owner, ruleset) {
  let anyTransport = false;
  for (const id of sortIds(Object.keys(state.units))) {
    const s = state.units[id];
    if (s.owner !== owner || s.x !== x || s.y !== y || s.aboard !== undefined) continue;
    const cap = ruleset.units[s.type].transport;
    if (cap === undefined || cap <= 0) continue;
    anyTransport = true;
    let load = 0;
    for (const cid of Object.keys(state.units)) {
      if (state.units[cid].aboard === s.id) load = load + 1;
    }
    if (load < cap) return s;
  }
  return anyTransport ? 'full' : null;
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
    // A69: Civ 1 has no Marines — a unit cannot attack straight off a ship
    // (wiki silent on the explicit rule; no amphibious unit exists). Unload to
    // open land first, then attack next turn.
    if (unit.aboard !== undefined) return { ok: false, reason: 'noAmphibiousAssault' };
    return resolveAttack(state, unit, nx, ny, ruleset); // rejects at 0 moves
  }

  const terrain = ruleset.terrain.terrains[tileAt(map, nx, ny).t];
  const unitType = ruleset.units[unit.type];
  if (!terrain || !unitType) return { ok: false, reason: 'badRuleset' };
  // A72: air units (domain 'air') fly over ANY tile — no terrain is domain
  // 'air', so without this they are grounded. Non-air units keep the domain rule.
  if (terrain.domain !== unitType.domain && unitType.domain !== 'air') {
    // A69: a land unit stepping onto a sea tile LOADS onto a friendly transport
    // there (with a free slot); otherwise the sea stays impassable to it.
    if (unitType.domain === 'land' && terrain.domain === 'sea') {
      const ship = pickTransport(state, nx, ny, unit.owner, ruleset);
      if (ship === 'full') return { ok: false, reason: 'transportFull' };
      if (ship !== null) {
        if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
        unit.aboard = ship.id;
        unit.x = nx;
        unit.y = ny;
        unit.fortified = false;
        delete unit.working;
        delete unit.workLeft;
        unit.moves = unit.moves - 1;
        if (unit.moves < 0) unit.moves = 0;
        reveal(state, unit.owner, nx, ny, 1);
        return { ok: true, events: [{ type: 'unitLoaded', unitId: unit.id, owner: unit.owner, shipId: ship.id, x: nx, y: ny }] };
      }
    }
    return { ok: false, reason: 'impassable' };
  }

  const targetCity = cityAt(state, nx, ny);
  const ownAtTarget = unitsAt(state, nx, ny).length > 0
    || (targetCity !== null && targetCity.owner === unit.owner);
  // B18: Diplomats, Caravans, and nuclear weapons ignore ZOC (units.json
  // ignoresZoc) — they walk between enemy-controlled tiles freely.
  // B27: entering ANY city square is ZOC-exempt (targetCity !== null) — an own
  // city is already covered by ownAtTarget; an UNDEFENDED enemy city reaches
  // here (defended cities resolve as an attack above, pre-ZOC) and must be
  // capturable-by-moving even when both squares sit in an enemy ZOC. Civ2-shape
  // exemption ("into or out of a city, including capturing an enemy city"; Civ 1
  // wiki silent, C-evo declines) — user ruling 2026-07-17.
  if (!ownAtTarget && targetCity === null && unitType.ignoresZoc !== true
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
  if (unitType.domain === 'air') {
    cost = 1; // A72: air units spend 1 movement per tile, terrain-blind
  } else {
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
  }
  if (cost > 0 && unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  unit.x = nx;
  unit.y = ny;
  unit.fortified = false;
  delete unit.working; // moving abandons any improvement in progress
  delete unit.workLeft;
  unit.moves = unit.moves - cost;
  if (unit.moves < 0) unit.moves = 0;
  // B23: the mover may record a heading (omit-safe unit.scoutDir) — a GENERIC
  // reducer field the caller gives meaning to (the wallfollow scout persists its
  // hand-rule facing here; a plain move without a heading clears it).
  if (cmd.heading !== undefined) unit.scoutDir = cmd.heading;
  else if (unit.scoutDir !== undefined) delete unit.scoutDir;
  reveal(state, unit.owner, nx, ny, 1);

  const events = [{ type: 'unitMoved', unitId: unit.id, fromX, fromY, toX: nx, toY: ny }];
  // A69: a unit that was aboard and has stepped onto land has disembarked
  if (unit.aboard !== undefined) {
    delete unit.aboard;
    events.push({ type: 'unitUnloaded', unitId: unit.id, owner: unit.owner, x: nx, y: ny });
  }
  // A69: a ship that moved drags its cargo along (x/y tracks the ship)
  for (const vid of Object.keys(state.units)) {
    const v = state.units[vid];
    if (v.aboard === unit.id) { v.x = nx; v.y = ny; }
  }
  if (targetCity && targetCity.owner !== unit.owner) {
    captureCity(state, unit, targetCity, events, ruleset);
  }
  // N13: a village (goody hut) on the destination tile. A GROUND non-barbarian
  // unit rolls the outcome; an AIR unit (or a barbarian, defensively — barbarians
  // move via barbarians.js) is a NULLIFIER: the village is removed with no reward.
  const landed = tileAt(map, nx, ny);
  if (landed.hut === true) {
    if (unitType.domain === 'air' || unit.owner === 'barb') {
      delete landed.hut;
      events.push({ type: 'hutEntered', playerId: unit.owner, x: nx, y: ny, result: 'nothing' });
    } else {
      rollHut(state, unit, ruleset, events);
    }
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
