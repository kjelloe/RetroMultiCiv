// Cities: founding, worked-tile yields, growth, and shield production.
import { reveal } from './visibility.js';
import { governmentOf } from './government.js';

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
  let food = base.food;
  let shields = base.shields;
  let trade = base.trade;
  if (tile.river) trade = trade + ruleset.terrain.riverModifier.tradeBonus;
  if (tile.irrigation === true && terrain.irrigate !== undefined) {
    food += terrain.irrigate.food; shields += terrain.irrigate.shields; trade += terrain.irrigate.trade;
  }
  if (tile.mine === true && terrain.mine !== undefined) {
    food += terrain.mine.food; shields += terrain.mine.shields; trade += terrain.mine.trade;
  }
  // Civ 1: no road trade bonus on river tiles (the river already carries trade)
  if (tile.road === true && terrain.road !== undefined && tile.river !== true) {
    food += terrain.road.food; shields += terrain.road.shields; trade += terrain.road.trade;
  }
  if (tile.railroad === true) shields += Math.floor(shields / 2); // +50% shields (Civ 1)
  return { food, shields, trade };
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
    // filtered VIEWS hide rival techs — treat unknown as not-yet-discovered
    // (client-preview approximation; the server always has the real answer)
    const techs = state.players[pid].techs === undefined ? [] : state.players[pid].techs;
    if (techs.indexOf(obsoleteBy) !== -1) return false;
  }
  return true;
}

function wonderInCity(state, city, wonderId, ruleset) {
  return wonderActive(state, wonderId, ruleset) && state.wonders[wonderId] === city.id;
}

// The effective shield cost of an item for a player — civilization
// specialties (data/civs.json) discount one unit or building type.
function itemCost(kind, id, def, player, ruleset) {
  if (!player || player.civ === undefined || ruleset.civs === undefined) return def.cost;
  const civ = ruleset.civs[player.civ];
  const spec = civ === undefined ? undefined : civ.specialty;
  if (spec === undefined) return def.cost;
  if (kind === 'unit' && spec.type === 'cheapUnit' && spec.unit === id) {
    return def.cost - idiv(def.cost * spec.pct, 100);
  }
  if (kind === 'building' && spec.type === 'cheapBuilding' && spec.building === id) {
    return def.cost - idiv(def.cost * spec.pct, 100);
  }
  return def.cost;
}

// Does this player's civilization field veterans of the given unit type?
function civVeteran(player, unitId, ruleset) {
  if (!player || player.civ === undefined || ruleset.civs === undefined) return false;
  const civ = ruleset.civs[player.civ];
  const spec = civ === undefined ? undefined : civ.specialty;
  return spec !== undefined && spec.type === 'veteranUnit' && spec.unit === unitId;
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

// Government adjustments per worked tile: the despotism −1 on any yield of
// 3+, and the Republic/Democracy +1 trade on trade-producing tiles (Civ 1).
function govAdjustYields(y, gov) {
  const out = { food: y.food, shields: y.shields, trade: y.trade };
  if (gov.tilePenalty === true) {
    if (out.food >= 3) out.food = out.food - 1;
    if (out.shields >= 3) out.shields = out.shields - 1;
    if (out.trade >= 3) out.trade = out.trade - 1;
  }
  if (gov.tradeBonus > 0 && out.trade > 0) out.trade = out.trade + gov.tradeBonus;
  return out;
}

// All workable fat-cross tiles for a city, greedy-sorted; idx = y*width + x
// is the stable tile id used by manual assignments (city.workers).
function candidateTiles(state, city, ruleset) {
  const { width, height, wrapX, tiles } = state.map;
  const gov = governmentOf(state, city.owner, ruleset);
  const candidates = [];
  for (const o of FAT_CROSS) {
    let x = city.x + o.dx;
    const y = city.y + o.dy;
    if (y < 0 || y >= height) continue;
    if (x < 0 || x >= width) {
      if (!wrapX) continue;
      x = ((x % width) + width) % width;
    }
    const y_ = govAdjustYields(tileYields(tiles[y * width + x], ruleset), gov);
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
  const gov = governmentOf(state, city.owner, ruleset);
  const worked = [{
    x: city.x, y: city.y, center: true,
    yields: govAdjustYields(tileYields(tiles[city.y * width + city.x], ruleset), gov)
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
// (max pop, no duplicates); `auto: true` returns the city to greedy placement
// and clears explicit specialists. Optional `taxmen`/`scientists` turn idle
// citizens into those specialists (pop >= 5, Civ 1); the rest of the idle
// are entertainers implicitly.
function setWorkers(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };

  if (cmd.auto === true) {
    delete city.workers;
    delete city.taxmen;
    delete city.scientists;
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
  const taxmen = cmd.taxmen === undefined ? (city.taxmen === undefined ? 0 : city.taxmen) : cmd.taxmen;
  const scientists = cmd.scientists === undefined ? (city.scientists === undefined ? 0 : city.scientists) : cmd.scientists;
  if (!Number.isInteger(taxmen) || !Number.isInteger(scientists) || taxmen < 0 || scientists < 0) {
    return { ok: false, reason: 'badSpecialists' };
  }
  if ((taxmen > 0 || scientists > 0) && city.pop < 5) {
    return { ok: false, reason: 'badSpecialists' }; // Civ 1: pop >= 5 for taxmen/scientists
  }
  if (workers.length + taxmen + scientists > city.pop) {
    return { ok: false, reason: 'badSpecialists' };
  }
  city.workers = workers.slice();
  if (taxmen > 0) city.taxmen = taxmen; else delete city.taxmen;
  if (scientists > 0) city.scientists = scientists; else delete city.scientists;
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
  // cities keep their distance from EVERY city, any civ (rules.minCityDistance;
  // crafted states under rulesets without the rule keep the old behavior)
  const minDist = ruleset.rules.minCityDistance === undefined ? 1 : ruleset.rules.minCityDistance;
  for (const id of state.cityOrder) {
    const c = state.cities[id];
    if (c.x === unit.x && c.y === unit.y) return { ok: false, reason: 'cityExists' };
    let dx = c.x - unit.x;
    if (dx < 0) dx = -dx;
    if (state.map.wrapX && state.map.width - dx < dx) dx = state.map.width - dx;
    let dy = c.y - unit.y;
    if (dy < 0) dy = -dy;
    if ((dx > dy ? dx : dy) < minDist) return { ok: false, reason: 'tooCloseToCity' };
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

// Buy: pay gold to fill the shield box; the purchase completes at the next
// turn wrap like any production. Flat gold-per-missing-shield price
// (rules.json; wonders cost more) — a simplification of Civ 1's tiered
// formula, documented in the spec deviations.
function buyProduction(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const prod = city.producing;
  let def = null;
  if (prod.kind === 'unit') def = ruleset.units[prod.id];
  else if (prod.kind === 'building') def = ruleset.buildings[prod.id];
  else if (prod.kind === 'wonder') def = ruleset.wonders[prod.id];
  if (!def) return { ok: false, reason: 'badItem' };
  const cost = itemCost(prod.kind, prod.id, def, state.players[cmd.playerId], ruleset);
  const missing = cost - city.shields;
  if (missing <= 0) return { ok: false, reason: 'alreadyComplete' };
  const rate = prod.kind === 'wonder'
    ? ruleset.rules.buyGoldPerShieldWonder : ruleset.rules.buyGoldPerShield;
  const price = missing * rate;
  const player = state.players[cmd.playerId];
  if (player.gold < price) return { ok: false, reason: 'notEnoughGold' };
  player.gold = player.gold - price;
  city.shields = cost; // the civ-effective cost, so completion triggers at the wrap
  return { ok: true, events: [{ type: 'productionBought', cityId: city.id, price, item: prod }] };
}

// Runs once per game turn (when the last player ends): food box + production.
function processCities(state, ruleset, events) {
  const order = state.cityOrder;
  if (!order) return;
  for (const cityId of order) {
    const city = state.cities[cityId];
    if (!city) continue;
    const yields = cityYields(state, city, ruleset);
    if (city.disorder === true) yields.shields = 0; // civil disorder halts production

    // Factory chain: +50% shields, doubled by any power source (Civ 1)
    let shieldPct = effectPct(city, ruleset, 'shieldBonus');
    if (shieldPct > 0) {
      for (const b of city.buildings === undefined ? [] : city.buildings) {
        if (ruleset.buildings[b].effect.boostsFactory === true) {
          shieldPct = shieldPct * 2;
          break;
        }
      }
      yields.shields = yields.shields + idiv(yields.shields * shieldPct, 100);
    }

    // unit upkeep in shields (government-dependent); units without a home
    // city (game start, old saves) are free
    const gov = governmentOf(state, city.owner, ruleset);
    if (gov.upkeepShields > 0) {
      let supported = 0;
      for (const uid of Object.keys(state.units)) {
        if (state.units[uid].home === cityId) supported = supported + 1;
      }
      const owed = (supported - gov.freeUnitsPerCity) * gov.upkeepShields;
      if (owed > 0) {
        yields.shields = yields.shields - owed;
        if (yields.shields < 0) yields.shields = 0; // deviation: nothing disbands
      }
    }

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
        // specialists can't outnumber the shrunken citizenry either
        while ((city.taxmen !== undefined ? city.taxmen : 0)
             + (city.scientists !== undefined ? city.scientists : 0) > city.pop) {
          if (city.scientists !== undefined && city.scientists > 0) {
            city.scientists = city.scientists - 1;
            if (city.scientists === 0) delete city.scientists;
          } else {
            city.taxmen = city.taxmen - 1;
            if (city.taxmen === 0) delete city.taxmen;
          }
        }
        events.push({ type: 'cityStarved', cityId, pop: city.pop });
      }
    }

    city.shields = city.shields + yields.shields;
    const prod = city.producing;
    const owner = state.players[city.owner];
    if (prod.kind === 'unit') {
      const unitType = ruleset.units[prod.id];
      const cost = itemCost('unit', prod.id, unitType, owner, ruleset);
      if (city.shields >= cost) {
        city.shields = city.shields - cost;
        const unitId = 'u' + state.nextUnitId;
        state.nextUnitId = state.nextUnitId + 1;
        state.units[unitId] = {
          id: unitId, type: prod.id, owner: city.owner,
          x: city.x, y: city.y, moves: unitType.moves,
          fortified: false,
          veteran: hasBuilding(city, 'barracks') || civVeteran(owner, prod.id, ruleset),
          home: cityId
        };
        reveal(state, city.owner, city.x, city.y, 1);
        events.push({ type: 'unitBuilt', cityId, unitId, unitType: prod.id });
      }
    } else if (prod.kind === 'building') {
      const def = ruleset.buildings[prod.id];
      const cost = itemCost('building', prod.id, def, owner, ruleset);
      if (city.shields >= cost) {
        city.shields = city.shields - cost;
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
  foundCity, setProduction, setWorkers, buyProduction, processCities,
  cityYields, workedTiles, candidateTiles, tileYields, FAT_CROSS, hasBuilding,
  wonderActive, wonderInCity, effectPct, itemCost, civVeteran
};
