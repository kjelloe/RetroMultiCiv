# v1.0 release checklist (designed 2026-07-24, user + architect)

The release process, ruled in the morning session. Executes when the
v1 tree is done (all six axes; see plan-version1.md). Order matters.

## Preconditions (the "release candidate" bar)

1. Every plan-version1 axis ✅ (current gaps: engine queue 6 → D4–D6;
   A49 + endgame-moments; runI batch + the publish acceptance below).
2. The latest marker is MERGE-CONSISTENT with all gates real (the
   standing double-gate + sweep discipline — already the norm).
3. A full clean-clone suite green on BOTH PCs + lune twins + one
   fresh 25-seed canonical soak banked at the RC marker.

## The release sequence (user executes; architect preps each step)

1. **RC declaration**: architect tags the release-candidate marker
   (`marker-NNNN`) + writes `reports/v1-rc.md` (the axis-by-axis
   evidence digest).
2. **Merge to main** (USER): `git checkout main && git merge
   marker-NNNN` — the first main merge since the dev_night grant;
   main becomes the release branch. (Ruled: no early partial merges —
   one clean RC merge.)
3. **Tag** (USER): `v1.0.0` annotated tag on main. GAME_VERSION in
   shared/version.js bumps to 1.0.0 in the RC marker (the envelope
   stamp machinery consumes it).
4. **Redeploy the box from main** (USER): the standard ssh-deploy,
   now pointed at main; unit file already carries the v1 flags.
   **Defaults RULED = current settings**: prince default, size-capped
   civs, marathon opt-in, --max-turns 700, --bug-reports on,
   --announce to the public index. Documented as the v1 baseline in
   how-to-host (no changes needed).
5. **README + release notes** (architect drafts, user reviews): the
   what-is-this + feature summary + how-to-play/host; the DESIGNER
   ALLY is invited to contribute release-note flavor copy (optional,
   non-blocking).
6. **Roblox**: v1 ships browser-first the moment 1–5 complete. The
   Roblox test-publish happens AFTER the runI batch lands (ruled):
   one publish, then sound + saving + batch accepted together in one
   Studio/live session. Roblox pass = a v1.x point release, not a
   v1.0 gate.
7. **Announcement** (USER): wherever desired; the master index makes
   self-hosted servers discoverable from day one.

## Post-release standing

dev_night remains the working branch; markers keep tagging; main
advances only by user merges of consistent markers (the pre-1.0
convention continues). witness-8 (post-D4 launch re-measure) runs
regardless of release timing; if it flips launches>0 it lands as a
v1.x note, not a re-release.
