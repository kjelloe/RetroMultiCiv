# River terrain — the 12th Civ1 terrain (USER-RULED IN, 2026-07-25)

User ruling: add River "when proper, and let's make it good." An
ENGINE WINDOW (mapgen moves every map-dependent golden): owner =
bugfixer, slotted coastal-build → RIVER → D3-surfacing → D4–D6.

## Authority + conflict resolution

The reviewer's dump fact-check (#2462) is the authority; the user's
pasted description is non-authoritative and DIFFERS in two places —
resolved per the data-source doctrine:
- Yields: **2 food / 0 shield / 1 trade** (dump; the paste's "2 food
  2 trade" is not adopted). Special = the grassland-style Shield
  (+1 shield → 2/1/1).
- Movement: **1 MP to enter** (dump explicit; the paste's
  "crossing costs all remaining MP until Bridge Building" is not
  adopted — no dump support).
- Adopted FROM the paste (dump silent, good design targets):
  mapgen shape = **long meandering continuous strips**, frequency
  **~10–12% of landmass** (our knob; document as ours).
- Agreed by both: **+50% defense**; roads on river ONLY after
  **Bridge Building**.

## The build (fixture-first, JS + Luau one window)

1. **Data**: `river` enters through the MAPDATA PIPELINE
   (tools/mapdata.js overlay tables → regenerate data/terrain.json —
   never hand-edit the generated JSON): yields 2/0/1, special
   Shield {2,1,1}, move 1, defenseBonus 50, `irrigate` +1 food
   (rivers self-satisfy the water-adjacency rule), NO `mine` field
   (blank = illegal, the existing legality idiom), road +1 trade.
2. **Road tech gate**: a terrain-level `roadTech` field (only river
   sets it, = bridge-building's tech id) checked in
   improvements.js's road/railroad legality. Generic shape, one
   consumer.
3. **Mapgen**: seeded meandering strips — springs seeded in
   hills/mountains, deterministic walk toward the nearest coast,
   target ~10–12% of LAND tiles (tune on the gallery + 3 seeds);
   all randomness through the existing rng stream discipline
   (rollRange), placement BEFORE the specials pass (rivers roll
   specials like everyone).
4. **Renderer**: client/renderer/three/terrain.js entry (heights +
   palette — a water-blue-green band distinct from ocean at land
   height; the surface reads as a ribbon because the STRIPS give the
   shape) — test/mock-state.test.js enforces coverage. Gallery row +
   screenshots for user acceptance.
5. **Engine audit**: every `t === 'ocean'`/domain check that means
   "water" must NOT match river (river is LAND: units walk it, cities
   found on it, cityIsCoastal does NOT count it, ships may NOT enter
   it). Grep-audit domain assumptions; river's domain = 'land'.
6. **Twins + goldens**: luau mapgen/terrain twins byte-shaped; FULL
   honest re-record (mapgen changes every map: sim goldens, scenario
   002 mapgen-determinism, map-type anchors, FF_PARITY,
   CANONICAL_PIN re-bake, luau anchors); crafted fixture: found-on-
   river defense + irrigate-legal + mine-illegal + road-gated-by-
   bridge-building. 25-seed sweep gate (mapgen = behavioral
   everywhere; invariants + floors, trajectory drift expected).
7. **Roblox mirror**: TileProps river visual + gate-4 re-bake
   (roblox-helper follow-up after the browser lands).

## Companion item (smaller, separate window): per-terrain work times

The user's Civ1 table shows improvement TIMES vary by terrain
(desert mine 5 vs jungle 15; hills irrigate 10; …) — our
rules.workTurns is flat per improvement type. Queue as
`workturns-terrain` AFTER river: reviewer fact-checks the full
table vs the dump FIRST (the paste's Ocean row showing road/fortress
times is suspicious — likely a transcription artifact), then the
shape: per-terrain overrides `terrain.workTurns = {mine: 15, ...}`
falling back to the flat rules.workTurns. Behavioral (settler
timing) → honest re-record; riders into the same sweep if windows
can merge.

---

## RULED (A) — ENHANCE THE FLAG (architect #2522, built #36 by bugfixer 2026-07-25)

The design-read (#2521) found `tile.river` ALREADY EXISTS as a deeply-integrated
FLAG (10 files: trade + defense + irrigation-water + road-gate + flood + AI
scoring), so the terrain-type sections above are the ROAD NOT TAKEN. Ruled (A):
enhance the flag, no new terrain type. Provenance label: **"river = feature-on-
terrain (Civ2-shape data model) with Civ1-authentic effects + distribution"**.

WHAT SHIPPED:
- **Mapgen (engine/mapgen.js + luau twin)**: the short-random-walk river pass
  replaced by meandering CONTINUOUS strips — a distance-to-ocean multi-source BFS
  (N4 order, ocean-index queue order) then gradient-descent-with-meander from
  hills/mountain springs to the coast, ~`RIVER_PCT`=11% of land, `MEANDER_PCT`=25%
  free-wiggle (OUR knobs). Deterministic; JS==Luau map hashes verified.
  Accepted quirks (architect #2527): confluences (flagged tiles don't recount),
  spring-exhaustion undershoot on low-hill maps (never force with synthetic
  springs), free meander can wander (maxSteps + flagged-set bound it).
- **Effects — ALREADY PRESENT, verified vs the dump, no change**: riverModifier
  tradeBonus 1 (grassland 2/0/0 → 2/0/1), defenseBonus 50, Shield special 2/1/1;
  road-on-river needs Bridge Building + mine-on-river illegal (B19,
  improvements.js); irrigation self-satisfies water; river domain = land (ships
  never enter; cityIsCoastal excludes — river is not ocean).
- **Renderer**: the existing RIVER_TINT lerp now reads as a ribbon because the
  strips give it shape.
- **Goldens**: FULL honest re-record (every generated map moved) + CANONICAL_PIN
  re-bake + 25-seed sweep.

## FOLLOW-UP: FIX (A) — HILLS EXCLUDED FROM FLAGGING (architect #2573, built by bugfixer 2026-07-24)

The post-#36 25-seed sweep breached the M3-pop floor (23.5 < 28) with M2-cities
at-floor. Investigate-first ruling #2553: the reviewer's yields gate was GREEN, so
the driver was DISTRIBUTION, not per-tile yield. The bugfixer's distribution audit
(#2570, `debugging/river-dist-audit.mjs`, 25 canonical worlds) found the mechanism,
code-backed:
- **Coverage** is a hard ~10.9% of land every seed (~2-3x the old effective rate).
- **~38% of every river strip landed on HILLS** (median ~55/world). Hills are 0 base
  shields / **mine +3**, and B19 forbids mining a river tile → each river-hill was a
  3-shield mine pinned at 0 (only +1 trade back): ~165 potential shields/world locked,
  concentrated in prime early-production hill country. This is the shield-starvation
  path behind the M3-pop + M2-cities drop. An inauthentic world-tax (Civ1 rivers are
  prime land, not a penalty).
- **~48% of AI cities** sat on/adjacent to river (the +6 founding score pulls sites on;
  flood popPct 25 then taxed ~half the empire's growth). Left AS-IS — flood is a
  Civ1-authentic disaster and city-walls are the authentic answer.

**FIX (A), surgical:** the spring still STARTS in hills/mountains, but the river FLAG is
never SET on a hills tile (mountains were already excluded) — the strip walks through
hill country unflagged and flags the first non-hills tile downstream. One guard clause
in the flag step of `engine/mapgen.js` + its byte-shaped `luau/mapgen.luau` twin. Zero
effect-table change; coverage + ribbon feel preserved (the loop consumes more steps/
springs to reach the same land-share target). NO `RIVER_PCT` change this pass.

**Goldens (honest behavioral re-record — every generated map reshapes):** simulation
GOLDEN_SOAK 0x4ad2ff18/0x56c109f8/0x4b2598b2/0xe39fa9a8, GOLDEN_NATURAL 0x634ee751
(545/p2), BEHAVIOR_SOAK 0xd2693e81/0x29b5ab0f/0xa1d22931/0x17f1b937, BEHAVIOR_NATURAL
0x193a7466; scenario 002 0x4979add6; luau-twins map anchors 0x3ea8ca4d/0xa2e4615e/
0x23f99df3/0x989b4077 + turn-100 0x4ad2ff18 + FF_PARITY 0xdf8dce5c; age-snapshots
CANONICAL_PIN 0x7fa058f2 (+ 21-snapshot re-bake). JS==Luau map hashes verified identical
on all 4 map types. Seed re-pins: build-priority 3→6 (wonder-drive fires t71, persists
52); fastforward unchanged. The post-fix 25-seed sweep is the marker-0103 gate.
