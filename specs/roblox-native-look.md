# Roblox-native look — UI dress, menu icons, sculpted terrain, diagnostics

Status: user direction 2026-11-14 (rulings below, second round same day).
Owner: roblox-helper lane (`roblox/` only). Presentation layer throughout —
no engine, state, command, or shared-recipe change; gamesim-golden-neutral.

## 1. Problem (user, 2026-11-14)

1. The menu buttons read like accounting software, not a Roblox game.
2. Only the tech tree has an icon (a tree emoji); every other menu is a text
   label.
3. The browser map got a complete graphics pass (graphics-levels v2); the
   Roblox map did not. Mountains in particular: one flat-topped block with a
   small cone on it.
4. (second round) Studio debugging: any failure to load, render or show an
   element must leave an error or warning in the log — and the log should be
   readable without a copy-paste.

## 2. Rulings (user, 2026-11-14)

| question | ruling |
|---|---|
| UI style | chunky game-style: thick rounded buttons, rounded display font, dark outline, gradient, icon + short label, press/hover feedback |
| icons | drawn in code (the EditableImage glyph renderer) — no uploads |
| terrain | sculpted parts per tile; tile blocks stay (no EditableMesh, no voxel Terrain) |
| order | UI buttons first, terrain second |
| button colours | one colour per ROLE (as built): `menu` blue, `go` green, `danger` red, `space` purple, `science` amber, `neutral` slate |
| hotkey hints | "Research (T)" stays on desktop; dropped on a touch-only device |
| mountains per look | retro and brick get the sculpted mountains too |
| phone layout | a bottom bar only, if it fits; a collapsible side dock only if it does not |
| diagnostics | every load/render/show failure logged; the log read directly from disk |

## 3. Analysis — what was there

- **Buttons**: ~40 `TextButton`s, each styled inline in its own script
  (`SourceSansBold`, flat dark `BackgroundColor3`, an 8 px `UICorner`). No
  shared style module. Top row absolutely positioned per script (Options
  −158, Encyclopedia −284, Ship −370, Strategic −458, TechTree −546), with a
  180 px clock label at −428 that ran under the Encyclopedia button, and a
  gap wherever Ship / Strategic were hidden.
- **Icons**: `EditableGlyph.luau` already rasterises a primitive vocabulary
  (disc/ring/arc/ell/bar/poly/dots) for the 68 tech glyphs.
- **Terrain**: `ViewRenderer.renderTerrain` = one `Part` per tile, height
  from `TerrainPalette` (generated, gate-4 locked). `TileProps.luau` (the
  `props.js` twin) added a 5-wedge cone + snow cone on mountains.
- **Failure visibility**: 47 `pcall` sites in the client; the render-path
  ones fell back silently (no icon, grey unit placeholder, classic cone),
  and a LocalScript that died at load took its panel with it, visible only
  as a stock red line. The only way to get the Output to the agent was a
  manual save into `roblox/acceptance/`.
- **Phone**: nothing adapts. The action bar is a fixed 1436 px frame; the
  bottom-left toggles are 190 px wide; End Turn is pinned bottom-right.
  A phone viewport (e.g. 844×390) shows a fraction of the bar.
- **Browser reference**: Low = faceted SEGS 2 with the same cone props;
  Medium = faceted SEGS 8 mesh that owns real summits, snow by vertex lerp,
  resource on a flank (H13c); High = smooth.

## 4. Design

### D — diagnostics (built)

- **Reading the log**: Studio mirrors its Output window to
  `%LOCALAPPDATA%\Roblox\logs\*_Studio_*_last.log` while it runs (script
  output on the `FLog::CreatorOutput` channel, flushed live).
  `node roblox/tools/studio-log.js` reads it from WSL: default = the last
  play session without the `[R4LOG]` lines; `--diag` = tagged lines,
  warnings, errors; `--list` = sessions; `--save <file>` writes the session
  in the shape `acceptance/assemble.js` reads (replaces the manual Output
  save). No Studio setting, no plugin, no HttpService. Rojo itself has no
  log-out channel; it is not needed.
- **`Diag.luau`** (pure): `fail(area, what, err)` prints ONE
  `[RMC-DIAG] FAIL area: what: cause` warning per distinct failure and
  counts repeats; `note`, `count`, `try` (pcall + traceback), `summary`.
- **Reporting sites**: `UiTheme` (dress error), `EditableGlyph` (image
  create / draw / attach, each with the engine's message — the icon line
  names the "Allow Mesh / Image APIs" setting), `TileProps` (sculpt
  fallback), `ViewRenderer` (skirts, unit recipe placeholder), `Intro`
  (fighter recipe), `HudDock` (layout fallback).
- **`DiagAudit.client.luau`**: uncaught client script errors re-printed
  tagged (`ScriptContext.Error`; `DiagServer` does the same server-side);
  then an audit 6 s after the first view, 10 s after boot, and after a
  viewport or look change: device line (viewport, inset, touch/keyboard),
  every expected ScreenGui present or MISSING, every themed button's pixel
  rect + `TextFits` + icon wanted/drawn, off-screen and overlap findings,
  world folder counts, one massif sample (apex vs block height in studs),
  and the failure summary with `0 failure kind(s)` printed when clean.
- **Not routed through Diag**: the presentational engine reads
  (`cityYields`, `playerIncome`, … on a view shim). They fail by design
  under fog and each caller already shows its own "unavailable" text.

### U — UI dress

- `UiTheme.luau`: `apply(button, opts)` decorates an EXISTING button — 12 px
  corners, 2.5 px dark outline, top-lit gradient, FredokaOne with a 1.5 px
  text outline, hover/press feedback. `setCompact` flips a button between
  icon + label and icon-only. On a touch-only device the hotkey hint is
  stripped on every text write (`UiText.stripHint`, pure).
- `MenuIcons.luau`: pure data, 16 pictograms in the 0..100 box.
- **Top row (U3a, built)**: `DockLayout.plan` (pure) places the menu row
  right-to-left; a hidden member takes no space; past 55 % of the viewport
  width the labelled members go icon-only; past that the row wraps. Height
  40 px, 44 px on touch. `HudDock` applies it on viewport / visibility
  change; a failure restores the built offsets. Members: Options,
  Encyclopedia, Ship, Strategic, Tech tree, clock.
- **Phone (U3b, designed, not built)**: landscape phone = touch-only and
  short side < 600 px. Bottom zone in two rows:
  row A (bottom): the action verbs that apply to the selected unit only
  (inapplicable ones hidden rather than greyed), End Turn at the right;
  row B (above): every menu as a 44 px icon square — the five top-row
  menus plus Turn log, Diplomacy, Legend, Overlays (their panels keep
  their positions). If row B exceeds the width, the overflow moves into a
  side dock behind a "more" button — the ruling's fallback. Built after
  one phone-emulator audit: the overlap / off-screen lines are the
  acceptance list for it.

Phases: **U1** (built) top row, action bar, End Turn. **U2** (built) close
/ primary / toggle buttons. **U3a** (built) top-row dock. **U3b** phone
bottom bar. **U4** icons on the remaining action verbs (the 91 px verb
buttons leave ~45 px for a label beside an icon — sized from the audit's
`fits` / `textBounds` numbers for Found and Fortify first). **U5** panel
title bars and list rows.

### T — terrain

- **T1** (built, EVERY look since the second ruling): `TerrainSculpt.luau`
  — mountain = three summits on a ring around the tile centre (the centre
  stays clear for a unit or city), fitted snow caps, two foot boulders; the
  block drops to 0.6 height. Hills = 2–3 low mounds. Mountain resources
  move to a flank. More than 150 mountain tiles in view → lite massif.
- **T2** (built, ENHANCED look only — slopes were not part of the ruling
  and retro is deliberately blocky): `TerrainSkirts.luau` wedges against
  walls ≥ 1 stud. Outer corners between two skirts are open
  (`CornerWedgePart` fill = T2b).
- **T3** coast: sand strip + foam where land meets ocean, river banks.
- **T4** forest/jungle canopy density + two-part trees, ground-cover
  colour variation per tile.

## 5. Plan — recommended order

| # | item | state | needs |
|---|---|---|---|
| 1 | D diagnostics + log reader | built | first Play Solo proves the warning channel |
| 2 | rulings: hints on touch, mountains every look | built | — |
| 3 | U3a top-row dock | built | audit: no `overlap` / `off-screen` lines at 1080p |
| 4 | first Studio run read from the log | **next** | user presses Play Solo once |
| 5 | fixes from that log (icons, fit, dock) | open | item 4 |
| 6 | U4 action-verb icons | open | Found/Fortify `fits` numbers from item 4 |
| 7 | U3b phone bottom bar | open | one run in the phone emulator (item 4 shape) |
| 8 | T2b corner fills, T3 coasts | open | a look at T1/T2 (screenshot) |
| 9 | T4 trees, U5 panel chrome | open | part-count line from the audit on a large map |

Items 6–9 change proportions that only a look or the audit's numbers can
set; each is decorate-in-place with a logged fallback, same as 1–3.

## 6. Assessment

| risk | note |
|---|---|
| Not seen in Studio | Everything since run-N was built with Studio unattended: lune-compiled (gate 40), pure halves pinned, look unverified. The audit now reports geometry (rects, fit, counts), not appearance — a screenshot is still the look check. |
| Warning channel | The log reader is proven on `print` lines (the run-N session, replayed hash-exact from the log). No script `warn` or error has occurred in a logged session yet, so their channel/level is unconfirmed; the reader therefore matches the `[RMC-DIAG]` tag on any channel and error lines that name a script. |
| EditableImage | Never yet confirmed in Studio. Failure is benign (text-only buttons) and now logged with its cause. Needs the experience's "Allow Mesh / Image APIs" security setting — to confirm. |
| Dock | The row now moves on every viewport change; a planner error falls back to the built offsets. Icon size is fixed at dress time (24 px in a 40 px button). |
| Part count | Full massif ≤ 32 parts per mountain tile, now in every look. ~80 mountain tiles on 40×25 = ~2.6 k parts; lite path above 150 tiles. The audit prints the folder counts. |
| Look parity | The browser Medium/High surfaces are meshes; this is a part-built reading of the same idea, not a twin. No gate compares them, by design. |

## 7. Tests

`roblox/check.sh`: gate 35 menu icons, 36 terrain sculpt, 37 slope skirts,
38 diagnostics (Diag pins, audit gui list == created ScreenGuis,
studio-log parser), 39 dock planner + touch labels, 40 every source
compiles. Studio: `node roblox/tools/studio-log.js --diag` after a Play
Solo — expected `0 failure kind(s)`, `icons drawn N of N wanted`.

## 8. Open questions

None blocking. To confirm from the first logged run: the Image-API
setting, and whether the massif should also lower in the brick look's
stepped relief (`brickTop` is applied to blocks, not to prop seating —
pre-existing).
