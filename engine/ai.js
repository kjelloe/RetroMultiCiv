// v0 "Expansionist" AI (per the designer's ruleset) — deliberately dumb:
//   1. research: pick the lowest-level available advance
//   2. cities: no defender -> build one; defended -> build settlers
//   3. settlers: found a city on good land, else walk toward better land
//   4. military: march on the nearest known enemy, else explore the fog
// The AI only issues regular commands through applyCommand — it cannot cheat.
// It reads its own `explored` map, so it honors fog of war like a human.
// No RNG: decisions are deterministic, so AI games replay to identical hashes.
import { availableTechs } from './tech.js';
import { unitsAt, cityAt, sortIds } from './combat.js';

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

function goodCitySpot(state, unit, ruleset) {
  const terrain = state.map.tiles[unit.y * state.map.width + unit.x].t;
  if (terrain !== 'grassland' && terrain !== 'plains') return false;
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && chebyshev(state.map, unit.x, unit.y, c.x, c.y) < 3) return false;
  }
  return true;
}

// Best adjacent tile for a wandering settler: prefer fertile open land.
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
    if (unitsAt(state, nx, ny).length > 0) score = 0;
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
    // Defend first; expand while settlers are scarce (capped — endless settler
    // spam grows armies without bound once the land is full, docs/05 §1);
    // saturated empires improve instead: cheapest missing building, then the
    // cheapest available wonder. With nothing buildable (a tech-starved civ)
    // garrisons cap at 3 and further shields go to settlers — pavers whose
    // roads create the trade that ends the tech drought (docs/05 §10-11).
    let want = { kind: 'unit', id: bestDefender };
    if (defenders.length > 0) {
      if (countSettlers(state, playerId) < 2 + idiv(countCities(state, playerId), 4)) {
        want = { kind: 'unit', id: 'settlers' };
      } else {
        const building = nextBuilding(city, me, ruleset);
        const wonder = building === null ? nextWonder(state, me, ruleset) : null;
        if (building !== null) want = { kind: 'building', id: building };
        else if (wonder !== null) want = { kind: 'wonder', id: wonder };
        else if (defenders.length >= 3) want = { kind: 'unit', id: 'settlers' };
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
      if (goodCitySpot(state, unit, ruleset)) {
        return { type: 'foundCity', playerId, unitId: uid };
      }
      // no room for a city: pave where it stands — roads make trade, and
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
    // garrison duty: with no known enemy, a unit standing in its own city digs in
    const home = cityAt(state, unit.x, unit.y);
    if (!enemy && home && home.owner === playerId && !unit.fortified) {
      return { type: 'fortify', playerId, unitId: uid };
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
