// Tile improvements: Settlers spend whole turns building roads, irrigation,
// and mines (docs/01-game-spec.md §3.2). Yield bonuses live in
// data/terrain.json (irrigate/mine/road per terrain); build times in
// data/rules.json workTurns. Civ 1 terrain transforms (clear/plant/drain),
// railroads, fortresses, and pillage are later slices.
import { sortIds } from './combat.js';

// tile flag written by each kind of work
function workFlag(work) {
  return work === 'irrigate' ? 'irrigation' : work;
}

// Civ 1: irrigation needs a water source — a river on the tile, or an ocean/
// river/irrigated tile among the 8 neighbors (we use the full neighborhood,
// matching the game's 8-directional movement).
function hasWaterSource(state, x, y) {
  const map = state.map;
  if (map.tiles[y * map.width + x].river === true) return true;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= map.height) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let xx = x + dx;
      if (xx < 0 || xx >= map.width) {
        if (!map.wrapX) continue;
        xx = ((xx % map.width) + map.width) % map.width;
      }
      const t = map.tiles[yy * map.width + xx];
      if (t.t === 'ocean' || t.river === true || t.irrigation === true) return true;
    }
  }
  return false;
}

// Command: a settler starts (or switches to) a job on its tile. Consumes the
// turn; the work advances at every turn wrap until done. Moving cancels it.
// The irrigate/mine orders TRANSFORM terrains that support no bonus (clear
// forest/jungle, drain swamp, plant forest — data/terrain.json transforms);
// transforms need no water source. Fortress needs Construction; railroad
// needs the Railroad advance and an existing road.
function startWork(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.type !== 'settlers') return { ok: false, reason: 'notSettlers' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  const work = cmd.work;
  if (work !== 'road' && work !== 'irrigate' && work !== 'mine'
      && work !== 'fortress' && work !== 'railroad') {
    return { ok: false, reason: 'badWork' };
  }

  const tile = state.map.tiles[unit.y * state.map.width + unit.x];
  const terrain = ruleset.terrain.terrains[tile.t];
  const techs = state.players[cmd.playerId].techs;
  if (terrain.domain !== 'land') return { ok: false, reason: 'badTerrain' };
  if (tile[workFlag(work)] === true) return { ok: false, reason: 'alreadyImproved' };

  if (work === 'fortress') {
    if (techs.indexOf(ruleset.rules.fortressTech) === -1) return { ok: false, reason: 'techRequired' };
    for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.x === unit.x && c.y === unit.y) return { ok: false, reason: 'badTerrain' };
    }
  } else if (work === 'railroad') {
    if (techs.indexOf(ruleset.rules.railroadTech) === -1) return { ok: false, reason: 'techRequired' };
    if (tile.road !== true) return { ok: false, reason: 'badTerrain' }; // rails need a road first
  } else if (work !== 'road') {
    const transform = terrain.transforms !== undefined && terrain.transforms[work] !== undefined;
    if (terrain[work] === undefined && !transform) return { ok: false, reason: 'badTerrain' };
    if (work === 'irrigate' && !transform && !hasWaterSource(state, unit.x, unit.y)) {
      return { ok: false, reason: 'noWater' };
    }
  }

  unit.working = work;
  unit.workLeft = ruleset.rules.workTurns[work];
  unit.moves = 0;
  return { ok: true, events: [{ type: 'workStarted', unitId: unit.id, work, x: unit.x, y: unit.y }] };
}

// Pillage: a land unit destroys one improvement on its tile — the field works
// (irrigation/mine) fall before the road, as in Civ 1. Costs the turn.
function pillage(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  if (ruleset.units[unit.type].domain !== 'land') return { ok: false, reason: 'badTerrain' };
  const tile = state.map.tiles[unit.y * state.map.width + unit.x];
  let destroyed = '';
  if (tile.irrigation === true) { delete tile.irrigation; destroyed = 'irrigation'; }
  else if (tile.mine === true) { delete tile.mine; destroyed = 'mine'; }
  else if (tile.railroad === true) { delete tile.railroad; destroyed = 'railroad'; }
  else if (tile.road === true) { delete tile.road; destroyed = 'road'; }
  else return { ok: false, reason: 'nothingToPillage' };
  unit.moves = 0;
  return {
    ok: true,
    events: [{ type: 'pillaged', unitId: unit.id, owner: unit.owner, destroyed, x: unit.x, y: unit.y }]
  };
}

// Runs once per game turn (turn wrap), before cities harvest, so a finished
// improvement feeds the same turn's yields.
function processWork(state, ruleset, events) {
  for (const id of sortIds(Object.keys(state.units))) {
    const unit = state.units[id];
    if (unit.working === undefined) continue;
    unit.workLeft = unit.workLeft - 1;
    if (unit.workLeft > 0) continue;
    const work = unit.working;
    const tile = state.map.tiles[unit.y * state.map.width + unit.x];
    const terrain = ruleset.terrain.terrains[tile.t];
    const transform = (work === 'irrigate' || work === 'mine')
      && terrain[work] === undefined
      && terrain.transforms !== undefined && terrain.transforms[work] !== undefined;
    const event = { type: 'improvementBuilt', unitId: unit.id, owner: unit.owner, work, x: unit.x, y: unit.y };
    if (transform) {
      tile.t = terrain.transforms[work]; // clear/drain/plant: the terrain changes
      delete tile.irrigation;
      delete tile.mine;
      event.transformedTo = tile.t;
    } else {
      tile[workFlag(work)] = true;
      // Civ 1: irrigation and mine replace each other on a tile
      if (work === 'irrigate') delete tile.mine;
      if (work === 'mine') delete tile.irrigation;
    }
    delete unit.working;
    delete unit.workLeft;
    events.push(event);
  }
}

export { startWork, processWork, pillage, hasWaterSource, workFlag };
