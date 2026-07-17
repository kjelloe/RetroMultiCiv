# Design check: civ theme music on diplomacy first contact / audiences

Advisory from the reviewer, user-requested ("national anthem intro when you
meet civs in diplomacy").

## IP answer first

Real national anthems are a per-melody minefield: many are PD (Marseillaise,
God Save the King, the Star-Spangled Banner melody, Haydn's Deutschlandlied
tune) but several are NOT (the Russian/Soviet anthem music is copyrighted),
and 9 of our 14 civs are ancient — no anthem exists (Rome, Babylon, Egypt,
Greece, India, China, Aztecs, Zulus, Mongols). Recommendation: 14 ORIGINAL
culture-evoking leitmotifs (the Civ-series leader-theme model), which is
also exactly what the A77 sound system already is — everything synth,
everything original. Zero clearance work, one consistent voice. PD anthem
QUOTES for modern civs could come later as a labeled enhancement with a
per-melody PD verification each.

## Prior art (verified at f69ddfd — the machinery exists)

- sound.js TUNES: procedural looping melodies (wave/gain/tempo/notes lists)
  on the shared synth — creation + splash tunes prove the format; a theme
  is just more notes. Volume/mute options already apply.
- debugging/soundboard.html auto-lists every new SOUND_IDS/TUNES row with
  per-row comment boxes — the user's audition tool for 14 themes is
  already built (the permanent audio-review ruling, 2026-07-16).
- NO engine first-contact event exists today — only the client-side
  advice.js firstContactWhen(state, me) predicate (view-derived).
  specs/diplomacy-flow.md ships first contact as a real diplomacy event in
  phase 6, and the D2 audience modal is the natural stage.

## Proposed shape (client-only, golden-neutral)

1. `CIV_THEMES` — 14 original leitmotifs in the TUNES note-list format
   (pure data; pentatonic colors for China, raga flavor for India, brass
   fanfare for Rome, etc.), keyed by civ id. Non-looping ~5-8 s intro form.
   Authoring: synth-composition pass, auditioned via soundboard with the
   user's per-row comments (same loop as the A77 cue reviews).
2. Trigger, two stages:
   - NOW (optional pre-phase-6 slice): first SIGHTING of a civ — the same
     client-side predicate family advice.js uses; play that civ's theme
     once per game (client ledger, localStorage), with the existing
     first-contact advice card.
   - PHASE 6 (the real ask): the D2 audience modal opens with the civ's
     theme as the intro sting, and the diplomacy first-contact event plays
     it full — one data table serves both.
3. Coverage gate (the house pattern): every civs.json id has a CIV_THEMES
   entry, valid note tuples, duration bound. Roblox parity: docs/13 sound
   row — Roblox re-authors playback, the note tables port as data.

## Cost

No engine, no state, no goldens. The work is composition: 14 short
melodies (iterative with the user's soundboard feedback), a ~40-line
playback hook, and the phase-6 wiring rides D2 when it lands.
