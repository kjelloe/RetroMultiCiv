# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-25 (clean pass at marker-0101-live; the box runs
XVII-complete; A8-(b) + Founder's Record + gameover-reveal in build;
XIX + regression-guards queued; RC drafts banked)._

---

## DECIDE / DO (needs you)

- [ ] **Forward the ally update** — `specs/ally-status-update-2026-07-25.md`
  (shareable as-is): five markers, late-join, the fidelity push
  (river ruled in), Founder's Record in build, the Roblox intro.
  Ends with THREE iteration invitations for the ally: the Founder's
  Record moment screenshots, the intro storyboard beats, and the
  specials-motif second pass. Nothing urgent either direction.

- [ ] **Title clearance (standing):** commission the PROFESSIONAL
  trademark search for "A World Begun" (lead) + "The Work of Ages"
  (backup); quietly reserve `aworldbegun.eu`/`.com`/`.no` (~€26/yr).
  All public copy stays title-swappable until it clears.

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
- **In build:** A8 tile-contention fork-(b) (perf acceptance PASSED,
  re-record in progress) · Founder's Record (S1/S3 done, S2/S4 in
  flight) · the gameOver full-map reveal (hardening). Queued: XIX
  (your 8 live-box items) → regression-guards; then the engine spine
  tail (coastal-build → RIVER → D3-surfacing → D4–D6).
- **Sizing/ops answers on record:** ~1 MB heap per live game — caps
  and CPU are the ceilings, not RAM; ports 8123/8200 behind nginx;
  the full hosting Q&A lives in how-to-host.
