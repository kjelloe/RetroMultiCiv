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
import { bumpRel } from './diplomacy.js';
import { difficultyOf } from './difficulty.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

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

// A91c: a nuclear detonation fouls the target tile AND its 8 neighbors — every LAND
// tile in the ring gains pollution (deterministic, NO roll; the same tile.polluted
// flag as A91 smokestack pollution). Ocean is untouched; already-fouled tiles are skipped.
const NUKE_RING = [
  { dx: 0, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];
function foulRing(state, cx, cy, ruleset, events) {
  const W = state.map.width, H = state.map.height;
  for (const o of NUKE_RING) {
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
    tile.polluted = true;
    events.push({ type: 'nukeFallout', x, y });
  }
}

function defenseStrength(state, unit, ruleset, attacker) {
  // air-truth: a bomber (ignoresWalls) skips the City Walls / Great Wall 3x
  // multiplier — but NOT a fortress (a different structure). No attacker passed
  // (defender selection) = walls count as before.
  const ignoresWalls = attacker !== undefined && ruleset.units[attacker.type].ignoresWalls === true;
  const mult = (!ignoresWalls && cityWallsAt(state, unit.x, unit.y, ruleset)) ? 3
    : fortressAt(state, unit.x, unit.y) ? 2 : 1;
  return ruleset.units[unit.type].defense
    * tileDefensePct(state, unit.x, unit.y, ruleset)
    * (unit.fortified ? 150 : 100)
    * mult;
}

// Civ 1: the strongest defender on the tile fights.
function bestDefender(state, x, y, ruleset) {
  const here = unitsAt(state, x, y);
  let best = null, bestScore = -1;
  for (const u of here) {
    // R1 (N13): a barbarian leader hides behind its escort — never the chosen
    // defender while another unit shares its tile (escorts absorb hits first, so
    // the leader survives to be killed alone and pay its ransom).
    if (here.length > 1 && ruleset.units[u.type].barbLeader === true) continue;
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
  // naval-truth: a SUBMARINE (stealth) may NOT attack land tiles — the one guard that
  // mirrors the sea-bombard allowance (a submerged raider has no shore bombardment).
  const canReach = atype.domain === 'air' || tileDomain === atype.domain
    || (atype.domain === 'sea' && tileDomain === 'land' && atype.stealth !== true);
  if (!canReach) return { ok: false, reason: 'cannotAttackThere' }; // e.g. land unit vs ships at sea

  const defender = bestDefender(state, tx, ty, ruleset);
  if (!defender) return { ok: false, reason: 'nothingToAttack' };
  // air-truth: an air-domain unit IN FLIGHT (not standing in a city, not aboard a
  // carrier) may be attacked ONLY by a Fighter (attacksAir). No defensive ground
  // fire in Civ 1 — a non-fighter simply cannot reach it.
  if (ruleset.units[defender.type].domain === 'air' && defender.aboard === undefined
      && cityAt(state, defender.x, defender.y) === null && atype.attacksAir !== true) {
    return { ok: false, reason: 'needsFighter' };
  }
  // D3: the DEFENDER's owner gains grievance toward the ATTACKER (directed). Skip
  // barbarians (never a diplomacy partner). Omit-safe when no diplomacy ruleset.
  if (attacker.owner !== 'barb' && defender.owner !== 'barb' && ruleset.rules.diplomacy !== undefined) {
    bumpRel(state, defender.owner, attacker.owner, 'grievance', ruleset.rules.diplomacy.relGrievanceOnAttack);
  }

  let att = attackStrength(attacker, ruleset);
  // barbAtkPct is a WORLD difficulty knob: a BARBARIAN attacker's strength scales by
  // difficulties[level].barbAtkPct (applies all-AI too). Neutral 100 => identity.
  const dOf = difficultyOf(state, ruleset);
  if (attacker.owner === 'barb' && dOf !== null) att = idiv(att * dOf.barbAtkPct, 100);
  const def = defenseStrength(state, defender, ruleset, attacker);
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
    // A91c: a nuclear strike DETONATES — it annihilates EVERY unit on the target tile
    // (even sheltered in a city/fortress), halves the city, and fouls the ring (below).
    const nuke = atype.nuclearBlast === true;
    // stacks die on open ground; cities AND fortresses lose one unit at a time
    const sheltered = !nuke && (cityAt(state, tx, ty) !== null || fortressAt(state, tx, ty));
    let casualties = sheltered ? [defender] : unitsAt(state, tx, ty);
    // R1 (N13): a barbarian leader survives open-ground annihilation of its escort
    // — it dies only as the SOLE defender. Filter it out while others share the tile.
    // A nuke spares no one, so the leader-shield does not apply to a detonation.
    if (!sheltered && !nuke && casualties.length > 1) {
      casualties = casualties.filter(u => ruleset.units[u.type].barbLeader !== true);
    }
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
      // N13: killing a LONE barbarian leader (it reached casualties = it stood
      // alone) pays the killing civ a gold ransom.
      if (ruleset.units[u.type].barbLeader === true) {
        const killer = state.players[attacker.owner];
        if (killer) killer.gold = killer.gold + ruleset.rules.barb.leaderRansom;
        events.push({ type: 'ransomPaid', playerId: attacker.owner, gold: ruleset.rules.barb.leaderRansom, x: tx, y: ty });
      }
    }
    events.push({
      type: 'combatResolved', winner: 'attacker',
      attackerId: attacker.id, attackerType: attacker.type, attackerOwner: attacker.owner,
      defenderId: defender.id, defenderType: defender.type, defenderOwner: defender.owner,
      x: tx, y: ty, unitsLost: casualties.length
    });
    // A91c: the detonation's area effects — halve the target city's population
    // (never below 1) and foul the ring. Deterministic, no roll.
    if (nuke) {
      const nc = cityAt(state, tx, ty);
      if (nc !== null) {
        nc.pop = Math.floor(nc.pop / 2);
        if (nc.pop < 1) nc.pop = 1;
        events.push({ type: 'cityNuked', cityId: nc.id, x: tx, y: ty });
      }
      foulRing(state, tx, ty, ruleset, events);
    }
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
