// D6 diplomat missions (spec d456 §D6, unit-truth §3): a Diplomat unit performs
// espionage against an ADJACENT (or co-located) rival city/unit — establish an
// embassy, steal a tech, sabotage production, incite a revolt, or bribe a unit.
// GOLDEN-NEUTRAL by construction: the AI never issues these (human/scenario-driven),
// state.embassies is omit-safe (absent = no embassies, the whole soak), and no
// data/*.json changes — so a game with no diplomat mission is byte-identical to pre-D6.
//
// Determinism (#2507): incite + bribe are CERTAIN (deterministic gold buys); steal-
// tech + sabotage ROLL through engine RNG (state.rngState), so replays reproduce.
//
// Cycle safety: this module is imported ONLY by index.js (nothing imports it back),
// so its imports form no cycle — capitalOf/difficultyOf/rollRange are all leaves.

import { rollRange } from './rng.js';
import { capitalOf } from './government.js';
import { difficultyOf } from './difficulty.js';
import { applyReputationHit, bumpRel } from './diplomacy.js';

const BARB_ID = 'barb';
// the diplomat unit id, inlined as a module constant (the 'militia'/'barb' idiom) —
// keeps D6 golden-neutral (no units.json canSpy flag, which would move the stamp).
const DIPLOMAT = 'diplomat';

// ROLL success rates + cost shape — module constants (golden-neutral; sim-sweepable
// later without a rulesetHash move). parleyDemandPct (data/rules.json difficulties,
// already landed) scales the gold missions; crafted scenarios (no difficulty) use 20.
const STEAL_SUCCESS_PCT = 50;
const SABOTAGE_SUCCESS_PCT = 50;
const INCITE_GOLD_PER_POP = 100;
const BRIBE_GOLD_PER_COST = 10;
const DEFAULT_DEMAND_PCT = 20;

function idiv(a, b) {
  return Math.floor(a / b);
}

// Chebyshev distance with X-wrap — a diplomat acts on a tile at range <= 1 (adjacent
// or co-located).
function within1(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  const dy = Math.abs(ay - by);
  const cheb = dx > dy ? dx : dy;
  return cheb <= 1;
}

function demandPct(state, ruleset) {
  const d = difficultyOf(state, ruleset);
  return d !== null && d.parleyDemandPct !== undefined ? d.parleyDemandPct : DEFAULT_DEMAND_PCT;
}

// the rival city a mission targets, validated: it exists, is a rival's (not mine,
// not barbarian), and my diplomat is within reach. Returns the city or null.
function targetCity(state, me, unit, cityId) {
  const city = state.cities === undefined ? undefined : state.cities[cityId];
  if (city === undefined || city.owner === me || city.owner === BARB_ID) return null;
  if (!within1(state.map, unit.x, unit.y, city.x, city.y)) return null;
  return city;
}

// flip a city to `me` (incite/subvert) — the captureCity CORE, inlined to avoid the
// diplomacy->combat->cities->diplomacy require cycle. No plunder (a bought city).
function flipCity(city, me) {
  city.owner = me;
  if (city.pop > 1) city.pop = city.pop - 1;
  delete city.workers;
  delete city.taxmen;
  delete city.scientists;
  city.producing = { kind: 'unit', id: 'militia' };
  city.shields = 0;
}

// W1 discovered-espionage: after a COVERT mission (steal/sabotage) resolves, one more
// roll traces it to the perpetrator. BOTCH-AMPLIFIED — a FAILED job (succeeded=false) is
// likelier traced (discoveryPctOnFail) than a clean one (discoveryPctOnSuccess). On
// discovery: the perp's reputation is soiled (the shared treaty-break machinery), the
// victim's grievance toward the perp rises, and ESPIONAGE_EXPOSED fires. rngState-threaded.
function rollDiscovery(state, perp, victim, missionKind, succeeded, ruleset, events) {
  const d = ruleset.rules.diplomacy;
  const pct = succeeded ? d.discoveryPctOnSuccess : d.discoveryPctOnFail;
  const roll = rollRange(state.rngState, 100);
  state.rngState = roll.rngState;
  if (roll.value >= pct) return; // undetected — a clean getaway
  applyReputationHit(state, perp, ruleset, events);
  bumpRel(state, victim, perp, 'grievance', d.relGrievanceOnBetray);
  events.push({ type: 'ESPIONAGE_EXPOSED', byCivId: perp, atCivId: victim, mission: missionKind, turn: state.turn });
}

function diplomatMissionCommand(state, cmd, ruleset) {
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const me = cmd.playerId;
  const unit = state.units === undefined ? undefined : state.units[cmd.unitId];
  if (unit === undefined) return { ok: false, reason: 'noSuchUnit' };
  if (unit.owner !== me) return { ok: false, reason: 'notYourUnit' };
  if (unit.type !== DIPLOMAT) return { ok: false, reason: 'notADiplomat' };
  if (unit.moves <= 0) return { ok: false, reason: 'noMoves' };
  const events = [];

  if (cmd.mission === 'establishEmbassy') {
    const city = targetCity(state, me, unit, cmd.targetCityId);
    if (city === null) return { ok: false, reason: 'noSuchTarget' };
    const cap = capitalOf(state, city.owner, ruleset);
    if (cap === null || cap.id !== city.id) return { ok: false, reason: 'notACapital' };
    if (state.embassies === undefined) state.embassies = {};
    if (state.embassies[me] === undefined) state.embassies[me] = {};
    state.embassies[me][city.owner] = state.turn;
    delete state.units[cmd.unitId];
    events.push({ type: 'EMBASSY_ESTABLISHED', byCivId: me, atCivId: city.owner, turn: state.turn });
    return { ok: true, events };
  }

  if (cmd.mission === 'investigateCity') {
    const city = targetCity(state, me, unit, cmd.targetCityId);
    if (city === null) return { ok: false, reason: 'noSuchTarget' };
    // a READ-ONLY peek: the rival city is untouched. The one-time snapshot rides the
    // (transient, non-hashed) event; only the diplomat's consumption is state.
    delete state.units[cmd.unitId];
    const prod = city.producing === undefined ? '' : (city.producing.id === undefined ? '' : city.producing.id);
    events.push({ type: 'CITY_INVESTIGATED', byCivId: me, atCivId: city.owner, cityId: city.id, pop: city.pop, shields: city.shields === undefined ? 0 : city.shields, producing: prod, turn: state.turn });
    return { ok: true, events };
  }

  if (cmd.mission === 'stealTech') {
    const city = targetCity(state, me, unit, cmd.targetCityId);
    if (city === null) return { ok: false, reason: 'noSuchTarget' };
    if (city.techStolen === true) return { ok: false, reason: 'alreadyStolen' };
    const owner = state.players[city.owner];
    const mine = state.players[me];
    // eligible = techs the rival holds that I lack (sorted for a deterministic pick)
    const eligible = [];
    const ownerTechs = owner.techs === undefined ? [] : owner.techs;
    const myTechs = mine.techs === undefined ? [] : mine.techs;
    for (const t of ownerTechs) if (myTechs.indexOf(t) === -1) eligible.push(t);
    eligible.sort();
    city.techStolen = true; // once per city, success or fail (the attempt is spent)
    delete state.units[cmd.unitId];
    const roll = rollRange(state.rngState, 100);
    state.rngState = roll.rngState;
    const succeeded = roll.value < STEAL_SUCCESS_PCT && eligible.length > 0;
    if (succeeded) {
      const pick = rollRange(state.rngState, eligible.length);
      state.rngState = pick.rngState;
      const tech = eligible[pick.value];
      mine.techs.push(tech);
      events.push({ type: 'TECH_STOLEN', byCivId: me, fromCivId: city.owner, tech, turn: state.turn });
    } else {
      events.push({ type: 'TECH_STOLEN', byCivId: me, fromCivId: city.owner, tech: '', turn: state.turn });
    }
    // W1: the theft may be traced (after the success + pick rolls, so rngState order holds)
    rollDiscovery(state, me, city.owner, 'stealTech', succeeded, ruleset, events);
    return { ok: true, events };
  }

  if (cmd.mission === 'sabotage') {
    const city = targetCity(state, me, unit, cmd.targetCityId);
    if (city === null) return { ok: false, reason: 'noSuchTarget' };
    delete state.units[cmd.unitId];
    const roll = rollRange(state.rngState, 100);
    state.rngState = roll.rngState;
    const success = roll.value < SABOTAGE_SUCCESS_PCT;
    // destroy-or-zero (#2507): success zeroes the accumulated production (the shields
    // box) — the work-in-progress is destroyed. A failed attempt spends the diplomat.
    if (success && city.shields > 0) city.shields = 0;
    events.push({ type: 'SABOTAGE', byCivId: me, atCivId: city.owner, success, turn: state.turn });
    // W1: the sabotage may be traced to the perpetrator
    rollDiscovery(state, me, city.owner, 'sabotage', success, ruleset, events);
    return { ok: true, events };
  }

  if (cmd.mission === 'inciteRevolt') {
    const city = targetCity(state, me, unit, cmd.targetCityId);
    if (city === null) return { ok: false, reason: 'noSuchTarget' };
    // the capital cannot be incited (Civ1) — you must take it by force
    const cap = capitalOf(state, city.owner, ruleset);
    if (cap !== null && cap.id === city.id) return { ok: false, reason: 'cannotInciteCapital' };
    const cost = inciteCost(state, city, ruleset);
    const mine = state.players[me];
    if (mine.gold < cost) return { ok: false, reason: 'notEnoughGold' };
    const formerOwner = city.owner;
    mine.gold = mine.gold - cost;
    flipCity(city, me);
    delete state.units[cmd.unitId];
    events.push({ type: 'CITY_INCITED', byCivId: me, fromCivId: formerOwner, cityId: city.id, gold: cost, turn: state.turn });
    return { ok: true, events };
  }

  if (cmd.mission === 'bribeUnit') {
    const target = state.units === undefined ? undefined : state.units[cmd.targetUnitId];
    if (target === undefined || target.owner === me || target.owner === BARB_ID) return { ok: false, reason: 'noSuchTarget' };
    if (!within1(state.map, unit.x, unit.y, target.x, target.y)) return { ok: false, reason: 'noSuchTarget' };
    const cost = idiv(ruleset.units[target.type].cost * BRIBE_GOLD_PER_COST * demandPct(state, ruleset), 20);
    const mine = state.players[me];
    if (mine.gold < cost) return { ok: false, reason: 'notEnoughGold' };
    const formerOwner = target.owner;
    mine.gold = mine.gold - cost;
    target.owner = me;
    target.moves = 0; // a freshly bribed unit has spent its turn
    delete state.units[cmd.unitId];
    events.push({ type: 'UNIT_BRIBED', byCivId: me, fromCivId: formerOwner, unitId: target.id, gold: cost, turn: state.turn });
    return { ok: true, events };
  }

  return { ok: false, reason: 'unknownMission' };
}

// D6 embassy intel: has `viewer` an embassy in `civId`? (omit-safe). filterView reads
// this to reveal a rival's government/gold/tech-count/capital beyond plain fog.
// W8a: the AI needs the SAME price the mission charges, so it never issues an
// unaffordable incite (a rejected command wastes the turn). One source of truth —
// the mission calls this too.
function inciteCost(state, city, ruleset) {
  return idiv(city.pop * INCITE_GOLD_PER_POP * demandPct(state, ruleset), 20);
}

function hasEmbassy(state, viewer, civId) {
  return state.embassies !== undefined && state.embassies[viewer] !== undefined
    && state.embassies[viewer][civId] !== undefined;
}

export { diplomatMissionCommand, hasEmbassy, inciteCost };
