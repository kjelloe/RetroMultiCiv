# marker-0064 — D3 AI diplomacy negotiation (phase-2, swept PAT=30)

**Tag:** `marker-0064` → `87cfe3b`
**Class:** BEHAVIORAL — golden re-record (AI now negotiates; deterministic goldens moved).
**Breaking:** YES. Merging this changes late-game AI behaviour and moves the goldens.
This is the change flagged in the pre-tag alert; the user chose to tag it as a
separate marker (marker-0063 = the golden-neutral batch, non-breaking, mergeable
independently).

## What it delivers

D3 = the AI diplomacy negotiation policy (spec specs/d3-ai-diplomacy.md). The AI now
*issues* the D1 `diplomacy` command — declaring war, offering/accepting peace — driven
by a relationship model and personality (A59):
- **Relationship model** (engine/diplomacy.js + luau twin): directed trust/grievance
  (`_lo`/`_hi` on the sorted pair), fear/respect derived; `bumpRel`/`grievanceOf`/
  `trustOf`; per-turn decay.
- **Met-state + first contact** (the load-bearing gap D1 lacked): persistent `met`
  riding the pair entry + a FIRST_CONTACT event + a per-turn contact pass over every
  seat — this is what lets the (non-adjacent) space-launch coalition form.
- **Score models** (engine/ai-diplomacy.js + luau twin, NEW): `scoreWarIntent` /
  `scorePeaceAccept` over weakness/fear/border-pressure/grievance/launch.
- **The diplomacy step** (engine/ai.js): declare/offer/accept/reject, met-gated, in
  `pickCommand`'s done-map. **Attack-grievance** in combat.js. Contact pass + decay
  hooks in index.js.

## The swept constant (marker's substance)

`data/rules.json` `diplomacy.peaceAcceptThreshold: 30` (swept from a provisional 50;
#1762 sweep → #1764 ruling). The score identity `scorePeaceAccept = 50 - aggression`
at parity makes 30 a clean personality boundary — only `aggression < 20` negotiates
(peaceful leaders yes, balanced/aggressive no), a genuine peace-vs-war split.
`warIntentThreshold` stays 60; weights unchanged.

## Golden re-record (the moved pins)

Behavioral → the goldens moved. Final pins (bugfixer ledger #1822, all JS==Luau):
- **soak** {100:`0xd4c36480`, 200:`0xe5c5807c`, 300:`0x160827ea`, 400:`0xc7d89071`}
  (finalHash `0xc7d89071`); **natural** r395 / winner p2 / `0xef761753`; **turn-100**
  anchor `0xd4c36480`.
- **rulesetHash ripple** (createGame-derived pins move because PAT lives in
  `hashState(ruleset)`): scenario-002 `0x8dae6d03`; A82a continents `3132b03d` /
  pangaea `1592f59a` / archipelago `fc6fbf71` / islands `c2c332fc`; ff-parity
  `0x0971239f`. Scenarios 012/045 do NOT move (short scripts, civs never cross the
  aggression<20 boundary).

## Verification
- **Two-phase close:** byte-shaped JS==Luau; sim-runner constant sweep (#1762);
  ONE re-record at PAT=30.
- **Gate-B GREEN** (#1826): Luau full parity at soak 200/300/400 + natural + twins 9/9.
- **Full suite GREEN** on a clean-clone cherry-pick (sim-runner #1835): 633 tests /
  631 pass / 0 fail / 2 env-skip (the 10 prior expected-reds all green).
- **Bugfixer verified** `87cfe3b` == every pin (#1837); tree reconciled byte-identical;
  D3 footprint locks released.

## Floor note (ruled, not a blocker)
The canonical M2/M3/M4 soak floors breach at PAT=30 — but so does the accepted
phase-1 PAT=50 near-identically (M4 is actually better at PAT=30), and the definitive
no-D3 baseline (#1823) breaches them too. So the breach is a pre-existing AI-quality
property, NOT a phase-2 regression; the floors are advisory (H1b REPORT mode until the
AI B-lane closes M2/M3). Ruled cleared (#1814). The elim guardrail held (median 3.0,
PAT 50/30/25 identical).

## Provenance
The relationship/score model is house/original, Civ1-consistent (the wiki dump is
Civ1-silent on diplomacy — reviewer #1695). The mix-conditional elimination and the
space-launch-triggers-war coalition are the user's ruling (2026-07-18). D3 consumes
A59 (leader personality) — its first and reason-for-being consumer. Feeds D4
(tribute/tech terms) and D5 (senate/reputation). XII.5 (victory drive) makes the
space-launch coalition fire in ordinary games.

## Downstream
- roblox re-bake `ba884f7` (RulesetHashes + rules.luau mirror) sits above this
  commit — golden-neutral roblox-lane, not part of the marked commit.
- D3 opens the phase-6 diplomacy line; D4–D6 follow (docs/14).
