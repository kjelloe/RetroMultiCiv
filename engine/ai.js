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
import { unitsAt, cityAt, sortIds } from './combat.js';
import { workedTiles, citySpacingOk } from './cities.js';
import { hasWaterSource } from './improvements.js';

const DIR_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIR_VECS = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };

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
function bestImprovementJob(state, unit, playerId, ruleset) {
  const map = state.map;
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
      let work = null;
      if (tile.road !== true) work = 'road';
      else if (tile.irrigation !== true && tile.mine !== true
               && terrain.irrigate !== undefined
               && hasWaterSource(state, w.x, w.y)) work = 'irrigate';
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

// One decision at a time; `done` prevents re-considering the same actor this turn.
function pickCommand(state, playerId, ruleset, done) {
  const me = state.players[playerId];

  if ((me.researching === '' || me.researching === undefined) && !done.research) {
    done.research = true;
    const avail = availableTechs(state, playerId, ruleset);
    if (avail.length > 0) {
      // beeline Monarchy first (Civ 1 AIs rush a government); breadth-first
      // level-order research would otherwise not reach it in 400 turns
      let pool = avail;
      if (me.techs.indexOf('monarchy') === -1) {
        const path = {};
        markTechPath(ruleset, 'monarchy', path);
        const onPath = [];
        for (const id of avail) {
          if (path[id] === true) onPath.push(id);
        }
        if (onPath.length > 0) pool = onPath;
      }
      let best = pool[0];
      for (const id of pool) {
        if (ruleset.techs[id].level < ruleset.techs[best].level) best = id;
      }
      return { type: 'setResearch', playerId, tech: best };
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

  for (const cid of state.cityOrder || []) {
    if (done['c:' + cid]) continue;
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    done['c:' + cid] = true;
    const defenders = unitsAt(state, city.x, city.y).filter(u => u.owner === playerId);
    const bestDefender = me.techs.indexOf('bronze-working') !== -1 ? 'phalanx' : 'militia';
    // Defend first — TWO garrisons when a known enemy is within 8 of the
    // city, one in peacetime; then expand while settlers are scarce
    // (capped — endless settler spam grows armies without bound once the
    // land is full, docs/05 §1); saturated empires improve instead:
    // cheapest missing building, then the cheapest available wonder. With
    // nothing buildable (a tech-starved civ) garrisons cap at 3 and
    // further shields go to settlers — pavers whose roads create the
    // trade that ends the tech drought (docs/05 §10-11).
    const wantDefenders = enemyNear(state, me, playerId, city.x, city.y, 8) ? 2 : 1;
    let want = { kind: 'unit', id: bestDefender };
    if (defenders.length >= wantDefenders) {
      if (countSettlers(state, playerId) < 2 + idiv(countCities(state, playerId), 2)) {
        want = { kind: 'unit', id: 'settlers' };
      } else {
        const building = nextBuilding(city, me, ruleset);
        const wonder = building === null ? nextWonder(state, me, ruleset) : null;
        if (building !== null) want = { kind: 'building', id: building };
        else if (wonder !== null) want = { kind: 'wonder', id: wonder };
        else if (defenders.length >= 3
                 || countMilitary(state, playerId, ruleset) >= countCities(state, playerId) * 4 + 4) {
          // enough army empire-wide: garrison surplus now roams (escorts,
          // explorers), so the LOCAL count alone no longer saturates —
          // without this cap a tech-starved civ mints militia forever
          want = { kind: 'unit', id: 'settlers' };
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
        const job = bestImprovementJob(state, unit, playerId, ruleset);
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
    // hold the fort: a garrison stays until its city is safely manned —
    // two guards when a known enemy is within 8, one in peacetime
    const home = cityAt(state, unit.x, unit.y);
    if (home && home.owner === playerId && !unit.fortified) {
      let guards = 0;
      for (const g of unitsAt(state, unit.x, unit.y)) {
        if (g.owner === playerId && ruleset.units[g.type].attack > 0) guards = guards + 1;
      }
      const need = enemyNear(state, me, playerId, home.x, home.y, 8) ? 2 : 1;
      if (guards <= need) {
        return { type: 'fortify', playerId, unitId: uid };
      }
    }
    // fight what's actually near; distant enemies are not worth a suicide
    // trek across the map (that churn was where armies went to die)
    if (enemy && chebyshev(state.map, unit.x, unit.y, enemy.x, enemy.y) <= 8) {
      const dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y);
      if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
    }
    // escort duty: stand beside a field settler that has no guard yet
    const ward = nearestUnguardedSettler(state, unit, playerId, ruleset, 10);
    if (ward) {
      if (chebyshev(state.map, unit.x, unit.y, ward.x, ward.y) <= 1) {
        return { type: 'wait', playerId, unitId: uid }; // stand guard, re-decide next turn
      }
      const dir = dirToward(state.map, unit.x, unit.y, ward.x, ward.y);
      if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
    }
    let dir = null;
    if (enemy) dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y);
    else dir = towardUnexplored(state, unit, me);
    if (dir) return { type: 'moveUnit', playerId, unitId: uid, dir };
  }

  return null;
}

// Host-level driver: repeatedly ask for a command and apply it until the AI
// has nothing left to do. Rejected commands just retire that actor for the
// turn — the AI can never wedge the game. Returns the resulting state.
// Pass `eventsOut` to collect the events of every applied command (the
// client's combat log wants to report what the AI did to the player).
function runAiTurn(engine, state, playerId, ruleset, eventsOut) {
  const done = {};
  let guard = 500;
  while (guard > 0) {
    guard--;
    const cmd = pickCommand(state, playerId, ruleset, done);
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

export { runAiTurn, pickCommand, goodCitySpot };
