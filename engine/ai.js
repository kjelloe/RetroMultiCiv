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
import { availableTechs } from './tech.js';
import { unitsAt, cityAt, sortIds, attackStrength, defenseStrength, bestDefender } from './combat.js';
import { workedTiles, citySpacingOk, candidateTiles, unitObsolete } from './cities.js';
import { hasWaterSource } from './improvements.js';
import { cityMood } from './happiness.js';

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
const STANCES = {
  balanced:   { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: null, improveFirst: null, sciRates: false, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100 },
  defensive:  { marchRadiusPct: 0, garrisonAlways2: true,  armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: 'city-walls', improveFirst: null, sciRates: false, attackerPerCityPct: 0,   attackerBasePct: 0,   scoutSharePct: 40 },
  aggressive: { marchRadiusPct: 175, garrisonAlways2: false, armyCapPerCity: 6, armyCapBase: 8, settlerBase: 2, settlerDiv: 2, buildPriority: null, improveFirst: null, sciRates: false, attackerPerCityPct: 200, attackerBasePct: 100, scoutSharePct: 150 },
  science:    { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 2, settlerDiv: 2, buildPriority: 'library', improveFirst: null, sciRates: true, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100 },
  growth:     { marchRadiusPct: 100, garrisonAlways2: false, armyCapPerCity: 4, armyCapBase: 4, settlerBase: 3, settlerDiv: 1, buildPriority: 'granary', improveFirst: 'irrigate', sciRates: false, attackerPerCityPct: 100, attackerBasePct: 0,   scoutSharePct: 100 }
};
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
  if (d === undefined) return { massSize: 4, oddsGate: 0, defenderGate: 1 };
  // B26: defenderGate governs DEFENDER-type attack-initiation (militia/phalanx
  // sorties). A table entry from before B26 lacks it; fall back to the offensive
  // gate when it bites (best-of-three) or an even-odds floor (one-roll oddsGate 0
  // -> 1: no suicide charges, but Civ 1 aggression at even odds survives).
  const oddsGate = d.oddsGate === undefined ? 0 : d.oddsGate;
  const defenderGate = d.defenderGate !== undefined ? d.defenderGate
    : (oddsGate > 0 ? oddsGate : 1);
  return { massSize: d.massSize, oddsGate: oddsGate, defenderGate: defenderGate };
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
// undefended (a capture) OR its attack strength >= oddsGate × the best
// defender's defense strength (combat.js strengths: veteran/terrain/
// fortified/walls-aware). oddsGate 0 (one-roll) always passes — mass, not odds.
function assaultOddsOk(state, unit, x, y, ruleset, oddsGate) {
  const defender = bestDefender(state, x, y, ruleset);
  if (!defender) return true;
  return attackStrength(unit, ruleset) >= oddsGate * defenseStrength(state, defender, ruleset);
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

// B13a/B13e: the best LAND defender the player can actually build now —
// highest defense, then cheapest, then id (deterministic tie-breaks; the Luau
// twin must match). Skips units whose obsoletedBy tech is known, so the choice
// era-scales (phalanx -> musketeers -> riflemen -> mech-inf) instead of
// jamming on an obsolete unit setProduction now rejects. Comparison-select =
// key-order-independent. Falls back to militia (tech-free base) if somehow
// nothing qualifies.
function bestDefenderUnit(me, ruleset) {
  let best = null, bestDef = null;
  for (const id of Object.keys(ruleset.units)) {
    const def = ruleset.units[id];
    if (def.domain !== 'land' || def.defense <= 0) continue;
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
function pickCommand(state, playerId, ruleset, done, stance) {
  const me = state.players[playerId];
  const S = stanceOf(stance); // balanced (or omitted) = the identity
  const marchR = marchRadiusOf(ruleset, S); // B13f: sweepable via rules.json

  if (!done.happiness) {
    done.happiness = true; // one assignment change per turn — gradual
    const cmd = happinessCommand(state, playerId, ruleset);
    if (cmd) return cmd;
  }

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
      let pool = avail;
      const onPath = [];
      for (const id of avail) {
        if (monarchyPath[id] === true || atkPath[id] === true || navPath[id] === true) onPath.push(id);
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

  // one revolution, to Monarchy, once the advance is known — the stable
  // government for a garrisoned AI (martial law, no war unhappiness); the
  // volatile governments stay human territory
  if (!done.government
      && (me.government === undefined || me.government === 'despotism')
      && me.revolutionTurns === undefined
      && me.techs.indexOf('monarchy') !== -1) {
    done.government = true;
    return { type: 'setGovernment', playerId, government: 'monarchy' };
  }

  // B21(c): rush-buy a threatened city's military production (one per turn)
  if (!done.buy) {
    done.buy = true;
    const cmd = rushBuyCommand(state, playerId, ruleset);
    if (cmd) return cmd;
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
    if (defenders.length >= wantDefenders) {
      if (countSettlers(state, playerId) < S.settlerBase + idiv(countCities(state, playerId), S.settlerDiv)) {
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
        const armyTarget = countCities(state, playerId) * attackerPerCityOf(ruleset, S)
          + attackerBaseOf(ruleset, S);
        const underArmy = attacker !== null && countAttackers(state, playerId, ruleset) < armyTarget;
        if (canWall) {
          want = { kind: 'building', id: 'city-walls' };
        } else if (underArmy) {
          want = { kind: 'unit', id: attacker };
        } else if (navyWant && isCoastal(state, city.x, city.y, ruleset)) {
          // N3: a coastal city of a naval civ, land core secured, fleet under
          // target -> build a ship (above generic buildings/wonders).
          want = { kind: 'unit', id: navySeaUnit };
        } else {
          const building = stanceBuilding(city, me, ruleset, S);
          const wonder = building === null ? nextWonder(state, me, ruleset) : null;
          if (building !== null) want = { kind: 'building', id: building };
          else if (wonder !== null) want = { kind: 'wonder', id: wonder };
          else if (defenders.length >= 3
                   || countMilitary(state, playerId, ruleset) >= countCities(state, playerId) * S.armyCapPerCity + S.armyCapBase) {
            // enough army empire-wide: garrison surplus now roams (escorts,
            // explorers), so the LOCAL count alone no longer saturates —
            // without this cap a tech-starved civ mints militia forever
            want = { kind: 'unit', id: 'settlers' };
          }
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
    done['u:' + uid] = true;

    if (unit.type === 'settlers') {
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
        const dir = safeDirToward(state, me, playerId, unit, site.x, site.y, ruleset);
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
          if (exploreMode === 'wallfollow') {
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
    const engageGate = attDef.attack > attDef.defense ? D.oddsGate : D.defenderGate;
    // a near enemy UNIT is a march target only when the odds are viable.
    const enemyViable = enemy !== null && enemy !== undefined
      && assaultOddsOk(state, unit, enemy.x, enemy.y, ruleset, engageGate);
    if (marchR > 0 && attDef.attack > attDef.defense) {
      const targetCity = nearestKnownEnemyCity(state, unit, playerId);
      if (targetCity) {
        const dist = chebyshev(state.map, unit.x, unit.y, targetCity.x, targetCity.y);
        if (dist <= 1) {
          const massed = attackersAdjacentTo(state, playerId, ruleset, targetCity.x, targetCity.y);
          if (massed >= D.massSize
              && assaultOddsOk(state, unit, targetCity.x, targetCity.y, ruleset, D.oddsGate)) {
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
          if (blocked && !assaultOddsOk(state, unit, nx, ny, ruleset, D.oddsGate)) {
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
      if (dir && !stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGate)
          && !stepEntersSea(state, unit, dir, ruleset)) {
        return { type: 'moveUnit', playerId, unitId: uid, dir };
      }
    }
    // escort duty: stand beside a field settler that has no guard yet
    const ward = nearestUnguardedSettler(state, unit, playerId, ruleset, 10);
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
    if (dir !== null && (stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGate)
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
  let guard = 500;
  while (guard > 0) {
    guard--;
    const cmd = pickCommand(state, playerId, ruleset, done, stance);
    if (!cmd) break;
    const res = engine.applyCommand(state, cmd);
    if (res.ok) {
      state = res.state;
      if (eventsOut) {
        for (const e of res.events) eventsOut.push(e);
      }
    }
  }
  return state;
}

export { runAiTurn, pickCommand, goodCitySpot, isCoastal, coastalScoutDir, bfsStepToNearestUnexplored, wallFollowDir, isScout, navyPriorityOf, bestSeaUnit };
