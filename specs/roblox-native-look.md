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
- **Action bar (U4, built)**: all 13 verbs carry an icon (27 icons
  total); an icon button is 26 px wider. The bar is as wide as its
  buttons (was a fixed 1436 px frame) and a `UIScale` fits it to the room
  between the bottom corners (viewport − 2×206 px, floor 0.5).
- **Phone (U3b, built, not seen on a device)**: phone = touch screen with
  short side < 600 px (`UiText.isPhone`; the keyboard flag is ignored so
  Studio's emulator shows it). The five menus become 44 px icon squares
  in the slot above End Turn (bottom-right, 58 px up; wraps upward), the
  clock stays top-right, inapplicable verbs are hidden instead of greyed
  so the bar holds only what applies, hotkey hints are dropped. The
  5-icon row is 252 px, so it fits any phone width and the ruling's
  side-dock fallback is not needed. NOT adapted yet: the unit tab cards
  (940 px row above the bar), the four 190 px bottom-left toggles, the
  research cluster (760 px, top centre) — the phone audit's overlap lines
  are the work list for those.

Phases: **U1** (built) top row, action bar, End Turn. **U2** (built) close
/ primary / toggle buttons. **U3a** (built) top-row dock. **U3b** (built)
phone menu row + verb filter. **U4** (built) verb icons + fitted bar.
**U5** list rows inside panels (built: `UiTheme.row`). **U6** (built, run-R) below.

### U6 — reading sizes, panel fit, top strip (user, run-R)

- **Text scale** (`UiTheme.TEXT`): title 22, body 17, small 14 px;
  `BODY_FONT` GothamMedium for reading copy, FredokaOne for headings and
  buttons. Monospace (`Code`) stays only where columns line up (ledgers,
  tooltips). The advice / welcome card (440 px, grows with its text, themed
  buttons), the discovery card (540 px, measured height) and the tooltip
  (15 px, 360 px) use it; both cards narrow to the screen width.
- **Panel fit** (`UiPanel.luau` pure, `PanelDress.client.luau` applies):
  panels are authored in pixels for 1280x720. Every pixel-sized Frame placed
  straight on an RMC ScreenGui (>= 180x100; HUD surfaces skipped by name)
  gets a `UIScale`: screen scale = min(w/1280, h/720), floor 1, cap 1.4,
  0.05 steps; per panel it is cut until the panel fits the gui area. The
  position is re-derived as home offset x scale, so the panel scales about
  its screen anchor (right/bottom-pinned panels keep hugging their edge,
  centred ones stay centred), then clamped on screen. Each panel also gets
  12 px corners, one outline, and its heading (a short label along its top
  edge) in the display font. No panel script changed for this.
- **Phone**: the same rule cuts a panel to fit; under 0.75 the audit logs
  `panel … cut to N to fit` as a FAIL — that list is the set of panels that
  need a real narrow layout (expected: Pedia, Ship, End screen, Tech tree).
- **Top strip**: the menu row (`HudDock.topFor`) and the Research / Cities /
  Government cluster sit in the Roblox top-bar inset when it is at least
  row height + 8 px tall, else at the old y. The cluster re-reads the inset
  for 10 s (it reads 0 during load). The research-status line is below the
  cluster. The menu row's width share is capped at 0.5 − 260/vw so it goes
  icon-only before it reaches the cluster.
- **Turn line** (top-left): a rounded chip as wide as its text, GothamBold
  18 px — `Turn N · year · N gold · your turn | waiting for <seat>`, gold
  and turn state coloured; code chips 14 px.
- **Area source**: the fit reads the camera viewport minus the top inset,
  never `ScreenGui.AbsoluteSize` (stale 800x600 on a disabled gui — the
  first U6 run fitted every panel at 1.00).
- **Lobby seat panel**: heading, a plain-language phase line, a
  seat / player / open count (with `starts in N s`), one card per seat —
  civ, holder, status badge (YOU / PLAYER / AI / REGENT / OPEN, one colour
  each, repeated on the card's edge bar), themed Kick for admins. The panel
  is as tall as its seats (max 8 rows, then it scrolls).
- **Encyclopedia**: 880x520, 44 px header, reading faces (detail 17,
  list 16, categories 17), the picked entry and category stay lit.
- **Research status**: a 20 px chip under the cluster, hidden while empty.
- **Audit additions**: `icon over label`, `N visible text(s) under 14 px`
  (on-screen size = TextSize x every UIScale above it), one `panel` line per
  panel (scale, authored size, heading or NONE).

### T — terrain

- **T1** (built, EVERY look since the second ruling): `TerrainSculpt.luau`
  — mountain = three summits on a ring around the tile centre (the centre
  stays clear for a unit or city), fitted snow caps, two foot boulders; the
  block drops to 0.6 height. Hills (run-S shot16 + shot17 rulings): the block at 50 % of
  its old height and nothing sculpted on it; the resource marker and the mine
  are what stand on a hill. Two ellipsoid ridges were tried and withdrawn
  (read as eggs), as was an all-ellipsoid mountain (read as blobs). Mountain resources stand in the free
  gap of the summit ring (`TerrainSculpt.flank`). More than 150 mountain tiles in view → lite massif.
- **T2** (built, ENHANCED look only — slopes were not part of the ruling
  and retro is deliberately blocky): `TerrainSkirts.luau` wedges against
  walls ≥ 1 stud. Outer corners between two skirts are open
  (`CornerWedgePart` fill = T2b).
- **T3** (built, ENHANCED look only): `TerrainCoast.luau` — a thin sand rim
  along each edge where low land (not hills, mountains, arctic, river)
  meets ocean, on the land tile so the order reads land → sand → the
  existing foam strip → water. River banks (built): the same rim, narrower
  (0.09 tile) and in damp earth, on a land edge that faces a river tile.
- **T4** (built, every look): `TerrainSculpt.forest` — a mixed wood on a
  ring (centre open): 2–3 spruces with a bare trunk + two broadleaf trees
  (trunk + ball canopy), three greens each; fewer cones than the classic
  forest, so the part count stays close. Jungle keeps its three-part
  trees.

## 5. Plan — recommended order

| # | item | state | needs |
|---|---|---|---|
| 1 | D diagnostics + log reader | built | first Play Solo proves the warning channel |
| 2 | rulings: hints on touch, mountains every look | built | — |
| 3 | U3a top-row dock | built | audit: no `overlap` / `off-screen` lines at 1080p |
| 4 | U4 verb icons + fitted action bar | built | audit `fits` lines for the verb labels |
| 5 | U3b phone menu row + verb filter | built | one run in the phone emulator |
| 6 | T3 sand coasts, T4 mixed woods | built | a look (screenshot) + the audit's part counts |
| 7 | first Studio run read from the log | **next** | user presses Play Solo once |
| 8 | fixes from that log | open | item 7 |
| 9 | phone: unit cards, bottom-left toggles, research cluster | open | the phone audit's overlap list |
| 10 | T2b skirt corner fills | open | a screenshot confirming the T2 wedge orientation first |
| 11 | U5 list rows | built for the city list, research picker and build catalog (`UiTheme.row`: rounded, >= 14 px, lighter under the pointer); panel texts raised to 14 px (gate 42 pins) | a look; Encyclopedia / lobby rows keep their own style |
| 11b | river banks | built (gate 41 pins) | a close shot of a river |
| 12 | U6 reading sizes, panel fit, top strip, turn chip | built | a Play: `panel` lines, `text` line, no `off-screen` |
| 13 | panels with heading=NONE get a heading | built (name tabs; run-S log: 8 tabs, end-screen headline styled in place) | — |
| 14 | remaining sub-14 px texts | done — run-S log: 0 visible under 14 px at scale 1.25 | recheck on a 1280x720 window (scale 1.0) |
| 15 | placement rule, HUD off on the deck, observation deck with stations | built; deck seen in shot11 | a close shot of one station sign |
| 16 | dev-tool gating (owner debug game, admins attribute, diagnostics option) | built | a published server for the owner paths |
| 17 | phone: bottom-left icon row (`LeftStack`), unit cards follow the bar fit | built | one phone-emulator run |
| 19 | tech tree graph, income card (ellipsoid summits withdrawn after shot16, see 21) | built (gate 44) | a look at each |
| 20 | civilization gallery (pick before start, default random), close X on every click-opened panel, tech hover card | built (gate 45) | a look; two players picking the same civ |
| 21 | hills = bare half block (ridges withdrawn, shot17), mountains = cone massif; Cities / Government / Research panels; reading face in the remaining panels | built (gate 36) | a look at each; text clipping in the refaced panels |
| 23 | Legend as a Controls panel (key caps), Turn log filter chips + kind words, bottom-left panels beside the button column | built (gates 46, 47) | a look at each |
| 22 | city panel and host setup panel in the card style | built (session 2026-11-15) | a look at each; catalog row widths, option card scroll |
| 18 | phone: narrow layouts for panels cut under 0.75 (Encyclopedia, Ship, Tech tree, End screen) | open | the phone run's `cut to` list |

Items 9–11 are held on purpose: T2b stacks a second wedge type on an
orientation nobody has seen, and U5 touches every panel.

## 6. Assessment

| risk | note |
|---|---|
| Not seen in Studio | Everything since run-N was built with Studio unattended: lune-compiled (gate 40), pure halves pinned, look unverified. The audit now reports geometry (rects, fit, counts), not appearance — a screenshot is still the look check. |
| Warning channel | Confirmed in run-M: a script `warn` lands as level Warning on `FLog::CreatorOutput`; the reader shows it under `--diag`. |
| EditableImage | run-M: refused — "EditableImage is not accessible. Go to the Security Tab in Experience Settings to enable this API." 0 of 27 icons drawn, buttons text-only (logged, no error). User-side setting. run-R (setting on): 22 of 27 drawn; 5 refused on a sub-pixel fill span (clamped to 1 px since); icons sat over the labels (UIPadding moves children; fixed, audit checks it). |
| Dock | The row now moves on every viewport change; a planner error falls back to the built offsets. Icon size is fixed at dress time (24 px in a 40 px button). |
| Part count | Full massif ≤ 32 parts per mountain tile, now in every look. ~80 mountain tiles on 40×25 = ~2.6 k parts; lite path above 150 tiles. The audit prints the folder counts. |
| Look parity | The browser Medium/High surfaces are meshes; this is a part-built reading of the same idea, not a twin. No gate compares them, by design. |

## 6a. Placement rule and the deck (run-R, shot9)

- **Same area as the button**: a panel opens in the screen area of the
  control that opens it. Top-centre buttons → top-centre panels (Cities
  left of centre, Government centre, Research right of centre); top-right
  Options → right; bottom-left toggles → left, above the stack; modal
  panels (host setup, regent dialog, Encyclopedia, Tech tree, Ship, end
  screen) → centre. The seat list stays right, opposite nothing.
- **No game HUD without a game** (`HudGate`): action bar, research cluster,
  bottom-left toggles, minimap are off until the client has a view.
- **Heading on every panel**: its own top label, else a name tab above the
  frame (`PanelDress.TAB_TITLE`).
- **Observation deck** (`DeckPlan.luau` pure + `Deck.luau`): a 76x48 railed
  platform. Five stations in one row facing the spawn — START A NEW GAME,
  JOIN GAME, TAKE OVER AI CIV, SPECTATE, GOTO CAPITOL — each a pad standing 0.3 studs proud of the floor (flush tops flickered against the walkway strips, run-S)
  with a sign: title, one-sentence explanation, and a status line per
  lobby phase (`DeckPlan.status`). Glass railings, a glass look-down
  balcony past the front edge, four lit pylons, a banner. Nothing casts a
  shadow on the board. Server contract unchanged.

## 6b. Dev-tool gating (run-R review)

`DevAccess.luau`: `studio()`, `owner()` (the place's creator account in a
published server), `dev()` = either. Client-only tools use `dev()`: the
asset gallery (button AND its K hotkey), the mid-game THEATER button.
Tools the server judges keep the server's gate (debug menu: Studio debug
game; AI-strategy pull: Studio or spectator; Kick: creator or `ADMINS`).
Rulings (user, same day):

1. **Owner debug game** — host setup has a "debug game" switch, shown to
   and accepted from the place owner only (`isOwner`: Studio, or the
   creator account of a user-owned place). It creates the game with
   `debug = true` (docs/07 §6 taint on first use, as in Studio). The
   server takes `debug` commands and the AI-strategy pull from the owner
   only; the Debug menu and strategy button show for the owner while the
   running game is a debug game. A Studio game is a debug game as before
   (initial hash unchanged).
2. **Admins = place setting** — `RMCAdmins` attribute on **ServerStorage**
   (string of UserIds, e.g. `"12345, 67890"`; server-only). The creator is
   always an admin. Set it in Studio's Properties and publish.
3. **PAD** — the left-edge button is gone; the control is the Options row
   "on-screen ride pads: auto / ON / off".
4. **Diagnostics** — game option "diagnostics log for players" in host
   setup (default Off). Off: `Diag.quiet` for non-owners (nothing printed,
   no audit; failures still recorded). Studio and the owner always log.

## 7. Tests

`roblox/check.sh`: gate 35 menu icons, 36 terrain sculpt, 37 slope skirts,
38 diagnostics (Diag pins, audit gui list == created ScreenGuis,
studio-log parser), 39 dock planner + touch labels + phone rule, 40 every
source compiles, 41 sand coasts, 42 panel fit (scale, anchor-preserving
placement, phone cut-to-fit), 43 deck plan (stations inside the floor,
explanation + per-phase status for each); gate 36 also pins the woods. Studio: `node roblox/tools/studio-log.js --diag` after a Play
Solo — expected `0 failure kind(s)`, `icons drawn N of N wanted`.

## 8. Open questions

None blocking. To confirm from the first logged run: the Image-API
setting, and whether the massif should also lower in the brick look's
stepped relief (`brickTop` is applied to blocks, not to prop seating —
pre-existing).
