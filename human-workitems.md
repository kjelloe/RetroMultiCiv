# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-28 (tip after marker-0109; **marker-0109
merge-consistent** — the W6 window complete, supersedes 0102–0108;
the box runs 0101)._

---

## STEP LIST — in this order

### A. At the desk now (~15 min, unblocks everything)

- [x] **A1. Both rulings DONE (2026-07-25):**
  - **PEDIA_NAME** = **"Encyclopedia"** (applied; Roblox swap
    queued).
  - **City rosters** = **GO, full authentic replace** (explicit
    option-A pick; the 11b window opens when marker-0103 tags).
- [ ] **A2. Grant roblox writes (the one active blocker):** in the
  ROBLOX PC's Claude session run `/permissions` and allow Edit/Write
  for the clone's `roblox/**` — or add it to that clone's
  `.claude/settings.local.json` allowlist so it survives session
  restarts (this is the third per-session re-block tonight).
- [ ] **A3. Merge the save point:** **marker-0109** is the latest
  merge-consistent marker (supersedes 0102–0108):
  `git fetch origin --tags && git checkout main && git merge
  marker-0109 && git push`. It carries the whole 0103–0109 run: river
  final + D4–D6 diplomacy arc + engine program W1–W5 + the COMPLETE W6
  build-doctrine window (city roles, siege/air war pair, frontier
  defence, wonder hosting) + all client/roblox riders.
- [ ] **A5. Grant each gaming-PC lane its own working directory (2 min, unblocks
  both).** Both lanes went idle on 2026-07-29 for the same reason: the
  directory they need is outside their session's allowed set. The reviewer
  could not run its clean-clone check (`reviewer-lab` not allowed) and the
  sim-runner could not run any W7 measurement (`~/sim-lab` not allowed, and its
  `/mnt/c` tree is stale). Both correctly REFUSED to work around it by checking
  a tip out over someone else's tree. Fix: in each of those sessions,
  `/permissions` → allow read/write plus git and node/lune **inside that lane's
  own directory only** (`reviewer-lab` for the reviewer, `~/sim-lab` for the
  sim-runner). Without it, every measurement and every independent
  reproduction falls back to the dev box, which is slower and defeats the point
  of having a second machine. **Update 2026-07-30:** the sim-runner is
  unblocked, but the reviewer reported its lab dir still denied — a new grant
  usually needs that session RESTARTED before it takes effect, so if the
  reviewer stays blocked, restart its session (or confirm the allowlist entry
  names `reviewer-lab` specifically). It now has a worktree fallback documented
  in docs/18, so this is no longer a hard stop — just slower and less
  independent.

- [ ] **A4. Redeploy the box** after whichever merge:
  `./ssh-deploy.sh` (self-verifies via healthz). Brings live: the
  gameOver reveal, endscreen verdict fix, civ splash, pedia rename,
  founders-tone, silhouettes, late-join UI polish.
- [x] **A5. Screenshots eyeballed — OK** (user, 2026-07-25): river
  ribbon accepted.

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

- [ ] **B3. If the AI plays the water-heavy new shapes badly, ship or hold?**
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
