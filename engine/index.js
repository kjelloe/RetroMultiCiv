// Engine entry point: a pure, deterministic reducer over plain game state.
//   const engine = createEngine(ruleset);
//   const { ok, state, events, reason } = engine.applyCommand(state, command);
// The input state is never mutated; on failure the original state is returned.
// Everything here follows the Lua-portable subset (docs/02-architecture.md §4).

import * as movement from './movement.js';
import * as cities from './cities.js';
import * as tech from './tech.js';
import * as barbarians from './barbarians.js';
import * as air from './air.js';
import * as scoring from './score.js';
import * as improvements from './improvements.js';
import * as happiness from './happiness.js';
import * as government from './government.js';
import { createGame as generateGame } from './mapgen.js';

function deepClone(value) {
  if (Array.isArray(value)) {
    // flat arrays of primitives (explored masks, worker lists) copy directly —
    // applyCommand clones the whole state per command, and these arrays are
    // most of it (Luau port: table.clone on the same flatness check)
    let flat = true;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === 'object') { flat = false; break; }
    }
    if (flat) return value.slice();
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

// Civ-1-style variable calendar (data/rules.json `yearSteps`): the FIRST
// bracket with year < until supplies the step; past the last bracket its step
// keeps applying (runaway guard). Rulesets without the table keep the old
// flat +20 (crafted test states stay stable). Pure integer math, plain scan.
function nextYear(year, rules) {
  const steps = rules.yearSteps;
  if (steps === undefined || steps.length === 0) return year + 20;
  for (const b of steps) {
    if (year < b.until) return year + b.step;
  }
  return year + steps[steps.length - 1].step;
}

// A75: the world's CURRENT AGE is DERIVED (not stored) — the highest TECH ERA
// reached by at least worldAgeThreshold% of ALIVE civs. "Reached era i" = a civ
// knows >= 1 tech whose era index >= i (cumulative-upward: a beeliner counts
// for the highest era it has touched, so the aggregate has no gaps). Ranges
// over the FOUR TECH ERAS ONLY (the Space Age is a starting-scenario option,
// not a tech era) — advances fire at three transitions (→renaissance,
// →industrial, →modern). PURE READ: no state change, so goldens are untouched.
function worldEraOrder(ruleset) {
  const isEra = {};
  for (const id of Object.keys(ruleset.techs)) isEra[ruleset.techs[id].era] = true;
  const order = [];
  const ages = ruleset.rules.ages === undefined ? [] : ruleset.rules.ages;
  for (const age of ages) if (isEra[age.id] === true) order.push(age.id);
  return order;
}

function worldAge(state, ruleset) {
  const order = worldEraOrder(ruleset);
  if (order.length === 0) return '';
  const eraIdx = {};
  for (let i = 0; i < order.length; i++) eraIdx[order[i]] = i;
  let alive = 0;
  for (const pid of state.playerOrder) if (state.players[pid].alive !== false) alive = alive + 1;
  if (alive === 0) return order[0];
  const reachedCount = []; // reachedCount[i] = alive civs that reached era index i or higher
  for (let i = 0; i < order.length; i++) reachedCount.push(0);
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (p.alive === false) continue;
    let best = 0;
    for (const t of p.techs) {
      const def = ruleset.techs[t];
      const idx = def === undefined || eraIdx[def.era] === undefined ? 0 : eraIdx[def.era];
      if (idx > best) best = idx;
    }
    for (let i = 0; i <= best; i++) reachedCount[i] = reachedCount[i] + 1;
  }
  const threshold = ruleset.rules.worldAgeThreshold;
  let hi = 0;
  for (let i = 0; i < order.length; i++) {
    if (reachedCount[i] * 100 >= alive * threshold) hi = i;
  }
  return order[hi];
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
    state.year = nextYear(state.year, ruleset.rules); // Civ-1-style era steps (A21)
    state.activePlayer = order[0];
    const ageBefore = worldAge(state, ruleset); // A75: sample the age across the wrap
    improvements.processWork(state, ruleset, events); // before harvest: a finished improvement counts this turn
    government.processRevolutions(state, ruleset, events);
    happiness.updateDisorder(state, ruleset, events); // one disorder verdict per city for the whole turn
    cities.processCities(state, ruleset, events);
    tech.processResearch(state, ruleset, events);
    barbarians.process(state, ruleset, events);
    air.processAir(state, ruleset, events); // A72: fuel/crash for airborne units
    scoring.checkGameEnd(state, ruleset, events);
    // A75: research/deaths this wrap may have advanced the world's age — emit a
    // transient world-news event (not hashed, so goldens are untouched)
    const ageAfter = worldAge(state, ruleset);
    if (ageAfter !== ageBefore) {
      const eo = worldEraOrder(ruleset);
      if (eo.indexOf(ageAfter) > eo.indexOf(ageBefore)) {
        events.push({ type: 'ageChanged', age: ageAfter, turn: state.turn });
      }
    }
    for (const id of Object.keys(state.units)) {
      const unit = state.units[id];
      unit.moves = ruleset.units[unit.type].moves;
      delete unit.roadSteps; // free road allowance resets with the turn
    }
    // A86: the one-sale-per-turn flag resets with the game turn (omit-safe)
    for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.soldThisTurn !== undefined) delete c.soldThisTurn;
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
    if (state.gameOver === true) return { ok: false, reason: 'gameOver', state, events: [] };
    const next = deepClone(state);
    let result;
    if (cmd.type === 'moveUnit') result = movement.moveUnit(next, cmd, ruleset);
    else if (cmd.type === 'fortify') result = movement.fortify(next, cmd, ruleset);
    else if (cmd.type === 'wait') result = movement.wait(next, cmd, ruleset);
    else if (cmd.type === 'endTurn') result = endTurn(next, cmd, ruleset);
    else if (cmd.type === 'foundCity') result = cities.foundCity(next, cmd, ruleset);
    else if (cmd.type === 'setProduction') result = cities.setProduction(next, cmd, ruleset);
    else if (cmd.type === 'setWorkers') result = cities.setWorkers(next, cmd, ruleset);
    else if (cmd.type === 'startWork') result = improvements.startWork(next, cmd, ruleset);
    else if (cmd.type === 'pillage') result = improvements.pillage(next, cmd, ruleset);
    else if (cmd.type === 'disband') result = movement.disband(next, cmd, ruleset);
    else if (cmd.type === 'buy') result = cities.buyProduction(next, cmd, ruleset);
    else if (cmd.type === 'helpWonder') result = cities.helpWonder(next, cmd, ruleset);
    else if (cmd.type === 'sellBuilding') result = cities.sellBuilding(next, cmd, ruleset);
    else if (cmd.type === 'setGovernment') result = government.setGovernment(next, cmd, ruleset);
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

export { createEngine, deepClone, nextYear, worldAge };
