# marker-0136 — SDI-aware AI nukes, the game difficulty in the seat view, Roblox city mood

**Tag:** `marker-0136` at `d486c0d` · **merge-consistent — the user may merge this**
(supersedes marker-0135). Golden-neutral: no pinned hash moved except
scenario 066 (new state field, below). One additive view field.

The tag is local only (no GitHub credentials in the agent shell):
`git push origin dev_night marker-0133 marker-0134 marker-0135 marker-0136`.

## Delta since marker-0135

| Commit | What |
|---|---|
| `9dbcfea` | marker-0135 report + plan/workitem sync |
| `c04002f` | docs/16 §10 security delta; docs/06 A116 rule; Luau plan note |
| `8159404` | Roblox end-screen headline falls back to "leading civilization" |
| `a7598fb` | A117 SDI preference + `view.difficulty`; Roblox item 10; first-use nuke evaluation |
| `0313a93` | sync: Luau catch-up status, fastengine note, docs/13 row, dates |
| `a46148d` | the first-use evaluation corrected (Manhattan reachability) |
| `d486c0d` | human-workitems D1/D2 open decisions |

## Items

1. **A117 / P3b — SDI preference (user ruling 2026-11-02, "if possible,
   but cannot wait for SDI defence check on that city").** The AI cannot
   see a rival's buildings, so it never checks before striking. An
   interception is public: the engine marks the city `sdiRevealed`
   (engine/combat.js + luau/combat.luau). `nukeTarget` ranks
   revealed-SDI cities below any unshielded target in range and still
   strikes one when it is the only target (engine/ai.js + luau/ai.luau).
   `test/ai-nuke.test.js` +1 case, JS == Luau.
2. **`view.difficulty` in the seat view.** `filterView` did not copy the
   game difficulty, so every server-game client (browser and Roblox)
   computed city mood with the default content-citizen count on any
   non-medium game. Now copied when defined (engine/visibility.js +
   luau/visibility.luau; visibility test red first). Found while building
   Roblox item 10.
3. **Roblox item 10 — city happiness breakdown (user ruling).** CityPanel
   mood row + factor tooltip from the engine's `happiness.cityMood`;
   `roblox/selftest/city-mood-parity.mjs` is check.sh gate 32. Headless;
   Studio look pending.
4. **Roblox end-screen headline.** With no recorded winner it printed
   "the nil"; it now says "leading civilization" (Luau plan step 3).
5. **First-use nuke evaluation (user asked "evaluate").** Recorded on
   plan-version2 and corrected 2026-11-05: the stance wonder pick never
   seeks Manhattan, but the econ fallback `nextWonder` can pick it.
   Measured on the golden seed: soak 400 and natural 545 never build it
   and no nuke fires. Recommendation stands (build first use with a strict
   gate, crafted-state tests). Two decisions opened: human-workitems D1/D2.

## Golden state

No GOLDEN_SOAK / NATURAL / BEHAVIOR pin moved (no nuke fires in the soak;
views are not hashed). Scenario 066 (SDI intercept) re-pinned 0xc58e8967
for the new `sdiRevealed` field, both engines.

## Breaking notes

- Wire: the seat view gains `difficulty` (additive). fastengine mirrors
  engine/visibility.js and engine/combat.js; both named in `a7598fb` and
  in `specs/fastengine-requests.md`.
- Game state: cities may carry `sdiRevealed: true` (boolean).

## Test state

- `node --test test/` at the tag (docs-only since `a7598fb`): 1087 tests,
  1077 pass, 0 fail, 10 skipped (PowerShell/env).
- Playwright lane on `a7598fb` (last client change): 65 passed, 2 skipped.
- Luau twins gate (lune 0.10.5) on `a7598fb`: 11/11 green.
- Roblox parity harnesses incl. gate 32: all exit 0.
- Measurement 2026-11-05: golden soak 400 + natural 545 build no
  Manhattan, no detonation.
