// Seeded world generation (roadmap phase 1, step 2).
// Deterministic: same seed + options => identical state (and hash).
// Integer math only; every random draw goes through engine/rng.js.
import { seedRng, rollRange } from './rng.js';
import { initExplored, reveal } from './visibility.js';
// shared/statehash is the ONLY sanctioned engine import from outside engine/
// (docs/02 §4): the cross-language deterministic hash core, with a co-located
// luau twin. Used here to pin the ruleset a game was created under.
import { hashState } from '../shared/statehash.js';

const DEFAULTS = { width: 80, height: 50, landPercent: 32, continents: 5 };

// #36 river knobs (OURS — not dump-sourced; document as house tuning): the share
// of LAND tiles a game's meandering river strips target, and the per-step chance a
// strip wiggles freely instead of gradient-descending toward the coast.
const RIVER_PCT = 11;
const MEANDER_PCT = 25;
// N,E,S,W — the fixed neighbour order for the river distance-field BFS + gradient
// tie-breaks (deterministic; the luau twin uses the same order).
const N4 = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];

// Terrain pick tables per latitude band: [terrainId, weight]
const BAND_POLAR = [['tundra', 55], ['forest', 20], ['hills', 15], ['mountains', 10]];
const BAND_TEMPERATE_FAR = [['forest', 25], ['grassland', 30], ['plains', 20], ['hills', 15], ['mountains', 10]];
const BAND_TEMPERATE = [['grassland', 35], ['plains', 25], ['forest', 15], ['hills', 10], ['mountains', 10], ['swamp', 5]];
const BAND_TROPIC = [['desert', 20], ['plains', 20], ['grassland', 25], ['jungle', 20], ['swamp', 10], ['mountains', 5]];

function idiv(a, b) {
  return Math.floor(a / b);
}

function pickWeighted(rngState, entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  const roll = rollRange(rngState, total);
  let acc = 0;
  for (const e of entries) {
    acc += e[1];
    if (roll.value < acc) return { rngState: roll.rngState, value: e[0] };
  }
  return { rngState: roll.rngState, value: entries[entries.length - 1][0] };
}

function wrap(x, width) {
  return ((x % width) + width) % width;
}

// Wrap-aware Chebyshev distance between two tiles.
function tileDistance(ax, ay, bx, by, width, wrapX) {
  let dx = Math.abs(ax - bx);
  if (wrapX && width - dx < dx) dx = width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

function generateTiles(rng, width, height, landPercent, continents) {
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'ocean' });

  // polar caps: top and bottom rows are Arctic land
  for (let x = 0; x < width; x++) {
    tiles[x] = { t: 'arctic' };
    tiles[(height - 1) * width + x] = { t: 'arctic' };
  }

  // continents: drunkard's-walk blobs of placeholder land
  const targetLand = idiv(width * height * landPercent, 100);
  let r = rng;
  for (let c = 0; c < continents; c++) {
    let budget = idiv(targetLand, continents);
    let roll = rollRange(r, width); r = roll.rngState;
    let x = roll.value;
    roll = rollRange(r, height - 8); r = roll.rngState;
    let y = 4 + roll.value;
    let steps = budget * 10;
    while (budget > 0 && steps > 0) {
      steps--;
      const i = y * width + x;
      if (tiles[i].t === 'ocean') {
        tiles[i].t = 'land';
        budget--;
      }
      roll = rollRange(r, 4); r = roll.rngState;
      if (roll.value === 0) x = wrap(x + 1, width);
      else if (roll.value === 1) x = wrap(x - 1, width);
      else if (roll.value === 2) y = y + 1;
      else y = y - 1;
      if (y < 2) y = 2;
      if (y > height - 3) y = height - 3;
    }
  }

  // terrain assignment by latitude band
  const equator2 = height - 1; // compare against y*2 to stay in integers
  for (let y = 1; y < height - 1; y++) {
    const latPct = idiv(Math.abs(y * 2 - equator2) * 100, equator2);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (tiles[i].t !== 'land') continue;
      const band = latPct >= 85 ? BAND_POLAR
        : latPct >= 60 ? BAND_TEMPERATE_FAR
        : latPct >= 30 ? BAND_TEMPERATE
        : BAND_TROPIC;
      const pick = pickWeighted(r, band);
      r = pick.rngState;
      tiles[i].t = pick.value;
    }
  }

  // rivers (#36, ruling A #2522): the `river` FLAG placed as meandering CONTINUOUS
  // strips — springs in hills/mountains flow to the nearest coast, ~RIVER_PCT% of
  // land flagged. "feature-on-terrain (Civ2-shape data model) with Civ1-authentic
  // effects + distribution". Deterministic: a distance-to-ocean field (multi-source
  // BFS, N4 order, ocean-index queue order), then each strip gradient-descends that
  // field toward the sea with a MEANDER_PCT free-wiggle chance. All draws in a fixed
  // order (spring pick, then per step: meander roll, and on a wiggle a neighbour
  // roll) — the luau twin mirrors the exact sequence. Knobs are OURS (documented).
  // Fix (A) #2573: the spring still STARTS in hills/mountains, but the FLAG is never
  // SET on a hills tile (mountains already excluded) — B19 forbids mining a river
  // tile, so flagging hills would strand their mine (+3 shields) at 0 (the audit's
  // ~165 mine-locked shields/world, an inauthentic world-tax). The strip walks
  // through hill country unflagged and flags the first non-hills tile downstream;
  // coverage + ribbon feel preserved (the loop consumes more steps/springs to reach
  // the same land-share target). Distribution-only change; effect tables untouched.
  let landCount = 0;
  for (const t of tiles) { if (t.t !== 'ocean' && t.t !== 'arctic') landCount++; }
  const target = idiv(landCount * RIVER_PCT, 100);
  // distance-to-ocean over every non-ocean tile (arctic/mountains included so a
  // spring always has a downhill path; they are just never FLAGGED). -1 = enclosed.
  const dist = [];
  for (let i = 0; i < width * height; i++) dist.push(-1);
  const queue = [];
  for (let i = 0; i < width * height; i++) { if (tiles[i].t === 'ocean') { dist[i] = 0; queue.push(i); } }
  let qh = 0;
  while (qh < queue.length) {
    const i = queue[qh]; qh++;
    const cx = i % width, cy = idiv(i, width);
    for (const d of N4) {
      const nx = wrap(cx + d.dx, width);
      const ny = cy + d.dy;
      if (ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (dist[ni] === -1 && tiles[ni].t !== 'ocean') { dist[ni] = dist[i] + 1; queue.push(ni); }
    }
  }
  // spring candidates: hills + mountains, tile-index order (deterministic).
  const springs = [];
  for (let i = 0; i < width * height; i++) { const tt = tiles[i].t; if (tt === 'hills' || tt === 'mountains') springs.push(i); }
  let flagged = 0;
  while (flagged < target && springs.length > 0) {
    let roll = rollRange(r, springs.length); r = roll.rngState;
    const springIdx = springs[roll.value];
    springs.splice(roll.value, 1);
    let x = springIdx % width, y = idiv(springIdx, width);
    let steps = 0; const maxSteps = width + height;
    while (steps < maxSteps && flagged < target) {
      const tile = tiles[y * width + x];
      if (tile.t === 'ocean') break; // reached the sea
      if (tile.t !== 'arctic' && tile.t !== 'mountains' && tile.t !== 'hills' && tile.river !== true) { tile.river = true; flagged++; }
      const cand = [];
      for (const d of N4) {
        const nx = wrap(x + d.dx, width);
        const ny = y + d.dy;
        if (ny < 0 || ny >= height) continue;
        cand.push({ nx, ny, dd: dist[ny * width + nx] });
      }
      if (cand.length === 0) break;
      roll = rollRange(r, 100); r = roll.rngState;
      if (roll.value < MEANDER_PCT) {
        roll = rollRange(r, cand.length); r = roll.rngState; // free wiggle
        x = cand[roll.value].nx; y = cand[roll.value].ny;
      } else {
        let chosen = cand[0]; // gradient descent; N4 order breaks ties
        for (const c of cand) { if (c.dd !== -1 && (chosen.dd === -1 || c.dd < chosen.dd)) chosen = c; }
        x = chosen.nx; y = chosen.ny;
      }
      steps++;
    }
  }

  // special resources: grassland uses the Civ 1-style fixed shield pattern,
  // everything else rolls sparsely
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y * width + x];
      if (tile.t === 'grassland') {
        if ((x + y) % 2 === 0) tile.special = true;
      } else {
        const roll = rollRange(r, 16); r = roll.rngState;
        if (roll.value === 0) tile.special = true;
      }
    }
  }

  return { tiles, rngState: r };
}

function findStarts(rng, map, players) {
  const { width, height, tiles } = map;
  const starts = [];
  let r = rng;
  let minDist = 12;
  const GOOD = { grassland: true, plains: true };
  while (starts.length < players.length && minDist >= 0) {
    let attempts = 300;
    while (starts.length < players.length && attempts > 0) {
      attempts--;
      let roll = rollRange(r, width); r = roll.rngState;
      const x = roll.value;
      roll = rollRange(r, height - 7); r = roll.rngState;
      const y = 3 + roll.value; // starts keep 3 tiles from the polar edges
      const tile = tiles[y * width + x];
      if (!GOOD[tile.t]) continue;
      let clear = true;
      for (const s of starts) {
        if (tileDistance(x, y, s.x, s.y, width, true) < minDist) { clear = false; break; }
      }
      if (clear) starts.push({ x, y });
    }
    minDist -= 3; // relax if the world is too cramped
  }
  return { starts, rngState: r };
}

// setup: { seed, options: { width?, height?, players: [{id,name,color,human}] } }
function createGame(setup, ruleset) {
  const options = setup.options || {};
  const width = options.width || DEFAULTS.width;
  const height = options.height || DEFAULTS.height;
  const playerDefs = options.players;
  if (!playerDefs || playerDefs.length < 1) {
    return { ok: false, reason: 'noPlayers' };
  }

  // A82a: a named map-type preset (rules.mapTypes) supplies landPercent/
  // continents when the caller didn't set them explicitly; unknown or absent
  // type falls through to DEFAULTS — the 'continents' preset carries the
  // DEFAULTS values, so the default world is byte-identical by construction.
  const presets = ruleset.rules.mapTypes;
  const preset = (presets !== undefined && options.mapType !== undefined
    && presets[options.mapType] !== undefined) ? presets[options.mapType] : {};

  let rng = seedRng(setup.seed);
  const gen = generateTiles(rng, width, height,
    options.landPercent || preset.landPercent || DEFAULTS.landPercent,
    options.continents || preset.continents || DEFAULTS.continents);
  const map = { width, height, wrapX: true, tiles: gen.tiles };

  const found = findStarts(gen.rngState, map, playerDefs);
  if (found.starts.length < playerDefs.length) {
    return { ok: false, reason: 'noStartPositions' };
  }

  // difficulty: resolve the ladder level (ascii id) from setup, default 'prince'; an
  // unknown id or a ruleset without the table falls back. startGold is a WORLD knob
  // (every player, all-AI included) applied to the base gold before civ specialties.
  const difficulties = ruleset.rules.difficulties;
  const dlevel = (difficulties !== undefined && options.difficulty !== undefined
    && difficulties[options.difficulty] !== undefined) ? options.difficulty
    : (difficulties !== undefined && difficulties.prince !== undefined ? 'prince' : undefined);
  const startGold = (dlevel !== undefined) ? difficulties[dlevel].startGold : 0;

  const players = {};
  const playerOrder = [];
  const units = {};
  for (let i = 0; i < playerDefs.length; i++) {
    const p = playerDefs[i];
    players[p.id] = {
      id: p.id, name: p.name, color: p.color,
      human: p.human === true, alive: true, gold: startGold, techs: [], researching: '',
      bulbs: 0,
      taxRate: ruleset.rules.defaultTaxRate,
      sciRate: ruleset.rules.defaultSciRate
    };
    // civilization identity + starting specialty (data/civs.json); defs
    // without a civ (tests, older callers) get none — hash-stable
    if (p.civ !== undefined && ruleset.civs !== undefined && ruleset.civs[p.civ] !== undefined) {
      players[p.id].civ = p.civ;
      const spec = ruleset.civs[p.civ].specialty;
      if (spec !== undefined) {
        if (spec.type === 'startTech') players[p.id].techs.push(spec.tech);
        if (spec.type === 'startGold') players[p.id].gold = players[p.id].gold + spec.gold;
      }
    }
    playerOrder.push(p.id);
    const uid = 'u' + (i + 1);
    units[uid] = {
      id: uid, type: 'settlers', owner: p.id,
      x: found.starts[i].x, y: found.starts[i].y,
      moves: ruleset.units.settlers.moves, fortified: false, veteran: false
    };
  }

  // stance-mix v1: seed a fraction of the AI civs as 'builder' (heterogeneous
  // economy — some civs build wonders). Deterministic + replay-identical: a
  // Fisher-Yates shuffle through the game rng, threaded into state.rngState.
  // aiBuilderPct=0 -> zero builders, NO stance field written, NO rng draw, so
  // rngState stays found.rngState => a game byte-identical to the pre-stance
  // engine (the dormant-capability identity). Humans keep the regency stance.
  let rngS = found.rngState;
  const aiIds = [];
  for (let i = 0; i < playerDefs.length; i++) {
    if (playerDefs[i].human !== true) aiIds.push(playerDefs[i].id);
  }
  const builderPct = ruleset.rules.aiBuilderPct === undefined ? 0 : ruleset.rules.aiBuilderPct;
  const nBuilders = (builderPct === 0 || aiIds.length === 0) ? 0 : Math.max(1, idiv(aiIds.length * builderPct, 100));
  if (nBuilders > 0) {
    const order = aiIds.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const r = rollRange(rngS, i + 1);
      rngS = r.rngState;
      const j = r.value;
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    for (let k = 0; k < nBuilders; k++) {
      players[order[k]].stance = 'builder';
    }
  }

  const state = {
    version: 1,
    // ruleset-compat pin: the statehash of the ruleset this game was created
    // under, so a save carries the rules that produced it (docs/02 §7). Checked
    // strictly at LOAD; omit-safe (crafted states without it are exempt).
    rulesetHash: '0x' + (hashState(ruleset) >>> 0).toString(16).padStart(8, '0'),
    turn: 1,
    year: -4000,
    activePlayer: playerOrder[0],
    playerOrder,
    map,
    units,
    cities: {},
    cityOrder: [],
    wonders: {},
    nextUnitId: playerDefs.length + 1,
    nextCityId: 1,
    players,
    rngState: rngS
  };
  // omit-safe: a ruleset without a difficulties table carries no difficulty field
  // (neutral — every hook falls back to today's value).
  if (dlevel !== undefined) state.difficulty = dlevel;

  initExplored(state);
  for (const id of Object.keys(units)) {
    const u = units[id];
    reveal(state, u.owner, u.x, u.y, 2);
  }
  // N13: goody-hut sprinkle — the LAST createGame rng pass (no downstream draws).
  // Per-LAND-tile 1-in-rules.hut.density over the LINEAR tile index (R2),
  // EXCLUDING every start tile + its 8 neighbours. tile.hut=true (omit-safe on
  // water/plain tiles). Shifts the rng sequence → full map/sim golden re-record.
  const hutExcl = {};
  for (const s of found.starts) {
    for (let dy = -1; dy <= 1; dy++) {
      const ey = s.y + dy;
      if (ey < 0 || ey >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const ex = (((s.x + dx) % width) + width) % width; // maps always wrapX
        hutExcl[ey * width + ex] = true;
      }
    }
  }
  const hutDensity = ruleset.rules.hut.density;
  for (let i = 0; i < width * height; i++) {
    if (hutExcl[i] === true) continue;
    if (ruleset.terrain.terrains[state.map.tiles[i].t].domain !== 'land') continue;
    const roll = rollRange(state.rngState, hutDensity);
    state.rngState = roll.rngState;
    if (roll.value === 0) state.map.tiles[i].hut = true;
  }
  // A92: debug games carry state.debugEnabled (server --debug / Studio / ?debug=1).
  // OMIT-SAFE — a normal game never stamps it, so the goldens are untouched.
  if (setup.debug === true) state.debugEnabled = true;
  return state;
}

export { createGame, tileDistance, pickWeighted };
