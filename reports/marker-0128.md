# marker-0128 — H13: era-progressive roads + rails

**Tag:** `marker-0128` at `2639c41` · **merge-consistent — the user may
merge this** (supersedes marker-0127). Client + shared render-side only;
gamesim-golden-neutral; the CI visual goldens are untouched (low renders
the exact classic segments).

## Delta since marker-0127

One slice, from the user's 4090 re-playtest feedback (2026-08-15):
"roads need to have a different look through the ages … and for
railroads, just rails, maybe 2-lane rails for the modern era."

- **`shared/city-era.js`** — new pure `roadStageFor(viewerPlayer,
  techsTable)`: stage 0 dirt path (ancient) → 1 cobblestone (any
  renaissance tech) → 2 slim unmarked road (any industrial tech) → 3
  marked road, the shipped classic look (`automobile`) → 4 four-lane
  highway (`plastics` or `space-flight`). `annotateCityEra` takes an
  optional viewer id and stamps `view.viewerRoadStage` (spectators get
  the max over players). Keyed on the VIEWER's own techs — roads have no
  owner, so the annotation is fog-honest by construction and never
  touches hashed state.
- **`client/renderer/three/props.js`** — the road/rail block styles by
  stage at medium/high: per-stage color/width/segment length, cobble
  shade alternation at high, twin dash rows on the 1.7×-wide highway.
  Rails are twin steel lines riding the road segments, double-tracked
  with widened cross-ties from stage 3. **LOW keeps the exact classic
  geometry** — the byte-identity contract held (same-frame `cmp` against
  `debugging/g0-final.png` passed post-change, and the default gallery
  frame the CI golden shoots renders at low).
- **`client/renderer/three/index.js`** — `viewerRoadStage` rides the map
  FNV signature, so reaching a new road era triggers exactly one tile
  rebuild through the H12b delta path; unannotated views (gallery, mock)
  default to stage 3.
- **`client/ui/hud.js`** — passes the current viewpoint into
  `annotateCityEra`.
- **Review surfaces** — `debugging/gallery.html?roadstage=0..4` and
  `?raildemo=1` (turns the row-1 road run into rails; the standing rail
  tile (1,6) hides behind the pop-1 city badge from the fixed camera).
  Both default-off, so the golden scene is unchanged. Review sheet:
  `debugging/h13-road-eras.png` (5 road stages + both rail eras).
- **`playtest.md`** — the 4090 row records the re-playtest: **40–57 fps
  while playing post-H12b** (was 30–60 with dips to 30); the dips are
  gone. Spec `specs/graphics-levels.md` carries the H13 section.

## Verification

- `test/graphics-level.test.js` gains the `roadStageFor` table (null/
  empty/ancient → 0, renaissance → 1, industrial → 2, automobile → 3,
  plastics + space-flight → 4, unknown ids ignored). Battery green:
  graphics-level / asset-recipes / mock-state / render-spec /
  tracked-imports / city-era — 29/29.
- `test-ui/graphics-levels.spec.js` 5/5 (picker, tier budgets + bake
  guard, `?gfx=` link, medium group-pick, live switch).
- Low byte-identity: `cmp` vs `debugging/g0-final.png` — identical.
- Full `node --test test/` run on the tagged commit: see the suite line
  in the tag mail (run started before tagging; results recorded there).

## Open

- Roblox re-mirror: `shared/city-era.js` gained `roadStageFor` — the
  roblox-helper's twin needs the same function (queued to its lane).
- User: merge marker-0128 + redeploy; remaining playtest.md device rows.
