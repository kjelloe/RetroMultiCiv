// Cities: founding, worked-tile yields, growth, and shield production.
import { reveal } from './visibility.js';
import { governmentOf, capitalOf } from './government.js';
import { relationOf } from './diplomacy.js';
import { difficultyOf, hasHumanSeat } from './difficulty.js';

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

// B13a/A63: a unit leaves the production catalog once its obsoletedBy tech is
// known (data/units.json chains, wiki-verified). Pure — reads the def + the
// player's techs. Shared by setProduction (build-menu legality) and the AI's
// unit choice so both prune identically.
function unitObsolete(def, techs) {
  return def.obsoletedBy !== undefined && def.obsoletedBy !== ''
    && techs.indexOf(def.obsoletedBy) !== -1;
}

// B13a/B13e + §46: the best LAND defender the player can actually build now —
// highest defense, then cheapest, then id (deterministic tie-breaks; the Luau
// twin must match). Skips units whose obsoletedBy tech is known, so the choice
// era-scales (militia -> phalanx -> musketeers -> riflemen -> mech-inf) instead
// of jamming on an obsolete unit setProduction now rejects. Comparison-select =
// key-order-independent. Falls back to militia (tech-free base) if somehow
// nothing qualifies. §46: also the founding + empty-queue production default.
function bestDefenderUnit(me, ruleset) {
  let best = null, bestDef = null;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'land' || def.defense <= 0) continue;
    if (def.barbOnly === true) continue; // N13: the barbarian leader is never buildable
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (unitObsolete(def, me.techs)) continue;
    if (best === null
        || def.defense > bestDef.defense
        || (def.defense === bestDef.defense && def.cost < bestDef.cost)
        || (def.defense === bestDef.defense && def.cost === bestDef.cost && id < best)) {
      best = id; bestDef = def;
    }
  }
  return best === null ? 'militia' : best;
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

// manhattan-gate (#16): nukes become buildable once ANY active wonder grants the
// nukesEnabled effect (the Manhattan Project) — a GLOBAL gate (Civ 1: anyone's
// Manhattan Project opens nukes for everyone). A host may force them OFF entirely
// via the nukesDisabled rulesOverride (the no-nukes lobby toggle, marathon pattern).
// Data-driven (any wonder carrying the effect) + omit-safe; pure, both engines.
function nukesEnabled(state, ruleset) {
  if (ruleset.rules.nukesDisabled === true) return false;
  if (state.wonders === undefined) return false;
  for (const wid of Object.keys(state.wonders)) {
    const w = ruleset.wonders[wid];
    if (w !== undefined && w.effect !== undefined && w.effect.nukesEnabled === true
        && wonderActive(state, wid, ruleset)) return true;
  }
  return false;
}

// The effective shield cost of an item for a player — civilization
// specialties (data/civs.json) discount one unit or building type.
// aiCostPct is an ASYMMETRIC difficulty knob: an AI player's build cost scales by
// difficulties[level].aiCostPct, but ONLY when a human seat exists (the handicap is
// relative to the human). All-AI games + crafted states (no state) stay neutral.
function aiCostAdjust(cost, player, state, ruleset) {
  if (state === undefined || player === undefined || player.human === true) return cost;
  const d = difficultyOf(state, ruleset);
  if (d === null || !hasHumanSeat(state)) return cost;
  return idiv(cost * d.aiCostPct, 100);
}

function itemCost(kind, id, def, player, ruleset, state) {
  let cost = def.cost;
  if (player && player.civ !== undefined && ruleset.civs !== undefined) {
    const civ = ruleset.civs[player.civ];
    const spec = civ === undefined ? undefined : civ.specialty;
    if (spec !== undefined) {
      if (kind === 'unit' && spec.type === 'cheapUnit' && spec.unit === id) {
        cost = def.cost - idiv(def.cost * spec.pct, 100);
      } else if (kind === 'building' && spec.type === 'cheapBuilding' && spec.building === id) {
        cost = def.cost - idiv(def.cost * spec.pct, 100);
      }
    }
  }
  return aiCostAdjust(cost, player, state, ruleset);
}

// aiFoodRows is an ASYMMETRIC difficulty knob: an AI city's growth food-box is
// difficulties[level].aiFoodRows rows tall (vs the human's fixed 10) when a human
// seat exists; all-AI + crafted states use 10 (today's value).
function growthThreshold(state, city, ruleset) {
  let rows = 10;
  const d = difficultyOf(state, ruleset);
  if (d !== null && hasHumanSeat(state) && state.players[city.owner].human !== true) rows = d.aiFoodRows;
  return rows * (city.pop + 1);
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
  // A79 blockade (HOUSE RULE — user war-doctrine 2026-07-16, NOT Civ 1: the
  // wiki states enemy occupation does not block working; Civ 1 ZOC is movement-
  // only). An ENEMY unit (owner != city.owner, barbarians included) standing on
  // a tile blockades it — the tile drops from the candidate set, so auto-assign
  // skips to the next-best and a manually-worked blocked tile yields nothing
  // that turn (its citizen idles). The blockade lifts when the enemy leaves.
  const blocked = {};
  for (const uid of Object.keys(state.units || {})) {
    const u = state.units[uid];
    if (u.owner === city.owner) continue;
    // #15 perf: only a unit INSIDE the fat cross (cheb <= 2) can blockade a worked tile — blocked[]
    // is consulted ONLY for fat-cross tiles, so gating the per-unit work on that bounding box BEFORE
    // the relationOf lookup is HASH-NEUTRAL (a far unit's blocked entry is never read) and skips the
    // O(units) relationOf cost that dominated candidateTiles late-game (#15 profile: 16.5% + 6.1%).
    let adx = u.x - city.x; if (adx < 0) adx = -adx;
    if (wrapX && adx > width - adx) adx = width - adx;
    let ady = u.y - city.y; if (ady < 0) ady = -ady;
    if (adx > 2 || ady > 2) continue;
    // D1: a foreign unit blockades only at WAR (default). At PEACE trade flows —
    // the tile is not blocked. Absent relation = war = unchanged (barbarians, never
    // a diplomacy target, stay at war and keep blockading).
    if (relationOf(state, city.owner, u.owner) === 'war') {
      blocked[u.y * width + u.x] = true;
    }
  }
  const candidates = [];
  for (const o of FAT_CROSS) {
    let x = city.x + o.dx;
    const y = city.y + o.dy;
    if (y < 0 || y >= height) continue;
    if (x < 0 || x >= width) {
      if (!wrapX) continue;
      x = ((x % width) + width) % width;
    }
    if (blocked[y * width + x] === true) continue;
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
  // Civ 1 (wiki, Terrain page): the city tile automatically produces as if
  // ROADED & IRRIGATED (irrigation skipped when a mine occupies the tile) —
  // the other 20 squares need citizens. Copy the tile; never mutate state.
  const centerSrc = tiles[city.y * width + city.x];
  const centerTile = { t: centerSrc.t };
  if (centerSrc.special === true) centerTile.special = true;
  if (centerSrc.river === true) centerTile.river = true;
  if (centerSrc.mine === true) centerTile.mine = true; else centerTile.irrigation = true;
  centerTile.road = true;
  if (centerSrc.railroad === true) centerTile.railroad = true;
  const centerYields = govAdjustYields(tileYields(centerTile, ruleset), gov);
  // VI.2: the CAPITAL's city square carries a trade bonus (the palace's
  // administration) — applied after the government adjustment so despotism
  // cannot erase it: every capital researches from turn one.
  const capBonus = ruleset.rules.capitalCenterTradeBonus === undefined
    ? 0 : ruleset.rules.capitalCenterTradeBonus;
  if (capBonus > 0) {
    const cap = capitalOf(state, city.owner, ruleset);
    if (cap && cap.id === city.id) centerYields.trade = centerYields.trade + capBonus;
  }
  const worked = [{
    x: city.x, y: city.y, center: true,
    yields: centerYields
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
  // A54 off-turn pre-work: self-scoped (own city only, zero rng) — legal
  // while a rival moves; no turn check

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

// A60: name a newly-founded city. An explicit cmd.name wins (the human prompt;
// '' is falsy here, matching the old `cmd.name ||`). Otherwise, for a civ'd
// player, walk that civ's city list for the first name not already used by ANY
// current city (global uniqueness — two Romes read as a bug; iterate cityOrder
// for determinism), then a "New <name>" cycle, then "<CivName> Outpost <id>".
// A player with no civ (crafted states) keeps the old "City <cityId>" fallback,
// so scenario hashes built without civs are untouched.
function cityName(state, cmd, ruleset, cityId, idNum) {
  if (cmd.name) return cmd.name;
  const player = state.players[cmd.playerId];
  if (!player || player.civ === undefined || ruleset.civs === undefined) return 'City ' + cityId;
  const civ = ruleset.civs[player.civ];
  if (civ === undefined || civ.cities === undefined) return 'City ' + cityId;

  const used = {};
  for (const id of state.cityOrder) used[state.cities[id].name] = true;
  const list = civ.cities;
  for (let k = 0; k < list.length; k++) {
    if (used[list[k]] !== true) return list[k];
  }
  for (let k = 0; k < list.length; k++) {
    if (used['New ' + list[k]] !== true) return 'New ' + list[k];
  }
  return civ.name + ' Outpost ' + idNum;
}

// City-founding legality at (x, y): the reject reason, or null if legal. The VI.5
// spacing metric (3 orthogonal / 2 diagonal). Shared by the settler command AND
// the N13 hut advanced-tribe outcome (which must not found through an illegal tile).
function foundCityLegality(state, x, y, ruleset) {
  const terrain = ruleset.terrain.terrains[state.map.tiles[y * state.map.width + x].t];
  if (terrain.domain !== 'land') return 'badTerrain';
  for (const id of state.cityOrder) {
    const c = state.cities[id];
    if (c.x === x && c.y === y) return 'cityExists';
    if (!citySpacingOk(state.map, x, y, c.x, c.y, ruleset.rules)) return 'tooCloseToCity';
  }
  return null;
}

// The shared city-creation core: a pop-1 city at (x, y) for playerId (name from
// the civ list unless `name` is given). Pushes a cityFounded event. Callers do
// any unit/settler handling. Returns the new cityId.
function createCityAt(state, playerId, x, y, ruleset, events, name) {
  const idNum = state.nextCityId;
  const cityId = 'c' + idNum;
  state.nextCityId = state.nextCityId + 1;
  // §46: a new city defaults to the best defender its owner can build (era-relevant),
  // not a hardcoded militia that an advanced civ has long since obsoleted.
  const defender = bestDefenderUnit(state.players[playerId], ruleset);
  state.cities[cityId] = {
    id: cityId,
    name: cityName(state, { playerId, name }, ruleset, cityId, idNum),
    owner: playerId,
    x, y, pop: 1, food: 0, shields: 0,
    buildings: [],
    producing: { kind: 'unit', id: defender }
  };
  state.cityOrder.push(cityId);
  reveal(state, playerId, x, y, 2);
  events.push({ type: 'cityFounded', cityId, x, y });
  return cityId;
}

function foundCity(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (unit.type !== 'settlers') return { ok: false, reason: 'notSettlers' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMovesLeft' };
  const bad = foundCityLegality(state, unit.x, unit.y, ruleset);
  if (bad !== null) return { ok: false, reason: bad };
  const events = [];
  createCityAt(state, cmd.playerId, unit.x, unit.y, ruleset, events, cmd.name);
  delete state.units[cmd.unitId];
  return { ok: true, events };
}

function setProduction(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  // A54 off-turn pre-work: self-scoped (own city only, zero rng) — legal
  // while a rival moves; no turn check
  const item = cmd.item;
  if (!item) return { ok: false, reason: 'badItem' };

  let def = null;
  if (item.kind === 'unit') def = ruleset.units[item.id];
  else if (item.kind === 'building') def = ruleset.buildings[item.id];
  else if (item.kind === 'wonder') def = ruleset.wonders[item.id];
  else if (item.kind === 'ss-part') def = ruleset.rules.ssParts === undefined ? null : (ruleset.rules.ssParts[item.id] || null);
  if (!def) return { ok: false, reason: 'badItem' };

  if (def.tech !== '' && state.players[cmd.playerId].techs.indexOf(def.tech) === -1) {
    return { ok: false, reason: 'techRequired' };
  }
  // manhattan-gate (#16): a nuclear unit (nuclearBlast) also needs nukes ENABLED —
  // the Manhattan Project built anywhere (global gate) and not host-disabled.
  if (item.kind === 'unit' && def.nuclearBlast === true && !nukesEnabled(state, ruleset)) {
    return { ok: false, reason: 'noNukes' };
  }
  // A76: spaceship parts need the Apollo Program (derived gate, any civ), and
  // may not be built once the ship has launched or its per-type max is reached.
  if (item.kind === 'ss-part') {
    if (!wonderActive(state, ruleset.rules.ssFlight.gateWonder, ruleset)) {
      return { ok: false, reason: 'noApollo' };
    }
    const ship = state.players[cmd.playerId].spaceship;
    if (ship && ship.launched !== undefined && ship.launched !== 0) {
      return { ok: false, reason: 'shipLaunched' };
    }
    const have = ship && ship[item.id] !== undefined ? ship[item.id] : 0;
    if (have >= def.max) return { ok: false, reason: 'partMaxReached' };
  }
  // B13a/A63: a unit obsoleted by a known tech has left the catalog
  if (item.kind === 'unit' && unitObsolete(def, state.players[cmd.playerId].techs)) {
    return { ok: false, reason: 'obsolete' };
  }
  // N13: barb-only units (the barbarian leader) are never buildable by a civ
  if (item.kind === 'unit' && def.barbOnly === true) {
    return { ok: false, reason: 'notBuildable' };
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
  else if (prod.kind === 'ss-part') def = ruleset.rules.ssParts[prod.id];
  if (!def) return { ok: false, reason: 'badItem' };
  const cost = itemCost(prod.kind, prod.id, def, state.players[cmd.playerId], ruleset, state);
  const missing = cost - city.shields;
  if (missing <= 0) return { ok: false, reason: 'alreadyComplete' };
  const rate = prod.kind === 'wonder' ? ruleset.rules.buyGoldPerShieldWonder
    : prod.kind === 'ss-part' ? ruleset.rules.buyGoldPerShieldSS
    : ruleset.rules.buyGoldPerShield;
  const price = missing * rate;
  const player = state.players[cmd.playerId];
  if (player.gold < price) return { ok: false, reason: 'notEnoughGold' };
  player.gold = player.gold - price;
  city.shields = cost; // the civ-effective cost, so completion triggers at the wrap
  return { ok: true, events: [{ type: 'productionBought', cityId: city.id, price, item: prod }] };
}

// A83: a caravan (units.json helpsWonder) standing in one of the player's own
// cities that is building a wonder pours its build cost into the shield box and
// is consumed — Civ 1's "help build wonder?" prompt. The shields only FILL the
// box; the wonder completes at the turn wrap in processCities, exactly like buy.
// Human-only: the AI never fields caravans, so the sim goldens are untouched.
function helpWonder(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const def = ruleset.units[unit.type];
  if (!def || def.helpsWonder !== true) return { ok: false, reason: 'cannotHelpWonder' };
  let city = null;
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (c && c.x === unit.x && c.y === unit.y) { city = c; break; }
  }
  if (!city) return { ok: false, reason: 'noCityHere' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (city.producing.kind !== 'wonder') return { ok: false, reason: 'notBuildingWonder' };
  const added = def.cost;
  city.shields = city.shields + added;
  delete state.units[cmd.unitId];
  return { ok: true, events: [{
    type: 'wonderHelped', cityId: city.id, unitId: cmd.unitId,
    wonder: city.producing.id, shields: added, playerId: cmd.playerId
  }] };
}

// A86/A63: remove a building and credit its sale price (gold = shield cost ×
// rules.sellPriceRatio) to the city's owner, with a buildingSold event carrying
// the trigger `reason`. Shared by the tech-obsolescence auto-sell (reason
// 'obsolete') and the manual sellBuilding command (reason 'manual') — one
// removal+credit implementation, two triggers. Callers guarantee the building
// is present (they check first). Does NOT touch the one-sale flag.
function sellBuildingFrom(state, city, buildingId, ruleset, events, reason) {
  const def = ruleset.buildings[buildingId];
  const idx = city.buildings.indexOf(buildingId);
  city.buildings.splice(idx, 1);
  const credit = def.cost * ruleset.rules.sellPriceRatio;
  const owner = state.players[city.owner];
  owner.gold = owner.gold + credit;
  events.push({ type: 'buildingSold', playerId: city.owner, cityId: city.id, building: buildingId, gold: credit, reason });
}

// A86: the human sells one city improvement for gold. Civ 1 allows ONE sale per
// city per turn (the omit-safe city.soldThisTurn flag, cleared at the wrap). The
// Palace cannot be sold (capitalOf would corrupt). AI never issues this.
function sellBuilding(state, cmd, ruleset) {
  const city = state.cities[cmd.cityId];
  if (!city) return { ok: false, reason: 'unknownCity' };
  if (city.owner !== cmd.playerId) return { ok: false, reason: 'notYourCity' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (city.soldThisTurn === true) return { ok: false, reason: 'alreadySoldThisTurn' };
  if (city.buildings === undefined || city.buildings.indexOf(cmd.building) === -1) {
    return { ok: false, reason: 'noSuchBuilding' };
  }
  const def = ruleset.buildings[cmd.building];
  if (!def) return { ok: false, reason: 'badBuilding' };
  if (def.effect !== undefined && def.effect.isPalace === true) return { ok: false, reason: 'cannotSellPalace' };
  const events = [];
  sellBuildingFrom(state, city, cmd.building, ruleset, events, 'manual');
  city.soldThisTurn = true;
  return { ok: true, events };
}

// §40: trim manual worker/specialist assignments that now exceed a shrunken
// pop (starvation and the settler pop-cost both use it).
function trimToPop(city) {
  if (city.workers !== undefined && city.workers.length > city.pop) {
    city.workers = city.workers.slice(0, city.pop);
  }
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
}

// §40: a size-1 city that completes a settler CEASES TO EXIST (it "became" the
// settler). Units homed here go homeless (the home field is removed — the
// engine's home===undefined convention; NO null in state). A wonder built here
// is destroyed PERMANENTLY (state.wonders entry dropped, so wonderActive→false).
// Elimination is NOT special-cased: the owner losing its last city routes
// through the normal checkGameEnd/hasAssets path on the turn wrap.
function disbandCity(state, cityId, events, ruleset) {
  const city = state.cities[cityId];
  for (const uid of Object.keys(state.units)) {
    if (state.units[uid].home === cityId) delete state.units[uid].home;
  }
  // B27: a SEA unit docked in the vanishing coastal city loses its home port and is
  // lost with any cargo aboard (mirrors naval.js's open-sea loss) — otherwise it
  // strands on the now-cityless LAND tile (the sea-unit-on-land invariant break).
  // Deleting a fixed SET of units => order-independent final state (events aren't
  // hashed), so the raw Object.keys scan stays cross-language deterministic.
  if (ruleset !== undefined && city !== undefined) {
    const cx = city.x, cy = city.y;
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u === undefined || u.x !== cx || u.y !== cy) continue;
      if (ruleset.units[u.type].domain !== 'sea') continue;
      for (const cid of Object.keys(state.units)) {
        const c = state.units[cid];
        if (c !== undefined && c.aboard === uid) {
          delete state.units[cid];
          events.push({ type: 'cargoLost', unitId: cid, owner: c.owner, shipId: uid, x: cx, y: cy });
        }
      }
      delete state.units[uid];
      events.push({ type: 'triremeLost', unitId: uid, owner: u.owner, x: cx, y: cy });
    }
  }
  if (state.wonders !== undefined) {
    for (const wid of Object.keys(state.wonders)) {
      if (state.wonders[wid] === cityId) delete state.wonders[wid];
    }
  }
  delete state.cities[cityId];
  if (state.cityOrder !== undefined) {
    const next = [];
    for (const id of state.cityOrder) if (id !== cityId) next.push(id);
    state.cityOrder = next;
  }
  events.push({ type: 'cityDisbanded', cityId });
}

// #29 hoover: are (ax,ay) and (bx,by) on the same contiguous LAND continent? A flood-fill
// from (ax,ay) over 8-adjacent land tiles (wrapX honored) — the same "contiguous land = one
// continent" definition the naval AI uses (engine/ai.js landComponent); kept local here so
// cities.js stays free of an ai.js import cycle. The boolean result is fill-order-independent.
function sameContinent(state, ax, ay, bx, by, ruleset) {
  const W = state.map.width, H = state.map.height;
  const startIdx = ay * W + ax, targetIdx = by * W + bx;
  if (startIdx === targetIdx) return true;
  if (ruleset.terrain.terrains[state.map.tiles[startIdx].t].domain !== 'land') return false;
  const seen = {};
  seen[startIdx] = true;
  const stack = [startIdx];
  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % W, y = idiv(idx, W);
    for (let dy = -1; dy <= 1; dy = dy + 1) {
      for (let dx = -1; dx <= 1; dx = dx + 1) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        let nx = x + dx;
        if (nx < 0 || nx >= W) {
          if (state.map.wrapX !== true) continue;
          nx = ((nx % W) + W) % W;
        }
        const nidx = ny * W + nx;
        if (seen[nidx] === true) continue;
        if (ruleset.terrain.terrains[state.map.tiles[nidx].t].domain !== 'land') continue;
        if (nidx === targetIdx) return true;
        seen[nidx] = true;
        stack.push(nidx);
      }
    }
  }
  return false;
}

// #29 hoover-dam: does an active powerSameContinent wonder (Hydro Plant) power this city —
// owned by the same player and on the wonder-city's continent? Boolean, so wonder-iteration
// order does not matter (there is normally one such wonder in a game).
function hooverPowersCity(state, city, ruleset) {
  for (const wid of Object.keys(state.wonders === undefined ? {} : state.wonders)) {
    if (ruleset.wonders[wid].effect.powerSameContinent !== true) continue;
    if (!wonderActive(state, wid, ruleset)) continue;
    const home = state.cities[state.wonders[wid]];
    if (!home || home.owner !== city.owner) continue;
    if (sameContinent(state, home.x, home.y, city.x, city.y, ruleset)) return true;
  }
  return false;
}

// A91: a city's GROSS shield output this turn — base worked-tile shields, zeroed by
// civil disorder, then the Factory chain (+shieldBonus%, doubled by a power source).
// PRE-upkeep (upkeep is a separate deduction in processCities). Shared so pollution.js
// reads the SAME production number processCities does (no drift). Pure, both engines.
function cityShieldOutput(state, city, ruleset) {
  let shields = cityYields(state, city, ruleset).shields;
  if (city.disorder === true) shields = 0;
  let shieldPct = effectPct(city, ruleset, 'shieldBonus');
  if (shieldPct > 0) {
    let powered = false;
    for (const b of city.buildings === undefined ? [] : city.buildings) {
      if (ruleset.buildings[b].effect.boostsFactory === true) {
        powered = true;
        break;
      }
    }
    // #29 hoover-dam: a same-continent Hydro Plant powers the city, doubling the factory bonus.
    if (!powered && hooverPowersCity(state, city, ruleset)) powered = true;
    if (powered) shieldPct = shieldPct * 2;
    shields = shields + idiv(shields * shieldPct, 100);
  }
  return shields;
}

// Runs once per game turn (when the last player ends): food box + production.
function processCities(state, ruleset, events) {
  const order = state.cityOrder;
  if (!order) return;
  for (const cityId of order) {
    const city = state.cities[cityId];
    if (!city) continue;
    const yields = cityYields(state, city, ruleset);
    // A91: gross shields (disorder-zero + Factory chain) via the shared helper, so
    // pollution.js and production read the identical number.
    yields.shields = cityShieldOutput(state, city, ruleset);

    // unit upkeep in shields (government-dependent); units without a home
    // city (game start, old saves) are free
    const gov = governmentOf(state, city.owner, ruleset);
    if (gov.upkeepShields > 0) {
      let supported = 0;
      for (const uid of Object.keys(state.units)) {
        // air-truth: freeSupport units (diplomat, caravan) never cost shield upkeep
        if (state.units[uid].home === cityId
            && ruleset.units[state.units[uid].type].freeSupport !== true) supported = supported + 1;
      }
      const owed = (supported - gov.freeUnitsPerCity) * gov.upkeepShields;
      if (owed > 0) {
        yields.shields = yields.shields - owed;
        if (yields.shields < 0) yields.shields = 0; // deviation: nothing disbands
      }
    }

    // settler food upkeep (user ruling: flat 1 food/settler — an original-shape
    // simplification, NOT Civ's per-government split). Each settler HOMED at this
    // city eats settlerFoodUpkeep food/turn, mirroring the shield upkeep above;
    // homeless settlers (the initial settler, old saves) are free. Over-expansion
    // then STARVES its home cities via the food<0 path below — a self-cap on
    // settler spam. Sweepable; undefined/0 = no upkeep (identity/back-compat).
    const settlerUpkeep = ruleset.rules.settlerFoodUpkeep === undefined ? 0 : ruleset.rules.settlerFoodUpkeep;
    let settlerFood = 0;
    if (settlerUpkeep > 0) {
      for (const uid of Object.keys(state.units)) {
        const u = state.units[uid];
        if (u.home === cityId && u.type === 'settlers') settlerFood = settlerFood + settlerUpkeep;
      }
    }
    city.food = city.food + yields.food - city.pop * 2 - settlerFood;
    const threshold = growthThreshold(state, city, ruleset);
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
        trimToPop(city);
        events.push({ type: 'cityStarved', cityId, pop: city.pop });
      }
    }

    city.shields = city.shields + yields.shields;
    const prod = city.producing;
    const owner = state.players[city.owner];
    if (prod.kind === 'unit') {
      const unitType = ruleset.units[prod.id];
      const cost = itemCost('unit', prod.id, unitType, owner, ruleset, state);
      if (city.shields >= cost) {
        const popCost = unitType.popCost === undefined ? 0 : unitType.popCost;
        // XV §7 (Civ2-shape REFUSE, user ruling): the CAPITAL (the city holding the Palace) will NOT
        // self-disband to complete a pop-cost unit (a settler from a size-1 capital). Its production is
        // BANKED — shields held AT cost, blocked — until the city grows past the pop cost or the player
        // changes production. Non-capitals keep the authentic §40 disband below (a size-1 town "becomes"
        // the settler). Checked by the Palace building itself (unique per civ), NOT capitalOf — a
        // palace-less civ's fallback "capital" still disbands authentically (046-family unchanged).
        let cityIsCapital = false;
        for (const b of city.buildings === undefined ? [] : city.buildings) {
          if (ruleset.buildings[b].effect !== undefined && ruleset.buildings[b].effect.isPalace === true) { cityIsCapital = true; break; }
        }
        const refuseCapital = popCost > 0 && city.pop - popCost < 1 && cityIsCapital;
        if (refuseCapital) {
          if (city.shields > cost) city.shields = cost; // bank at cost; no overflow while refused
          events.push({ type: 'settlerRefused', cityId, unitType: prod.id });
        } else {
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
          // §40: Civ 1 — a unit with a pop cost (settlers) deducts pop on
          // completion; a city that drops below 1 is DISBANDED (it became the
          // unit; the just-built unit goes homeless).
          if (popCost > 0) {
            city.pop = city.pop - popCost;
            if (city.pop < 1) {
              disbandCity(state, cityId, events, ruleset);
            } else {
              trimToPop(city);
            }
          }
        }
      }
    } else if (prod.kind === 'building') {
      const def = ruleset.buildings[prod.id];
      const cost = itemCost('building', prod.id, def, owner, ruleset, state);
      if (city.shields >= cost) {
        city.shields = city.shields - cost;
        if (city.buildings === undefined) city.buildings = [];
        city.buildings.push(prod.id);
        city.producing = { kind: 'unit', id: bestDefenderUnit(owner, ruleset) };
        events.push({ type: 'buildingBuilt', cityId, building: prod.id });
      }
    } else if (prod.kind === 'wonder') {
      const def = ruleset.wonders[prod.id];
      if (city.shields >= def.cost) {
        if (state.wonders !== undefined && state.wonders[prod.id] !== undefined) {
          // another civilization finished it first — shields are kept
          city.producing = { kind: 'unit', id: bestDefenderUnit(owner, ruleset) };
          events.push({ type: 'wonderLost', cityId, wonder: prod.id });
        } else {
          city.shields = city.shields - def.cost;
          if (state.wonders === undefined) state.wonders = {};
          state.wonders[prod.id] = city.id;
          city.producing = { kind: 'unit', id: bestDefenderUnit(owner, ruleset) };
          events.push({ type: 'wonderBuilt', cityId, wonder: prod.id });
        }
      }
    } else if (prod.kind === 'ss-part') {
      // A76: a completed part auto-attaches to the owner's ship (the counter
      // increments; player.spaceship is created on the first part — omit-safe).
      // A launched ship (in flight) or a maxed part keeps the shields and reverts.
      const def = ruleset.rules.ssParts[prod.id];
      const cost = itemCost('ss-part', prod.id, def, owner, ruleset, state);
      if (city.shields >= cost) {
        const ship = owner.spaceship;
        const launched = ship !== undefined && ship.launched !== undefined && ship.launched !== 0;
        const have = ship !== undefined && ship[prod.id] !== undefined ? ship[prod.id] : 0;
        if (launched || have >= def.max) {
          city.producing = { kind: 'unit', id: bestDefenderUnit(owner, ruleset) };
        } else {
          city.shields = city.shields - cost;
          if (owner.spaceship === undefined) owner.spaceship = {};
          owner.spaceship[prod.id] = have + 1;
          city.producing = { kind: 'unit', id: bestDefenderUnit(owner, ruleset) };
          events.push({ type: 'ssPartBuilt', cityId, playerId: city.owner, part: prod.id, count: owner.spaceship[prod.id] });
        }
      }
    }
  }
}

// VI.5 spacing metric (user, from the phase-4 acceptance playtest): legal
// iff Chebyshev >= minCityDistance OR the site sits fully diagonal at
// >= minCityDiagonal on BOTH axes (3-orthogonal / 2-diagonal with the
// shipped rules). Rulesets without the diagonal rule keep the plain
// Chebyshev check; without either rule, distance 1 (crafted-state compat).
function citySpacingOk(map, x, y, cx, cy, rules) {
  let dx = cx - x;
  if (dx < 0) dx = -dx;
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  let dy = cy - y;
  if (dy < 0) dy = -dy;
  const cheb = dx > dy ? dx : dy;
  const minDist = rules.minCityDistance === undefined ? 1 : rules.minCityDistance;
  if (cheb >= minDist) return true;
  const diag = rules.minCityDiagonal;
  if (diag === undefined) return false;
  return dx >= diag && dy >= diag;
}

export {
  foundCity, foundCityLegality, createCityAt, setProduction, setWorkers, buyProduction, helpWonder,
  sellBuilding, sellBuildingFrom, processCities,
  cityYields, cityShieldOutput, workedTiles, candidateTiles, tileYields, FAT_CROSS, hasBuilding,
  wonderActive, wonderInCity, nukesEnabled, effectPct, itemCost, growthThreshold, civVeteran, citySpacingOk,
  unitObsolete, bestDefenderUnit, trimToPop
};
