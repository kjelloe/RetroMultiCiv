# RetroMultiCiv — the v2.0-or-later shelf

_LIVING DOCUMENT, deliberately looser than `plan-version1.md`: an unordered
holding list of everything explicitly designated post-1.0, so nothing is
lost and nothing sneaks into the v1 critical path. An item leaves this file
only by a user ruling. Last updated: 2026-07-27 (2nd pass — TWO items
LEFT the shelf by user ruling: novelty map SHAPES → v1 as W7
[toroidal wrap stays here] and the unit-doctrine ECON PAIR → v1 as W8
[nukes + counter-espionage stay]; GHCR image → release-checklist step
4b. Earlier same day: unit-doctrine section added; HTML twin
`plan-version2.html` added)._

Provenance tags follow the civ-mixing ruling: `Civ1-authentic` /
`Civ2-shape` / `Civ4-shape` / `original`.

## The user-ruled v2 shelf (docs/03 § "The 1.0 definition", 2026-07-16)

- **Dedicated mobile UI** — a real touch-first interface, beyond the XIV
  UX fixes (arrow overlay, pinch fix, gesture legend) that ship in v1.
- **Civ4-style culture** — culture points/borders; v1 keeps Civ 1 fixed
  city radii. (`Civ4-shape`; the on-map fat-cross display is v1-adjacent,
  formal culture borders are here.)
- ~~**Novelty map shapes**~~ — **LEFT THE SHELF (user ruling
  2026-07-27): promoted to v1 as W7** (`specs/map-shapes-w7.md`:
  fractal/oval/ring/inland-sea/clover, one additive window). What
  REMAINS here: **toroidal wrap** (Y-wrap — touches all distance/BFS
  math, mapgen poles, fog, minimap, renderer, AI pathing + the full
  Luau twin; deep window, deferred) and any shapes beyond the W7 five
  (spiral/mirror worlds).
- **Checkpointed save format** — periodic state snapshots inside the save so
  very long games load/replay without full command-log re-derivation.
- **Blender/glTF fidelity pass** — replace procedural primitives with a real
  mesh pipeline where fidelity demands (the A88 "option B" branch).

## Parked with explicit user interest

- **Richer anarchy/revolution/civics system** (`Civ4-shape`; docs/01
  "PARKED (game-v2)") — the user flagged explicit interest; currently
  governments are Civ 1-faithful with simplified anarchy.
- **AI conquest victory-drive slice** — XII.5 shipped the SPACE drive; a
  matching late-game conquest commitment (armies, siege doctrine, docs/15)
  was deliberately not bundled ("conquest is a LATER slice").
- **Seam ghost columns** (A85, renderer polish) — user pick: "LATER, behind
  the AI program".

## Deferred from the Phase 6+ ledger (docs/03) not covered by the v1 cut

- ~~**Diplomat unit espionage**~~ — SHIPPED in D6 (marker-0104):
  establishEmbassy / stealTech / sabotage / inciteRevolt / bribeUnit in
  `engine/diplomat-missions.js`. No longer deferred. (discovered-sabotage
  + investigateCity are the remaining pieces, in the architect's diplomacy
  window — see `plan-version1.md`.)
- **Simultaneous turns / turn timer for multiplayer** — v1 multiplayer stays
  sequential with skip-vote/regency/auto-takeover.
- **On-map city radius display → formal borders** — the fat-cross overlay may
  land as v1 polish; anything border-like is v2 culture territory.
- **Globe view / water shaders / renderer luxuries** — superseded in v1 by
  the staged asset plan; revisit after the glTF decision.

## Operational / infrastructure v2

- **Master-index v2 concerns** (docs/12): abuse-report path for listed
  servers; TLS on the index itself (v1 rides plain HTTP behind the alias);
  federation/multiple indexes if the community ever warrants it.
- **Nightly self-check mail integration** (A96 leftover) — outbound
  notification needs an outbound-dependency decision; deliberately unbuilt.
- ~~**GHCR prebuilt Docker image**~~ — **LEFT THE SHELF (user ruling
  2026-07-27): now release-checklist step 4b** (flip `PUBLISH_GHCR`
  + one verified run at RC; `specs/v1-release-checklist.md`).
- **In-client bug-report v2** — v1 ships write-only file drops; triage
  tooling / dedup / a reader UI would be v2 (`debugging/triage.sh` covers
  the operator side for now).

## Candidate pool (raised once, no ruling yet — loosest tier)

- Progressive settler food upkeep (first-N-free variant, under measurement).
- Barbarian leader ransom variants beyond the A4-bundled gold ransom.
- Scenario/custom-game editor beyond `?debug=1` spawn tooling.
- Hall-of-fame / persistent score ledger across games on a host.
- Spectator quality-of-life (timeline scrubbing on live games — replay
  theater exists for recordings).

_Everything else that looks "missing" is either in `plan-version1.md` (the
1.0 tree) or already shipped — check the engine before re-adding here._

## Civ 2 ruleset option (seeded 2026-07-21, user disposition of XIV §39)

A future GAME OPTION collecting the deliberately-rejected `Civ2-shape`
mixes into a selectable ruleset variant (setup toggle / rulesOverrides
preset), rather than losing them: post-conquest civil disorder (§39 —
fact-checked as Civ2+, ruled out of the Civ1 default), Lighthouse-saves-
triremes (the #1976 drift catch), partisans/guerrillas, and whatever later
audits reject-as-drift. Each entry arrives here already fact-checked and
labeled — the option becomes buildable almost for free once enough
accumulate (the engine already supports rulesOverrides presets).

## Auto-explore unit action (seeded 2026-07-22, USER-RULED into v2)

`Civ2-shape` (auto-explore arrived with Civ2's unit-order set). A unit
action — for exploration-suited units (scout-role land units; possibly
ships) — that keeps the unit exploring unknown territory until fog is
gone, it is interrupted, or an enemy appears. Build lean: the CLIENT-
DRIVER pattern (like tech-beeline and the automate module — the client
walks a pure shared/ path-choice and issues NORMAL move commands), which
keeps it golden-neutral and Roblox-portable; the engine's own
`aiExploreMode: bfs` router (B23) is the obvious brain to share. Engine-
command variant only if the driver proves insufficient (that would be a
golden move). Interaction notes for the design pass: stop-on-hut vs
collect-huts choice, respect ZOC/trireme open-sea risk, d-pad/mobile
affordance, and the §31 off-turn order-queue composes with it.

## Cross-play bridge (seeded 2026-07-21, R6 ruling)

1.0 ships per-platform populations; the R6 seat model deliberately keeps a
hidden browser-compatible `seatCode` beside the Roblox UserId binding
(specs/r6-roblox-multiplayer.md), so an optional post-1.0 bridge (Roblox
clients on Node servers, or Roblox instances announcing to the master
index) is a transport + auth project, not a seat-model redesign.

## Negotiation layer — counter-offers (seeded 2026-07-21, ally D4 verdict)

1.0 diplomacy audiences are take-it-or-leave-it (Civ1-shaped, decisive).
A future `original` negotiation layer may add counter-offer rounds ONLY
with: full AI valuation transparency, multiplayer timing rules, and a
clear player reason to counter (ally conditions, verbatim in
specs/ally-design-response-2026-07-21-diplomacy.md §1).

## Public identity / rename (RE-RULED 2026-07-24 — supersedes the 07-21 five-candidate list)

Post-v1 program per the ally's 2026-07-24 ruling
(specs/ally-response-2026-07-24-naming-release.md): **A World Begun**
(lead) / **The Work of Ages** (backup), both pending the PROFESSIONAL
trademark search (user gate); Founders retired as a TITLE but
sanctioned in-product (Founding Age era label, Founder's Record =
the replay/history interface). Reserve aworldbegun.eu/.com/.no during
clearance; rename lands as a 1.y display/config/DNS event (format
identifiers never rename — runbook §8 boundary).

## Per-game takeover cap (seeded 2026-07-24, sec-reassess §7 residual — LOW)

`original`. Late-join takeover is rate-limited per IP globally, but no
per-IP-PER-GAME cap exists: a patient attacker could claim several AI
civs in ONE public game (civ-squatting; idle squatters degrade to
auto-regency, so no stall — grief only). Fix if grief proves real on
the live box: a small per-game takeover cap per IP. docs/16 §3
residual list carries the detail.

## Civ2+ water features — Whales, Coast terrain, ocean-travel gating (seeded 2026-07-24, friend-playtest wiki thread — DISCUSSION NOTES)

Surfaced when a wiki search mixed eras into the fish-resource report;
ruled OUT of v1 (Civ 1 has ONE Ocean terrain, Fish as its only water
special, no tech gate on ocean movement — our engine matches). Held
here per the civ-mixing ruling (surface + decide, label provenance):

- **Whales** (`Civ2-shape`): a SECOND water special (Civ2: +1 food
  +2 shield on ocean). Would be the first terrain with two special
  kinds → `tile.special` becomes typed (boolean → id), touching
  data/terrain.json shape, mapgen distribution, statehash surface,
  scenario fixtures, and the Luau twin — a golden-breaking engine
  window for one prop + yield row. Discussion: only worth it bundled
  with a broader "typed specials" refactor, never alone.
- **Coast vs Ocean terrain split** (`Civ2/3-shape`): shallow
  adjacent-to-land water as its own terrain (distinct yields;
  fishing-boat-style workability in later Civs). Would touch mapgen,
  terrain data, renderer TERRAIN table + coverage test, pathing
  (trireme coastal-hug already reads adjacency, not terrain), and
  every crafted fixture with water. Discussion: our trireme-class
  carrier-safe pathing already delivers the gameplay distinction
  (coastal hug vs open sea) without a terrain split — the split is
  mostly visual; a render-only "shallows tint" (the water plane
  already lightens ramped coasts) gets most of the look for free.
- **Ocean movement gated on a tech** (`Civ2+-shape`, e.g. Astronomy/
  Navigation): Civ 1 gates by HULL (trireme open-sea risk), not tech.
  Discussion: overlaps the existing seaPathRadius/open-sea-risk knobs;
  a tech gate would need AI beeline awareness (needsOcean-v2 already
  fog-honest) — engine window, low value while hull-gating works.

## AI unit-doctrine remainder (RE-RULED 2026-07-27: econ pair LEFT for v1)

Spec: `specs/unit-doctrine-v1x.md`. The ECON PAIR (offensive diplomat
doctrine §1 + caravan doctrine §2) was **promoted to v1 as W8** (user
ruling 2026-07-27, sequenced after W6 + W7). What REMAINS here:

- **Diplomat counter-espionage** (the §1 DEFENSIVE half):
  **fact-checked as `Civ2-shape`** (reviewer #2798: Civ 1 diplomats
  are offense-only; the compounding 20%/diplomat intercept is Civ 2)
  — enters via the civ-mixing ruling at its own window; user decides
  adoption alongside the existing Civ1 once-per-city immunity. NOT
  part of W8.
- **Nuke desperation/retaliation doctrine** (§3): first use gated on
  aggression + trailing rank + endgame proximity (2100 AD / spaceship
  launched); once nuked, the attacked civ retaliates at-will against
  the aggressor's cities or large stacks. Near-unobservable before
  the marathon measurements land — **stays v1.x pending the marathon
  lane (re-confirmed 2026-07-27)**.
