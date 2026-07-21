# RetroMultiCiv — the v2.0-or-later shelf

_LIVING DOCUMENT, deliberately looser than `plan-version1.md`: an unordered
holding list of everything explicitly designated post-1.0, so nothing is
lost and nothing sneaks into the v1 critical path. An item leaves this file
only by a user ruling. Last updated: 2026-07-20._

Provenance tags follow the civ-mixing ruling: `Civ1-authentic` /
`Civ2-shape` / `Civ4-shape` / `original`.

## The user-ruled v2 shelf (docs/03 § "The 1.0 definition", 2026-07-16)

- **Dedicated mobile UI** — a real touch-first interface, beyond the XIV
  UX fixes (arrow overlay, pinch fix, gesture legend) that ship in v1.
- **Civ4-style culture** — culture points/borders; v1 keeps Civ 1 fixed
  city radii. (`Civ4-shape`; the on-map fat-cross display is v1-adjacent,
  formal culture borders are here.)
- **Novelty map shapes** — donut/spiral/mirror worlds beyond A82's
  Continents/Pangaea/Archipelago.
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

- **Diplomat unit espionage** — the unit exists in `data/units.json`; active
  espionage missions (steal tech, incite revolt, sabotage) are not built.
  (`Civ1-authentic` when picked up.)
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
- **GHCR prebuilt Docker image** — workflow exists, publish job gated on the
  repo owner opting in (`PUBLISH_GHCR` repo var).
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

## Cross-play bridge (seeded 2026-07-21, R6 ruling)

1.0 ships per-platform populations; the R6 seat model deliberately keeps a
hidden browser-compatible `seatCode` beside the Roblox UserId binding
(specs/r6-roblox-multiplayer.md), so an optional post-1.0 bridge (Roblox
clients on Node servers, or Roblox instances announcing to the master
index) is a transport + auth project, not a seat-model redesign.
