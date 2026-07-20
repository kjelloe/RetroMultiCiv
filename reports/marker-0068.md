# marker-0068 — OOM fix complete + operator-caps verified (golden-neutral server)

Tagged at `42e0154` (2026-07-20). **NOT merge-consistent** — the tree carries
the open XII.5 golden window (7 luau-twins/golden failures, re-record in
progress as marker N). **The latest merge-consistent marker remains
marker-0067.** This tag is a save point for the server work, mergeable only
once the XII.5 re-record marker lands and goes green.

## Delta since marker-0067

### The OOM fix, complete (#1870 slices 1 + 2a — the turn-2623 root cause)

Two commits, one fix, landed by cherry-pick (NOT merge — the hardening branch
had forked pre-D3/XII.5, so a merge would have reverted later work; the two
commits' own deltas were picked onto the current tip, zero conflicts):

- `10c1025` — slice 1: per-command autosave write-amplification killed.
  Previously every command rewrote the full save; now writes are batched at
  the fanout boundary.
- `42e0154` — slice 2a: the in-RAM per-command log now STREAMS to
  `saves/<gameId>.log.jsonl` and RAM retains only round-hashes — the
  unbounded-growth root of the turn-2623 OOM. Pre-sidecar saves load
  gracefully (seed from the .json diagnostics); the A50 rotation companion
  unlinks the sidecar with its save.

Footprint (verified by diff): `server/game.js`, `server/index.js`,
`test/server-protocol.test.js`, `test/server.test.js`. `engine/`, `data/`,
`luau/` untouched (empty diff) — twin-free, gamesim-golden-neutral.

Suites at landing: server+protocol+lobby 42/42. Full suite 640/649 with the
7 fails all being the pre-existing XII.5 window (ruled not-counted, #1932).

### A101 operator-caps — verified landed

The caps core (`--max-turns` / `--max-civs` / `--max-size`) plus the
warn-not-fail rider (unknown flags WARN + boot `caps:` line) were already on
dev_night inside `d0dfcb7`; the landing task verified presence
(`yearAtTurn`/`civCeiling`/`clampSize`, `server/index.js:1231-1260`) and
acceptance suites 41/41. Nothing further to land; recorded here so the
marker history carries the A101 completion.

### Also between 0067 and this tag (rode the same span)

- `fe2ad3e` — roblox gate-4 re-bake: `victoryDrive.spaceStances` mirrored
  into generated `rules.luau` + `RulesetHashes.luau` (display-neutral).
- `0ba14b2` / `a2335b0` — XIV §15 Studded/brick world style: the ally-derived
  style SPEC, then the first implementation (3-way look toggle, studs-on-flats
  brick terrain material, 18 gates green). Renderer-only. Awaiting the user's
  Studio screenshot review.
- `fa1f19e` — the docs/specs batch: Refinement XIV triage (31 items), the
  ally design package, XII.5 §10/§11 probe findings, deploy troubleshooting,
  agent-mail conventions.

NOT under this tag (committed locally after it, rides the next marker):
`f7b52e2` — the XIV client deliveries (server-default redirect, endscreen
fog-guard, in-client bug report + write-only route) + A102 CLI guards.

## Test state at the tag

640/649 pass; 7 fails = the open XII.5 golden window only (luau data
checksums, turn-100 checkpoint, scenario 002 — all victoryDrive-rulesetHash
driven); 2 skips environmental. Zero failures in the server/game/OOM/lobby/
protocol surfaces this marker delivers.

## Breaking notes

None for operators: saves remain compatible (graceful sidecar seeding), no
protocol change, no flag removals. The `saves/` directory now accrues
`.log.jsonl` sidecars, counted by the existing rotation budget.
