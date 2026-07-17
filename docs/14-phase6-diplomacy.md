# Phase 6 — Diplomacy (designed with the user, 2026-07-15)

Status: **BUILD OPENS 2026-07-17 night** (user ruling: D1–D2 —
war/peace + relationship core + first-contact audiences with the
five voices — start overnight behind the A59 leader build).
**FULL D1–D6 is 1.0-REQUIRED** (user definition ruling 2026-07-16
— human LAN treaties included, not deferred).
Four scope decisions are the user's (session
2026-07-15): classic Civ 1 scope · modal audiences for AI-initiated
contact + inline status · reputation AND senate consequences ·
formal treaties for humans in LAN too. The standing acceptance
criterion predates this doc: the phase-2 verdict scoped "diplomacy
legibility" here — a player must always understand who they're at
war with, why, and what a treaty did.

RELATIONSHIP MODEL ADOPTED (user ruling 2026-07-17, ally doc
specs/leader-attributes.md — supersedes the bare reputation int):
per-pair state carries status (peace|war|ceasefire|treaty) + FOUR
integer values 0–100: TRUST (honors commitments → more trade,
fewer pre-emptive wars), FEAR (military danger → defense,
appeasement), GRIEVANCE (hostile acts → demands, war likelihood),
RESPECT (competence → serious offers) — "a weak but trustworthy
neighbor is treated differently from a powerful treacherous one".
Plus situational derived inputs (borderPressure, militaryBalance,
tradeValue) and cooldown turns (lastDemandTurn etc.). Decisions =
SCORE MODELS over personality axes + relationship values (the
ally's scoreWarIntent shape; constants in rules.json). MVP action
set = first contact, war/peace, tribute demand, fixed-duration
treaty/ceasefire, betrayal memory, peace offer, tech exchange —
alliance blocs/espionage/multi-party DEFERRED. Event→dialogue:
the sim resolves everything (dialogueKey + stance + variables in
the pushed event); clients ONLY render. Dialogue templates
per-STANCE with {leader}/{civ}/{demand}/{tech}/{offer}/{reason}
interpolation; per-leader text = a later cosmetic layer. The
ally's diplomacy metrics table + map-class segmentation gate the
tuning (A82 map types before diplomacy tuning). All relationship
values INTEGERS (the ally's floats adapted — state bans floats).

ALLY ROUND-6 REQUIREMENT (2026-07-16, adopted): a PERSISTENT
diplomatic summary — never state hidden inside audience dialogue
text alone — carrying per pair: relationship state (peace / war /
alliance / treaty / ceasefire), start turn+year, the triggering
event, known reputation consequences, active demands or tribute,
treaty duration/expiry, and senate restrictions where relevant.
Audience dialogue is flavor over this mechanical record.

## 1. Scope (classic Civ 1)

War/peace states per civ pair; AI-initiated audiences (tribute
demands, peace offers); player-initiated contact; TECH EXCHANGE as
a negotiation chip; embassies for intel. No alliances/ceasefire
tiers in v1 (noted as a later slice); no diplomacy for barbarians/
rebels, ever.

## 2. The state model (engine — golden windows apply)

- `state.relations` — per unordered civ-pair: `war | peace`
  (strings), plus `treatyTurn` (when the current state began).
  Default remains WAR (today's permanent-war rule is the absence of
  a peace treaty, reframed).
- `state.players[pid].reputation` — integer standing (starts clean;
  breaking peace decrements; honored long treaties slowly recover).
- Embassy: `players[pid].embassies` — list of civ ids where an
  embassy exists (established by a treaty clause or a Diplomat unit
  when A71's audit activates it).
- ALL state additions are plain data; every change flows through
  commands in the log — negotiations replay like everything else.

## 3. Commands

`{type:'diplomacy', kind:'offer'|'accept'|'reject'|'demand'|'declare',
 playerId, target, terms}` — terms is a plain object (peace,
tribute gold N, tech id exchange). The engine validates
(adjacency-of-knowledge: you can only contact civs you've MET —
first-contact events already exist), applies state changes, and
emits events (filtered per B5's coord-or-named-party rule: parties
hear details, the world hears headlines like "Rome and Egypt sign
peace").

### 3a. Deterministic diplomacy EVENTS (ally-specified shapes, 2026-07-17)

Every command emits a typed, saved, replayed event — included in
canonical state where it affects outcomes, and rendered IDENTICALLY on
browser and Roblox clients. The v1 event set (all fields plain data,
`turn` stamped by the engine):
```
{ type:'FIRST_CONTACT',       fromCivId, toCivId, turn }
{ type:'WAR_DECLARED',        attackerCivId, defenderCivId, turn, reason }
{ type:'PEACE_TREATY_SIGNED', civAId, civBId, turn, expiresTurn }
{ type:'TREATY_BROKEN',       breakerCivId, injuredCivId, turn, penalty }
```
`reason` is an enum (e.g. `border_pressure`), `penalty` an enum (e.g.
`reputation_loss`). These are exactly the events the audience panel and
turn log read from — see the legibility bar in §5.

**MVP scope confirmed (ally, 2026-07-17): ship the first slice NARROW**
— first contact; war/peace state; war start turn + reason; fixed-duration
treaty/ceasefire; betrayal event + remembered reputation cost; tribute
demand; senate-forced peace where government requires it; the audience
panel with the five authored stance voices. Do NOT begin with alliances,
complex trade bundles, espionage, shared maps, or multi-party blocs
(later slices). The player-facing acceptance test (§5) is the bar.

## 4. The AI across the table (A59 is the prerequisite)

AI responses are DETERMINISTIC functions of: its leader stance
(aggressive leaders demand more, accept less), the military balance
it can SEE (its knowledge, fog-honest — the B13/A63 best-seen-tier
model), its wars in progress, the offerer's REPUTATION, and rng
drawn from the game stream (a small honest wobble, in call-order
discipline). Aggressive+strong ⇒ demands tribute; losing a war ⇒
sues for peace; treacherous rivals get worse terms. Every branch is
a table-driven policy (data/rules.json diplomacy weights) — tunable
without code, measured in soak (new M-columns: treaties signed,
wars declared, tribute flows; personality signatures apply —
Gandhi signs peace, Shaka doesn't).

## 5. The audience (UI — the user's both-mode ruling)

- AI-INITIATED contact interrupts as a MODAL audience: the leader's
  name, civ, stance ("Caesar of the Romans — aggressive"), their
  message in plain words, response buttons. The A59 faces make this
  the game's most personal screen; the Roblox client stages it
  theatrically later (docs/13 Tier 3+).
- ONGOING STATUS lives inline: a relations line on the score-hover
  (at war ⚔ / at peace 🕊 since turn N), treaty events in the turn
  log, and the historian's report (A75) gains a relations column.
- Player-initiated contact: a "parley" action from the score line
  or an embassy panel.

## 6. Consequences (reputation + senate, the user's full loop)

- BREAKING peace (declaring war while a treaty stands): reputation
  drops, every AI leader remembers (they see the event as world
  news), future terms worsen — cowards and traitors pay.
- THE SENATE (Civ 1 authentic): under Republic/Democracy, your
  senate may FORCE acceptance of reasonable peace offers and may
  refuse aggressive war declarations (exact rules from the wiki
  extract at build time). War-weariness already exists; the senate
  is its political voice. This makes government choice strategic
  exactly as in 1991: despots do what they want.

## 7. Humans at the table (LAN)

Humans send the SAME diplomacy commands through a small treaty UI
(offer peace / demand / propose tech exchange); the engine enforces
resulting states for humans exactly as for AI (attacking under
peace = the treaty-breaking consequence applies to you too). Chat
carries the haggling; the treaty makes it real; the recording
captures the drama — a betrayal is replayable evidence. Offers to
ABSENT/regent seats: the regent answers with the AI policy in the
seat's leader character (the regency pattern extends naturally).

## 8. Slices and gates

1. **D1 — states + declare/offer/accept peace** (engine + fixtures
   first; golden window; scenario 012-diplomacy pins it). Senate
   NOT yet; reputation field exists but only records.
2. **D2 — the audience UI** (modal + inline status; golden-safe
   client) + human treaty UI.
3. **D3 — AI negotiation policy** (table-driven, personality-aware;
   window; soak M-columns + signature checks).
4. **D4 — tribute + tech exchange terms** (window).
5. **D5 — reputation consequences + the senate** (window; wiki
   verifies senate rules).
6. **D6 — embassies + intel** (pairs with the Diplomat unit's
   activation from A71 if ruled in).
ACCEPTANCE (the phase-2 debt): a playtest where the user can answer,
at any moment and for every civ, "are we at war, since when, and
why" — plus one full negotiated peace, one betrayal with visible
consequences, and one senate intervention, all legible from the UI
alone. Deterministic throughout: the whole drama replays hash-exact.

## 9. Dependencies

A59 (leaders/stances — the faces and the policy axes) → B13/A63's
knowledge model (what the AI can SEE informs what it accepts) →
then D1. The resource-chains shelf item (Civ4-style) gains its
diplomatic meaning here later: supply lines become things wars are
ABOUT — deliberately deferred until diplomacy stands.
