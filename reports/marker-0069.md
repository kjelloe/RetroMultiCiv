# marker-0069 — XII.5 core fix landed + goldens re-recorded (MERGE-CONSISTENT)

Tagged at `f9e25d2` (2026-07-20 late). **MERGE-CONSISTENT — this supersedes
0067 and 0068 and is the latest marker the user should merge.** The golden
window that kept 0068 unmergeable is CLOSED: Gate-B heavy Luau green
(#1945: 200/300/400/natural + twins 9/9) and the reviewer clean-clone +
engine-diff gate green (#1944), with the SHA-transfer note (#1946)
confirming both greens hold at this tip (925677e..f9e25d2 adds only
hooks/skills/docs, no game code).

## Headline

The XII.5 space-drive CORE FIX is on the mainline: an eligible AI civ now
builds the Apollo Program and spaceship parts instead of idling (the
baseline 0/12 defect, closed and witnessed — Apollo built vs 0/42 baseline,
zero economic regression, JS==Luau). Its goldens are re-recorded: 13 pin
swaps across `test/scenarios/002`, `test/simulation.test.js` (100/200/300/
400 + final + natural), `test/luau-twins.test.js` (turn-100, A82a presets,
ff-parity) — a pure rulesetHash ripple: natural-run rounds (395) and winner
(p2) UNCHANGED; crafted/early scenarios byte-identical (the
golden-neutrality guard held).

Known limitation, by design (specs/xii5-ai-victory-drive.md §11): the drive
is not OBSERVABLE in a normal-length game — research pace never reaches the
46-tech space closure by turn 395. That is what marker N+1 (calendar-545)
addresses; the accept was ruled on that basis (#1930), not oversold.

## Also under this tag (since 0068's tag point)

- The OOM fix (slices 1+2a) and A101 operator-caps — 0068's content, now
  mergeable as part of this consistent tip.
- XIV first deliveries (`f7b52e2`): bare-`/client/` → `?server=1` redirect
  (`?local=1` escape), endscreen fog-guard (`score-view.js` shim, all four
  score callers), in-client bug report (🐞 dialog + write-only opt-in
  `--bug-reports` route with 404/413/429 guards).
- A102 server CLI guards: `--public-addr` scheme rejection at boot; `--help`.
- Living plan docs `plan-version1.md` / `plan-version2.md` + CLAUDE.md
  per-marker refresh rule; `/marker` `/sync-pass` `/status-report` skills;
  the extended agent-mail send-guard hook (heredoc/echo-pipe/backtick-$/
  multi-line inline bodies denied; 16-case matrix green).
- Roblox: gate-4 re-bake (victoryDrive mirror) + Studded/Brick style spec
  and first implementation (awaiting user Studio review).
- Docs: Refinement XIV triage spec, ally design package (verbatim), deploy
  troubleshooting, agent-mail subject convention + hub reboot recovery.

## Test state at the tag

Full suite 662/663 locally; the single red is a LOCAL gitignored B13
witness recording (stale rulesetHash) that self-skips on clean clones —
reviewer's clean-clone run is fully green. luau-twins 9/9 (JS==Luau),
simulation double-run determinism green.

## Breaking notes

None for players or operators. Save compatibility graceful (OOM sidecar);
no protocol change. For AGENTS: the six XII.5 locks release at this tag;
hardening slice 2b (engine/ai.js + luau/ai.luau region) unblocks; the
bugfixer re-acquires only the calendar-545 subset (data/rules.json +
year/simulation/luau-twins tests + scenarios) and opens marker N+1.
