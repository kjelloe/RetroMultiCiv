// CIV1 DISASTERS (#2082 pack, user-ruled authentic-ON + a harness toggle): random
// per-city calamities each turn, each preventable by a Civ1 building/tech. The 8th,
// MELTDOWN, is A91's (engine/pollution.js) — this module owns the other seven.
// Deterministic: every roll through engine/rng.js, iterating cityOrder; RNG is drawn
// ONLY for a city that has an ELIGIBLE (possible + unprevented) disaster (the
// triremeLossPct discipline) — so a fully-protected empire AND disastersEnabled=false
// both draw ZERO rng and stay byte-identical. Lua-portable subset (no class/this/Map/Set).
import { rollRange } from './rng.js';
import { hasBuilding } from './cities.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

const ADJ8 = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];

// does the city tile (when includeSelf) OR a neighbor satisfy pred(tile)?
function nearTile(state, cx, cy, includeSelf, pred) {
  const W = state.map.width, H = state.map.height;
  if (includeSelf && pred(state.map.tiles[cy * W + cx])) return true;
  for (const o of ADJ8) {
    let x = cx + o.dx;
    if (x < 0 || x >= W) {
      if (state.map.wrapX !== true) continue;
      x = ((x % W) + W) % W;
    }
    const y = cy + o.dy;
    if (y < 0 || y >= H) continue;
    if (pred(state.map.tiles[y * W + x])) return true;
  }
  return false;
}

// the fixed disaster order (deterministic selection). Meltdown (the 8th) is A91's.
const DISASTER_ORDER = ['pirate', 'flood', 'fire', 'plague', 'famine', 'volcano', 'earthquake'];

// is `kind` POSSIBLE for this city (terrain/river gate met) AND not prevented?
function eligible(state, city, kind, ruleset) {
  const d = ruleset.rules.disasters[kind];
  const player = state.players[city.owner];
  if (d.prevent !== undefined && hasBuilding(city, d.prevent)) return false;
  if (d.preventTech !== undefined && player.techs.indexOf(d.preventTech) !== -1) return false;
  // river: ON or NEXT TO (flood). terrain: mountains ON or NEXT TO (volcano); ocean
  // (pirate) and hills (earthquake) are NEXT TO only — a city never sits on ocean, and
  // the Civ1 quake gates on an adjacent hill. fire/plague/famine have no terrain gate.
  if (d.river === true) return nearTile(state, city.x, city.y, true, t => t.river === true);
  if (d.terrain !== undefined) {
    const includeSelf = d.terrain === 'mountains';
    return nearTile(state, city.x, city.y, includeSelf, t => t.t === d.terrain);
  }
  return true;
}

// apply one disaster's effect. Pop loss floors (a size-1 city is immune to 25%/33%);
// building-destroy rng-picks one of the city's buildings; pirate loots gold + zeroes
// the food and shield stocks. Wonders live in state.wonders, so none is ever destroyed.
function strike(state, city, kind, ruleset, events) {
  const d = ruleset.rules.disasters[kind];
  let popLost = 0;
  let buildingLost = '';
  if (d.popPct !== undefined) {
    popLost = idiv(city.pop * d.popPct, 100);
    if (popLost > 0) city.pop = city.pop - popLost;
  }
  if (d.destroyBuilding === true && city.buildings !== undefined && city.buildings.length > 0) {
    const bi = rollRange(state.rngState, city.buildings.length);
    state.rngState = bi.rngState;
    buildingLost = city.buildings[bi.value];
    const kept = [];
    for (let i = 0; i < city.buildings.length; i++) {
      if (i !== bi.value) kept.push(city.buildings[i]);
    }
    city.buildings = kept;
  }
  if (kind === 'pirate') {
    const player = state.players[city.owner];
    const stolen = idiv(player.gold * ruleset.rules.disasters.pirateGoldPct, 100);
    player.gold = player.gold - stolen;
    city.food = 0;
    city.shields = 0;
  }
  events.push({ type: 'disasterStruck', kind, cityId: city.id, x: city.x, y: city.y, popLost, buildingLost });
}

// once per game turn: each city with an eligible disaster rolls baseChancePct; on a
// hit, ONE eligible disaster (a second roll) strikes. Runs after pollution.process.
function process(state, ruleset, events) {
  if (ruleset.rules.disastersEnabled !== true) return;
  const d = ruleset.rules.disasters;
  if (d === undefined) return;
  const order = state.cityOrder === undefined ? [] : state.cityOrder;
  for (const cityId of order) {
    const city = state.cities[cityId];
    if (city === undefined) continue;
    // eligibility FIRST (pure) — RNG drawn only for a city that could suffer one
    const elig = [];
    for (const kind of DISASTER_ORDER) {
      if (eligible(state, city, kind, ruleset)) elig.push(kind);
    }
    if (elig.length === 0) continue;
    const roll = rollRange(state.rngState, 100);
    state.rngState = roll.rngState;
    if (roll.value >= d.baseChancePct) continue;
    const pick = rollRange(state.rngState, elig.length);
    state.rngState = pick.rngState;
    strike(state, city, elig[pick.value], ruleset, events);
  }
}

export { process };
