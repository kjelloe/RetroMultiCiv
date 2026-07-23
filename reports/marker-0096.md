# marker-0096 — the engine gets fast (MERGE-CONSISTENT)

Tagged at `8047f0b` (2026-07-24). **MERGE-CONSISTENT — supersedes
0095. Current merge candidate** (28th consecutive, 0069–0096).
Double-green: reviewer aliasing gate #2364 (all #2319 conditions,
including its independent 10-seed COW-vs-parent diff-identity) +
Gate-B #2356 + the multi-seed sweep #2361 (13/13 byte-identical,
speedup confirmed 26–41% on second hardware).

## What changed (delta since 0095)

1. **deepClone map-sharing (COW)** (`68196b7`): applyCommand shares
   `state.map`; the ONE legal tile-write path (`cowTile`) clones
   lazily; 8 writers converted; the mechanism-A transient resets per
   command (docs/02 §8 sanctioned); a permanent Object.freeze
   mutation-isolation test guards aliasing forever. **Goldens
   byte-identical in both engines** — a pure structural optimization.
   **Measured ~38%** on the 14-civ reference (12.6s vs 20.2s);
   confirmed 26–41% independently. Combined with perf fix 1 (~20%),
   the reference workload runs roughly **half its former cost**, both
   platforms.
2. **First-timer onboarding overlay** (`3d0ca75`): cartoony
   live-anchored arrows on the setup and first-game screens (the
   friend-playtest fix), one-time per browser, "🧭 controls guide"
   re-show in Options, and a permanent AI-regency tooltip.
3. **The rejoin arc fully closed** (`5da5cff`): the View-final-result
   button — an ended game's endscreen is one click from the rejoin
   card (fetch-by-gameCode).
4. **Roblox**: the runI batch slice-1 (22 files) + the **regent-stall
   mirror** (`8047f0b` — the seats-derived guard ported; the user's
   14-civ hang now fixed on BOTH platforms) + the age-snapshot Luau
   twin in build.
5. Also this window: the ally's naming ruling + three-block release
   copy captured and wired (specs/ally-response-2026-07-24-naming-
   release.md); the bugfixer session parked with a landmark 8-delivery
   ledger; the CANONICAL_PIN re-record ritual live.

## Next

Fresh bugfixer session → the smalls run (#8 default-defender front)
→ D3-surfacing → D4–D6 (witness-8 + the treaty UI ride D4). Fresh
helper session → A49 + Founder's Record. User: REDEPLOY FROM THIS
MARKER (every user-hit fix + ~half the engine cost), trademark
search + domains, publish gate after the roblox batch.
