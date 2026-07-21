# v1.0 release runbook (user-ruled 2026-07-21; living doc alongside plan-version1)

The six content axes (docs/03 § "The 1.0 definition") gate WHAT ships; this
runbook rules HOW the release happens. Two user rulings anchor it:
**save-compat = CLEAN BREAK** and **the bar = sweeps + one public playtest
week**.

## 1. Save compatibility: clean break (ruled)

1.0 loads only 1.0-era saves. No migration shim, no compat layer — the
golden-re-record history has already made old saves hash-incompatible many
times over; a loader would promise what the engine's history can't keep.
Operationally, before the 1.0 deploy:
- Announce a finish-or-abandon window on the public server (in-game notice +
  the shareable blurb channels).
- The existing rotation archives whatever remains; `saves/` old-format files
  are ignored-not-crashed by the 1.0 server (already the "foreign files
  ignored" behavior — verify once in the RC gate).
- Replays/recordings: same rule; the drift warning already explains itself.

## 2. The tuning campaign (pre-RC gate; all sim-swept, no hand-picking)

Sweeps that must run GREEN before the RC marker, with their knobs:
1. Difficulty table (authentic modifiers — after the difficulty slice).
2. Treasury: aiBuyThreshold / aiSurplusBuyThreshold.
3. Escort: escortRadiusPct per stance; settlerPathRadius.
4. Diplomacy: offerCooldown / offerExpiryTurns; D4+ acceptance valuations.
5. Space project: spaceCommitTechGap + the 9-metric sweep verdict
   (accept/tune conversation closed).
6. triremeLossPct (provisional 50) — sweep for feel, or accept provisional
   with a labeled note.
7. Advisory-floor RE-BASELINE (post-§40 authentic game) + settler-timing
   question resolved (measured: ~5 median cities vs build-at-pop-3 variant).
8. Calendar feel: one full 545t human-paced playtest signoff (subjective,
   the playtest week covers it).

## 3. The release sequence

1. All six axes report DONE in plan-version1 (each verified vs the engine).
2. Tuning campaign (above) green → docs/16 SECURITY RE-ASSESSMENT (the
   standing pre-master-index gate: A50-remainder landed, deploy hygiene,
   bug-report surface, master abuse posture).
3. Tag **marker-RC1** (merge-consistent, declared the RC). Deploy to the
   public box. Master index goes LIVE: user schedules DNS; the in-client
   "Find game" browser points at it.
4. **One public playtest week** on RC1: the bug-report route + Shift+D
   recordings are the funnel; S1-severity = fix + new RC; S2/S3 → the
   post-1.0 queue.
5. No S1 findings outstanding → tag **v1.0.0** (annotated tag on the RC
   commit; marker numbering continues independently). Update README +
   how-to-host (drop "test server" framing), the ally gets the release
   note, the blurb goes wherever Kjell shares it.
6. Post-release: plan-version2 becomes the working shelf; the nightly lanes
   (soak, playwright A49) keep running against v1.0.0 as the new baseline.

## 4. Version + branch mechanics

- dev_night remains the working branch; markers continue as-is.
- v1.0.0 = an annotated tag the USER creates on dev/main after merging the
  RC-final marker (tags on dev/main stay user-owned, marker tags stay
  architect-owned — the standing split).
- Hotfixes post-1.0: normal marker flow + a v1.0.x tag by the user.

## 5. Open items feeding this runbook (tracked elsewhere)

Naval-loop measurement (probe queued to sim-runner after its stack) → maybe
one behavioral slice; A49 playwright scope spec + A58 pedia acceptance spec
(architect drafts); D4–D6 build (engine lane, specs ready); the client
polish tail (helper queue); Roblox certification + Studded round-2 (user
review gates); ally advisor copy (after components).
