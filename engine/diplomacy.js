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

// D4: grant `techId` to `pid` (tech-exchange). MINIMAL by design — pushes the
// tech + finishes matching in-progress research + emits techDiscovered, but does
// NOT run the obsolete-building / Leonardo cascade grantTech does (that lives in
// tech.js, which imports cities.js, which imports THIS — the require cycle the
// Luau eager-require hangs on). No-op if the tech is empty or already held.
function diploGrantTech(state, pid, techId, events) {
  const player = state.players[pid];
  if (player === undefined || techId === '' || player.techs.indexOf(techId) !== -1) return;
  player.techs.push(techId);
  if (player.researching === techId) player.researching = '';
  events.push({ type: 'techDiscovered', playerId: pid, tech: techId });
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
    // D5 SENATE: a Republic/Democracy (governments.json govForbidsWar) cannot break a
    // standing peace treaty — the senate refuses. Deterministic, a FIRST-CLASS reject
    // (Civ1-blanket, #2507). Declaring from default war is unaffected (never wasPeace).
    if (wasPeace) {
      const gov = ruleset.governments[state.players[pid].government === undefined ? 'despotism' : state.players[pid].government];
      if (gov !== undefined && gov.govForbidsWar === true) return { ok: false, reason: 'senateRefused' };
    }
    // D3: MODIFY in place — preserve met/grievance/trust; only the D1 fields change.
    const e = entry === undefined ? {} : entry;
    if (entry === undefined) state.relations[key] = e;
    e.state = 'war';
    e.treatyTurn = state.turn;
    delete e.expiresTurn;
    delete e.offer;
    events.push({ type: 'WAR_DECLARED', attackerCivId: eventCiv(state, pid), defenderCivId: eventCiv(state, target), turn: state.turn, reason: 'border_pressure' });
    if (wasPeace) {
      // D5 REPUTATION: a treaty break INCREMENTS reputation toward Treacherous
      // (0=Honorable .. repMax=Treacherous, clamped) and resets the recovery clock —
      // replaces the D1 decrement. REPUTATION_SHIFT rides it; recovery is processReputation.
      const d = ruleset.rules.diplomacy;
      const bump = d.repBetrayBump === undefined ? 1 : d.repBetrayBump;
      const max = d.repMax === undefined ? 4 : d.repMax;
      let rep = reputationOf(state, pid) + bump;
      if (rep > max) rep = max;
      state.players[pid].reputation = rep;
      state.players[pid].repCleanTurns = 0;
      events.push({ type: 'REPUTATION_SHIFT', civId: eventCiv(state, pid), reputation: rep, direction: 'worse', turn: state.turn });
      // D3: betrayal raises the VICTIM's grievance toward the breaker + cuts its trust.
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
    // D4: a terms.kind carries the offer FLAVOUR (absent = peace, the D3 shape).
    // Fields ride flat on the offer (not a nested obj) — hash-stable, Luau-friendly.
    if (terms.kind === 'tribute') {
      offer.kind = 'tribute';
      offer.gold = terms.gold === undefined ? 0 : terms.gold;
    } else if (terms.kind === 'techExchange') {
      offer.kind = 'techExchange';
      offer.techId = terms.techId === undefined ? '' : terms.techId;
      if (terms.wantTechId !== undefined) offer.wantTechId = terms.wantTechId; // absent = one-way gift
    }
    // D4: every offer carries an expiry (offered + offerExpiryTurns). The sweep
    // (processExpiry, run at round-wrap) deletes it and emits OFFER_EXPIRED so no
    // offer silently disappears. omit-safe: no knob -> no expiry (pre-D4 shape).
    const exp = ruleset.rules.diplomacy === undefined ? undefined : ruleset.rules.diplomacy.offerExpiryTurns;
    if (exp !== undefined && exp > 0) offer.expiresTurn = state.turn + exp;
    if (entry === undefined) state.relations[key] = { state: 'war', offer: offer };
    else entry.offer = offer; // a new offer OVERWRITES a standing one (pinned)
    return { ok: true, events: [] }; // an offer is not yet a treaty — emits nothing
  }

  if (cmd.kind === 'accept') {
    if (entry === undefined || entry.offer === undefined) return { ok: false, reason: 'noSuchOffer' };
    const offer = entry.offer;
    const okind = offer.kind === undefined ? 'peace' : offer.kind;
    // D4: tribute — the acceptor (pid) is the PAYER; offer.from is the demander.
    // Gold flows payer -> demander, clamped to the payer's treasury (pay what you
    // can). Does NOT alter the war/peace state (a demand is separate from a treaty).
    if (okind === 'tribute') {
      const payer = state.players[pid];
      const demander = state.players[offer.from];
      let amt = offer.gold === undefined ? 0 : offer.gold;
      if (payer.gold < amt) amt = payer.gold;
      payer.gold = payer.gold - amt;
      demander.gold = demander.gold + amt;
      delete entry.offer;
      entry.tributePaidTurn = state.turn; // gate re-demand (AI checks tributeReDemandCooldown)
      events.push({ type: 'TRIBUTE_PAID', payerCivId: eventCiv(state, pid), receiverCivId: eventCiv(state, offer.from), gold: amt, turn: state.turn });
      return { ok: true, events };
    }
    // D4: tech exchange — offer.from GIVES techId to the acceptor (pid); if a
    // wantTechId is set, the acceptor gives it back (a swap). Whole techs only,
    // no research points. Grants are MINIMAL here (push + techDiscovered) — the
    // obsolete-building / Leonardo cascade is NOT run on a traded tech (a known
    // D4 simplification; importing tech.js would form the tech->cities->diplomacy
    // require cycle the Luau twin hangs on). Treaty state unchanged.
    if (okind === 'techExchange') {
      diploGrantTech(state, pid, offer.techId === undefined ? '' : offer.techId, events);
      if (offer.wantTechId !== undefined) diploGrantTech(state, offer.from, offer.wantTechId, events);
      delete entry.offer;
      events.push({ type: 'TECH_EXCHANGED', giverCivId: eventCiv(state, offer.from), takerCivId: eventCiv(state, pid), turn: state.turn });
      return { ok: true, events };
    }
    // peace (default) — the D3 behaviour.
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
function contactPass(state, pid, events, ruleset) {
  const player = state.players[pid];
  if (player === undefined) return;
  const mask = computeVisible(state, pid, ruleset);
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

// D4 offer-expiry sweep — ENGINE processing (replayable), run once per round-wrap
// (endTurn) beside processDecay. An offer past its expiresTurn is deleted and an
// OFFER_EXPIRED event emitted (neutral wording) so no offer silently vanishes.
// Omit-safe: a no-op when relations is empty or an offer carries no expiresTurn
// (a pre-D4 offer, or a knob-less ruleset).
function processExpiry(state, ruleset, events) {
  if (state.relations === undefined) return;
  for (const key of Object.keys(state.relations)) {
    const e = state.relations[key];
    const offer = e.offer;
    if (offer === undefined || offer.expiresTurn === undefined) continue;
    if (state.turn >= offer.expiresTurn) {
      const parts = key.split('|');
      const other = offer.from === parts[0] ? parts[1] : parts[0];
      delete e.offer;
      events.push({ type: 'OFFER_EXPIRED', fromCivId: eventCiv(state, offer.from), toCivId: eventCiv(state, other), turn: state.turn });
    }
  }
}

// D5 reputation RECOVERY (engine processing, replayable), run once per round-wrap
// beside processDecay/processExpiry. A civ with a soiled reputation (rep > 0) that
// keeps its treaties heals one band every repRecoverTurns consecutive clean turns
// (reviewer #2066: RECOVERABLE). The clock (repCleanTurns) resets on a betrayal
// (the declare handler). Fully-healed civs shed BOTH fields so a recovered state is
// byte-identical to a never-soiled one (reputation is stored 1..repMax or ABSENT,
// never 0). Omit-safe: a no-op for the whole clean soak.
function processReputation(state, ruleset, events) {
  const d = ruleset.rules.diplomacy;
  if (d === undefined) return;
  const recover = d.repRecoverTurns === undefined ? 0 : d.repRecoverTurns;
  if (recover <= 0) return;
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (p === undefined || p.reputation === undefined || p.reputation <= 0) continue;
    const clean = (p.repCleanTurns === undefined ? 0 : p.repCleanTurns) + 1;
    if (clean >= recover) {
      const rep = p.reputation - 1;
      if (rep <= 0) { delete p.reputation; delete p.repCleanTurns; }
      else { p.reputation = rep; p.repCleanTurns = 0; }
      events.push({ type: 'REPUTATION_SHIFT', civId: eventCiv(state, pid), reputation: p.reputation === undefined ? 0 : p.reputation, direction: 'better', turn: state.turn });
    } else {
      p.repCleanTurns = clean;
    }
  }
}

export { relationOf, reputationOf, pruneDiplomacy, diplomacyCommand, pairKey,
  grievanceOf, trustOf, bumpRel, metOf, contactPass, processDecay, processExpiry, processReputation };
