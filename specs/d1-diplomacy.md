# D1 — war/peace states + declare/offer/accept peace: buildable spec (architect, 2026-07-18)

Phase-6 slice 1 (docs/14 §8). Grounded in the ally-specified event
shapes (§3a) and the user's pre-ruled D1 defaults (blockade war-gated;
stance public in v1). NARROW BY DESIGN — this ships the MECHANISM
(state + commands + events + the combat reframe); the AI does not yet
USE it (that's D3, gated on A59 leader-attributes), and there is no
senate (D5), tribute, or tech-exchange (D4). Those are named as
non-goals so the window stays small.

## The reframe (the load-bearing idea)

Today "permanent war" is the ABSENCE of a peace treaty — combat,
blockade, and ZOC all assume every foreign unit is an enemy. D1
introduces an explicit relation and makes those checks read it, with
the DEFAULT being war. So when no treaty exists (the soak's entire
world today), behavior is byte-identical to marker-0058. Peace only
changes anything once a diplomacy command signs it — and no AI issues
diplomacy commands until D3. That is why D1 is GOLDEN-NEUTRAL: the
state is omit-safe, the default is war, and the soak never signs a
treaty.

## 1. State model (omit-safe additions)

- `state.relations` — a plain object keyed by the sorted PLAYER-id
  pair string (`"p1|p6"`, R3: pids not civIds — `civ` is an OPTIONAL
  player field, absent in scenario/mock/crafted states; p1..pN is the
  engine identity everywhere. civIds live in the EVENTS with a
  name/pid fallback). Value `{ state:'war'|'peace', treatyTurn,
  expiresTurn?, offer? }`. ABSENT pair = war (the default). Empty
  `state.relations` = today's world exactly (omit-safe: createGame
  stamps nothing; helper `relationOf(state, a, b)` returns 'war' when
  absent — AND derives 'war' when `state.turn >= expiresTurn` so a
  lapsed timed treaty needs no mutation/event to expire, R2/expiry).
- **The pending offer is IN the relations entry** (R2, not a second
  map): `offer: { from, duration, turn }`, absent = none. A new offer
  OVERWRITES a standing one (pinned). Offers + treaties PRUNE when
  either civ is eliminated (the N10 dead-partner class). Omit-safe,
  hashed; scenario 012 pins a pending-offer state cross-language.
- `state.players[pid].reputation` — integer, RECORD-ONLY in D1
  (breaking peace decrements it; nothing READS it until D3). Omit-safe:
  absent = clean (0). A helper `reputationOf` defaults 0.
- No embassy field in D1 (D6).
- All plain data; every change flows through a logged command.

## 2. Commands (the diplomacy family, D1 subset)

`{ type:'diplomacy', kind, playerId, target, terms }`:
- `kind:'declare'` — declare war: sets the pair to war, stamps
  treatyTurn, emits WAR_DECLARED. If a peace treaty stood, this is
  TREATY-BREAKING: also decrement reputation and emit TREATY_BROKEN.
- `kind:'offer'` — propose peace (terms `{ peace:true, duration }`):
  records a pending offer on the target (D1 has no AI to auto-answer;
  a human/regent answers via accept/reject — the AI auto-answer is
  D3). Emits nothing until answered (an offer is not yet a treaty).
- `kind:'accept'` — accept a standing peace offer: sets the pair to
  peace, stamps treatyTurn + expiresTurn (turn + duration), emits
  PEACE_TREATY_SIGNED. Clears the pending offer.
- `kind:'reject'` — reject a standing offer: clears it, no state change.
VALIDATION (rejections, the A83/A90 house shape): `selfTarget`,
`noSuchOffer` (accept/reject with no pending offer),
`alreadyPeace`/`alreadyWar` (no-op declares), `notYourTurn`. Barbarians
(BARB_ID) are never a valid target (`cannotDiplomacyBarbarians`). All
readable from existing or D1-added state.
**`notMet` DEFERRED to D2 (R1, reviewer #1580 — CRITICAL):** there is
NO engine met-state. "First contact" today is a CLIENT-side turnlog
DERIVATION (turnlog.js from view deltas), not engine state — so
`notMet` has nothing to read, and adding engine met-tracking would
write state on every new contact (constant in every soak seed) →
every hash and golden MOVES → golden-neutrality DIES. So D1 does NOT
gate on met-state; a real ENGINE `FIRST_CONTACT` event + omit-safe
met-state is its OWN budgeted BEHAVIORAL window in D2 (goldens move
once, honestly), and the client turnlog derivation retires onto the
real event then. D1 stays golden-neutral by not tracking contact.

## 3. Events (ally-specified shapes §3a, through the #1205 gate)

FIRST_CONTACT already exists (first-contact events ship today).
D1 adds `WAR_DECLARED { attackerCivId, defenderCivId, turn, reason }`,
`PEACE_TREATY_SIGNED { civAId, civBId, turn, expiresTurn }`,
`TREATY_BROKEN { breakerCivId, injuredCivId, turn, penalty }`. `reason`
+ `penalty` are enums (`border_pressure` / `reputation_loss` for D1's
single cases; the table grows in D3/D5). Fog per B5: the two parties
hear details, the world hears the headline ("Rome and Egypt sign
peace"). Turn stamped by the engine.

## 4. The combat reframe (where the mechanism bites)

`relationOf(state, attacker, defender)` gates the war-only actions,
each defaulting to war when the pair is absent (so today's behavior is
unchanged):
- ATTACK: a unit may not attack a unit/city of a civ it is at PEACE
  with (new rejection `atPeace`). At war (default) — unchanged.
- A79 BLOCKADE (pre-ruled default #1): a foreign unit on a worked tile
  only blockades it if the two civs are at WAR. At peace, the tile is
  not blockaded (peace = trade flows). Absent relation = war = today's
  blockade behavior.
- ZOC: unchanged in D1 (ZOC is a movement rule, not an act of war;
  peace doesn't grant passage — revisit in D2/D3 if playtest wants it).
STANCE PUBLIC (pre-ruled default #2): AI stance stays visible (the
strategic overlay + regency tags already show it); D1 adds nothing to
hide it. Noted so D3's negotiation reads a known stance.

## 5. Humans at the table (engine only in D1)

The engine enforces peace for HUMANS exactly as for AI: a human
attacking under a peace treaty hits the `atPeace` rejection, and
declaring war while a treaty stands breaks it (reputation + event) —
the treaty-breaking consequence applies to the player too. The treaty
UI is D2; D1 ships the enforceable engine states so LAN humans can be
held to them the moment the UI lands.

## 6. Golden-neutral analysis (VERIFY, don't assume)

- state.relations + reputation omit-safe → createGame stamps neither →
  A82a/002 anchors + both data checksums UNCHANGED.
- No rules.json change in D1 (diplomacy WEIGHTS are D3). rulesetHash
  unchanged.
- The combat reframe defaults to war when relations is absent → the
  soak (no diplomacy commands ever issued by AI) is byte-identical →
  soak/natural/turn-100/witness UNCHANGED. VERIFY with a full re-run;
  if anything moves, a peace path fired unexpectedly — investigate,
  don't re-record.
So D1 is GOLDEN-NEUTRAL by construction (the A76/N12 dormancy class).

## 7. Tests

Fixtures (test/diplomacy.test.js): declare→war+event; offer→accept→
peace+PEACE_TREATY_SIGNED+expiresTurn; declare-while-peace→TREATY_BROKEN
+reputation−; the rejections (notMet, atPeace attack under treaty,
noSuchOffer, barbarian target); the A79 blockade war-gate (enemy on a
worked tile at WAR blockades, at PEACE does not). Scenario
012-diplomacy pinned cross-language (a declare→offer→accept→break
chain; the reputation int + relations in the final hash). Golden
re-record NOT expected (verify unchanged).

## 8. Prereq + sequencing note

D1 needs NO prerequisite — it is state + commands + the reframe.
**A59 leader-attributes (specs/leader-attributes.md) is D3's prereq,
not D1's** (D3 = the AI negotiation policy that decides offers/demands
by leader stance). So D1 opens as the next engine window after N9b;
D2 (the audience + human treaty UI, client, golden-safe) can proceed
in parallel on the client lane once D1's events exist. D3 waits on
A59 being built.

## 9. Provenance

War/peace-per-pair and reputation-on-betrayal: Civ1-CONSISTENT
(reviewer #1580 — the dump is SILENT on Civ1 diplomacy: no
Diplomacy/Peace/Treaty/Reputation (Civ1) pages exist; the series'
diplomacy pages start at Civ2. Right framings, dump-uncitable). The
default-war reframe is a mechanical restatement of today's
permanent-war rule (no behavior change). **TREATY DURATION**: Civ1
treaties persisted until BROKEN — timed expiry is a later-series
shape. So `terms.duration` is OPTIONAL: ABSENT = PERPETUAL treaty (no
expiresTurn — the Civ1-consistent default, which moots the expiry
derivation for the common case); duration-bearing treaties are
labeled house/original. The war-gated blockade + public stance are
the user's pre-ruled D1 defaults (2026-07-18).
