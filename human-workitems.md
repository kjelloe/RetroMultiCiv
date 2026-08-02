# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-08-02 (tip `a0e59b3`; **marker-0111 merge-consistent**,
supersedes 0102–0110 — every engine window W1–W8 complete. The RC marker is
pending the two gates now running; the box runs a hand-deployed dev_night.)_

---

## STEP LIST — in this order

### A. The release sequence — this is now the whole of section A

Everything else in this section was completed and has been dropped. What
remains is the v1.0 release itself, in order. Nothing here is blocked on an
agent except A1, which is running as this file is written.

- [ ] **A1. Wait for the two RC gates (running now, no action from you).**
  The sim-runner is executing the canonical 25-seed sweep at the release tip
  `a0e59b3`, and the reviewer has the clean-clone full suite queued in
  parallel. When both report, the architect tags the **RC marker** and writes
  its report. If either fails, you will hear that plainly rather than seeing a
  tag appear.
- [ ] **A2. Merge the RC marker to main** (the architect will name it and
  declare it merge-consistent; it supersedes 0102–0111):
  `git fetch origin --tags && git checkout main && git merge <marker> && git push`.
  It carries every engine window W1–W8, the D4–D6 diplomacy arc, the nine map
  shapes, usage metrics, and the whole client/Roblox rider set.
- [ ] **A3. Tag the release:** `git tag -a v1.0.0 -m "…" && git push origin v1.0.0`.
  `shared/version.js` already reads `1.0.0`, so nothing in code changes here.
- [ ] **A4. Redeploy the box from main** (not dev_night): `./ssh-deploy.sh`,
  which self-verifies the public endpoint. The box currently runs a
  hand-deployed dev_night tip; this makes live and released the same thing.
- [ ] **A5. Flip GHCR publishing** — a repo-variable change plus one verified
  run, `specs/v1-release-checklist.md` step 4b.

The full sequence with its checks is `specs/v1-release-checklist.md`; the
evidence behind the decision is `reports/v1-rc.md`.

### B. Ally correspondence (whenever you next write)

- [x] **B1. Ally round-trip COMPLETE** (2026-07-25 night): specials
  silhouette pass ACCEPTED final (no further iteration requested,
  do not add horse anatomy detail), Founder's Record tone doctrine
  APPROVED across all four endings with no changes requested, river
  ACCEPTED end-to-end (WebGL1/WebGL2 parity confirmed) with one
  follow-up — pale tile-edge seams reading as a canal — FIXED same
  night (`c1f0cea`, re-shot screenshots). Full capture:
  `specs/ally-response-2026-07-25-night-marker0103.md`.

- [ ] **B2. Conquest world-brighten — a v1.x decision, no rush.**
  The ally prefers a true renderer-level world-brightening over the
  shipped CSS fade, but explicitly said not to hold release for it.
  Banked as a follow-up (entry point noted in
  `specs/endgame-moments-plan.md`) — queues after the D4–D6 arc
  unless you want to promote it sooner.
  brighten is available if they want it.

### B3. Novelty map shapes — a gameplay-quality call, WAITING ON MEASUREMENTS

- [x] **B3. RULED 2026-07-31 — SHIP.** The novelty shapes go into v1.0 as the labelled opt-in group; the AI gap is filed as a v1.x doctrine item (`specs/unit-doctrine-v1x.md` §8, acceptance pinned to the probe's overseas-cities count, not a hash). Evidence that produced the ruling:
  **The numbers (7 civs, canonical):** ring 539 cities / 71.8% coastal / 59
  transport hulls / **0 overseas cities**; inland-sea 582 / 68.0% / 57 / **0**;
  oval 617 / 64.7% / 49 / **0**. At 400 turns ring is SATURATED (~117 cities per
  game against ~112 of capacity) and the zero still holds. The control that makes
  this trustworthy: **archipelago reports 5 overseas cities on the same probe**,
  so the metric fires when the behaviour happens — the zeros are real, not an
  instrument artefact.
  **What it means:** the shapes are playable, not broken (hundreds of cities, no
  invariant breaches, navies built) — but the AI treats them as land maps and
  never contests the far side. On archipelago a civ is boxed in from turn one so
  the naval path triggers; on a ring each civ owns a generous arc, always has a
  local site, and halts at saturation instead of looking across the water.
  **My recommendation: SHIP** them as the labelled "Novelty shapes" they already
  are (opt-in, never the default), and file "re-evaluate overseas expansion when
  the home landmass saturates" as a v1.x doctrine item with its own measured
  window. Holding them back would cost the human-facing variety that is the point
  of W7, to fix an opponent-strength gap on three opt-in map types; rushing the
  AI fix at RC would put an unmeasured doctrine change into the release.
  _(Original framing below.)_
- [ ] ~~**B3-original. If the AI plays the water-heavy new shapes badly, ship or hold?**~~
  W7 added five map shapes (fractal, oval, ring, inland-sea, clover). The
  engine side is done and the shapes generate correctly; what is unproven is
  whether the AI *plays* ring and inland-sea, whose topology forces overseas
  expansion in a way the naval acceptance (archipelago-specific) never
  covered. The sim-runner is measuring exactly that: cities founded, coastal
  share, transports built, whether any overseas city appears. If it comes back
  weak, the options are (a) ship them anyway, clearly grouped as "Novelty
  shapes" in the picker — the human player gets the variety, the AI is simply
  weaker there, or (b) hold the two water shapes to v1.x and ship
  fractal/oval/clover now. I will bring a recommendation with the numbers; the
  call is yours because it trades variety against AI quality.

### B4. Usage metrics — RULED IN for v1.0, building now

- [x] **B4 DELIVERED (2026-08-01):** built by the hardening lane, reviewer PASS on
  code + placement + an independent privacy audit, merged to dev_night. One
  architect call on top: the counters used `| 0` (int32), which WRAPS NEGATIVE at
  2.1 billion rather than saturating — replaced with safe-integer arithmetic, since
  a negative page-load count would be worse than a stalled one. Read it with
  `curl -s localhost:8123/metrics`. Awaiting only a clean-clone suite confirmation
  (queued to the sim-runner with the RC sweep).
- [x] **B4 ruled (2026-07-31):** the hosted services record no usage data today
  — `/healthz` gives point-in-time gauges only and the master index has no
  counters at all, so "did anyone play, and did any game finish?" is currently
  unanswerable. **Your rulings:** v1.0 scope (gather from launch) and
  **localhost-private** exposure. Designed in `specs/metrics-v1.md` and handed to
  the hardening lane. Counts only — no IPs, user agents, tokens, names, or
  per-request logs. You will read it over SSH with
  `curl -s localhost:8123/metrics`.

### C. Phone test (~10 min, carried)

- [ ] **C1. Mobile seated-start re-test:** phone seated in lobby →
  host presses START. The historical hang never reproduced after the
  heartbeat/seat-grace fixes — one confirming pass closes it. If it
  hangs: add `&mlog=1` and send the overlay log.

### D. The ONE Studio sitting (publish gate — ruled sequencing)

- [ ] Publish once, then accept everything together (a v1.x point
  release, not a v1.0 gate):
  1. Studded round-2 review — `roblox/acceptance/tier3-cert.md`
     (also: commit the cert artifact — it's untracked on the gaming
     PC; the RC digest cites commits meanwhile).
  2. SO18 tech-glyphs render-verify (+ screenshots).
  3. SoundId curation — **assets READY + user-approved (2026-07-26);
     upload now AUTOMATED (@e69cb36)**: `node tools/render-sounds.js`
     regenerates the 32 approved WAVs + `VOLUMES.md` anywhere
     (`tools/render-sounds.md` is the guide). Then, instead of the
     manual create.roblox.com flow: create a one-time Open Cloud API
     key (Assets read+write) and run
     `ROBLOX_API_KEY=… ROBLOX_USER_ID=… node roblox/tools/upload-sounds.js`
     — it bulk-uploads every empty-assetId cue, fills `VOLUMES.md`, and
     regenerates `SoundAssets.luau` (Sound.client already consumes it;
     empty ids = silent no-op, so nothing breaks pre-upload). Manual
     upload remains the fallback. The tunes cover the intro-cue row.
  4. DataStore: enable Studio API Services for save-flow testing.
  5. Specials-motif review on the map — now incl. the antler/
     rearing/flipper re-mirror (vs the browser gallery shots).
  6. Instant age-starts check (industrial/space boot near-instant).
  7. Intro re-confirm only (v1 APPROVED at v5b, 2026-07-25).
  8. Terrain desaturation check (carried).
  9. **Midgame-join verify:** two clients, all human seats filled →
     the TAKE OVER pad offers the AI-civ path; toggle OFF restores
     rejoin-only.
  10. **runN reset verify:** finish a game, read the scoreboard
      slowly (replay must survive), watch a replay, then LIVE reset
      → the teleport lands everyone in a fresh instance, black map.
  11. **Decide reserved-vs-public teleport** for that reset (ships
      RESERVED — right for friends-testing; public experiences want
      drop-in joiners = midgame-join's purpose; interim #2608).
  12. **After publish:** set `ROBLOX_EXPERIENCE_URL` in
      `client/ui/roblox-link.js` (one line — activates the hidden
      "🎮 Play on Roblox" button), and record the URL for the store
      description's Play link rule.
  12a2. **Store art at publish:** logo = `roblox/images/logo-512.png`
      (committed @c718fde). Thumbnails (16:9, 1920×1080 PNG) live as
      `roblox/images/thumb-N.png` — CAPTURE IN STUDIO at the sitting
      (decided 2026-07-26: headless browser scenes need fog/ff tooling
      not worth building for throwaway art; the authentic client look is
      best practice anyway). Keep text minimal, subject center-frame.
  12b. **Genre setting at publish:** **Strategy, NO subgenre**
      (architect recommendation 2026-07-25, user to confirm in the
      dialog). Neither Strategy subgenre fits (Board & Card misleads,
      Tower Defense is wrong); Turn-based RPG rejected (implies
      embodying a character, not ruling a civ); Simulation/Tycoon
      rejected (management is the means, not the primary loop —
      Tycoon connotes dropper/idle games). Roblox best practice
      explicitly allows genre-without-subgenre.
  13. Save the acceptance log (`runO.txt` next); the roblox-helper
      is flag-responsive for live findings.

### E. Standing / background

- [ ] **E1. Title clearance:** commission the professional trademark
  search — "A World Begun" (lead) / "The Work of Ages" (backup);
  quietly reserve `aworldbegun.eu`/`.com`/`.no` (~€26/yr). Roblox
  already displays the name by your ruling; the search gates the
  browser/README/store-wide commitment.
- [ ] **E2. Read the release checklist** —
  `specs/v1-release-checklist.md` (RC marker → main merge → v1.0.0
  tag → redeploy → README → announce). Read-and-confirm; no action
  until RC.
- [ ] **E3. Occasionally skim player bug reports:**
  `ssh … 'ls -t /opt/retromulticiv/bug-reports | head'`.

---

## FYI — current state (no action)

- **Live on the box:** marker-0101. Merge-consistent candidate:
  marker-0102 @17b4fb8; marker-0103 tags on the sweep rerun (~6
  seeds out).
- **Tonight's engine loop:** river landed → sweep breached a pop
  floor → audit found the mine-lock mechanism → fix-A (hills never
  flagged) → reviewer GREEN → sweep rerunning. Then: 11b rosters →
  D3-surfacing → D4–D6 → the AI build-doctrine window (baseline
  measured: the AI builds ~0 buildings — maximal headroom).
- **Sizing/ops answers on record:** ~1 MB heap per live game — caps
  and CPU are the ceilings, not RAM; ports 8123/8200 behind nginx;
  the full hosting Q&A lives in how-to-host.
