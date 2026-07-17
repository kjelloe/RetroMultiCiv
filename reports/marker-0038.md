# marker-0038 — sweep-gap filler: render-spec rename + advice→pedia audit

- **Commit:** 6eaeddd (tag marker-0038)
- **Base:** marker-0037.
- **Type:** client/tooling, golden-neutral (no engine/twin files).
- **Tests:** 456/456 zero-skip + test-ui/pedia.spec.js 2/2 (playwright).
- **Status:** consistent, standalone-shippable. Latest merge candidate.

## Context

Filler done by the helper during the N9 reserve-sweep gap, after a prior-art
check struck H6 (advisor already shipped: A78+A99+A58c) and H9 (A58 pedia
complete). These are two genuinely-open small items the check surfaced.

## (1) render-spec key rename typeClasses → unitSilhouette

Reviewer advisory (workitems:2441): `specs/render-spec.json`'s `typeClasses` key
changed SHAPE under the same name during A88b — a silent-misread hazard for any
consumer. Renamed to the self-describing `unitSilhouette`.

- **Consumer scan (the guard):** full-tree grep incl. roblox/, luau/, *.luau,
  *.json, *.md found ZERO code readers of the key — only the generator
  (tools/render-spec.js), the generated JSON, one doc-table row, and queue text.
  No browser reader, no roblox/luau reader. The only audience is an out-of-repo
  reader, which now breaks LOUDLY on the missing key instead of silently
  misreading the new shape. No cross-lane coordination needed.
- tools/render-spec.js emits `models.unitSilhouette` (comment explains); JSON
  regenerated; specs/render-spec.md table row updated; test/render-spec.test.js
  +1 (typeClasses ABSENT, unitSilhouette deep-equals the generated recipe map).

## (2) advice→pedia deep-link audit

The A78/A99 advisor cards' pedia deep-links (A58c's "future field"): 11 cards, 7
linked pre-audit. Added the two honest links — settler → 'cities', tech-choice →
'research'. unit-selected and regent stay UNLINKED on purpose: no concept covers
movement basics or regency yet, and a near-miss link is worse than none.

- ADVICE + ADVICE_PEDIA exported; test/advice.test.js +1 gate: every link names a
  real card AND a real concept, and the unlinked set is exactly the documented
  two — so a future concept landing forces the link decision explicitly.
- Flagged for the ally's concepts pass: 'movement' + 'regency' entries would
  complete the map.

## Files

tools/render-spec.js, specs/render-spec.json (gen), specs/render-spec.md,
test/render-spec.test.js, client/ui/advice.js, test/advice.test.js.
