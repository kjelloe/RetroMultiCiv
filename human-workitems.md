# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. Done items are
dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-08-13 (tip on `dev_night`; **marker-0118 = the graphics
v2 ladder, merge-consistent**, supersedes 0113-0117. v1.0.0 + v1.0.1 are
RELEASED and live; everything below is post-release.)_

---

## A. Merge + deploy the graphics ladder

- [ ] **A1. Review the tier sheet:** `debugging/gallery-tiers-comparison.png`
  — Low (classic, unchanged) / Medium (dense faceted + crafted units) /
  High (smooth TW terrain, model-grade units+cities, shadows). All 9 art
  picks along the way were yours; the three H2/H3 picks confirmed the
  landed provisionals.
- [ ] **A2. Merge marker-0118 to main and redeploy:**
  `git fetch origin --tags && git checkout main && git merge marker-0118 &&
  git push`, then `./ssh-deploy.sh`. Client-only vs v1.0.1's engine; the
  re-recorded visual goldens ride it, so the nightly on main goes green.
  This is effectively **v1.0.2** — say the word for release notes.
- [ ] **A3. Real-hardware High acceptance** (the one measurement no agent
  can take): on the gaming PC at 1440p, a `large` map at High — is it
  ≥50 fps? The number goes in `specs/graphics-levels.md` §6. And do the
  original playtesters call Medium/High "clearly visible what it is"?

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

- [ ] **C1. Wake the Roblox lane when convenient** — its queue holds the
  re-mirror of the G0 horse/desert AND the H1 deer/seal/fish motifs
  (`TileProps.luau`); code travels by your git pump.
- [ ] **C2. Remaining patch-plan engine items** (your go starts them):
  P4 bankruptcy sells buildings (small window), P3 AI nuke doctrine
  (a measured behavioural window).
