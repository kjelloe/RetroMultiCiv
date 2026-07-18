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
// WIRE-UP NOTE (D1 lands): the engine will own the authoritative relationOf for
// combat gating; this client copy implements the SAME spec semantics
// (absent = war; a lapsed timed treaty derives war at state.turn >= expiresTurn,
// no mutation). If D1 exports relationOf the client may swap to it for a single
// source of truth — the semantics are pinned identical here so the display is
// correct either way.

// Sorted pair key — the same string the engine keys state.relations by.
export function pairKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

// The raw relations entry for a pair, or null (defensive: no relations map yet).
export function relationEntry(state, a, b) {
  const rel = state && state.relations;
  if (!rel) return null;
  const e = rel[pairKey(a, b)];
  return e || null;
}

// 'war' | 'peace'. Absent pair = war (the default). A peace treaty whose
// expiresTurn has arrived derives back to war with no mutation (R2/expiry).
export function relationOf(state, a, b) {
  const e = relationEntry(state, a, b);
  if (!e || e.state !== 'peace') return 'war';
  if (e.expiresTurn !== undefined && state.turn >= e.expiresTurn) return 'war';
  return 'peace';
}

// Integer reputation, default 0 (RECORD-ONLY in D1; nothing gates on it yet).
export function reputationOf(state, pid) {
  const p = state && state.players && state.players[pid];
  return p && p.reputation !== undefined ? p.reputation : 0;
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
    const until = party ? (e.expiresTurn !== undefined ? ` (until turn ${e.expiresTurn})` : ' (perpetual)') : '';
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
