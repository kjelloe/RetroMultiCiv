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

// Center tile (always worked, free) + the pop best tiles of the fat cross,
// greedily by weighted score. Tile contention between cities comes later.
function cityYields(state, city, ruleset) {
  const { width, height, wrapX, tiles } = state.map;
  const total = tileYields(tiles[city.y * width + city.x], ruleset);

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
    candidates.push({ score: y_.food * 3 + y_.shields * 2 + y_.trade, yields: y_ });
  }
  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < city.pop && i < candidates.length; i++) {
    total.food += candidates[i].yields.food;
    total.shields += candidates[i].yields.shields;
    total.trade += candidates[i].yields.trade;
  }
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
  if (!item || item.kind !== 'unit' || !ruleset.units[item.id]) {
    return { ok: false, reason: 'badItem' };
  }
  const requiredTech = ruleset.units[item.id].tech;
  if (requiredTech !== '' && state.players[cmd.playerId].techs.indexOf(requiredTech) === -1) {
    return { ok: false, reason: 'techRequired' };
  }
  // Civ 1 forfeits half the shields when switching category; unit->unit keeps them
  city.producing = { kind: 'unit', id: item.id };
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
    if (city.food >= 10 * (city.pop + 1)) {
      city.pop = city.pop + 1;
      city.food = 0;
      events.push({ type: 'cityGrew', cityId, pop: city.pop });
    } else if (city.food < 0) {
      city.food = 0;
      if (city.pop > 1) {
        city.pop = city.pop - 1;
        events.push({ type: 'cityStarved', cityId, pop: city.pop });
      }
    }

    city.shields = city.shields + yields.shields;
    const unitType = ruleset.units[city.producing.id];
    if (city.producing.kind === 'unit' && city.shields >= unitType.cost) {
      city.shields = city.shields - unitType.cost;
      const unitId = 'u' + state.nextUnitId;
      state.nextUnitId = state.nextUnitId + 1;
      state.units[unitId] = {
        id: unitId, type: city.producing.id, owner: city.owner,
        x: city.x, y: city.y, moves: unitType.moves,
        fortified: false, veteran: false
      };
      reveal(state, city.owner, city.x, city.y, 1);
      events.push({ type: 'unitBuilt', cityId, unitId, unitType: city.producing.id });
    }
  }
}

export { foundCity, setProduction, processCities, cityYields, tileYields, FAT_CROSS };
