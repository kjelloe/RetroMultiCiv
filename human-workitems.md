# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-11-05 (tip on `dev_night`; untagged since 0135: A117 + Roblox item 10, golden-neutral; **marker-0135 = P3 nukes + Roblox queue + stricter command door (with P4 and the fastengine batch), merge-consistent**, supersedes 0134 and earlier. v1.0.0 + v1.0.1 are
RELEASED and live; everything below is post-release.)_

---

## A. Merge + deploy the graphics ladder

- [ ] **A1. Review the tier sheet:** `debugging/gallery-tiers-comparison.png`
  — Low (classic, unchanged) / Medium (dense faceted + crafted units) /
  High (smooth TW terrain, model-grade units+cities, shadows). All 9 art
  picks along the way were yours; the three H2/H3 picks confirmed the
  landed provisionals.
- [x] **A2. Merge marker-0129 to main and redeploy** — DONE 2026-08-15
  (user). This is effectively **v1.0.2** — say the word for release notes.
- [ ] **A2b. Push, then merge marker-0135 (supersedes 0130-0134)** — first
  `git push origin dev_night marker-0133 marker-0134 marker-0135` (this
  session has no GitHub credentials; the tags are local). 0135 = P3
  retaliation-only AI nukes (stamp-only re-record) + the Roblox queue + the
  stricter command door (`reports/marker-0135.md`); it carries 0134's P4
  bankruptcy (0134 itself was not consistent) and 0133's fastengine batch.
  All on top of 0132's canonical-floors CI
  repair (the nightly's floor-enforcement job has been killed at its
  45-min budget every night since ~2026-08-09; fixed measured at 150) +
  the H13b road-city regression guard. Workflow+test only; until it
  reaches main, the scheduled nightly's canonical-floors job keeps dying
  at the wire.
- [ ] **A3. Playtest pass — follow `./playtest.md`** (the 1440p fps number,
  the multi-device matrix, and the new affordances: first-visit arrow,
  `?gfx=` links, live tier switching). Results go to the spec's §6.

## B. Operations you started (P1/P2 user halves)

- [ ] **B1. Games-index alerting (P1):** pick an unguessable ntfy topic,
  set `site.alertWebhook` in `~/GIT/gamesindex/games.json`, commit +
  `./ssh-deploy.sh`. The three changed files in that repo are uncommitted
  (your git). Test: `curl -d "test" https://ntfy.sh/<topic>`.
- [ ] **B2. Backups (P2), on the VM:** `ls -la ~/backups` (has the 03:00
  cron ever run?); update `/etc/cron.d/retromulticiv-backup` to the
  template line (now tars `bugreports/` too); copy `ops/backup-offhost.sh`
  over, fill `DEST`, make the restricted key per its header, run once by
  hand, install the 03:20 cron line it prints.

## C. Other lanes

- [ ] **C1. Roblox queue: 9 of 10 items landed headless (2026-11-02)** — items
  1-6, 8, 9 done from the dev PC (parity harnesses green; no rojo/Studio
  here). Needs your Studio session (fold into C1b): item 7 (`ageChanged`
  world line), plus a look at the new animals, era roads/rails + city road
  joins, the wider Encyclopedia button, and a real `buildingSold` line.
  Item 10 (2026-11-02): the city happiness row + tooltip on a
  non-medium game.
  Detail per item in `workitems-roblox.md`.
- [ ] **C1b. The ONE Roblox Studio session (the lane's only remaining
  v1 gate, surfaced #2665 but previously untracked here):** verify
  midgame-join live (two clients, B joins with seats full → gets the
  second-strongest AI civ), publish the experience, set
  `ROBLOX_EXPERIENCE_URL` in `client/ui/roblox-link.js` (un-hides the
  setup-screen button). Checklist: `roblox/PLAYTHROUGH-UI.md`. While in
  Studio, also run the ONE-MOTIF tech-glyph confirmation render
  (`roblox/acceptance/editableimage-glyph-spike.md` — EditableImage is
  provable only in Play-Solo; the renderer is built + gate-31-pinned).
  Parked alongside: the Studded round-2 screenshot review.
- [ ] **C4. Commit the unityworks status edit** — the RetroMultiCiv R1–R14
  status table in `~/GIT/unityworks/specs/server_change_requests.md` is
  uncommitted there (your git).

## D. Decisions

- [ ] **D1. AI first use of nukes** (plan-version2 nuclear item,
  evaluation 2026-11-02, corrected 2026-11-05): go/no-go on one extra
  gate (aggressive stance, score rank 2-3, endgame or a rival launch,
  targets the score leader; crafted-state tests). Recommended: go.
- [ ] **D2. Should the AI build the Manhattan Project on purpose?** Today
  only the econ fallback can pick it; the golden soak and natural runs
  never do, so AI nukes in practice need a human to open them.
