// D2 (specs/d1-diplomacy.md) — the diplomacy LEGIBILITY reads + presentation,
// kept DOM-free so the logic unit-tests in node (the strategic.js /
// turnlog-classes.js pattern). Every read is DEFENSIVE: state.relations and
// player.reputation are omit-safe (absent on today's build, on scenario/mock/
// crafted states), so these degrade to the spec DEFAULT — war, reputation 0 —
// which is exactly today's permanent-war world. Nothing here mutates state.
//
// PID vs CIV (R3): relations are keyed by sorted PLAYER-id pairs (pids are the
// engine identity everywhere; `civ` is an optional player field). The EVENTS
// carry civIds with a name/pid fallback — resolveCivName supplies the display.
//
// SINGLE SOURCE OF TRUTH (D1 landed, #1606): relationOf/reputationOf/pairKey are
// the ENGINE's authoritative helpers, re-exported here so the display can never
// drift from the combat-gating logic (if D3 retunes expiry, the client follows
// for free). The presentation below (labels, treaty-action mirror, event fog)
// layers on top. engine/diplomacy.js is a dep-free leaf, so this import is safe
// in both browser and node.
import { relationOf, reputationOf, pairKey } from '../engine/diplomacy.js';
export { relationOf, reputationOf, pairKey };

// The raw relations entry for a pair, or null (defensive: no relations map yet).
export function relationEntry(state, a, b) {
  const rel = state && state.relations;
  if (!rel) return null;
  const e = rel[pairKey(a, b)];
  return e || null;
}

// A standing peace offer on the pair, or null. The offer lives IN the relations
// entry (R2): { from, duration, turn }. `from` is the pid that proposed it.
export function pendingOfferFor(state, a, b) {
  const e = relationEntry(state, a, b);
  return e && e.offer ? e.offer : null;
}

// The one-line status a civ row shows: are we at war, since when, and (peace)
// until when. Perpetual peace (no expiresTurn) is the Civ1-consistent default.
export function relationLabel(state, me, them) {
  const e = relationEntry(state, me, them);
  if (relationOf(state, me, them) === 'peace') {
    const since = e && e.treatyTurn !== undefined ? ` since turn ${e.treatyTurn}` : '';
    const until = e && e.expiresTurn !== undefined ? ` (until turn ${e.expiresTurn})` : ' (perpetual)';
    return `🕊 at peace${since}${until}`;
  }
  // war: a treatyTurn on a war entry marks the declaration; absent = the
  // default perpetual war (no "since" — it was always so)
  const since = e && e.state === 'war' && e.treatyTurn !== undefined ? ` since turn ${e.treatyTurn}` : '';
  return `⚔ at war${since}`;
}

// Which treaty ACTIONS are legal from `me` toward `them`, mirrored client-side
// so buttons gray/hide before a dispatch (the engine still arbitrates). Returns
// { canDeclare, canOffer, canAccept } — accept only when a standing offer came
// FROM them. Pure read; the engine's rejections are the source of truth.
export function treatyActions(state, me, them) {
  const rel = relationOf(state, me, them);
  const offer = pendingOfferFor(state, me, them);
  return {
    canDeclare: rel === 'peace',                 // declaring war on a war is a no-op (alreadyWar)
    canOffer: rel === 'war',                     // offering peace during peace is moot
    canAccept: !!(offer && offer.from === them)  // accept an offer THEY made
  };
}

const REASON = { border_pressure: 'border pressure' };
const PENALTY = { reputation_loss: 'reputation cost' };

// The three D1 events → a turn-log row { text, cls }, or null. Fog per B5: a
// PARTY (opts.isMine(civId) true for one side) hears the detail (reason/
// penalty/expiry); the world hears the headline. opts.civName(civId) resolves
// the display name (pid/name fallback lives in the caller).
export function diplomacyEventRow(e, opts) {
  const name = opts.civName;
  const mine = opts.isMine || (() => false);
  if (e.type === 'WAR_DECLARED') {
    const a = name(e.attackerCivId), d = name(e.defenderCivId);
    const party = mine(e.attackerCivId) || mine(e.defenderCivId);
    const cls = mine(e.defenderCivId) ? 'loss' : '';
    const why = party && e.reason ? ` — ${REASON[e.reason] || e.reason}` : '';
    return { text: `${party ? '⚔' : '👀'} ${a} declares war on ${d}${why}`, cls };
  }
  if (e.type === 'PEACE_TREATY_SIGNED') {
    const a = name(e.civAId), b = name(e.civBId);
    const party = mine(e.civAId) || mine(e.civBId);
    // the engine sends expiresTurn:0 for a PERPETUAL treaty (state holds no
    // undefined — the Civ1 default); a real expiry is always a future turn > 0
    const until = party ? (e.expiresTurn ? ` (until turn ${e.expiresTurn})` : ' (perpetual)') : '';
    return { text: `🕊 ${a} and ${b} sign peace${until}`, cls: party ? 'win' : '' };
  }
  if (e.type === 'TREATY_BROKEN') {
    const br = name(e.breakerCivId), inj = name(e.injuredCivId);
    const party = mine(e.breakerCivId) || mine(e.injuredCivId);
    const cls = mine(e.injuredCivId) ? 'loss' : '';
    const why = party && e.penalty ? ` — ${PENALTY[e.penalty] || e.penalty}` : '';
    return { text: `${party ? '⚔' : '👀'} ${br} breaks the treaty with ${inj}${why}`, cls };
  }
  return null;
}
