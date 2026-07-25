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

**W5 — Re-home provenance relabel.** `engine/movement.js:245` comment "Civ 1" → "Civ2-shape"
(the codebase's mixing-ruling convention). Comment-only, golden-neutral — fold into whichever
window touches movement.js, or a trivial standalone.

**W6 — build-doctrine (the big one, 5 slices).** `specs/build-doctrine-plan.md`. Happiness-
first. This ACTIVATES buildings across the AI, so the sim goldens re-record here WITH the
W2/W4 effects live — hence build-doctrine goes LAST. Clears the M3-pop advisory (re-ratchet
in-commit). Multi-slice, days of golden work.

## Resourcing note
This is ~6 windows solo (W6 alone is 5 slices). Golden windows serialize on the lock, but
the CLIENT halves (mission menus, WLTKD/celebration UI, building-effect blurbs) and the
independent golden-neutral modules could be parallelized by a second lane. Flagged to the
user: accept the serial architect pace, or reactivate helper / redirect bugfixer post-mobile.
