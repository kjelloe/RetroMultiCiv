# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-10-30 (tip on `dev_night`; **marker-0133 = the fastengine batch, the latest merge-consistent marker**; marker-0134 (P4) is not consistent, P3 is untagged. v1.0.0 + v1.0.1 are
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
- [ ] **A2b. Push, then merge marker-0133 (supersedes 0130-0132)** — first
  `git push origin dev_night marker-0133 marker-0134` (this session has no
  GitHub credentials; the tags are local). 0133 = the fastengine batch
  (`reports/marker-0133.md`). **marker-0134 (P4) is NOT merge-consistent:**
  one stale unit test is red at that tag (fixed after it, see its report).
  P3 + that fix are committed after 0134 and untagged: a stamp-only golden
  re-record, so the next marker (0135) waits for your word. Both on top of 0132's canonical-floors CI
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

- [ ] **C1. Wake the Roblox lane when convenient** — its queue holds 7
  items (items 6–7 added 2026-10-30: the server door-validation twin, P1,
  and an `ageChanged` Studio check; the first 5 audited 2026-08-15): G0 horse/desert + H1 deer/seal/fish
  motif re-mirrors, the `roadStageFor` city-era twin + the TileProps
  H13/H13b road-rail sync, and the never-landed Encyclopedia swap (the
  held #2616 edits — `Pedia.client.luau` still says Gamepedia). Code
  travels by your git pump.
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
