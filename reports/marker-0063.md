# marker-0063 — golden-neutral batch (city-era determinism fix + Civilopedia blurbs)

**Tag:** `marker-0063` → `508beab`
**Class:** gamesim-golden-neutral (client/shared/spec/test only — no engine/data-ruleset/luau/save semantics changed).
**Reviewer gate:** clean-clone GATE GREEN at `508beab` (#1819) — 625 tests / 623 pass / 0 fail / 2 env-skip; luau 400-turn reproduces `0xf68d015b` identically across the whole batch (engine untouched, golden-neutral confirmed by hand + machine).
**Breaking:** none. Safe merge. Merging this does NOT change AI behaviour or any golden.

## Delta since marker-0062

marker-0062 was late-game save loading. Since then, the accumulated golden-neutral
coder-helper work landed on dev_night (XII.6 tech-tree/beeline/glyphs, city-era-looks,
run-F fixes, the 68 ally tech blurbs + pedia concepts, mobile UX). This marker caps
that batch with the two items that were gating it:

### 1. City-era determinism fix (side-map) — the blocker the reviewer caught (#1770 → #1801, `42abf04`)
- **REAL #1 (state contamination):** `annotateCityEra` (shared/city-era.js) had been
  stamping `c.eraBand` onto view city objects, but `filterView` aliases own/omniscient
  city objects straight from real state — so every browser hud refresh injected
  `eraBand` into `state.cities`, tainting every hash path (Shift+D recordings,
  `?debug=1`, replay-theater). Soak/twins stayed green (headless, no hud) which is why
  it slipped the goldens. **Fix:** a side map — `view.cityEraBands[id] = band` on the
  fresh top-level view; the renderer (index.js `buildCities` → assets.js
  `createCityMesh` 4th arg) reads it; gallery/mock keep a `city.eraBand` fallback.
  Regression pin added (annotateCityEra leaves the state hash unchanged).
- **REAL #2 (render-spec drift):** `node tools/render-spec.js` regenerated
  specs/render-spec.json for the city-era geometry; the A43 drift guard is 3/3.
- **Effect for the user:** browser Shift+D recordings and `?debug=1` hashes are clean
  again — they verify against the engine/server truth. (Gameplay was never affected;
  the reducer never read `eraBand`.)

### 2. Unit + building Civilopedia blurbs (run-F #9, helper P2, `508beab`)
- New data table `client/ui/unit-building-blurbs.js`: `UNIT_BLURBS` (28) + `BUILDING_BLURBS`
  (21), verbatim designer-ally prose (ASCII-normalized), keyed by id — the tech-blurbs.js
  precedent. Wired into the Civilopedia unit/building entries and the build-catalog
  tooltip. Numbers/requirements still come from the rulesets; only flavor is added.
- Coverage gate (test/unit-building-blurbs.test.js, 2/2): every buildable unit + every
  building must carry a printable-ASCII blurb ≤200 chars — a new one ships with its blurb.
- License-clean: original ally-authored flavor, explicitly not wiki sentences
  (reviewer-verified #1819).

## Test state
- Reviewer clean-clone gate GREEN at `508beab` (625/623/0/2).
- Affected units: city-era 6/6, render-spec 3/3, unit-building-blurbs 2/2, browser 16/16.
- Engine determinism intact: luau 400-turn `0xf68d015b` unchanged across `c212ac6..508beab`.

## Notes
- Per the user's two-marker choice (2026-07-19): this golden-neutral batch is tagged
  first as `marker-0063` so it is mergeable on its own; the behavioral **D3 phase-2**
  lands separately as **marker-0064** (a golden re-record — see reports/marker-0064.md).
- The roblox blurb-parity lockstep + D3 spec docs sit on dev_night above `508beab`
  (`c9be857`, `bc8e1e1`) and ride into marker-0064's history.
