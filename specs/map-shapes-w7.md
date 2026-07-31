# W7 — novelty map shapes (RULED INTO v1, user 2026-07-27)

One ADDITIVE golden window, sequenced after W6 slices 3–5 and before
W8 (unit-doctrine econ pair). This file is the design contract.

## Pre-design check — PASSED (reviewer #2814–#2816, 2026-07-27)

1. **Prior-art (#2814):** today's 4 mapTypes are preset-only
   landPercent/continents knobs on ONE drunkard's-walk generator
   (mapgen.js:56; A82a preset resolve :235–247) — no mask stage
   exists, so W7's is genuinely new; the `options.mapType` lookup
   (:240) is an additive-clean extension point; existing type ids
   keep their exact path, so existing goldens hold by construction.
2. **Wiki authenticity (#2815):** Civ 1 had NO named map-shape
   selector (Customize World = Land Mass/Temperature/Climate/Age
   sliders); Pangaea/Archipelago/Continents/Inland Sea exist in the
   dump only as Civ4+ articles. NOT a blocker (precedent: the shipped
   presets are themselves non-Civ1). **REQUIREMENT: W7 mapTypes carry
   a provenance note ("later-Civ shapes", civ-mixing convention).**
3. **Determinism/twin flags (#2816):**
   - **wrapX seam:** generateWorld hardcodes `map.wrapX = true`
     (:247) — ring/inland-sea masks run on a CYLINDER, so every mask
     must be wrap-aware at x=0 or it seams (pathing + render). Pin a
     determinism check with a start straddling the seam.
   - **Clover balanced starts = the highest-risk piece** (petal
     placement moves civ starts = different games): it lands INSIDE
     the golden window with its own pin + pure-int twin; the
     ship-behind / fall-to-v1.x fallback below is endorsed.
   - Per-shape JS==Luau pins (incl. fractal) + per-water-shape naval
     soaks endorsed.

## What ships

New `rules.mapTypes` entries + mapgen support, all additive (existing
type ids and their generation paths byte-untouched → existing goldens
hold; each NEW type gets its own maptype pin pair, JS==Luau):

1. **fractal** — an erraticness/roughness variant of the existing
   drunkard's-walk generator (possibly preset-only knobs: more, smaller
   walk budgets + jitter). Cheapest item; do first as the window's
   smoke test.
2. **oval** — Pangaea variant masked to a smoothed oval with
   randomized coastal bays.
3. **ring** (donut) — circular landmass around a central sea; explicit
   clockwise/counter-clockwise neighbor paths.
4. **inland-sea** — land ring along the map borders, ocean locked in
   the center.
5. **clover** (four-leaf / snowflake family) — symmetric petals per
   start region choking to a contested center. **The hidden cost is
   BALANCED STARTS**: petal-assignment start placement (one civ per
   petal, symmetric quality) — without it the shape loses its point.
   Budget this as its own sub-slice; if it drags, clover ships behind
   the others or falls back to v1.x by user call.

Mechanism: a MASK STAGE in `engine/mapgen.js` — the land-blob budget
is confined to a per-type mask function (pure, integer math, twins
byte-shaped to `luau/`). Fractal is generator-knobs, not a mask.

## Explicitly OUT (deferred, user 2026-07-27)

- **Toroidal wrap** (Y-wrap) — touches every distance/direction/BFS
  calculation, mapgen pole handling, fog, minimap, renderer tiling, AI
  pathing + the full Luau twin of all of it. Stays on the v2 shelf.
- Cylindrical + flat wraps need NO work: `map.wrapX` already
  implements both (movement.js wrapX/DIRS distance math).

## Gates & verification

- Per-shape: maptype pin (the luau-twins gate pattern, extending the
  existing 4-pin table) + a scenario-free determinism check (same seed
  → same hash, JS==Luau).
- Water-heavy shapes (ring, inland-sea, archipelago-like fractals): a
  mini naval-acceptance soak each (the naval arc's acceptance was
  archipelago-specific — AI must not faceplant on the new topology).
- One canonical 25-seed sweep on the DEFAULT type at the end proves
  the window was truly additive (goldens unmoved = the cheap proof).
- Client/lobby: setup screen + LAN lobby type picker rows +
  `?maptype=` param; Roblox inherits mapgen via the twin, needs only
  the picker addition (roblox-helper, golden-neutral).

## Estimate

~2–3 days including gates; +~1 day if clover's balanced starts are
done properly. Fractal+oval land first (low risk), ring/inland-sea
next (naval soaks), clover last.

## Delivery log

**2026-07-29 — landing 1 (mask stage + four shapes), local green, gates pending.**
Fixture-first: `test/map-shapes.test.js` 6/6 (was 3 RED before the engine
change). What shipped:

- **The mask stage** (`engine/mapgen.js` `maskAllows` + a `mask` argument to
  `generateTiles`, twinned byte-shaped in `luau/mapgen.luau`). Geometry:
  offsets from the map centre in DOUBLED coordinates (so the centre is exact
  on even sizes), expressed as PERCENT of the half-extent — a shape is
  therefore size-independent and needs no per-size tuning. `maskAllows`
  returns false inside `innerPct` and outside `outerPct`; both default to 0
  (= no constraint on that side).
- **Wrap-awareness**: the x offset takes the short way round the cylinder
  (`if (width*2 - dx < dx) dx = width*2 - dx`). The pre-design flagged the
  seam as the determinism risk; the `inland-sea` fixture is the guard — its
  rim must carry land at both `x < 3` and `x > W-4`, which a left-edge-based
  mask cannot do.
- **Start placement under a mask**: the drunkard's walk needs a start INSIDE
  the mask or it spends its whole budget in forbidden sea. Bounded re-rolls
  (40 tries, so the RNG draw count stays finite and identical in both
  engines), then a deterministic index-order scan as the fallback. Step
  budget goes from `budget*10` to `budget*20` when a mask is present, since a
  masked walk wastes steps outside the shape. Unmasked types keep both the
  old start pick and the old budget — the legacy path is byte-untouched.
- **Presets** (`data/rules.json`): `fractal` (knobs only — 26% land over 30
  walks, NO mask and NO engine code), `oval` (outer 95), `ring` (inner 45,
  outer 95), `inland-sea` (inner 50). Each carries the REQUIRED
  `provenance` field ("later-Civ shape (Civ 1 had no map-shape selector)"),
  which the setup screen now shows in its hint line.

**Geometry decision — `ring` is a donut around the map centre, not a belt
around the cylinder.** With a wrap-aware x offset, `x=0` is the FARTHEST
column from the centre, so the annulus excludes both the middle and the
extreme columns: sea inside, sea outside, land between. A belt (land that
closes all the way round the cylinder) is the `inland-sea` shape instead.
The ring fixture therefore asserts the donut property (land above AND below
the central sea) and the seam assertion lives with `inland-sea`.

**Client:** the picker was already data-driven from `rules.mapTypes`, so the
new shapes appear with no client work. The stale A82a gate group ("Advanced —
naval AI in progress") was RETIRED in the same pass — that caveat has been
false since the naval arc shipped (transport + overseas invasion, 25/25
archipelago acceptance). Groups are now Classic / Novelty shapes.

**Stamp cascade (expected, in progress):** adding `rules.mapTypes` entries
moves `rulesetHash`, so every createGame-stamped golden re-records. Done so
far (NINE types after clover — the four-shape values were superseded before
they were committed): `continents 856e4f41`, `pangaea 6862c666`,
`archipelago 3da45b9f`, `islands c76a076f`, `fractal 518a87cb`, `oval
cd182fc7`, `ring 590c6afd`, `inland-sea 800566b0`, `clover 2687aec3`;
scenario 002 `0x6d55a5c0`; age-snapshot `CANONICAL_PIN 0x43ad9e40`. **#28 CLASSIFICATION: STAMP-ONLY, verified.** Every BEHAVIOR_* value came back
BYTE-IDENTICAL to the W6 slice-5 record (`0x184dd153 / 0xab85ec57 /
0xc94f7592 / 0xe956700a`, natural `0xbf1918cd`) while every GOLDEN_* moved —
the trajectory never changed, only the rulesetHash the world is stamped with.
Natural 545 / winner p2 held a FIFTH consecutive re-record. The same run also
covered the A91c warming fix, which likewise left BEHAVIOR unmoved (a golden
game has to actually warm an OCCUPIED ocean tile for it to bite).
Re-recorded: `GOLDEN_SOAK` 100 `0x3d9f5881` / 200 `0x7a322cd1` / 300
`0x1847cebe` / 400 `0xfcebe728`; `GOLDEN_NATURAL` 545 p2 `0xa1c6e53a`;
sim-smoke t100 `0x3d9f5881` (Luau reproduces it bit-exact); `FF_PARITY`
`0xf22d9ba5`; age-snapshot `CANONICAL_PIN 0x43ad9e40`; scenario 002
`0x6d55a5c0`; the nine maptype pins above.

**CLOVER LANDED IN THE SAME PASS (2026-07-29)** — folded in before the
re-record finished so the window pays ONE stamp cascade instead of two.
- Mask: four mirrored petals (`maskPetalPct` 55 from centre, `maskLobePct` 38
  radius) joined by a central hub (`maskHubPct` 22), so each petal chokes onto
  contested middle ground. Because the offsets are ABSOLUTE, testing one petal
  centre covers all four.
- **Balanced petal starts — measured, not assumed.** The contract called this
  the hidden cost and it was right: with the stock start finder, five seeds
  gave only 2–3 DISTINCT petals of 4 (civs piling into two lobes, which
  removes the whole point of the shape). `findStarts` now takes a `petals`
  flag: the Nth civ wants the Nth petal, and the demand RELAXES together with
  the existing `minDist` relaxation, so a cramped world still fills every seat
  instead of failing. Result: 4/4 distinct petals on every seed tested, and
  7/14-civ games spread 2/2/2/1 and 4/4/3/3. Twin ported (`petalOf`).
- Fixtures: `test/map-shapes.test.js` now 7/7 (clover asserts land only in
  petal-or-hub, plus one-civ-per-petal across three seeds). A real-client
  smoke shot boots `?maptype=clover` with the settler placed in a petal.
No fallback to v1.x was needed.

**Still to come in this window:** the per-shape naval acceptance runs for the
water-heavy shapes against the sim-runner's pre-baseline, and the closing
canonical sweep on the DEFAULT type that proves the window was additive.

## Commit map (the history is honest, one subject line is not)

`6cd56ef` is labelled "engine(a91c): USER RULING — beach the cargo" but ALSO
carries the entire W7 mask stage: W7 files were staged when the small A91c
ruling was committed and `git commit` swept them in. The git operator pushed
further commits on top, so the history stands as-is and the record lives here
instead. To review W7, diff the RANGE `4ba54e4..6b4f03c`, not the subject
lines. `e8323a0` + `6500ac2` carry the re-record pin edits; `6b4f03c` restores
`data/rules.json` to its compact formatting after a JSON re-serializer
exploded the whole file (content deep-compared byte-equal; maptype pins
unmoved).

## Naval acceptance — measured verdict (2026-07-31)

The contract asked whether the AI *plays* the water-heavy shapes. Direct counts,
`debugging/probe-mapshape-naval.js`, 7 civs, canonical config:

| shape | games | cities | coastal | transport hulls alive | **overseas cities** |
|---|---|---|---|---|---|
| ring | 5 × 200t | 539 | 71.8% | 59 | **0** |
| inland-sea | 5 × 200t | 582 | 68.0% | 57 | **0** |
| oval | 5 × 200t | 617 | 64.7% | 49 | **0** |
| ring | 3 × 400t | 352 | 71.3% | 59 | **0** |
| **archipelago (control)** | 3 × 400t | 217 | 88.0% | 35 | **5** |

**Reading the zeros honestly took three passes, and the first two were wrong.**

1. First reading — "the AI builds a navy and never crosses" — outran the
   evidence.
2. Second — "it simply never *needed* to; the land is spacious" — was testable,
   so I tested it: ring holds ~1116 land tiles (≈112 cities at normal spacing)
   and the 400-turn run founded **117 per game**. The landmass is SATURATED and
   the zero holds. Expansion adds ~9 cities per game between t200 and t400: the
   AI stops expanding rather than crossing.
3. Third — "maybe the probe cannot detect a crossing at all" — is why the
   ARCHIPELAGO CONTROL matters. It reports 5 overseas cities on the same
   instrument, so the metric fires when the behaviour happens. The zeros are
   real and specific to these shapes.

**Why:** on archipelago a civ is boxed in from turn one, so the naval path
(stranded settler → carrier ferry → overseas site) triggers early and the
acceptance passed 25/25. On ring/inland-sea each civ owns a generous arc, always
has a *local* site, and never enters that path — then simply halts at saturation
instead of re-evaluating across the water. Same for oval, where a single
landmass makes the zero partly expected.

**SECOND CONTROL, and it reframes the finding (2026-07-31).** The same probe was
run on **continents — the DEFAULT map type** — at 400t/7civ: 430 cities, 74.7%
coastal, 69 sea units, **0 overseas cities**. So this is NOT a novelty-shape
defect at all: the AI declines overseas settlement on the shipped default map
exactly as it does on the new shapes, and archipelago is the outlier where the
map forces the behaviour. That makes the ship ruling stronger than the original
argument — the novelty shapes are **no worse than the default** on this axis, so
shipping them adds variety without adding a regression. It also widens the v1.x
item: the doctrine gap is general overseas expansion, not something these three
shapes provoke.

**Assessment:** these shapes are PLAYABLE, not broken — hundreds of cities,
navies built, 65–72% coastal cities, and no GAME-CORRECTNESS invariant breach.

**Correction to an earlier claim (2026-07-31).** The recommendation originally
said "no invariant breaches" on the strength of the 200-turn runs. The 400-turn
inland-sea run then breached on seed 2 at t231, so that claim was stated at more
confidence than the evidence carried. Root-caused: it is the DIAGNOSTIC UNIT
TRIPWIRE (`1006 units > 1000`), which `test/sim-driver.js` documents as a
deliberately tight diagnostic cap — not a rules invariant. It is a known,
pre-existing class that fires on dense 7-civ games (the canonical sweeps hit it
on seeds 17/19/25 at identical rates on pre-W7 SHAs, and marathon runs cross
1000 units around t900 by design, which is why the cap is env-overridable).
Nothing about it is map-shape specific, so the ruling stands — but the precise
statement is "no game-correctness breach", not "no breaches". What the AI does not do
is contest the far side. A human player gets the variety immediately; the AI is
simply a weaker opponent on the water half of these maps.

**Recommendation (the user rules — human-workitems B3):** SHIP them as the
labelled "Novelty shapes" they already are (opt-in, never the default), and file
"re-evaluate overseas expansion when the home landmass saturates" as a v1.x
doctrine item. Rationale: the fix is an AI behaviour change that deserves its own
measured window with its own coverage proof, and rushing it at RC would put an
unmeasured doctrine change into the release — exactly the trade W6 taught us not
to make. Holding the shapes back instead would cost the human-facing variety
that is the whole point of W7, to fix an opponent-strength gap on three opt-in
map types.

### RULED (user, 2026-07-31): SHIP

The recommendation was accepted. The five novelty shapes ship in v1.0 as the
labelled, opt-in "Novelty shapes" group they already occupy in the picker — the
default remains Continents, so no player meets a water-heavy shape without
choosing it.

**Rationale, recorded so the trade is legible later:** the shapes are playable
and measured (hundreds of cities per game, no invariant breaches, navies built,
65–72% coastal); the gap is opponent STRENGTH on the water half of three opt-in
maps, not correctness. Holding them would cost the human-facing variety that is
the entire point of W7. Fixing the AI now would mean landing an unmeasured
doctrine change during the release candidate — the trade W6 taught us not to
make, where a hash moving is not evidence a mechanism fires. So the variety
ships now and the AI improvement gets its own window with its own coverage
proof.

Filed for v1.x: **"re-evaluate overseas expansion when the home landmass
saturates"** — see `specs/unit-doctrine-v1x.md`.
