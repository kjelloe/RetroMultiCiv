# Designer-ally response — evening 2026-07-20 (VERBATIM, relay via user)

Answers to specs/ally-status-update-2026-07-20-evening.md. Four design
deliveries + the space-race pacing verdict. Stored verbatim; the routing notes
live in specs/refinement-xiv.md (§15/§17/§26/§29) and
specs/xii5-ai-victory-drive.md (§10).

---

### First: congratulations

This is a real milestone. A public browser build with multiplayer, cross-device play, and a **396-turn replay that remains bit-for-bit deterministic** is an exceptionally strong foundation.

The test server at [RetroMultiCiv](https://multiciv.kjell.today/client/?server=1) is exactly the right moment to start gathering player-facing evidence rather than only simulator evidence. And it is excellent that the discovery cards, Civilopedia blurbs, and tooltips are already live.

### 1. Tech-discovery celebration

The moment should feel like **a civilization-wide realization**, not merely an achievement toast or loot reward.

Recommended sequence:

1. **Brief world pause / soft dim** — the map remains visible behind the overlay, but visibly recedes.
2. **Era-colored glyph appears first**, large and centered, with a short simple reveal motion: draw-in, unfold, or settle.
3. **Tech name follows**, then the discovery blurb.
4. **A subtle era-specific fanfare**, no longer than two to three seconds:
   - Ancient: drum / reed / struck bronze character.
   - Classical-Medieval: strings or bell-like tone.
   - Industrial: measured brass / mechanical rhythm.
   - Modern: clean rising electronic or orchestral-synthetic chord.
5. **A clear consequence panel:** concise rules-derived unlocks, in a separate area from flavor.
6. **Two deliberate exits:** `Continue` and `Choose Research`.

Avoid auto-closing at three seconds. Let the fanfare last roughly three seconds, but keep the card open until the player decides. A tech discovery is a reward for planning; on a phone especially, players should not have to race the UI to read it.

Suggested card hierarchy:

```text
[ era-colored tech glyph ]

ADVANCE DISCOVERED
Writing

"Words can now travel across time and distance without changing.
Records give rulers, merchants, and scholars a longer memory."

UNLOCKED
• Library
• [other rules-derived unlocks]

[ Continue ]     [ Choose Research ]
```

For later polish, the glyph should make the celebration recognizable even before reading the name. That links the new procedural glyph system, the tech tree, research readout, and discovery moment into a coherent visual language.

**Provenance:** `original`, with the emotional cadence of early Civilization discovery moments.

### 2. Roblox "Studded" / "Brick" world style

**Strong yes**, provided it is a complete visual translation rather than only "current assets with studs added."

The guiding rule:

> Preserve gameplay silhouettes and terrain readability first; let the charm come from chunky proportions, visible construction, and cheerful color blocking.

#### What should remain consistent across all world styles

- Terrain-color language: water, flat land, hills, mountains, forest, desert, tundra must still scan instantly.
- Faction recognition: bases, banners, trim, rings, and city markers retain the same ownership conventions.
- Unit class silhouettes: cavalry must remain clearly different from infantry; ships from land units; aircraft from both.
- City progression: population produces density/scale; era changes roofline and skyline.
- Camera framing, selection treatment, movement readability, and fog behavior must remain mechanically identical.

#### What may become deliberately blocky

| Element | Brick-style direction |
|---|---|
| Terrain | Broad square-ish plateaus and stepped slopes; use visible studs sparingly on flat tops, never so densely that tile borders vanish. |
| Hills | Two or three clearly stepped height levels, with wide flat tops—not lumpy random terrain. |
| Mountains | Large faceted or stacked-brick peaks with a very readable summit cap; mountains must remain unmistakably taller than hills. |
| Forests | Round-canopy trees become stacked cones/cylinders or chunky clustered crowns. Favor grouped blocks over hundreds of tiny pieces. |
| Units | Slightly oversized "toy army" silhouettes, with broad heads/helmets, clear weapon angles, and large readable hulls/wings. |
| Cities | Low block clusters at small sizes; tiled/brick/concrete era cues become increasingly formal block arrangements. |
| Water | Flat bright planes with a restrained repeating inset/plate pattern; do not let studs compete with ship silhouettes. |

#### Specific direction

- **Use studs as texture punctuation, not blanket noise.** A few studded surfaces establish the style. Studding every terrain face will make the strategic board visually busy.
- **Keep terrain flatter than it feels tempting to make it.** The toy-brick style naturally gains visual depth from block seams and bevels; it needs *less* terrain relief, not more.
- **Favor chunky color planes.** Saturation can be high, but values must still separate terrain categories. A bright grassland should not become indistinguishable from a bright forest.
- **Make cities charmingly modular.** A size-1 ancient city can be three blocky huts; a modern large city might be stacked glassy slabs, a dome, and a spire. This will feel native to the style without compromising the size × era contract.
- **Do not use tiny decorative parts** for flags, windows, tracks, or studs at tactical zoom. They turn into visual static.

I would treat `Studded` as the player-facing display label and `brick` as an internal renderer-style identifier if a code-facing term is useful.

**Provenance:** `original`, adapted to Roblox's native visual vocabulary without using a third-party brand identity.

### 3. Terrain relief

The playtest feedback is right: if normal grassland reads as hilly, then the terrain has spent its most important depth cue too early.

Use **three strong relief tiers**, with a clear visual gap between each:

| Terrain class | Suggested relative elevation | Top-down read |
|---|---:|---|
| Water | 0 | basin / sea level |
| Flat land: grassland, plains, desert, tundra | 1 | almost level board surface; only minor faceting |
| Hills | 2.5–3 | obvious raised plateau or rolling landform |
| Mountains | 6–8 | dominant landmark, visually separate from all playable ordinary land |

The precise numerical units can differ by renderer; the proportional separation matters.

#### Art direction rules

- **Flat terrain should have color variation, not elevation variation.** Low-poly facet shading can provide life without falsely signaling a hill.
- **Hills should have broad shoulders and a readable plateau.** They should look like a raised landform, not a noisy field of micro-peaks.
- **Mountains should own the skyline.** At strategic zoom, a player should identify mountains immediately, even in peripheral vision.
- **Avoid random per-tile vertical jitter** on flat terrain. It damages board readability and makes city/unit grounding look unstable.
- **Forests may add canopy volume above terrain**, but the ground beneath them should still obey the underlying terrain class. A forest on grassland should not accidentally read as hills.

A useful screenshot test: desaturate the scene. If flats, hills, and mountains remain distinguishable from height and silhouette alone, the relief hierarchy is working.

### 4. First-page hint copy

Recommended title: **"New here?"** rather than a formal "Help" label.

- **Start Game**
  Begin a new single-player world. Choose your civilization, map, and opponents, then lead your people from their first settlement onward.

- **LAN Game**
  Host a multiplayer game for people on your network. Create a lobby, choose the settings, and share the join code when you are ready.

- **Join Game**
  Enter a five-letter join code to meet friends in an existing multiplayer lobby. You can join before the host starts the game.

Keep the arrows and hints dismissible with one obvious `Got it` button. On mobile, make the callout cards large enough to remain legible without requiring precision taps.

### Space-race pacing verdict

A spaceship victory **should be attainable in a normal full-length game**, but it should be uncommon and should usually arrive only after the winner has demonstrated sustained late-game advantage.

My recommendation:

- **Normal-length standard game:** Space victory should plausibly occur around turns **300–400** for a strong, peaceful, well-managed civilization.
- **Fastest exceptional game:** perhaps around turns **250–300**, but only through unusually favorable conditions and committed research/production choices.
- **Most ordinary contested games:** conquest, diplomacy, score, or the turn limit should often resolve the game first.
- **Not marathon-only:** if Space is almost never reachable outside an unusually long session, the modern research tree and spaceship program become content players rarely get to experience.

The key is that reaching Space must demand a tradeoff. A civilization pursuing it should visibly prioritize research infrastructure, industrial capacity, and secure territory—making it somewhat more vulnerable than an all-in conqueror if diplomacy and military pressure are functioning.

For the current measurement lane, report:

- first civilization to unlock `space-flight`;
- first spaceship component begun and completed;
- all required components complete;
- launch turn;
- victory turn;
- research leader changes after industrialization;
- whether the space leader was ever under meaningful invasion pressure;
- how often a would-be space winner was interrupted or overtaken.

That will distinguish **"Space is impossible"** from **"Space is possible but strategically contestable,"** which is the desired feel.
