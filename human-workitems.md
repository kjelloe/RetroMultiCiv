# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-25 late evening (tip 7aa6e34; marker-0102
merge-consistent; 0103 = the 6-seed sweep rerun; the box runs 0101)._

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
- [ ] **A3. Merge the save point:** either merge **marker-0102 now**:
  `git fetch origin --tags && git checkout main && git merge
  marker-0102 && git push` — or wait ~an hour for **marker-0103**
  (river + tonight's batch) and merge that instead. 0103 supersedes;
  merging 0102 now is only worth it if you want the box current
  tonight.
- [ ] **A4. Redeploy the box** after whichever merge:
  `./ssh-deploy.sh` (self-verifies via healthz). Brings live: the
  gameOver reveal, endscreen verdict fix, civ splash, pedia rename,
  founders-tone, silhouettes, late-join UI polish.
- [x] **A5. Screenshots eyeballed — OK** (user, 2026-07-25): river
  ribbon accepted.

### B. Ally correspondence (whenever you next write)

- [ ] **B1. Forward the screenshot round** to the designer ally —
  8 individual FILES (my earlier compressed notation misread as
  folders; all verified present on the dev PC):
  - `debugging/tone-defeat.png`, `debugging/tone-conquest.png`,
    `debugging/tone-score.png`, `debugging/tone-space.png`
    (the Founder's Record tone pass — their doctrine applied);
  - `debugging/usergenerated/specials-row.png`,
    `debugging/usergenerated/specials-beasts.png`,
    `debugging/usergenerated/specials-seal.png`
    (the silhouette iteration: game antler, rearing horse, flipper);
  - `debugging/usergenerated/river-ribbon-gallery.png`.
  Suggested note: "Your tone guidance and silhouette notes are in —
  say if any ending's weight or beast outline feels off. Rivers now
  render as ribbons; one look wanted." One open offer to them: the
  conquest world-brighten is CSS-layer; a renderer-level map
  brighten is available if they want it.

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
  3. SoundId curation (worksheet in `roblox/acceptance/`; an intro
     cue row is welcome).
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
