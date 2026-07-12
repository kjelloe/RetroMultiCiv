// Seeded world generation (roadmap phase 1, step 2).
// Deterministic: same seed + options => identical state (and hash).
// Integer math only; every random draw goes through engine/rng.js.
import { seedRng, rollRange } from './rng.js';
import { initExplored, reveal } from './visibility.js';

const DEFAULTS = { width: 80, height: 50, landPercent: 32, continents: 5 };

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

  // rivers: short walks flagged onto land tiles
  let landCount = 0;
  for (const t of tiles) { if (t.t !== 'ocean' && t.t !== 'arctic') landCount++; }
  const rivers = idiv(landCount, 50);
  for (let n = 0; n < rivers; n++) {
    let roll = rollRange(r, width); r = roll.rngState;
    let x = roll.value;
    roll = rollRange(r, height - 2); r = roll.rngState;
    let y = 1 + roll.value;
    roll = rollRange(r, 6); r = roll.rngState;
    let len = 3 + roll.value;
    while (len > 0) {
      len--;
      const tile = tiles[y * width + x];
      if (tile.t !== 'ocean' && tile.t !== 'arctic' && tile.t !== 'mountains') tile.river = true;
      roll = rollRange(r, 4); r = roll.rngState;
      if (roll.value === 0) x = wrap(x + 1, width);
      else if (roll.value === 1) x = wrap(x - 1, width);
      else if (roll.value === 2) y = Math.min(height - 2, y + 1);
      else y = Math.max(1, y - 1);
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

  let rng = seedRng(setup.seed);
  const gen = generateTiles(rng, width, height,
    options.landPercent || DEFAULTS.landPercent,
    options.continents || DEFAULTS.continents);
  const map = { width, height, wrapX: true, tiles: gen.tiles };

  const found = findStarts(gen.rngState, map, playerDefs);
  if (found.starts.length < playerDefs.length) {
    return { ok: false, reason: 'noStartPositions' };
  }

  const players = {};
  const playerOrder = [];
  const units = {};
  for (let i = 0; i < playerDefs.length; i++) {
    const p = playerDefs[i];
    players[p.id] = {
      id: p.id, name: p.name, color: p.color,
      human: p.human === true, alive: true, gold: 0, techs: [], researching: '',
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

  const state = {
    version: 1,
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
    rngState: found.rngState
  };

  initExplored(state);
  for (const id of Object.keys(units)) {
    const u = units[id];
    reveal(state, u.owner, u.x, u.y, 2);
  }
  return state;
}

export { createGame, tileDistance, pickWeighted };
