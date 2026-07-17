// Civ 1 one-shot combat: no hit points — one seeded roll, the loser dies.
//   attackStrength  = A × veteran(×1.5)
//   defenseStrength = D × terrain × river × fortified(×1.5)
//   p(attacker wins) = att / (att + def)
// All strengths are integer PRODUCTS (percent scale ×100 per factor) so the
// probability roll needs no division: roll in [0, att+def), win if < att.
// City Walls (×3) and Fortress (×2) arrive with the buildings slice.
// Civ 1 stack rule: defender loses on open ground => the whole stack dies;
// inside a city only the defender dies.
import { rollRange } from './rng.js';
import { reveal } from './visibility.js';
import { hasBuilding, wonderActive } from './cities.js';
import { capitalOf } from './government.js';

// Deterministic id ordering that ports to Lua (no reliance on key order):
// shorter first, then lexicographic — so u2 < u10.
function sortIds(ids) {
  const out = ids.slice();
  out.sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

function unitsAt(state, x, y) {
  const out = [];
  for (const id of sortIds(Object.keys(state.units))) {
    const u = state.units[id];
    // A69: cargo aboard a ship is hidden — the ship defends the tile, and a
    // sunk ship drowns its cargo (resolveAttack). It occupies no tile of its own.
    if (u.aboard !== undefined) continue;
    if (u.x === x && u.y === y) out.push(u);
  }
  return out;
}

function cityAt(state, x, y) {
  for (const id of state.cityOrder || []) {
    const c = state.cities[id];
    if (c && c.x === x && c.y === y) return c;
  }
  return null;
}

function tileDefensePct(state, x, y, ruleset) {
  const tile = state.map.tiles[y * state.map.width + x];
  const terrain = ruleset.terrain.terrains[tile.t];
  let pct = 100 + terrain.defenseBonus;
  if (tile.river) pct += ruleset.terrain.riverModifier.defenseBonus;
  return pct;
}

function attackStrength(unit, ruleset) {
  return ruleset.units[unit.type].attack * (unit.veteran ? 150 : 100) * 100;
}

// City Walls (or an active Great Wall) triple the defense of units in the city.
function cityWallsAt(state, x, y, ruleset) {
  const city = cityAt(state, x, y);
  if (!city) return false;
  if (hasBuilding(city, 'city-walls')) return true;
  if (ruleset.wonders !== undefined && wonderActive(state, 'great-wall', ruleset)) {
    const wonderHome = state.cities[state.wonders['great-wall']];
    if (wonderHome && wonderHome.owner === city.owner) return true;
  }
  return false;
}

// A fortress doubles defense (city walls take precedence, they don't stack).
function fortressAt(state, x, y) {
  return state.map.tiles[y * state.map.width + x].fortress === true
    && cityAt(state, x, y) === null;
}

function defenseStrength(state, unit, ruleset) {
  return ruleset.units[unit.type].defense
    * tileDefensePct(state, unit.x, unit.y, ruleset)
    * (unit.fortified ? 150 : 100)
    * (cityWallsAt(state, unit.x, unit.y, ruleset) ? 3
      : fortressAt(state, unit.x, unit.y) ? 2 : 1);
}

// Civ 1: the strongest defender on the tile fights.
function bestDefender(state, x, y, ruleset) {
  let best = null, bestScore = -1;
  for (const u of unitsAt(state, x, y)) {
    const score = defenseStrength(state, u, ruleset);
    if (score > bestScore) { best = u; bestScore = score; }
  }
  return best;
}

function maybePromote(state, unit, events) {
  if (unit.veteran) return;
  const roll = rollRange(state.rngState, 2);
  state.rngState = roll.rngState;
  if (roll.value === 0) {
    unit.veteran = true;
    events.push({ type: 'promoted', unitId: unit.id });
  }
}

// Attacker on (attacker.x/y) strikes the defended tile (tx, ty). Mutates state.
function resolveAttack(state, attacker, tx, ty, ruleset) {
  const atype = ruleset.units[attacker.type];
  if (atype.attack <= 0) return { ok: false, reason: 'cannotAttack' };
  if (attacker.moves <= 0) return { ok: false, reason: 'noMovesLeft' };

  const tileDomain = ruleset.terrain.terrains[state.map.tiles[ty * state.map.width + tx].t].domain;
  // A72: air units strike targets on any tile; sea units bombard coastal land.
  const canReach = atype.domain === 'air' || tileDomain === atype.domain
    || (atype.domain === 'sea' && tileDomain === 'land');
  if (!canReach) return { ok: false, reason: 'cannotAttackThere' }; // e.g. land unit vs ships at sea

  const defender = bestDefender(state, tx, ty, ruleset);
  if (!defender) return { ok: false, reason: 'nothingToAttack' };

  const att = attackStrength(attacker, ruleset);
  const def = defenseStrength(state, defender, ruleset);
  // rules.combatRounds 1 = authentic Civ 1 one-shot (exactly one roll —
  // byte-identical to the original algorithm); 3 = best-of-three, a setup
  // option that softens upsets (80% odds become ~90%) without removing them
  const rounds = ruleset.rules.combatRounds === undefined ? 1 : ruleset.rules.combatRounds;
  const need = Math.floor(rounds / 2) + 1;
  let attWins = 0, defWins = 0;
  while (attWins < need && defWins < need) {
    const roll = rollRange(state.rngState, att + def);
    state.rngState = roll.rngState;
    if (roll.value < att) attWins = attWins + 1;
    else defWins = defWins + 1;
  }
  const attackerWins = attWins === need;

  attacker.moves = attacker.moves - 1;
  attacker.fortified = false;

  const events = [];
  if (attackerWins) {
    // stacks die on open ground; cities AND fortresses lose one unit at a time
    const sheltered = cityAt(state, tx, ty) !== null || fortressAt(state, tx, ty);
    const casualties = sheltered ? [defender] : unitsAt(state, tx, ty);
    for (const u of casualties) {
      delete state.units[u.id];
      // A69: a sunk ship drowns its cargo (deterministic id order)
      for (const cid of sortIds(Object.keys(state.units))) {
        const c = state.units[cid];
        if (c && c.aboard === u.id) {
          delete state.units[cid];
          events.push({ type: 'cargoLost', unitId: cid, owner: c.owner, shipId: u.id, x: u.x, y: u.y });
        }
      }
    }
    events.push({
      type: 'combatResolved', winner: 'attacker',
      attackerId: attacker.id, attackerType: attacker.type, attackerOwner: attacker.owner,
      defenderId: defender.id, defenderType: defender.type, defenderOwner: defender.owner,
      x: tx, y: ty, unitsLost: casualties.length
    });
    // A72: a one-shot attacker (the nuclear missile) is consumed by its strike
    // and does not promote; a normal attacker rolls for veteran promotion.
    if (atype.oneShot) {
      delete state.units[attacker.id];
      events.push({ type: 'unitConsumed', unitId: attacker.id, owner: attacker.owner, x: attacker.x, y: attacker.y });
    } else {
      maybePromote(state, attacker, events);
    }
  } else {
    delete state.units[attacker.id];
    events.push({
      type: 'combatResolved', winner: 'defender',
      attackerId: attacker.id, attackerType: attacker.type, attackerOwner: attacker.owner,
      defenderId: defender.id, defenderType: defender.type, defenderOwner: defender.owner,
      x: tx, y: ty, unitsLost: 1
    });
    maybePromote(state, defender, events);
  }
  return { ok: true, events };
}

// A unit entering an undefended enemy city: ownership flips, population drops,
// a share of the loser's treasury is plundered.
function captureCity(state, unit, city, events, ruleset) {
  const loserId = city.owner;
  // A76: was this the loser's capital? (checked BEFORE reassigning owner — a
  // captured capital destroys that civ's spaceship; a new one may be rebuilt)
  const loserCapital = ruleset === undefined ? null : capitalOf(state, loserId, ruleset);
  city.owner = unit.owner;
  if (city.pop > 1) city.pop = city.pop - 1;
  // the new ruler reshuffles the citizenry: manual assignments and
  // specialists don't survive capture (they could exceed the reduced pop)
  delete city.workers;
  delete city.taxmen;
  delete city.scientists;
  city.producing = { kind: 'unit', id: 'militia' };
  city.shields = 0;

  let plunder = city.pop * 10;
  const loser = state.players[loserId];
  if (loser) {
    if (plunder > loser.gold) plunder = loser.gold;
    loser.gold = loser.gold - plunder;
  } else {
    plunder = 0;
  }
  const winner = state.players[unit.owner];
  if (winner) winner.gold = winner.gold + plunder;

  reveal(state, unit.owner, city.x, city.y, 2);
  events.push({ type: 'cityCaptured', cityId: city.id, from: loserId, to: unit.owner, plunder });

  // A76: capital lost — the spaceship in flight or under construction is destroyed
  if (loserCapital !== null && loserCapital.id === city.id) {
    const loserP = state.players[loserId];
    if (loserP && loserP.spaceship !== undefined) {
      delete loserP.spaceship;
      events.push({ type: 'shipDestroyed', playerId: loserId });
    }
  }
}

export {
  resolveAttack, captureCity, bestDefender, unitsAt, cityAt,
  attackStrength, defenseStrength, tileDefensePct, sortIds
};
