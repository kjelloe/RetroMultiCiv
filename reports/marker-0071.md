# marker-0071 — §13 regency/AI deficit economics (MERGE-CONSISTENT)

Tagged at `59168e1` (2026-07-21). **MERGE-CONSISTENT — supersedes 0070.**
Window 1 of the three-window XIV-AI sequence (#1989).

## What changed

The deficit ladder (engine/ai.js + luau/ai.luau, all stances incl. regency):
when net income < 0 AND gold is under the cushion, the AI/regent climbs —
(1) shift tax from science (capped at the point the empire stays
disorder-free — the "(b)-lite" ruling), (2) convert citizens to taxmen,
(3) switch government — one rung per turn, before disorder is ever allowed
to bite. Fixes the playtest complaint "regency sits at 0 gold in civil
disorder" (XIV §13). Knobs in data/rules.json: deficitGoldCushion=3,
taxBumpStep=10 — sim-sweepable, not hand-tuned. Full happiness management
is explicitly OUT of scope (later item). Failing-test-first: the acceptance
test existed red before the engine changed.

## Gates

- Author (#1998/#2000): ai.test 27/27; luau-twins 9/9 bit-exact; 4-seed
  M-floor soak clean; behavioral drift clean (rounds unchanged,
  deterministic).
- Sim-runner Gate-B (#2008): GREEN — heavy Luau 200/300/400/natural +
  --enforce-floors; soak400 0x371d905a, natural 545 rounds / winner p2 /
  0xc08a69bc, cross-engine bit-exact.
- Reviewer clean-clone + engine-diff (#2003, transfer #2012): GREEN —
  668/664, containment verified (only deficit civs change behavior);
  d501ece..59168e1 delta docs-only, green transfers.
- M2/M3/M4 aspirational-floor note: PRE-EXISTING marker-0066 state
  (6.5/34/63.25 matches the parent), NOT a §13 regression — concurred by
  sim-runner + reviewer.

## Also since 0070's tag point

Docs/specs only under this tag (XIV batches 3–4 triage, §45 Teotihuacan
debug spec, §46, ally space-AI capture, anti-stale-idle agent-mail
mechanics rode earlier commits). The roblox Tier-B panel + gate-4 re-bake
(`4d7e235`/`fcc8a66`) landed on origin AFTER this tag point and ride
marker-0072.

## Test state

668/664 at the reviewer's clean clone; local known flakes only (B13
gitignored recording, SIGTERM isolated-pass, A46 isolated-pass).

## Breaking notes

None for players/operators. For agents: §13 locks release at this tag;
window 2 (§14 treasury — proactive rush-buy layer, parts-rush excluded
until XII.5b) opens at the bugfixer.
