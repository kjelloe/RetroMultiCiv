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

function computeVisible(state, playerId) {
  const size = state.map.width * state.map.height;
  const mask = [];
  for (let i = 0; i < size; i++) mask.push(0);
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (u.owner === playerId) markCircle(mask, state.map, u.x, u.y, 1);
  }
  for (const id of Object.keys(state.cities)) {
    const c = state.cities[id];
    if (c.owner === playerId) markCircle(mask, state.map, c.x, c.y, 2);
  }
  return mask;
}

function filterView(state, playerId) {
  const me = state.players[playerId];
  const omniscient = !me || !me.explored;
  const visible = computeVisible(state, playerId);
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
    if (omniscient || visible[u.y * width + u.x] === 1) units[id] = u;
  }

  const cities = {};
  for (const id of Object.keys(state.cities)) {
    const c = state.cities[id];
    if (omniscient || me.explored[c.y * width + c.x] === 1) cities[id] = c;
  }

  const players = {};
  const playerIds = Object.keys(state.players);
  playerIds.sort(); // include non-turn players (barbarians); sorted for determinism
  for (const pid of playerIds) {
    const p = state.players[pid];
    players[pid] = { id: p.id, name: p.name, color: p.color, human: p.human };
    if (pid === playerId) {
      players[pid].gold = p.gold;
      players[pid].techs = p.techs;
      players[pid].researching = p.researching;
    }
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
    players
  };
}

export { initExplored, reveal, computeVisible, filterView };
