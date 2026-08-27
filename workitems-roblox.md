# workitems-roblox.md — roblox-helper queue, file form

The agent-mail hub is down, so this file carries the roblox-helper's
work stack (transcribed 2026-08-27 from the dev-PC queue store, FIFO
order preserved) plus the mail context each item referenced. It is
self-contained: nothing below requires reading the mailbox.

**First step: `git pull origin dev_night` — expect tip `1d1b32a` or
later.** All source-of-truth files named below are at that tip.

**Process while the hub is down:** roblox-helper owns `roblox/`
exclusively (docs/10), so no file locks are needed for any item here.
Record completion IN THIS FILE — append `[done: date — one-line note +
commit sha]` to the item — and let the commit travel via git as usual.
Mail catches up when the hub returns; do not block on it. Anything
blocked or needing a ruling: note it in this file the same way
(`[blocked: …]`) and continue with the next item.

Natural pairings: items 1+2 are one TileProps pass (specials/animals),
items 3+5 are one road-era pass (shared twin + TileProps roads). Item 4
is a five-minute rename. Queue order below is the original FIFO; taking
a pairing together is fine.

---

## 1. G0 re-mirror — Horse rework + desert palette [task, architect, queued 2026-08-08]

G0 (specs/graphics-levels.md) is DONE on the browser side 2026-08-05.
Mirror two browser-renderer changes into `roblox/src/client` (your
files):

1. **TileProps.luau SPECIAL_MOTIF plains:** the Horse is now a STANDING
   profile of 12 primitives (`client/renderer/three/props.js` is the
   source — body `resBeast` 1.5/0.75/0.65 at dy 0.24, four `resLeg`,
   `resNeck` rotZ 0.55, `resBeastHead`, `resMuzzle`, two `resEar`,
   `resTail` rotZ 2.6; colors `9a6b3f` / `8a5f36` / `5d3f22`). Five new
   PROP_SHAPES: `resLeg`, `resNeck`, `resMuzzle`, `resTail`, `resEar` —
   already in `data/assets/asset-recipes.json`.
2. **Luau terrain palette desert row:** now `eab84f` / `f2c460` /
   `dcaa40` (warm amber, user pick from 3 variants).

Verification: your usual Studio screenshot vs `debugging/g0-final.png`
framing (gallery rows 20–22 swatch + row 19 plains special).

## 2. EXTENDS item 1 — H1 animal reworks [task, architect, queued 2026-08-09]

H1 added three more SPECIAL_MOTIF animal reworks in props.js (source of
truth) that TileProps.luau must mirror in the same pass:

1. **forest Game** = deer STANDING-ALERT (12 prims: `resBeast` slim +
   4 `resLeg` + `resNeck` rotZ 0.28 + `resBeastHead` + `resMuzzle` +
   2 `resAntler` HIGH at dy 0.5 + white `resTail`; colors
   `7a5a35`/`6b4d2c`/`533c22`/`e8e0cc`)
2. **tundra Game** = the same pose in tundra colors (`8a6a45`/`5f4728`)
3. **arctic Seal** = BASKING (body rotZ -0.22, raised head + muzzle,
   2 `resLeg` fore-flippers, `resFishTail` tail flipper;
   `c4cbd4`/`b4bcc6`)
4. **ocean Fish** = SIDE PROFILE (flat `resFish` + forked tail =
   2 `resFishTail` rotZ -0.9/-2.2 + dorsal `resFishTail` + `resEar` eye
   dot `2b3a4a`)

No NEW prop shapes beyond G0's five (all reused). `treeTrunk` /
`treeCanopy` / `roadDash` exist in asset-recipes.json but are HIGH-tier
browser-only (Roblox mirrors low; skip them). Verification: Studio
screenshot vs the browser gallery row 19 (`cx=6&cy=19&zoom=4`).

## 3. city-era twin — roadStageFor + annotateCityEra viewer param [architect, queued 2026-08-11]

marker-0128 (H13): `shared/city-era.js` gained a pure function the
roblox twin needs. Full context (originally mail #2925):

`roadStageFor(viewerPlayer, techsTable) -> 0..4`: 0 default; 1 on any
renaissance-era tech; 2 on any industrial-era tech; 3 on `automobile`;
4 on `plastics` or `space-flight`. Pure, no state writes; keyed on the
viewer's OWN techs (fog-honest — no reading rivals' progress off the
map). `annotateCityEra` now takes an optional third param (viewer id)
and stamps `view.viewerRoadStage` (spectator = max over players). The
renderer keys road/rail styling on it at medium/high; the stage table
lives in `client/renderer/three/props.js` (`RS`) for the visual
reference. Review sheet: `debugging/h13-road-eras.png`.

Mirror `roadStageFor` + the `annotateCityEra` param into the roblox
city-era twin.

## 4. Encyclopedia rename — the held #2616 edits never landed [architect, queued 2026-08-11]

Background: a 2026-08 roblox session claimed this but its environment
denied all file writes; the edits were held, and verification 2026-08-11
confirmed they NEVER landed — `Pedia.client.luau` still says
"Gamepedia". The ruling stands: PEDIA_NAME = **'Encyclopedia'**
(user-ruled 2026-07-25).

The swap: Gamepedia → Encyclopedia in
`roblox/src/client/Pedia.client.luau` lines 1, 30, 53, 235, 331 +
`Ship.client.luau` line 25 comment + the resetServer comment. Browser
twin for reference: `client/ui/pedia-name.js`.

## 5. EXTENDS item 3 — TileProps road/rail sync to H13+H13b [architect, queued 2026-08-11]

`TileProps.luau` road/rail sync to H13+H13b (props.js @d599d3f is the
source):

- 5-stage viewer-era road styling via `roadStageFor` (item 3's twin)
- twin steel rails + double-track/wide ties from stage 3
- **city tiles draw the road half toward REAL-road neighbours** (plain
  road, never rail; no isolated stub on cities)
- dash rows at stages 3–4

Browser reference guard: `test/road-city.test.js` (Node side) encodes
the city-tile rules; the H13b sections of `specs/graphics-levels.md`
describe both features.

---

## Not in this file (user-side, for completeness)

C1b remains a USER Studio session, not lane work: midgame-join verify,
publish, `ROBLOX_EXPERIENCE_URL`, one-motif EditableImage glyph render.
The ~32 provisional glyph motifs stay ally-gated. Neither blocks the
items above.
