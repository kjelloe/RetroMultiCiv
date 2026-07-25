// D3 AI-diplomacy decision score models (spec d3 §3). PURE integer scores over
// personality (A59) + relationship (D1/D3 trust/grievance) + military/proximity
// situationals. Kept OUT of ai.js (300-line ceiling). NO ai.js import — ai.js
// imports THIS for its diplomacy step, so the reverse edge would cycle; military
// strength + border pressure are small local reads over combat.js primitives.
import { personalityOf } from './leaders.js';
import { grievanceOf, trustOf, reputationOf } from './diplomacy.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

// D5: is wonder `wid` OBSOLETE — any player holds its obsoleteBy tech (global, the
// cities.js wonderActive rule, inlined here to avoid the cities->diplomacy require
// cycle the Luau twin hangs on).
function wonderObsolete(state, wid, ruleset) {
  const ob = ruleset.wonders[wid].obsoleteBy;
  if (ob === undefined || ob === '') return false;
  for (const pid of state.playerOrder) {
    const techs = state.players[pid].techs === undefined ? [] : state.players[pid].techs;
    if (techs.indexOf(ob) !== -1) return true;
  }
  return false;
}

// D5: the peace bonus `owner` earns from owning an ACTIVE peaceAcceptBonus wonder
// (United Nations / Great Wall, #2507). Rivals' scorePeaceAccept toward the owner is
// boosted so they both offer AND accept peace. Sums (both wonders) — omit-safe (0).
function peaceWonderBonus(state, owner, ruleset) {
  if (state.wonders === undefined) return 0;
  let bonus = 0;
  for (const wid of Object.keys(state.wonders)) {
    const w = ruleset.wonders[wid];
    if (w === undefined || w.effect === undefined || w.effect.peaceAcceptBonus === undefined) continue;
    if (wonderObsolete(state, wid, ruleset)) continue;
    const city = state.cities === undefined ? undefined : state.cities[state.wonders[wid]];
    if (city !== undefined && city.owner === owner) bonus = bonus + w.effect.peaceAcceptBonus;
  }
  return bonus;
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
  // D5: a treacherous OTHER (high reputation) is trusted less — its offers discounted;
  // an OTHER owning a peace wonder (UN/Great Wall) is far easier to make peace with.
  const otherRep = reputationOf(state, other);
  const peaceWonder = peaceWonderBonus(state, other, ruleset);
  return fear * d.wPFear + trust * d.wPTrust + warWeariness * d.wWeary
    - agg * d.wPAgg - grv * d.wPGrv - winning * d.wWinning
    - otherRep * d.wPRep + peaceWonder;
}

// D4: whether `me` should DEMAND tribute from `other` (#2507 digest — gated
// non-Republic/Democracy government + military dominance). A Republic/Democracy
// does not extort (its senate/peaceful ethos), so it never demands. Deterministic
// (no roll) — a state-derived strength read. The amount + cooldowns are decided
// by the caller (diplomacyStep).
function wantsTribute(state, me, other, ruleset) {
  const d = ruleset.rules.diplomacy;
  const p = state.players[me];
  const gov = p.government === undefined ? 'despotism' : p.government;
  if (gov === 'republic' || gov === 'democracy') return false;
  return weakness(state, me, other, ruleset) >= d.tributeDemandWeakness;
}

// D4: whether `me` PAYS a tribute demand from `other` (else it refuses). Pays when
// sufficiently outmatched (fear high) — the appease-the-strong read. Deterministic.
function wantsPayTribute(state, me, other, ruleset) {
  const d = ruleset.rules.diplomacy;
  return fearOf(state, me, other, ruleset) >= d.tributeAcceptFear;
}

export { scoreWarIntent, scorePeaceAccept, weakness, fearOf, borderPressure, milStrength, hasLaunched,
  wantsTribute, wantsPayTribute, peaceWonderBonus };
