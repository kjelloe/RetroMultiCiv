// Barbarians: an ownerless menace processed once per game turn (at turn wrap).
// Deliberately dumb v1: spawn on wild land every few turns, shamble toward the
// nearest civilization, attack whatever they reach. Units era-scale (A66); a
// 1-in-rules.barb.leaderChance inland spawn brings a barbarian LEADER under
// escort (N13 — its lone kill pays a ransom, combat.js R1).
// IMPORTANT for replay stability: THIS MODULE consumes no RNG before FIRST_TURN
// (its spawn scheduling). N13 goody-hut entries are a DIFFERENT rng consumer
// (movement.js) that CAN fire earlier — the turn-16 guarantee is about barbarian
// spawn scheduling, not identity of the whole rng sequence.
import { rollRange } from './rng.js';
import { resolveAttack, captureCity, unitsAt, cityAt, sortIds } from './combat.js';

const BARB_ID = 'barb';
const FIRST_TURN = 16;   // no barbarians before this game turn
const EVERY = 4;         // spawn check every N turns
const SPAWN_CHANCE = 3;  // 1-in-N on each check
const HUNT_RADIUS = 8;

// A66/B13: barbarians era-scale instead of spawning militia forever. The tier
// is the highest rules.barbTiers entry whose trigger tech is known by at least
// rules.barbTierThreshold percent of the ALIVE non-barb civs — reusing the
// obsolescence-era trigger techs (gunpowder/conscription/labor-union). Pure +
// deterministic (playerOrder scan). Non-roster-owner safe: only counts the
// roster civs (skips 'barb' and any dead/absent player).
function barbTier(state, ruleset) {
  const tiers = ruleset.rules.barbTiers;
  let alive = 0;
  for (const pid of state.playerOrder) {
    if (pid === BARB_ID) continue;
    const p = state.players[pid];
    if (p && p.alive !== false) alive = alive + 1;
  }
  let unit = tiers[0].unit;
  for (let i = 1; i < tiers.length; i++) {
    let know = 0;
    for (const pid of state.playerOrder) {
      if (pid === BARB_ID) continue;
      const p = state.players[pid];
      if (p && p.alive !== false && p.techs.indexOf(tiers[i].tech) !== -1) know = know + 1;
    }
    if (alive > 0 && know * 100 >= alive * ruleset.rules.barbTierThreshold) unit = tiers[i].unit;
  }
  return unit;
}

function ensureBarbPlayer(state) {
  if (!state.players[BARB_ID]) {
    state.players[BARB_ID] = {
      id: BARB_ID, name: 'Barbarians', color: '#c03030',
      human: false, gold: 0, techs: [], researching: ''
    };
  }
}

function wrapDx(map, a, b) {
  let dx = b - a;
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

function trySpawn(state, ruleset, events) {
  const spawnRoll = rollRange(state.rngState, SPAWN_CHANCE);
  state.rngState = spawnRoll.rngState;
  if (spawnRoll.value !== 0) return;

  const { width, height, tiles } = state.map;
  for (let attempt = 0; attempt < 20; attempt++) {
    let roll = rollRange(state.rngState, width); state.rngState = roll.rngState;
    const x = roll.value;
    roll = rollRange(state.rngState, height - 4); state.rngState = roll.rngState;
    const y = 2 + roll.value;

    const terrain = ruleset.terrain.terrains[tiles[y * width + x].t];
    if (terrain.domain !== 'land') continue;
    if (unitsAt(state, x, y).length > 0 || cityAt(state, x, y)) continue;
    let nearCity = false;
    for (const cid of state.cityOrder || []) {
      const c = state.cities[cid];
      if (c && chebyshev(state.map, x, y, c.x, c.y) < 4) { nearCity = true; break; }
    }
    if (nearCity) continue;

    ensureBarbPlayer(state);
    const barbUnit = barbTier(state, ruleset);
    const unitId = 'u' + state.nextUnitId;
    state.nextUnitId = state.nextUnitId + 1;
    state.units[unitId] = {
      id: unitId, type: barbUnit, owner: BARB_ID,
      x, y, moves: ruleset.units[barbUnit].moves, fortified: false, veteran: false
    };
    events.push({ type: 'barbariansSpawned', unitId, x, y });
    // N13: 1-in-rules.barb.leaderChance inland spawns bring a barbarian LEADER
    // stacked ON the escort's tile ("under escort"). R1 (combat.js) keeps it
    // behind the escort until it stands alone, when killing it pays the ransom.
    const leaderRoll = rollRange(state.rngState, ruleset.rules.barb.leaderChance);
    state.rngState = leaderRoll.rngState;
    if (leaderRoll.value === 0) {
      const leaderType = 'barbleader';
      const lid = 'u' + state.nextUnitId;
      state.nextUnitId = state.nextUnitId + 1;
      state.units[lid] = {
        id: lid, type: leaderType, owner: BARB_ID,
        x, y, moves: ruleset.units[leaderType].moves, fortified: false, veteran: false
      };
    }
    return;
  }
}

function nearestTarget(state, unit) {
  let best = null, bestDist = HUNT_RADIUS + 1;
  for (const id of sortIds(Object.keys(state.units))) {
    const u = state.units[id];
    if (u.owner === BARB_ID) continue;
    const d = chebyshev(state.map, unit.x, unit.y, u.x, u.y);
    if (d < bestDist) { best = { x: u.x, y: u.y }; bestDist = d; }
  }
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (!c || c.owner === BARB_ID) continue;
    const d = chebyshev(state.map, unit.x, unit.y, c.x, c.y);
    if (d < bestDist) { best = { x: c.x, y: c.y }; bestDist = d; }
  }
  return best;
}

function sign(n) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function act(state, unit, ruleset, events) {
  const target = nearestTarget(state, unit);
  let dx, dy;
  if (target) {
    dx = sign(wrapDx(state.map, unit.x, target.x));
    dy = sign(target.y - unit.y);
  } else {
    const roll = rollRange(state.rngState, 8); state.rngState = roll.rngState;
    const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    dx = DIRS[roll.value][0];
    dy = DIRS[roll.value][1];
  }
  if (dx === 0 && dy === 0) return;

  const { width, height } = state.map;
  let nx = unit.x + dx;
  if (state.map.wrapX) nx = ((nx % width) + width) % width;
  const ny = unit.y + dy;
  if (nx < 0 || nx >= width || ny < 1 || ny >= height - 1) return;

  const hostiles = unitsAt(state, nx, ny).filter(u => u.owner !== BARB_ID);
  if (hostiles.length > 0) {
    unit.moves = 1; // wrap processing runs after players spent their moves
    resolveAttack(state, unit, nx, ny, ruleset);
    return;
  }
  const terrain = ruleset.terrain.terrains[state.map.tiles[ny * width + nx].t];
  if (terrain.domain !== 'land') return;

  unit.x = nx;
  unit.y = ny;
  // N13: a barbarian entering a village is a nullifier — the hut is removed with
  // no reward (barbarians move here, not via movement.moveUnit).
  const tile = state.map.tiles[ny * width + nx];
  if (tile.hut === true) {
    delete tile.hut;
    events.push({ type: 'hutEntered', playerId: BARB_ID, x: nx, y: ny, result: 'nothing' });
  }
  const city = cityAt(state, nx, ny);
  if (city && city.owner !== BARB_ID) {
    ensureBarbPlayer(state);
    captureCity(state, unit, city, events, ruleset);
  }
}

// Called once per game turn from endTurn's wrap.
function process(state, ruleset, events) {
  if (state.turn < FIRST_TURN) return;
  if (state.turn % EVERY === 0) trySpawn(state, ruleset, events);
  for (const id of sortIds(Object.keys(state.units))) {
    const unit = state.units[id];
    if (unit && unit.owner === BARB_ID) act(state, unit, ruleset, events);
  }
}

export { process, BARB_ID, FIRST_TURN, barbTier, ensureBarbPlayer };
