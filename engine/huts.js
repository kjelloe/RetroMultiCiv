// N13 / A4 goody huts (villages) — specs/n13-huts.md. A GROUND unit entering a
// tile.hut fires ONE eligibility-gated weighted roll over the five outcomes
// [advancedTribe, advance, gold, mercs, ambush] (weights rules.hut.weights); the
// village then leaves the map. Air/barbarian entry is a NULLIFIER handled in
// movement.js (removes the hut, no reward). All numbers/ids from the ruleset.
// Lua-portable subset.
import { rollRange } from './rng.js';
import { foundCityLegality, createCityAt } from './cities.js';
import { grantTech, availableTechs, FUTURE_TECH_ID } from './tech.js';
import { barbTier, ensureBarbPlayer, BARB_ID } from './barbarians.js';
import { unitsAt, cityAt } from './combat.js';
import { cowTile } from './cow.js';

// 8 neighbours in a FIXED row-major order — the deterministic "sorted neighbor
// order" the ambush placement walks (both engines identical).
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

function wrapX(map, x) {
  if (!map.wrapX) return x;
  return ((x % map.width) + map.width) % map.width;
}

function chebyshev(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

function isLand(state, ruleset, x, y) {
  return ruleset.terrain.terrains[state.map.tiles[y * state.map.width + x].t].domain === 'land';
}

// The city closest to (x, y) over every civ (chebyshev, ties → lower cityId), or
// null. Used for the mercenary home-city rule.
function closestCity(state, x, y) {
  let best = null, bestDist = 999999;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (!c) continue;
    const d = chebyshev(state.map, x, y, c.x, c.y);
    if (d < bestDist || (d === bestDist && (best === null || cid < best.id))) {
      best = c; bestDist = d;
    }
  }
  return best;
}

// Ambush is eligible only when the entering civ has founded a city AND no city of
// any civ sits within rules.hut.ambushCityRadius of the hut (both wiki gates).
function ambushEligible(state, playerId, x, y, ruleset) {
  let hasCity = false;
  for (const cid of state.cityOrder || []) {
    if (state.cities[cid] && state.cities[cid].owner === playerId) { hasCity = true; break; }
  }
  if (!hasCity) return false;
  const r = ruleset.rules.hut.ambushCityRadius;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && chebyshev(state.map, x, y, c.x, c.y) <= r) return false;
  }
  return true;
}

// Spawn one free mercenary (cavalry or legion) on the hut tile. Home = the
// closest city; if that closest city belongs to another civ (or none), no home.
function spawnMerc(state, playerId, x, y, ruleset) {
  const coin = rollRange(state.rngState, 2);
  state.rngState = coin.rngState;
  const type = coin.value === 0 ? 'cavalry' : 'legion';
  const unitId = 'u' + state.nextUnitId;
  state.nextUnitId = state.nextUnitId + 1;
  const unit = {
    id: unitId, type, owner: playerId, x, y,
    moves: ruleset.units[type].moves, fortified: false, veteran: false
  };
  const home = closestCity(state, x, y);
  if (home !== null && home.owner === playerId) unit.home = home.id;
  state.units[unitId] = unit;
}

// Barbarian ambush: up to rules.hut.ambushCount era-tier barbarians on adjacent
// LAND tiles (fixed neighbour order), skipping occupied/city tiles. No leader
// (R4). Zero legal tiles → nothing spawns (the village is still consumed).
function spawnAmbush(state, x, y, ruleset) {
  ensureBarbPlayer(state);
  const type = barbTier(state, ruleset);
  const map = state.map;
  const cap = ruleset.rules.hut.ambushCount;
  let placed = 0;
  for (const d of N8) {
    if (placed >= cap) break;
    const ny = y + d[1];
    if (ny < 0 || ny >= map.height) continue;
    let nx = x + d[0];
    if (map.wrapX) nx = wrapX(map, nx);
    else if (nx < 0 || nx >= map.width) continue;
    if (!isLand(state, ruleset, nx, ny)) continue;
    if (unitsAt(state, nx, ny).length > 0 || cityAt(state, nx, ny) !== null) continue;
    const unitId = 'u' + state.nextUnitId;
    state.nextUnitId = state.nextUnitId + 1;
    state.units[unitId] = {
      id: unitId, type, owner: BARB_ID, x: nx, y: ny,
      moves: ruleset.units[type].moves, fortified: false, veteran: false
    };
    placed = placed + 1;
  }
}

// A ground unit has entered the hut at the unit's tile. Roll and apply; remove
// the village; emit hutEntered. (Air/barbarian nullifiers are handled by the
// caller in movement.js — they never reach here.)
function rollHut(state, unit, ruleset, events) {
  const x = unit.x, y = unit.y;
  const playerId = unit.owner;
  const hut = ruleset.rules.hut;
  const w = hut.weights;

  // Build the ELIGIBLE outcomes in the fixed order, dropping gated ones.
  // XII.2: a goody hut grants a free REAL advance — never the Future Tech sentinel
  // (availableTechs returns it once the tree is exhausted), so filter it out here;
  // an exhausted tree keeps the authentic "no free tech" behaviour.
  const realTree = availableTechs(state, playerId, ruleset).filter(id => id !== FUTURE_TECH_ID);
  const outcomes = [];
  if (foundCityLegality(state, x, y, ruleset) === null) outcomes.push(['advancedTribe', w.advancedTribe]);
  if (state.turn > 1 && state.year <= 1000 && realTree.length > 0) {
    outcomes.push(['advance', w.advance]);
  }
  outcomes.push(['gold', w.gold]);
  outcomes.push(['mercs', w.mercs]);
  if (ambushEligible(state, playerId, x, y, ruleset)) outcomes.push(['ambush', w.ambush]);

  // ONE draw over the remaining weight sum; walk the fixed order.
  let result = 'nothing';
  let total = 0;
  for (const o of outcomes) total = total + o[1];
  if (total > 0) {
    const roll = rollRange(state.rngState, total);
    state.rngState = roll.rngState;
    let acc = 0;
    for (const o of outcomes) {
      acc = acc + o[1];
      if (roll.value < acc) { result = o[0]; break; }
    }
  }

  if (result === 'advancedTribe') {
    createCityAt(state, playerId, x, y, ruleset, events);
  } else if (result === 'advance') {
    const pick = rollRange(state.rngState, realTree.length); // sorted real techs (sentinel excluded)
    state.rngState = pick.rngState;
    grantTech(state, playerId, realTree[pick.value], ruleset, events); // fires Leonardo
  } else if (result === 'gold') {
    state.players[playerId].gold = state.players[playerId].gold + hut.gold;
  } else if (result === 'mercs') {
    spawnMerc(state, playerId, x, y, ruleset);
  } else if (result === 'ambush') {
    spawnAmbush(state, x, y, ruleset);
  }

  delete cowTile(state, y * state.map.width + x).hut;
  events.push({ type: 'hutEntered', playerId, x, y, result });
}

export { rollHut };
