# marker-0110 — W7 novelty map shapes + the A91c warming/stranding repair

DRAFT — tags on the closing 25-seed additivity sweep (running on the dev box
at write time; the `[SWEEP]` slot below fills from it).

Delta since marker-0109 (@7f6f50b): the W7 map-shapes window landed complete
(five new shapes including clover with balanced petal starts), plus a
pre-existing engine bug the W6-closing sweep had surfaced, plus deploy-script
hardening and two new coverage guards.

## The engine work

**W7 — the mask stage + five shapes (STAMP-ONLY re-record).**
A mask stage in `engine/mapgen.js` (`maskAllows` + a `mask` argument to
`generateTiles`), twinned byte-shaped in `luau/mapgen.luau`. Geometry: centre
offsets in DOUBLED coordinates expressed as PERCENT of the half-extent, so a
shape is size-independent; inner/outer radius bands; WRAP-AWARE in x (the short
way round the cylinder), which is what keeps a shape from tearing at x=0 — the
determinism risk the pre-design flagged. Masked walks get an in-mask start (40
bounded re-rolls, so the draw count stays finite and identical in both engines,
then a deterministic index-order scan) and a doubled step budget. **No mask ⇒
the legacy path, untouched**, which is why existing worlds differ only by the
stamp.

Five new `rules.mapTypes`: `fractal` (preset knobs only — no engine code),
`oval`, `ring` (a donut around an open central sea), `inland-sea` (rim land,
sea locked inside), `clover` (four mirrored petals joined by a hub). Each
carries the REQUIRED `provenance` note — Civ 1 had no map-shape selector, so
these are later-Civ shapes under the civ-mixing convention.

**Clover's balanced starts — the sub-slice the contract warned about.**
Measured before building it: with the stock start finder, five seeds gave only
2–3 DISTINCT petals of 4, i.e. civs piling into two lobes, which removes the
point of the shape. `findStarts` now takes a `petals` flag (the Nth civ wants
the Nth petal) that RELAXES together with the existing `minDist` relaxation, so
a cramped world still seats everyone rather than failing. Verified over 20
games (10 seeds × {4, 7} civs): **4/4 petals occupied and every seat placed,
every time**. No v1.x fallback was needed.

**A91c — global warming no longer strands ships.** Root cause of the ONLY new
finding in the W6-closing sweep (seed 6, t363, "sea unit (ironclad) on land
outside a city"): `rules.pollution.warmingTransforms` maps `ocean` → `swamp`,
so a greenhouse event could raise land under a fleet. Pre-existing since the
A91b window; W6's denser worlds simply rolled it. Confirmed in the wild, not
inferred — the failing save has the ironclad at (26,18) on a swamp tile with no
city — and reproduced seed-independently in a fixture. **User ruling
(2026-07-29): wreck the hull, BEACH the cargo** — the square is land once the
greenhouse fires, so an embarked land unit walks off (`unitUnloaded`) instead of
drowning, while the hull is lost (`triremeLost`). No new event type. The
seed-6 profile re-run on the fixed engine passes 400 turns clean.

## Re-record (#28 classification: STAMP-ONLY, verified)

Every `BEHAVIOR_*` value came back BYTE-IDENTICAL to the W6 slice-5 record
(`0x184dd153 / 0xab85ec57 / 0xc94f7592 / 0xe956700a`, natural `0xbf1918cd`)
while every `GOLDEN_*` moved: the trajectory never changed, only the
rulesetHash the world is stamped with. **Natural 545 / winner p2 held a FIFTH
consecutive re-record.** The A91c fix rode the same run and also left BEHAVIOR
unmoved (a golden game has to warm an OCCUPIED ocean tile for it to bite).

New pins: `GOLDEN_SOAK` 100 `0x3d9f5881` / 200 `0x7a322cd1` / 300 `0x1847cebe`
/ 400 `0xfcebe728`; `GOLDEN_NATURAL` 545 p2 `0xa1c6e53a`; sim-smoke t100
`0x3d9f5881`; `FF_PARITY 0xf22d9ba5`; age-snapshot `CANONICAL_PIN 0x43ad9e40`;
scenario 002 `0x6d55a5c0`; nine maptype pins (`continents 856e4f41`, `pangaea
6862c666`, `archipelago 3da45b9f`, `islands c76a076f`, `fractal 518a87cb`,
`oval cd182fc7`, `ring 590c6afd`, `inland-sea 800566b0`, `clover 2687aec3`).

## New tests (both negative-proved by breaking the data they read)

- **Map-type coverage contract** (`test/map-shapes.test.js`, 9 tests): every
  `mapTypes` entry must generate a playable world with every civ seated; a
  declared `maskKind` must be IMPLEMENTED *and* must provably BIND (masked world
  ≠ same-knobs unmasked world) — otherwise the ruleset promises a shape the
  generator silently ignores; every non-classic shape must carry provenance.
  Proof: renaming clover's mask to `"spiral"` fails with the intended message.
- **Terrain-mutation contract** (`test/guards.test.js`): the set of engine files
  that rewrite tile terrain is pinned (writing it surfaced that there are
  THREE, not two — `improvements.js` does settler transforms), every
  `terrain.json` transform must stay within its domain (the only reason the
  settler path cannot strand units), and both pollution engines must still call
  `strandedShips()`. Proof: pointing jungle-irrigate at `ocean` fails with the
  intended message.

## Gates

- **Reviewer #2854 — CLEAR on code, determinism, twin fidelity and golden
  discipline.** Both new determinism surfaces checked individually: the bounded
  re-roll draws exactly 2 rolls per iteration bounded at 40 in both engines, and
  the fallback scan consumes ZERO RNG and picks the same first-in-mask tile in
  both. Legacy neutrality confirmed by construction, not assumed. Provenance
  labelling confirmed against the dump. A91c beaching re-read PASS (#2851):
  `unitUnloaded` reuse correct, cargo x/y always equals the ship tile so
  beaching cannot re-break the invariant.
- **Reviewer judgement on sequencing (quoted):** naval acceptance for
  ring/inland-sea "RIDE AFTER … Mask stage touches ZERO ai/naval code — pure
  mapgen geometry, golden-neutral, twinned, deterministic … novelty shapes are
  non-default (low exposure). Tag the marker now."
- **Local execution:** simulation 7/7, `luau-twins` 11/11 under lune (all nine
  maptype pins, data checksums, sim-smoke, ff-parity — so the pins are
  executed-and-equal cross-language), age-snapshots green, scenarios 68/68,
  map-shapes 9/9, guards 16/16.
- **[SWEEP]** closing 25-seed additivity sweep on the DEFAULT type: ___
- **HONEST GAP:** the reviewer could NOT run its independent clean-clone lune
  repro this session — `reviewer-lab` was outside its allowed directories, and
  it rightly refused to check the tip out over the architect's working tree.
  The same scope problem idled the sim-runner (`~/sim-lab`), so the W7
  measurements ran (or are running) on the dev box instead. Cross-language
  execution IS confirmed, but on ONE machine only. A per-lane directory grant is
  filed as human-workitems A5.

## Also in this span

- Deploy-script hardening, in both the user's `ssh-deploy.sh` and the tracked
  `docs/hetzner-ssh-deploy.sh` template: a provenance guard (the script deploys
  the WORKING TREE — it now prints branch/sha/marker and stops for confirmation
  when the tree is dirty or HEAD is not a marker), a ruleset-stamped skip for
  the age-snapshot bake (MEASURED at 163s + 58s for the first two of 21 presets
  in the density era — tens of minutes per deploy), and a post-sync check that
  the box's `data/rules.json` matches local (a half-finished rsync leaves a
  SERVING box on a mixed tree while healthz still answers 200).
- `docs/01-game-spec.md` now documents pollution and global warming — including
  the beaching rule — and its "out of scope for v1" list no longer claims
  diplomacy, pollution, warming and disasters are unbuilt. All four shipped.
- `debugging/probe-mapshape-naval.js`: the W7 acceptance instrument (cities,
  coastal share, sea units, transport hulls, and OVERSEAS cities via a
  land-component flood fill — the actual did-the-AI-cross-water signal).
- Process lessons banked: `git commit -m` sweeps EVERY staged file (an
  "engine(a91c)" commit silently carried the whole W7 landing — commit map
  recorded in the spec since rewriting was impossible), and never round-trip a
  hand-maintained `data/*.json` through a JSON serializer (~450 lines of
  cosmetic churn; restored surgically, content deep-compared).

## Breaking / compatibility

No protocol or save-format change. `data/rules.json` gains five `mapTypes`
entries (additive; unknown types still clamp to the default, and the four
classic types keep their exact generation path). New client surface is the
setup picker's Classic / Novelty grouping — the novelty shapes are NOT the
default, so exposure is opt-in. The Roblox lane needs a data re-bake on top of
this ruleset (routed separately).

## Consistency

[filled at tag time]
