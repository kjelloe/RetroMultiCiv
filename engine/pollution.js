// A91 pollution (Civ 1): each city generates smokestack pollution from its shield
// output and its population; enough of it rolls a nearby land square dirty
// (tile.polluted). A nuclear-plant city in civil disorder before Fusion Power can
// also melt down, fouling an adjacent square (#2110). Runs after cities.processCities
// (reads the SAME gross shield output) and after the disorder verdict (meltdown needs
// it). Deterministic: every roll through engine/rng.js, iterating cityOrder in order.
// Global warming (A91b) rides the same tile.polluted flag — see processWarming.
// Lua-portable subset (no class/this/Map/Set).
import { rollRange } from './rng.js';
import { FAT_CROSS, cityShieldOutput, hasBuilding } from './cities.js';
import { cowTile } from './cow.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

// the 8 neighbor offsets — a meltdown fouls one ADJACENT square.
const ADJ = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];
// a fouled square + its 8 neighbors — the greenhouse degrades terrain in this reach.
const SELF_ADJ = [
  { dx: 0, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];

// the population pollution modifier %: the HIGHEST tech-gated tier the owner knows
// (cumulative-latest, not additive) — 0 with no industrial tech.
function popModifierPct(player, poll) {
  let pct = 0;
  const table = poll.popModifierPctByTech;
  for (const tech of Object.keys(table)) {
    if (player.techs.indexOf(tech) !== -1 && table[tech] > pct) pct = table[tech];
  }
  return pct;
}

// the land tiles among `offsets` around (cx, cy) that can still be fouled: in-bounds,
// land domain, not already polluted. Deterministic order (the offset list). The city
// centre is never in FAT_CROSS/ADJ, so it is never chosen.
function pollutableTiles(state, cx, cy, offsets, ruleset) {
  const out = [];
  const W = state.map.width, H = state.map.height;
  for (const o of offsets) {
    let x = cx + o.dx;
    if (x < 0 || x >= W) {
      if (state.map.wrapX !== true) continue;
      x = ((x % W) + W) % W;
    }
    const y = cy + o.dy;
    if (y < 0 || y >= H) continue;
    const tile = state.map.tiles[y * W + x];
    if (ruleset.terrain.terrains[tile.t].domain !== 'land') continue;
    if (tile.polluted === true) continue;
    out.push({ x, y });
  }
  return out;
}

// foul one random tile from `cands` (rng-pick), returning the fouled {x, y} or
// undefined — the placement roll is consumed ONLY when there is a candidate, so a
// fully-clean/blocked radius is a no-op (both engines). The caller emits the event.
function foulOne(state, cands) {
  if (cands.length === 0) return undefined;
  const roll = rollRange(state.rngState, cands.length);
  state.rngState = roll.rngState;
  const t = cands[roll.value];
  cowTile(state, t.y * state.map.width + t.x).polluted = true;
  return t;
}

// A91: per-city smokestack pollution + nuclear meltdown, once per turn.
function process(state, ruleset, events) {
  const poll = ruleset.rules.pollution;
  if (poll === undefined) return;
  const order = state.cityOrder === undefined ? [] : state.cityOrder;
  for (const cityId of order) {
    const city = state.cities[cityId];
    if (city === undefined) continue;
    const owner = state.players[city.owner];
    // industrial pollution: gross shields / divisor (a power plant halves it, a
    // recycling centre thirds it and takes precedence).
    let divisor = 1;
    if (hasBuilding(city, 'recycling-center')) divisor = poll.industrialDivisorRecycling;
    else if (hasBuilding(city, 'hydro-plant') || hasBuilding(city, 'nuclear-plant')) divisor = poll.industrialDivisorPower;
    const industrial = idiv(cityShieldOutput(state, city, ruleset), divisor);
    // population pollution: citySize * the tech modifier %, zeroed by Mass Transit.
    let popPoll = 0;
    if (!hasBuilding(city, 'mass-transit')) {
      popPoll = idiv(city.pop * popModifierPct(owner, poll), 100);
    }
    const points = (industrial + popPoll) - poll.tolerance;
    if (points > 0) {
      let chance = points * poll.smokestackPctPerPoint;
      if (chance > 100) chance = 100;
      const roll = rollRange(state.rngState, 100);
      state.rngState = roll.rngState;
      if (roll.value < chance) {
        const t = foulOne(state, pollutableTiles(state, city.x, city.y, FAT_CROSS, ruleset));
        if (t !== undefined) events.push({ type: 'pollutionSpread', x: t.x, y: t.y });
      }
    }
    // A91 meltdown (#2110): a nuclear-plant city in civil disorder, BEFORE Fusion
    // Power, risks a meltdown that fouls one adjacent square (pollution only, no pop).
    if (hasBuilding(city, 'nuclear-plant') && city.disorder === true
        && owner.techs.indexOf('fusion-power') === -1) {
      const roll = rollRange(state.rngState, poll.meltdownChance);
      state.rngState = roll.rngState;
      if (roll.value === 0) {
        const t = foulOne(state, pollutableTiles(state, city.x, city.y, ADJ, ruleset));
        if (t !== undefined) events.push({ type: 'cityMeltdown', cityId, x: t.x, y: t.y });
      }
    }
  }
  processWarming(state, ruleset, events);
}

// A91b global warming (Civ 1): while enough of the map stays fouled, a staged clock
// advances (warmingStages * warmingStageTurns of sustained pollution); on the last
// stage a greenhouse event degrades terrain near the fouled squares (plains -> desert,
// ocean -> swamp) and consumes that pollution, then the clock resets. Below the
// threshold the clock idles. state.warmingStage/warmingTimer stay absent until the
// first time pollution reaches the threshold (omit-when-default; pre-industrial games
// are byte-identical). Deterministic: the transform picks roll through engine/rng.js.
function processWarming(state, ruleset, events) {
  const poll = ruleset.rules.pollution;
  if (poll === undefined) return;
  const tiles = state.map.tiles;
  const polluted = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].polluted === true) polluted.push(i);
  }
  if (polluted.length < poll.warmingThreshold) return; // the clock idles below threshold
  let stage = state.warmingStage === undefined ? 0 : state.warmingStage;
  let timer = (state.warmingTimer === undefined ? 0 : state.warmingTimer) + 1;
  if (timer >= poll.warmingStageTurns) {
    timer = 0;
    stage = stage + 1;
    if (stage >= poll.warmingStages) {
      stage = 0;
      greenhouse(state, ruleset, polluted, events);
    }
  }
  state.warmingStage = stage;
  state.warmingTimer = timer;
}

// the greenhouse event: for each fouled square (in index order), degrade one matching
// tile in its reach (self + neighbors) per warmingTransforms, then clear that square's
// pollution — so warming self-limits (it eats the pollution that drove it).
function greenhouse(state, ruleset, polluted, events) {
  const poll = ruleset.rules.pollution;
  const W = state.map.width, H = state.map.height;
  // #2320: reads go through state.map.tiles (the current, possibly-cow'd array), writes through cowTile
  for (const idx of polluted) {
    const ex = idx % W, ey = idiv(idx, W);
    const cands = [];
    for (const o of SELF_ADJ) {
      let x = ex + o.dx;
      if (x < 0 || x >= W) {
        if (state.map.wrapX !== true) continue;
        x = ((x % W) + W) % W;
      }
      const y = ey + o.dy;
      if (y < 0 || y >= H) continue;
      if (poll.warmingTransforms[state.map.tiles[y * W + x].t] !== undefined) cands.push({ x, y });
    }
    if (cands.length > 0) {
      const pick = rollRange(state.rngState, cands.length);
      state.rngState = pick.rngState;
      const c = cands[pick.value];
      const tt = cowTile(state, c.y * W + c.x);
      tt.t = poll.warmingTransforms[tt.t];
      if (tt.polluted === true) delete tt.polluted;
      events.push({ type: 'terrainWarmed', x: c.x, y: c.y });
    }
    const src = cowTile(state, idx);
    delete src.polluted; // this square's pollution is consumed by the warming
  }
}

export { process };
