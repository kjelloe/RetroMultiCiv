# marker-0060 — D1 diplomacy: war/peace states (phase 6 opens)

Phase-6 slice 1. The engine now has explicit war/peace relations and
the commands to change them — the foundation the treaties, audiences,
reputation, and senate build on. Golden-neutral by construction: the
AI doesn't yet USE diplomacy (that's D3), so the soak is byte-identical
to marker-0059.

## What shipped

- **State (omit-safe):** `state.relations`, keyed by the sorted
  player-id pair (`"p1|p6"` — pids not civIds, since civ is optional
  in scenario states), `{ state, treatyTurn, expiresTurn?, offer? }`.
  ABSENT pair = war (the default; empty relations = today's world
  exactly). Lazy expiry — `relationOf` derives war past expiresTurn
  with no mutation/event. `player.reputation` record-only (default 0).
  createGame stamps neither.
- **Commands** (engine/diplomacy.js + twin): declare / offer / accept
  / reject, with eight rejections (selfTarget,
  cannotDiplomacyBarbarians, noSuchTarget, noSuchOffer, alreadyWar,
  notYourTurn, atPeace, unknownKind).
- **The combat reframe** (the load-bearing change): `relationOf` gates
  ATTACK and city-capture (new `atPeace` rejection) and war-gates the
  A79 blockade (peace = trade flows). ZOC unchanged (D1 scope). Because
  absent = war, all of this is byte-identical to today until a treaty
  is signed.
- **Events:** WAR_DECLARED / PEACE_TREATY_SIGNED / TREATY_BROKEN
  through the #1205 gate; treaty-break decrements reputation. Fog per
  B5 (parties see details, world sees the headline).
- **Prune:** dead-partner cleanup on defeat (drops every pair touching
  an eliminated civ).

## The five decisions (all ratified)

1. **notMet deferred** — §7's test list mentioned it, but §2 (reviewer
   #1580) correctly defers it to D2 (no engine met-state exists — it's
   a client derivation; adding it would move every golden). §7 leftover
   corrected in the spec.
2. **Event names UPPER_SNAKE** — a deliberate exception to camelCase,
   because the committed D2 client classifier already switches on
   WAR_DECLARED etc. (the helper's D2 pre-draft) and the ally §3a names
   them so. camelCase would have broken the committed client; the
   #1205 scanner regex was widened to enforce the underscore names. A
   good cross-lane catch.
3. **Require cycle broken** — diplomacy→barbarians→combat→cities→
   diplomacy hangs luau's eager require; fixed by inlining
   `BARB_ID = "barb"` in diplomacy (both engines) with a
   must-match-barbarians note, the Lua-portable-subset idiom.
4. **Dead prune branch removed** — an offer's `from` is always a pair
   member, so an offer-specific prune was unreachable.
5. **D1 placeholders** — reputation break penalty = 1 (module const,
   record-only; D3 moves the weight to data per the spec), eventCiv
   fallback civ ?? name ?? pid, expiresTurn = 0 sentinel for a
   perpetual treaty (unhashed event field).

## Pins and goldens

Scenario 012-diplomacy pinned cross-language 0xe5454e3d (a
declare→offer→accept→break chain; PORTED count 44). GOLDEN-NEUTRAL
verified: soak/natural/turn-100/witness + A82a/002/both data checksums
UNCHANGED (default-war + omit-safe + no AI diplomacy in the soak =
byte-identical; no rulesetHash). test/diplomacy.test.js 14 rows.
JS==Luau throughout. Suite 600/600; pins synced.

## What it unblocks

- **The D2 client auto-activates** — the helper's inert pre-draft
  probes for engine/diplomacy.js and switches on these exact event
  names; a one-line wire-up confirmation and the 🤝 panel + treaty
  actions go live.
- **D2 human treaty UI + the inline "are we at war, since when, why"
  legibility bar** (the phase-6 acceptance) is now buildable.
- D3 (AI negotiation) waits on A59 leader-attributes; D4/D5/D6 follow.
