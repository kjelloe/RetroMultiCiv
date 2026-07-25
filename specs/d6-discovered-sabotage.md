# D6 discovered-sabotage — design (user-ruled 2026-07-25)

The last open D6 piece. A small ENGINE golden window (architect-executed) completing
the diplomat-mission set. Grounded in the shipped D5/D6 code:
`engine/diplomat-missions.js` (rolls via `rollRange(state.rngState, 100)`),
`engine/diplomacy.js` (`reputationOf` global 0..repMax band + REPUTATION_SHIFT +
recovery clock; `grievanceOf` bilateral in `state.relations`).

## Mechanic
The two COVERT missions — **steal-tech** and **sabotage** — get a DISCOVERY roll after
they resolve. Incite Revolt / Bribe are inherently overt (the city/unit visibly flips)
so they take NO discovery roll.

On DISCOVERY, the act is traced to the perpetrator and fires BOTH fallout channels
(user ruling: both):
- **Reputation (global, D5):** bump the perpetrator's `reputation` toward Treacherous
  reusing the treaty-break machinery — clamp to repMax, emit REPUTATION_SHIFT, RESET the
  recovery clock (heals later via processReputation). Global: everyone who reads
  reputation sees it.
- **Grievance (bilateral):** increment the victim→perpetrator grievance in
  `state.relations` → the victim's AI is more likely to declare war / refuse peace
  (ai-diplomacy reads grievanceOf).
- **Event:** a discovery event to the victim (e.g. "Egypt's diplomat was caught
  sabotaging Thebes!"); the global REPUTATION_SHIFT rides it. New catalog row
  (classify + sound + turnlog class).

## Discovery odds — BOTCH-AMPLIFIED (user ruling)
A FAILED mission is more likely traced than a successful one. Two rules.json knobs
(NOT hardcoded — `data/rules.json`, the D6 knob group):
- `discoveryPctOnSuccess` — default ~34 (clean job, lower trace chance).
- `discoveryPctOnFail` — default ~67 (botched job leaves evidence).
Roll: after the existing success roll resolves, one more `rollRange(state.rngState, 100)`;
compare to the success/fail knob. Deterministic, threaded through rngState like the
success rolls. Values are the tuning surface — sim-runner can sweep them if desired, but
AI never issues missions so they don't move sim goldens.

## Golden impact
- BEHAVIORAL for scenario 065 (the missions scenario) — the steal/sabotage now roll
  discovery → reputation/grievance state changes → 065 final hash MOVES. Honest re-record
  (fixture-FIRST: add the discovery cases to 065 / a new scenario BEFORE the engine change),
  paste-back the new cross-language pin, twins JS==Luau.
- GOLDEN-NEUTRAL for the sim goldens (sim-smoke/natural): AI never issues diplomat
  missions, so the discovery path is dormant at the soak seeds — verify STAMP-identical.
- Files: engine/diplomat-missions.js + engine/diplomacy.js (reputation/grievance feed) +
  luau twins + data/rules.json (2 knobs) + test/scenarios/065 (or a new 066) +
  test/diplomat-missions.test.js (discovery cases: caught-on-fail, clean-on-success,
  reputation bump, grievance rise, victim event) + event-catalog + client turnlog/sound
  for the new event.

## Sequencing / lane
Architect-executed, small window. Order: investigateCity commits first (reviewer gate
#2680) → discovered-sabotage → then the build-doctrine window (larger, different module).
Full golden discipline: fixture-first, twins byte-shaped, reviewer engine-diff gate +
sim-runner STAMP-verify sweep before the marker. bugfixer stays on mobile-session-3.

## Optional extension (NOT ruled — deferred unless user folds it in)
Incite Revolt / Bribe are overt; they could carry an AUTOMATIC (non-rolled) grievance
since the victim plainly knows who flipped their city/unit. Not in this window unless the
user says so — flagged for a later call.
