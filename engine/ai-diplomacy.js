// D3 AI-diplomacy decision score models (spec d3 §3). PURE integer scores over
// personality (A59) + relationship (D1/D3 trust/grievance) + military/proximity
// situationals. Kept OUT of ai.js (300-line ceiling). NO ai.js import — ai.js
// imports THIS for its diplomacy step, so the reverse edge would cycle; military
// strength + border pressure are small local reads over combat.js primitives.
import { personalityOf } from './leaders.js';
import { grievanceOf, trustOf } from './diplomacy.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

// count of a player's attack-capable units (like ai.js countMilitary; local to
// avoid the ai.js cycle).
function milStrength(state, pid, ruleset) {
  let n = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === pid && ruleset.units[u.type].attack > 0) n = n + 1;
  }
  return n;
}

// 0-100: how weak `other` is relative to `me` (HIGH = other is weak = invites
// attack; the user's "prey on the weak"). ~50 at parity, ->100 as me dominates.
function weakness(state, me, other, ruleset) {
  const mine = milStrength(state, me, ruleset);
  const theirs = milStrength(state, other, ruleset);
  return idiv(mine * 100, mine + theirs + 1);
}

// 0-100: fear — HIGH when `other` is much stronger (appease/defend, suppresses
// war intent). The inverse share of the combined military. Derived, not stored.
function fearOf(state, me, other, ruleset) {
  const mine = milStrength(state, me, ruleset);
  const theirs = milStrength(state, other, ruleset);
  return idiv(theirs * 100, mine + theirs + 1);
}

function cheb(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

// 100 if `other` has a unit or city within threatRadius of any of `me`'s cities,
// else 0 (the borderPressure signal — reuses the city-proximity idea from ai.js).
function borderPressure(state, me, other, ruleset) {
  const r = ruleset.rules.threatRadius === undefined ? 8 : ruleset.rules.threatRadius;
  const myCities = [];
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const c = state.cities[cid];
    if (c !== undefined && c.owner === me) myCities.push(c);
  }
  if (myCities.length === 0) return 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner !== other) continue;
    for (const c of myCities) if (cheb(state.map, u.x, u.y, c.x, c.y) <= r) return 100;
  }
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const oc = state.cities[cid];
    if (oc === undefined || oc.owner !== other) continue;
    for (const c of myCities) if (cheb(state.map, oc.x, oc.y, c.x, c.y) <= r) return 100;
  }
  return 0;
}

// has `other` LAUNCHED a spaceship (bound for Alpha Centauri)? The all-out-war
// trigger: every rival's war intent toward the launcher spikes (§4).
function hasLaunched(state, pid) {
  const p = state.players[pid];
  return p !== undefined && p.spaceship !== undefined
    && p.spaceship.launched !== undefined && p.spaceship.launched !== 0;
}

// war intent of `me` toward `other` (§3). Above warIntentThreshold + at peace ->
// declare (break the treaty); at default war the AI just attacks as today.
function scoreWarIntent(state, me, other, ruleset) {
  const d = ruleset.rules.diplomacy;
  const agg = personalityOf(state, me, ruleset).aggression;
  const grv = grievanceOf(state, me, other);
  const weak = weakness(state, me, other, ruleset);
  const border = borderPressure(state, me, other, ruleset);
  const fear = fearOf(state, me, other, ruleset);
  const trust = trustOf(state, me, other);
  const launch = hasLaunched(state, other) ? d.relLaunchWarBonus : 0;
  return agg * d.wAgg + grv * d.wGrv + weak * d.wWeak + border * d.wBorder
    - fear * d.wFear - trust * d.wTrust + launch * d.wLaunch;
}

// whether `me` ACCEPTS a pending peace offer from `other` (§3). A Gandhi with
// high fear + low grievance accepts; a Shaka who is winning rejects. warWeariness
// is a D3 placeholder (0 — a later refinement; the fear term already captures
// "losing -> want peace"). winningWar = weakness(other) (I'm winning if they are weak).
function scorePeaceAccept(state, me, other, ruleset) {
  const d = ruleset.rules.diplomacy;
  const agg = personalityOf(state, me, ruleset).aggression;
  const grv = grievanceOf(state, me, other);
  const fear = fearOf(state, me, other, ruleset);
  const trust = trustOf(state, me, other);
  const winning = weakness(state, me, other, ruleset);
  const warWeariness = 0;
  return fear * d.wPFear + trust * d.wPTrust + warWeariness * d.wWeary
    - agg * d.wPAgg - grv * d.wPGrv - winning * d.wWinning;
}

export { scoreWarIntent, scorePeaceAccept, weakness, fearOf, borderPressure, milStrength, hasLaunched };
