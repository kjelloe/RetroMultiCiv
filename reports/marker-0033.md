# marker-0033 — clean M11 + accumulated golden-neutral work

- **Commit:** 9bad386 (tag marker-0033)
- **Base:** marker-0031 (M11 pin) + everything committed between.
- **Type:** engine returned to pure M11 (opener experiment reverted) plus a
  batch of golden-neutral work (renderer, docs, tests).
- **Tests:** 440/440 zero-skip (whole-tree confirmation run).
- **Status:** the declared merge candidate (superseded marker-0031 for merge).

## Delta since marker-0031

### Engine: opener-scout experiment — measured and reverted
marker-0032 (provisional, commit a84f98f) added `aiOpenerScoutException`
(default on): at 1 city with 1 needed guard, the sole guard could leave to
scout — the user's founding-move idea, run as a gated experiment.

Measurement (A/B, knob on vs off, 10 seeds) failed 3 of 4 gates: exploration
flat-to-down (14→13%, first contact slower), cities nearly halved (10→5.5
median), health floors breached (pop −19, improvement% −11). Mechanism: the
sole guard leaves, its one city is captured, and that civ never becomes
multi-city — the same failure the guards≥2 floor was added to prevent.

Result: fully reverted. The 6 engine/test files are byte-identical to
marker-0031; goldens back to 0x73f85601. Recorded as measured-and-rejected in
`agent-workitems.md` so it is not re-proposed; the exploration deficit is the
queued B23d relaxed-veto slice, not this shortcut.

### Renderer: A88b — one dispatch source
`createUnitMesh` is now data-driven — the unit recipe comes from
`UNIT_SILHOUETTE` and render chrome from a new `unit-chrome.js`. The per-type
function ladder and type-class sets were deleted (they held a second copy of
the type→recipe mapping). A coverage test asserts every silhouette has a
chrome entry. Verified byte-identical render (local same-environment compare +
a CI visual-check pass). This removed the drift risk the A67 art rounds had
been hand-syncing.

### Renderer: art rounds
Distinct silhouettes replacing generic families, each pure data on the A88b
pipeline (no dispatch code), each with a re-recorded visual golden:
tank, APC, catapult, diplomat, phalanx, musketeers, riflemen. (Knights,
carrier, bomber, nuclear landed in later commits after this marker.)

### Docs and process
- `docs/16` + `reports/infosec-remaining.md`: server load-test findings folded
  in; the top availability gap (a single joined client can stall the game) is
  the ranked #1 item for the separate server-robustness work.
- `docs/17`: role spec for the server-robustness worker (own clone, exclusive
  `server/limits.js` + connect/command paths, neutral vocabulary).
- `docs/03/05/14/15`: designer-ally feedback folded (naval acceptance
  sequence, attacker-gate watch-list, diplomacy event shapes, 1.0 ordering).
- The `gamesim-golden-neutral` naming convention (CLAUDE.md).

## Golden state
Engine goldens are marker-0031's (0x73f85601 etc.) — the renderer/docs work is
golden-neutral, so no engine hash moved. The gallery visual golden moved for
each art round (recorded per commit).

## Breaking notes
- `npm ci` required after pulling (the `@playwright/test` dev dependency).
- No engine golden re-record in this delta (the opener revert restored
  marker-0031's goldens).
