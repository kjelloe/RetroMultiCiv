// Cities: founding, worked-tile yields, growth, and shield production.
// This slice: auto-assigned worked tiles, unit production, food box growth.
// Later slices: buildings/wonders, buy, specialists, happiness, trade split.
import { reveal } from './visibility.js';

// 21-tile "fat cross" offsets (5x5 minus corners), excluding the center.
const FAT_CROSS = [];
for (let dy = -2; dy <= 2; dy++) {
  for (let dx = -2; dx <= 2; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
    FAT_CROSS.push({ dx, dy });
  }
}

function tileYields(tile, ruleset) {
  const terrain = ruleset.terrain.terrains[tile.t];
  const base = tile.special ? terrain.special.yields : terrain.yields;
  let trade = base.trade;
  if (tile.river) trade = trade + ruleset.terrain.riverModifier.tradeBonus;
  return { food: base.food, shields: base.shields, trade };
}

function idiv(a, b) {
  return Math.floor(a / b);
}

function hasBuilding(city, buildingId) {
  return city.buildings !== undefined && city.buildings.indexOf(buildingId) !== -1;
}

// A wonder is active while built and its obsoleting tech is unknown to ALL
// players (Civ 1: anyone's discovery retires it).
function wonderActive(state, wonderId, ruleset) {
  if (!state.wonders || !state.wonders[wonderId]) return false;
  const obsoleteBy = ruleset.wonders[wonderId].obsoleteBy;
  if (obsoleteBy === '') return true;
  for (const pid of state.playerOrder) {
    if (state.players[pid].techs.indexOf(obsoleteBy) !== -1) return false;
  }
  return true;
}

function wonderInCity(state, city, wonderId, ruleset) {
  return wonderActive(state, wonderId, ruleset) && state.wonders[wonderId] === city.id;
}

// Sum a percentage effect (e.g. taxBonus, sciBonus) over a city's buildings.
function effectPct(city, ruleset, key) {
  let total = 0;
  if (city.buildings !== undefined) {
    for (const id of city.buildings) {
      const val = ruleset.buildings[id].effect[key];
      if (val !== undefined) total += val;
    }
  }
  return total;
}

// All workable fat-cross tiles for a city, greedy-sorted; idx = y*width + x
// is the stable tile id used by manual assignments (city.workers).
function candidateTiles(state, city, ruleset) {
  const { width, height, wrapX, tiles } = state.map;
  const candidates = [];
  for (const o of FAT_CROSS) {
    let x = city.x + o.dx;
    const y = city.y + o.dy;
    if (y < 0 || y >= height) continue;
    if (x < 0 || x >= width) {
      if (!wrapX) continue;
      x = ((x % width) + width) % width;
    }
    const y_ = tileYields(tiles[y * width + x], ruleset);
    candidates.push({ idx: y * width + x, x, y, score: y_.food * 3 + y_.shields * 2 + y_.trade, yields: y_ });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// Center tile (always worked, free) + up to pop worked tiles: the player's
// manual assignment (city.workers, tile indices) when present, otherwise the
// greedy best. Returns the actual worked tiles (center first).
function workedTiles(state, city, ruleset) {
  const { width, tiles } = state.map;
  const worked = [{
    x: city.x, y: city.y, center: true,
    yields: tileYields(tiles[city.y * width + city.x], ruleset)
  }];
  const candidates = candidateTiles(state, city, ruleset);
  if (city.workers !== undefined) {
    const byIdx = {};
    for (const c of candidates) byIdx[c.idx] = c;
    let count = 0;
    for (const idx of city.workers) {
      if (count >= city.pop) break;
      const c = byIdx[idx];
      if (!c) continue;
      worked.push({ x: c.x, y: c.y, center: false, yields: c.yields });
      count++;
    }
    return worked;
  }
  for (let i = 0; i < city.pop && i < candidates.length; i++) {
    worked.push({ x: candidates[i].x, y: candidates[i].y, center: false, yields: candidates[i].yields });
  }
  return worked;
}

// Manual worker placement. `workers` is a list of candidate tile indices
// (max pop, no duplicates); `auto: true` returns the city to greedy placement.
function setWorkers(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };

  if (cmd.auto === true) {
    delete city.workers;
    return { ok: true, events: [{ type: 'workersSet', cityId: city.id, auto: true }] };
  }
  const workers = cmd.workers;
  if (!Array.isArray(workers) || workers.length > city.pop) {
    return { ok: false, reason: 'badWorkers' };
  }
  const valid = {};
  for (const c of candidateTiles(state, city, ruleset)) valid[c.idx] = true;
  const seen = {};
  for (const idx of workers) {
    if (!Number.isInteger(idx) || !valid[idx] || seen[idx]) {
      return { ok: false, reason: 'badWorkers' };
    }
    seen[idx] = true;
  }
  city.workers = workers.slice();
  return { ok: true, events: [{ type: 'workersSet', cityId: city.id, auto: false }] };
}

function cityYields(state, city, ruleset) {
  const worked = workedTiles(state, city, ruleset);
  const total = { food: 0, shields: 0, trade: 0 };
  let tradeTiles = 0;
  for (const w of worked) {
    total.food += w.yields.food;
    total.shields += w.yields.shields;
    total.trade += w.yields.trade;
    if (w.yields.trade > 0) tradeTiles++;
  }
  // Colossus: +1 trade on every worked trade-producing tile in its city
  if (wonderInCity(state, city, 'colossus', ruleset)) total.trade += tradeTiles;
  return total;
}

function foundCity(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.type !== 'settlers') return { ok: false, reason: 'notSettlers' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };

  const terrain = ruleset.terrain.terrains[state.map.tiles[unit.y * state.map.width + unit.x].t];
  if (terrain.domain !== 'land') return { ok: false, reason: 'badTerrain' };
  for (const id of state.cityOrder) {
    const c = state.cities[id];
    if (c.x === unit.x && c.y === unit.y) return { ok: false, reason: 'cityExists' };
  }

  const cityId = 'c' + state.nextCityId;
  state.nextCityId = state.nextCityId + 1;
  state.cities[cityId] = {
    id: cityId,
    name: cmd.name || 'City ' + cityId,
    owner: cmd.playerId,
    x: unit.x,
    y: unit.y,
    pop: 1,
    food: 0,
    shields: 0,
    buildings: [],
    producing: { kind: 'unit', id: 'militia' }
  };
  state.cityOrder.push(cityId);
  delete state.units[cmd.unitId];
  reveal(state, cmd.playerId, state.cities[cityId].x, state.cities[cityId].y, 2);

  return { ok: true, events: [{ type: 'cityFounded', cityId, x: state.cities[cityId].x, y: state.cities[cityId].y }] };
}

function setProduction(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const item = cmd.item;
  if (!item) return { ok: false, reason: 'badItem' };

  let def = null;
  if (item.kind === 'unit') def = ruleset.units[item.id];
  else if (item.kind === 'building') def = ruleset.buildings[item.id];
  else if (item.kind === 'wonder') def = ruleset.wonders[item.id];
  if (!def) return { ok: false, reason: 'badItem' };

  if (def.tech !== '' && state.players[cmd.playerId].techs.indexOf(def.tech) === -1) {
    return { ok: false, reason: 'techRequired' };
  }
  if (item.kind === 'building' && hasBuilding(city, item.id)) {
    return { ok: false, reason: 'alreadyBuilt' };
  }
  if (item.kind === 'wonder' && state.wonders !== undefined && state.wonders[item.id] !== undefined) {
    return { ok: false, reason: 'wonderTaken' };
  }

  // Civ 1: switching production category forfeits half the accumulated shields
  if (city.producing.kind !== item.kind) {
    city.shields = idiv(city.shields, 2);
  }
  city.producing = { kind: item.kind, id: item.id };
  return { ok: true, events: [{ type: 'productionSet', cityId: city.id, item: city.producing }] };
}

// Runs once per game turn (when the last player ends): food box + production.
function processCities(state, ruleset, events) {
  const order = state.cityOrder;
  if (!order) return;
  for (const cityId of order) {
    const city = state.cities[cityId];
    if (!city) continue;
    const yields = cityYields(state, city, ruleset);

    city.food = city.food + yields.food - city.pop * 2;
    const threshold = 10 * (city.pop + 1);
    if (city.food >= threshold) {
      if (city.pop >= 10 && !hasBuilding(city, 'aqueduct')) {
        city.food = threshold; // growth stalls without an Aqueduct
      } else {
        city.pop = city.pop + 1;
        city.food = hasBuilding(city, 'granary') ? idiv(threshold, 2) : 0;
        // under manual placement the new citizen takes the best free tile
        if (city.workers !== undefined) {
          for (const c of candidateTiles(state, city, ruleset)) {
            if (city.workers.indexOf(c.idx) === -1) { city.workers.push(c.idx); break; }
          }
        }
        events.push({ type: 'cityGrew', cityId, pop: city.pop });
      }
    } else if (city.food < 0) {
      city.food = 0;
      if (city.pop > 1) {
        city.pop = city.pop - 1;
        if (city.workers !== undefined && city.workers.length > city.pop) {
          city.workers = city.workers.slice(0, city.pop);
        }
        events.push({ type: 'cityStarved', cityId, pop: city.pop });
      }
    }

    city.shields = city.shields + yields.shields;
    const prod = city.producing;
    if (prod.kind === 'unit') {
      const unitType = ruleset.units[prod.id];
      if (city.shields >= unitType.cost) {
        city.shields = city.shields - unitType.cost;
        const unitId = 'u' + state.nextUnitId;
        state.nextUnitId = state.nextUnitId + 1;
        state.units[unitId] = {
          id: unitId, type: prod.id, owner: city.owner,
          x: city.x, y: city.y, moves: unitType.moves,
          fortified: false, veteran: hasBuilding(city, 'barracks')
        };
        reveal(state, city.owner, city.x, city.y, 1);
        events.push({ type: 'unitBuilt', cityId, unitId, unitType: prod.id });
      }
    } else if (prod.kind === 'building') {
      const def = ruleset.buildings[prod.id];
      if (city.shields >= def.cost) {
        city.shields = city.shields - def.cost;
        if (city.buildings === undefined) city.buildings = [];
        city.buildings.push(prod.id);
        city.producing = { kind: 'unit', id: 'militia' };
        events.push({ type: 'buildingBuilt', cityId, building: prod.id });
      }
    } else if (prod.kind === 'wonder') {
      const def = ruleset.wonders[prod.id];
      if (city.shields >= def.cost) {
        if (state.wonders !== undefined && state.wonders[prod.id] !== undefined) {
          // another civilization finished it first — shields are kept
          city.producing = { kind: 'unit', id: 'militia' };
          events.push({ type: 'wonderLost', cityId, wonder: prod.id });
        } else {
          city.shields = city.shields - def.cost;
          if (state.wonders === undefined) state.wonders = {};
          state.wonders[prod.id] = city.id;
          city.producing = { kind: 'unit', id: 'militia' };
          events.push({ type: 'wonderBuilt', cityId, wonder: prod.id });
        }
      }
    }
  }
}

export {
  foundCity, setProduction, setWorkers, processCities, cityYields, workedTiles,
  candidateTiles, tileYields, FAT_CROSS, hasBuilding, wonderActive,
  wonderInCity, effectPct
};
