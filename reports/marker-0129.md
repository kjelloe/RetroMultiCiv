# marker-0129 — H13b: roads run into cities, every tier

**Tag:** `marker-0129` at `aaa5d90` · **merge-consistent — the user may
merge this** (supersedes marker-0128). Client render-side only;
gamesim-golden-neutral. The gallery VISUAL golden is re-recorded from CI
actuals in this marker (low changes deliberately — ruled a fix).

## Delta since marker-0128

One slice from the user's follow-up: "roads, not railroads, should
extend into cities when adjacent to a city."

- **`client/renderer/three/props.js`** — a city tile now draws the
  road's other half: a centre-to-edge segment toward every neighbour
  that CARRIES a real road, styled by the viewer's H13 road stage,
  always as a plain road (`isRail` forced off on city tiles — rails
  still stop at the city edge). Guards: `roadAt(x, y, real)` — city
  halves connect only to tiles with real road flags, so a roadless city
  next to another city sprouts nothing; city tiles never draw the
  isolated-road stub.
- **All tiers, including low.** Ruled a fix rather than an upgrade: a
  road dying one tile short of the city it serves reads as a bug at
  every tier. `debugging/g0-final.png` (terrain-swatch frame, no
  cities) stays byte-identical, so the low-identity instrument
  survives; the default-frame gallery golden re-recorded (below).
- **`debugging/gallery.html`** — permanent road→city demo (road at
  (6,6), city Eight at (6,7)) and `?nolabels=1` (renderer
  `setCityLabelsVisible(false)`): the pop badge floats over the tile
  BEHIND its city from the fixed camera and hides exactly the props
  under review. Review sheet: `debugging/road-city-tiers.png` (all
  three tiers, badge-free).
- **Golden re-record** — `debugging/goldens/gallery.png` replaced with
  CI run 31878952454's actual (the CI-authoritative source). The pixel
  diff is confined to the row-6/7 band (city One's road stub toward the
  rail tile + the new road-into-Eight demo). CI's splash MATCHED its
  golden — the local splash mismatch seen during verification was the
  documented local-vs-CI chromium difference, not a change.

## Diagnosis note (recorded in the spec + art-variants skill)

The medium join initially looked absent. It was occluded (pop badge +
tall kit houses) and low-contrast — a headless `createTileProps` probe
(Node with a `three`-alias loader) proved the instance matrices
existed, and a magnified crop found them in-frame. Lesson: magnify the
exact pixels, and shoot with `?nolabels=1`, before concluding geometry
is missing.

## Verification

- Graphics battery 29/29 (graphics-level / asset-recipes / mock-state /
  render-spec / tracked-imports / city-era).
- `test-ui/graphics-levels.spec.js` 5/5.
- Local full suite on the H13b commit: 1060/1061 pass, 0 fail, 1
  self-skip.
- `ui-dev-night` on the H13b push: success.
- Nightly-soak dispatch 31878952454: suite job's TEST step green; only
  the visual byte-compare failed (the expected pre-re-record state);
  ui-lane job green; soak jobs were still in progress at tag time and
  gate nothing in this marker.
- Low byte-identity: `cmp` vs `debugging/g0-final.png` — identical.

## Open

- Roblox re-mirror queue (roadStageFor from 0128; the city-half rule is
  renderer-side and lands with the roblox road styling mirror).
- User: merge marker-0129 + redeploy; remaining playtest.md device rows.
