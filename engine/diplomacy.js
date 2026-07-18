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

// BARB_ID inlined (not imported from barbarians.js) to avoid the require cycle
// diplomacy -> barbarians -> combat -> cities -> diplomacy (luau's eager require
// hangs on it). Must match barbarians.BARB_ID.
const BARB_ID = 'barb';

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

function diplomacyCommand(state, cmd, _ruleset) {
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
    state.relations[key] = { state: 'war', treatyTurn: state.turn };
    events.push({ type: 'WAR_DECLARED', attackerCivId: eventCiv(state, pid), defenderCivId: eventCiv(state, target), turn: state.turn, reason: 'border_pressure' });
    if (wasPeace) {
      state.players[pid].reputation = reputationOf(state, pid) - TREATY_BREAK_PENALTY;
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
    const next = { state: 'peace', treatyTurn: state.turn };
    if (offer.duration !== undefined) next.expiresTurn = state.turn + offer.duration;
    state.relations[key] = next; // clears the pending offer
    events.push({ type: 'PEACE_TREATY_SIGNED', civAId: eventCiv(state, pid), civBId: eventCiv(state, target), turn: state.turn, expiresTurn: next.expiresTurn === undefined ? 0 : next.expiresTurn });
    return { ok: true, events };
  }

  if (cmd.kind === 'reject') {
    if (entry === undefined || entry.offer === undefined) return { ok: false, reason: 'noSuchOffer' };
    delete entry.offer; // no state change beyond clearing the offer
    return { ok: true, events: [] };
  }

  return { ok: false, reason: 'unknownKind' };
}

export { relationOf, reputationOf, pruneDiplomacy, diplomacyCommand, pairKey };
