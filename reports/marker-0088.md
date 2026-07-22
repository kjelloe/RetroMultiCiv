# marker-0088 — the wonders do things now (MERGE-CONSISTENT)

Tagged at `d977072` (2026-07-22 night). **MERGE-CONSISTENT — supersedes
0087. Current merge candidate** (20th consecutive, 0069–0088). Doubly
gated within 40 minutes of landing: reviewer clean-clone + engine-diff
vs its own fact-check (#2251) and sim-runner Gate-B (#2253) agree
byte-exact (checkpoint-400 0xd8222d53; natural 405/p2/0x13320ab7;
twins 11/11).

## What changed (delta since 0087)

One item, wide: **A7 wonder effects (#29)** — the 8 remaining
empty-effect Civ1 wonders now do their authentic things, every shape
verified against the wikiteam Civ1 dump before pinning:

| wonder | live effect |
|---|---|
| Copernicus' Observatory | +100% science in its own city (obsolete per manual, Civ1-manual labeled) |
| Isaac Newton's College | +66% of the city's Library+University science — suppressed while SETI active (non-cumulative, ruled) |
| SETI Program | +50% science in every city |
| Hoover Dam | power source for the wonder-city's CONTINENT (doubles the Factory bonus there — same-continent, the fact-check's catch) |
| Women's Suffrage | −1 per-unit war unhappiness (Republic 1→0, Democracy 2→1 — not a full cancel) |
| Great Library | grants any advance ≥2 other civs know, one per turn, obsolete at University |
| Darwin's Voyage | 2 free advances on completion, one-time (the wonderBuilt hook) |
| Lighthouse / Magellan | (already landed in naval-truth) — pedia EFFECT_TEXT filled by the rider |

Pyramids was revealed by the fact-check to be a GOVERNMENT wonder in
Civ 1 (1-turn anarchy + any-government unlock), not production — split
to its own slice (#35, in build at tag time). United Nations defers to
the D4–D6 diplomacy window where its effect lives.

Mechanics: fields authored in WONDER_OVERLAY (tools/mapdata.js,
regenerated — never hand-edited), wired across five engine seams
(tech/cities/happiness/index + the new cross-engine
`processWonderTechs` step), luau twins byte-faithful, crafted witness
per effect. **The #28 discriminator made its first real
classification**: the batch re-record split into soak = STAMP-ONLY
(rulesetHash ripple) vs natural = BEHAVIORAL (405 rounds — effects
fire late-game), and both gate lanes independently confirmed the
classification.

## Process notes

The reviewer's pre-design fact-check (#2245) drove the final shapes —
it corrected four proposed effects (Copernicus 100 not 50, Newton
non-cumulative, women-suffrage −1-per-unit, Hoover same-continent) and
caught the Pyramids Civ2-shape drift before any of it pinned. The
fact-check-before-pin doctrine (docs/18) paid for itself in one
window.

## Next

Engine: pyramids-gov (#35, in build — 1-turn anarchy per dump +
any-gov unlock + effect-field migration) → archetype wonders (#26, the
ally mapping now reads REAL effects) → xiv-ai-behavior (#30, the (c)
half) → witness-7 re-run (the launch acceptance). Client: helper
resumes #26 capital-ui; a gov-picker un-grey follow-up queues on #35's
landing. User gates unchanged: redeploy (0088 now the candidate), box
commands, Studded round-2.
