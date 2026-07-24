# marker-0103 — river complete + endscreen-winner contract + the golden-neutral batch

Tag: `marker-0103` at `fe39360`. **Merge-consistent — the user may
merge this. Supersedes marker-0102** (merge 0103 directly; 0102's
content is contained).

Delta: marker-0102 (`17b4fb8`) → `fe39360`, ~30 commits, one evening.

## The river arc (axis 1 — the 12th terrain, complete)

The full loop ran inside this marker:

1. **Landed** (`8da9029`): ruling A — the meandering-strip mapgen on
   the EXISTING tile.river flag (multi-source BFS distance-to-ocean,
   gradient-descent springs, ~11% of land), byte-shaped Luau twin
   (JS==Luau map hashes on all 4 map types), honest behavioral
   re-record #1.
2. **Sweep breached** M3-pop 23.5 < 28 (#2551) → investigate-first
   ruling (#2553).
3. **Audit** (#2570, `debugging/river-dist-audit.mjs`, kept): 38% of
   strip tiles landed on hills = ~165 mine-locked shields/world
   (mine illegal on river, B19); 47.6% of AI cities on/adjacent
   river; reviewer addendum #2556 proved river is flag-only (+1
   trade — no yields replaced).
4. **Fix-A** (`ea6c2a3`): hills are never FLAGGED (springs still
   start in hill country; the flag begins first non-hills tile
   downstream). Honest behavioral re-record #2; a hills-never-flagged
   invariant locks it. Reviewer GREEN #2593 — twin faithful, goldens
   reproduced.
5. **Post-fix sweep** (#2615): 16/16 seeds, 0 invariant failures;
   M3-pop 23.25 — the residual is FLOOD EXPOSURE (popPct 25 on
   river-adjacent cities) amplified by the AI building no city
   walls (the XX §3 baseline finding).
6. **USER RULING**: re-pin M3-pop 28 → 22 as the river-world
   re-baseline (`fe39360`), keep the 11% coverage and ribbon look;
   the floor re-ratchets upward when the build-doctrine window
   lands walls/granaries. Mechanism traced end-to-end — not
   variance.

River renders verified in WebGL2 AND WebGL1 (user-accepted shots,
`debugging/usergenerated/river-ribbon-gallery*.png`).

## Engine (both golden-neutral)

- **d3 endscreen-winner** (`ce25a3b`): filterView surfaces
  `gameOver` + `winner` in every seat view strictly at gameOver
  (no-null) — the fog-lapse ruling applied at the source; fixes
  rejoin/resume/reopen verdicts for all consumers. Twin verified on
  crafted views; +2 visibility tests, +1 ws join-finished-game
  integration. Reviewer clean-clone GREEN #2604.
- `server.test.js` expect() timeout 5000 → 30000 ms (the documented
  socket budget; de-flakes the parallel suite).

## Server merges (reviewer-gated)

- **lobby-robustness** (`fd30245`, PASS #2554): skip-vote disconnect
  fix + join-code race / drop-window / stale-token guards
  (`test/server-lobby-robustness.test.js`).
- **docs/16 §8 delta re-assessment** (`9fe0b3c`, GREEN #2606):
  posture rows for the five new surfaces (late-join/claimSeat
  family, gameover-reveal, reject-reasons, bug-report sink,
  lobby-robustness fold-in). No RC-blocker; one note-only residual.

## Client (helper — seven items, all golden-neutral)

- **founders-tone** (`613f963`): the ally's tone doctrine on the
  endscreen (DEFEAT own-glyph desaturated, no sting; SPACE
  departure copy; CONQUEST grave copy + 2.6 s slow world-brighten).
- **specials-silhouettes** (`29c53a1`): Game antler (new resAntler),
  rearing Horse (rotZ), Seal flipper; crystal-vs-stone guards held.
  Roblox re-mirror landed (`69cc40d`).
- **play-on-roblox** (`a61d34e`): hidden-until-configured setup
  button (ROBLOX_EXPERIENCE_URL ships empty, https-only guard).
- **xx-pedia-splash** (`800c8a4`): pedia rename behind PEDIA_NAME +
  the game-start civ splash (leader/specialty, Continue-gated,
  `?civintro` hook). **USER RULED the string: "Encyclopedia"**
  (`91fb9ee`); Roblox swap queued.
- **guard-1 client half** (`d1fa49c`): reject-copy.js superset
  renderer + the reject-coverage contract test.
- **flow4-endscreen** (`d1fa49c`): `test-ui/endscreen.spec.js` — the
  4 `?ending` previews + a real `?server=1` gameOver over the fog
  view. Closes A49 5/5 AND guard-3. **Regression guards G1–G5 are
  all built.**
- River-gallery acceptance shots (user-accepted; artifacts only).

## Roblox (sim-runner-committed)

- Intro v3–v5b (`e742d89`…`74cf40f`): naming ("A World Begun" +
  subtitle), UI-hide, camera fix, title sizing — **intro v1
  USER-APPROVED, frozen at v5b**.
- **midgame-join** (`58f74e4`): browser late-join parity (claimSeat
  pad path, toggle default on) — Studio verify pending.
- **runN** (`3610b11`): replay-hang fix (noReplayYet + 12 s
  timeout), endscreen keep-alive (reading the scoreboard no longer
  lets the reset eat the replay), LIVE reset = reserved-server
  teleport (ruling: reserved now, revisit at publish), fog-residue
  wipe on soft reset.

## Docs / process

- **License sweep**: all direct references to the named fan wiki
  removed from the MIT repo (neutral "reference wiki dump" wording;
  the CC BY-SA boundary itself unchanged).
- RC evidence digest verified vs the 0102 tree (#2565) and the six
  drift rows applied (`0ee00ca`) — incl. correctly REOPENING A49
  flow-4, which then shipped the same evening.
- human-workitems restructured as the step-ordered action list
  (A–E); plan md/html refreshed through the evening.
- Test counts synced 886 → 906 → (suite now 915 per the last full
  run; sync-check at the next count-pin pass).

## Test state

At the tag: core goldens 93/93 locally (simulation + river-terrain +
visibility + scenarios); reviewer clean-clone GREEN on the two
engine changes (#2593, #2604); sweep 16/16 invariant-clean with
floors green under the re-pinned M3; full suite ~915 with 2 known
parallel-load flakes (both green isolated, one de-flaked by the
timeout bump).

## Breaking / notes

- No protocol or save-format breaks. The view now carries
  `gameOver`/`winner` at game end (additive; old clients ignore).
- The M3-pop floor re-pin is a RULING with an expected upward
  re-ratchet at the doctrine window — do not treat 22 as the
  long-term bar.
- Next spine: **11b authentic city rosters** (user ruled GO —
  window opens now) → D3-surfacing remainder → D4–D6.
