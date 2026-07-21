// NAVAL-TRUTH (Bundle 2): the trireme open-sea gamble (Civ1 — a trireme "may be lost at
// sea if not adjacent to land at the end of a turn"). At turn-wrap, each unit flagged
// openSeaLoss that is NOT adjacent to a land tile rolls rollRange(state.rng, 100) <
// rules.trireme.lossChancePct -> lost (its cargo drowns, the A69 pattern). RNG-WHEN-
// ELIGIBLE: the roll happens ONLY for an at-risk unit, in the fixed sortIds order — a
// coast-hugging fleet draws ZERO rng and hashes identically to today. Applies to ALL
// owners incl AI (the Civ2 human-only rule is a drift trap, excluded). Lua-portable subset.
import { rollRange } from './rng.js';
import { sortIds } from './combat.js';

const ADJ8 = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];

// is (x, y) adjacent to a LAND tile (a safe harbour)?
function adjacentToLand(state, x, y, ruleset) {
  const W = state.map.width, H = state.map.height;
  for (const o of ADJ8) {
    let nx = x + o.dx;
    if (nx < 0 || nx >= W) {
      if (state.map.wrapX !== true) continue;
      nx = ((nx % W) + W) % W;
    }
    const ny = y + o.dy;
    if (ny < 0 || ny >= H) continue;
    if (ruleset.terrain.terrains[state.map.tiles[ny * W + nx].t].domain === 'land') return true;
  }
  return false;
}

// once per game turn (turn-wrap): the open-sea trireme gamble.
function process(state, ruleset, events) {
  const t = ruleset.rules.trireme;
  if (t === undefined) return;
  for (const id of sortIds(Object.keys(state.units))) {
    const u = state.units[id];
    if (u === undefined) continue; // may have drowned as cargo of an earlier loss
    if (ruleset.units[u.type].openSeaLoss !== true) continue;
    if (adjacentToLand(state, u.x, u.y, ruleset)) continue; // coast-hugging is safe
    const roll = rollRange(state.rngState, 100);
    state.rngState = roll.rngState;
    if (roll.value < t.lossChancePct) {
      // lost at sea: drown any cargo aboard (deterministic id order), then the ship
      for (const cid of sortIds(Object.keys(state.units))) {
        const c = state.units[cid];
        if (c !== undefined && c.aboard === u.id) {
          delete state.units[cid];
          events.push({ type: 'cargoLost', unitId: cid, owner: c.owner, shipId: u.id, x: u.x, y: u.y });
        }
      }
      delete state.units[id];
      events.push({ type: 'triremeLost', unitId: u.id, owner: u.owner, x: u.x, y: u.y });
    }
  }
}

export { process };
