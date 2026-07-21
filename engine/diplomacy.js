// D1 diplomacy (specs/d1-diplomacy.md): explicit war/peace per PLAYER-pair +
// reputation, and the seams the combat reframe reads. OMIT-SAFE by construction:
// createGame stamps nothing, an ABSENT pair reads as war (the default), so a world
// with no treaty — the entire soak — is byte-identical to pre-D1. No AI issues
// these commands until D3, so D1 is golden-neutral.
//
// Entry shape (state.relations, keyed by the sorted pid pair "p1|p6"):
//   war (declared):  { state:'war',  treatyTurn }
//   peace (signed):  { state:'peace', treatyTurn, expiresTurn? }   (expiresTurn only when a duration was given — absent = PERPETUAL, the Civ1 default)
//   a pending offer adds:  offer: { from, turn, duration? }        (absent pair -> { state:'war', offer } placeholder)

import { computeVisible } from './visibility.js';

// BARB_ID inlined (not imported from barbarians.js) to avoid the require cycle
// diplomacy -> barbarians -> combat -> cities -> diplomacy (luau's eager require
// hangs on it). Must match barbarians.BARB_ID.
const BARB_ID = 'barb';

// D3 relationship-value defaults (the neutral points — structural, not tunable
// weights): trust starts at 50 (neither trusting nor wary), grievance at 0.
const TRUST_DEFAULT = 50;
const GRIEVANCE_DEFAULT = 0;

// D1 reputation penalty for breaking a treaty. RECORD-ONLY in D1 (nothing READS
// reputation until D3); the tunable weight moves to data/*.json in D3.
const TREATY_BREAK_PENALTY = 1;

// the relations key is the sorted PLAYER-id pair (R3: pids, not civIds — civ is
// an OPTIONAL player field; p1..pN is the engine identity everywhere).
function pairKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

// war unless an UNEXPIRED peace treaty stands. Absent pair = war (the default);
// a peace treaty at/past its expiresTurn derives back to war with NO mutation and
// NO event (R2/expiry) — so a lapsed timed treaty needs no per-turn bookkeeping.
function relationOf(state, a, b) {
  if (state.relations === undefined) return 'war';
  const entry = state.relations[pairKey(a, b)];
  if (entry === undefined) return 'war';
  if (entry.state === 'peace' && entry.expiresTurn !== undefined && state.turn >= entry.expiresTurn) return 'war';
  return entry.state;
}

// reputation is omit-safe: absent = 0 (clean).
function reputationOf(state, pid) {
  const p = state.players[pid];
  return (p !== undefined && p.reputation !== undefined) ? p.reputation : 0;
}

// the civId for an EVENT field, with a name/pid fallback (civ is optional/absent
// in crafted/mock/scenario states). Events are transient — never hashed — so this
// never touches a golden.
function eventCiv(state, pid) {
  const p = state.players[pid];
  if (p === undefined) return pid;
  if (p.civ !== undefined) return p.civ;
  if (p.name !== undefined) return p.name;
  return pid;
}

// prune every relation + pending offer touching an eliminated player (the N10
// dead-partner class). Called from score.js on playerDefeated. Omit-safe: a no-op
// when relations is empty/absent (the soak) — so it never moves a golden.
function pruneDiplomacy(state, pid) {
  if (state.relations === undefined) return;
  // an entry (treaty + any pending offer, whose `from` is always a pair member)
  // is dropped whenever either side of its pair is the eliminated civ.
  for (const key of Object.keys(state.relations)) {
    const parts = key.split('|');
    if (parts[0] === pid || parts[1] === pid) delete state.relations[key];
  }
}

function idiv(a, b) {
  return Math.floor(a / b);
}

function diplomacyCommand(state, cmd, ruleset) {
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const pid = cmd.playerId;
  const target = cmd.target;
  if (target === pid) return { ok: false, reason: 'selfTarget' };
  if (pid === BARB_ID || target === BARB_ID) return { ok: false, reason: 'cannotDiplomacyBarbarians' };
  if (state.players[target] === undefined) return { ok: false, reason: 'noSuchTarget' };
  const key = pairKey(pid, target);
  if (state.relations === undefined) state.relations = {};
  const entry = state.relations[key];
  const rel = relationOf(state, pid, target);
  const events = [];

  if (cmd.kind === 'declare') {
    // alreadyWar only rejects an EXPLICIT standing war (re-declaring formal war);
    // a declare from the default (absent) or from peace is meaningful.
    if (entry !== undefined && entry.state === 'war') return { ok: false, reason: 'alreadyWar' };
    const wasPeace = rel === 'peace';
    // D3: MODIFY in place — preserve met/grievance/trust; only the D1 fields change.
    const e = entry === undefined ? {} : entry;
    if (entry === undefined) state.relations[key] = e;
    e.state = 'war';
    e.treatyTurn = state.turn;
    delete e.expiresTurn;
    delete e.offer;
    events.push({ type: 'WAR_DECLARED', attackerCivId: eventCiv(state, pid), defenderCivId: eventCiv(state, target), turn: state.turn, reason: 'border_pressure' });
    if (wasPeace) {
      state.players[pid].reputation = reputationOf(state, pid) - TREATY_BREAK_PENALTY;
      // D3: betrayal raises the VICTIM's grievance toward the breaker + cuts its trust.
      const d = ruleset.rules.diplomacy;
      bumpRel(state, target, pid, 'grievance', d.relGrievanceOnBetray);
      bumpRel(state, target, pid, 'trust', -d.relTrustOnBetray);
      events.push({ type: 'TREATY_BROKEN', breakerCivId: eventCiv(state, pid), injuredCivId: eventCiv(state, target), turn: state.turn, penalty: 'reputation_loss' });
    }
    return { ok: true, events };
  }

  if (cmd.kind === 'offer') {
    const terms = cmd.terms === undefined ? {} : cmd.terms;
    const offer = { from: pid, turn: state.turn };
    if (terms.duration !== undefined) offer.duration = terms.duration; // absent = perpetual
    if (entry === undefined) state.relations[key] = { state: 'war', offer: offer };
    else entry.offer = offer; // a new offer OVERWRITES a standing one (pinned)
    return { ok: true, events: [] }; // an offer is not yet a treaty — emits nothing
  }

  if (cmd.kind === 'accept') {
    if (entry === undefined || entry.offer === undefined) return { ok: false, reason: 'noSuchOffer' };
    const offer = entry.offer;
    // D3: MODIFY in place — preserve met/grievance/trust.
    entry.state = 'peace';
    entry.treatyTurn = state.turn;
    if (offer.duration !== undefined) entry.expiresTurn = state.turn + offer.duration;
    else delete entry.expiresTurn;
    delete entry.offer;
    // D3: peace decays grievance both ways (integer halving).
    const gp = grievanceOf(state, pid, target);
    if (gp > 0) bumpRel(state, pid, target, 'grievance', idiv(gp, 2) - gp);
    const gt = grievanceOf(state, target, pid);
    if (gt > 0) bumpRel(state, target, pid, 'grievance', idiv(gt, 2) - gt);
    events.push({ type: 'PEACE_TREATY_SIGNED', civAId: eventCiv(state, pid), civBId: eventCiv(state, target), turn: state.turn, expiresTurn: entry.expiresTurn === undefined ? 0 : entry.expiresTurn });
    return { ok: true, events };
  }

  if (cmd.kind === 'reject') {
    if (entry === undefined || entry.offer === undefined) return { ok: false, reason: 'noSuchOffer' };
    delete entry.offer;
    // §14 F1: stamp the reject so the offerer does not immediately re-offer —
    // rel stays 'war', so without this the AI would re-offer next turn and spam
    // an offer/reject loop. diplomacyStep gates on rules.diplomacy.offerCooldown.
    entry.offerRejectedTurn = state.turn;
    return { ok: true, events: [] };
  }

  return { ok: false, reason: 'unknownKind' };
}

// D3: grievance + trust are DIRECTED (A wronged B != B wronged A). They ride the
// single sorted-pair entry as <key>_lo / <key>_hi, lo/hi = the sorted-pair order —
// so the D1 one-entry-per-pair shape (stable hashing) carries direction. This
// returns the field name for `holder`'s value toward the other side.
function dirField(key, holder, toward) {
  const lo = holder < toward ? holder : toward;
  return holder === lo ? key + '_lo' : key + '_hi';
}

// holder's grievance toward `toward` (0-100, default 0). Omit-safe.
function grievanceOf(state, holder, toward) {
  if (state.relations === undefined) return GRIEVANCE_DEFAULT;
  const entry = state.relations[pairKey(holder, toward)];
  if (entry === undefined) return GRIEVANCE_DEFAULT;
  const v = entry[dirField('grievance', holder, toward)];
  return v === undefined ? GRIEVANCE_DEFAULT : v;
}

// holder's trust toward `toward` (0-100, default 50). Omit-safe.
function trustOf(state, holder, toward) {
  if (state.relations === undefined) return TRUST_DEFAULT;
  const entry = state.relations[pairKey(holder, toward)];
  if (entry === undefined) return TRUST_DEFAULT;
  const v = entry[dirField('trust', holder, toward)];
  return v === undefined ? TRUST_DEFAULT : v;
}

// clamp-and-write the ONE place: bump holder's directed `key` value toward `toward`
// by delta, clamped 0-100, lazily creating the pair entry (D1 offer-placeholder
// pattern). Integers only. key is 'grievance' or 'trust'.
function bumpRel(state, holder, toward, key, delta) {
  if (state.relations === undefined) state.relations = {};
  const k = pairKey(holder, toward);
  if (state.relations[k] === undefined) state.relations[k] = { state: 'war' };
  const entry = state.relations[k];
  const f = dirField(key, holder, toward);
  const def = key === 'trust' ? TRUST_DEFAULT : GRIEVANCE_DEFAULT;
  const cur = entry[f] === undefined ? def : entry[f];
  let v = cur + delta;
  if (v < 0) v = 0;
  if (v > 100) v = 100;
  entry[f] = v;
}

// have a and b MADE CONTACT? A symmetric bool on the pair entry (one flag serves
// both directions). Omit-safe: absent = false (crafted/pre-D3 states = unmet).
function metOf(state, a, b) {
  if (state.relations === undefined) return false;
  const entry = state.relations[pairKey(a, b)];
  return entry !== undefined && entry.met === true;
}

// D3 contact pass (run in the turn loop for the player whose turn begins, EVERY
// seat incl. humans — D2's audience needs human first-contact too): computeVisible
// for `pid`; any rival unit/city on a visible tile -> flip met true (both ways, via
// the symmetric pair flag) and push FIRST_CONTACT once. Pure visibility READ that
// writes only met (+ the transient event). Behavioral (relations gains entries ->
// the soak moves, expected in D3). Barbarians are never a diplomacy partner.
function contactPass(state, pid, events) {
  const player = state.players[pid];
  if (player === undefined) return;
  const mask = computeVisible(state, pid);
  const width = state.map.width;
  const seen = {};
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid];
    if (u.owner === pid || u.owner === BARB_ID) continue;
    if (mask[u.y * width + u.x] === 1) seen[u.owner] = true;
  }
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const c = state.cities[cid];
    if (c === undefined || c.owner === pid || c.owner === BARB_ID) continue;
    if (mask[c.y * width + c.x] === 1) seen[c.owner] = true;
  }
  for (const other of Object.keys(seen)) {
    const key = pairKey(pid, other);
    if (state.relations === undefined) state.relations = {};
    let entry = state.relations[key];
    if (entry === undefined) { entry = { state: 'war' }; state.relations[key] = entry; }
    if (entry.met !== true) {
      entry.met = true;
      events.push({ type: 'FIRST_CONTACT', aCivId: eventCiv(state, pid), bCivId: eventCiv(state, other), turn: state.turn });
    }
  }
}

// D3 per-turn grievance decay — ENGINE processing (replayable), NOT an AI-step
// mutation: old slights fade so relations don't stay permanently hostile. Called
// once per round-wrap (endTurn). Idempotent-safe (floored 0); only touches existing
// entries (omit-safe — a no-op when relations is empty).
function processDecay(state, ruleset) {
  if (state.relations === undefined) return;
  const d = ruleset.rules.diplomacy;
  const dec = d === undefined ? 0 : d.relGrievanceDecay;
  if (dec <= 0) return;
  for (const key of Object.keys(state.relations)) {
    const e = state.relations[key];
    if (e.grievance_lo !== undefined && e.grievance_lo > 0) { e.grievance_lo = e.grievance_lo - dec; if (e.grievance_lo < 0) e.grievance_lo = 0; }
    if (e.grievance_hi !== undefined && e.grievance_hi > 0) { e.grievance_hi = e.grievance_hi - dec; if (e.grievance_hi < 0) e.grievance_hi = 0; }
  }
}

export { relationOf, reputationOf, pruneDiplomacy, diplomacyCommand, pairKey,
  grievanceOf, trustOf, bumpRel, metOf, contactPass, processDecay };
