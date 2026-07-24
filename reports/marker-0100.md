# marker-0100 — refinement-XVII complete (consistency PENDING the clean-clone gate)

Tagged at `e00be57` (2026-07-25, the 7-hour away window). Branch-gate
green (#2475, thorough: join-path ordering verified — reconnect
reclaims before the closed-gate, AI-fill reached only when open,
host-only toggle); 81/81 local verify at the merge. **Consistency
declaration PENDING the reviewer's marker-level clean-clone gate**
(the post-0098 augmentation); until its green the latest
declared-consistent marker remains 0099.

## Delta since marker-0099 (7d08d41)

1. **Refinement-XVII COMPLETE** — the user's 22-item browser playtest
   batch, same day end-to-end:
   - 18 client items (`3eb4a5d` + `7116a1b` + `d79c302`): the tile-art
     pass (wheat-sheaf grassland special, forest/jungle density, swamp
     ponds, specials legibility + gallery showcase), hover special
     names, top-bar rework (turns-to-tech, research +N, +26ch, button
     cluster + centered diplo panel, mutually-exclusive top panels —
     new top-panels.js), the upkeep/econ statement family (new
     upkeep.js read-only mirror; city-overview upkeep columns,
     currency-truthful; complete econ statement still exactly
     reconciling), catalog +3ch, age-hint centering, ?join first-timer
     arrows, regency box placement, goto-cycle auto-move, 1280px-safe
     wrap.
   - **Join-toggle both halves** (§3): host-only Joining open/closed,
     default open; open = joiners auto-fill even AI-configured seats
     (pre-start only); closed = `joiningClosed` reject; reconnect
     reclaim unaffected. Server half merged on branch-gate green
     (`e00be57`); client toggle rode the batch.
   - §5 coastal-build + the RIVER ruling entered the ENGINE SPINE as
     queued windows (specs/river-terrain.md; runway: A8 threading →
     coastal-build → river → D3-surfacing → D4–D6).
2. **runK roblox batch** (`03934bd`): replay-theater fixes + flow +
   server reset + a specials drift re-mirror; SPEC.md §3z rider.
3. **agent-mail ack-parser fix** (`19510d0`): all-decimal hash
   prefixes no longer swallowed as ids (the redelivery-loop bug the
   helper caught); plus the lane-watcher permission-prompt
   troubleshooting row.

## Test state

81/81 at the merge (join-toggle 4/4, protocol 9/9, scenarios,
lobby-rows); the reviewer's branch pass ran the full server surface
77/77 isolated. Engine untouched since 0097 (three consecutive
golden-neutral markers). Full-suite verdict arrives with the
marker-level clean-clone gate.
