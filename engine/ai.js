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
      let best = avail[0];
      for (const id of avail) {
        if (ruleset.techs[id].level < ruleset.techs[best].level) best = id;
      }
      return { type: 'setResearch', playerId, tech: best };
    }
  }

  for (const cid of state.cityOrder || []) {
    if (done['c:' + cid]) continue;
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    done['c:' + cid] = true;
    const defenders = unitsAt(state, city.x, city.y).filter(u => u.owner === playerId);
    const bestDefender = me.techs.indexOf('bronze-working') !== -1 ? 'phalanx' : 'militia';
    const want = defenders.length === 0
      ? { kind: 'unit', id: bestDefender }
      : { kind: 'unit', id: 'settlers' };
    if (city.producing.kind !== want.kind || city.producing.id !== want.id) {
      return { type: 'setProduction', playerId, cityId: cid, item: want };
    }
  }

  for (const uid of sortIds(Object.keys(state.units))) {
    if (done['u:' + uid]) continue;
    const unit = state.units[uid];
    if (!unit || unit.owner !== playerId || unit.moves <= 0) continue;
    done['u:' + uid] = true;

    if (unit.type === 'settlers') {
      if (goodCitySpot(state, unit, ruleset)) {
        return { type: 'foundCity', playerId, unitId: uid };
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
function runAiTurn(engine, state, playerId, ruleset) {
  const done = {};
  let guard = 500;
  while (guard > 0) {
    guard--;
    const cmd = pickCommand(state, playerId, ruleset, done);
    if (!cmd) break;
    const res = engine.applyCommand(state, cmd);
    if (res.ok) state = res.state;
  }
  return state;
}

export { runAiTurn, pickCommand, goodCitySpot };
