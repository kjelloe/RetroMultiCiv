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
// MAX_UNITS recalibrated 600→1000 (2026-07-14): batch-4's entertainers
// lever made healthy GE empires far larger (16 cities / ~270 units per
// thriving civ — seed 6 hit 603 at turn 314 and completed 400 rounds
// fine on replay). The known growth driver is settler-paver
// accumulation under freeUnitsPerCity 99 — an AI-efficiency target in
// the docs/04 ledger, not a runaway: growth is linear with cities.
const MAX_POP = 40;
const MAX_UNITS = 1000;
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
    workedTiles: citiesMod.workedTiles,
    hasBuilding: citiesMod.hasBuilding,
    wonderActive: citiesMod.wonderActive,
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
    // A69: a land unit ABOARD a ship legally sits at the ship's (sea) tile.
    if (def.domain === 'land' && tileDomain !== 'land' && u.aboard === undefined) bad(`unit ${uid}: land unit (${u.type}) on ${tileDomain}`);
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
const RIVAL_PLAYER_KEYS = { id: true, name: true, color: true, human: true, stance: true }; // stance-mix: AI stance is public (R21)

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
    // B28: A79's blockade drops an enemy-occupied tile from candidateTiles BY
    // DESIGN while the manual assignment persists (the citizen idles until the
    // enemy leaves). So a manual tile absent from candidates is allowed IFF an
    // enemy unit stands on it (mirror the candidateTiles blockade condition); a
    // plain non-candidate manual tile is still a real bug.
    const width = state.map.width;
    const blockaded = {};
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.owner !== city.owner) blockaded[u.y * width + u.x] = true;
    }
    for (const idx of city.workers) {
      if (valid[idx] === true) continue;
      if (blockaded[idx] === true) continue; // blockaded manual tile: allowed (A79)
      problems.push(`city ${cid}: manual worker tile ${idx} is not a candidate tile (and no enemy blockades it)`);
    }
  }
  return problems;
}

// Structured per-player stats for one state — the telemetry row format
// (tools/soak.js --stats appends these as JSONL for balance-drift charting)
// and the base of the human summary line. M1 techs + M2 cities live here.
function basicSnapshot(state, ruleset, mods) {
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

// ==== A64 AI-health telemetry (docs/05 §12, columns M3–M14) =================
// DRIVER-OWNED DIAGNOSTICS: everything here READS state/events; the cumulative
// half (M8-attempts, M10-M13 events, M12 idle) rides a `tel` accumulator passed
// ALONGSIDE state, never inside it — so the recording and the golden hashes are
// untouched (architect ruling @2d95d58e). Pure-state columns need no tel.

// 8-connected, wrap-aware flood-fill labelling every LAND tile with a continent
// id (-1 = not land). Movement is 8-directional so a diagonal land bridge is
// one landmass — "same continent" (M5) and "cross-water" (M13) both key off it.
// Land↔water never changes under any work order, so runSim labels once.
function landContinents(map, ruleset) {
  const W = map.width, H = map.height, N = W * H;
  const label = new Array(N).fill(-1);
  const isLand = (i) => {
    const terr = ruleset.terrain.terrains[map.tiles[i].t];
    return terr !== undefined && terr.domain === 'land';
  };
  let next = 0;
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (label[s] !== -1 || !isLand(s)) continue;
    label[s] = next; stack.length = 0; stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          let nx = x + dx;
          if (map.wrapX === true) nx = ((nx % W) + W) % W;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (label[ni] === -1 && isLand(ni)) { label[ni] = next; stack.push(ni); }
        }
      }
    }
    next = next + 1;
  }
  return { label, count: next };
}

// Connected components of the movement network (city tiles are hubs — Civ 1
// cities carry an implicit road). useRail restricts it to railed tiles. Two
// cities in the same component are network-connected. Global (all civs' roads).
function netComponents(state, useRail) {
  const map = state.map, W = map.width, H = map.height, N = W * H;
  const cityTile = {};
  for (const cid of state.cityOrder) { const c = state.cities[cid]; if (c) cityTile[c.y * W + c.x] = true; }
  const onNet = (i) => {
    if (cityTile[i] === true) return true;
    const t = map.tiles[i];
    return useRail ? t.railroad === true : (t.road === true || t.railroad === true);
  };
  const label = new Array(N).fill(-1);
  let next = 0; const stack = [];
  for (let s = 0; s < N; s++) {
    if (label[s] !== -1 || !onNet(s)) continue;
    label[s] = next; stack.length = 0; stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          let nx = x + dx;
          if (map.wrapX === true) nx = ((nx % W) + W) % W;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (label[ni] === -1 && onNet(ni)) { label[ni] = next; stack.push(ni); }
        }
      }
    }
    next = next + 1;
  }
  return label;
}

// M4: over a civ's WORKED tiles, the share carrying the improvement its terrain
// warrants — road where roadable, and irrigation OR mine where the terrain
// yields one. The auto-improved city centre counts as complete.
function improvementPct(state, pid, ruleset, mods) {
  const W = state.map.width;
  let worked = 0, done = 0;
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (!c || c.owner !== pid) continue;
    for (const wt of mods.workedTiles(state, c, ruleset)) {
      const tile = state.map.tiles[wt.y * W + wt.x];
      const terr = ruleset.terrain.terrains[tile.t];
      if (terr === undefined) continue;
      worked = worked + 1;
      if (wt.center === true) { done = done + 1; continue; } // city square is auto-developed
      const roadOk = terr.road === undefined || tile.road === true || tile.railroad === true;
      const digOk = (terr.irrigate === undefined && terr.mine === undefined)
        || tile.irrigation === true || tile.mine === true;
      if (roadOk && digOk) done = done + 1;
    }
  }
  return worked === 0 ? null : Math.round((done * 100) / worked);
}

// M-support (resourceCov, docs/05 §12): of the SPECIAL-resource tiles inside a
// civ's city work radii (the fat cross — center + candidateTiles), the share
// actually WORKED. Deduped by tile index so overlapping radii don't double-count
// a shared special. null when the civ has no special in any radius. Telemetry
// only (reads state.map.tiles[].special), never writes — goldens untouched.
function resourceCovPct(state, pid, ruleset, mods) {
  const W = state.map.width;
  const inRadius = {}; // idx -> true : a special tile within some city's radius
  const worked = {};   // idx -> true : a special tile a city actually works
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (!c || c.owner !== pid) continue;
    const ci = c.y * W + c.x; // the auto-worked centre
    if (state.map.tiles[ci].special === true) { inRadius[ci] = true; worked[ci] = true; }
    for (const cand of mods.candidateTiles(state, c, ruleset)) {
      if (state.map.tiles[cand.idx].special === true) inRadius[cand.idx] = true;
    }
    for (const wt of mods.workedTiles(state, c, ruleset)) {
      const idx = wt.y * W + wt.x;
      if (state.map.tiles[idx].special === true) worked[idx] = true;
    }
  }
  let total = 0, cov = 0;
  for (const idx in inRadius) { total = total + 1; if (worked[idx] === true) cov = cov + 1; }
  return total === 0 ? null : Math.round((cov * 100) / total);
}

// M5: of a civ's SAME-CONTINENT city pairs, the share joined by a contiguous
// road (or rail) network. null when the civ has < 2 same-continent cities.
function networkPct(state, pid, contLabels, netLabel) {
  const W = state.map.width;
  const cities = [];
  for (const cid of state.cityOrder) { const c = state.cities[cid]; if (c && c.owner === pid) cities.push(c); }
  let pairs = 0, conn = 0;
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const ia = cities[i].y * W + cities[i].x, ib = cities[j].y * W + cities[j].x;
      if (contLabels.label[ia] === -1 || contLabels.label[ia] !== contLabels.label[ib]) continue;
      pairs = pairs + 1;
      if (netLabel[ia] !== -1 && netLabel[ia] === netLabel[ib]) conn = conn + 1;
    }
  }
  return pairs === 0 ? null : Math.round((conn * 100) / pairs);
}

// M9: share of NON-ice tiles the civ has explored (the poles are excluded — the
// target is "everything but the ice caps"). Omniscient test states report 100.
function explorationPct(state, pid, ruleset) {
  const p = state.players[pid];
  if (!p || !p.explored) return 100;
  const tiles = state.map.tiles;
  let total = 0, seen = 0;
  for (let i = 0; i < tiles.length; i++) {
    const terr = ruleset.terrain.terrains[tiles[i].t];
    if (terr === undefined || terr.domain === 'ice') continue;
    total = total + 1;
    if (p.explored[i] === 1) seen = seen + 1;
  }
  return total === 0 ? 0 : Math.round((seen * 100) / total);
}

// M6 (PARTIAL — full obsoletedBy % is reserved for A63, per §12): the share of
// a civ's MILITARY units (attack >= 1) sitting at the civ's own best power tier
// (max of attack/defense). A coarse "is the army modern for what this civ can
// field" proxy until the tech obsoletedBy chains land.
function militaryPct(state, pid, ruleset) {
  const powers = [];
  let best = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner !== pid) continue;
    const d = ruleset.units[u.type];
    if (!d || (d.attack === undefined ? 0 : d.attack) < 1) continue; // non-military
    const atk = d.attack === undefined ? 0 : d.attack;
    const def = d.defense === undefined ? 0 : d.defense;
    const pw = atk > def ? atk : def;
    powers.push(pw);
    if (pw > best) best = pw;
  }
  if (powers.length === 0) return null;
  let atBest = 0;
  for (const pw of powers) if (pw === best) atBest = atBest + 1;
  return Math.round((atBest * 100) / powers.length);
}

// M7: per-city, the share of the beneficial (non-defensive) buildings the civ's
// TECH makes available that the city actually has — "are cities keeping their
// economic buildings current for their era", averaged over the civ's cities.
function eraBuildingPct(state, pid, ruleset, mods) {
  const p = state.players[pid];
  const known = {};
  for (const t of p.techs) known[t] = true;
  const avail = [];
  for (const bid of Object.keys(ruleset.buildings)) {
    const d = ruleset.buildings[bid];
    if (d.defenseMultiplier !== undefined) continue; // purely defensive → not this column
    if (d.tech === undefined || known[d.tech] === true) avail.push(bid);
  }
  if (avail.length === 0) return null;
  let cities = 0, sum = 0;
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (!c || c.owner !== pid) continue;
    cities = cities + 1;
    let have = 0;
    for (const bid of avail) if (mods.hasBuilding(c, bid)) have = have + 1;
    sum = sum + (have * 100) / avail.length;
  }
  return cities === 0 ? null : Math.round(sum / cities);
}

// M8 (state half): wonders completed + wonders in production right now.
function wonderStats(state, pid) {
  let completed = 0, active = 0;
  const built = state.wonders === undefined ? {} : state.wonders;
  for (const wid of Object.keys(built)) {
    const c = state.cities[built[wid]];
    if (c && c.owner === pid) completed = completed + 1;
  }
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (c && c.owner === pid && c.producing && c.producing.kind === 'wonder') active = active + 1;
  }
  return { completed, active };
}

// M13 (state half): distinct continents the civ has a city on.
function continentsSettled(state, pid, contLabels) {
  const W = state.map.width;
  const seen = {}; let n = 0;
  for (const cid of state.cityOrder) {
    const c = state.cities[cid];
    if (!c || c.owner !== pid) continue;
    const lab = contLabels.label[c.y * W + c.x];
    if (lab !== -1 && seen[lab] !== true) { seen[lab] = true; n = n + 1; }
  }
  return n;
}

// M12 (state half over the ledger): settlers idle > 10 turns (NOT terraforming)
// and non-settler units unmoved > 15 turns outside a city/fortress.
function idleCounts(tel, state, ruleset) {
  const W = state.map.width;
  const out = {};
  for (const pid of state.playerOrder) out[pid] = { idleSet: 0, stuckU: 0 };
  const cityTile = {};
  for (const cid of state.cityOrder) { const c = state.cities[cid]; if (c) cityTile[c.y * W + c.x] = true; }
  const turn = state.turn;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    const rec = tel.ledger[uid];
    const o = out[u.owner];
    if (rec === undefined || !o) continue;
    const idle = turn - rec.since;
    if (u.type === 'settlers') {
      if (idle > 10 && u.working === undefined) o.idleSet = o.idleSet + 1;
    } else {
      const i = u.y * W + u.x;
      const sheltered = cityTile[i] === true || state.map.tiles[i].fortress === true;
      if (idle > 15 && !sheltered) o.stuckU = o.stuckU + 1;
    }
  }
  return out;
}

// The cumulative accumulator — driver-only, seeded from the initial roster.
function makeTelemetry(state) {
  const per = {};
  for (const pid of state.playerOrder) {
    per[pid] = { buys: 0, attacks: 0, captures: 0, crossWater: 0, wonderTry: 0 };
  }
  return { per, ledger: {}, seenWonders: {} };
}

// Passive consumption of the events the engine ALREADY produced this turn —
// feeds M8-attempts / M10-buys / M11-attacks+captures / M13-cross-water. Reads
// state (to resolve a city's owner), never writes it.
function absorbEvents(tel, events, state, contLabels) {
  const W = state.map.width;
  for (const e of events) {
    if (e.type === 'combatResolved') {
      const a = tel.per[e.attackerOwner]; if (a) a.attacks = a.attacks + 1;
    } else if (e.type === 'cityCaptured') {
      const a = tel.per[e.to]; if (a) a.captures = a.captures + 1;
    } else if (e.type === 'productionBought') {
      const c = state.cities[e.cityId];
      if (c) { const a = tel.per[c.owner]; if (a) a.buys = a.buys + 1; }
    } else if (e.type === 'productionSet') {
      if (e.item && e.item.kind === 'wonder') {
        const c = state.cities[e.cityId];
        if (c) {
          const key = c.owner + ':' + e.item.id;
          if (tel.seenWonders[key] !== true) {
            tel.seenWonders[key] = true;
            const a = tel.per[c.owner]; if (a) a.wonderTry = a.wonderTry + 1;
          }
        }
      }
    } else if (e.type === 'cityFounded') {
      const c = state.cities[e.cityId];
      if (c) {
        const lab = contLabels.label[e.y * W + e.x];
        let other = false, sameCont = false;
        for (const cid of state.cityOrder) {
          const oc = state.cities[cid];
          if (!oc || oc.owner !== c.owner || oc.id === c.id) continue;
          other = true;
          if (contLabels.label[oc.y * W + oc.x] === lab) { sameCont = true; break; }
        }
        if (other && !sameCont) { const a = tel.per[c.owner]; if (a) a.crossWater = a.crossWater + 1; }
      }
    }
  }
}

// Refresh the driver-only unit ledger: a unit whose tile is unchanged accrues
// idle turns (M12). New units start their clock; dead units drop out.
function updateLedger(tel, state, turn) {
  const live = {};
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    live[uid] = true;
    const rec = tel.ledger[uid];
    if (rec === undefined) tel.ledger[uid] = { x: u.x, y: u.y, since: turn };
    else if (rec.x !== u.x || rec.y !== u.y) { rec.x = u.x; rec.y = u.y; rec.since = turn; }
  }
  for (const uid of Object.keys(tel.ledger)) if (live[uid] !== true) delete tel.ledger[uid];
}

// The full telemetry row (basicSnapshot enriched with M3–M14). `tel` and
// `contLabels` are optional: without them the pure-state columns still fill and
// the cumulative ones are omitted (summarize passes neither).
function snapshot(state, ruleset, mods, tel, contLabels) {
  const snap = basicSnapshot(state, ruleset, mods);
  const cont = contLabels || landContinents(state.map, ruleset);
  const netRoad = netComponents(state, false);
  const netRail = netComponents(state, true);
  const idle = tel ? idleCounts(tel, state, ruleset) : null;
  for (const pl of snap.players) {
    const pid = pl.id;
    let pop = 0;
    for (const cid of state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.owner === pid) pop = pop + c.pop;
    }
    const w = wonderStats(state, pid);
    pl.pop = pop;                                        // M3
    pl.imprPct = improvementPct(state, pid, ruleset, mods); // M4
    pl.resourceCov = resourceCovPct(state, pid, ruleset, mods); // M-support (A93 floor)
    pl.netRoad = networkPct(state, pid, cont, netRoad);  // M5 road
    pl.netRail = networkPct(state, pid, cont, netRail);  // M5 rail
    pl.milPct = militaryPct(state, pid, ruleset);        // M6 (partial)
    pl.bldgPct = eraBuildingPct(state, pid, ruleset, mods); // M7
    pl.wonders = w.completed;                            // M8 completions
    pl.wonderAct = w.active;                             // M8 in-progress
    pl.explPct = explorationPct(state, pid, ruleset);    // M9
    pl.continents = continentsSettled(state, pid, cont); // M13 (state half)
    if (tel && tel.per[pid]) {
      const t = tel.per[pid];
      pl.buys = t.buys;                 // M10 (gold already on the row)
      pl.attacks = t.attacks;           // M11
      pl.captures = t.captures;         // M11
      pl.wonderTry = t.wonderTry;       // M8 attempts
      pl.crossWater = t.crossWater;     // M13 (event half)
    }
    if (idle) { pl.idleSet = idle[pid].idleSet; pl.stuckU = idle[pid].stuckU; } // M12
  }
  // M11 eliminations + M14 spread are cross-civ — row-level, from the survivors
  let alive = 0, best = 0, worst = 0;
  for (const pl of snap.players) {
    if (!pl.alive) continue;
    alive = alive + 1;
    if (worst === 0 || pl.score < worst) worst = pl.score;
    if (pl.score > best) best = pl.score;
  }
  snap.aliveCivs = alive;                                          // M11 elimination base
  snap.deadCivs = snap.players.length - alive;
  snap.scoreSpread = worst > 0 ? Math.round((best * 100) / worst) / 100 : null; // M14 (×100 → 2dp)
  return snap;
}

// One readable line per checkpoint so soak logs tell a story at a glance.
function summarize(state, ruleset, mods) {
  const snap = basicSnapshot(state, ruleset, mods);
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

function writeArtifacts(dir, seed, state, initialState, roundLog, rulesOverrides, reason, mods, problems) {
  fs.mkdirSync(dir, { recursive: true });
  const savePath = path.join(dir, `sim-${seed}-t${state.turn}.save.json`);
  fs.writeFileSync(savePath, JSON.stringify({
    format: 'retromulticiv-save',
    savedAt: new Date().toISOString(),
    turn: state.turn,
    state,
    // B9: the save travels alone (drag-drop) — it carries its own diagnosis
    simFailure: { seed, reason, turn: state.turn, problems: problems || [] }
  }, null, 1));
  const diag = {
    format: 'retromulticiv-diagnostics',
    version: 1,
    allAi: true,
    // B9: problem TEXT verbatim, not just the count in `reason` — extracting
    // it from a lost terminal once cost a 7-minute re-simulation
    sim: { seed, reason, turn: state.turn, problems: problems || [] },
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
//   extraInvariant   caller tripwires: state => [problem strings] — runs with
//                    the cheap invariants (scenario-specific soak checks; also
//                    the deterministic failure injector in the B9 test)
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
  const options = { width, height, players };
  if (opts.difficulty !== undefined) options.difficulty = opts.difficulty;
  if (opts.mapType !== undefined) options.mapType = opts.mapType; // naval-loop witness: archipelago seeds
  let state = engine.createGame({ seed: opts.seed, options });
  if (state.ok === false) throw new Error(`createGame failed for seed ${opts.seed}: ${state.reason}`);
  const initialState = mods.deepClone(state);
  const roundLog = [];
  const checkpoints = {};
  // A64: driver-owned telemetry — the cumulative accumulator + the once-labelled
  // continents (land↔water never changes under any work order). Never in state.
  const tel = makeTelemetry(state);
  const contLabels = landContinents(state.map, ruleset);

  function fail(reason, problems) {
    let artifacts = null;
    if (opts.artifactsDir !== false) {
      const dir = opts.artifactsDir === undefined ? DEFAULT_ARTIFACT_DIR : opts.artifactsDir;
      // B9: the artifacts must carry the DIAGNOSIS (problem text + turn), not
      // just a count — the throwing process's transcript is not durable
      artifacts = writeArtifacts(dir, opts.seed, state, initialState, roundLog, overrides, reason, mods, problems);
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
  // v1.5 diagnostics (golden-neutral: read-only, never hashed) — elimination
  // timeline for the outcome row; the per-AI strategic snapshot hook fires below.
  const elimTimeline = [];
  const aliveWas = {}; for (const p of players) aliveWas[p.id] = true;
  for (let round = 1; round <= turns; round++) {
    const startTurn = state.turn;
    const chaosLog = [];
    const evs = []; // A64: this round's events, captured (not discarded) for tel
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
            if (res.ok) { state = res.state; for (const e of res.events) evs.push(e); }
            else centry.reason = res.reason;
            chaosLog.push(centry);
          }
        }
        state = mods.runAiTurn(engine, state, pid, ruleset, evs);
      }
      const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (!res.ok) fail(`endTurn rejected for ${pid} on turn ${startTurn} (${res.reason})`);
      state = res.state;
      for (const e of res.events) evs.push(e);
    }
    if (!state.gameOver && state.turn !== startTurn + 1) fail(`round ${round} wedged: turn stuck at ${state.turn}`);
    rounds = round;
    // A64: fold this round's events + settled unit positions into the telemetry
    // accumulator (passive reads of outputs the engine already produced).
    absorbEvents(tel, evs, state, contLabels);
    updateLedger(tel, state, state.turn);

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
      if (opts.extraInvariant) {
        for (const p of opts.extraInvariant(state) || []) problems.push(p);
      }
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
      if (opts.onCheckpoint) opts.onCheckpoint(state, round, hash, tel, contLabels);
    }
    // v1.5 diagnostics: record newly-eliminated civs + fire the per-AI strategic
    // snapshot every strategicEvery turns. Read-only; nothing touches the hash.
    for (const p of players) {
      if (aliveWas[p.id] && state.players[p.id].alive === false) { aliveWas[p.id] = false; elimTimeline.push({ id: p.id, turn: state.turn }); }
    }
    if (opts.onStrategic && round % (opts.strategicEvery === undefined ? 10 : opts.strategicEvery) === 0) {
      opts.onStrategic(state, round, tel, contLabels);
    }
    if (state.gameOver) break;
  }

  const last = roundLog.length > 0 ? roundLog[roundLog.length - 1].hash : undefined;
  return {
    state, rounds, checkpoints, roundLog, initialState,
    finalHash: last === undefined ? mods.hashState(state) : last,
    // A64: expose the driver-owned telemetry accumulator + continent labels so a
    // DIRECT runSim caller (not going through soak's onCheckpoint) can build a
    // full snapshot: snapshot(result.state, ruleset, mods, result.tel, result.contLabels).
    tel, contLabels,
    // v1.5 diagnostics: outcome data for the soak outcome row (golden-neutral).
    outcome: { elimTimeline, victoryType: state.gameOver ? (state.winner ? 'conquest' : 'score') : 'timeout', victoryTurn: state.turn }
  };
}

module.exports = {
  runSim, checkInvariants, checkDeep, snapshot, basicSnapshot, summarize, loadModules, SIM_ROSTER,
  // A64 telemetry internals, exported for test/sim-telemetry.test.js
  landContinents, netComponents, networkPct, explorationPct, continentsSettled,
  makeTelemetry, absorbEvents, updateLedger, idleCounts, resourceCovPct
};
