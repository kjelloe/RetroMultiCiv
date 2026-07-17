// A76 space race (docs/01 §12, specs/a76-space-race.md): the spaceship
// subsystem. State: player.spaceship is OMIT-SAFE — absent until the civ builds
// its first part (old hashes stay stable). Shape (integer counters only):
//   { structural, propulsion, fuel, habitation, lifeSupport, solar,
//     launched (0 or launch turn), arrivalTurn }
// The Apollo Program gate is DERIVED (wonderActive, the Oracle pattern) — no
// stored boolean, no disagreement risk (reviewer #1262). Everything here is
// Civ1-authentic EXCEPT the flight-time model, which is ORIGINAL (wiki-informed)
// and whose constants (rules.ssFlight) the sim-runner sweeps before the golden
// freeze. Lua-portable subset: no class/this, integer math via idiv, plain scans.
import { wonderActive } from './cities.js';
import { capitalOf } from './government.js';

function idiv(a, b) { return Math.floor(a / b); }
function minInt(a, b) { return a < b ? a : b; }
function maxInt(a, b) { return a > b ? a : b; }

// The six part ids, in the fixed canonical order the structural-sufficiency cap
// fills (see functionalCounts). PART_KINDS[k] gives the rules.ssParts entry.
const SS_PART_IDS = ['structural', 'propulsion', 'fuel', 'habitation', 'lifeSupport', 'solar'];
const SS_NONSTRUCT = ['propulsion', 'fuel', 'habitation', 'lifeSupport', 'solar'];

function partCount(spaceship, key) {
  if (!spaceship || spaceship[key] === undefined) return 0;
  return spaceship[key];
}

// Is Apollo Program built by any civ? Opens spaceship construction for ALL civs
// holding the part techs (the wiki gate). Derived, never stored.
function apolloActive(state, ruleset) {
  const f = ruleset.rules.ssFlight;
  if (f === undefined) return false;
  return wonderActive(state, f.gateWonder, ruleset);
}

// Structural sufficiency (spec §3, reviewer-verified FAITHFUL): non-structural
// parts FUNCTION only up to `supported` = idiv(structural * 28, 39) slots; the
// 28 non-structural maxima (8+8+4+4+4) are fully supported at the full 39
// structure (integer-exact at both endpoints). Excess parts add mass but not
// function. The functional counts fill a FIXED canonical order (propulsion,
// fuel, habitation, lifeSupport, solar) — deterministic; the priority is a
// design choice flagged to the architect (nothing else specifies it).
function functionalCounts(spaceship, ruleset) {
  const f = ruleset.rules.ssFlight;
  const structural = partCount(spaceship, 'structural');
  let supported = idiv(structural * f.structuralSlotsNum, f.structuralSlotsDen);
  const fn = { propulsion: 0, fuel: 0, habitation: 0, lifeSupport: 0, solar: 0 };
  for (const k of SS_NONSTRUCT) {
    const have = partCount(spaceship, k);
    const take = have < supported ? have : supported;
    fn[k] = take;
    supported = supported - take;
    if (supported < 0) supported = 0;
  }
  return fn;
}

// A minimum-viable ship (spec): >=1 functional propulsion + fuel + one of each
// module type (habitation, lifeSupport, solar), which requires enough structure
// to support all five (structural sufficiency folded in via functionalCounts).
function isViable(spaceship, ruleset) {
  if (!spaceship) return false;
  const fn = functionalCounts(spaceship, ruleset);
  return fn.propulsion >= 1 && fn.fuel >= 1 && fn.habitation >= 1
    && fn.lifeSupport >= 1 && fn.solar >= 1;
}

// Derived ship characteristics (pure, both engines byte-shaped). Integer math.
// mass counts ALL parts (excess included); the functional stats use the
// structurally-supported counts.
function shipStats(spaceship, ruleset) {
  const f = ruleset.rules.ssFlight;
  const s = spaceship;
  const structural = partCount(s, 'structural');
  const propulsion = partCount(s, 'propulsion');
  const fuel = partCount(s, 'fuel');
  const habitation = partCount(s, 'habitation');
  const lifeSupport = partCount(s, 'lifeSupport');
  const solar = partCount(s, 'solar');
  const fn = functionalCounts(s, ruleset);

  const population = fn.habitation * f.colonistsPerHab;
  let supportPct = idiv(fn.lifeSupport * 100, maxInt(1, fn.habitation));
  if (supportPct > 100) supportPct = 100;
  let energyPct = idiv(fn.solar * 2 * 100, maxInt(1, fn.habitation + fn.lifeSupport));
  if (energyPct > 100) energyPct = 100;

  const P = ruleset.rules.ssParts;
  const mass = structural * P.structural.mass + propulsion * P.propulsion.mass
    + fuel * P.fuel.mass + habitation * P.habitation.mass
    + lifeSupport * P.lifeSupport.mass + solar * P.solar.mass;
  const poweredEngines = minInt(fn.propulsion, fn.fuel);
  const fuelPct = fn.propulsion === 0 ? 0 : idiv(minInt(fn.fuel, fn.propulsion) * 100, fn.propulsion);

  let flightYears = idiv(mass * 10, maxInt(1, poweredEngines * f.flightMassPerEngine));
  if (flightYears < f.flightYearsMin) flightYears = f.flightYearsMin;

  let successPct = 0;
  if (isViable(s, ruleset)) {
    let raw = idiv(supportPct + energyPct, 2)
      - idiv(maxInt(0, flightYears - f.successFlightFreeYears), 2);
    if (raw < 5) raw = 5;
    if (raw > 100) raw = 100;
    successPct = raw;
  }
  return { population, supportPct, energyPct, mass, fuelPct, flightYears, successPct };
}

// The current era's year step (mirrors index.nextYear's step selection; inlined
// to keep the require graph acyclic — index imports THIS module for dispatch).
function yearsPerTurn(year, rules) {
  const steps = rules.yearSteps;
  if (steps === undefined || steps.length === 0) return 20;
  for (const b of steps) {
    if (year < b.until) return b.step;
  }
  return steps[steps.length - 1].step;
}

// Launch the ship: irreversible. Requires a viable, not-yet-launched ship owned
// by the active player. arrivalTurn = launch turn + the flight duration in game
// turns (flightYears / years-per-turn at the current era, >= 1 turn).
function launchShip(state, cmd, ruleset) {
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  const ship = player.spaceship;
  if (!ship) return { ok: false, reason: 'noShip' };
  if (ship.launched !== undefined && ship.launched !== 0) return { ok: false, reason: 'alreadyLaunched' };
  if (!apolloActive(state, ruleset)) return { ok: false, reason: 'noApollo' };
  if (!isViable(ship, ruleset)) return { ok: false, reason: 'shipNotViable' };
  const stats = shipStats(ship, ruleset);
  const perTurn = yearsPerTurn(state.year, ruleset.rules);
  const turns = maxInt(1, idiv(stats.flightYears, perTurn));
  ship.launched = state.turn;
  ship.arrivalTurn = state.turn + turns;
  return { ok: true, events: [{
    type: 'shipLaunched', playerId: cmd.playerId,
    arrivalTurn: ship.arrivalTurn, flightYears: stats.flightYears
  }] };
}

// Turn-wrap arrival check (called from endTurn before checkGameEnd). The FIRST
// launched ship to reach its arrival turn, with the owner still alive, wins the
// space victory (only the first planetfall scores). A captured capital already
// deleted the ship (combat.captureCity) before this runs, so a launched ship
// here means the capital was held. Emits gameOver{victory:'space'} + spaceVictory.
function processSpace(state, ruleset, events) {
  if (state.gameOver === true) return;
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (!player || player.alive === false) continue;
    const ship = player.spaceship;
    if (!ship || ship.launched === undefined || ship.launched === 0) continue;
    if (ship.arrivalTurn === undefined || state.turn < ship.arrivalTurn) continue;
    const capital = capitalOf(state, pid, ruleset);
    if (!capital) continue; // no city at all — cannot land colonists
    const stats = shipStats(ship, ruleset);
    const bonus = idiv(stats.population, ruleset.rules.ssFlight.arrivalScoreDivisor) * stats.successPct;
    state.gameOver = true;
    state.winner = pid;
    events.push({ type: 'spaceVictory', playerId: pid,
      population: stats.population, successPct: stats.successPct, bonus });
    events.push({ type: 'gameOver', winner: pid, victory: 'space' });
    return;
  }
}

export {
  shipStats, isViable, apolloActive, launchShip, processSpace,
  functionalCounts, SS_PART_IDS, SS_NONSTRUCT
};
