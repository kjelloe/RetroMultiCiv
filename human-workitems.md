# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-25 evening (marker-0102 TAGGED @17b4fb8,
merge-consistent: A8 + coastal-build + Founder's Record + XIX +
gameover-reveal + reject-reasons. River landed after the tag,
mid-gate → 0103. The box still runs 0101)._

---

## DECIDE / DO (needs you)

- [ ] **Merge marker-0102** (@17b4fb8, declared merge-consistent —
  `reports/marker-0102.md`): A8 tile contention + coastal-build +
  Founder's Record (all four endings) + XIX 8/8 + guards 2/5 + the
  two hardening merges. A redeploy after it brings the gameOver
  full-map reveal + reject-reasons live.

- [ ] **Two strings to rule:** (1) **PEDIA_NAME** — "Gamepedia"
  collides with the Fandom wiki brand; alternatives on the table:
  "Founder's Guide" (pairs with Founder's Record) or plain
  "Encyclopedia" (one-constant swap either way). (2) The **city-list
  recommendation** (full Civ1-exact lists + extend to 16 names +
  territorial pool) awaits your veto before 11b lands it.

- [x] **Ally round-trip COMPLETE** (2026-07-25): update forwarded,
  all three invitations answered, gallery strip reviewed — **specials
  visual language ACCEPTED** ("iterate only beast/game silhouette;
  preserve crystal-vs-stone"). Everything captured + routed
  (`specs/ally-response-2026-07-25-iteration.md`). Nothing pending
  either direction until the next screenshot round.

- [ ] **Title clearance (standing):** commission the PROFESSIONAL
  trademark search for "A World Begun" (lead) + "The Work of Ages"
  (backup); quietly reserve `aworldbegun.eu`/`.com`/`.no` (~€26/yr).
  UPDATE 2026-07-25: you ruled the ROBLOX experience displays
  "A World Begun" (+ the ally subtitle) now, via swappable
  constants — the search now mainly gates the browser/README/
  store-wide commitment.

- [ ] **Review the v1 release checklist** —
  `specs/v1-release-checklist.md`: RC marker → your main merge →
  v1.0.0 tag → redeploy from main → README (drafted:
  `specs/readme-v1-draft.md`) → announce. A read-and-confirm; no
  action until RC. The RC evidence digest is pre-filled at
  `reports/v1-rc-draft.md`.

- [ ] **Roblox session Write-mode residual (low):** that session still
  can't Write anything (`/tmp` probe denied). Nothing is blocked now,
  but before its next real task: `/permissions` in the session, or a
  standing `roblox/**` allowlist in the clone's settings.

- [ ] **Mobile seated-start re-test (carried):** the historical hang
  (phone seated in lobby, START showed nothing) never reproduced
  after the heartbeat/seat-grace/wake-reconnect fixes — one
  confirming pass on your phone closes it. If it still hangs, add
  `&mlog=1` and send the overlay log.

---

## STUDIO SESSION (one sitting collects all of these)

- [ ] **The publish gate** (ruled sequencing): publish once, then
  sound + saving + the accumulated batches accepted together in ONE
  Studio/live session. Roblox pass = a v1.x point release, not a
  v1.0 gate. Items for that sitting:
  1. Studded round-2 review — `roblox/acceptance/tier3-cert.md`.
  2. SO18 tech-glyphs render-verify (+ screenshots).
  3. SoundId curation (worksheet in `roblox/acceptance/`; an intro
     cue row is welcome).
  4. DataStore: enable Studio API Services for save-flow testing.
  5. Specials-motif review on the map (vs the browser gallery shots
     in `debugging/usergenerated/`).
  6. Instant age-starts check (industrial/space boot should be
     near-instant).
  7. **NEW — the boot intro** (`Intro.client.luau`, landed
     `d32f99a`): eyeball all five beats + SKIP + the auto-skip;
     say if any beat's timing feels off (the ally gets the
     storyboard for opinion too).
  8. Terrain desaturation check (carried).
  9. Save the acceptance log (`runM.txt` next); the roblox-helper is
     flag-responsive for live findings.

---

## FYI — current state (no action)

- **Live on the box:** marker-0101 — XVII complete (all 22 playtest
  items), late-join/pause/eviction, join-share QR, the specials art,
  self-host find-a-game. Deploys now self-verify (healthz guard);
  skim player bug reports occasionally:
  `ssh … 'ls -t /opt/retromulticiv/bug-reports | head'`.
- **In gate:** RIVER (@8da9029 — meandering strips on the existing
  tile.river flag, ~11% of land, twin-identical): reviewer engine-diff
  + 25-seed sweep queued; marker-0103 tags on green. Then the spine
  tail: D3-surfacing + 11b city names → D4–D6 → the AI build-doctrine
  window (your XX §3 ruling; baseline measuring first). All six lanes
  stocked — nothing is idle.
- **Sizing/ops answers on record:** ~1 MB heap per live game — caps
  and CPU are the ceilings, not RAM; ports 8123/8200 behind nginx;
  the full hosting Q&A lives in how-to-host.
