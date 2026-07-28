# Sound design — the synthesis system's rationale

The DESIGN knowledge behind the game's audio; the ops half
(regenerate/upload for Roblox) is `tools/render-sounds.md`. Written
2026-07-28 from the shipped system + the two user listening rounds.

## The architecture decision: recipes, not files

No audio files exist anywhere in the project. Every cue is a RECIPE —
`client/ui/sound.js` `RECIPES` (30 cues) + `TUNES` (2 loops) — and
every consumer synthesizes from that one table:

- the browser renders recipes live through WebAudio;
- `debugging/soundboard.html` (server `--debug`) plays every row for
  review, auto-including new cues;
- `tools/render-sounds.js` renders the same table offline to WAV for
  the Roblox asset upload.

Consequences that made this worth it: zero licensing surface (all
generated), byte-reproducible assets on any clone, and cue changes
are one-line diffs that can never drift between platforms — the
browser and Roblox literally cannot disagree about what a cue sounds
like, only about mix volume (below).

## The recipe grammar

A cue = `{ wave, gain, notes: [[freq, delay, dur], …] }` — an
oscillator type (sine/square/sawtooth/triangle), a base gain, and a
note sequence. The envelope is fixed policy, not per-cue: exponential
attack 0.0001→peak over 8 ms, exponential decay →0.0001 at note end.
Tunes are `{ wave, gain, tempo, notes: [freq…] }`, one note per tick
at `tempo`, each held `tempo*0.9`. Chiptune by construction — the
palette is the 4 classic waves and the NOTE table's pitch constants.

Why a fixed envelope: cues stay a data table (Luau-portable shape,
reviewable in one screen) instead of a synthesis language; 8 ms
attack is fast enough to read as percussive without clicking.

## Equal-loudness assets + mix-in-engine (the Roblox split)

The browser plays recipes at their designed relative gains under one
master volume. For Roblox we deliberately did NOT bake that mix into
the WAVs: `render-sounds.js` normalizes every file up to an RMS floor
(`TARGET_RMS 0.09`, peak-clamped 0.85) and emits `VOLUMES.md`, whose
"suggested Roblox Volume" per cue is exactly the normalization
inverted — so `Sound.Volume` reproduces the approved browser mix.

Why: asset stores and engines expect assets at usable loudness (a
quiet triangle blip uploaded raw is "broken" to a listener); mixing
belongs to the engine where it stays tunable without re-uploading.
This is standard practice arrived at the hard way — see round 1.

## The listening-round lessons (audio physics, user-verified)

Two review rounds against real (small) speakers, 2026-07-26:

1. **Round 1 — "10 files inaudible":** every flagged file was
   triangle or sine. At equal gain those waves carry FAR less RMS
   than square/saw (few/no harmonics); in the browser the in-game
   mix masked it, but standalone files exposed it. Fix = the
   loudness floor above, not per-recipe gain surgery.
2. **Round 2 — "starve, combat-distant, capture-distant still
   inaudible":** two physics limits no gain fixes:
   - a LOW pure sine (~A2-E3) has no harmonics for a small speaker
     to reproduce — it simply doesn't exist below the driver's
     range. Fix: layer an octave-up partial (starve now plays
     A3+A4 / E3+E4) so the ear reconstructs the low tone.
   - sub-100 ms blips read as clicks, not notes. Fix: lengthen to
     ~100-180 ms and give the "distant" cues two-note contours
     instead of shorter single blips.
   Distance is conveyed by TIMBRE (triangle vs the close cues'
   square) and pitch contour — never by being quiet.

All 32 assets user-approved 2026-07-26 after these fixes; that
approval covers any byte-identical regeneration (deterministic
renderer), so re-rendering on another machine needs no re-review.

## Adding a cue (the design checklist)

1. Add the recipe row (`SOUND_IDS` naming: kebab, event-shaped) and
   map the event in `client/ui/sound-map.js` — new EVENT_TYPES need
   catalog + classify + sound entries (the full-suite lesson).
2. Audition in soundboard.html — including at LOW volume: if it
   vanishes, check the wave choice against round-1/2 above before
   touching gain.
3. Re-run `tools/render-sounds.js`; the new WAV + worksheet row
   appear automatically; upload adds the one assetId.
4. Distant/variant cues: same motif family as the close cue, softer
   TIMBRE (triangle), not lower volume.
