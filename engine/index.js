// Engine entry point: a pure, deterministic reducer over plain game state.
//   const engine = createEngine(ruleset);
//   const { ok, state, events, reason } = engine.applyCommand(state, command);
// The input state is never mutated; on failure the original state is returned.
// Everything here follows the Lua-portable subset (docs/02-architecture.md §4).

import * as movement from './movement.js';
import * as cities from './cities.js';
import * as tech from './tech.js';
import * as barbarians from './barbarians.js';
import { createGame as generateGame } from './mapgen.js';

function deepClone(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(deepClone(v));
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = deepClone(value[k]);
    return out;
  }
  return value;
}

// End the active player's turn. When the last player in playerOrder ends,
// the game turn advances and every unit's movement refreshes.
function endTurn(state, cmd, ruleset) {
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const order = state.playerOrder;
  if (!order || order.length === 0) return { ok: false, reason: 'noPlayerOrder' };

  const idx = order.indexOf(cmd.playerId);
  const events = [{ type: 'turnEnded', playerId: cmd.playerId }];

  if (idx === order.length - 1) {
    state.turn = state.turn + 1;
    state.year = state.year + 20; // placeholder step; era-based steps come with data/rules.json
    state.activePlayer = order[0];
    cities.processCities(state, ruleset, events);
    tech.processResearch(state, ruleset, events);
    barbarians.process(state, ruleset, events);
    for (const id of Object.keys(state.units)) {
      const unit = state.units[id];
      unit.moves = ruleset.units[unit.type].moves;
    }
    events.push({ type: 'turnStarted', turn: state.turn, activePlayer: state.activePlayer });
  } else {
    state.activePlayer = order[idx + 1];
    events.push({ type: 'turnStarted', turn: state.turn, activePlayer: state.activePlayer });
  }
  return { ok: true, events };
}

function createEngine(ruleset) {
  function applyCommand(state, cmd) {
    const next = deepClone(state);
    let result;
    if (cmd.type === 'moveUnit') result = movement.moveUnit(next, cmd, ruleset);
    else if (cmd.type === 'endTurn') result = endTurn(next, cmd, ruleset);
    else if (cmd.type === 'foundCity') result = cities.foundCity(next, cmd, ruleset);
    else if (cmd.type === 'setProduction') result = cities.setProduction(next, cmd, ruleset);
    else if (cmd.type === 'setResearch') result = tech.setResearch(next, cmd, ruleset);
    else if (cmd.type === 'setRates') result = tech.setRates(next, cmd, ruleset);
    else result = { ok: false, reason: 'unknownCommand' };

    if (!result.ok) return { ok: false, reason: result.reason, state, events: [] };
    return { ok: true, state: next, events: result.events };
  }

  function createGame(setup) {
    return generateGame(setup, ruleset);
  }

  return { applyCommand, createGame };
}

export { createEngine, deepClone };
