// Fog of war. Three tile states per player:
//   unknown   — never seen: filtered views mask the tile entirely
//   explored  — seen before: terrain is remembered, current contents hidden
//   visible   — in sight range of a unit (radius 1) or city (radius 2) now
// `explored` persists in game state as a per-player 0/1 array (hash-safe);
// visibility is recomputed on demand. filterView() is THE per-player view —
// the phase-3 server sends nothing else to clients, so no state it strips
// (rngState, other players' internals, unexplored map) ever leaks.
// A player without an `explored` array is treated as omniscient (test states).

function initExplored(state) {
  const size = state.map.width * state.map.height;
  for (const pid of state.playerOrder) {
    const arr = [];
    for (let i = 0; i < size; i++) arr.push(0);
    state.players[pid].explored = arr;
  }
}

function reveal(state, playerId, x, y, radius) {
  const player = state.players[playerId];
  if (!player || !player.explored) return;
  const { width, height, wrapX } = state.map;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      let xx = x + dx;
      if (xx < 0 || xx >= width) {
        if (!wrapX) continue;
        xx = ((xx % width) + width) % width;
      }
      player.explored[yy * width + xx] = 1;
    }
  }
}

function markCircle(mask, map, x, y, radius) {
  const { width, height, wrapX } = map;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      let xx = x + dx;
      if (xx < 0 || xx >= width) {
        if (!wrapX) continue;
        xx = ((xx % width) + width) % width;
      }
      mask[yy * width + xx] = 1;
    }
  }
}

// naval-truth (Bundle 2): a unit's sight radius — units.json `sight` (default 1; 2 for
// the A71 set: submarine/carrier/battleship/cruiser/bomber). ruleset optional so old
// callers keep the radius-1 default (back-compat / crafted-state safety).
function unitSight(unit, ruleset) {
  if (ruleset === undefined) return 1;
  const s = ruleset.units[unit.type].sight;
  return s === undefined ? 1 : s;
}

function computeVisible(state, playerId, ruleset) {
  const size = state.map.width * state.map.height;
  const mask = [];
  for (let i = 0; i < size; i++) mask.push(0);
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (u.owner === playerId) markCircle(mask, state.map, u.x, u.y, unitSight(u, ruleset));
  }
  for (const id of Object.keys(state.cities)) {
    const c = state.cities[id];
    if (c.owner === playerId) markCircle(mask, state.map, c.x, c.y, 2);
  }
  return mask;
}

// naval-truth (Bundle 2): is `sub` (a stealth unit) within range 1 of a SEA or AIR unit
// owned by viewerId? Land units never spot a submarine; a ship/plane spots it only when
// adjacent. Wrap-aware chebyshev.
function spottedByShipOrAir(state, viewerId, sub, ruleset) {
  const { width, wrapX } = state.map;
  for (const id of Object.keys(state.units)) {
    const v = state.units[id];
    if (v.owner !== viewerId) continue;
    const dom = ruleset.units[v.type].domain;
    if (dom !== 'sea' && dom !== 'air') continue;
    let dx = v.x - sub.x; if (dx < 0) dx = -dx;
    if (wrapX && dx > width - dx) dx = width - dx;
    let dy = v.y - sub.y; if (dy < 0) dy = -dy;
    if (dx <= 1 && dy <= 1) return true;
  }
  return false;
}

function filterView(state, playerId, ruleset) {
  const me = state.players[playerId];
  const omniscient = !me || !me.explored;
  const visible = computeVisible(state, playerId, ruleset);
  const { width, height, wrapX } = state.map;

  const tiles = [];
  for (let i = 0; i < width * height; i++) {
    const explored = omniscient || me.explored[i] === 1;
    if (!explored) {
      tiles.push({ t: 'unknown' });
      continue;
    }
    const src = state.map.tiles[i];
    const tile = { t: src.t, visible: omniscient || visible[i] === 1 };
    if (src.river) tile.river = true;
    if (src.special) tile.special = true;
    if (src.irrigation) tile.irrigation = true;
    if (src.mine) tile.mine = true;
    if (src.road) tile.road = true;
    if (src.railroad) tile.railroad = true;
    if (src.fortress) tile.fortress = true;
    tiles.push(tile);
  }

  const units = {};
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (!(omniscient || visible[u.y * width + u.x] === 1)) continue;
    // naval-truth: a rival submarine (stealth) is hidden unless a viewer ship/plane is adjacent
    if (!omniscient && u.owner !== playerId && ruleset !== undefined
        && ruleset.units[u.type].stealth === true && !spottedByShipOrAir(state, playerId, u, ruleset)) {
      continue;
    }
    units[id] = u;
  }

  // Own cities come through whole; a rival city on explored ground is only
  // its outside: name, owner, size, and visible structures (walls). Its
  // production, food box, workers, and mood are NOT in the view.
  const cities = {};
  for (const id of Object.keys(state.cities)) {
    const c = state.cities[id];
    if (!omniscient && me.explored[c.y * width + c.x] !== 1) continue;
    if (omniscient || c.owner === playerId) {
      cities[id] = c;
    } else {
      const shell = { id: c.id, name: c.name, owner: c.owner, x: c.x, y: c.y, pop: c.pop, buildings: [] };
      if (c.buildings !== undefined && c.buildings.indexOf('city-walls') !== -1) {
        shell.buildings.push('city-walls');
      }
      cities[id] = shell;
    }
  }

  const players = {};
  const playerIds = Object.keys(state.players);
  playerIds.sort(); // include non-turn players (barbarians); sorted for determinism
  for (const pid of playerIds) {
    const p = state.players[pid];
    players[pid] = { id: p.id, name: p.name, color: p.color, human: p.human };
    // stance-mix v1: a civ's AI stance is public (the R21 Statistics panel shows
    // who the builders are) — passed through for ALL players, not just the owner.
    // Views are never hashed, so this is golden-neutral.
    if (p.stance !== undefined) players[pid].stance = p.stance;
    if (pid === playerId) {
      // everything the owner's own UI needs (and nothing about anyone else)
      players[pid].gold = p.gold;
      players[pid].techs = p.techs;
      players[pid].researching = p.researching;
      if (p.bulbs !== undefined) players[pid].bulbs = p.bulbs;
      if (p.taxRate !== undefined) players[pid].taxRate = p.taxRate;
      if (p.sciRate !== undefined) players[pid].sciRate = p.sciRate;
      if (p.luxRate !== undefined) players[pid].luxRate = p.luxRate;
      if (p.government !== undefined) players[pid].government = p.government;
      if (p.revolutionTurns !== undefined) players[pid].revolutionTurns = p.revolutionTurns;
      if (p.pendingGovernment !== undefined) players[pid].pendingGovernment = p.pendingGovernment;
    }
  }

  // the viewer's own fog knowledge travels with the view (it IS their
  // knowledge); rival explored arrays never do
  if (me && me.explored !== undefined) {
    players[playerId].explored = me.explored;
  }

  // founding order of the cities this player can see — the FULL cityOrder
  // would leak how many hidden cities exist
  const cityOrder = [];
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    if (cities[cid] !== undefined) cityOrder.push(cid);
  }

  return {
    you: playerId,
    turn: state.turn,
    year: state.year,
    activePlayer: state.activePlayer,
    playerOrder: state.playerOrder,
    map: { width, height, wrapX, tiles },
    units,
    cities,
    cityOrder,
    // wonders are world news (Civ 1 announces completions to everyone);
    // an unseen home city stays a dangling id — every reader guards it
    wonders: state.wonders === undefined ? {} : state.wonders,
    players,
    // D3: diplomacy relations are global/non-secret in Civ 1 (you can always
    // check who is at war with whom) — passed whole; embassy-gated fog is D6's.
    relations: state.relations === undefined ? {} : state.relations
  };
}

// Fog policy for round EVENTS (B5, shape @9edac2e9): which of a round's
// events may this player hear about? Pure; the server calls it per seat
// before pushing events to clients, and the Luau server will need it
// verbatim. Classes (pinned by the architect):
//   world news        wonderBuilt/wonderLost/gameOver/playerDefeated —
//                     Civ 1 announces these to everyone
//   own science       techDiscovered reaches only its own player
//   everything else   visible iff any of its coordinates (its own x/y
//                     fields, or those of the unit/city it names) fall in
//                     the viewer's visible mask, OR the viewer is a named
//                     party (owner / playerId / attacker / defender /
//                     capture sides) — your unit fighting outside your
//                     sight is still YOUR news
// A viewer without an explored array (spectators, test states) is
// omniscient and hears everything, matching filterView's convention.
// D3: war/peace/treaty-break are Civ 1-authentic PUBLIC broadcasts (everyone
// hears "X declares war on Y"); FIRST_CONTACT is NOT here — a third party
// learning two strangers met is fog-dishonest, so it is party-scoped below.
const WORLD_NEWS = {
  wonderBuilt: true, wonderLost: true, gameOver: true, playerDefeated: true,
  WAR_DECLARED: true, TREATY_BROKEN: true, PEACE_TREATY_SIGNED: true
};

// the viewer's civ id, resolved exactly as diplomacy.js eventCiv() builds the
// event's civ fields (civ -> name -> pid) so FIRST_CONTACT party-matching lines up
function playerCiv(state, pid) {
  const p = state.players[pid];
  if (p === undefined) return pid;
  if (p.civ !== undefined) return p.civ;
  if (p.name !== undefined) return p.name;
  return pid;
}

function eventParties(e) {
  const out = [];
  if (e.playerId !== undefined) out.push(e.playerId);
  if (e.owner !== undefined) out.push(e.owner);
  if (e.attackerOwner !== undefined) out.push(e.attackerOwner);
  if (e.defenderOwner !== undefined) out.push(e.defenderOwner);
  if (e.type === 'cityCaptured') { out.push(e.from); out.push(e.to); }
  return out;
}

// every map coordinate an event speaks about, including the current spot of
// a unit/city it references (dead units are fine — the x/y fields remain)
function eventCoords(state, e) {
  const out = [];
  if (e.x !== undefined && e.y !== undefined) out.push([e.x, e.y]);
  if (e.fromX !== undefined) out.push([e.fromX, e.fromY]);
  if (e.toX !== undefined) out.push([e.toX, e.toY]);
  if (e.unitId !== undefined && state.units[e.unitId] !== undefined) {
    out.push([state.units[e.unitId].x, state.units[e.unitId].y]);
  }
  if (e.cityId !== undefined && state.cities[e.cityId] !== undefined) {
    out.push([state.cities[e.cityId].x, state.cities[e.cityId].y]);
  }
  return out;
}

function filterEvents(state, events, playerId, ruleset) {
  const me = state.players[playerId];
  if (!me || !me.explored) return events.slice(); // omniscient: spectators, tests
  const visible = computeVisible(state, playerId, ruleset);
  const width = state.map.width;
  const out = [];
  for (const e of events) {
    if (WORLD_NEWS[e.type] === true) { out.push(e); continue; }
    if (e.type === 'techDiscovered') {
      if (e.playerId === playerId) out.push(e);
      continue;
    }
    if (e.type === 'FIRST_CONTACT') {
      // party-only: only the two civs that just met hear it (fog-honest)
      const myCiv = playerCiv(state, playerId);
      if (myCiv === e.aCivId || myCiv === e.bCivId) out.push(e);
      continue;
    }
    let keep = false;
    for (const pid of eventParties(e)) {
      if (pid === playerId) { keep = true; break; }
    }
    if (!keep) {
      for (const c of eventCoords(state, e)) {
        if (visible[c[1] * width + c[0]] === 1) { keep = true; break; }
      }
    }
    if (keep) out.push(e);
  }
  return out;
}

export { initExplored, reveal, computeVisible, filterView, filterEvents, unitSight };
