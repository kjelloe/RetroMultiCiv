# marker-0051 — government re-eval (the payback lever)

## What it delivers

The N9-cluster's single biggest lever, measured before designed:
sim-runner's payback study (#1315) showed buildings pay back in 80
turns to NEVER under Monarchy's trade, and no AI ever advanced past
Monarchy — two gaps reinforcing (no Republic → buildings never pay →
the economy never grows). The user's own LAN save (benchmark #1,
all-Monarchy at 1775 AD, zero buildings) is the field confirmation.

This window makes government adoption stance-linked and heterogeneous
(the archetype direction): `STANCES` gains `govTarget` — builder and
the regency stances (defensive/science/growth) adopt Republic
unconditionally when known; balanced adopts `republic-if-safe` (a
fog-honest `govSafe` check — no visible enemy within threatRadius of
any own city, reusing enemyNear); a future aggressive stance holds
Monarchy explicitly. A monotonic `GOV_RANK` ladder means a revolt only
ever moves UP — no republic↔monarchy thrash. The old one-shot Monarchy
rush survives as the early/back-compat case. Democracy stays deferred
to phase 6 (the senate constraint — which the wiki says binds REPUBLIC
too — is forward-flagged in the spec and docs/14 for the D-family).

## Scope and provenance

engine/ai.js + luau/ai.luau only; byte-shaped twins. NO rules.json
edit → rulesetHash unchanged, A82a map-type anchors + scenario 002
untouched. The government VALUES were reviewer-verified
Civ1-authentic against the wiki table (all five Republic fields
match); the adoption RULE is original, Civ1-consistent (the wiki is
silent on Civ1's AI government behavior).

## Pins and goldens

- Scenario 030-government-reeval pinned cross-language: 0xf88bcf48
  (setGovernment republic → 2-turn anarchy → Republic active). PORTED
  count 29.
- Goldens: Republic is a mid-late tech, so ONLY turn-400 + natural
  moved — soak checkpoint400/finalHash 0xeada3062 → 0x4931f27c,
  natural 0xd0ad44b2 → 0x1502fc5c. Checkpoints 100/200/300, the
  luau-twins turn-100 anchor, and the witness are UNCHANGED (the
  honest signature of a late-game-only behavior change). JS==Luau
  verified on both moved goldens via lune.
- test/ai.test.js +6 cases (adopt-under-threat, hold-with-enemy-near,
  adopt-when-safe, aggressive tops at Monarchy, no backward revolt,
  Republic-unknown back-compat).

## Test state

Full suite 512/512 (0 fail, 0 skip) on the marker commit; count pins
re-synced at this boundary (README/plan-update/agent-workitems
506→512).

## Also at this boundary (since marker-0050)

S1 voluntary match reports (c062d58): `--share-reports` writer on the
maintenance sweep, anonymized with REGENERATED hashes so every report
replays clean under its own code, lobby notice + sticky per-seat veto
via a new reportVeto frame, keep-200 rotation. Roblox batch-2
(e3e3996, gaming-PC commit): R24 starting-age stepper + R24b full
host-options parity + R25 catalog first pass (16 PRESENT / 9 PARTIAL /
9 MISSING / 4 N-A / 4 DEFERRED), luau/fastforward.luau twin with
ff-parity 0x833b415c pinned both engines.

## Follow-up measurement (not a marker gate)

The acceptance gate runs on the shipped code (sim-runner): governments
ADVANCE in the soak, buildings get BUILT and PAY BACK (marketplace/
library under ~40t at pop 6+ under Republic trade), elim median holds
20-40 at dg=30, M2/M3/M4 floors move. The pre-change baseline is
frozen from pre-marker code per task #1354. Results arrive as a
validation report; the deterministic 512/512 + JS==Luau gate the
marker itself.
