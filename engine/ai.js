// The "Expansionist" AI — deliberately simple, no longer dumb:
//   1. research: beeline Monarchy's prerequisites, then lowest-level advances
//   2. government: one revolution, to Monarchy, once the advance is known
//   3. cities: defender first; settlers while scarce (cap 2 + cities/2);
//      saturated cities build the cheapest missing building, then the
//      cheapest available wonder, then garrisons (max 3), then settler-pavers
//   4. settlers: the lead settler (first by id) EXPANDS — walks to the best
//      explored founding site, avoiding known enemies (they die alone); the
//      others IMPROVE the homeland first — road, then irrigate, the worked
//      tiles of nearby own cities (trade is the AI's research lifeline) —
//      and join the expansion when nothing needs improving. Siteless
//      settlers pave the tile they stand on.
//   5. military: march on the nearest known enemy, else explore the fog
// The AI only issues regular commands through applyCommand — it cannot cheat.
// It reads its own `explored` map, so it honors fog of war like a human.
// No RNG: decisions are deterministic, so AI games replay to identical hashes.
import { availableTechs, cityEconOutput, playerIncome } from './tech.js';
import { metOf, relationOf, pairKey } from './diplomacy.js';
import { scoreWarIntent, scorePeaceAccept } from './ai-diplomacy.js';
import { unitsAt, cityAt, sortIds, attackStrength, defenseStrength, bestDefender } from './combat.js';
import { workedTiles, citySpacingOk, candidateTiles, unitObsolete, wonderActive, cityYields, bestDefenderUnit } from './cities.js';
import { hasWaterSource } from './improvements.js';
import { cityMood } from './happiness.js';
import { capitalOf } from './government.js';
import { strategicSnapshot } from '../shared/strategic.js';

const DIR_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIR_VECS = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };

// A40 slice 1: AI regency STANCES. Behavior knobs (NOT ruleset facts — an
// AI-constants precedent), read through the resolved S object in pickCommand.
// A40 identity note (now historical): balanced WAS the pure pre-stance
// identity so the A40 stance window stayed golden-neutral. B13e broke that for
// the attacker knobs — balanced fields an offensive army. B21 turned the
// attacker/scout knobs into rules.json PASSTHROUGHS: the stance fields are now
// PERCENTS (attackerPerCityPct/attackerBasePct/scoutSharePct) scaling a
// rules.json base via attackerPerCityOf/attackerBaseOf/scoutShareOf — the
// marchRadiusPct pattern, so the sim-runner sweeps army size + scouting via
// rulesOverrides. Defaults reproduce the B13e resolved per-stance values.
// Twin: luau/ai.luau STANCES must match byte-for-byte.
// N9b: pbMult = the per-stance PB_MAX multiplier (integer percent — builder 150
// = ×1.5 builds down to weaker paybacks; aggressive 50 = ×0.5), applied to
// BUILD_LEVER.pbMax. wonderDrive = the builder-only capital wonder commitment
// (§2). Both provisional (sim-swept, two-phase close); NO rules.json — behavior
// knobs, twin: luau/ai.luau STANCES must match byte-for-byte.
// #26 archetype-wonders (ruled #2262): wonderAppetite = the standing wonder-build eagerness tier
// (none/low/med/high), keyed to the cascade position in runAiTurn; affinity flags carry the ally's
// Explorer/Diplomat/Visionary nuance the 4-axis leader model can't express (navalAffinity /
// happyGlobalAffinity / lateScienceBias). Behavior knobs, twin: luau/ai.luau STANCES byte-for-byte.
const STANCES = {
  balanced:   { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: null, improveFirst: null, sciRates: false, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100, econReserve: 0, pbMult: 100, escortRadiusPct: 100, govTarget: 'republic-if-safe', wonderAppetite: 'low', navalAffinity: true },
  defensive:  { marchRadiusPct: 0, garrisonAlways2: true,  armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: 'city-walls', improveFirst: null, sciRates: false, attackerPerCityPct: 0,   attackerBasePct: 0,   scoutSharePct: 40, econReserve: 0, pbMult: 125, escortRadiusPct: 150, govTarget: 'republic', wonderAppetite: 'low' },
  aggressive: { marchRadiusPct: 175, garrisonAlways2: false, armyCapPerCity: 6, armyCapBase: 8, settlerBase: 2, settlerDiv: 2, buildPriority: null, improveFirst: null, sciRates: false, attackerPerCityPct: 200, attackerBasePct: 100, scoutSharePct: 150, econReserve: 0, pbMult: 50, escortRadiusPct: 150, govTarget: 'monarchy', wonderAppetite: 'none' },
  science:    { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: 'library', improveFirst: null, sciRates: true, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100, econReserve: 99, pbMult: 125, escortRadiusPct: 60, govTarget: 'democracy', wonderAppetite: 'med', lateScienceBias: true },
  growth:     { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 3, settlerDiv: 1, buildPriority: 'granary', improveFirst: 'irrigate', sciRates: false, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100, econReserve: 99, pbMult: 125, escortRadiusPct: 60, govTarget: 'republic', wonderAppetite: 'low', happyGlobalAffinity: true },
  // stance-mix v1: the defending-builder — survival first (garrisonAlways2 +
  // walls), zero offense (attackerPct 0 removes the treadmill so the reserve is
  // reached after the full garrison), then economy via the high econReserve
  // (wonder-inclusive, capital-concentrated). defendFirst = the normal-block
  // reserve placement (not the at-1 preempt). Ported from the sim-runner lab.
  // N9b: pbMult 150 + wonderDrive — the archetype "MUST build wonders" civ (HIGH appetite).
  builder:    { marchRadiusPct: 80, garrisonAlways2: true, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 3, settlerDiv: 1, buildPriority: null, improveFirst: 'irrigate', sciRates: true, attackerPerCityPct: 0, attackerBasePct: 0, scoutSharePct: 80, econReserve: 99, pbMult: 150, wonderDrive: true, defendFirst: true, escortRadiusPct: 80, govTarget: 'republic', wonderAppetite: 'high' }
};

// #26 stance -> preferred wonder ids, translated from the ally 22-wonder personality table
// (specs/ally-deliverables-2026-07-22-wonders.md) via the stance bridge (Builder+Industrialist->
// builder, Steward+Diplomat->growth, Scientist+Visionary->science, Explorer->balanced,
// Conqueror->aggressive). Global-unlock wonders (apollo/manhattan) are NEVER standing targets —
// they keep their own never-unless gates. Behavior knob, twin byte-exact.
const WONDER_AFFINITY = {
  builder:    ['pyramids', 'shakespeare-s-theatre', 'hoover-dam', 'leonardo-s-workshop'],
  growth:     ['hanging-gardens', 'michelangelo-s-chapel', 'women-s-suffrage', 'cure-for-cancer', 'oracle', 'j-s-bach-s-cathedral'],
  science:    ['great-library', 'copernicus-observatory', 'isaac-newton-s-college', 'darwin-s-voyage', 'seti-program'],
  balanced:   ['colossus', 'lighthouse', 'magellan-s-expedition'],
  aggressive: ['great-wall'],
  defensive:  ['great-wall']
};
// global-unlock wonders: excluded from standing appetite (a premature Apollo/Manhattan gifts the
// path/nukes to rivals) — Apollo via the committed-space override, Manhattan via its own gate.
const GLOBAL_UNLOCK_WONDERS = { 'apollo-program': true, 'manhattan-project': true };

// N9b build-priority lever constants (provisional — sim-swept, pinned in the
// two-phase close; NOT rules.json). pbMax = payback ceiling in turns before the
// stance pbMult; wonderMinShields = the builder wonder-drive's shields/turn gate.
// #26 wonderMedBuildings = core buildings a MED-appetite (science) drive city builds before it
// starts wonders; wonderLowShields = the appetite-scaled SHIELD THRESHOLD a LOW-appetite drive
// city needs to start a wonder at the econ position (ruled #2262: threshold, not a chance roll).
// #30 armyTargetCap = the ABSOLUTE ceiling on the standing-attacker target (behavior knob, not
// rules.json — no rulesetHash stamp). armyTarget = cities*attackerPerCity+base scaled unbounded
// with empire size (seed-6 1002 units); the cap bounds new growth. Sweepable (the 25-seed judge
// tunes it). disbandOverBy = how far OVER the cap a civ must be before the at-peace disband valve
// drains one obsolete attacker/turn (hysteresis so it doesn't fight the build at the boundary).
const BUILD_LEVER = { pbMax: 40, wonderMinShields: 5, wonderMedBuildings: 3, wonderLowShields: 8, wonderLowCities: 6, armyTargetCap: 50, disbandOverBy: 4, invasionStageRadius: 6, upgradeGoldReserve: 40 };

// Government re-eval (specs/government-reeval.md): the AI advances government by
// STANCE instead of stopping at Monarchy. Adoption rank (AI preference ordering,
// a behavior knob like STANCES — NOT a ruleset fact): a revolt only ever moves
// UP this ladder, so there is no republic<->monarchy thrash. Democracy is
// DEFERRED to phase 6 (senate/war constraints, docs/14) — no stance targets it.
const GOV_RANK = { despotism: 0, anarchy: 0, monarchy: 1, communism: 1, republic: 2, democracy: 3 };
function govRank(g) { return GOV_RANK[g] === undefined ? 0 : GOV_RANK[g]; }
// B13f: the AI's march-vs-explore radius. The BASE lives in data/rules.json
// (exploreMarchRadius) so the sim-runner can SWEEP contact behavior via
// rulesOverrides — the war-lab "same-continent civs never meet" knob. Each
// stance scales it by marchRadiusPct (balanced 100% = the historical 8;
// defensive 0% stays "never march" under any sweep; aggressive 175% = 14).
// Identity by default: idiv(8 * pct, 100) reproduces the old literals.
function marchRadiusOf(ruleset, S) {
  return idiv(ruleset.rules.exploreMarchRadius * S.marchRadiusPct, 100);
}
// B21(a): the offensive-army target is a rules.json BASE scaled by the stance
// pct — same passthrough shape as marchRadiusOf, so the sim-runner sweeps the
// standing-army size via rulesOverrides. Defaults reproduce the B13e per-stance
// values (attackerPerCity 1x{100,0,200,100,100}=1/0/2/1/1; attackerBase
// 2x{0,0,100,0,0}=0/0/2/0/0).
function attackerPerCityOf(ruleset, S) {
  return idiv(ruleset.rules.attackerPerCity * S.attackerPerCityPct, 100);
}
function attackerBaseOf(ruleset, S) {
  return idiv(ruleset.rules.attackerBase * S.attackerBasePct, 100);
}
// B21(d): the share of a civ's military that scouts instead of garrisoning —
// rules.aiScoutSharePct base scaled by the stance pct (balanced 100 = the base).
function scoutShareOf(ruleset, S) {
  return idiv(ruleset.rules.aiScoutSharePct * S.scoutSharePct, 100);
}
function stanceOf(stance) {
  return (stance !== undefined && STANCES[stance] !== undefined) ? STANCES[stance] : STANCES.balanced;
}
// Stance build preference: a specific building if it is missing + tech-known,
// else the historical cheapest-missing pick. balanced (buildPriority null)
// short-circuits to nextBuilding — byte-identical.
function stanceBuilding(city, me, ruleset, S) {
  if (S.buildPriority !== null) {
    const id = S.buildPriority;
    const def = ruleset.buildings[id];
    const missing = city.buildings === undefined || city.buildings.indexOf(id) === -1;
    if (def !== undefined && missing && (def.tech === '' || me.techs.indexOf(def.tech) !== -1)) return id;
  }
  return nextBuilding(city, me, ruleset);
}

function idiv(a, b) {
  return Math.floor(a / b);
}

function wrapDx(map, from, to) {
  let dx = to - from;
  if (map.wrapX) {
    if (dx > Math.floor(map.width / 2)) dx -= map.width;
    if (dx < -Math.floor(map.width / 2)) dx += map.width;
  }
  return dx;
}

function chebyshev(map, ax, ay, bx, by) {
  const dx = Math.abs(wrapDx(map, ax, bx));
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

function sign(n) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function dirToward(map, fromX, fromY, toX, toY) {
  const dx = sign(wrapDx(map, fromX, toX));
  const dy = sign(toY - fromY);
  if (dx === 0 && dy === 0) return null;
  for (const key of DIR_KEYS) {
    if (DIR_VECS[key][0] === dx && DIR_VECS[key][1] === dy) return key;
  }
  return null;
}

function isExplored(me, map, x, y) {
  if (!me.explored) return true; // omniscient test states
  return me.explored[y * map.width + x] === 1;
}

// Founding terrain (Civ 1-flavored): the fertile opens always qualify,
// hills for defense, and a river redeems most other land. Never arctic or
// mountains. Plus the 3-tile spacing from every existing city.
const FOUND_TERRAIN = { grassland: true, plains: true, hills: true };
const NEVER_FOUND = { arctic: true, mountains: true };

function canFoundAt(state, x, y, ruleset) {
  const tile = state.map.tiles[y * state.map.width + x];
  if (ruleset.terrain.terrains[tile.t].domain !== 'land') return false;
  if (NEVER_FOUND[tile.t]) return false;
  if (!FOUND_TERRAIN[tile.t] && tile.river !== true) return false;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && !citySpacingOk(state.map, x, y, c.x, c.y, ruleset.rules)) return false;
  }
  return true;
}

function goodCitySpot(state, unit, ruleset) {
  return canFoundAt(state, unit.x, unit.y, ruleset);
}

// Any KNOWN enemy unit within `radius` of (x, y)? Settlers keep away —
// order-independent boolean, so plain key iteration is fine.
function enemyNear(state, me, playerId, x, y, radius) {
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId) continue;
    if (!isExplored(me, state.map, u.x, u.y)) continue;
    if (chebyshev(state.map, x, y, u.x, u.y) <= radius) return true;
  }
  return false;
}

// Government re-eval: is the civ safe to bear Republic's away-only war
// unhappiness — no VISIBLE enemy unit within the threat radius of any own city
// (fog-honest, reuses enemyNear). Only consulted for the 'republic-if-safe'
// stance target when Republic is already known (bounds the per-turn cost).
function govSafe(state, playerId, ruleset) {
  const me = state.players[playerId];
  const radius = ruleset.rules.threatRadius;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.owner === playerId && enemyNear(state, me, playerId, c.x, c.y, radius)) return false;
  }
  return true;
}

// The government this civ should hold now (specs/government-reeval.md): the best
// government it has the tech for toward its stance's govTarget. 'republic-if-safe'
// only reaches Republic when govSafe; everything else is unconditional. Returns a
// government id (never anarchy); the caller applies the monotonic-rank revolt gate.
function pickGovernment(state, playerId, ruleset, S) {
  const me = state.players[playerId];
  const target = S.govTarget === undefined ? 'monarchy' : S.govTarget;
  const hasMonarchy = me.techs.indexOf('monarchy') !== -1;
  const hasRepublic = me.techs.indexOf('republic') !== -1;
  // #36 N1b: DEMOCRACY is the peacetime science/economy peak (rate cap 100) but warUnhappy 2 wrecks a
  // threatened empire (Civ-authentic). A 'democracy' target adopts it ONLY when SAFE (no enemy near a
  // city — govSafe, the war-state proxy the no-diplomacy soak needs; formal relationOf defaults to war
  // so it can't gate here); otherwise it falls through to the republic cascade (still an upgrade). Era
  // is implicit — democracy's tech is late, so N1a's beeline only reaches it in the later eras.
  if (target === 'democracy') {
    if (me.techs.indexOf('democracy') !== -1 && govSafe(state, playerId, ruleset)) return 'democracy';
  }
  if (target === 'republic' || target === 'republic-if-safe' || target === 'democracy') {
    if (hasRepublic && (target === 'republic' || target === 'democracy' || govSafe(state, playerId, ruleset))) return 'republic';
  }
  return hasMonarchy ? 'monarchy' : 'despotism';
}

// #36 N1a: the tech that unlocks the stance's TARGET government — the gov-beeline goal so the AI
// actually researches its way to republic/democracy instead of stalling at monarchy (0/N ever
// reached republic — the measured pathology). 'republic-if-safe' targets republic's tech (the
// safety gate is applied at ADOPTION by pickGovernment, not at research). '' when the target is
// despotism/monarchy (no higher tech to chase) or the ruleset omits it.
function govTargetTech(ruleset, S) {
  let target = S.govTarget === undefined ? 'monarchy' : S.govTarget;
  if (target === 'republic-if-safe') target = 'republic';
  const gov = ruleset.governments[target];
  if (gov === undefined || gov.tech === undefined) return '';
  return gov.tech;
}

// A step toward (tx, ty) that a lone settler can survive: land only, never
// onto or adjacent to a known enemy. Null = no safe step (hold position).
function safeDirToward(state, me, playerId, unit, tx, ty, ruleset) {
  const map = state.map;
  let best = null, bestD = chebyshev(map, unit.x, unit.y, tx, ty);
  for (const key of DIR_KEYS) {
    let nx = unit.x + DIR_VECS[key][0];
    if (nx < 0 || nx >= map.width) {
      if (!map.wrapX) continue;
      nx = ((nx % map.width) + map.width) % map.width;
    }
    const ny = unit.y + DIR_VECS[key][1];
    if (ny < 1 || ny >= map.height - 1) continue;
    if (ruleset.terrain.terrains[map.tiles[ny * map.width + nx].t].domain !== 'land') continue;
    let hostile = false;
    for (const u of unitsAt(state, nx, ny)) {
      if (u.owner !== playerId) hostile = true;
    }
    if (hostile) continue;
    if (enemyNear(state, me, playerId, nx, ny, 1)) continue;
    const d = chebyshev(map, nx, ny, tx, ty);
    if (d < bestD) { bestD = d; best = key; }
  }
  return best;
}

// §12: a bounded land-only BFS from the settler to a SPECIFIC target (tx, ty),
// returning the first step of the shortest SAFE path — routes AROUND concave
// coasts / ocean inlets where safeDirToward's greedy chebyshev dead-ends. Same
// passability as safeDirToward (land, never onto/adjacent a known enemy);
// bounded by rules.settlerPathRadius so it is not a full-map search per settler.
// Deterministic (DIR_KEYS order, first-found shortest = BFS layer order). Null =
// no safe land path within the bound (caller falls back to greedy, then hold).
function bfsStepToward(state, me, playerId, unit, tx, ty, ruleset) {
  const map = state.map;
  const { width, height, wrapX } = map;
  const maxR = ruleset.rules.settlerPathRadius === undefined ? 12 : ruleset.rules.settlerPathRadius;
  const visited = {};
  visited[unit.y * width + unit.x] = true;
  const queue = [{ x: unit.x, y: unit.y, first: null }];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi]; qi = qi + 1;
    for (const key of DIR_KEYS) {
      let nx = cur.x + DIR_VECS[key][0];
      if (nx < 0 || nx >= width) { if (!wrapX) continue; nx = ((nx % width) + width) % width; }
      const ny = cur.y + DIR_VECS[key][1];
      if (ny < 1 || ny >= height - 1) continue;
      const idx = ny * width + nx;
      if (visited[idx] === true) continue;
      visited[idx] = true;
      if (chebyshev(map, unit.x, unit.y, nx, ny) > maxR) continue;
      const first = cur.first === null ? key : cur.first;
      if (nx === tx && ny === ty) return first; // reached the target — commit its first step
      if (ruleset.terrain.terrains[map.tiles[idx].t].domain !== 'land') continue;
      let hostile = false;
      for (const u of unitsAt(state, nx, ny)) { if (u.owner !== playerId) hostile = true; }
      if (hostile) continue;
      if (enemyNear(state, me, playerId, nx, ny, 1)) continue;
      queue.push({ x: nx, y: ny, first });
    }
  }
  return null;
}

// naval-loop S3 (#2195 Q3): a bounded SEA BFS for a carrier — the first step (DIR key)
// toward a SEA tile ADJACENT to the target LAND (tx,ty) = the landfall. Expands only
// through sea, skips hostile-occupied tiles, bounded by rules.seaPathRadius (omit-safe
// default 30 until the knob lands). Sea units use the full height (no y in 1..H-2 clamp,
// unlike land settlers). null when no bounded sea path reaches the landfall. Both engines.
// naval-presence M3 (#2201 Q3): is (x,y) adjacent to a LAND tile — a safe harbour for a
// coastal-restricted (openSeaLoss) hull? Mirrors engine/naval.js adjacentToLand exactly,
// so the AI's pathing agrees with the loss rule (a trireme never routes where it would sink).
function adjacentToLand(state, x, y, ruleset) {
  const W = state.map.width, H = state.map.height;
  for (const key of DIR_KEYS) {
    let nx = x + DIR_VECS[key][0];
    if (nx < 0 || nx >= W) { if (state.map.wrapX !== true) continue; nx = ((nx % W) + W) % W; }
    const ny = y + DIR_VECS[key][1];
    if (ny < 0 || ny >= H) continue;
    if (ruleset.terrain.terrains[state.map.tiles[ny * W + nx].t].domain === 'land') return true;
  }
  return false;
}

function seaStepToward(state, ship, tx, ty, ruleset, forceCoastal) {
  const map = state.map;
  const { width, height, wrapX } = map;
  const maxR = ruleset.rules.seaPathRadius === undefined ? 30 : ruleset.rules.seaPathRadius;
  // M3 (#2201 Q3): a coastal-restricted hull (openSeaLoss = the trireme) may only traverse
  // LAND-ADJACENT sea — it never routes into open ocean where the loss rule would sink it.
  // Ocean-capable hulls (sail+) cross open water freely. forceCoastal (M4 needsOcean probe)
  // simulates a trireme from a bare position — then ship.type is not read.
  const coastal = forceCoastal === true || ruleset.units[ship.type].openSeaLoss === true;
  const visited = {};
  visited[ship.y * width + ship.x] = true;
  const queue = [{ x: ship.x, y: ship.y, first: null }];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi]; qi = qi + 1;
    for (const key of DIR_KEYS) {
      let nx = cur.x + DIR_VECS[key][0];
      if (nx < 0 || nx >= width) { if (!wrapX) continue; nx = ((nx % width) + width) % width; }
      const ny = cur.y + DIR_VECS[key][1];
      if (ny < 0 || ny >= height) continue;
      const idx = ny * width + nx;
      if (visited[idx] === true) continue;
      visited[idx] = true;
      if (chebyshev(map, ship.x, ship.y, nx, ny) > maxR) continue;
      if (ruleset.terrain.terrains[map.tiles[idx].t].domain !== 'sea') continue; // sail through sea only
      const first = cur.first === null ? key : cur.first;
      if (chebyshev(map, nx, ny, tx, ty) <= 1) return first; // a sea tile adjacent to the target = landfall
      if (coastal && !adjacentToLand(state, nx, ny, ruleset)) continue; // M3: hug the coast
      let hostile = false;
      for (const u of unitsAt(state, nx, ny)) { if (u.owner !== ship.owner) hostile = true; }
      if (hostile) continue;
      queue.push({ x: nx, y: ny, first });
    }
  }
  return null;
}

// naval-loop S2: the nearest own CARRIER (sea unit with `transport` capacity + a FREE
// cargo slot) to a unit — chebyshev-nearest, id tie-break (deterministic). The carrier a
// waiting settler routes to and boards. null when the civ fields no boardable carrier.
function carrierFreeSlots(state, ship, ruleset) {
  const cap = ruleset.units[ship.type].transport;
  if (cap === undefined || cap <= 0) return 0;
  let load = 0;
  for (const uid of Object.keys(state.units)) { if (state.units[uid].aboard === ship.id) load = load + 1; }
  return cap - load;
}
function nearestOwnCarrier(state, unit, playerId, ruleset) {
  let best = null, bestD = -1;
  for (const uid of sortIds(Object.keys(state.units))) {
    const s = state.units[uid];
    if (s.owner !== playerId || s.aboard !== undefined) continue;
    if (ruleset.units[s.type].domain !== 'sea') continue;
    if (carrierFreeSlots(state, s, ruleset) <= 0) continue;
    const d = chebyshev(state.map, unit.x, unit.y, s.x, s.y);
    if (best === null || d < bestD) { best = s; bestD = d; }
  }
  return best;
}

// naval-loop S3: how many units are aboard a ship (its USED cargo slots). >0 = the
// carrier is loaded and should sail its cargo (not scout). Count is order-independent.
function carrierCargo(state, shipId) {
  let n = 0;
  for (const uid of Object.keys(state.units)) { if (state.units[uid].aboard === shipId) n = n + 1; }
  return n;
}

// naval-loop S3: the union of every land-component the civ already holds a city on —
// the "home" the overseas drive sails AWAY from (a site inside it is land-reachable,
// never a crossing). Deterministic set of tile indices; a city on an already-flooded
// continent is skipped (union is order-free).
function homeContinents(state, playerId, ruleset) {
  const W = state.map.width;
  const home = {};
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c === undefined || c.owner !== playerId) continue;
    if (home[c.y * W + c.x] === true) continue;
    const comp = landComponent(state, c.x, c.y, ruleset);
    for (const k of Object.keys(comp)) home[k] = true;
  }
  return home;
}

// naval-loop S3: the nearest EXPLORED foundable land tile that is NOT on any home
// continent — the overseas settlement target a loaded carrier sails toward and its
// cargo founds. Deterministic: nearest chebyshev, tile-index tie-break. null = none known.
function nearestOverseasSite(state, sx, sy, home, me, ruleset) {
  const map = state.map;
  let best = null, bestD = -1, bestIdx = -1;
  for (let y = 0; y < map.height; y = y + 1) {
    for (let x = 0; x < map.width; x = x + 1) {
      const idx = y * map.width + x;
      if (home[idx] === true) continue;
      if (!isExplored(me, map, x, y)) continue;
      if (!canFoundAt(state, x, y, ruleset)) continue;
      const d = chebyshev(map, sx, sy, x, y);
      if (best === null || d < bestD || (d === bestD && idx < bestIdx)) {
        best = { x, y }; bestD = d; bestIdx = idx;
      }
    }
  }
  return best;
}

// naval-loop S3: for an EMBARKED settler, the DIR to step ashore onto (disembark) —
// the first DIR_KEY hitting land not held by a rival (prefer a foundable tile, else any
// safe land). null = no adjacent land, keep sailing. Deterministic DIR_KEYS order.
function disembarkDir(state, unit, playerId, ruleset) {
  const map = state.map;
  let landDir = null;
  for (const key of DIR_KEYS) {
    let nx = unit.x + DIR_VECS[key][0];
    if (nx < 0 || nx >= map.width) { if (map.wrapX !== true) continue; nx = ((nx % map.width) + map.width) % map.width; }
    const ny = unit.y + DIR_VECS[key][1];
    if (ny < 0 || ny >= map.height) continue;
    if (ruleset.terrain.terrains[map.tiles[ny * map.width + nx].t].domain !== 'land') continue;
    const c = cityAt(state, nx, ny);
    if (c && c.owner !== playerId) continue;
    let enemy = false;
    for (const u of unitsAt(state, nx, ny)) { if (u.owner !== playerId) enemy = true; }
    if (enemy) continue;
    if (canFoundAt(state, nx, ny, ruleset)) return key;
    if (landDir === null) landDir = key;
  }
  return landDir;
}

// naval-presence perf memo (#2201): bestCitySite (siteScan) is expensive, and the M1 build
// gate + M2b ferry both need per-settler site facts. Compute them ONCE per AI turn over the
// civ's settlers and cache in `done` (persists across the turn's pickCommand calls). `sat` =
// the civ has an ISLAND-SATURATED settler — no reachable land site (bestCitySite null: own
// continent full, no overseas site known yet) OR the best site is already overseas; this is
// the M1 gate (Q1) and fires WITHOUT prior exploration, breaking the ships->explore->see->
// board cycle at its first link. `wards` = the OVERSEAS-BLOCKED settlers (site across water)
// a carrier ferries (M2b). Deterministic (sorted ids; wards keep that order for tie-breaks).
// naval-presence M1-gate (#2209b): does this civ have a real overseas OPPORTUNITY — an
// unexplored-SEA FRONTIER (more map to find by water), else an EXPLORED overseas foundable
// site? Only then is a bootstrap carrier worth building; on a fully-charted single continent
// both are false -> M1 stays silent (no useless carrier). Frontier checked FIRST (no home
// flood-fill), early-out on the first hit — cheap on archipelago. Deterministic.
function hasNavalOpportunity(state, playerId, me, ruleset) {
  const map = state.map;
  for (let y = 0; y < map.height; y = y + 1) {
    for (let x = 0; x < map.width; x = x + 1) {
      if (!isExplored(me, map, x, y)) continue;
      if (ruleset.terrain.terrains[map.tiles[y * map.width + x].t].domain !== 'sea') continue;
      for (const key of DIR_KEYS) {
        let nx = x + DIR_VECS[key][0];
        const ny = y + DIR_VECS[key][1];
        if (ny < 0 || ny >= map.height) continue;
        if (nx < 0 || nx >= map.width) { if (map.wrapX !== true) continue; nx = ((nx % map.width) + map.width) % map.width; }
        if (!isExplored(me, map, nx, ny)) return true; // a sea frontier
      }
    }
  }
  const home = homeContinents(state, playerId, ruleset); // no frontier -> pay the flood-fill once
  for (let y = 0; y < map.height; y = y + 1) {
    for (let x = 0; x < map.width; x = x + 1) {
      const idx = y * map.width + x;
      if (!isExplored(me, map, x, y)) continue;
      if (ruleset.terrain.terrains[map.tiles[idx].t].domain !== 'land') continue;
      if (home[idx] !== true && canFoundAt(state, x, y, ruleset)) return true; // an overseas site
    }
  }
  return false;
}

// naval-presence M4 (#2201 Q4): does this civ's overseas opportunity need an OCEAN hull —
// i.e. the nearest known overseas site has NO coastal-hug (trireme) path from the civ's coast
// (it is across WIDE ocean, a "no narrow-strait site")? This is the ruled precise gate for the
// navigation beeline: fire it only when a trireme cannot reach — a close-island civ keeps its
// trireme. Lazy: called only inside the M4 trigger for a saturated naval civ lacking the ocean
// tech (a small set), once per turn via the research block. Deterministic.
function needsOcean(state, playerId, me, ruleset) {
  const map = state.map;
  let seaX = -1, seaY = -1;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c === undefined || c.owner !== playerId) continue;
    for (const key of DIR_KEYS) {
      let nx = c.x + DIR_VECS[key][0];
      if (nx < 0 || nx >= map.width) { if (map.wrapX !== true) continue; nx = ((nx % map.width) + map.width) % map.width; }
      const ny = c.y + DIR_VECS[key][1];
      if (ny < 0 || ny >= map.height) continue;
      if (ruleset.terrain.terrains[map.tiles[ny * map.width + nx].t].domain === 'sea') { seaX = nx; seaY = ny; break; }
    }
    if (seaX !== -1) break; // the civ's first coastal city's launch point
  }
  if (seaX === -1) return false; // no coastal city — not a naval-expansion case
  const home = homeContinents(state, playerId, ruleset);
  const site = nearestOverseasSite(state, seaX, seaY, home, me, ruleset);
  if (site !== null) {
    // a KNOWN overseas site: need an ocean hull only if NO coastal-hug (trireme) path reaches it
    // (it is across wide ocean). A close-island civ with a reachable near site keeps its trireme.
    const proxy = { owner: playerId, x: seaX, y: seaY }; // a trireme at the launch point
    return seaStepToward(state, proxy, site.x, site.y, ruleset, true) === null;
  }
  // NO known overseas site (the wide-gap bootstrap — the far island is unexplored because a
  // coast-hugging trireme can't cross to reveal it): an ocean hull is worth it iff there is
  // unexplored SEA to cross (a sail explores open ocean and finds the far land a trireme cannot).
  return hasNavalOpportunity(state, playerId, me, ruleset);
}

function computeNavalFacts(state, playerId, ruleset) {
  const me = state.players[playerId];
  let sat = false;
  const wards = [];
  for (const uid of sortIds(Object.keys(state.units))) {
    const u = state.units[uid];
    if (u.owner !== playerId || u.type !== 'settlers' || u.aboard !== undefined) continue;
    const site = bestCitySite(state, u, playerId, ruleset);
    if (site === null) { sat = true; continue; }
    if (isOverseasSite(state, u.x, u.y, site.x, site.y, ruleset)) { sat = true; wards.push({ x: u.x, y: u.y }); }
  }
  // opportunity gates M1: computed only for a SATURATED civ (M1's precondition). wards already
  // imply an opportunity; else scan (frontier-first).
  let opportunity = wards.length > 0;
  if (sat && !opportunity) opportunity = hasNavalOpportunity(state, playerId, me, ruleset);
  return { sat, wards, opportunity };
}

// memoized accessor: compute once per turn, reuse for every city/ship of the civ.
function navalFacts(done, state, playerId, ruleset) {
  if (done.naval === undefined) done.naval = computeNavalFacts(state, playerId, ruleset);
  return done.naval;
}

// M2b: the nearest overseas-blocked settler (from the memoized ward list) to a ferry —
// chebyshev nearest, list order (sorted ids) breaks ties. null when the civ has no ferry job.
function nearestWard(wards, state, ship) {
  let best = null, bestD = -1;
  for (const w of wards) {
    const d = chebyshev(state.map, ship.x, ship.y, w.x, w.y);
    if (best === null || d < bestD) { best = w; bestD = d; }
  }
  return best;
}

// naval-presence M1: does the civ already field a carrier with a free cargo slot? When
// it does, the saturated settler boards that instead of a city building another.
function hasFreeCarrier(state, playerId, ruleset) {
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner !== playerId || u.aboard !== undefined) continue;
    if (ruleset.units[u.type].domain !== 'sea') continue;
    if (carrierFreeSlots(state, u, ruleset) > 0) return true;
  }
  return false;
}

// #35 naval-invade-B: the nearest OVERSEAS enemy city this civ is at WAR with and has
// EXPLORED — the invasion target. Overseas = on a landmass none of the civ's own cities sit
// on (homeContinents). Fog-honest (explored cities only), existing-war only (relationOf
// defaults to 'war', so a peace treaty opts a rival out — the at-peace control). Deterministic:
// nearest chebyshev to the civ's capital, city-id tie-break. null = no overseas war target.
function invasionTargetCity(state, playerId, me, ruleset, home) {
  const cap = capitalOf(state, playerId, ruleset);
  if (cap === null || cap === undefined) return null; // no city -> no invasion base
  const W = state.map.width;
  let best = null, bestD = -1, bestId = '';
  for (const cid of sortIds(state.cityOrder || [])) {
    const c = state.cities[cid];
    if (!c || c.owner === playerId || c.owner === 'barb') continue;
    if (!isExplored(me, state.map, c.x, c.y)) continue;
    if (relationOf(state, playerId, c.owner) !== 'war') continue;
    if (home[c.y * W + c.x] === true) continue; // on a home continent = a land march, not an invasion
    const d = chebyshev(state.map, cap.x, cap.y, c.x, c.y);
    if (best === null || d < bestD || (d === bestD && cid < bestId)) { best = c; bestD = d; bestId = cid; }
  }
  return best;
}

// #35: the summed DEFENSE strength of the enemy garrison the invader can SEE on the target
// city tile (fog-honest: the city is explored, so its current occupants are "known" — the
// nearestKnownEnemy convention). Walls/terrain/fortify-aware (defenseStrength), so the launch
// heuristic already respects City-Walls (the §2b over-succeed guard). 0 for an undefended city
// (a walk-in capture: 3:1 vs 0 always passes). Order-free.
function knownDefenseSum(state, city, ruleset) {
  let sum = 0;
  for (const u of unitsAt(state, city.x, city.y)) {
    if (u.owner === city.owner && ruleset.units[u.type].defense > 0) sum = sum + defenseStrength(state, u, ruleset);
  }
  return sum;
}

// #35: how many MILITARY units (attack>0) are aboard a ship — >0 marks an invasion carrier
// (routes to the target city, not a settlement site). Order-free.
function militaryCargo(state, shipId, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.aboard === shipId && ruleset.units[u.type].attack > 0) n = n + 1;
  }
  return n;
}

// #35: the summed ATTACK strength of a carrier's military cargo — the launch-heuristic
// numerator (stackAttackSum). Order-free.
function cargoAttackSum(state, shipId, ruleset) {
  let sum = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.aboard === shipId && ruleset.units[u.type].attack > 0) sum = sum + attackStrength(u, ruleset);
  }
  return sum;
}

// #35: the nearest own SAFE land ATTACKER (attack>defense, no enemy within 2, not aboard) to a
// ship, within `radius` — the invasion payload an empty carrier stages beside (a military mirror
// of the settler ward). Deterministic (sorted ids). null = no boardable invader nearby.
function nearestBoardableAttacker(state, ship, playerId, ruleset, radius) {
  const me = state.players[playerId];
  let best = null, bestD = -1;
  for (const uid of sortIds(Object.keys(state.units))) {
    const u = state.units[uid];
    if (u.owner !== playerId || u.aboard !== undefined) continue;
    const def = ruleset.units[u.type];
    if (def.domain !== 'land' || def.attack <= def.defense) continue;
    if (enemyNear(state, me, playerId, u.x, u.y, 2)) continue;
    const d = chebyshev(state.map, ship.x, ship.y, u.x, u.y);
    if (d > radius) continue;
    if (best === null || d < bestD) { best = u; bestD = d; }
  }
  return best;
}

// #35: is any enemy unit adjacent to (x,y)? A tile with an adjacent enemy is ZOC-locked FROM a
// ship (an adjacent->adjacent step the engine rejects); a "clear" tile can always be disembarked
// onto (adjacent->non-adjacent). Uses true positions (ZOC is not fog-gated). DIR_KEYS scan.
function enemyAdjacentTile(state, x, y, playerId) {
  const map = state.map;
  for (const key of DIR_KEYS) {
    let nx = x + DIR_VECS[key][0];
    if (nx < 0 || nx >= map.width) { if (map.wrapX !== true) continue; nx = ((nx % map.width) + map.width) % map.width; }
    const ny = y + DIR_VECS[key][1];
    if (ny < 0 || ny >= map.height) continue;
    for (const u of unitsAt(state, nx, ny)) if (u.owner !== playerId) return true;
  }
  return false;
}

// #35: for a disembarking invader, the DIR onto the target's CONTINENT (comp) — a reachable land
// tile, not a rival city, not enemy-occupied. PREFERS a ZOC-clear tile (no adjacent enemy) so the
// ship->land step is legal (a garrison-adjacent tile is ZOC-locked from the ship; the engine
// forbids amphibious assault, so the invader lands on open ground and marches in). Tie-break:
// clear-first, then nearest to the target. null = no landfall (keep riding). Deterministic.
function invadeDisembarkDir(state, unit, playerId, target, comp, ruleset) {
  const map = state.map;
  let bestKey = null, bestClear = false, bestD = 9999;
  for (const key of DIR_KEYS) {
    let nx = unit.x + DIR_VECS[key][0];
    if (nx < 0 || nx >= map.width) { if (map.wrapX !== true) continue; nx = ((nx % map.width) + map.width) % map.width; }
    const ny = unit.y + DIR_VECS[key][1];
    if (ny < 0 || ny >= map.height) continue;
    if (comp[ny * map.width + nx] !== true) continue; // the target's continent only
    const c = cityAt(state, nx, ny);
    if (c && c.owner !== playerId) continue; // never "disembark" onto a rival city (the on-land assault handles it)
    let enemy = false;
    for (const u of unitsAt(state, nx, ny)) if (u.owner !== playerId) enemy = true;
    if (enemy) continue;
    const clear = !enemyAdjacentTile(state, nx, ny, playerId);
    const d = chebyshev(map, nx, ny, target.x, target.y);
    if (bestKey === null || (clear && !bestClear) || (clear === bestClear && d < bestD)) {
      bestKey = key; bestClear = clear; bestD = d;
    }
  }
  return bestKey;
}

// #35: the memoized per-turn invasion plan for a civ — the target city, its continent tile-set,
// and the KNOWN defense sum (the launch-gate denominator). Cheap early-out (no sea unit -> no
// invasion) so landlocked civs never pay the flood-fills. Computed once per turn (done cache).
function computeInvasion(state, playerId, ruleset) {
  let hasSea = false;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId && ruleset.units[u.type].domain === 'sea') { hasSea = true; break; }
  }
  if (!hasSea) return { target: null, targetComp: {}, defSum: 0 };
  const me = state.players[playerId];
  const home = homeContinents(state, playerId, ruleset);
  const target = invasionTargetCity(state, playerId, me, ruleset, home);
  if (target === null) return { target: null, targetComp: {}, defSum: 0 };
  const targetComp = landComponent(state, target.x, target.y, ruleset);
  return { target, targetComp, defSum: knownDefenseSum(state, target, ruleset) };
}
function invasionFacts(done, state, playerId, ruleset) {
  if (done.invasion === undefined) done.invasion = computeInvasion(state, playerId, ruleset);
  return done.invasion;
}

// This settler's rank among the civ's settlers (sorted ids): rank 0 is the
// EXPANDER, the rest are homeland IMPROVERS first. Deterministic.
function settlerRank(state, playerId, uid) {
  let rank = 0;
  for (const id of sortIds(Object.keys(state.units))) {
    const u = state.units[id];
    if (u.owner !== playerId || u.type !== 'settlers') continue;
    if (id === uid) return rank;
    rank++;
  }
  return 0;
}

// The nearest unimproved WORKED tile of a nearby own city: roads first
// (trade -> research), then irrigation where legal. {x, y, work} or null.
function bestImprovementJob(state, unit, playerId, ruleset, improveFirst) {
  const map = state.map;
  const me = state.players[playerId];
  const knowsRail = me.techs.indexOf(ruleset.rules.railroadTech) !== -1;
  let best = null, bestD = 9999;
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    if (chebyshev(map, unit.x, unit.y, city.x, city.y) > 6) continue;
    for (const w of workedTiles(state, city, ruleset)) {
      if (cityAt(state, w.x, w.y)) continue; // the center works itself
      const tile = map.tiles[w.y * map.width + w.x];
      const terrain = ruleset.terrain.terrains[tile.t];
      if (terrain.domain !== 'land') continue;
      const canIrrigate = tile.irrigation !== true && tile.mine !== true
        && terrain.irrigate !== undefined && hasWaterSource(state, w.x, w.y);
      // B13d: a mine path — shield terrains (hills/mountains/desert have
      // terrain.mine) get mined; prefer a mine over irrigation only where it
      // yields MORE shields than the irrigation gives food (so hills mine,
      // desert still irrigates for scarce food, grassland/plains irrigate).
      const canMine = tile.irrigation !== true && tile.mine !== true
        && terrain.mine !== undefined;
      const mineBetter = canMine && (!canIrrigate || terrain.mine.shields > terrain.irrigate.food);
      // B13b: once Railroad is known, upgrade a finished road to rail (needs a
      // road first — startWork enforces it too).
      const canRail = knowsRail && tile.road === true && tile.railroad !== true;
      let work = null;
      // A40 growth stance irrigates first; balanced (improveFirst undefined)
      // keeps roads-first — the trade-that-funds-research order. B13: after the
      // road, take the terrain yield (mine or irrigate), then rail-upgrade.
      if (improveFirst === 'irrigate' && canIrrigate) work = 'irrigate';
      else if (tile.road !== true) work = 'road';
      else if (mineBetter) work = 'mine';
      else if (canIrrigate) work = 'irrigate';
      else if (canRail) work = 'railroad';
      if (work === null) continue;
      let hostile = false;
      for (const u of unitsAt(state, w.x, w.y)) {
        if (u.owner !== playerId) hostile = true;
      }
      if (hostile) continue;
      const d = chebyshev(map, unit.x, unit.y, w.x, w.y);
      if (d < bestD) { bestD = d; best = { x: w.x, y: w.y, work }; }
    }
  }
  return best;
}

// The best founding site within an explored radius — settlers WALK to a
// real spot instead of paving the moment the tile underfoot disqualifies.
// Deterministic: fixed scan order, strict > keeps the first of any tie.
function siteScan(state, unit, me, ruleset, radius, distPenalty) {
  const map = state.map;
  let best = null, bestScore = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = unit.y + dy;
    if (y < 1 || y >= map.height - 1) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      let x = unit.x + dx;
      if (x < 0 || x >= map.width) {
        if (!map.wrapX) continue;
        x = ((x % map.width) + map.width) % map.width;
      }
      if (!isExplored(me, map, x, y)) continue;
      if (!canFoundAt(state, x, y, ruleset)) continue;
      if (enemyNear(state, me, me.id, x, y, 2)) continue; // no cradles in war zones
      const tile = map.tiles[y * map.width + x];
      let score = tile.t === 'grassland' ? 30 : tile.t === 'plains' ? 26
        : tile.t === 'hills' ? 22 : 18;
      if (tile.river === true) score = score + 6;
      if (tile.special === true) score = score + 3;
      score = score - chebyshev(map, unit.x, unit.y, x, y) * distPenalty;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  return best;
}

function bestCitySite(state, unit, playerId, ruleset) {
  const me = state.players[playerId];
  // nearby first; when the neighborhood is claimed (e.g. a rival grabbed
  // the planned spot), fall back to anywhere explored with a soft distance
  // penalty — settlers re-route to secondary sites instead of loitering
  const local = siteScan(state, unit, me, ruleset, 7, 2);
  if (local) return local;
  const far = state.map.width > state.map.height ? state.map.width : state.map.height;
  return siteScan(state, unit, me, ruleset, far, 1);
}

// Best adjacent tile for a wandering settler: prefer fertile open land.
// Own units never block (stacking is legal) — friendly traffic jams used
// to strand settlers around the capital; only enemies and cities do.
function towardBetterLand(state, unit, ruleset) {
  let bestDir = null, bestScore = 0;
  for (const key of DIR_KEYS) {
    const nx = ((unit.x + DIR_VECS[key][0]) % state.map.width + state.map.width) % state.map.width;
    const ny = unit.y + DIR_VECS[key][1];
    if (ny < 1 || ny >= state.map.height - 1) continue;
    const t = state.map.tiles[ny * state.map.width + nx].t;
    let score = t === 'grassland' ? 3 : t === 'plains' ? 2
      : ruleset.terrain.terrains[t].domain === 'land' ? 1 : 0;
    if (cityAt(state, nx, ny)) score = 0;
    const others = unitsAt(state, nx, ny);
    for (const u of others) {
      if (u.owner !== unit.owner) score = 0;
    }
    if (score > bestScore) { bestScore = score; bestDir = key; }
  }
  return bestDir;
}

// mark a tech and its whole prerequisite closure in `out`
function markTechPath(ruleset, techId, out) {
  if (out[techId] === true) return;
  out[techId] = true;
  for (const req of ruleset.techs[techId].prereqs) markTechPath(ruleset, req, out);
}

// B21(b): the tech that unlocks the earliest OFFENSIVE unit — the beeline term
// that lets an AI field attackers at all (the re-baseline found attackers = 0
// partly because the monarchy beeline never reaches an attacker tech). Lowest
// tech LEVEL among land attack>defense units; deterministic (tech-id tie-break).
// Data-driven: no hardcoded tech id. '' when no offensive unit needs a tech.
function attackerTech(ruleset) {
  let best = null, bestLevel = 0;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'land' || def.attack <= def.defense || def.tech === '') continue;
    const lvl = ruleset.techs[def.tech] === undefined ? 0 : ruleset.techs[def.tech].level;
    if (best === null || lvl < bestLevel || (lvl === bestLevel && def.tech < best)) {
      best = def.tech; bestLevel = lvl;
    }
  }
  return best === null ? '' : best;
}

// N3: the tech that unlocks the earliest SEA unit — the naval-beeline term (a
// coastal AI can't build a ship without it). Lowest tech level among sea-domain
// units; '' if none needs a tech. Data-driven, mirrors attackerTech.
function seaTech(ruleset) {
  let best = null, bestLevel = 0;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'sea' || def.tech === '') continue;
    const lvl = ruleset.techs[def.tech] === undefined ? 0 : ruleset.techs[def.tech].level;
    if (best === null || lvl < bestLevel || (lvl === bestLevel && def.tech < best)) {
      best = def.tech; bestLevel = lvl;
    }
  }
  return best === null ? '' : best;
}

// naval-presence M4 (#2201 Q4): the tech that unlocks the earliest OCEAN-CAPABLE carrier —
// a sea unit that can CARRY (transport>0) AND is NOT coastal-restricted (openSeaLoss !== true),
// i.e. sail@navigation. An island-locked civ across WIDE ocean beelines this so a hull can
// cross open water (M3 confines the trireme to the coast). Lowest tech level; '' if none.
// Data-driven, mirrors seaTech.
function oceanTech(ruleset) {
  let best = null, bestLevel = 0;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'sea' || def.tech === '') continue;
    if (def.transport === undefined || def.transport <= 0) continue; // must carry cargo
    if (def.openSeaLoss === true) continue; // must be ocean-capable (not the trireme)
    const lvl = ruleset.techs[def.tech] === undefined ? 0 : ruleset.techs[def.tech].level;
    if (best === null || lvl < bestLevel || (lvl === bestLevel && def.tech < best)) {
      best = def.tech; bestLevel = lvl;
    }
  }
  return best === null ? '' : best;
}

function countSettlers(state, playerId) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId && u.type === 'settlers') n = n + 1;
  }
  return n;
}

function countCities(state, playerId) {
  let n = 0;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.owner === playerId) n = n + 1;
  }
  return n;
}

function countMilitary(state, playerId, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId && ruleset.units[u.type].attack > 0) n = n + 1;
  }
  return n;
}

// N3: land military (the naval probe's "first N land units" floor) and ships.
function countLandMilitary(state, playerId, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    const def = ruleset.units[u.type];
    if (u.owner === playerId && def.domain === 'land' && def.attack > 0) n = n + 1;
  }
  return n;
}
function countShips(state, playerId, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId && ruleset.units[u.type].domain === 'sea') n = n + 1;
  }
  return n;
}

// N3: is this civ NAVAL? An empire-wide map read (Civ 1 flavor: the civ decides
// "we are a naval power", the coastal-city constraint is physical, applied at the
// build site). Water ratio = sea tiles within a Chebyshev box of radius
// rules.aiNavyRadius around the civ's cities (deduped across overlapping boxes)
// over all tiles in that band, vs rules.aiNavyWaterPct. Derived each turn — no
// state field. False when the knob is absent or the civ holds no city.
function navyPriorityOf(state, playerId, ruleset) {
  const pct = ruleset.rules.aiNavyWaterPct;
  if (pct === undefined) return false;
  const radius = ruleset.rules.aiNavyRadius === undefined ? 6 : ruleset.rules.aiNavyRadius;
  const map = state.map;
  const seen = {};
  let water = 0, total = 0;
  for (const cid of sortIds(state.cityOrder || [])) {
    const c = state.cities[cid];
    if (!c || c.owner !== playerId) continue;
    for (let dy = -radius; dy <= radius; dy++) {
      const ny = c.y + dy;
      if (ny < 0 || ny >= map.height) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        let nx = c.x + dx;
        if (nx < 0 || nx >= map.width) {
          if (!map.wrapX) continue;
          nx = ((nx % map.width) + map.width) % map.width;
        }
        const idx = ny * map.width + nx;
        if (seen[idx] === true) continue;
        seen[idx] = true;
        total = total + 1;
        if (ruleset.terrain.terrains[map.tiles[idx].t].domain === 'sea') water = water + 1;
      }
    }
  }
  return total > 0 && water * 100 > pct * total;
}

// B24: the per-combat-rule war doctrine (rules.aiWarDoctrine keyed by
// combatRounds — one-roll = mass/no-gate, best-of-three = odds-gated E). The
// key is a STRING so json2lua and JSON agree; falls back to the mass default.
function warDoctrineOf(ruleset) {
  const table = ruleset.rules.aiWarDoctrine;
  const cr = ruleset.rules.combatRounds === undefined ? 1 : ruleset.rules.combatRounds;
  const d = table === undefined ? undefined : table['' + cr];
  if (d === undefined) return { massSize: 4, oddsGatePct: 0, defenderGatePct: 100 };
  // B26b: the gates are PERCENTS (100 = the old integer 1) so the M11 sweep can
  // tune FRACTIONAL defender gates without floats (assaultOddsOk: att*100 >= pct*def,
  // decision-identical at 0/100/200). defenderGatePct governs DEFENDER-type attack-
  // initiation. A pre-B26b table carries the old integer oddsGate/defenderGate —
  // resolve them via *100 fallback so external tables/saves/sweeps stay valid
  // (defenderGate absent -> the offensive gate when it bites, else an even-odds
  // floor of 100: no suicide charges, Civ 1 aggression at even odds survives).
  let oddsGatePct = d.oddsGatePct;
  if (oddsGatePct === undefined) oddsGatePct = (d.oddsGate === undefined ? 0 : d.oddsGate) * 100;
  let defenderGatePct = d.defenderGatePct;
  if (defenderGatePct === undefined) {
    defenderGatePct = d.defenderGate !== undefined ? d.defenderGate * 100
      : (oddsGatePct > 0 ? oddsGatePct : 100);
  }
  return { massSize: d.massSize, oddsGatePct: oddsGatePct, defenderGatePct: defenderGatePct };
}

// B24: the nearest KNOWN enemy city to this unit (the army group's shared
// objective — clustered attackers pick the same nearby city, so groups derive
// from geography). Deterministic (sortIds walk). null when none is in view.
function nearestKnownEnemyCity(state, unit, playerId) {
  const me = state.players[playerId];
  let best = null, bestDist = 9999;
  for (const cid of sortIds(state.cityOrder || [])) {
    const c = state.cities[cid];
    if (!c || c.owner === playerId) continue;
    if (!isExplored(me, state.map, c.x, c.y)) continue;
    const d = chebyshev(state.map, unit.x, unit.y, c.x, c.y);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return best;
}

// A76: is the space race OPEN for this civ — Apollo Program built (by any civ,
// derived) and all part techs known? Gates every AI ship action, so the whole
// A76 AI stays DORMANT (no golden effect) until a civ actually reaches space.
function apolloReady(state, me, ruleset) {
  const f = ruleset.rules.ssFlight;
  if (f === undefined) return false;
  if (!wonderActive(state, f.gateWonder, ruleset)) return false;
  const parts = ruleset.rules.ssParts;
  for (const k of Object.keys(parts)) {
    if (me.techs.indexOf(parts[k].tech) === -1) return false;
  }
  return true;
}

// XII.5: the late-game space victory-drive gate. A civ COMMITS to the space path
// when its stance is in rules.victoryDrive.spaceStances (DATA-DRIVEN, sweepable) —
// science/builder/balanced/defensive per the ruling; aggressive pursues conquest
// in a later slice. Omit-safe: no victoryDrive block => off (golden-neutral).
function spaceDriveOn(ruleset, stance) {
  const vd = ruleset.rules.victoryDrive;
  if (vd === undefined || vd.spaceStances === undefined) return false;
  // resolve the effective stance NAME the way stanceOf resolves the config:
  // an omitted/unknown stance is the 'balanced' identity (so a default civ drives).
  const st = (stance !== undefined && STANCES[stance] !== undefined) ? stance : 'balanced';
  return vd.spaceStances.indexOf(st) !== -1;
}

// XII.5: eligible to DRIVE the space race — the civ can build Apollo (holds its
// tech) AND holds every ssPart tech. This is end-tier, so the drive self-gates to
// the late game: no early/mid/crafted civ qualifies, so those games stay
// byte-identical (the §5 golden-neutral-for-non-late guard, by construction).
function spaceDriveEligible(state, me, ruleset) {
  const f = ruleset.rules.ssFlight;
  if (f === undefined) return false;
  const apollo = ruleset.wonders[f.gateWonder];
  if (apollo === undefined) return false;
  if (apollo.tech !== '' && me.techs.indexOf(apollo.tech) === -1) return false;
  const parts = ruleset.rules.ssParts;
  for (const k of Object.keys(parts)) {
    if (me.techs.indexOf(parts[k].tech) === -1) return false;
  }
  return true;
}

// XII.5b: a tech's era rank = its index in ruleset.rules.ages (ancient<renaissance<
// industrial<modern<space). Pure, both engines.
function techEraRank(ruleset, era) {
  const ages = ruleset.rules.ages;
  if (ages === undefined) return 0;
  for (let i = 0; i < ages.length; i++) if (ages[i].id === era) return i;
  return 0;
}
// the civ's OWN most-advanced tech era rank (city-era pattern — reads its own
// techs, never the world age). 0 (ancient) when it has no era techs.
function ownTechEraRank(state, me, ruleset) {
  let best = 0;
  for (const t of me.techs) {
    const def = ruleset.techs[t];
    if (def === undefined) continue;
    const r = techEraRank(ruleset, def.era);
    if (r > best) best = r;
  }
  return best;
}
// XII.5b: an alive civ is eligible to COMMIT to the space PROJECT (before it has
// the space techs) — the EARLY gate that turns on path-preferring research —
// when it is advanced (own tech era >= industrial), a research leader or within
// spaceCommitTechGap of the leader, its core is secure (no enemy at the capital),
// and the game still has time (year < endYear). The stance gate (not conquest-
// committed) is spaceDriveOn's spaceStances check, applied by the caller.
function spaceCommitEligible(state, playerId, ruleset) {
  const me = state.players[playerId];
  if (me === undefined || me.alive === false) return false;
  const vd = ruleset.rules.victoryDrive;
  if (vd === undefined) return false;
  if (ownTechEraRank(state, me, ruleset) < techEraRank(ruleset, 'industrial')) return false;
  const gap = vd.spaceCommitTechGap === undefined ? 3 : vd.spaceCommitTechGap;
  let lead = 0;
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (p === undefined || p.alive === false) continue;
    if (p.techs.length > lead) lead = p.techs.length;
  }
  if (me.techs.length < lead - gap) return false;
  const cap = capitalOf(state, playerId, ruleset);
  // danger-abandon (#2138, user-ruled): CONCRETE capital danger — an enemy unit ADJACENT
  // to the capital (chebyshev 1), NOT the radius-8 threat metric (that signal misfired,
  // #2125). Adjacency is a real attack forming, not distant sabre-rattling.
  if (cap !== null && cap !== undefined
      && enemyNear(state, me, playerId, cap.x, cap.y, 1)) return false;
  if (ruleset.rules.endYear !== undefined && state.year >= ruleset.rules.endYear) return false;
  return true;
}

// XII.5b (Q2 ruled B, #2051): a civ is COMMITTED to the space project when its
// stance drives space (spaceDriveOn), it is commit-eligible (Q1: advanced + within
// the tech gap + secure core + game has time), AND its strategic snapshot reads
// peaceful (a building/expanding mode, none/low threat). The ally's numeric
// spaceProjectScore collapses into this: coreSafety/turn-feasibility/tech-gap live
// in spaceCommitEligible, militaryEmergency in the threat read, science/production
// capacity are implied by the research-leader eligibility, and opponentSpaceLead is
// omitted in v1 (multiple committed civs = a race; Q4 pause keeps it contestable).
// The snapshot runs only past the cheap eligibility gates, so no per-turn cost for
// the field. Pure, both engines.
// #35 space-war-hold (b, ruled #2220): the % of the space-flight tech CLOSURE (Apollo's tech +
// every ssPart tech) a civ has researched — the pure engine twin of soak.js's telemetry pathPct.
// Integer (idiv floor) for determinism; soak's Math.round is a <=1pt display-only difference.
function spacePathPct(state, playerId, ruleset) {
  const closure = {};
  const apolloTech = ruleset.wonders[ruleset.rules.ssFlight.gateWonder].tech;
  if (apolloTech !== undefined && apolloTech !== '') markTechPath(ruleset, apolloTech, closure);
  const parts = ruleset.rules.ssParts;
  for (const k of Object.keys(parts)) markTechPath(ruleset, parts[k].tech, closure);
  const closureSize = Object.keys(closure).length;
  if (closureSize === 0) return 100;
  const me = state.players[playerId];
  let known = 0;
  for (const t of Object.keys(closure)) { if (me.techs.indexOf(t) !== -1) known = known + 1; }
  return idiv(100 * known, closureSize);
}

function spaceCommitted(state, playerId, ruleset) {
  const me = state.players[playerId];
  if (me === undefined) return false;
  if (!spaceDriveOn(ruleset, me.stance)) return false;
  if (!spaceCommitEligible(state, playerId, ruleset)) return false;
  // danger-abandon (#2138, user-ruled): the commit MAINTAINS through a border skirmish
  // ANYWHERE; it abandons ONLY on CONCRETE danger — the civ turns offensive (mode
  // 'warring'), an enemy is ADJACENT to the capital (spaceCommitEligible's cheb-1 check),
  // or a CITY WAS LOST since last turn (ownedCities dropped below the record). Recommit
  // is possible once danger clears and eligibility returns. The threat-metric streak was
  // REMOVED — #2125's latch was structurally sound but its threat signal misfired.
  // #35 space-war-hold (b, ruled #2220): the 'warring' abandon is now CONDITIONAL — a committed
  // civ with pathPct >= victoryDrive.holdPathPct HOLDS the drive through ORDINARY war (Civ 1-
  // authentic: the AI beelined space while fighting; the King sweep showed a 100%-path civ
  // war-abandoned a COMPLETE drive). The two HARD triggers stay UNCONDITIONAL: the capital cheb-1
  // check (spaceCommitEligible, above) and city-loss (below).
  if (strategicSnapshot(state, playerId, ruleset).mode === 'warring') {
    const holdPct = ruleset.rules.victoryDrive.holdPathPct;
    if (holdPct === undefined || spacePathPct(state, playerId, ruleset) < holdPct) return false;
  }
  if (me.spaceCities !== undefined && ownedCities(state, playerId) < me.spaceCities) return false;
  return true;
}

// danger-abandon (#2138): a player's owned-city count — the concrete input to the
// city-loss abandon trigger. Pure, both engines.
function ownedCities(state, playerId) {
  let n = 0;
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const c = state.cities[cid];
    if (c !== undefined && c.owner === playerId) n = n + 1;
  }
  return n;
}

// danger-abandon (#2138): record a space-driving civ's owned-city count at the END of its
// turn (from runAiTurn — replay-safe, mirroring the removed latch's per-turn tally). Next
// turn spaceCommitted abandons if the count DROPPED (a city captured between turns), then
// this refreshes the record so a single loss abandons for one turn (recommit stays open).
// Stance-gated; the field rides only space-driving civs.
function updateSpaceCityRecord(state, playerId, ruleset) {
  const me = state.players[playerId];
  if (me === undefined) return;
  if (!spaceDriveOn(ruleset, me.stance)) return;
  me.spaceCities = ownedCities(state, playerId);
}

// A76: the next part to build toward a minimum-viable ship, or null when the
// ship already meets the target set (ready to launch). 7 structural supports
// the 5 non-structural parts (idiv(7*28,39)=5); one each of the five functional
// parts. Honest v1 — a larger, safer ship is the endings wave.
function nextSsPart(ship, ruleset) {
  // XII.5b (#2047, folds #1916): build the 5 functional parts — SOLAR FIRST —
  // as soon as the hull supports each, adding structural just-in-time; the
  // beyond-what's-supported structurals fill in behind. The old order built all
  // 7 structural then the 5 functional with solar dead-LAST (part 12), which the
  // probe found a pointless ~t1860 bottleneck. Minimum viable is still 7
  // structural + 5 functional (supported = idiv(structural*28,39) >= 5).
  const funcOrder = ['solar', 'propulsion', 'fuel', 'habitation', 'lifeSupport'];
  const have = k => (ship !== undefined && ship[k] !== undefined ? ship[k] : 0);
  const structural = have('structural');
  const supported = idiv(structural * 28, 39); // functional slots the hull carries
  let funcBuilt = 0;
  for (const k of funcOrder) if (have(k) >= 1) funcBuilt++;
  // the next functional part needs a support slot it doesn't have yet -> structural
  if (funcBuilt < funcOrder.length && supported <= funcBuilt) return 'structural';
  // otherwise lay the next missing functional part (solar first)
  for (const k of funcOrder) if (have(k) < 1) return k;
  // all five functional laid + supported; top structural to the viable 7 if short
  if (structural < 7) return 'structural';
  return null;
}

// A76: a visible rival's launched ship makes THAT civ's capital the top march
// target (shipLaunched is public). Returns the capital city if explored, else
// null (fall back to the nearest known enemy city). First launcher by playerOrder.
function launchRushTarget(state, me, playerId, ruleset) {
  for (const pid of state.playerOrder) {
    if (pid === playerId) continue;
    const p = state.players[pid];
    if (!p || p.alive === false || p.spaceship === undefined) continue;
    const ship = p.spaceship;
    if (ship.launched === undefined || ship.launched === 0) continue;
    const cap = capitalOf(state, pid, ruleset);
    if (cap && isExplored(me, state.map, cap.x, cap.y)) return cap;
  }
  return null;
}

// B24: how many of the civ's OFFENSIVE units sit adjacent to (x, y) — the mass
// gathered at a target city's edge. Order-independent count.
function attackersAdjacentTo(state, playerId, ruleset, x, y) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    const def = ruleset.units[u.type];
    if (u.owner !== playerId || def.attack <= def.defense) continue;
    if (chebyshev(state.map, u.x, u.y, x, y) <= 1) n = n + 1;
  }
  return n;
}

// B24: the per-unit odds gate. An attacker may strike (x, y) iff it is
// undefended (a capture) OR its attack strength × 100 >= gatePct × the best
// defender's defense strength (combat.js strengths: veteran/terrain/
// fortified/walls-aware). B26b: gatePct is a PERCENT (0 always passes — mass,
// not odds; 100 = even odds; 200 = 2:1) so fractional gates need no floats.
function assaultOddsOk(state, unit, x, y, ruleset, gatePct) {
  const defender = bestDefender(state, x, y, ruleset);
  if (!defender) return true;
  return attackStrength(unit, ruleset) * 100 >= gatePct * defenseStrength(state, defender, ruleset);
}

// B26: would stepping `dir` initiate an attack the doctrine gate FORBIDS? True
// only when the step lands on an enemy-occupied tile AND the odds fail `gate`.
// The guard that keeps any fallback/explore step from becoming an un-gated
// sortie (#646) — attack-INITIATION only; defending in place is never gated.
function stepAttackBlocked(state, unit, dir, playerId, ruleset, gate) {
  const v = DIR_VECS[dir];
  if (v === undefined) return false;
  const nx = ((unit.x + v[0]) % state.map.width + state.map.width) % state.map.width;
  const ny = unit.y + v[1];
  if (ny < 0 || ny >= state.map.height) return false;
  let hostile = false;
  for (const u of unitsAt(state, nx, ny)) if (u.owner !== playerId) hostile = true;
  if (!hostile) return false;
  return !assaultOddsOk(state, unit, nx, ny, ruleset, gate);
}

// N3 (guard, ruling @#741): would stepping `dir` put a LAND unit onto a sea
// tile? The AI has no load/unload doctrine yet, so a land unit that steps onto
// sea auto-boards a friendly ship (A69) and — with no unload logic — rides it
// out of play forever (a silent capability leak). This DECISION-layer guard
// keeps AI land units off the water; engine legality is untouched (humans still
// auto-load exactly as before), and N3b can RELAX this deliberately when the AI
// loading doctrine lands. Sea units and air units are unaffected.
function stepEntersSea(state, unit, dir, ruleset) {
  if (ruleset.units[unit.type].domain !== 'land') return false;
  const v = DIR_VECS[dir];
  if (v === undefined) return false;
  const nx = ((unit.x + v[0]) % state.map.width + state.map.width) % state.map.width;
  const ny = unit.y + v[1];
  if (ny < 0 || ny >= state.map.height) return false;
  return ruleset.terrain.terrains[state.map.tiles[ny * state.map.width + nx].t].domain === 'sea';
}

// naval-loop S1 (#2195 Q4): the CONTINENT of (sx,sy) — the connected component of
// contiguous LAND tiles reachable by land (unbounded 8-neighbour flood-fill, fixed
// order, wrapX honoured). Civ-SERIES concept (reviewer #2196): a continent is a
// contiguous-land grouping; here each landmass is its own continent (islands separate).
// Deterministic, both engines. Returns a { tileIndex: true } set; a water/absent start
// tile yields the empty set. Used by isOverseasSite to decide a settler must sail.
const NL_ADJ8 = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];
function landComponent(state, sx, sy, ruleset) {
  const W = state.map.width, H = state.map.height;
  const seen = {};
  if (ruleset.terrain.terrains[state.map.tiles[sy * W + sx].t].domain !== 'land') return seen;
  const stack = [sy * W + sx];
  seen[sy * W + sx] = true;
  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % W, y = idiv(idx, W);
    for (const o of NL_ADJ8) {
      let nx = x + o.dx;
      const ny = y + o.dy;
      if (ny < 0 || ny >= H) continue;
      if (nx < 0 || nx >= W) {
        if (state.map.wrapX !== true) continue;
        nx = ((nx % W) + W) % W;
      }
      const nidx = ny * W + nx;
      if (seen[nidx] === true) continue;
      if (ruleset.terrain.terrains[state.map.tiles[nidx].t].domain !== 'land') continue;
      seen[nidx] = true;
      stack.push(nidx);
    }
  }
  return seen;
}

// naval-loop S1: is (tx,ty) OVERSEAS relative to (sx,sy) — on a different landmass
// (not in the start tile's continent). The signal that a settler must sail to reach a
// site rather than walk. Both engines; unbounded so it never conflates far-by-land.
function isOverseasSite(state, sx, sy, tx, ty, ruleset) {
  const comp = landComponent(state, sx, sy, ruleset);
  return comp[ty * state.map.width + tx] !== true;
}

// B23b: the nearest OWN city to a unit (deterministic sortIds walk). null when
// the civ holds none. Used by the scout threat-veto (a scout whose nearest home
// is menaced stays to garrison — the user's LOCAL visible-threat read).
function nearestOwnCity(state, unit, playerId) {
  let best = null, bestDist = 9999;
  for (const cid of sortIds(state.cityOrder || [])) {
    const c = state.cities[cid];
    if (!c || c.owner !== playerId) continue;
    const d = chebyshev(state.map, unit.x, unit.y, c.x, c.y);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return best;
}

// B23b: is `uid` among the NEWEST `n` ids of `list` (highest sorted ids = the
// mobile surplus, never a founding garrison — the B21/B23 rank choice)?
function inNewestRank(list, n, uid) {
  for (let i = list.length - n; i < list.length; i++) {
    if (i >= 0 && list[i] === uid) return true;
  }
  return false;
}

// B23b: PHASED SCOUT ALLOCATION (user doctrine). A civ's scouts are the NEWEST
// ids across three pools (union): (1) the early-militia QUOTA by city COUNT —
// rules.aiScoutQuotaByCities keys are city COUNTS, not city ids, clamped to the
// largest key; "1" is the OPENER (the first unit of the first city explores
// before it garrisons, finding the second site); (2) up to aiFastScoutCount
// newest fast (moves>=2) units for large-land ranging; (3) up to aiBoatScoutCount
// newest SEA units for coastal maps (0-effect until the naval probe teaches ships
// to cross water). A scout is VETOED back to garrison when aiScoutThreatVeto and
// its NEAREST OWN CITY is within rules.threatRadius of a visible enemy (the
// LOCAL, not global, threat suppression). aiScoutQuotaByCities ABSENT -> the
// B21/B23 flat aiScoutSharePct share, so old sweeps keep resolving. Deterministic
// (sorted-id rank). The actual ranging behavior is B23's (coast/wallfollow/bfs).
function isScout(state, playerId, ruleset, uid, S) {
  const u = state.units[uid];
  if (!u || u.owner !== playerId) return false;
  const mil = [], fast = [], sea = [];
  for (const id of sortIds(Object.keys(state.units))) {
    const su = state.units[id];
    if (su.owner !== playerId) continue;
    const def = ruleset.units[su.type];
    if (def.attack > 0) mil.push(id);
    // fast = LAND ranging (horseback-class); boats are the separate sea pool
    if (def.attack > 0 && def.moves >= 2 && def.domain === 'land') fast.push(id);
    if (def.domain === 'sea') sea.push(id);
  }
  const table = ruleset.rules.aiScoutQuotaByCities;
  let quota;
  if (table === undefined) {
    quota = idiv(mil.length * scoutShareOf(ruleset, S), 100); // absent-table fallback
  } else {
    let maxKey = 1;
    for (const k of Object.keys(table)) { const n = parseInt(k, 10); if (n > maxKey) maxKey = n; }
    let key = countCities(state, playerId);
    if (key < 1) key = 1;
    if (key > maxKey) key = maxKey;
    const q = table['' + key];
    quota = q === undefined ? 0 : q;
  }
  const fastN = ruleset.rules.aiFastScoutCount === undefined ? 0 : ruleset.rules.aiFastScoutCount;
  const boatN = ruleset.rules.aiBoatScoutCount === undefined ? 0 : ruleset.rules.aiBoatScoutCount;
  if (!(inNewestRank(mil, quota, uid) || inNewestRank(fast, fastN, uid) || inNewestRank(sea, boatN, uid))) {
    return false;
  }
  if (ruleset.rules.aiScoutThreatVeto === true) {
    const c = nearestOwnCity(state, u, playerId);
    if (c && enemyNear(state, state.players[playerId], playerId, c.x, c.y, ruleset.rules.threatRadius)) {
      return false;
    }
  }
  return true;
}

// B21(c): rush-buy — a THREATENED own city finishing a defender/walls/attacker
// buys it out when the treasury sits comfortably above rules.aiBuyThreshold. The
// re-baseline found 0 buys across all 306 civ-checkpoints; this is the economic-
// coherence lever ("no buys ever" dies here). One buy per turn, cityOrder =
// deterministic. Sweep the threshold up to switch buying off.
function rushBuyCommand(state, playerId, ruleset) {
  const me = state.players[playerId];
  const threshold = ruleset.rules.aiBuyThreshold === undefined ? -1 : ruleset.rules.aiBuyThreshold;
  if (threshold < 0 || me.gold <= threshold) return null;
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    if (!enemyNear(state, me, playerId, city.x, city.y, ruleset.rules.threatRadius)) continue;
    const prod = city.producing;
    let def = undefined;
    if (prod.kind === 'building' && prod.id === 'city-walls') def = ruleset.buildings[prod.id];
    else if (prod.kind === 'unit' && prod.id !== 'settlers') {
      const u = ruleset.units[prod.id];
      if (u !== undefined && (u.attack > 0 || u.defense > 0)) def = u;
    }
    if (def === undefined) continue;
    const missing = def.cost - city.shields;
    if (missing <= 0) continue; // already complete
    const price = missing * ruleset.rules.buyGoldPerShield;
    if (me.gold >= price) return { type: 'buy', playerId, cityId: cid };
  }
  // §14 surplus lever: with a large treasury (> aiSurplusBuyThreshold), rush a
  // non-defensive build — a settler (expansion) or an offensive unit (army) —
  // so the AI spends its hoard instead of sitting on six figures of gold. Only
  // units of kind 'unit' (never wonders/buildings, never ss-parts until the
  // xii5b GO — wonders are never gold-rushed, #1899). cityOrder-deterministic,
  // one buy/turn; the threatened-defender rush above always takes priority.
  const surplus = ruleset.rules.aiSurplusBuyThreshold === undefined ? -1 : ruleset.rules.aiSurplusBuyThreshold;
  if (surplus >= 0 && me.gold > surplus) {
    let committed = undefined; // XII.5b Q5: lazily computed (per player) — only
    // when a city is actually laying an ss-part, so no snapshot cost otherwise.
    for (const cid of state.cityOrder || []) {
      const city = state.cities[cid];
      if (!city || city.owner !== playerId) continue;
      const prod = city.producing;
      // XII.5b Q5: a space-COMMITTED civ rushes its CURRENT spaceship PART (the
      // shelved #1901 parts-rush unlocks here). Apollo is a WONDER — NEVER
      // gold-rushed (#1899); this only ever touches kind 'ss-part'.
      if (prod.kind === 'ss-part') {
        if (committed === undefined) committed = spaceCommitted(state, playerId, ruleset);
        if (committed) {
          const part = ruleset.rules.ssParts[prod.id];
          if (part !== undefined) {
            const missing = part.cost - city.shields;
            if (missing > 0) {
              const rate = ruleset.rules.buyGoldPerShieldSS === undefined ? ruleset.rules.buyGoldPerShield : ruleset.rules.buyGoldPerShieldSS;
              if (me.gold >= missing * rate) return { type: 'buy', playerId, cityId: cid };
            }
          }
        }
        continue;
      }
      // #30 widen the hoard sink: rush the city's current BUILDING. A city produces a WONDER as
      // kind 'wonder' (never rushed — #1899) and a plain improvement as kind 'building', so this
      // touches only improvements. A late saturated/army-capped/at-peace civ builds buildings, so
      // this is the branch that finally spends the six-figure hoard the unit-only lever never reached.
      if (prod.kind === 'building') {
        const b = ruleset.buildings[prod.id];
        if (b !== undefined) {
          const missing = b.cost - city.shields;
          if (missing > 0 && me.gold >= missing * ruleset.rules.buyGoldPerShield) {
            return { type: 'buy', playerId, cityId: cid };
          }
        }
        continue;
      }
      if (prod.kind !== 'unit') continue;
      const u = ruleset.units[prod.id];
      if (u === undefined) continue;
      if (prod.id !== 'settlers' && u.attack <= 0) continue; // settlers or a true attacker only
      const missing = u.cost - city.shields;
      if (missing <= 0) continue;
      const price = missing * ruleset.rules.buyGoldPerShield;
      if (me.gold >= price) return { type: 'buy', playerId, cityId: cid };
    }
  }
  return null;
}

// B13e: the best OFFENSIVE land unit the player can build now — attack strictly
// above its OWN defense (a true attacker, not a high-attack defender like
// mech-inf), non-obsolete, tech-known; ranked attack desc, cost asc, id asc
// (deterministic; the Luau twin must match). Era-scales legion -> catapult ->
// knights -> cannon -> armor/artillery. null when the player has no offensive
// unit unlocked yet.
function bestAttackerUnit(me, ruleset) {
  let best = null, bestDef = null;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'land' || def.attack <= def.defense) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (unitObsolete(def, me.techs)) continue;
    if (best === null
        || def.attack > bestDef.attack
        || (def.attack === bestDef.attack && def.cost < bestDef.cost)
        || (def.attack === bestDef.attack && def.cost === bestDef.cost && id < best)) {
      best = id; bestDef = def;
    }
  }
  return best;
}

// N3: the best SEA unit the civ can build now — mirror of bestAttackerUnit
// (strongest attack, then cheapest, then id; skips obsolete), so it upgrades
// trireme -> ironclad -> ... as naval tech advances. attack>0 EXCLUDES the
// transport (attack 0): N3 is a naval presence + scouts, not troop logistics
// (the scope fence — AI loading doctrine is a later slice). null when none.
function bestSeaUnit(me, ruleset) {
  let best = null, bestDef = null;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'sea' || def.attack <= 0) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (unitObsolete(def, me.techs)) continue;
    if (best === null
        || def.attack > bestDef.attack
        || (def.attack === bestDef.attack && def.cost < bestDef.cost)
        || (def.attack === bestDef.attack && def.cost === bestDef.cost && id < best)) {
      best = id; bestDef = def;
    }
  }
  return best;
}

// naval-loop S2 (#2195 Q1): the best available CARRIER — a sea unit with cargo capacity
// (units.json `transport` field). Ranked highest capacity, then cheapest, then id
// (deterministic; the Luau twin must match). trireme (cap 2, map-making) onward, so
// overseas logistics is NOT industrialization-gated. null when no carrier is buildable yet.
function bestCarrierUnit(me, ruleset) {
  let best = null, bestCap = 0, bestCost = 0;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    const cap = def.transport === undefined ? 0 : def.transport;
    if (def.domain !== 'sea' || cap <= 0) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (unitObsolete(def, me.techs)) continue;
    if (best === null
        || cap > bestCap
        || (cap === bestCap && def.cost < bestCost)
        || (cap === bestCap && def.cost === bestCost && id < best)) {
      best = id; bestCap = cap; bestCost = def.cost;
    }
  }
  return best;
}

// B13e: the player's OFFENSIVE units (attack > defense) — the army target that
// makes the AI field an attacking force excludes pure defenders.
function countAttackers(state, playerId, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    const def = ruleset.units[u.type];
    if (u.owner === playerId && def.attack > def.defense) n = n + 1;
  }
  return n;
}

// bestDefenderUnit moved to cities.js (§46: shared by the AI choice AND the
// founding/empty-queue production default) — imported above.

// Cheapest building the city lacks and the player can build (never a Palace —
// capitalOf falls back to the oldest city, extra palaces would corrupt it).
// Comparison-select, so the result is independent of key iteration order.
function nextBuilding(city, me, ruleset) {
  let best = null;
  for (const id of Object.keys(ruleset.buildings)) {
    const def = ruleset.buildings[id];
    if (city.buildings !== undefined && city.buildings.indexOf(id) !== -1) continue;
    if (def.effect.isPalace === true) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (best === null || def.cost < ruleset.buildings[best].cost
      || (def.cost === ruleset.buildings[best].cost && id < best)) best = id;
  }
  return best;
}

function nextWonder(state, me, ruleset) {
  const built = state.wonders === undefined ? {} : state.wonders;
  let best = null;
  for (const id of Object.keys(ruleset.wonders)) {
    const def = ruleset.wonders[id];
    if (built[id] !== undefined) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (best === null || def.cost < ruleset.wonders[best].cost
      || (def.cost === ruleset.wonders[best].cost && id < best)) best = id;
  }
  return best;
}

// #26 obsolescence-aware appetite decay: a fresh wonder build is "too late" once its obsoleteBy
// tech is already known OR researchable-next (every prereq met) — the ally's "a Builder racing
// Pyramids early is rational; starting at Renaissance is not." Never-obsolete wonders never decay.
function wonderObsoleteSoon(me, ruleset, id) {
  const ob = ruleset.wonders[id].obsoleteBy;
  if (ob === undefined || ob === '') return false;
  if (me.techs.indexOf(ob) !== -1) return true;
  const t = ruleset.techs[ob];
  if (t === undefined) return false;
  for (let i = 0; i < t.prereqs.length; i++) {
    if (me.techs.indexOf(t.prereqs[i]) === -1) return false;
  }
  return true; // all prereqs met -> obsoletes imminently -> decay
}

// #26 should the appetite START a new wonder in the drive city NOW? All tiers evaluate here (the
// eager branch, above the settler/army treadmill) with tier-scaled gates so no tier starves its
// own project: HIGH once the city clears wonderMinShields; MED also needs its core buildings
// (>= wonderMedBuildings); LOW needs the HIGHER wonderLowShields bar AND the civ's settler target
// already met (expansion first — never starves growth). NONE never. (Persisting an in-flight
// wonder is handled separately for any non-NONE appetite.) Deterministic — no RNG.
function appetiteStart(S, driveCity, state, playerId, ruleset) {
  const sh = cityYields(state, driveCity, ruleset).shields;
  const a = S.wonderAppetite;
  if (a === 'high') return sh >= BUILD_LEVER.wonderMinShields;
  if (a === 'med') {
    const built = driveCity.buildings === undefined ? 0 : driveCity.buildings.length;
    return sh >= BUILD_LEVER.wonderMinShields && built >= BUILD_LEVER.wonderMedBuildings;
  }
  if (a === 'low') {
    // an ESTABLISHED civ (many cities) is done with early expansion — a wide, saturated civ
    // cannot reach a settler-count target (no room to found), so ncities is the honest signal.
    return sh >= BUILD_LEVER.wonderLowShields
      && countCities(state, playerId) >= BUILD_LEVER.wonderLowCities;
  }
  return false;
}

// #26 the stance-keyed wonder pick: the FIRST available (unbuilt, tech-known, not global-unlock,
// not obsolescing) wonder in the stance's WONDER_AFFINITY list — a civ's wonders reinforce its
// project; else the cheapest available (the historical nextWonder fallback, global-unlock still
// excluded). Deterministic (affinity list order, then cost/id).
function nextWonderFor(state, me, ruleset, stanceName) {
  const built = state.wonders === undefined ? {} : state.wonders;
  const pref = WONDER_AFFINITY[stanceName];
  if (pref !== undefined) {
    for (let i = 0; i < pref.length; i++) {
      const id = pref[i];
      const def = ruleset.wonders[id];
      if (def === undefined || built[id] !== undefined) continue;
      if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
      if (GLOBAL_UNLOCK_WONDERS[id] === true) continue;
      if (wonderObsoleteSoon(me, ruleset, id)) continue;
      return id;
    }
  }
  let best = null;
  for (const id of Object.keys(ruleset.wonders)) {
    const def = ruleset.wonders[id];
    if (built[id] !== undefined) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    if (GLOBAL_UNLOCK_WONDERS[id] === true) continue;
    if (best === null || def.cost < ruleset.wonders[best].cost
      || (def.cost === ruleset.wonders[best].cost && id < best)) best = id;
  }
  return best;
}

// N9b: a shallow city copy with one building appended — for valuing a candidate
// building via cityEconOutput WITHOUT mutating the real city. Buildings don't
// change worked tiles, so only the effectPct (taxBonus/sciBonus) term differs.
function withBuilding(city, id) {
  const clone = {};
  for (const k of Object.keys(city)) clone[k] = city[k];
  const b = city.buildings === undefined ? [] : city.buildings;
  const nb = [];
  for (let i = 0; i < b.length; i++) nb.push(b[i]);
  nb.push(id);
  clone.buildings = nb;
  return clone;
}

// N9b: the build-priority lever's chooser — of the buildable buildings
// (nextBuilding's filter: unbuilt, non-palace, tech known), the one whose PAYBACK
// (turns for its gold+bulbs benefit to repay its shield cost) is lowest and under
// pbMax; tie-break lowest cost then catalog order. Payback reuses cityEconOutput
// (the SAME math playerIncome uses) so a building's valued benefit equals its
// actual benefit. Zero-delta (non-yield) buildings are skipped — they keep the
// stanceBuilding/nextBuilding route (R2). Returns a building id or null.
function bestPaybackBuilding(state, city, me, ruleset, pbMax) {
  const taxRate = me.taxRate === undefined ? ruleset.rules.defaultTaxRate : me.taxRate;
  const sciRate = me.sciRate === undefined ? ruleset.rules.defaultSciRate : me.sciRate;
  const perSpecialist = ruleset.rules.specialistOutput;
  const base = cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset);
  const baseEcon = base.gold + base.bulbs;
  let best = null, bestPayback = 0, bestCost = 0;
  for (const id of Object.keys(ruleset.buildings)) {
    const def = ruleset.buildings[id];
    if (city.buildings !== undefined && city.buildings.indexOf(id) !== -1) continue;
    if (def.effect.isPalace === true) continue;
    if (def.tech !== '' && me.techs.indexOf(def.tech) === -1) continue;
    const eco = cityEconOutput(state, withBuilding(city, id), taxRate, sciRate, perSpecialist, ruleset);
    const delta = (eco.gold + eco.bulbs) - baseEcon;
    if (delta <= 0) continue; // non-yield building: no payback (R2)
    const payback = idiv(def.cost, delta);
    if (payback >= pbMax) continue;
    if (best === null || payback < bestPayback
      || (payback === bestPayback && def.cost < bestCost)
      || (payback === bestPayback && def.cost === bestCost && id < best)) {
      best = id; bestPayback = payback; bestCost = def.cost;
    }
  }
  return best;
}

// N9b: is the civ already committed to a wonder somewhere (one-in-flight cap)?
function civWonderInFlight(state, playerId) {
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.owner === playerId && c.producing !== undefined && c.producing.kind === 'wonder') return true;
  }
  return false;
}

// N9b: the builder wonder-drive's target when no palace/capital exists — the
// highest-shield city, deterministic tie-break by lowest cityId.
function highestShieldCity(state, playerId, ruleset) {
  let best = null, bestSh = -1;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (!c || c.owner !== playerId) continue;
    const sh = cityYields(state, c, ruleset).shields;
    if (sh > bestSh || (sh === bestSh && (best === null || cid < best.id))) { best = c; bestSh = sh; }
  }
  return best;
}

// The nearest own settler in the open (not in a city) with no adjacent
// military guard other than this unit — escort duty target. Excluding
// `unit` from the guard check keeps the current escort standing its post.
function nearestUnguardedSettler(state, unit, playerId, ruleset, radius) {
  let best = null, bestD = radius + 1;
  for (const uid of sortIds(Object.keys(state.units))) {
    const s = state.units[uid];
    if (s.owner !== playerId || s.type !== 'settlers') continue;
    if (cityAt(state, s.x, s.y)) continue; // in a city = already safe
    let guarded = false;
    for (const gid of Object.keys(state.units)) {
      const g = state.units[gid];
      if (g.id === unit.id || g.owner !== playerId) continue;
      if (ruleset.units[g.type].attack <= 0) continue;
      if (chebyshev(state.map, g.x, g.y, s.x, s.y) <= 1) guarded = true;
    }
    if (guarded) continue;
    const d = chebyshev(state.map, unit.x, unit.y, s.x, s.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function nearestKnownEnemy(state, unit, playerId) {
  const me = state.players[playerId];
  let best = null, bestDist = 9999;
  for (const uid of sortIds(Object.keys(state.units))) {
    const u = state.units[uid];
    if (u.owner === playerId) continue;
    if (!isExplored(me, state.map, u.x, u.y)) continue;
    const d = chebyshev(state.map, unit.x, unit.y, u.x, u.y);
    if (d < bestDist) { best = u; bestDist = d; }
  }
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (!c || c.owner === playerId) continue;
    if (!isExplored(me, state.map, c.x, c.y)) continue;
    const d = chebyshev(state.map, unit.x, unit.y, c.x, c.y);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return best;
}

function towardUnexplored(state, unit, me) {
  if (!me.explored) return null;
  const { width, height } = state.map;
  let best = null, bestDist = 9999;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      if (me.explored[y * width + x] === 1) continue;
      const d = chebyshev(state.map, unit.x, unit.y, x, y);
      if (d < bestDist) { best = { x, y }; bestDist = d; }
    }
  }
  if (!best) return null;
  return dirToward(state.map, unit.x, unit.y, best.x, best.y);
}

// naval-presence M2 (#2201 Q2): a SEA scout's open-water heading — steer toward the
// nearest EXPLORED SEA tile that borders unexplored space (the known-water frontier).
// Fog-honest (reads only explored tiles); sailing to the ocean's known edge reveals
// beyond it, so boat-scouts cross to OTHER landmasses instead of circling their own
// island (whose inland fog traps towardUnexplored near home). Sea-only, additive — land
// scouts are untouched. Deterministic: nearest chebyshev, tile-index tie-break.
function towardUnexploredSea(state, unit, me, ruleset) {
  if (!me.explored) return null;
  const { width, height } = state.map;
  let best = null, bestDist = 9999, bestIdx = -1;
  for (let y = 0; y < height; y = y + 1) {
    for (let x = 0; x < width; x = x + 1) {
      const idx = y * width + x;
      if (me.explored[idx] !== 1) continue; // the frontier tile must itself be explored
      if (ruleset.terrain.terrains[state.map.tiles[idx].t].domain !== 'sea') continue;
      let frontier = false;
      for (const key of DIR_KEYS) {
        let nx = x + DIR_VECS[key][0];
        const ny = y + DIR_VECS[key][1];
        if (ny < 0 || ny >= height) continue;
        if (nx < 0 || nx >= width) { if (state.map.wrapX !== true) continue; nx = ((nx % width) + width) % width; }
        if (me.explored[ny * width + nx] !== 1) { frontier = true; break; }
      }
      if (!frontier) continue;
      const d = chebyshev(state.map, unit.x, unit.y, x, y);
      if (d < bestDist || (d === bestDist && idx < bestIdx)) { best = { x, y }; bestDist = d; bestIdx = idx; }
    }
  }
  if (!best) return null;
  return dirToward(state.map, unit.x, unit.y, best.x, best.y);
}

// B23: the BFS ROUTER — the real "commit to the trip" (docs/15 §item, the A65
// pathfind). Breadth-first over PASSABLE LAND from the scout, returning the
// first-step direction of the shortest land path to the nearest UNEXPLORED land
// tile. This routes THROUGH explored land around bays/isthmuses that trap the
// greedy step (measured: u6 stalled at a bay with the frontier 3 tiles off but
// no distance-reducing land step). It fulfils the user's "explored map is the
// memory" seal — the memory generalises from adjacent-step to shortest-known-
// path. DETERMINISM CONTRACT (docs/09 trap class): neighbours are expanded in
// DIR_KEYS order and the FIRST unexplored land tile reached wins — the Luau twin
// must expand in the identical order. Plain arrays (Lua-portable queue). null
// when the landmass is fully charted (naval needed for more).
function bfsStepToNearestUnexplored(state, unit, me, ruleset) {
  if (!me.explored) return null;
  const map = state.map;
  const { width, height, wrapX } = map;
  const visited = {};
  visited[unit.y * width + unit.x] = true;
  const queue = [{ x: unit.x, y: unit.y, first: null }];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi]; qi = qi + 1;
    for (const key of DIR_KEYS) {
      let nx = cur.x + DIR_VECS[key][0];
      if (nx < 0 || nx >= width) { if (!wrapX) continue; nx = ((nx % width) + width) % width; }
      const ny = cur.y + DIR_VECS[key][1];
      if (ny < 1 || ny >= height - 1) continue;
      const idx = ny * width + nx;
      if (visited[idx] === true) continue;
      if (ruleset.terrain.terrains[map.tiles[idx].t].domain !== 'land') continue;
      visited[idx] = true;
      const first = cur.first === null ? key : cur.first;
      if (me.explored[idx] !== 1) return first; // nearest unexplored land — commit
      queue.push({ x: nx, y: ny, first });
    }
  }
  return null;
}

// B23: the user's LITERAL wall-follower (rules.aiExploreMode "wallfollow"), a
// measurable alternative to bfs. Keeps water on a fixed HAND (unit-id parity:
// even=left, odd=right) and steps along the coast, so it traverses EXPLORED
// coast to escape a bay. Needs a persisted heading (unit.scoutDir, set via the
// generic moveUnit cmd.heading) — returns { dir, heading }. Deterministic
// 8-dir hand-rule: from the heading, rotate toward the hand to the first
// passable land step. Seeds the heading from a sea-neighbour tangent when unset.
function wallFollowDir(state, unit, me, ruleset) {
  const map = state.map;
  const { width, height, wrapX } = map;
  const hand = (parseInt(unit.id.slice(1), 10) % 2) === 0 ? -1 : 1; // even=left(CCW), odd=right(CW)
  const nbr = (k) => {
    let nx = unit.x + DIR_VECS[DIR_KEYS[k]][0];
    if (nx < 0 || nx >= width) { if (!wrapX) return null; nx = ((nx % width) + width) % width; }
    const ny = unit.y + DIR_VECS[DIR_KEYS[k]][1];
    if (ny < 1 || ny >= height - 1) return null;
    return { nx, ny, land: ruleset.terrain.terrains[map.tiles[ny * width + nx].t].domain === 'land' };
  };
  let h = unit.scoutDir === undefined ? -1 : DIR_KEYS.indexOf(unit.scoutDir);
  if (h < 0) { // seed the heading: perpendicular to the first sea neighbour, by hand
    for (let k = 0; k < 8; k++) {
      const n = nbr(k);
      if (n && !n.land) { h = ((k + hand * 2) % 8 + 8) % 8; break; }
    }
    if (h < 0) h = 0;
  }
  // rotate from (heading turned 90° toward the hand) against the hand to the
  // first passable land — the standard hand-on-wall traversal.
  const startk = ((h - hand * 2) % 8 + 8) % 8;
  for (let i = 0; i < 8; i++) {
    const k = ((startk + hand * i) % 8 + 8) % 8;
    const n = nbr(k);
    if (n && n.land) return { dir: DIR_KEYS[k], heading: DIR_KEYS[k] };
  }
  return { dir: null, heading: undefined };
}

// B23: a LAND tile with at least one SEA neighbour (8-dir) — the coastline the
// scouts trace. Pure ruleset/terrain read.
function isCoastal(state, x, y, ruleset) {
  const { width, height, wrapX } = state.map;
  if (ruleset.terrain.terrains[state.map.tiles[y * width + x].t].domain !== 'land') return false;
  for (const key of DIR_KEYS) {
    let nx = x + DIR_VECS[key][0];
    if (nx < 0 || nx >= width) { if (!wrapX) continue; nx = ((nx % width) + width) % width; }
    const ny = y + DIR_VECS[key][1];
    if (ny < 0 || ny >= height) continue;
    if (ruleset.terrain.terrains[state.map.tiles[ny * width + nx].t].domain === 'sea') return true;
  }
  return false;
}

// B23: memoryless coastline-following. A coastal scout steps to an adjacent
// UNEXPLORED COASTAL land tile — the explored map is monotone, so the walk is
// self-avoiding by construction (no oscillation) and traces the perimeter. At a
// fork the HAND (unit-id parity: even=left/first, odd=right/last by DIR_KEYS
// order) picks the rotational extreme, so two scouts trace OPPOSITE perimeters.
// null when no unexplored coastal step exists (caller falls back to inland).
function coastalScoutDir(state, unit, me, ruleset) {
  const { width, height, wrapX } = state.map;
  const cands = [];
  for (const key of DIR_KEYS) {
    let nx = unit.x + DIR_VECS[key][0];
    if (nx < 0 || nx >= width) { if (!wrapX) continue; nx = ((nx % width) + width) % width; }
    const ny = unit.y + DIR_VECS[key][1];
    if (ny < 0 || ny >= height) continue;
    if (ruleset.terrain.terrains[state.map.tiles[ny * width + nx].t].domain !== 'land') continue;
    if (isExplored(me, state.map, nx, ny)) continue;
    if (!isCoastal(state, nx, ny, ruleset)) continue;
    cands.push(key);
  }
  if (cands.length === 0) return null;
  const num = parseInt(unit.id.slice(1), 10);
  return (num % 2) === 0 ? cands[0] : cands[cands.length - 1];
}

// #22 XV §11 disorder playbook: the K-turn sustainability window for a bounded gold deficit — an
// ai.js CONSTANT, NOT a rules.json knob (keeps the rulesetHash stamp unmoved; ruled #2334). A rate
// set is sustainable if it loses no gold, OR the treasury funds the loss for >= this many turns.
const DISORDER_LUX_WINDOW = 10;
const DISORDER_SCI_FLOOR = 10;

// #22: count this civ's cities in disorder — optionally at a PROBE luxRate (simulate a rate change
// without mutating state; cityMood reads player.luxRate, which setRates stores).
function countDisorderAt(state, playerId, ruleset, luxOverride) {
  const me = state.players[playerId];
  let probeState = state;
  if (luxOverride !== null) {
    const probe = {}; for (const k of Object.keys(me)) probe[k] = me[k];
    if (luxOverride > 0) probe.luxRate = luxOverride; else delete probe.luxRate;
    const players = {}; for (const k of Object.keys(state.players)) players[k] = state.players[k];
    players[playerId] = probe;
    probeState = {}; for (const k of Object.keys(state)) probeState[k] = state[k];
    probeState.players = players;
  }
  let n = 0;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.owner === playerId && cityMood(probeState, c, ruleset).disorder) n = n + 1;
  }
  return n;
}

// #22: is a (tax, sci) rate set sustainable — net gold >= 0, or the treasury funds the deficit for
// >= DISORDER_LUX_WINDOW turns? Probes playerIncome at the candidate rates (no mutation).
function ratesSustainable(state, playerId, ruleset, tax, sci) {
  const me = state.players[playerId];
  const probe = {}; for (const k of Object.keys(me)) probe[k] = me[k];
  probe.taxRate = tax; probe.sciRate = sci;
  const players = {}; for (const k of Object.keys(state.players)) players[k] = state.players[k];
  players[playerId] = probe;
  const probeState = {}; for (const k of Object.keys(state)) probeState[k] = state[k];
  probeState.players = players;
  const inc = playerIncome(probeState, playerId, ruleset);
  const net = inc.gold - inc.maintenance;
  if (net >= 0) return true;
  const treasury = me.gold === undefined ? 0 : me.gold;
  return idiv(treasury, -net) >= DISORDER_LUX_WINDOW;
}

// #22 XV §11 (§19 ruling "build to THIS"): MULTI-CITY (>=2) disorder → the empire LUXURY playbook,
// BEFORE the per-city entertainer. Steps luxury up (taxBumpStep 10s, funded from TAX then science with
// a sci floor, capped at the government's rate headroom) and picks the raise that best reduces disorder
// AND stays sustainable (the K-window): a FULL clear at the minimum sustainable lux, else the largest
// sustainable step that still reduces disorder (the COMBO — the entertainer mops up the residual).
// null = single-city (entertainer-first), or no sustainable improving raise. Deterministic, no RNG.
function disorderLuxCommand(state, playerId, ruleset) {
  const me = state.players[playerId];
  const base = countDisorderAt(state, playerId, ruleset, null);
  if (base < 2) return null; // Q1: single-city stays entertainer-first
  const step = ruleset.rules.taxBumpStep === undefined ? 10 : ruleset.rules.taxBumpStep;
  const gov = ruleset.governments[me.government === undefined ? 'despotism' : me.government];
  const cap = gov.maxRate === undefined ? 60 : gov.maxRate;
  const tax0 = me.taxRate === undefined ? ruleset.rules.defaultTaxRate : me.taxRate;
  const sci0 = me.sciRate === undefined ? ruleset.rules.defaultSciRate : me.sciRate;
  const lux0 = 100 - tax0 - sci0;
  let best = null; // { tax, sci, lux }
  for (let lux = lux0 + step; lux <= cap; lux = lux + step) {
    // fund the raise from TAX first, then science (floor DISORDER_SCI_FLOOR)
    let tax = tax0, sci = sci0, need = lux - lux0;
    const takeTax = tax < need ? tax : need; tax = tax - takeTax; need = need - takeTax;
    if (need > 0) { const room = sci - DISORDER_SCI_FLOOR; const takeSci = room < need ? room : need; if (takeSci > 0) { sci = sci - takeSci; need = need - takeSci; } }
    if (need > 0) break; // floors block this lux (and any higher)
    const d = countDisorderAt(state, playerId, ruleset, lux);
    if (d >= base) continue; // no reduction — a wasted raise
    if (!ratesSustainable(state, playerId, ruleset, tax, sci)) continue; // over the deficit window
    best = { tax, sci, lux };
    if (d === 0) break; // minimum sustainable FULL clear
  }
  if (best === null) return null; // no sustainable improving lux → the entertainer handles it
  if (best.tax === tax0 && best.sci === sci0) return null; // no-op guard
  return { type: 'setRates', playerId, tax: best.tax, sci: best.sci, lux: best.lux };
}

// Batch 4, iteration 3 (docs/04 ledger — the WINNER: GE stagnant 39%->7%):
// entertainers-local. A disordered city converts its worst worked tile to an
// entertainer — the cost is one tile's yields IN THAT CITY, so production
// never halts empire-wide, science is never drained, and the monarchy
// beeline is untouched. Revert hands tiles back to the auto-assigner only
// when a HYPOTHETICAL mood without manual assignment is disorder-free (a
// plain copy without `workers` — cityMood then scores the auto layout), so
// the entertainer's own calm can never trigger the flap that re-creates
// the disorder it fixed. One city per turn, cityOrder = deterministic.
function happinessCommand(state, playerId, ruleset) {
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    const mood = cityMood(state, city, ruleset);
    if (mood.disorder && city.pop >= 2) {
      const cands = candidateTiles(state, city, ruleset);
      const current = city.workers !== undefined ? city.workers.length
        : (city.pop < cands.length ? city.pop : cands.length);
      // B22: ESCALATE — pull ONE more worker into an entertainer each disorder
      // turn (target = current - 1). The old fixed pop-1-specialists cap could
      // only ever add ONE entertainer and then stalled (target < current became
      // false), so a city needing 2+ entertainers drowned permanently — the
      // disorderTurns tail. The auto-revert below still undoes the whole thing
      // the moment the auto layout would be calm, so a recovering city snaps
      // back and there is no flap.
      const target = current - 1;
      if (target >= 0 && cands.length > 0) {
        const keep = [];
        for (let i = 0; i < cands.length && keep.length < target; i++) keep.push(cands[i].idx);
        return { type: 'setWorkers', playerId, cityId: cid, workers: keep };
      }
    }
    if (!mood.disorder && city.workers !== undefined && mood.entertainers > 0) {
      const probe = {};
      for (const k of Object.keys(city)) {
        if (k !== 'workers') probe[k] = city[k];
      }
      if (cityMood(state, probe, ruleset).disorder === false) {
        return { type: 'setWorkers', playerId, cityId: cid, auto: true };
      }
    }
  }
  return null;
}

// One decision at a time; `done` prevents re-considering the same actor this turn.
// D3: the AI diplomacy step — for each MET rival (metOf gate), respond to a
// pending peace offer, declare to BREAK a peace treaty when war intent recovers
// (at default war the AI just attacks as today — no declare needed), or offer
// peace when it would itself accept one. Returns ONE diplomacy command per call;
// doneSet tracks processed rivals so runAiTurn's loop covers them all. Never
// double-issues on the default-war baseline (declare only fires peace->war).
function diplomacyStep(state, playerId, ruleset, doneSet) {
  const d = ruleset.rules.diplomacy;
  if (d === undefined) return null;
  for (const other of state.playerOrder) {
    if (other === playerId || doneSet[other]) continue;
    const op = state.players[other];
    if (op === undefined || op.alive === false || other === 'barb' || !metOf(state, playerId, other)) {
      doneSet[other] = true; continue;
    }
    doneSet[other] = true; // one diplomacy action per rival per turn
    const rel = relationOf(state, playerId, other);
    const entry = state.relations === undefined ? undefined : state.relations[pairKey(playerId, other)];
    // 1. a pending peace offer FROM other -> accept/reject by scorePeaceAccept
    if (entry !== undefined && entry.offer !== undefined && entry.offer.from === other) {
      const accept = scorePeaceAccept(state, playerId, other, ruleset) > d.peaceAcceptThreshold;
      return { type: 'diplomacy', kind: accept ? 'accept' : 'reject', playerId, target: other };
    }
    // 2. at PEACE + war intent recovers -> declare (breaks the treaty, TREATY_BROKEN)
    if (rel === 'peace' && scoreWarIntent(state, playerId, other, ruleset) > d.warIntentThreshold) {
      return { type: 'diplomacy', kind: 'declare', playerId, target: other };
    }
    // 3. at WAR + would accept peace itself + none pending + not on a reject
    // cooldown -> offer peace (perpetual). §14 F1: the cooldown stops the
    // offer/reject spam loop (reject clears the offer but keeps war).
    const cooldown = d.offerCooldown === undefined ? 0 : d.offerCooldown;
    const offerCooled = entry === undefined || entry.offerRejectedTurn === undefined
      || state.turn - entry.offerRejectedTurn >= cooldown;
    if (rel === 'war' && (entry === undefined || entry.offer === undefined) && offerCooled
        && scorePeaceAccept(state, playerId, other, ruleset) > d.peaceAcceptThreshold) {
      return { type: 'diplomacy', kind: 'offer', playerId, target: other, terms: { peace: true } };
    }
  }
  return null;
}

// xiv-ai §13 (regency economics): the deficit ladder — cheapest-first levers to
// stop a gold drain (net income < 0) before it bleeds to 0 and disorder. Runs
// for ALL stances (a balanced/regent seat used to just tolerate the deficit).
// Step 1 (cheapest): raise the tax rate one step, taking the increase from
// SCIENCE, never luxury — luxury unchanged means no new disorder, so the
// "disorder-free cap" is simply the point where science is exhausted.
function deficitTaxBump(state, playerId, ruleset) {
  const me = state.players[playerId];
  const gov = ruleset.governments[me.government === undefined ? 'despotism' : me.government];
  const cap = gov.maxRate === undefined ? 60 : gov.maxRate;
  const step = ruleset.rules.taxBumpStep === undefined ? 10 : ruleset.rules.taxBumpStep;
  const tax = me.taxRate === undefined ? ruleset.rules.defaultTaxRate : me.taxRate;
  const sci = me.sciRate === undefined ? ruleset.rules.defaultSciRate : me.sciRate;
  const lux = 100 - tax - sci;
  let raise = step;
  if (cap - tax < raise) raise = cap - tax;
  if (sci < raise) raise = sci; // never cut luxury (would risk disorder)
  if (raise <= 0) return null; // tax maxed or no science to give -> next lever
  return { type: 'setRates', playerId, tax: tax + raise, sci: sci - raise, lux };
}

// Step 2: when the rate lever is spent, pull one worked citizen in a pop>=5 city
// into a taxman (flat gold). cityOrder scan = deterministic; one city per turn.
function deficitTaxmen(state, playerId, ruleset) {
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId || city.pop < 5) continue;
    const cands = candidateTiles(state, city, ruleset);
    const worked = city.workers !== undefined ? city.workers.length
      : (city.pop < cands.length ? city.pop : cands.length);
    const taxmen = city.taxmen === undefined ? 0 : city.taxmen;
    const scientists = city.scientists === undefined ? 0 : city.scientists;
    if (worked >= 1 && worked + taxmen + scientists <= city.pop) {
      const keep = [];
      for (let i = 0; i < cands.length && keep.length < worked - 1; i++) keep.push(cands[i].idx);
      return { type: 'setWorkers', playerId, cityId: cid, workers: keep, taxmen: taxmen + 1, scientists };
    }
  }
  return null;
}

// Step 3: rate + specialists spent — switch to a government with a higher rate
// cap if one is available and we're not mid-revolution. Reuses the monotonic
// government picker; only fires when it yields a strictly better cap.
function deficitGovernment(state, playerId, ruleset, S) {
  const me = state.players[playerId];
  if (me.revolutionTurns !== undefined) return null;
  const cur = me.government === undefined ? 'despotism' : me.government;
  const curCap = ruleset.governments[cur].maxRate === undefined ? 60 : ruleset.governments[cur].maxRate;
  const want = pickGovernment(state, playerId, ruleset, S);
  if (want === cur) return null;
  const wantCap = ruleset.governments[want].maxRate === undefined ? 60 : ruleset.governments[want].maxRate;
  if (wantCap > curCap && govRank(want) > govRank(cur)) {
    return { type: 'setGovernment', playerId, government: want };
  }
  return null;
}

function pickCommand(state, playerId, ruleset, done, stance) {
  const me = state.players[playerId];
  // stance-mix v1: an explicit stance argument wins (regent seats); otherwise
  // an AI civ uses its assigned player.stance field (absent = balanced). This
  // is what lets createGame's seeded builder assignment drive the AI.
  const effStance = stance !== undefined ? stance : me.stance;
  const S = stanceOf(effStance); // balanced (or omitted/absent) = the identity
  const marchR = marchRadiusOf(ruleset, S); // B13f: sweepable via rules.json
  // #35 naval-invade-B: the launch heuristic ratio (stackAttackSum >= ratio% x KNOWN defense).
  // A rules.json knob (omit-safe 300 = the 3:1 opening bid); moves rulesetHash (stamp).
  const invadeRatioPct = ruleset.rules.invadeRatioPct === undefined ? 300 : ruleset.rules.invadeRatioPct;

  // #22 XV §11 (§19): MULTI-CITY disorder → the empire LUXURY playbook FIRST (before the per-city
  // entertainer, per the operative user ruling). It is a rate change, so it claims done.rates (one
  // rate change/turn; the §13 deficit ladder defers this turn). The entertainer below mops up any
  // residual + single-city disorder (§11's entertainer-first order applies to the single-city case).
  if (!done.rates) {
    const luxCmd = disorderLuxCommand(state, playerId, ruleset);
    if (luxCmd !== null) { done.rates = true; return luxCmd; }
  }

  if (!done.happiness) {
    done.happiness = true; // one assignment change per turn — gradual
    const cmd = happinessCommand(state, playerId, ruleset);
    if (cmd) return cmd;
  }

  // D3: the AI diplomacy step — negotiate with met rivals (declare/offer/accept/
  // reject). Omit-safe: does nothing until civs have met + relations exist.
  if (done.diplo === undefined) done.diplo = {};
  const diploCmd = diplomacyStep(state, playerId, ruleset, done.diplo);
  if (diploCmd) return diploCmd;

  if ((me.researching === '' || me.researching === undefined) && !done.research) {
    done.research = true;
    const avail = availableTechs(state, playerId, ruleset);
    if (avail.length > 0) {
      // beeline Monarchy first (Civ 1 AIs rush a government); breadth-first
      // level-order research would otherwise not reach it in 400 turns.
      const monarchyPath = {};
      if (me.techs.indexOf('monarchy') === -1) markTechPath(ruleset, 'monarchy', monarchyPath);
      // B21(b): also pull the earliest attacker tech into the beeline while the
      // civ has no offensive unit yet — knob-weighted (rules.aiAttackerTechWeight;
      // 0 = the old monarchy-only rush). The weight discounts attacker-path techs
      // by that many levels, so a higher knob rushes them ahead of monarchy.
      const atkWeight = ruleset.rules.aiAttackerTechWeight === undefined ? 0 : ruleset.rules.aiAttackerTechWeight;
      const atkPath = {};
      if (atkWeight > 0 && bestAttackerUnit(me, ruleset) === null) {
        const at = attackerTech(ruleset);
        if (at !== '') markTechPath(ruleset, at, atkPath);
      }
      // N3: a NAVAL civ beelines the earliest ship tech — but AFTER government
      // (economy stays foundational): only once monarchy is secured and the civ
      // has no ship yet. Same mechanism as the attacker beeline, no level discount
      // (it never preempts monarchy — monarchyPath is empty once monarchy is known).
      const navPath = {};
      if (me.techs.indexOf('monarchy') !== -1 && bestSeaUnit(me, ruleset) === null
          && navyPriorityOf(state, playerId, ruleset)) {
        const nt = seaTech(ruleset);
        if (nt !== '') markTechPath(ruleset, nt, navPath);
      }
      // naval-presence M4 (#2201 Q4): an island-SATURATED naval civ beelines the earliest
      // OCEAN-CAPABLE carrier tech (sail@navigation). A coastal (trireme) hull is confined to
      // the shore by M3, so a stranded island civ needs the ocean hull to cross open water to
      // far islands. Deterministic (markTechPath DAG walk, no discount); navigation's prereqs
      // pull in map-making first, so this sequences the trireme tech then the sail tech. (v1
      // trigger: saturated + naval + lacks the ocean tech — see preopen; a needsOcean "no
      // narrow-strait" refinement is deferred pending witness measurement.)
      const oceanPath = {};
      const ot = oceanTech(ruleset);
      if (me.techs.indexOf('monarchy') !== -1 && ot !== '' && me.techs.indexOf(ot) === -1
          && navyPriorityOf(state, playerId, ruleset)
          && navalFacts(done, state, playerId, ruleset).sat
          && needsOcean(state, playerId, me, ruleset)) {
        markTechPath(ruleset, ot, oceanPath);
      }
      // #36 N1a: after Monarchy, beeline the stance's TARGET GOVERNMENT tech (republic/democracy)
      // so the AI reaches its govTarget instead of stalling at monarchy forever (the measured
      // pathology: pickGovernment is correct but starved of tech). SUBORDINATE to spacePath (a
      // committed civ's space beeline supersedes — XII.5b precedent, so the two never fight); a
      // PEER of the attacker/naval paths (picked by level, so republic's prereqs walk in first).
      // Only while the civ lacks the target tech; aggressive (govTarget monarchy) leaves it empty.
      const govPath = {};
      const govTech = govTargetTech(ruleset, S);
      if (me.techs.indexOf('monarchy') !== -1 && govTech !== '' && me.techs.indexOf(govTech) === -1) {
        markTechPath(ruleset, govTech, govPath);
      }
      // XII.5b Q3: a space-COMMITTED civ prefers the space-flight prerequisite
      // closure — Apollo's tech + every ssPart tech — and SUPERSEDES the monarchy/
      // attacker/naval paths (a committed civ is past early-game). If no space-path
      // tech is researchable the pool falls back to everything (the off-path escape).
      // markTechPath is the engine-side DAG walk — no shared/beeline import.
      const spacePath = {};
      if (spaceCommitted(state, playerId, ruleset)) {
        const apolloTech = ruleset.wonders[ruleset.rules.ssFlight.gateWonder].tech;
        if (apolloTech !== undefined && apolloTech !== '') markTechPath(ruleset, apolloTech, spacePath);
        const parts = ruleset.rules.ssParts;
        for (const k of Object.keys(parts)) markTechPath(ruleset, parts[k].tech, spacePath);
      }
      const committedSpace = Object.keys(spacePath).length > 0;
      // #36 N1a: is any FUNCTIONAL beeline still active (economy/military/navy not yet secured)?
      // The gov beeline defers to these — it only fires once they are satisfied.
      const funcBeelineActive = Object.keys(monarchyPath).length > 0 || Object.keys(atkPath).length > 0
        || Object.keys(navPath).length > 0 || Object.keys(oceanPath).length > 0;
      let pool = avail;
      const onPath = [];
      for (const id of avail) {
        if (spacePath[id] === true) onPath.push(id);
        else if (!committedSpace && (monarchyPath[id] === true || atkPath[id] === true || navPath[id] === true || oceanPath[id] === true)) onPath.push(id);
        // #36 N1a: the gov beeline is the LOWEST priority — it contributes ONLY when no functional
        // beeline (monarchy/attacker/naval/ocean) is still active, so a civ secures its economy +
        // basic military/navy FIRST, then heads for its target government (attacker-then-gov; the
        // naval beeline stays load-bearing). Subordinate to space via !committedSpace.
        else if (!committedSpace && govPath[id] === true && !funcBeelineActive) onPath.push(id);
      }
      if (onPath.length > 0) pool = onPath;
      let best = pool[0];
      let bestEff = ruleset.techs[best].level - (atkPath[best] === true ? atkWeight : 0);
      for (const id of pool) {
        const eff = ruleset.techs[id].level - (atkPath[id] === true ? atkWeight : 0);
        if (eff < bestEff) { best = id; bestEff = eff; }
      }
      return { type: 'setResearch', playerId, tech: best };
    }
  }

  // xiv-ai §13: the deficit ladder — BEFORE the science-max branch, for ALL
  // stances. When the treasury is draining (net income < 0) and can't ride it
  // out (gold below the cushion), climb tax-bump -> taxmen -> government. Marking
  // done.rates suppresses the science-max below for a struggling civ. Non-deficit
  // civs skip this untouched, so only civs in a real deficit change behavior.
  if (!done.rates) {
    const inc = playerIncome(state, playerId, ruleset);
    const net = inc.gold - inc.maintenance;
    const cushion = ruleset.rules.deficitGoldCushion === undefined ? 3 : ruleset.rules.deficitGoldCushion;
    if (net < 0 && me.gold < cushion * (-net)) {
      done.rates = true;
      const bump = deficitTaxBump(state, playerId, ruleset);
      if (bump) return bump;
      const tm = deficitTaxmen(state, playerId, ruleset);
      if (tm) return tm;
      const gv = deficitGovernment(state, playerId, ruleset, S);
      if (gv) return gv;
      // unsolvable this turn — done.rates stays set, nothing more to do
    }
  }

  // A40 science stance ONLY: prefer science when the empire is disorder-free
  // (a setRates the balanced AI never issues — gated on the stance, so the
  // sim's balanced games never reach this branch). One rate change per turn.
  if (S.sciRates && !done.rates) {
    done.rates = true;
    let anyDisorder = false;
    for (const cid of state.cityOrder || []) {
      const c = state.cities[cid];
      if (c && c.owner === playerId && c.disorder === true) { anyDisorder = true; break; }
    }
    if (!anyDisorder) {
      const gov = ruleset.governments[me.government === undefined ? 'despotism' : me.government];
      const cap = gov.maxRate === undefined ? 60 : gov.maxRate;
      const sci = cap;
      const tax = 100 - sci <= cap ? 100 - sci : cap;
      if (me.sciRate !== sci) return { type: 'setRates', playerId, tax, sci, lux: 100 - sci - tax };
    }
  }

  // Government re-eval (specs/government-reeval.md): each turn (outside a
  // revolution) the AI advances toward its stance's govTarget — Despotism →
  // Monarchy → Republic → Democracy — but only ever UP the rank ladder (the
  // monotone govRank guard = no thrash, so a democracy civ never downgrades in
  // war; the war-state gate is applied at ADOPTION via govSafe in pickGovernment).
  // #36 N1b raised the cap from Republic to Democracy so republic civs whose
  // stance targets democracy can take the final step (republic-targeters re-pick
  // their own gov = no change). Era is implicit via N1a's tech beeline.
  if (!done.government && me.revolutionTurns === undefined) {
    done.government = true;
    const cur = me.government === undefined ? 'despotism' : me.government;
    if (govRank(cur) < GOV_RANK.democracy) {
      const want = pickGovernment(state, playerId, ruleset, S);
      if (want !== cur && govRank(want) > govRank(cur)) {
        return { type: 'setGovernment', playerId, government: want };
      }
    }
  }

  // B21(c): rush-buy a threatened city's military production (one per turn)
  if (!done.buy) {
    done.buy = true;
    const cmd = rushBuyCommand(state, playerId, ruleset);
    if (cmd) return cmd;
  }


  // #30 unit-bloat DRAIN valve: a civ well OVER its capped attacker target disbands ONE obsolete
  // attacker/turn — but only a SAFE one (no enemy within 2, so it never disbands a unit holding a
  // front). The armyTarget cap stops NEW growth; this DRAINS the legacy bloat the cap alone can't
  // recover (seed-6 1002 units; witness-7 saves start bloated), freeing upkeep for research (the
  // space runway). Deterministic (sorted unitId); disbandOverBy hysteresis vs the build boundary.
  if (!done.disband) {
    done.disband = true;
    // #30 the measured bloat is OBSOLETE DEFENDERS (phalanx piling up under the garrison build),
    // not just attackers — drain BOTH classes, each vs ITS OWN cap: attackers vs the capped
    // armyTarget, defenders vs the garrison cap (armyCapPerCity*cities). Obsolete + safe only.
    let armyTarget = countCities(state, playerId) * attackerPerCityOf(ruleset, S) + attackerBaseOf(ruleset, S);
    if (armyTarget > BUILD_LEVER.armyTargetCap) armyTarget = BUILD_LEVER.armyTargetCap;
    const garrisonCap = countCities(state, playerId) * S.armyCapPerCity;
    const nAtt = countAttackers(state, playerId, ruleset);
    const nDef = countMilitary(state, playerId, ruleset) - nAtt;
    const attOver = nAtt > armyTarget + BUILD_LEVER.disbandOverBy;
    const defOver = nDef > garrisonCap + BUILD_LEVER.disbandOverBy;
    if (attOver || defOver) {
      for (const uid of sortIds(Object.keys(state.units))) {
        const u = state.units[uid];
        if (u.owner !== playerId || u.aboard !== undefined) continue;
        const def = ruleset.units[u.type];
        if (def.domain !== 'land' || def.attack <= 0) continue; // land combat unit (never a civilian)
        // #30 STRENGTHEN (#2289): CAP-gated, NOT obsolescence-gated. The endemic-war seeds are
        // LOW-TECH (units never obsolete, gateTechTurn t400-500) so the old unitObsolete gate left
        // the valve dormant on exactly the most-bloated seeds. Over-cap SAFE units drain regardless
        // of obsolescence — the cap+garrisonCap keep a full garrison; the safe-filter protects fronts.
        if (enemyNear(state, me, playerId, u.x, u.y, 2)) continue; // safe front only
        const isAttacker = def.attack > def.defense;
        if (isAttacker ? !attOver : !defOver) continue;         // only the class over its own cap
        return { type: 'disband', playerId, unitId: uid };
      }
    }
  }

  // #36 N2: a SOLVENT civ MODERNIZES an obsolete garrison. The AI never issued upgradeUnit, so late
  // armies kept the ancient units built early (obsolete units mixed with modern new-builds). A unit
  // standing in an OWNED city whose type is OBSOLETE (obsoletedBy known) and has an affordable
  // upgradesTo successor (its tech known) upgrades ONE step per turn (deterministic, sorted id).
  // Gold-gated with a reserve so it never drains the treasury. AFTER the disband valve, so an
  // over-cap civ sheds bloat FIRST, then modernizes what it keeps.
  if (!done.upgrade) {
    done.upgrade = true;
    const up = ruleset.rules.upgrade;
    if (up !== undefined) {
      for (const uid of sortIds(Object.keys(state.units))) {
        const u = state.units[uid];
        if (u.owner !== playerId || u.aboard !== undefined) continue;
        const def = ruleset.units[u.type];
        if (!unitObsolete(def, me.techs)) continue; // modernize OBSOLETE units only
        const targetId = def.upgradesTo;
        if (targetId === undefined) continue;
        const newDef = ruleset.units[targetId];
        if (newDef === undefined) continue;
        if (newDef.tech !== '' && me.techs.indexOf(newDef.tech) === -1) continue; // successor tech known
        const city = cityAt(state, u.x, u.y);
        if (!city || city.owner !== playerId) continue; // must stand in an owned city (upgrade rule)
        const diff = newDef.cost - def.cost;
        const cost = up.baseGold + up.goldPerShield * (diff > 0 ? diff : 0); // mirrors upgrade.js upgradeCost
        if (me.gold < cost + BUILD_LEVER.upgradeGoldReserve) continue; // affordable AND keep the reserve
        return { type: 'upgradeUnit', playerId, unitId: uid };
      }
    }
  }

  // A76: launch a completed, un-launched ship — the win condition. Gated on the
  // race being open (Apollo + techs), so this is dormant until a civ reaches space.
  if (!done.launch && apolloReady(state, me, ruleset)) {
    done.launch = true;
    const ship = me.spaceship;
    const launched = ship !== undefined && ship.launched !== undefined && ship.launched !== 0;
    if (ship !== undefined && !launched && nextSsPart(ship, ruleset) === null) {
      return { type: 'launchShip', playerId };
    }
  }

  // N3: naval doctrine, computed once per turn (empire-wide). A naval civ builds
  // ships in its COASTAL cities once it has a land core, up to 1 per coastal city
  // capped at rules.aiNavyTargetCap. The ships then range as B23b boat-scouts.
  const navyPriority = navyPriorityOf(state, playerId, ruleset);
  const navySeaUnit = bestSeaUnit(me, ruleset);
  const navyAfterLand = ruleset.rules.aiNavyAfterLandUnits === undefined ? 3 : ruleset.rules.aiNavyAfterLandUnits;
  const navyCap = ruleset.rules.aiNavyTargetCap === undefined ? 4 : ruleset.rules.aiNavyTargetCap;
  let navyTarget = 0;
  if (navyPriority && navySeaUnit !== null) {
    let coastal = 0;
    for (const cid of state.cityOrder || []) {
      const c = state.cities[cid];
      if (c && c.owner === playerId && isCoastal(state, c.x, c.y, ruleset)) coastal = coastal + 1;
    }
    navyTarget = coastal < navyCap ? coastal : navyCap;
  }
  const navyWant = navyPriority && navySeaUnit !== null
    && countLandMilitary(state, playerId, ruleset) >= navyAfterLand
    && countShips(state, playerId, ruleset) < navyTarget;

  for (const cid of state.cityOrder || []) {
    if (done['c:' + cid]) continue;
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    done['c:' + cid] = true;
    const defenders = unitsAt(state, city.x, city.y).filter(u => u.owner === playerId);
    const bestDefender = bestDefenderUnit(me, ruleset);
    // Defend first — TWO garrisons when a known enemy is within 8 of the
    // city, one in peacetime; then expand while settlers are scarce
    // (capped — endless settler spam grows armies without bound once the
    // land is full, docs/05 §1); saturated empires improve instead:
    // cheapest missing building, then the cheapest available wonder. With
    // nothing buildable (a tech-starved civ) garrisons cap at 3 and
    // further shields go to settlers — pavers whose roads create the
    // trade that ends the tech drought (docs/05 §10-11).
    // stance knobs (balanced = the historical literals, so this is unchanged
    // for the sim): defensive always wants 2 guards; growth wants more
    // settlers; aggressive raises the empire army cap.
    const threatened = enemyNear(state, me, playerId, city.x, city.y, ruleset.rules.threatRadius);
    const wantDefenders = (S.garrisonAlways2 || threatened) ? 2 : 1;
    let want = { kind: 'unit', id: bestDefender };
    // N9b HOIST (Finding-3 fix, architect @50f5ebd3 + the min-garrison finding):
    // the builder wonder-drive is CAPITAL-INTENT ("some civs MUST build wonders"),
    // not surplus-disposal — a FIRST-CLASS check ABOVE the garrison/saturation
    // cascade. The gate is NOT-THREATENED alone (enemyNear false): the approved
    // min-garrison-1 still never fired because the capital's militia scout away
    // (scoutSharePct) so it holds 0 defenders exactly at the wonder window — so
    // !threatened IS the frontier-safety guard (re-checked every turn; a menaced
    // capital falls through to the defense cascade, reverting even mid-wonder).
    // Persist (R1(3)): keep the in-progress wonder ID, never re-pick cheapest.
    let wonderDriven = false;
    // apollo-narrow (#2160, user-ruled STAGED-BOTH slice 1): a space-COMMITTED civ that
    // holds Apollo's tech and has Apollo unbuilt builds apollo-program in its CAPITAL as its
    // TOP choice — opening the ss-part gate EARLIER than spaceDriveEligible (which waits for
    // EVERY part tech). Committed civs ONLY (uncommitted stay byte-identical); the
    // spaceDriveEligible parts path below shares the same cheb-1 migration (#2187).
    // Capital danger is CONCRETE cheb-1 adjacency (see the inner guard), not radius-8.
    // spaceCommitted is the LAST, most-expensive check so it runs only for the
    // capital of a tech-holding civ with Apollo unbuilt. Gold-rush stays forbidden (#1899).
    if (!wonderDriven) {
      const f = ruleset.rules.ssFlight;
      const acap = capitalOf(state, playerId, ruleset);
      // radius-mismatch fix (#2187): the capital-danger guard is CONCRETE cheb-1 adjacency
      // (mirrors spaceCommitEligible's enemyNear(cap,1)), NOT the radius-8 `threatened` metric
      // #2138/#2125 retired on the commit side — so a committed capital builds Apollo while a
      // DISTANT enemy is present and reverts only on a real adjacent threat.
      if (f !== undefined && acap !== null && acap !== undefined && acap.id === cid
          && !enemyNear(state, me, playerId, city.x, city.y, 1)
          && !wonderActive(state, f.gateWonder, ruleset)) {
        const apollo = ruleset.wonders[f.gateWonder];
        if (apollo !== undefined && (apollo.tech === '' || me.techs.indexOf(apollo.tech) !== -1)
            && spaceCommitted(state, playerId, ruleset)) {
          want = { kind: 'wonder', id: f.gateWonder }; wonderDriven = true;
        }
      }
    }
    // #26 archetype-wonders: the appetite wonder-drive generalizes the builder-only wonderDrive.
    // A non-NONE-appetite civ persists its in-flight wonder in the drive city (any tier) and, when
    // its tier gate opens (appetiteStart: HIGH at wonderMinShields; MED also needs core buildings;
    // LOW needs the higher shield bar AND an established, many-city empire), STARTS a stance-
    // appropriate wonder there. Wonders concentrate in the civ's HIGHEST-SHIELD city (one in flight
    // per civ) so they complete fastest — a wide civ's capital is often not its strongest city.
    if (S.wonderAppetite !== undefined && S.wonderAppetite !== 'none' && !threatened) {
      const driveCity = highestShieldCity(state, playerId, ruleset);
      if (driveCity !== null && driveCity !== undefined && driveCity.id === cid) {
        const held = (city.producing.kind === 'wonder'
          && (state.wonders === undefined || state.wonders[city.producing.id] === undefined))
          ? city.producing.id : null;
        if (held !== null) {
          want = { kind: 'wonder', id: held }; wonderDriven = true; // persist own wonder (any appetite)
        } else if (appetiteStart(S, driveCity, state, playerId, ruleset)
            && !civWonderInFlight(state, playerId)) {
          const w = nextWonderFor(state, me, ruleset, effStance);
          if (w !== null) { want = { kind: 'wonder', id: w }; wonderDriven = true; } // start new (tier-gated)
        }
      }
    }
    // XII.5: the space victory drive is a FIRST-CLASS capital intent (mirrors the N9b
    // wonder-drive hoist above) — an eligible committed civ builds Apollo, then ship
    // parts, in its CAPITAL, ABOVE the garrison/saturation cascade, so it fires even
    // when the capital's garrison roamed off (the 0/12 gap: an eligible civ perpetually
    // rebuilt a defender instead of Apollo). The frontier-safety guard is CONCRETE cheb-1
    // capital adjacency (#2187 migration — a menaced capital reverts, but a DISTANT enemy no
    // longer stalls the parts path). Gated on end-tier eligibility, so early/mid/crafted never reach it.
    if (!wonderDriven && spaceDriveOn(ruleset, effStance) && spaceDriveEligible(state, me, ruleset)) {
      const scap = capitalOf(state, playerId, ruleset);
      // radius-mismatch fix (#2187): cheb-1 concrete capital danger, not radius-8 `threatened`
      // (the parts path shared the apollo-narrow bug — same migration).
      if (scap !== null && scap !== undefined && scap.id === cid
          && !enemyNear(state, me, playerId, city.x, city.y, 1)) {
        const ship = me.spaceship;
        const launched = ship !== undefined && ship.launched !== undefined && ship.launched !== 0;
        if (!launched) {
          const part = nextSsPart(ship, ruleset);
          if (!wonderActive(state, ruleset.rules.ssFlight.gateWonder, ruleset)) {
            want = { kind: 'wonder', id: ruleset.rules.ssFlight.gateWonder }; wonderDriven = true;
          } else if (part !== null) {
            want = { kind: 'ss-part', id: part }; wonderDriven = true;
          }
        }
      }
    }
    if (!wonderDriven && defenders.length >= wantDefenders) {
      // §40: never queue a settler where completing it would self-disband the
      // city (pop <= its pop cost) — the AI guard (a human MAY, deliberately).
      const settlerPopCost = ruleset.units['settlers'].popCost === undefined ? 0 : ruleset.units['settlers'].popCost;
      if (city.pop > settlerPopCost
          && countSettlers(state, playerId) < S.settlerBase + idiv(countCities(state, playerId), S.settlerDiv)) {
        want = { kind: 'unit', id: 'settlers' };
      } else {
        // B13g: a THREATENED city walls up first (a known enemy within 8),
        // masonry known and not already walled — before any other building.
        // 0/36 walled at t300 was the gap; balanced now reacts to real danger.
        const wallsDef = ruleset.buildings['city-walls'];
        const canWall = threatened && wallsDef !== undefined
          && (city.buildings === undefined || city.buildings.indexOf('city-walls') === -1)
          && (wallsDef.tech === '' || me.techs.indexOf(wallsDef.tech) !== -1);
        // B21(a): the offensive army gets a REAL build-order slot — right after
        // walls, ABOVE buildings/wonders. The re-baseline (sim-runner #534) found
        // attacker-type units = 0 at t400 because the old branch sat behind
        // buildings+wonders, which never run dry. Now: while the empire is under
        // its attacker target, a saturated city builds the attacker first. Empire-
        // wide target so it is a standing army, not a per-city stack. Sweepable
        // via rules.attackerPerCity/attackerBase (stance pct passthrough).
        const attacker = bestAttackerUnit(me, ruleset);
        // #30 unit-bloat cap: the per-city*cities target is UNBOUNDED (seed-6 1002 units); clamp it
        // to armyTargetCap so a wide empire stops piling on attackers and spends the shields on
        // buildings/research instead (the space runway). BUILD_LEVER knob, sweepable.
        let armyTarget = countCities(state, playerId) * attackerPerCityOf(ruleset, S)
          + attackerBaseOf(ruleset, S);
        if (armyTarget > BUILD_LEVER.armyTargetCap) armyTarget = BUILD_LEVER.armyTargetCap;
        const underArmy = attacker !== null && countAttackers(state, playerId, ruleset) < armyTarget;
        // N9 / stance-mix v1: the economy pick (cheapest missing building, else
        // the cheapest eligible wonder) for the dead-last fallback, PLUS the
        // defending-builder RESERVE (defBuild). econReserve comes from the STANCE
        // (S.econReserve): balanced 0 = inert (identity), the 'builder' stance 99.
        // A defendFirst stance builds economy in the NORMAL block (after the full
        // garrison + walls) — its attackerPct-0 removes the standing-army
        // treadmill so the reserve is actually reached. Wonders are CONCENTRATED
        // in the capital (capitalOf, pop-2+) so they complete instead of racing.
        const econBuilding = stanceBuilding(city, me, ruleset, S);
        const econWonder = econBuilding === null ? nextWonder(state, me, ruleset) : null;
        const econItem = econBuilding !== null ? { kind: 'building', id: econBuilding }
          : econWonder !== null ? { kind: 'wonder', id: econWonder } : null;
        const econReserve = S.econReserve === undefined ? 0 : S.econReserve;
        const builtCount = city.buildings === undefined ? 0 : city.buildings.length;
        let defBuild = null;
        if (S.defendFirst === true && econReserve > 0 && builtCount < econReserve) {
          const cap = capitalOf(state, playerId, ruleset);
          const isCap = cap !== null && cap !== undefined && cap.id === cid;
          const pw = ((isCap && builtCount >= 2) || econBuilding === null) ? nextWonder(state, me, ruleset) : null;
          defBuild = (isCap && builtCount >= 2 && pw !== null) ? { kind: 'wonder', id: pw }
            : econBuilding !== null ? { kind: 'building', id: econBuilding }
            : pw !== null ? { kind: 'wonder', id: pw } : null;
        }
        if (canWall) {
          want = { kind: 'building', id: 'city-walls' };
        } else if (defBuild !== null) {
          want = defBuild; // stance-mix: the defending-builder's economy reserve
        } else if (underArmy) {
          want = { kind: 'unit', id: attacker };
        } else if (isCoastal(state, city.x, city.y, ruleset)
                   && bestCarrierUnit(me, ruleset) !== null
                   && !hasFreeCarrier(state, playerId, ruleset)
                   && navalFacts(done, state, playerId, ruleset).sat
                   && navalFacts(done, state, playerId, ruleset).opportunity) {
          // naval-presence M1 (#2201 Q1): the civ has a settler stranded on a SATURATED
          // island (no reachable land site) and no carrier to ferry it -> a coastal city
          // builds the best available carrier. STRICT saturation gate; cheap guards first
          // so the settler scan short-circuits. The carrier then scouts open water (M2)
          // and, once loaded, sails coast-safe (M3).
          want = { kind: 'unit', id: bestCarrierUnit(me, ruleset) };
        } else if (navyWant && isCoastal(state, city.x, city.y, ruleset)) {
          // N3: a coastal city of a naval civ, land core secured, fleet under
          // target -> build a ship (above generic buildings/wonders).
          want = { kind: 'unit', id: navySeaUnit };
        } else if (econItem !== null) {
          want = econItem;
        } else if (defenders.length >= 3
                 || countMilitary(state, playerId, ruleset) >= countCities(state, playerId) * S.armyCapPerCity + S.armyCapBase) {
          // enough army empire-wide: garrison surplus now roams (escorts,
          // explorers), so the LOCAL count alone no longer saturates —
          // without this cap a tech-starved civ mints militia forever
          want = { kind: 'unit', id: 'settlers' };
        }

        // === N9b build-priority (spec a8fe1af) — applies past the garrison floor ===
        // R1 stickiness: an in-progress, still-legal building/wonder is KEPT — never
        // re-decided to a unit on payback/threat flutter (the half-shields category
        // switch makes flutter costly). enemyNear is the only interrupt and it is
        // garrison-gated: we are already inside defenders.length>=wantDefenders, so a
        // fully-garrisoned threatened city still keeps its near-done building/wonder
        // (a menaced UNDER-garrisoned capital never reaches here -> reverts to defence).
        // The builder wonder-drive is hoisted above the cascade (Finding-3 fix).
        const inProgId = city.producing.id;
        const inProgKept = (city.producing.kind === 'wonder'
            && (state.wonders === undefined || state.wonders[inProgId] === undefined))
          || (city.producing.kind === 'building'
            && (city.buildings === undefined || city.buildings.indexOf(inProgId) === -1));
        if (inProgKept) {
          want = city.producing; // persist (R1)
        }
        if (want.kind === 'unit' && !threatened) {
          // the lever (R3: DEFERS to defBuild — if defBuild fired, want is not a unit
          // here). A buildable yield building whose payback is under the stance-scaled
          // ceiling beats the unit; non-yield buildings score no payback (R2).
          const pbMax = idiv(BUILD_LEVER.pbMax * S.pbMult, 100);
          const pick = bestPaybackBuilding(state, city, me, ruleset, pbMax);
          if (pick !== null) want = { kind: 'building', id: pick };
        }
      }
    }
    if (city.producing.kind !== want.kind || city.producing.id !== want.id) {
      return { type: 'setProduction', playerId, cityId: cid, item: want };
    }
  }

  for (const uid of sortIds(Object.keys(state.units))) {
    if (done['u:' + uid]) continue;
    const unit = state.units[uid];
    if (!unit || unit.owner !== playerId || unit.moves <= 0) continue;
    if (unit.working !== undefined) continue; // moving would cancel the job
    // §14 F2: a unit rejected with reason zoc 3 turns-in-a-row is DROPPED for
    // this turn (stop the ping-pong that burns the turn budget); runAiTurn
    // clears zocBlocks at the next turn's start so it re-plans then.
    if (unit.zocBlocks !== undefined && unit.zocBlocks >= 3) { done['u:' + uid] = true; continue; }
    done['u:' + uid] = true;

    // #35 naval-invade-B: the memoized invasion plan (target overseas war city + its continent +
    // KNOWN defense sum). Cheap after the first call this turn; null target = invasion dormant.
    const invasion = invasionFacts(done, state, playerId, ruleset);

    if (unit.type === 'settlers') {
      // naval-loop S3 DISEMBARK: an embarked settler is cargo. Step ashore when the
      // carrier has reached a coast (a landward tile is adjacent); else ride — the
      // carrier sails it in the ship block below. It never self-moves at sea.
      if (unit.aboard !== undefined) {
        const dd = disembarkDir(state, unit, playerId, ruleset);
        if (dd) return { type: 'moveUnit', playerId, unitId: uid, dir: dd };
        continue;
      }
      if (goodCitySpot(state, unit, ruleset)
          && !enemyNear(state, me, playerId, unit.x, unit.y, 2)) {
        return { type: 'foundCity', playerId, unitId: uid };
      }
      // improvers develop the homeland before joining the expansion —
      // roads on worked tiles are the trade that funds all research.
      // Alternating ranks split the corps: even ranks expand, odd improve.
      if (settlerRank(state, playerId, uid) % 2 === 1) {
        const job = bestImprovementJob(state, unit, playerId, ruleset, S.improveFirst);
        if (job) {
          if (job.x === unit.x && job.y === unit.y) {
            return { type: 'startWork', playerId, unitId: uid, work: job.work };
          }
          const dir = safeDirToward(state, me, playerId, unit, job.x, job.y, ruleset);
          if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
        }
      }
      // the expander (and idle improvers): walk to the best known site,
      // avoiding known enemies; a blocked path means HOLD, not wander into
      // the danger that blocked it
      const site = bestCitySite(state, unit, playerId, ruleset);
      if (site) {
        // naval-loop S2 EMBARK (reactive): an OVERSEAS best site (across water from
        // this settler's continent) -> route to a friendly carrier and board. The
        // deliberate board is the ONE land-unit-onto-sea step slice A allows (a
        // moveUnit onto the carrier's tile; movement.js sets aboard) — it never uses
        // the N3 stepEntersSea-guarded fallbacks below.
        if (isOverseasSite(state, unit.x, unit.y, site.x, site.y, ruleset)) {
          const carrier = nearestOwnCarrier(state, unit, playerId, ruleset);
          if (carrier) {
            if (chebyshev(state.map, unit.x, unit.y, carrier.x, carrier.y) <= 1) {
              const b = dirToward(state.map, unit.x, unit.y, carrier.x, carrier.y);
              if (b) return { type: 'moveUnit', playerId, unitId: uid, dir: b };
            }
            let m = bfsStepToward(state, me, playerId, unit, carrier.x, carrier.y, ruleset);
            if (!m) m = safeDirToward(state, me, playerId, unit, carrier.x, carrier.y, ruleset);
            if (m) return { type: 'moveUnit', playerId, unitId: uid, dir: m };
          }
          // no boardable carrier yet: pave in place while a coastal city builds one
          const t0 = state.map.tiles[unit.y * state.map.width + unit.x];
          if (ruleset.terrain.terrains[t0.t].domain === 'land' && t0.road !== true) {
            return { type: 'startWork', playerId, unitId: uid, work: 'road' };
          }
          continue;
        }
        // §12: BFS around inlets to the site; greedy is the safe floor (today's
        // behavior) when no bounded land path exists, then HOLD (never wander
        // into the danger that blocked it).
        let dir = bfsStepToward(state, me, playerId, unit, site.x, site.y, ruleset);
        if (!dir) dir = safeDirToward(state, me, playerId, unit, site.x, site.y, ruleset);
        if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
        continue;
      }
      // no reachable site: pave where it stands — roads make trade, and
      // trade is the AI's only path to research (docs/04 AI improvements v0)
      const tile = state.map.tiles[unit.y * state.map.width + unit.x];
      if (ruleset.terrain.terrains[tile.t].domain === 'land' && tile.road !== true) {
        return { type: 'startWork', playerId, unitId: uid, work: 'road' };
      }
      const dir = towardBetterLand(state, unit, ruleset);
      if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
      continue;
    }

    // #35 naval-invade-B SAIL: a carrier carrying an INVASION force (military cargo) sails to
    // the target city's coast — but ONLY once the launch heuristic passes (stackAttackSum >=
    // ratio% x the KNOWN, walls-aware defense). Until then it HOLDS at its launch coast
    // accumulating force (the "inferior stack never launches" control). Checked BEFORE the
    // settler-sail so a military carrier never mistakes an invasion for a settlement run.
    if (ruleset.units[unit.type].domain === 'sea' && invasion.target !== null
        && militaryCargo(state, unit.id, ruleset) > 0) {
      const t = invasion.target;
      if (cargoAttackSum(state, unit.id, ruleset) * 100 < invadeRatioPct * invasion.defSum) {
        return { type: 'wait', playerId, unitId: uid }; // force below the ratio: hold and gather
      }
      if (chebyshev(state.map, unit.x, unit.y, t.x, t.y) <= 1) {
        return { type: 'wait', playerId, unitId: uid }; // at the city's coast: hold for the disembark
      }
      const idir = seaStepToward(state, unit, t.x, t.y, ruleset);
      if (idir) return { type: 'moveUnit', playerId, unitId: uid, dir: idir };
      return { type: 'wait', playerId, unitId: uid }; // no sea path in range: hold
    }

    // naval-loop S3 SAIL: a carrier WITH cargo aboard sails to the coast adjacent to
    // the nearest overseas settlement site, then HOLDS there while the cargo disembarks
    // (handled in the settler block). Empty carriers fall through to N3 scout/patrol.
    if (ruleset.units[unit.type].domain === 'sea' && carrierCargo(state, unit.id) > 0) {
      const homeSet = homeContinents(state, playerId, ruleset);
      const dest = nearestOverseasSite(state, unit.x, unit.y, homeSet, me, ruleset);
      if (dest) {
        if (chebyshev(state.map, unit.x, unit.y, dest.x, dest.y) <= 1) {
          return { type: 'wait', playerId, unitId: uid }; // at landfall: hold for disembark
        }
        const sdir = seaStepToward(state, unit, dest.x, dest.y, ruleset);
        if (sdir) return { type: 'moveUnit', playerId, unitId: uid, dir: sdir };
        return { type: 'wait', playerId, unitId: uid }; // no sea path in range: hold
      }
    }

    // naval-presence M2b (#2201): an EMPTY carrier ferries — it steers to an own overseas-
    // blocked settler and HOLDS beside it (pickup) instead of scouting away, so the two
    // rendezvous (a roaming scout-carrier never meets a chasing settler). Coast-safe (M3).
    // Only when the civ actually has a ferry job; else the carrier falls through to scout.
    if (ruleset.units[unit.type].domain === 'sea' && carrierCargo(state, unit.id) === 0
        && carrierFreeSlots(state, unit, ruleset) > 0) {
      const ward = nearestWard(navalFacts(done, state, playerId, ruleset).wards, state, unit);
      if (ward) {
        if (chebyshev(state.map, unit.x, unit.y, ward.x, ward.y) <= 1) {
          return { type: 'wait', playerId, unitId: uid }; // beside the settler: hold for it to board
        }
        const pdir = seaStepToward(state, unit, ward.x, ward.y, ruleset);
        if (pdir) return { type: 'moveUnit', playerId, unitId: uid, dir: pdir };
        // no coast-safe path to the settler: fall through to scout (M2)
      }
    }

    // #35 naval-invade-B PICKUP: an empty carrier with a boardable safe attacker nearby (and
    // no settler ferry taking priority) HOLDS beside it so the attacker can board, instead of
    // scouting away — the military mirror of the settler M2b rendezvous. Only with a live target.
    if (ruleset.units[unit.type].domain === 'sea' && invasion.target !== null
        && carrierCargo(state, unit.id) === 0 && carrierFreeSlots(state, unit, ruleset) > 0) {
      const inv = nearestBoardableAttacker(state, unit, playerId, ruleset, BUILD_LEVER.invasionStageRadius);
      if (inv) {
        if (chebyshev(state.map, unit.x, unit.y, inv.x, inv.y) <= 1) {
          return { type: 'wait', playerId, unitId: uid }; // beside the attacker: hold for it to board
        }
        const idir = seaStepToward(state, unit, inv.x, inv.y, ruleset);
        if (idir) return { type: 'moveUnit', playerId, unitId: uid, dir: idir };
        // no coast-safe path: fall through to scout
      }
    }

    // #35 naval-invade-B (land attacker): the overseas-invasion behavior — RIDE/DISEMBARK on the
    // target continent, ASSAULT once landed (odds-gated per-unit, NOT massSize-gated: a landing
    // party is small and the launch heuristic already vetted the force), else STAGE (a safe
    // attacker near a free carrier boards it). Placed before the generic land logic so invaders
    // aren't blocked by the massSize march gate; a non-staging attacker falls through unchanged.
    if (invasion.target !== null && ruleset.units[unit.type].domain === 'land'
        && ruleset.units[unit.type].attack > ruleset.units[unit.type].defense) {
      const t = invasion.target, comp = invasion.targetComp, map = state.map;
      if (unit.aboard !== undefined) {
        const dd = invadeDisembarkDir(state, unit, playerId, t, comp, ruleset);
        if (dd) return { type: 'moveUnit', playerId, unitId: uid, dir: dd };
        continue; // no landfall yet: ride the carrier
      }
      if (comp[unit.y * map.width + unit.x] === true) {
        // landed on the target continent: march to the city and assault per-unit (odds-gated).
        const D = warDoctrineOf(ruleset);
        if (chebyshev(map, unit.x, unit.y, t.x, t.y) <= 1) {
          if (assaultOddsOk(state, unit, t.x, t.y, ruleset, D.oddsGatePct)) {
            const adir = dirToward(map, unit.x, unit.y, t.x, t.y);
            if (adir && !stepEntersSea(state, unit, adir, ruleset)) return { type: 'moveUnit', playerId, unitId: uid, dir: adir };
          }
          return { type: 'wait', playerId, unitId: uid }; // adjacent but bad odds: hold the beachhead
        }
        const cdir = dirToward(map, unit.x, unit.y, t.x, t.y);
        if (cdir && !stepAttackBlocked(state, unit, cdir, playerId, ruleset, D.oddsGatePct)
            && !stepEntersSea(state, unit, cdir, ruleset)) {
          return { type: 'moveUnit', playerId, unitId: uid, dir: cdir };
        }
        return { type: 'wait', playerId, unitId: uid }; // blocked: hold on the beachhead
      }
      // on a home continent: STAGE — a safe attacker near a free carrier boards it (the one
      // deliberate land->sea step, like the settler embark). Bounded by carrier capacity + the
      // stage radius; a front-line attacker (enemy within 2) never diverts. Else fall through.
      if (!enemyNear(state, me, playerId, unit.x, unit.y, 2)) {
        const carrier = nearestOwnCarrier(state, unit, playerId, ruleset);
        if (carrier && chebyshev(map, unit.x, unit.y, carrier.x, carrier.y) <= BUILD_LEVER.invasionStageRadius) {
          if (chebyshev(map, unit.x, unit.y, carrier.x, carrier.y) <= 1) {
            const b = dirToward(map, unit.x, unit.y, carrier.x, carrier.y);
            if (b) return { type: 'moveUnit', playerId, unitId: uid, dir: b }; // board
          }
          let m = bfsStepToward(state, me, playerId, unit, carrier.x, carrier.y, ruleset);
          if (!m) m = safeDirToward(state, me, playerId, unit, carrier.x, carrier.y, ruleset);
          if (m && !stepEntersSea(state, unit, m, ruleset)) return { type: 'moveUnit', playerId, unitId: uid, dir: m };
        }
      }
    }

    const enemy = nearestKnownEnemy(state, unit, playerId);
    // B23: a SCOUT is not a garrison — it departs to range the map even when its
    // city is a guard short (the accepted cost of knowing the map, architect
    // ruling @aec2b4db). Non-scouts hold the fort: a garrison stays until its
    // city is safely manned (two guards when a known enemy is within 8, else one).
    const exploreMode = ruleset.rules.aiExploreMode === undefined ? 'bfs' : ruleset.rules.aiExploreMode;
    const scouting = isScout(state, playerId, ruleset, uid, S);
    // B23: outside the greedy identity mode, a SCOUT is not a garrison — it
    // departs to range the map even when its city is a guard short (the accepted
    // cost of knowing the map, ruling @aec2b4db). Non-scouts (and greedy-mode
    // scouts, pre-B23) hold the fort until the city is safely manned.
    const home = cityAt(state, unit.x, unit.y);
    if (home && home.owner === playerId && !unit.fortified) {
      let guards = 0;
      for (const g of unitsAt(state, unit.x, unit.y)) {
        if (g.owner === playerId && ruleset.units[g.type].attack > 0) guards = guards + 1;
      }
      const need = enemyNear(state, me, playerId, home.x, home.y, ruleset.rules.threatRadius) ? 2 : 1;
      // B23c: a scout departs to range the map ONLY if the city keeps another
      // defender (guards >= 2) — the threat veto alone (B23b) was insufficient:
      // BARBS spawn without warning, so a sole guard that left before a threat
      // was visible lost its city, and a multi-city civ whose whole militia met
      // the quota emptied EVERY garrison at once — expansion collapsed to 1 city
      // (sim-runner #744, the M-floors caught it). The veto still applies on top
      // (a threatened city keeps everyone); this floor is the hard guarantee that
      // no city is ever stripped below one defender. greedy mode: no departure.
      const scoutDepart = scouting && exploreMode !== 'greedy' && guards >= 2;
      if (guards <= need && !scoutDepart) {
        return { type: 'fortify', playerId, unitId: uid };
      }
    }
    // B23: a scout ranges the fog by rules.aiExploreMode — greedy (pre-B23
    // nearest-fog step, the identity guard), bfs (the router that routes THROUGH
    // explored land around bays; the default) or wallfollow (the stored-heading
    // hand-rule). In bfs/wallfollow the coastline step-preference (user doctrine)
    // is the cheap fast-path when adjacent unexplored coast exists.
    if (scouting) {
      let sdir = null;
      let heading;
      if (exploreMode === 'greedy') {
        sdir = towardUnexplored(state, unit, me);
      } else {
        if (ruleset.rules.aiCoastFollow !== false && isCoastal(state, unit.x, unit.y, ruleset)) {
          sdir = coastalScoutDir(state, unit, me, ruleset);
        }
        if (!sdir) {
          if (ruleset.units[unit.type].domain === 'sea') {
            // naval-presence M2 (#2201 Q2): a sea scout crosses open water to the known-
            // ocean frontier (land BFS is useless from a sea tile). This reveals OTHER
            // islands so the overseas settle-loop can arm. Land scouts fall through.
            sdir = towardUnexploredSea(state, unit, me, ruleset);
          } else if (exploreMode === 'wallfollow') {
            const wf = wallFollowDir(state, unit, me, ruleset);
            sdir = wf.dir; heading = wf.heading;
          } else {
            sdir = bfsStepToNearestUnexplored(state, unit, me, ruleset);
          }
        }
      }
      // N3 guard: a land scout never steps onto sea (no auto-board); it holds.
      if (sdir && !stepEntersSea(state, unit, sdir, ruleset)) {
        const cmd = { type: 'moveUnit', playerId, unitId: uid, dir: sdir };
        if (heading !== undefined) cmd.heading = heading;
        return cmd;
      }
    }
    // B24: OFFENSIVE units form derived army groups — converge on the nearest
    // known enemy city, HOLD at its edge until `massSize` attackers are massed,
    // then assault together (each strike per-unit odds-gated under best-of-three;
    // one-roll masses with no gate). Only when the stance attacks (marchR > 0).
    // This is the coordination that converts wins into captures (docs/15 §2d).
    const attDef = ruleset.units[unit.type];
    // B26: the doctrine gate for THIS unit — offensive units (attack>defense) by
    // oddsGate (one-roll 0 = mass, authentic Civ 1); defender-type units by
    // defenderGate (one-roll 1 = even-or-better odds). Attack-INITIATION is now
    // gated for EVERY unit, closing the un-gated defender sorties (#646, B26).
    const D = warDoctrineOf(ruleset);
    const engageGatePct = attDef.attack > attDef.defense ? D.oddsGatePct : D.defenderGatePct;
    // a near enemy UNIT is a march target only when the odds are viable.
    const enemyViable = enemy !== null && enemy !== undefined
      && assaultOddsOk(state, unit, enemy.x, enemy.y, ruleset, engageGatePct);
    if (marchR > 0 && attDef.attack > attDef.defense) {
      // A76: a visible rival launch redirects the assault to that civ's capital
      // (destroying it kills the ship); else the nearest known enemy city.
      const rushCity = launchRushTarget(state, me, playerId, ruleset);
      const targetCity = rushCity !== null ? rushCity : nearestKnownEnemyCity(state, unit, playerId);
      if (targetCity) {
        const dist = chebyshev(state.map, unit.x, unit.y, targetCity.x, targetCity.y);
        if (dist <= 1) {
          const massed = attackersAdjacentTo(state, playerId, ruleset, targetCity.x, targetCity.y);
          if (massed >= D.massSize
              && assaultOddsOk(state, unit, targetCity.x, targetCity.y, ruleset, D.oddsGatePct)) {
            const adir = dirToward(state.map, unit.x, unit.y, targetCity.x, targetCity.y);
            if (adir && !stepEntersSea(state, unit, adir, ruleset)) return { type: 'moveUnit', playerId, unitId: uid, dir: adir };
          }
          return { type: 'wait', playerId, unitId: uid }; // hold: not massed / bad odds
        }
        const cdir = dirToward(state.map, unit.x, unit.y, targetCity.x, targetCity.y);
        if (cdir) {
          const v = DIR_VECS[cdir];
          const nx = ((unit.x + v[0]) % state.map.width + state.map.width) % state.map.width;
          const ny = unit.y + v[1];
          let blocked = false;
          for (const u of unitsAt(state, nx, ny)) if (u.owner !== playerId) blocked = true;
          if (blocked && !assaultOddsOk(state, unit, nx, ny, ruleset, D.oddsGatePct)) {
            return { type: 'wait', playerId, unitId: uid }; // don't charge bad odds (bo3)
          }
          if (!stepEntersSea(state, unit, cdir, ruleset)) return { type: 'moveUnit', playerId, unitId: uid, dir: cdir };
        }
      }
    }
    // fight what's actually near; distant enemies are not worth a suicide
    // trek across the map (that churn was where armies went to die). A40:
    // defensive never marches out (radius 0), aggressive ranges wider;
    // balanced keeps the historical 8. B26: only toward an ODDS-VIABLE target,
    // and the step itself may not become an un-gated attack.
    if (enemy && enemyViable && marchR > 0 && chebyshev(state.map, unit.x, unit.y, enemy.x, enemy.y) <= marchR) {
      const dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y);
      if (dir && !stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGatePct)
          && !stepEntersSea(state, unit, dir, ruleset)) {
        return { type: 'moveUnit', playerId, unitId: uid, dir };
      }
    }
    // escort duty: stand beside a field settler that has no guard yet. §12: the
    // reach is stance-scaled (aggressive/defensive escort their frontier settlers
    // from farther; science/growth divert less military) — escortRadiusPct.
    const escortR = S.escortRadiusPct === undefined ? 100 : S.escortRadiusPct;
    const ward = nearestUnguardedSettler(state, unit, playerId, ruleset, idiv(10 * escortR, 100));
    if (ward) {
      if (chebyshev(state.map, unit.x, unit.y, ward.x, ward.y) <= 1) {
        return { type: 'wait', playerId, unitId: uid }; // stand guard, re-decide next turn
      }
      const dir = dirToward(state.map, unit.x, unit.y, ward.x, ward.y);
      if (dir && !stepEntersSea(state, unit, dir, ruleset)) return { type: 'moveUnit', playerId, unitId: uid, dir };
    }
    let dir = null;
    // B26: march on a known enemy only toward an ODDS-VIABLE target; a
    // defender-type unit (attack<=defense) with nothing viable to strike HOLDS
    // THE LINE (fortify) instead of a losing sortie — the un-gated defender
    // marches were the over-conquest root cause (#646). Offensive units keep
    // roaming/exploring the fog (defensive stance, radius 0, only ever explores).
    if (enemy && enemyViable && marchR > 0) {
      dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y);
    } else if (attDef.attack <= attDef.defense) {
      if (!unit.fortified) return { type: 'fortify', playerId, unitId: uid };
    } else {
      dir = towardUnexplored(state, unit, me);
    }
    // B26: never let a fallback/explore step become an un-gated attack.
    // N3 guard: nor let a land unit wander onto sea (no auto-board).
    if (dir !== null && (stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGatePct)
        || stepEntersSea(state, unit, dir, ruleset))) {
      dir = null;
    }
    if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
  }

  return null;
}

// Host-level driver: repeatedly ask for a command and apply it until the AI
// has nothing left to do. Rejected commands just retire that actor for the
// turn — the AI can never wedge the game. Returns the resulting state.
// Pass `eventsOut` to collect the events of every applied command (the
// client's combat log wants to report what the AI did to the player).
function runAiTurn(engine, state, playerId, ruleset, eventsOut, stance) {
  const done = {};
  // §14 F2: a fresh turn = re-plan — clear last turn's zoc-block tallies so a
  // unit dropped after 3 consecutive zoc rejects gets a fresh attempt now.
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === playerId && u.zocBlocks !== undefined) delete u.zocBlocks;
  }
  let guard = 500;
  while (guard > 0) {
    guard--;
    const cmd = pickCommand(state, playerId, ruleset, done, stance);
    if (!cmd) break;
    const res = engine.applyCommand(state, cmd);
    if (res.ok) {
      state = res.state;
      // §14 F2: a successful move breaks the consecutive-zoc streak
      if (cmd.type === 'moveUnit') {
        const mu = state.units[cmd.unitId];
        if (mu !== undefined && mu.zocBlocks !== undefined) delete mu.zocBlocks;
      }
      if (eventsOut) {
        for (const e of res.events) eventsOut.push(e);
      }
    } else if (cmd.type === 'moveUnit' && res.reason === 'zoc') {
      // §14 F2: count consecutive zoc rejects; pickCommand drops at 3
      const bu = state.units[cmd.unitId];
      if (bu !== undefined) bu.zocBlocks = (bu.zocBlocks === undefined ? 0 : bu.zocBlocks) + 1;
    }
  }
  updateSpaceCityRecord(state, playerId, ruleset); // danger-abandon: record city count for next turn's loss check
  return state;
}

export { runAiTurn, pickCommand, goodCitySpot, isCoastal, coastalScoutDir, bfsStepToNearestUnexplored, wallFollowDir, isScout, navyPriorityOf, bestSeaUnit, bestCarrierUnit, landComponent, isOverseasSite, seaStepToward, nearestOwnCarrier, carrierFreeSlots, oceanTech, adjacentToLand, needsOcean, hasNavalOpportunity };
// XII.5b Q6 (witness, A-ruled #2052): the space-project predicates are exported
// for the SOAK harness's 9-metric --stats witness (tools/soak.js) ONLY — Node-side
// measurement, zero engine-decision use, no luau caller. Pure reads.
export { spaceCommitEligible, spaceCommitted, nextSsPart, updateSpaceCityRecord, ownedCities, spacePathPct };
