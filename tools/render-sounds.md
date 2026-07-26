# Roblox sound assets — regeneration + upload guide

The 30 game cues + 2 tunes are SYNTHESIZED (no source audio files exist).
Everything needed to regenerate them is in git; the WAVs are build artifacts.

## Files involved (all committed)

- `client/ui/sound.js` — the SOURCE OF TRUTH: the `RECIPES` + `TUNES` tables
  (wave / gain / note sequences). Exported for the renderer, so rendered files
  can never drift from the browser cues.
- `tools/render-sounds.js` — the offline renderer (pure Node, no deps).
- Review references: `client/ui/sound-map.js` (which event fires which cue),
  `debugging/soundboard.html` (the in-browser listening tool, server `--debug`).

## Regenerate (any machine with the repo + Node)

    git pull origin dev_night        # or main once merged
    node tools/render-sounds.js      # -> debugging/sounds-export/

Output: 32 WAV files (44.1 kHz / 16-bit mono, loudness-normalized to an RMS
floor, peak-clamped) + `VOLUMES.md`.

- Filenames match cue ids exactly (`combat-win.wav` → the `combat-win` row in
  sound-map.js).
- `VOLUMES.md` is the MIX WORKSHEET: assets are equal-loudness; the "suggested
  Roblox Volume" column is the approved browser mix (the normalization
  inverted). It has an empty assetId column.

Optional: `node tools/render-sounds.js /some/other/dir` renders elsewhere.

## Upload flow (manual, your Roblox account)

1. create.roblox.com → Creations → Development Items → **Audio** → Upload
   (bulk-select all 32 WAVs; each is short and passes the size limits).
2. Copy each resulting assetId into `VOLUMES.md`'s assetId column.
3. Drop the completed table into `roblox/acceptance/` (the Studio-sitting
   SoundId curation step — checklist item 3 in human-workitems). The
   roblox-helper wires the ids + Volume values into the Sound instances.
4. `tune-creation` / `tune-splash` cover the intro-cue row.

## Changing a sound later

Edit its recipe line in `client/ui/sound.js`, re-run the renderer, re-upload
that one file (Roblox: update the existing audio asset keeps the assetId).
Browser and Roblox stay in sync by construction. STATUS: the current 32-file
set was listened to and APPROVED by the user 2026-07-26 (after a loudness
floor pass + audibility recipes for starve/combat-distant/capture-distant —
low pure sines and sub-100ms blips don't reproduce on small speakers).

## Tuning knobs (top of tools/render-sounds.js)

- `MASTER` (0.7) — the pre-normalization browser master level.
- `TARGET_RMS` (0.09) — the loudness floor all files are raised to.
- `PEAK_CLAMP` (0.85) — the anti-clip ceiling.
