# v1 engine program — ordered backlog (architect-executed)

The remaining v1 ENGINE work, all architect-executed (bugfixer on mobile-session-3,
helper stopped). Golden windows SERIALIZE (one lock-holder, JS+Luau twins re-recorded
together). Ordered so the golden-NEUTRAL-at-current-sim-seeds adds land first (the AI
builds ~0 buildings + never issues missions today, so these are dormant at the soak
seeds), and the big BEHAVIORAL window (build-doctrine, which activates buildings + the
new effects) lands LAST so its re-record bakes in everything live.

All windows: fixture-FIRST, engine/*.js + byte-shaped luau twin together, honest
re-record classified, COMMIT+PUSH to dev_night, THEN reviewer gate on the pushed sha
(reviewer re-derives via lune — it needs the code in git), then sim-runner STAMP/sweep,
then marker. Ruleset numbers in data/*.json.

## Order

**W1 — Diplomacy window (D6 completion).** investigateCity (re-apply bugfixer's parked
patch; read-only peek, 065 hash stays 0xea7216fc) + discovered-sabotage
(`specs/d6-discovered-sabotage.md`: botch-amplified discovery odds, reputation+grievance
fallout — behavioral 065 re-record, sim-golden-neutral). Same module, one window.

**W2 — Inert building effects (audit #2/#3).** Wire Mfg. Plant (+100% production, obsoletes
Factory) into `engine/cities.js cityShieldOutput`; wire SDI Defense (nuclear counter) into
the `engine/combat.js` nuke-blast path. Both dormant at sim seeds (AI builds ~0) → expect
sim-golden-neutral; scenario tests prove the effect. data/buildings.json effect fields.

**W3 — Score happy-citizen term (audit #5).** Add happyCitizens (+ pollution penalty) to
`engine/score.js` scoreBreakdown per spec §10. Verify score isn't hashed (likely
golden-neutral); if it feeds victory/AI, classify honestly.

**W4 — We Love the King Day (audit #1).** Celebration bonus (spec §4.4): happy ≥ half and
no unhappy ⇒ celebration (corruption/trade bonus). `engine/happiness.js` already computes
happy citizens. NEEDS a golden check FIRST — if any AI city already meets the threshold at
the soak seeds this is BEHAVIORAL (moves sim goldens); measure fixture-first.
**DONE 2026-07-25, landed @b813bbc** (design specs/w4-wltkd.md, effect user-ruled
Civ1-faithful — no rapture). Classification: **BEHAVIORAL**, doubly verified (null-and-run:
BEHAVIOR_SOAK 200–400 moved, t100 held → first soak celebration lands t100–200; sim-runner
probe #2746: 8.7% of AI city-turns celebrate-eligible, 25/25 seeds — small despotism/
monarchy cities qualify via the content allowance despite 0 happiness buildings). Natural
golden rounds 545→365, winner p2→p3 by conquest (butterfly; 25-seed distribution sweep is
the gate). Scenario 067 pin 0x56151fa5 JS==Luau; events cityCelebrating/-Ended fully
covered. Gates queued on b813bbc (sim-runner sweep + Gate B; reviewer engine-diff) →
marker-0107.

**W5 — Re-home provenance relabel.** `engine/movement.js:245` comment "Civ 1" → "Civ2-shape"
(the codebase's mixing-ruling convention). Comment-only, golden-neutral — fold into whichever
window touches movement.js, or a trivial standalone.

**W6 — build-doctrine (the big one, 5 slices).** `specs/build-doctrine-plan.md`. Happiness-
first. This ACTIVATES buildings across the AI, so the sim goldens re-record here WITH the
W2/W4 effects live — hence build-doctrine goes LAST. Clears the M3-pop advisory (re-ratchet
in-commit). Multi-slice, days of golden work.

## Resourcing (RE-RULED — user 2026-07-25, v1 acceleration: reactivate helper + parallelize)
- **W1 → bugfixer NOW** (pivoted off mobile #2695; helper took the mobile remainder). Re-
  records only the 065 SCENARIO golden. Diplomacy expert + holds the investigateCity patch.
- **W2–W6 → architect**, starting W2 (Mfg. Plant/SDI) concurrently. W1 (diplomat-missions.js
  + diplomacy.js + 065 + rules.json) and my windows (cities/combat/score + buildings.json +
  sim goldens) touch DIFFERENT files + different goldens, so they run in PARALLEL with a
  file-lock deconflict; one re-record at a time on any shared golden.
- **mobile-session-3 remainder → helper** (reactivated, #2696). Golden-neutral client.
- Two parallel engine tracks + the user gates (Studio session + roblox/** Write allowlist,
  user-owned) is the accelerated shape.
