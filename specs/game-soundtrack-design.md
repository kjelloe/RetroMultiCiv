# Soundtrack design — brief for the composer

**Status:** commissioning brief (user secured a human composer, 2026-08-01).
Covers **loading/intro music and in-game map music**. The existing effect cues
(combat, build, discovery, disorder…) are a separate, already-shipped synth
layer and are NOT part of this commission — see §7 for how the two coexist.

**The game:** *A World Begun* (project name RetroMultiCiv) — a turn-based 4X in
the tradition of the 1991 original. A session runs **1–6 hours**, mostly on one
screen, with the player thinking. That single fact drives every decision below.

---

## 1. The three rules that matter more than any track

1. **It has to survive hour three.** This is not a shooter where music is heard
   in 90-second bursts. A theme that delights on loop 2 can be unbearable on
   loop 40. Prefer slow harmonic movement, long phrases, and melodic material
   that is *suggested* rather than hammered. If a hook is catchy enough to hum
   after one listen, it is probably too strong for the map layer.
2. **It plays under thinking, not over action.** The player is reading numbers,
   comparing tiles, weighing a war. Music must sit *below* attention and stay
   there. Sparse, unhurried, with air in it.
3. **Silence is a legitimate instrument.** We would rather have 6 excellent
   minutes that breathe than 20 minutes of continuous sound. Tracks may rest;
   the engine can leave gaps between loops (§6).

An anti-goal, stated plainly because it is the usual failure: **no epic
orchestral bombast on the map layer.** Save intensity for the intro and the
endings, where it is earned and heard once.

---

## 2. Track list

Lengths are the *composed* length before looping. "Loop" means seamless
(§8). Priority 1 = commission first; the game is playable and better with only
the priority-1 set.

### A. Front-of-game

| id | where | length | loop | priority |
|---|---|---|---|---|
| `intro-title` | title/setup screen, under the rotating diorama | 1:30–2:30 | yes | **1** |
| `intro-first-launch` | optional: the very first launch only | 0:45–1:15 | no | 3 |
| `loading-age` | the fast-forward wait when starting in a later age | 0:30–1:00 | yes | 2 |

**`intro-title` — the one everybody hears.** It is the first impression and it
plays while the player fiddles with civilization, map type and difficulty, so it
may be heard for 20 seconds or 4 minutes. **Theme:** the beginning of things —
curiosity and open horizon rather than triumph. Something that could be a
folk melody from anywhere on Earth, not a specific tradition. Restrained
percussion or none. It should feel like *before* history, not like a war
about to start. This is the one track allowed a real, memorable melody, because
it is heard at the start of a session rather than for three hours.

**`loading-age`** covers a genuine wait (the world is being fast-forwarded
through centuries under AI control). **Theme:** time passing, accumulation —
a repeating figure that gains a layer every few bars, then resets. Functional
music that makes a wait feel like a process rather than a hang.

### B. The map layer, by era — the heart of the commission

The game moves through five ages. **Track changes on era advance** and this is
the main musical arc of a session: the same world, four times older.

| id | era | length | loop | priority |
|---|---|---|---|---|
| `map-ancient` | 4000 BC → classical | 3:00–5:00 | yes | **1** |
| `map-renaissance` | classical → industrial | 3:00–5:00 | yes | **1** |
| `map-industrial` | industrial age | 3:00–5:00 | yes | **1** |
| `map-modern` | modern age | 3:00–5:00 | yes | 2 |
| `map-space` | space age (endgame) | 2:00–4:00 | yes | 2 |

**The arc we are after**, stated as instrumentation rather than adjectives so it
is actionable:

- **Ancient** — few voices, wide space, no harmony in a hurry. Bone flute,
  frame drum, low drone, a single human voice used as texture. The world is
  mostly unknown; the music should feel like *not knowing what is over the
  hill*.
- **Renaissance** — more voices, real counterpoint, plucked and bowed strings.
  Confidence and craft: the world is being mapped and argued about. Still no
  drums of war.
- **Industrial** — rhythm arrives, and it is mechanical rather than martial.
  Repetition, pulse, iron. This is where the same melodic material from the
  ancient track can return, transformed — the strongest single moment available
  to us if you want it.
- **Modern** — thinner and colder rather than bigger. Sustained tones,
  electric texture, less human breath. The world is fully known and mostly
  spoken for.
- **Space** — genuinely quiet, high and open, almost weightless. The endgame
  runs long and tense, so this must be the calmest track of the set, not the
  loudest.

**A through-line is wanted, not required:** if a small motif (3–5 notes) can
survive all five treatments, the era changes will land as *a story* rather than
a playlist. That is the single highest-value thing in this commission.

### C. Map-shape colour (optional, priority 3)

The game ships nine map shapes. Most need nothing. Two are distinctive enough
that a variant would be felt: **archipelago/islands** (water everywhere) and
**inland-sea/ring** (a world built around a central water). If it appeals: a
`map-ancient-water` variant — same material, different instrumentation
(breath, resonance, less earth) — used at the ancient/renaissance eras on those
shapes. Do NOT write five more full tracks for this; it is seasoning.

### D. Moments (short, non-looping — priority 2 unless noted)

| id | when | length |
|---|---|---|
| `sting-wonder` | a wonder completes anywhere in the world | 0:06–0:10 |
| `sting-golden` | the player's civilization celebrates (We Love the King Day) | 0:04–0:08 |
| `end-conquest` | victory by conquest | 0:20–0:40 |
| `end-score` | the game reaches 2100 AD and is scored | 0:20–0:40 |
| `end-space` | victory by spaceship | 0:20–0:40 |
| `end-defeat` | the player's civilization is destroyed | 0:15–0:30 |

The four endings are heard **once per game**, at the moment a multi-hour
session resolves. They are the only place in this commission where full
intensity is right — and `end-defeat` should be genuinely sad rather than
ominous. The player just lost several hours; respect it.

---

## 3. Length, honestly

Priority 1 alone is **four tracks, roughly 13–18 minutes** of composed music
(`intro-title` + three era tracks). That is a complete, shippable soundtrack.
Priority 2 adds about 8–12 minutes. Priority 3 is optional colour.

Please do not deliver 45 minutes. A smaller set of tracks that are genuinely
good under repetition beats a larger set that is merely present.

---

## 4. Loudness, mix, and the fact that we have effects

- Target **−20 to −18 LUFS integrated** for map tracks — deliberately quiet;
  they sit under sound effects and under a person concentrating. Intro and
  endings may sit ~3 dB hotter.
- **Leave the 1–4 kHz range uncluttered** where possible. Our effect cues (UI
  clicks, combat, discovery chimes) live there, and the player must hear a
  combat result over the music without us ducking it.
- **True peak ≤ −1 dBTP**, no brickwall limiting, no aggressive multiband
  compression. Dynamic range is a feature here.
- **Stereo, but check in mono** — a meaningful share of players use phone
  speakers.

## 5. Delivery

- **Masters:** WAV, 48 kHz, 24-bit, one file per track, named exactly by the
  `id` in the tables above (`map-ancient.wav`).
- **Loop points:** for looping tracks, either compose a seamless loop (last bar
  flows into the first) or supply loop-start/loop-end sample positions in a
  text file. Seamless is preferred — it survives every platform.
- **Stems (optional, valuable):** if the era tracks share material, stems let us
  cross-fade between eras rather than cutting. Not required for delivery 1.
- We handle encoding to web (ogg/mp3) and the Roblox upload; do not pre-compress.
- A rough demo (phone recording, piano sketch) before full production is
  welcome on `intro-title` and `map-ancient` — those two set the palette for
  everything else.

## 6. How the engine will use it

- One track plays at a time; the era track changes when the player's most
  advanced technology crosses an era boundary. Change is **cross-faded over
  ~4 seconds**, never cut.
- Music is a **separate volume channel** from effects, already in the options
  panel, and can be set to zero without silencing gameplay cues.
- Loops may be separated by a **configurable rest** (default a few seconds of
  silence) so a 4-minute track does not feel like a 4-minute treadmill.
- Endings and stings **duck** the map layer rather than stopping it.

## 7. Relationship to the existing sound

The game already ships a complete **procedural synth layer**: ~30 effect cues
(combat, build, discovery per era, disorder, ship-down…) plus two placeholder
chiptune loops (`creation`, `splash`) generated in-browser. Those two loops are
**exactly what this commission replaces** — everything else stays.

Practical consequence for you: the effect cues are chiptune-flavoured, deliberately
retro, and short. The commissioned music does **not** need to be chiptune, and we
would rather it were not — the contrast between a warm acoustic bed and crisp
retro cues reads as intentional. What it must do is leave room for them (§4).

## 8. Acceptance — how we will judge it

1. **The three-hour test.** We will loop each map track for an hour while
   playing. If we reach for the volume slider, it fails, however beautiful it is
   on first listen.
2. **The mono phone test.** Audible and pleasant on a phone speaker.
3. **The cue test.** A combat result and a discovery chime must be clearly
   audible over the music with no ducking.
4. **The seam test.** Loop it 10 times and listen for the join.
5. **The arc test.** Played back to back, ancient → renaissance → industrial
   should feel like one world ageing, not three unrelated pieces.

## 9. Provenance and rights (please confirm before starting)

This is an original game, MIT-licensed code, inspired by a 1991 title but using
no assets from it. The music must be **original** and free of sample-library
licence restrictions that would prevent distribution in a freely available game
and inside a Roblox experience. Please confirm the intended rights grant in
writing before production — it is easier now than after the fact.
