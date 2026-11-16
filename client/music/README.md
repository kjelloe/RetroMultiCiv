# How overworld's music is made — a hand-off for a sibling game

A MIDI-style stack in three files and six JSON pieces, no audio assets, ~260 lines plus the scores.
The files beside this note are copies of the real ones (`score.mjs`, `synth.mjs`, `music.mjs`, `pieces/*.json`) and
a validated sketch for a "suspense" theme (`pieces/suspense-sketch.json`). Nothing here is Ultima's; the idiom is
"a 90s sound-card score", the notes are our own.

## 1. A score is data, one voice per track

`pieces/<theme>.json`:

```json
{ "bpm": 112, "beats": 4, "loop": true,
  "tracks": [
    { "patch": "lead", "gain": 0.5,  "notes": [[0, 62, 1], [1, 66, 0.5], [1.5, 69, 0.5], [2, 71, 1]] },
    { "patch": "pad",  "gain": 0.22, "notes": [[0, 50, 4], [4, 48, 4]] },
    { "patch": "bass", "gain": 0.5,  "notes": [[0, 38, 1], [1, 38, 1]] },
    { "patch": "bell", "gain": 0.22, "notes": [[0, 74, 1]] },
    { "patch": "drum", "gain": 0.35, "notes": [[0, 36, 0.25], [1, 38, 0.25]] } ] }
```

A note is `[startBeat, midi, lengthBeats]`, fractions allowed. A track is one monophonic voice — its notes may not
overlap; `loadScore` in `score.mjs` refuses that, pitches outside 24–96, gains outside 0–1 and unknown patches. The
piece's length is its last note rounded up to whole bars (`beats` per bar) and `loop` wraps there. Drums use the
General-MIDI numbers (36 kick, 38 snare, 42 hat), so one note format carries percussion too. That is the MIDI feel: a
few monophonic channels with a patch each, written by hand as number lists.

## 2. The player schedules a window ahead and cross-fades pieces

`music.mjs` + `score.mjs` (`score.mjs` is pure and unit-tested; `music.mjs` needs only an AudioContext-shaped object).

- Every 100 ms `update()` asks the score for the note-ons in `[now, now + 0.2 s)` in beat units (`eventsBetween`),
  converts beats to seconds with `60 / bpm`, and hands each to the synth with an absolute AudioContext time. Nothing
  is played "now"; everything is booked slightly ahead, so timer jitter never shows. A hidden tab throttles timers, so
  the look-ahead grows to 1 s there (`lookAhead`).
- A looping piece is beat arithmetic: pass number × length, so times keep rising across the wrap and a note in bar 1
  of the second pass lands exactly where it should.
- A theme change makes a new gain "layer" fading in over 1.5 s while the old one fades out and is dropped afterwards
  (`FADE_SECONDS`): the two pieces overlap briefly instead of cutting.
- `themeFor({ region, fighting, minutes })` picks the piece: fighting wins, then night (22:00–05:00) in settled
  places, else the region's theme. In the game a console hook (`window.ow.play('night')`) pins a theme over that.

## 3. The synth: two-operator FM on WebAudio, five patches, data only

`synth.mjs`:

```js
lead: { carrier: 'square',   mod: { ratio: 2,   index: 1.2, decay: 0.3 }, attack: .012, decay: .15, sustain: .55, release: .14, filter: { type: 'lowpass', freq: 3200 } },
pad:  { carrier: 'triangle', mod: { ratio: 1,   index: 0.5, decay: 1.8 }, attack: .4,   decay: .5,  sustain: .8,  release: .9,  filter: { type: 'lowpass', freq: 2400 } },
bass: { carrier: 'sawtooth', mod: { ratio: 1,   index: 0.8, decay: .12 }, attack: .008, decay: .2,  sustain: .6,  release: .1,  filter: { type: 'lowpass', freq: 900 } },
bell: { carrier: 'sine',     mod: { ratio: 3.5, index: 2.6, decay: 0.7 }, attack: .002, decay: 1.4, sustain: .04, release: .6 },
drum: { drum: true }   // 36 kick: a sine sweeping 160→42 Hz; 38 snare: a tone + band-passed noise; 42 hat: high-passed noise
```

Per note: a carrier oscillator at the pitch, a modulator at `ratio ×` the pitch feeding the carrier's frequency
through a gain of `index × pitch` that decays over `mod.decay` seconds — that falling index is what makes it sound
like an OPL/FM card (bright attack, mellow sustain) — an optional lowpass, and an ADSR gain envelope with exponential
ramps to a floor of 0.0001 (never zero: WebAudio's exponential ramps forbid it). Noise comes from one precomputed
buffer with a fixed LCG seed, so it is the same on every run. The recipes are plain objects on purpose: our native
port reads the same numbers and renders the same pieces offline, which is how its `sound` oracle compares the two.

## 4. How the pieces were written

- Each theme got a mode and a tempo first, then 16–32 bars: town 16 bars at 112 in D Mixolydian, hamlet 16 at 84 in
  A Dorian, wild 24 at 72 in E Aeolian, cave 16 at 52 in C Phrygian, fight 16 at 160 in E Phrygian, night 16 at 63 in
  F Lydian in 3/4. Modes over keys: Mixolydian for a market, Dorian for a hamlet, Phrygian for a cave and a fight —
  the flavour comes from the scale, not the harmony.
- Arrangement is always melody + two pad voices (a sustained third and fifth, chords by the bar or four bars) + a bass
  on roots and fifths + a bell doubling or answering the melody an octave up + drums only where there is bustle
  (town, fight). Five voices is the budget; the cave has three sparse ones and a lot of silence.
- Melodies are stepwise with a leap per phrase, phrases of 2 bars repeated with a varied ending (AABA within the
  loop), note lengths mixed between 1, 0.5 and 1.5 beats so it does not march. The bass moves on the bar, the pads
  on the chord.
- Gains are mixed in the data (lead 0.4–0.5, pads ~0.2, bell ~0.2, bass 0.4–0.55, drums 0.12–0.6), so no piece needs
  a mastering pass.

## 5. From a mood word to the notes — the method, with two of ours

The order is always the same: one sentence of the scene → a tempo and a metre → a mode → the bass motion → the
pads → the melody last. The sentence decides everything after it; writing notes before the sentence gives a loop,
not a piece.

### "night" (`pieces/night.json`)

The sentence: *a lamp-lit lane after the shutters close, nobody hurrying; it should feel safe, a little lonely, and
never arrive anywhere.*

- Tempo and metre from "nobody hurrying": 63 bpm, 3 beats a bar. Three is the lullaby metre; at 63 a bar is nearly
  three seconds, so one chord fills a slow breath.
- Mode from "safe, a little lonely": F Lydian — a major scale with the raised fourth (B over F). Major keeps it safe;
  the Lydian fourth is the lonely one, because it never resolves the way a plain major fourth does. Minor would have
  made it sad, which is a different lane.
- Bass first, one note a bar, the whole bar (`[0, F2, 3], [3, D2, 3], [6, F2, 3], [9, G2, 3]` …): F, D, F, G — root,
  the relative minor's root, back, and up a step. Four bars that go nowhere on purpose, repeated with one change in
  the second half (C under the G) so bar 7 feels like the turn of a road.
- Two pads, a third and a fifth over the bass, the same bar-long notes (A3/C4 over F, F4/A4 over D …). They move only
  with the bass. Gain 0.2 each: felt, not heard.
- Melody last, on the bell patch instead of the lead — the one decision that makes night sound like night. The bell's
  1.4 s decay rings into the silence; a square lead would have sounded like day. The line stays in one octave
  (F4–A5), moves by step and small thirds (A C A D | A C A F G), uses 1, 1.5, 2 and 3-beat notes and leaves rests
  (38 notes over 16 bars: a note every bar and a bit). The 1.5-beat note over a 3-beat bar is the stumble that keeps
  it from ticking. No drums: percussion is daytime.
- Length: 16 bars, looping. The last bar lands on the root so the wrap is a breath, not a cut.

### "fight" (`pieces/fight.json`)

The sentence: *a wolf is on you; everything is short, repeated and a half-step wrong.*

- Tempo: 160 bpm, 4/4. A bar is 1.5 s; the piece loops in 24 s, about how long a fight lasts.
- Mode from "a half-step wrong": E Phrygian. Phrygian's flat second (F over E) is the stock menace interval; the whole
  piece lives on that E–F rub.
- Bass as a machine, not a line: 128 eighth-notes, 8 a bar, almost all on the root with the octave on the 4th eighth
  and the fifth on the 7th (`E2 E2 E2 E3 E2 E2 B2 E3`), then the same shape a half-step up on F for a bar, back to E.
  That root–octave–fifth hammer *is* the engine; the melody could be removed and it would still be a fight.
- Drums as three voices: kick on every beat (36, gain 0.6), snare on 2 and 4 with a doubled snare before each phrase
  end (… 14.5, 15, 15.5), closed hat on every eighth (42, gain 0.2, 0.1 beats long so it clicks). Three drum tracks
  because a track is one voice; they interlock instead of one busy part.
- Pads as two held notes a bar, changing only on the bar, a fifth apart (G3/B3 → A3/C4): they thicken, they do not
  move. Minor against the E bass, major-ish against the F — the harmony flips every bar with the bass's half-step.
- Melody as a riff: 85 notes in 16 bars, eighths and quarters only, in one register (D4–A5), built from one two-bar
  cell (F E F A | G E) that comes back transposed and varied. It leans on the F (the flat second) at the top of every
  cell. Repetition is the point: in a fight nobody listens to a tune, they feel a loop tightening.

### "suspense" — worked the same way (`pieces/suspense-sketch.json`, validated, 4 bars to start from)

- Sentence: *something is in the room and has not moved yet; the player is waiting, not fighting.* So: slow, not
  fast; thin, not loud; unresolved, not menacing. Suspense is the absence of the fight, which is why it must not
  borrow the fight's engine.
- Tempo: 70–80 bpm in 4/4 (the sketch: 72), with the pulse implied, not played.
- Mode: a minor key with the bass stuck on the fifth (B under E minor). A dominant pedal that never resolves to the
  root is the oldest suspense trick there is; every chord above it asks a question. Add the flat second (F) only
  once per phrase, as a passing note, so it stays a hint.
- Bass: one note, the pedal (B1), held the whole bar, every bar, gain 0.45 with the `bass` patch's lowpass at 900 Hz
  — a felt hum. Never move it. If it must breathe, drop it for one bar every eight.
- Pads: two voices, bar-long, drifting by step above the pedal (E4/G4 → F4/G4 → E4/A4 → D#4/A4): one voice stays, the
  other creeps a half-step. The creeping half-step over a fixed pedal is the suspense; the fight used the same
  half-step in the bass, loud and fast — same interval, opposite deployment.
- Melody: on the bell, not the lead, sparse — a note every two or three bars, short (0.5–1 beat), high (E5–A5), each
  a question: end phrases on the sixth or the second, never on the root. Leave eight-beat gaps. A listener fills
  silence with dread faster than any note can.
- Percussion: none, or a single hat (42, gain 0.12) on beat 1 of every other bar — a clock, not a groove. One kick at
  the end of the loop if a "something stirred" moment is wanted; otherwise nothing.
- Length: 16 bars looping, and do not resolve at the wrap — end on the pads' half-step so the loop itself is
  unresolved. Extend the sketch by moving the creeping pad voice one half-step further every four bars and bringing
  it back, and by letting the bell answer itself once an octave down near the end.

### The recipe, then

Write the sentence; pick tempo and metre from the verb in it (hurrying, waiting, striking); pick a mode from the
feeling-word (safe → Lydian/Mixolydian, lonely/old → Dorian/Aeolian, wrong/menace → Phrygian, dread → a pedal under a
minor key); write the bass as the motion of the scene (still, walking, hammering); add pads that move only with the
bass; write the melody last and on the patch whose decay matches the scene's air (bell for cold or night, lead for
day and crowds); use drums only where there are feet. Then take a third of the notes out.

## 6. Tests that keep it honest

- Exactly six pieces, 16–32 bars, looping, one voice per track; the validator's refusals; length rounding;
  `eventsBetween` across a wrap; `themeFor`; the cross-fade timing; the hidden-tab look-ahead (`test/music` in the
  game).
- The native port renders the patches offline and compares samples (its `sound` oracle).

## What to copy, in order

The score format and validator (an afternoon), the look-ahead player with beat arithmetic, then the FM patches — the
patches are where the character lives, and five are enough. Write pieces as mode + tempo + bars first, voices second.
Nobody needs a DAW; a text editor and the validator's errors are the whole toolchain. To try a piece: put its JSON
beside the others, add it to `SCORES` in `music.mjs`, and play it on any page with
`createMusic(createSynth(ctx, ctx.destination), ctx).play('<name>')` plus `update()` on a 100 ms timer.
