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
import { cowTile } from './cow.js';
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
    // resolveAttack RETURNS its events; movement.js passes that result straight
    // up the command path. Here the return value was DISCARDED, so every
    // barbarian battle was silent — no turn-log line, no zoom-to marker, no
    // combat cue, and no ransom/promotion surfacing either.
    const res = resolveAttack(state, unit, nx, ny, ruleset);
    if (res !== undefined && res.ok === true && res.events !== undefined) {
      for (const ev of res.events) events.push(ev);
    }
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
    delete cowTile(state, ny * width + nx).hut;
    events.push({ type: 'hutEntered', playerId: BARB_ID, x: nx, y: ny, result: 'nothing' });
  }
  const city = cityAt(state, nx, ny);
  if (city && city.owner !== BARB_ID) {
    ensureBarbPlayer(state);
    captureCity(state, unit, city, events, ruleset);
  }
}

// barb-sea-raids: an ocean tile adjacent to (x, y), first-found in a fixed
// neighbor order; null when the tile is not coastal. Deterministic.
const SEA_NB = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function oceanNeighbor(state, x, y, ruleset) {
  const { width, height, tiles } = state.map;
  for (const d of SEA_NB) {
    let nx = x + d[0];
    if (nx < 0 || nx >= width) { if (!state.map.wrapX) continue; nx = ((nx % width) + width) % width; }
    const ny = y + d[1];
    if (ny < 0 || ny >= height) continue;
    if (ruleset.terrain.terrains[tiles[ny * width + nx].t].domain === 'sea') return { x: nx, y: ny };
  }
  return null;
}

// barb-sea-raids: for a target city, a beach to land on + the sea tile the
// raiders cross. Landing = a free LAND neighbor of the city that is itself
// coastal; approach = that beach's ocean neighbor (where the sails show).
// Deterministic; null when the city has no clear beach.
function raidApproach(state, city, ruleset) {
  const { width, height, tiles } = state.map;
  for (const d of SEA_NB) {
    let nx = city.x + d[0];
    if (nx < 0 || nx >= width) { if (!state.map.wrapX) continue; nx = ((nx % width) + width) % width; }
    const ny = city.y + d[1];
    if (ny < 1 || ny >= height - 1) continue;
    if (ruleset.terrain.terrains[tiles[ny * width + nx].t].domain !== 'land') continue;
    if (unitsAt(state, nx, ny).length > 0 || cityAt(state, nx, ny)) continue;
    const sea = oceanNeighbor(state, nx, ny, ruleset);
    if (sea !== null) return { landX: nx, landY: ny, seaX: sea.x, seaY: sea.y };
  }
  return null;
}

// barb-sea-raids (Civ1 pirate landings): a SEPARATE rng sub-roll (the land-spawn
// stream is untouched — this runs after trySpawn). On a hit, pick a coastal
// target city and emit the T-1 'sailsSpotted' warning (visibility-gated by
// filterEvents on the approach sea tile), scheduling the landing for next turn.
function trySeaRaid(state, ruleset, events) {
  const chance = ruleset.rules.barb.seaRaidChance;
  if (chance === undefined) return;
  const roll = rollRange(state.rngState, chance);
  state.rngState = roll.rngState;
  if (roll.value !== 0) return;
  const targets = [];
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (!c || c.owner === BARB_ID) continue;
    const ap = raidApproach(state, c, ruleset);
    if (ap !== null) targets.push({ cid, ap });
  }
  if (targets.length === 0) return;
  const pick = rollRange(state.rngState, targets.length);
  state.rngState = pick.rngState;
  const t = targets[pick.value];
  events.push({ type: 'sailsSpotted', cityId: t.cid, x: t.ap.seaX, y: t.ap.seaY });
  ensureBarbPlayer(state);
  if (state.pendingRaids === undefined) state.pendingRaids = [];
  state.pendingRaids.push({ x: t.ap.landX, y: t.ap.landY, turn: state.turn + 1 });
}

// barb-sea-raids: land any raids scheduled for THIS turn (raiders + maybe a
// leader materialize on the beach; then normal act() marches them to CAPTURE
// the city — sea raiders capture, they do not pillage). A blocked beach fizzles.
function resolvePendingRaids(state, ruleset, events) {
  if (state.pendingRaids === undefined) return;
  const keep = [];
  for (const r of state.pendingRaids) {
    if (r.turn !== state.turn) { keep.push(r); continue; }
    const terrain = ruleset.terrain.terrains[state.map.tiles[r.y * state.map.width + r.x].t];
    if (terrain.domain !== 'land' || unitsAt(state, r.x, r.y).length > 0 || cityAt(state, r.x, r.y)) continue;
    ensureBarbPlayer(state);
    const barbUnit = barbTier(state, ruleset);
    const unitId = 'u' + state.nextUnitId;
    state.nextUnitId = state.nextUnitId + 1;
    state.units[unitId] = {
      id: unitId, type: barbUnit, owner: BARB_ID,
      x: r.x, y: r.y, moves: ruleset.units[barbUnit].moves, fortified: false, veteran: false
    };
    events.push({ type: 'barbariansLanded', unitId, x: r.x, y: r.y });
    const leaderRoll = rollRange(state.rngState, ruleset.rules.barb.leaderChance);
    state.rngState = leaderRoll.rngState;
    if (leaderRoll.value === 0) {
      const leaderType = 'barbleader';
      const lid = 'u' + state.nextUnitId;
      state.nextUnitId = state.nextUnitId + 1;
      state.units[lid] = {
        id: lid, type: leaderType, owner: BARB_ID,
        x: r.x, y: r.y, moves: ruleset.units[leaderType].moves, fortified: false, veteran: false
      };
    }
  }
  if (keep.length > 0) state.pendingRaids = keep;
  else delete state.pendingRaids;
}

// Barbarian hordes have no economy to pay for themselves: a real civ is held in
// check by unit upkeep, and nothing played that role here, so barbarians who
// captured a city could grow without bound (the RC sweep found 695 barbarian
// units, 69% of the map, at turn 340). rules.barb.maxUnits is that missing
// ceiling. When it is exceeded, the hordes with the LEAST left to raid give up
// first: units are ranked by distance to the nearest CIVILIZATION city and the
// furthest disband, back down to the cap.
//
// PROVENANCE: RetroMultiCiv, not recreated Civ 1. The wiki documents only the
// barbarian LEADER disbanding itself once it is clear of other civs' cities;
// extending that to ordinary hordes, and adding a ceiling, is our own rule
// (user ruling 2026-08-02). Omit-safe: no maxUnits knob = no cap, exactly the
// pre-2026-08-02 behavior.
function farthestFirst(a, b) {
  // furthest from a civ city first; ties by id so both engines agree
  return b.d - a.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function enforceCap(state, ruleset, events) {
  const cap = ruleset.rules.barb.maxUnits;
  if (cap === undefined) return;
  const ids = [];
  for (const id of sortIds(Object.keys(state.units))) {
    if (state.units[id].owner === BARB_ID) ids.push(id);
  }
  if (ids.length <= cap) return;
  // distance to the nearest city that is NOT barbarian-held; a barbarian city
  // is a camp, not something to raid, so it must not keep a horde alive.
  const ranked = [];
  for (const id of ids) {
    const u = state.units[id];
    let best = -1;
    for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
      const c = state.cities[cid];
      if (c === undefined || c.owner === BARB_ID) continue;
      const d = chebyshev(state.map, u.x, u.y, c.x, c.y);
      if (best === -1 || d < best) best = d;
    }
    // no civ cities left at all: every horde is equally purposeless, so the
    // ranking collapses to the id tie-break and the cap still holds.
    ranked.push({ id, d: best === -1 ? 0 : best });
  }
  ranked.sort(farthestFirst);
  const excess = ids.length - cap;
  for (let i = 0; i < excess; i++) {
    const u = state.units[ranked[i].id];
    delete state.units[ranked[i].id];
    events.push({ type: 'barbariansDispersed', unitId: ranked[i].id, x: u.x, y: u.y });
  }
}

// Called once per game turn from endTurn's wrap.
function process(state, ruleset, events) {
  if (state.turn < FIRST_TURN) return;
  if (state.turn % EVERY === 0) trySpawn(state, ruleset, events); // land spawn — stream untouched
  resolvePendingRaids(state, ruleset, events); // land scheduled sea raids
  if (state.turn % EVERY === 0) trySeaRaid(state, ruleset, events); // schedule a new sea raid
  for (const id of sortIds(Object.keys(state.units))) {
    const unit = state.units[id];
    if (unit && unit.owner === BARB_ID) act(state, unit, ruleset, events);
  }
  // after acting: some hordes died attacking this turn, so cap on what remains
  enforceCap(state, ruleset, events);
}

export { process, BARB_ID, FIRST_TURN, barbTier, ensureBarbPlayer, enforceCap };
