// Headless all-AI playthrough driver (docs/05-simulation-test.md).
// Runs N AI civilizations through the real engine with no client attached,
// auditing the whole state with cheap invariants every round and deep checks
// at checkpoints. Shared by test/simulation.test.js (fixed seed + goldens)
// and tools/soak.js (many seeds). On failure it writes two artifacts to
// debugging/sim/: a save file (drag-drop into the browser to inspect) and a
// diagnostics file (bisect with `node tools/replay.js`).
//
// Round semantics: round N plays game turn N, so after N completed rounds
// state.turn === N+1. Checkpoints are keyed by completed rounds.
const fs = require('fs');
const path = require('path');
const RULESET = require('./ruleset.js');

const DEFAULT_ARTIFACT_DIR = path.join(__dirname, '..', 'debugging', 'sim');

// Fixed roster: stable ids/colors keep goldens stable; civ ids exercise the
// specialty hooks (startTech, startGold, cheap items, veterans).
// A38: entries p1–p7 are FROZEN byte-for-byte (the sim goldens run at
// civs=4 and slice the head; simulation.test.js asserts the first 4) —
// p8–p14 extend the bench to the full data/civs.json roster so scaling
// runs (soak --civs up to 14) have bodies.
const SIM_ROSTER = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', civ: 'romans' },
  { id: 'p2', name: 'Egyptians', color: '#d8b13b', civ: 'egyptians' },
  { id: 'p3', name: 'Greeks', color: '#3bd87d', civ: 'greeks' },
  { id: 'p4', name: 'Zulus', color: '#d84a3b', civ: 'zulus' },
  { id: 'p5', name: 'Babylonians', color: '#9b59d0', civ: 'babylonians' },
  { id: 'p6', name: 'Chinese', color: '#d07f3b', civ: 'chinese' },
  { id: 'p7', name: 'Mongols', color: '#4fd0c9', civ: 'mongols' },
  { id: 'p8', name: 'Germans', color: '#8a949e', civ: 'germans' },
  { id: 'p9', name: 'Americans', color: '#4b6bd8', civ: 'americans' },
  { id: 'p10', name: 'Indians', color: '#d88fd8', civ: 'indians' },
  { id: 'p11', name: 'Russians', color: '#a8342a', civ: 'russians' },
  { id: 'p12', name: 'French', color: '#6db3f2', civ: 'french' },
  { id: 'p13', name: 'Aztecs', color: '#3bc9d8', civ: 'aztecs' },
  { id: 'p14', name: 'English', color: '#d83b8a', civ: 'english' }
];

// Tripwires: generous ceilings that only trip on runaway feedback loops
// (exponential unit spam, gold overflow), never on healthy games.
const MAX_POP = 40;
const MAX_UNITS = 600;
const MAX_GOLD = 100000;

let MODS = null;
async function loadModules() {
  if (MODS) return MODS;
  const [engineMod, aiMod, hashMod, visMod, happyMod, govMod, scoreMod, rngMod, citiesMod, combatMod, techMod] = await Promise.all([
    import('../engine/index.js'),
    import('../engine/ai.js'),
    import('../shared/statehash.js'),
    import('../engine/visibility.js'),
    import('../engine/happiness.js'),
    import('../engine/government.js'),
    import('../engine/score.js'),
    import('../engine/rng.js'),
    import('../engine/cities.js'),
    import('../engine/combat.js'),
    import('../engine/tech.js')
  ]);
  MODS = {
    createEngine: engineMod.createEngine,
    nextYear: engineMod.nextYear,
    deepClone: engineMod.deepClone,
    runAiTurn: aiMod.runAiTurn,
    hashState: hashMod.hashState,
    filterView: visMod.filterView,
    cityMood: happyMod.cityMood,
    capitalOf: govMod.capitalOf,
    score: scoreMod.score,
    seedRng: rngMod.seedRng,
    rollRange: rngMod.rollRange,
    candidateTiles: citiesMod.candidateTiles,
    sortIds: combatMod.sortIds,
    playerIncome: techMod.playerIncome
  };
  return MODS;
}

function isInt(n) {
  return Number.isInteger(n);
}

// Cheap structural + numeric audit of the whole state. Pure and synchronous
// so it is unit-testable against crafted broken states. Returns a list of
// problem strings (empty = healthy).
function checkInvariants(state, ruleset) {
  const problems = [];
  const bad = (msg) => problems.push(msg);
  const { width, height, tiles } = state.map;
  const size = width * height;
  if (tiles.length !== size) bad(`map: ${tiles.length} tiles for ${width}x${height}`);
  if (!isInt(state.turn) || state.turn < 1) bad(`turn ${state.turn} invalid`);
  if (!isInt(state.year)) bad(`year ${state.year} invalid`);
  if (!isInt(state.rngState) || state.rngState === 0) bad(`rngState ${state.rngState} invalid (xorshift32 must be a nonzero integer)`);
  if (!state.players[state.activePlayer]) bad(`activePlayer ${state.activePlayer} missing from players`);
  if (state.playerOrder.indexOf(state.activePlayer) === -1) bad(`activePlayer ${state.activePlayer} not in playerOrder`);

  // units (combat makes mixed-owner tiles unrepresentable: moving onto an
  // enemy is always an attack — co-location means a movement/combat bug)
  const unitIds = Object.keys(state.units);
  if (unitIds.length > MAX_UNITS) bad(`tripwire: ${unitIds.length} units > ${MAX_UNITS}`);
  const tileOwner = {};
  let maxUnitNum = 0;
  for (const uid of unitIds) {
    const u = state.units[uid];
    if (u.id !== uid) bad(`unit ${uid}: id field "${u.id}" mismatches key`);
    if (!state.players[u.owner]) bad(`unit ${uid}: owner "${u.owner}" missing`);
    const def = ruleset.units[u.type];
    if (!def) { bad(`unit ${uid}: unknown type "${u.type}"`); continue; }
    if (!isInt(u.x) || !isInt(u.y) || u.x < 0 || u.x >= width || u.y < 0 || u.y >= height) {
      bad(`unit ${uid}: position ${u.x},${u.y} out of bounds`);
      continue;
    }
    if (!isInt(u.moves) || u.moves < 0) bad(`unit ${uid}: moves ${u.moves}`);
    const tkey = u.y * width + u.x;
    if (tileOwner[tkey] !== undefined && tileOwner[tkey] !== u.owner) {
      bad(`unit ${uid}: shares tile ${u.x},${u.y} with a ${tileOwner[tkey]} unit (mixed-owner stack)`);
    }
    tileOwner[tkey] = u.owner;
    const tileDomain = ruleset.terrain.terrains[tiles[u.y * width + u.x].t].domain;
    const inCity = cityAtTile(state, u.x, u.y);
    if (def.domain === 'land' && tileDomain !== 'land') bad(`unit ${uid}: land unit (${u.type}) on ${tileDomain}`);
    if (def.domain === 'sea' && tileDomain !== 'sea' && !inCity) bad(`unit ${uid}: sea unit (${u.type}) on ${tileDomain} outside a city`);
    if (u.home !== undefined && !state.cities[u.home]) bad(`unit ${uid}: home city "${u.home}" missing`);
    const m = /^u([0-9]+)$/.exec(uid);
    if (m && Number(m[1]) > maxUnitNum) maxUnitNum = Number(m[1]);
  }
  if (maxUnitNum >= state.nextUnitId) bad(`nextUnitId ${state.nextUnitId} <= max used unit id ${maxUnitNum}`);

  // cities + cityOrder set equality
  const cityIds = Object.keys(state.cities);
  const inOrder = {};
  for (const cid of state.cityOrder) {
    if (inOrder[cid]) bad(`cityOrder: duplicate "${cid}"`);
    inOrder[cid] = true;
    if (!state.cities[cid]) bad(`cityOrder: "${cid}" missing from cities`);
  }
  const seenTile = {};
  let maxCityNum = 0;
  for (const cid of cityIds) {
    if (!inOrder[cid]) bad(`city ${cid} missing from cityOrder`);
    const c = state.cities[cid];
    if (c.id !== cid) bad(`city ${cid}: id field "${c.id}" mismatches key`);
    if (!state.players[c.owner]) bad(`city ${cid}: owner "${c.owner}" missing`);
    if (!isInt(c.x) || !isInt(c.y) || c.x < 0 || c.x >= width || c.y < 0 || c.y >= height) {
      bad(`city ${cid}: position ${c.x},${c.y} out of bounds`);
      continue;
    }
    const tkey = c.y * width + c.x;
    if (seenTile[tkey]) bad(`city ${cid}: shares tile ${c.x},${c.y} with ${seenTile[tkey]}`);
    seenTile[tkey] = cid;
    if (!isInt(c.pop) || c.pop < 1) bad(`city ${cid}: pop ${c.pop}`);
    if (c.pop > MAX_POP) bad(`tripwire: city ${cid} pop ${c.pop} > ${MAX_POP}`);
    if (!isInt(c.food) || c.food < 0) bad(`city ${cid}: food ${c.food}`);
    if (!isInt(c.shields) || c.shields < 0) bad(`city ${cid}: shields ${c.shields}`);
    if (c.disorder !== undefined && c.disorder !== true) bad(`city ${cid}: disorder flag must be true or absent`);
    const prod = c.producing;
    if (!prod || (prod.kind === 'unit' ? !ruleset.units[prod.id]
      : prod.kind === 'building' ? !ruleset.buildings[prod.id]
      : prod.kind === 'wonder' ? !ruleset.wonders[prod.id] : true)) {
      bad(`city ${cid}: invalid producing ${JSON.stringify(prod)}`);
    }
    if (c.buildings !== undefined) {
      const seenB = {};
      for (const b of c.buildings) {
        if (!ruleset.buildings[b]) bad(`city ${cid}: unknown building "${b}"`);
        if (seenB[b]) bad(`city ${cid}: duplicate building "${b}"`);
        seenB[b] = true;
      }
    }
    const taxmen = c.taxmen === undefined ? 0 : c.taxmen;
    const scientists = c.scientists === undefined ? 0 : c.scientists;
    if (!isInt(taxmen) || taxmen < 0 || !isInt(scientists) || scientists < 0) {
      bad(`city ${cid}: specialists taxmen=${c.taxmen} scientists=${c.scientists}`);
    }
    if (taxmen + scientists > c.pop) bad(`city ${cid}: ${taxmen}+${scientists} specialists > pop ${c.pop}`);
    if (c.workers !== undefined) {
      if (!Array.isArray(c.workers) || c.workers.length > c.pop) {
        bad(`city ${cid}: workers array longer than pop`);
      } else {
        const seenW = {};
        for (const idx of c.workers) {
          if (!isInt(idx) || idx < 0 || idx >= size) bad(`city ${cid}: worker tile ${idx} out of range`);
          if (seenW[idx]) bad(`city ${cid}: duplicate worker tile ${idx}`);
          seenW[idx] = true;
        }
      }
    }
    const m = /^c([0-9]+)$/.exec(cid);
    if (m && Number(m[1]) > maxCityNum) maxCityNum = Number(m[1]);
  }
  if (maxCityNum >= state.nextCityId) bad(`nextCityId ${state.nextCityId} <= max used city id ${maxCityNum}`);

  // wonders: known ids pointing at existing cities (cities are never razed)
  for (const wid of Object.keys(state.wonders === undefined ? {} : state.wonders)) {
    if (!ruleset.wonders[wid]) bad(`wonders: unknown "${wid}"`);
    if (!state.cities[state.wonders[wid]]) bad(`wonders: ${wid} home city "${state.wonders[wid]}" missing`);
  }

  // players (the barbarian player lives outside playerOrder with a minimal
  // shape — rate/explored checks only apply where the fields exist)
  for (const pid of state.playerOrder) {
    if (!state.players[pid]) bad(`playerOrder: "${pid}" missing from players`);
  }
  for (const pid of Object.keys(state.players)) {
    const p = state.players[pid];
    if (p.id !== pid) bad(`player ${pid}: id field mismatches key`);
    if (!isInt(p.gold) || p.gold < 0) bad(`player ${pid}: gold ${p.gold}`);
    if (p.gold > MAX_GOLD) bad(`tripwire: player ${pid} gold ${p.gold} > ${MAX_GOLD}`);
    if (p.bulbs !== undefined && (!isInt(p.bulbs) || p.bulbs < 0)) bad(`player ${pid}: bulbs ${p.bulbs}`);
    if (p.alive !== undefined && typeof p.alive !== 'boolean') bad(`player ${pid}: alive ${p.alive}`);
    const seenT = {};
    for (const t of p.techs) {
      if (!ruleset.techs[t]) bad(`player ${pid}: unknown tech "${t}"`);
      if (seenT[t]) bad(`player ${pid}: duplicate tech "${t}"`);
      seenT[t] = true;
    }
    if (p.researching !== '' && !ruleset.techs[p.researching]) bad(`player ${pid}: researching unknown "${p.researching}"`);
    if (p.taxRate !== undefined) {
      const tax = p.taxRate, sci = p.sciRate === undefined ? 0 : p.sciRate;
      const lux = p.luxRate === undefined ? 0 : p.luxRate;
      const govId = p.government === undefined ? 'despotism' : p.government;
      const gov = ruleset.governments[govId];
      if (!gov) bad(`player ${pid}: unknown government "${govId}"`);
      if (tax + sci + lux !== 100) bad(`player ${pid}: rates ${tax}+${sci}+${lux} != 100`);
      for (const r of [tax, sci, lux]) {
        if (!isInt(r) || r < 0 || r > 100 || r % 10 !== 0) bad(`player ${pid}: rate ${r} not a multiple of 10 in 0..100`);
      }
      if (gov && (tax > gov.maxRate || sci > gov.maxRate || lux > gov.maxRate)) {
        bad(`player ${pid}: a rate exceeds ${govId} cap ${gov.maxRate}`);
      }
    }
    if (p.revolutionTurns !== undefined) {
      if (p.government !== 'anarchy') bad(`player ${pid}: revolutionTurns without anarchy`);
      if (p.pendingGovernment === undefined) bad(`player ${pid}: revolutionTurns without pendingGovernment`);
    }
    if (p.explored !== undefined) {
      if (p.explored.length !== size) {
        bad(`player ${pid}: explored length ${p.explored.length} != ${size}`);
      } else {
        for (let i = 0; i < size; i++) {
          const v = p.explored[i];
          if (v !== 0 && v !== 1) { bad(`player ${pid}: explored[${i}] = ${v}`); break; }
        }
      }
    }
  }
  return problems;
}

function cityAtTile(state, x, y) {
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (c && c.x === x && c.y === y) return c;
  }
  return null;
}

const CITY_SHELL_KEYS = { id: true, name: true, owner: true, x: true, y: true, pop: true, buildings: true };
const RIVAL_PLAYER_KEYS = { id: true, name: true, color: true, human: true };

// Deep audit at checkpoints: hashability (rejects any Lua-unsafe value),
// fog-projection leaks on organic late-game states, mood arithmetic sanity,
// and capital resolution. Call after loadModules() (runSim does).
function checkDeep(state, ruleset, mods) {
  const problems = [];
  try {
    mods.hashState(state);
  } catch (e) {
    problems.push(`state not hashable: ${e.message}`);
  }
  for (const pid of state.playerOrder) {
    if (!state.players[pid] || state.players[pid].explored === undefined) continue;
    const view = mods.filterView(state, pid);
    if (view.rngState !== undefined) problems.push(`view for ${pid}: leaks rngState`);
    for (const cid of Object.keys(view.cities)) {
      const c = view.cities[cid];
      if (c.owner === pid) continue;
      for (const k of Object.keys(c)) {
        if (!CITY_SHELL_KEYS[k]) problems.push(`view for ${pid}: rival city ${cid} leaks "${k}"`);
      }
      for (const b of c.buildings) {
        if (b !== 'city-walls') problems.push(`view for ${pid}: rival city ${cid} leaks building "${b}"`);
      }
    }
    for (const qid of Object.keys(view.players)) {
      if (qid === pid) continue;
      for (const k of Object.keys(view.players[qid])) {
        if (!RIVAL_PLAYER_KEYS[k]) problems.push(`view for ${pid}: rival player ${qid} leaks "${k}"`);
      }
    }
    // cityOrder in a view must reference only cities the view contains —
    // the full array would leak how many hidden cities exist
    for (const cid of view.cityOrder === undefined ? [] : view.cityOrder) {
      if (view.cities[cid] === undefined) {
        problems.push(`view for ${pid}: cityOrder leaks unseen city "${cid}"`);
      }
    }
  }
  for (const cid of state.cityOrder) {
    const city = state.cities[cid];
    if (!city) continue;
    const m = mods.cityMood(state, city, ruleset);
    if (m.happy < 0 || m.content < 0 || m.unhappy < 0) {
      problems.push(`city ${cid}: negative mood ${m.happy}/${m.content}/${m.unhappy}`);
    }
    if (m.happy + m.content + m.unhappy !== m.workers) {
      problems.push(`city ${cid}: mood ${m.happy}+${m.content}+${m.unhappy} != workers ${m.workers}`);
    }
  }
  for (const pid of state.playerOrder) {
    let hasCity = false;
    for (const cid of state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.owner === pid) { hasCity = true; break; }
    }
    if (hasCity && !mods.capitalOf(state, pid, ruleset)) problems.push(`player ${pid}: capitalOf unresolved despite cities`);
    // income forecast must at least be computable and sane on organic states
    // (strict forecast==applied is not well-defined: the wrap mutates yields
    // before income applies — improvements finish, cities grow/build)
    const inc = mods.playerIncome(state, pid, ruleset);
    if (!Number.isInteger(inc.gold) || !Number.isInteger(inc.bulbs) || !Number.isInteger(inc.maintenance)
        || inc.bulbs < 0 || inc.maintenance < 0) {
      problems.push(`player ${pid}: playerIncome ${JSON.stringify(inc)} not sane`);
    }
  }
  // manual worker lists must hold real candidate tiles (stronger than the
  // per-turn bounds check; growth appends candidates, capture clears)
  for (const cid of state.cityOrder) {
    const city = state.cities[cid];
    if (!city || city.workers === undefined) continue;
    const valid = {};
    for (const c of mods.candidateTiles(state, city, ruleset)) valid[c.idx] = true;
    for (const idx of city.workers) {
      if (valid[idx] !== true) problems.push(`city ${cid}: manual worker tile ${idx} is not a candidate tile`);
    }
  }
  return problems;
}

// Structured per-player stats for one state — the telemetry row format
// (tools/soak.js --stats appends these as JSONL for balance-drift charting)
// and the base of the human summary line.
function snapshot(state, ruleset, mods) {
  const players = [];
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    let cities = 0, units = 0;
    for (const cid of state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.owner === pid) cities++;
    }
    for (const uid of Object.keys(state.units)) {
      if (state.units[uid].owner === pid) units++;
    }
    players.push({
      id: pid, name: p.name, alive: p.alive !== false,
      government: p.government === undefined ? 'despotism' : p.government,
      cities, units, techs: p.techs.length, gold: p.gold,
      score: mods.score(state, pid, ruleset)
    });
  }
  return { turn: state.turn, year: state.year, players };
}

// One readable line per checkpoint so soak logs tell a story at a glance.
function summarize(state, ruleset, mods) {
  const snap = snapshot(state, ruleset, mods);
  const parts = [];
  for (const p of snap.players) {
    if (!p.alive) { parts.push(`${p.name} DEAD`); continue; }
    parts.push(`${p.name} ${p.cities}c ${p.units}u ${p.techs}t s${p.score} ${p.government.slice(0, 3).toUpperCase()}`);
  }
  return `turn ${snap.turn}: ${parts.join(' | ')}`;
}

// Chaos: deterministic pseudo-random commands from a SEPARATE xorshift
// stream (never the game's rngState) covering the command surface the AI
// doesn't use — buy, pillage, disband, manual workers, rates, volatile
// governments, research switches. Legal-shaped, not legal: rejections are a
// feature (they exercise validation) and replay identically. RATE_COMBOS
// are multiples of 10 summing to 100; high entries probe government caps.
const RATE_COMBOS = [
  [40, 60, 0], [60, 40, 0], [30, 50, 20], [50, 30, 20], [20, 70, 10], [10, 80, 10]
];

function ownCities(state, pid) {
  const out = [];
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (c && c.owner === pid) out.push(cid);
  }
  return out;
}

function ownUnits(state, pid, mods) {
  const out = [];
  for (const uid of mods.sortIds(Object.keys(state.units))) {
    if (state.units[uid].owner === pid) out.push(uid);
  }
  return out;
}

// chaos moveUnit walks use the engine's direction vocabulary
const CHAOS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// mine is double-weighted: on grassland it is the plant-forest TRANSFORM, the
// one work order that is legal almost anywhere — it keeps the accept path warm
const CHAOS_WORKS = ['irrigate', 'mine', 'fortress', 'railroad', 'mine'];
const CHAOS_NAMES = ['Chaosville', 'Entropy', 'Mayhem']; // tiny pool → duplicate-name path
const CHAOS_BASICS = ['militia', 'settlers']; // tech-free: keeps setProduction's accept path warm

function ownSettlers(state, pid, mods) {
  const out = [];
  const spent = [];
  for (const uid of mods.sortIds(Object.keys(state.units))) {
    const u = state.units[uid];
    if (u.owner === pid && u.type === 'settlers') {
      (u.moves > 0 ? out : spent).push(uid);
    }
  }
  // settlers with moves first (found/startWork need them); spent ones still
  // exercise the noMovesLeft rejection when nothing better exists
  return out.concat(spent);
}

function pickChaosCommand(state, pid, roll, ruleset, mods) {
  // 16 slots: the three youngest kinds (setProduction / foundCity / startWork)
  // are double-weighted — their legal windows are thin (settlers scarce
  // mid-game, most ids tech-locked), so extra attempts keep both their accept
  // AND reject paths exercised within a 60-turn probe
  let kind = roll(16);
  if (kind === 13) kind = 8;
  else if (kind === 14) kind = 10;
  else if (kind === 15) kind = 11;
  if (kind === 0 || kind === 7) { // buy, double weight — the main gold sink
    const cities = ownCities(state, pid);
    if (cities.length === 0) return null;
    return { type: 'buy', playerId: pid, cityId: cities[roll(cities.length)] };
  }
  if (kind === 1) { // pillage own ground (usually rejects: nothing improved)
    const units = ownUnits(state, pid, mods);
    if (units.length === 0) return null;
    return { type: 'pillage', playerId: pid, unitId: units[roll(units.length)] };
  }
  if (kind === 2) { // disband — chaos may eat a settler; that's the point
    const units = ownUnits(state, pid, mods);
    if (units.length === 0) return null;
    return { type: 'disband', playerId: pid, unitId: units[roll(units.length)] };
  }
  if (kind === 3) {
    const c = RATE_COMBOS[roll(RATE_COMBOS.length)];
    return { type: 'setRates', playerId: pid, tax: c[0], sci: c[1], lux: c[2] };
  }
  if (kind === 4) { // manual workers on some candidate tiles, or back to auto
    const cities = ownCities(state, pid);
    if (cities.length === 0) return null;
    const city = state.cities[cities[roll(cities.length)]];
    if (roll(3) === 0) return { type: 'setWorkers', playerId: pid, cityId: city.id, auto: true };
    const candidates = mods.candidateTiles(state, city, ruleset);
    const n = Math.min(city.pop, candidates.length, 1 + roll(4));
    const workers = [];
    for (let i = 0; i < n; i++) workers.push(candidates[i].idx);
    return { type: 'setWorkers', playerId: pid, cityId: city.id, workers };
  }
  if (kind === 5) { // volatile government (AI itself stops at monarchy);
    // communism included — the one arm chaos never tried (fixedCorruptionDist)
    const gov = ['republic', 'democracy', 'communism'][roll(3)];
    return { type: 'setGovernment', playerId: pid, government: gov };
  }
  if (kind === 6) { // research switch — mostly rejects on prereqs, sometimes
    // swaps research midway (the bulb-carry path)
    const techIds = Object.keys(ruleset.techs).sort();
    return { type: 'setResearch', playerId: pid, tech: techIds[roll(techIds.length)] };
  }
  if (kind === 8) { // production switch: category-halving, techRequired,
    // wonder-race and cheapUnit/cheapBuilding hooks on organic states
    const cities = ownCities(state, pid);
    if (cities.length === 0) return null;
    const cityId = cities[roll(cities.length)];
    const pools = [
      ['unit', CHAOS_BASICS],               // double weight: always-legal units
      ['unit', Object.keys(ruleset.units).sort()],
      ['building', Object.keys(ruleset.buildings).sort()],
      ['wonder', Object.keys(ruleset.wonders).sort()]
    ];
    const pool = pools[roll(4)];
    return {
      type: 'setProduction', playerId: pid, cityId,
      item: { kind: pool[0], id: pool[1][roll(pool[1].length)] }
    };
  }
  if (kind === 9) { // short random walk: chaos combat, ZOC rejections, and
    // engine-RNG consumption the AI's own targeting would never produce
    const units = ownUnits(state, pid, mods);
    if (units.length === 0) return null;
    return {
      type: 'moveUnit', playerId: pid, unitId: units[roll(units.length)],
      dir: CHAOS_DIRS[roll(8)]
    };
  }
  if (kind === 10 || kind === 11) {
    // foundCity in odd spots / startWork variety. Settler windows are BRIEF
    // (the AI consumes them founding) — when none exists, chaos orders one
    // built instead (setProduction→settlers): it breeds its own future
    // windows, so both accept paths run within a 60-turn probe. A roll(4)
    // sliver still picks a NON-settler = the notSettlers rejection path.
    const settlers = ownSettlers(state, pid, mods);
    if (settlers.length === 0 || roll(6) === 0) {
      const all = ownUnits(state, pid, mods);
      if (settlers.length === 0 && all.length > 0 && roll(2) === 0) {
        return kind === 10
          ? { type: 'foundCity', playerId: pid, unitId: all[roll(all.length)], name: CHAOS_NAMES[roll(CHAOS_NAMES.length)] }
          : { type: 'startWork', playerId: pid, unitId: all[roll(all.length)], work: CHAOS_WORKS[roll(CHAOS_WORKS.length)] };
      }
      const cities = ownCities(state, pid);
      if (cities.length === 0) return null;
      return {
        type: 'setProduction', playerId: pid,
        cityId: cities[roll(cities.length)], item: { kind: 'unit', id: 'settlers' }
      };
    }
    if (kind === 11) {
      return { type: 'startWork', playerId: pid, unitId: settlers[roll(settlers.length)], work: CHAOS_WORKS[roll(CHAOS_WORKS.length)] };
    }
    // foundCity: the accept window is a settler standing >= minCityDistance
    // from EVERY city (fresh ones sit IN their home city; the AI founds the
    // moment it arrives at a site, so windows last ~1 turn — pre-AI injection
    // is what makes them reachable at all). Scan for a window; without one,
    // WALK the farthest settler outward — chaos makes its own windows.
    const minDist = ruleset.rules.minCityDistance === undefined ? 4 : ruleset.rules.minCityDistance;
    let windowId = null, farId = null, farDist = -1, farUnit = null;
    for (const uid of settlers) {
      const u = state.units[uid];
      let near = 1e9;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        const dx = Math.abs(u.x - c.x), dy = Math.abs(u.y - c.y);
        const d = dx > dy ? dx : dy;
        if (d < near) near = d;
      }
      if (near >= minDist && windowId === null && u.moves > 0) windowId = uid;
      if (near > farDist) { farDist = near; farId = uid; farUnit = u; }
    }
    if (windowId !== null) {
      return { type: 'foundCity', playerId: pid, unitId: windowId, name: CHAOS_NAMES[roll(CHAOS_NAMES.length)] };
    }
    // no window: nudge the farthest settler outward, away from its nearest
    // city — a moveUnit that grows the next roll's founding chances
    let nx = 0, ny = 0, bestD = farDist;
    for (const [dir, dx, dy] of [['N', 0, -1], ['NE', 1, -1], ['E', 1, 0], ['SE', 1, 1], ['S', 0, 1], ['SW', -1, 1], ['W', -1, 0], ['NW', -1, -1]]) {
      let near = 1e9;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        const ddx = Math.abs(farUnit.x + dx - c.x), ddy = Math.abs(farUnit.y + dy - c.y);
        const d = ddx > ddy ? ddx : ddy;
        if (d < near) near = d;
      }
      if (near > bestD) { bestD = near; nx = dx; ny = dy; }
    }
    const DIR_BY_VEC = { '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE', '0,1': 'S', '-1,1': 'SW', '-1,0': 'W', '-1,-1': 'NW' };
    const outward = DIR_BY_VEC[nx + ',' + ny];
    if (outward !== undefined) {
      return { type: 'moveUnit', playerId: pid, unitId: farId, dir: outward };
    }
    return { type: 'foundCity', playerId: pid, unitId: farId, name: CHAOS_NAMES[roll(CHAOS_NAMES.length)] };
  }
  // kind 12: the specialist arm — taxmen/scientists (pop >= 5 validation and
  // the mood arithmetic under stress); workers list stays a candidates prefix
  const cities = ownCities(state, pid);
  if (cities.length === 0) return null;
  const city = state.cities[cities[roll(cities.length)]];
  const candidates = mods.candidateTiles(state, city, ruleset);
  const n = Math.min(Math.max(city.pop - 2, 0), candidates.length, roll(3));
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(candidates[i].idx);
  return {
    type: 'setWorkers', playerId: pid, cityId: city.id, workers,
    taxmen: roll(3), scientists: roll(3)
  };
}

function writeArtifacts(dir, seed, state, initialState, roundLog, rulesOverrides, reason, mods) {
  fs.mkdirSync(dir, { recursive: true });
  const savePath = path.join(dir, `sim-${seed}-t${state.turn}.save.json`);
  fs.writeFileSync(savePath, JSON.stringify({
    format: 'retromulticiv-save',
    savedAt: new Date().toISOString(),
    turn: state.turn,
    state
  }, null, 1));
  const diag = {
    format: 'retromulticiv-diagnostics',
    version: 1,
    allAi: true,
    sim: { seed, reason },
    rulesOverrides: rulesOverrides === undefined ? {} : rulesOverrides,
    initialState,
    log: roundLog
  };
  try {
    diag.finalHash = mods.hashState(state);
  } catch (e) { /* corrupt states stay bisectable up to the last good round */ }
  const diagPath = path.join(dir, `sim-${seed}.diag.json`);
  fs.writeFileSync(diagPath, JSON.stringify(diag));
  return { save: savePath, diag: diagPath };
}

// Run one all-AI game. Options:
//   seed (required), civs=4, width=80, height=50, turns=400,
//   rulesOverrides   e.g. { endYear: 9999 } for the 400-turn mechanics soak
//   checkEvery=1     cheap-invariant cadence (rounds)
//   hashEvery=10     round-hash cadence (bisection granularity in artifacts)
//   deepAt=[]        checkpoint rounds: deep audit + recorded hash
//   chaos=false      inject deterministic pseudo-random commands (own
//                    xorshift stream, ~1 per 6 player-slots) covering the
//                    human-only command surface; recorded per slot in the
//                    airound log entries so artifacts replay exactly
//   onCheckpoint(state, round, hash)
//   artifactsDir     failure artifact directory; false disables
// Returns { state, rounds, checkpoints, roundLog, initialState, finalHash }.
// Throws on any invariant failure or wedge (err.problems, err.artifacts).
async function runSim(opts) {
  const mods = await loadModules();
  const civs = opts.civs === undefined ? 4 : opts.civs;
  const width = opts.width === undefined ? 80 : opts.width;
  const height = opts.height === undefined ? 50 : opts.height;
  const turns = opts.turns === undefined ? 400 : opts.turns;
  const checkEvery = opts.checkEvery === undefined ? 1 : opts.checkEvery;
  const hashEvery = opts.hashEvery === undefined ? 10 : opts.hashEvery;
  const deepAt = opts.deepAt === undefined ? [] : opts.deepAt;
  const overrides = opts.rulesOverrides;
  let ruleset = RULESET;
  if (overrides !== undefined && Object.keys(overrides).length > 0) {
    ruleset = Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
  }
  const players = SIM_ROSTER.slice(0, civs).map(p => (
    { id: p.id, name: p.name, color: p.color, human: false, civ: p.civ }
  ));
  if (players.length < civs) throw new Error(`sim roster supports up to ${SIM_ROSTER.length} civs`);

  const engine = mods.createEngine(ruleset);
  let state = engine.createGame({ seed: opts.seed, options: { width, height, players } });
  if (state.ok === false) throw new Error(`createGame failed for seed ${opts.seed}: ${state.reason}`);
  const initialState = mods.deepClone(state);
  const roundLog = [];
  const checkpoints = {};

  function fail(reason, problems) {
    let artifacts = null;
    if (opts.artifactsDir !== false) {
      const dir = opts.artifactsDir === undefined ? DEFAULT_ARTIFACT_DIR : opts.artifactsDir;
      artifacts = writeArtifacts(dir, opts.seed, state, initialState, roundLog, overrides, reason, mods);
    }
    const detail = (problems || []).slice(0, 5).map(p => `\n  - ${p}`).join('');
    const where = artifacts ? `\n  artifacts: ${artifacts.save} (drag-drop into the browser), ${artifacts.diag} (node tools/replay.js)` : '';
    const err = new Error(`sim seed ${opts.seed}: ${reason}${detail}${where}`);
    err.problems = problems || [];
    err.artifacts = artifacts;
    err.seed = opts.seed;
    err.turn = state.turn;
    throw err;
  }

  let chaosRng = mods.seedRng(opts.seed + 999331); // separate stream, never state.rngState
  function roll(n) {
    const r = mods.rollRange(chaosRng, n);
    chaosRng = r.rngState;
    return r.value;
  }

  let prevYear = state.year;
  let rounds = 0;
  for (let round = 1; round <= turns; round++) {
    const startTurn = state.turn;
    const chaosLog = [];
    let guard = state.playerOrder.length + 2;
    while (state.turn === startTurn && !state.gameOver && guard > 0) {
      guard--;
      const pid = state.activePlayer;
      if (state.players[pid].alive !== false) {
        // chaos injects BEFORE the AI turn as of 2026-07-13 (@9ba56f30): a
        // player command lands on fresh moves and the AI plays around it —
        // post-AI leftovers made foundCity/moveUnit structurally dead. Sim
        // artifacts recorded before this date do not replay.
        if (opts.chaos === true && roll(opts.chaosRate === undefined ? 6 : opts.chaosRate) === 0) {
          const cmd = pickChaosCommand(state, pid, roll, ruleset, mods);
          if (cmd) {
            const res = engine.applyCommand(state, cmd);
            const centry = { playerId: pid, cmd, ok: res.ok };
            if (res.ok) state = res.state;
            else centry.reason = res.reason;
            chaosLog.push(centry);
          }
        }
        state = mods.runAiTurn(engine, state, pid, ruleset, []);
      }
      const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (!res.ok) fail(`endTurn rejected for ${pid} on turn ${startTurn} (${res.reason})`);
      state = res.state;
    }
    if (!state.gameOver && state.turn !== startTurn + 1) fail(`round ${round} wedged: turn stuck at ${state.turn}`);
    rounds = round;

    // hashing is ~a third of the runtime, so rounds carry a hash only every
    // hashEvery rounds (and at checkpoints/game end) — replay.js skips
    // hashless entries, so artifacts stay bisectable at this granularity
    const isCheckpoint = deepAt.indexOf(round) !== -1;
    const entry = { t: 'airound', turn: state.turn, activePlayer: state.activePlayer };
    if (chaosLog.length > 0) entry.chaos = chaosLog;
    let hash = '';
    if (isCheckpoint || state.gameOver || round === turns || round % hashEvery === 0) {
      try {
        hash = mods.hashState(state);
      } catch (e) {
        fail(`turn ${state.turn}: state not hashable — ${e.message}`);
      }
      entry.hash = hash;
    }
    roundLog.push(entry);
    // the calendar follows the yearSteps curve (A21) — verify against the
    // engine's own pure step function, not a hardcoded increment
    const expectYear = mods.nextYear(prevYear, ruleset.rules);
    if (state.year !== expectYear) fail(`round ${round}: year ${state.year}, expected ${expectYear}`);
    prevYear = state.year;

    if (isCheckpoint || state.gameOver || round % checkEvery === 0) {
      const problems = checkInvariants(state, ruleset);
      if (problems.length > 0) fail(`turn ${state.turn}: ${problems.length} invariant problem(s)`, problems);
    }
    if (isCheckpoint || state.gameOver) {
      const problems = checkDeep(state, ruleset, mods);
      if (problems.length > 0) fail(`turn ${state.turn}: ${problems.length} deep-audit problem(s)`, problems);
      // driver-level save/load round-trip (docs/05 §11 backlog): the browser
      // save path is a JSON snapshot — serialize + reload the ORGANIC state
      // and its canonical hash must not move (nulls/floats/undefined would)
      const reloaded = JSON.parse(JSON.stringify(state));
      const rtHash = mods.hashState(reloaded);
      const liveHash = mods.hashState(state);
      if (rtHash !== liveHash) {
        fail(`turn ${state.turn}: save/load round-trip hash moved`, [`${liveHash} -> ${rtHash}`]);
      }
    }
    if (isCheckpoint) {
      checkpoints[round] = hash;
      if (opts.onCheckpoint) opts.onCheckpoint(state, round, hash);
    }
    if (state.gameOver) break;
  }

  const last = roundLog.length > 0 ? roundLog[roundLog.length - 1].hash : undefined;
  return {
    state, rounds, checkpoints, roundLog, initialState,
    finalHash: last === undefined ? mods.hashState(state) : last
  };
}

module.exports = { runSim, checkInvariants, checkDeep, snapshot, summarize, loadModules, SIM_ROSTER };
