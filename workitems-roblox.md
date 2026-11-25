# workitems-roblox.md — roblox-helper queue, file form

The agent-mail hub is down, so this file carries the roblox-helper's
work stack (transcribed 2026-08-27 from the dev-PC queue store, FIFO
order preserved) plus the mail context each item referenced. It is
self-contained: nothing below requires reading the mailbox.

**First step: `git pull origin dev_night` — expect tip `e612651` or
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

## 1. G0 re-mirror — Horse rework + desert palette [task, architect, queued 2026-08-08] [done: 2026-11-01 — architect session (Sonnet agent): PROP_SHAPES regenerated key-for-key from recipes.js (50); 12-primitive standing horse; desert palette via the regenerated TerrainPalette. tile-props-parity green. Studio look pending (no rojo/Studio on the dev PC).]

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

## 2. EXTENDS item 1 — H1 animal reworks [task, architect, queued 2026-08-09] [done: 2026-11-01 — same pass: fish side profile, forest/tundra deer, arctic seal motifs. Studio look pending (no rojo/Studio on the dev PC).]

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

## 3. city-era twin — roadStageFor + annotateCityEra viewer param [architect, queued 2026-08-11] [done: 2026-11-01 — ViewRenderer roadStageFor (1:1; lune-checked vs JS over 370 tech sets, 0 mismatches) + annotateViewerRoadStage (viewer stage, spectator max); city-era-parity extended to cover it.]

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

## 4. Encyclopedia rename — the held #2616 edits never landed [architect, queued 2026-08-11] [done: 2026-11-01 — architect session (Sonnet agent): Pedia.client.luau 5 sites + Ship comment; no Gamepedia left in roblox/src; the resetServer site carried no stale text. Studio look: the 12-char button vs the Ship button at -370.]

Background: a 2026-08 roblox session claimed this but its environment
denied all file writes; the edits were held, and verification 2026-08-11
confirmed they NEVER landed — `Pedia.client.luau` still says
"Gamepedia". The ruling stands: PEDIA_NAME = **'Encyclopedia'**
(user-ruled 2026-07-25).

The swap: Gamepedia → Encyclopedia in
`roblox/src/client/Pedia.client.luau` lines 1, 30, 53, 235, 331 +
`Ship.client.luau` line 25 comment + the resetServer comment. Browser
twin for reference: `client/ui/pedia-name.js`.

## 5. EXTENDS item 3 — TileProps road/rail sync to H13+H13b [architect, queued 2026-08-11] [done: 2026-11-01 — ROAD_STAGE 5 stages, dash rows, twin/quad rails + wide ties from stage 3, city tiles draw a plain-road half toward real-road neighbours (no stub). Medium-tier shape only (no surfaceAt for the high-tier conforming ribbons). Studio look pending (no rojo/Studio on the dev PC).]

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

## 6. Server door validation — the fe-R13/R2 twin [architect, queued 2026-10-30, P1] [done: 2026-11-01 — architect: luau/state-string.luau twin (stricter: integers/booleans only, no floats/NaN/Roblox datatypes); GameServer rejects badShape (non-state-legal payload or name > 24) and notAllowed (not in CLIENT_COMMANDS, so claimSeat) before engine.applyCommand; test/state-string-twin.test.js JS==Luau.]

`GameServer.server.luau` copies every client `cmd` field into
`engine.applyCommand` unchecked. A client can send `type = "claimSeat"`
(server-only), and a non-ASCII or control-char string (a city name)
enters state, where `statehash` refuses it. Port `shared/state-string.js`
as a twin, reject both with `badShape` before the engine call, cap
`cmd.name` at 24. Detail + reference tests:
`specs/luau-catchup-2026-10-30.md` step 2.

## 7. `ageChanged` now reaches Roblox clients [architect, queued 2026-10-30]

`luau/visibility.luau` WORLD_NEWS gained `ageChanged` in `e612651`
(golden-neutral, view-only). No code change needed on this side; confirm
in Studio that the `[world]` age line shows once per age. Detail:
`specs/luau-catchup-2026-10-30.md` step 2.

## 8. Turn-log line for `buildingSold`, incl. the new `bankrupt` reason [architect, queued 2026-10-30] [done: 2026-11-01 — architect session (Sonnet agent): TurnLog narrate branch (own seat, obsolete / treasury empty suffixes); PediaConcepts upkeep + combat synced (parity 29/29).]

P4 (engine + `luau/tech.luau`, 2026-10-30): when a player's treasury goes
negative at the turn wrap, the cheapest non-Palace building is sold, with a
`buildingSold` event `{playerId, cityId, building, gold, reason = "bankrupt"}`.
`TurnLogClasses.luau` classifies `buildingSold` but `TurnLog.client.luau` has
no formatter for it, so no sale (obsolete, manual or bankrupt) is shown.
Browser reference, `client/ui/turnlog.js`: `sold <Building> (+<gold>g)` with
the suffix `, obsolete` or `, treasury empty`; own seat only.

Same pass: `PediaConcepts.luau` mirrors the browser's `upkeep` concept,
which gained one sentence (`client/ui/pedia-concepts.js`): "If the treasury
cannot pay, your cheapest building is sold each turn until it can". The
`combat` concept also gained one (P3): "Rival leaders never fire a nuclear
weapon first, but a civ that uses one invites nuclear retaliation from every
civ at war with it."

## 9. Re-bake the generated rulesets — `rules.nukeDoctrine` [architect, queued 2026-10-30] [done: 2026-11-01 — node roblox/data/build.js + --check OK; RulesetHashes + rules.luau, and AssetRecipes/TerrainPalette picked up the August art data.]

P3 (A115) added `nukeDoctrine` to `data/rules.json`, so the rules hash the
GameServer gates on at boot has moved; re-bake as after `f210760`
(`ae21749`). The doctrine itself arrives through `../luau` with no Roblox
code: the AI now retaliates with nuclear units against a civ that has
detonated one.

## 10. City happiness breakdown [user ruling 2026-11-02, done same day]

[done: 2026-11-02 — architect session (Sonnet agent): CityPanel mood row
(faces + specialists) and a factor tooltip from the engine's own
`happiness.cityMood` (contentCitizens from the new `view.difficulty`,
luxuries, content buildings with temple doubling, owned mood wonders by
MOOD_WONDER_EFFECTS, war unhappiness); no command sends.
`roblox/selftest/city-mood-parity.mjs` = check.sh gate 32. Studio look:
emoji in the Code font, the 178 px row beside Buy, tooltip placement, and
the numbers on a non-medium game.]

## 11. F1 — found-city name prompt [roblox-helper, self-queued 2026-11-14 from plan-version2 "Roblox parity remainder"] [done: 2026-11-14 — FoundCity.luau card + CityNames.luau (suggestCityName twin, lune-pinned) + GameServer TextService filter with Colony-N fallback; check.sh gate 33. Studio look pending: PLAYTHROUGH-UI step 8.]

Architect follow-up (not this lane's files): flip the F1 bullet in
`plan-version2.md` / `.html` "Roblox parity remainder" to built.

## 12. F2 — world-label collision at close camera range [roblox-helper, self-queued 2026-11-14 from PLAYTHROUGH-UI §F2] [done: 2026-11-14 — LabelDeclutter.luau (pure pick, lune-pinned) + ViewRenderer 0.2 s screen-space pass; check.sh gate 34. Studio look pending: the §F2 repro (3+ adjacent cities, default camera height); SLACK / textWidth are the tuning knobs.]

Architect follow-up: the `plan-version1.md` "Roblox label collision" row.

## 13. U1 — chunky button dress + code-drawn menu icons [user direction 2026-11-14, specs/roblox-native-look.md] [done: 2026-11-14 — UiTheme.luau + MenuIcons.luau + EditableGlyph.renderPrims; top row, action bar, End Turn; check.sh gate 35. Built with Studio unattended: look NOT verified — PLAYTHROUGH-UI §F look check.]

## 14. T1 — sculpted mountains + hills (ENHANCED look) [user direction 2026-11-14, same spec] [done: 2026-11-14 — TerrainSculpt.luau planner through TileProps put; mountain block 0.6 height; gate 36. Look NOT verified in Studio.]

## 15. U2 buttons + T2 slope skirts [same spec] [done: 2026-11-14 — close/primary/toggle buttons through UiTheme, 4 more icons; TerrainSkirts.luau wedges, gate 37; EditableGlyph Draw* combineType fix (gate 35 arity pin). Look NOT verified in Studio.]

## 16. Diagnostics + Studio-log reader [user direction 2026-11-14, second round] [done: 2026-11-14 — Diag.luau / DiagAudit / DiagServer, tools/studio-log.js (--diag, --list, --save for assemble.js; the run-N session replays hash-exact from the log, 155 turns); gate 38; gate 40 compiles every source. Unconfirmed: the channel/level a script warn or error lands on (none has occurred in a logged session).]

## 17. U3a top-row dock + rulings 2/3 [same round] [done: 2026-11-14 — DockLayout (pure) + HudDock, 5 buttons + clock; hotkey hints off on touch-only (UiText); sculpted mountains in every look; enhanced-haze look-change fix; gate 39. Look NOT verified in Studio.]

## 18. U4 verb icons + fitted action bar, U3b phone row, T3 sand coasts, T4 mixed woods ["go ahead with items" 2026-11-14] [done: 2026-11-14 — MenuIcons 27; ActionBar AutomaticSize + UIScale; UiText.isPhone / DockLayout bottom mode / phone verb filter; TerrainCoast.luau (gate 41); TerrainSculpt.forest (gate 36). Look NOT verified in Studio; phone not seen on a device or emulator.]

## 19. run-M read from the Studio log + two screenshots [2026-11-14] [done: 2026-11-14 — session replays hash-exact (324 turns, code 91RT-4XKC-PY91R, regent game). Log findings fixed: bottom-left toggle stack 16 px up (Turn log hung below the screen), Debug toggle out from under Map overlays, auto end turn silent under regency (was one roundInFlight reject per round), audit covers HUD-level unthemed buttons. Screenshot findings fixed: Roblox player list off (it covered the menu row), mountain summits ~25 % lower. Confirmed: script warn lands as Warning on CreatorOutput. OPEN (user): icons need Game Settings > Security > "Allow Mesh / Image APIs" — EditableImage refused, 0 of 27 drawn.]

## 19b. run-R (Image API on) read from the log + shot3 [2026-11-14] [done: 2026-11-14 — session replays hash-exact (424 rounds, code 6C0W-NCRS-3WBMA). Icons 22 of 27 drawn; 5 refused ("DrawRectangle expects size > 0": a fill span under 1 px at a triangle apex) -> span clamped to 1 px. Icon over label on every icon + text button (UIPadding shifts child instances) -> icon offset back out of the padding, audit line "icon over label" added. User requests: Tech tree = graph icon + "Tech Tree" label; menu row and Research/Cities/Government cluster moved into the Roblox top bar strip (inset >= row height, else the old y), cluster sized to its buttons, research-status line below it, menu row share capped so it stays clear of the cluster. Look of these NOT yet seen.]

## 19c. shot4 + reading-size text [2026-11-14] [done: 2026-11-14 — log: icons 27 of 27, 0 failure kinds, menu row in the top strip (y=-49). shot4: research cluster stayed at y=8 (inset read 0 at script load) -> re-read for 10 s. User request "text large enough": UiTheme.TEXT (title 22 / body 17 / small 14) + BODY_FONT; advice card 440 px auto-height with themed buttons, discovery card 540 px measured height, tooltip 15 px / 360 px; audit line "N visible text(s) under 14 px" names the rest. OPEN: the remaining sub-14 px texts (29 sites, per-panel row heights), Turn log label wraps when it carries a count.]

## 19d. U6 panel fit + turn chip + review [2026-11-14, user: "review all panels … mobile and desktop"] [done: 2026-11-14 — UiPanel.luau (pure) + PanelDress.client.luau: every panel scaled per screen (1280x720 reference, floor 1, cap 1.4), cut to fit small screens, anchor-preserving position, outline + heading font; gate 42 (selftest/ui-panel.luau). Top-left turn line = rounded chip, proportional face, coloured gold / turn state. Review findings fixed: dialogs built on first use fitted on ChildAdded, cards clamp to a narrow screen, turn-log scroll-to-bottom no longer reads a scaled AbsoluteSize, small-text audit multiplies by UIScale. Review findings OPEN (need the next log): panels reported heading=NONE, panels cut under 0.75 on a phone, remaining sub-14 px texts, phone bottom-left toggles / unit cards. Look NOT yet seen.]

## 19e. shots 5-7 + fourth run-R log [2026-11-14] [done: 2026-11-14 — log: 0 failure kinds, 27 of 27 icons, 0 texts under 14 px, replay not re-run this pass. FOUND: every panel fitted at scale 1.00 in an "800x600" area (a disabled ScreenGui's AbsoluteSize is stale) -> PanelDress reads the camera viewport minus the inset. User requests: lobby seat panel rebuilt (heading, plain-language phase line, seat/player/open count, one card per seat with civ, holder, status badge YOU/PLAYER/AI/REGENT/OPEN, themed Kick; panel height follows the seat count); research-status line = 20 px chip; Encyclopedia 880x520 with reading faces (17 px detail, 16 px list, 17 px categories), 44 px header, picked entry + picked category lit. Advice card grows upward (it covered the DEBUG / PAD chips). OPEN: panels the log names heading=NONE (Options, Diplomacy, TurnLog, EndScreen, Stats, CityPanel); the HUD game buttons show on the lobby deck before a game exists. Look NOT yet seen.]

## 19f. shot8 (game over, score victory) + log [2026-11-14] [done: 2026-11-14 — session replays hash-exact to the end (545 rounds, 23438 commands, code EZJW-TR99-KSH5R); 0 failure kinds, 0 errors over 52 min. Fixed from the shot: turn chip showed "your turn · GAME OVER" (now GAME OVER only); End Turn reads "Results" after the game (its click already reopened the end screen); play-advice cards are taken down at game over and while the regent holds the seat; Turn log toggle count is short and capped ("· 99+", was a wrapped "— 2211 new"). That session predates the panel-area fix, so panel scale is still unseen.]

## 19g. code placement [2026-11-14, user: "Get resume code … more logical location"; "code … elsewhere or a tool tip"] [done: 2026-11-14 — the host's resume-code button + code box moved from under the menu row to the foot of the Options panel (host, game running; the panel grows 74 px); the per-turn game-code chip and the autosave chip left the HUD, both codes read in the turn chip's tooltip; the "saves off" warning chip stays. Resume after rejoin is unchanged (lobby panel's resume box, idle phase; its phase line now says so). Not built: a prompt on leave/disconnect — the client gets no hook before a leave; the autosave covers it. Look NOT yet seen.]

## 19h. dev-tool gating review [2026-11-14, user: "gate the debug buttons … owner only … review and suggest"] [done (client part): 2026-11-14 — DevAccess.luau (studio / owner / dev). FOUND + fixed: the K hotkey opened the asset gallery for every player in a published place (only its button was Studio-gated); THEATER showed during play for everyone (now post-game, or dev). Already gated, unchanged: DEBUG gallery button, "Debug (Studio)" menu (client returns outside Studio; server debugEnabled is Studio-only), AI-strategy button (Studio or spectator; server gates the pull), Kick (server-sent youAreAdmin = creator or ADMINS). SUGGESTED, needs a user ruling (server policy, GameServer): (a) owner debug in a published place = an owner-only "debug game" switch in host setup that sets debugEnabled at create (hash-tainted per docs/07 §6), then DebugMenu/Strategic show on DevAccess.owner(); (b) ADMINS list is an empty literal in GameServer — fill it or move it to a place attribute; (c) PAD toggle into Options (a player feature with a dev-looking label); (d) DiagAudit prints for every client — keep (console only) or gate to dev.]

## 19i. dev-gating rulings 1-4 [2026-11-14, user: "1. ok 2. place setting 3. move to options 4. game option … always on for owner"] [done: 2026-11-14 — GameServer: isOwner; setup.debugGame (owner-only "debuggame" key, createGame debug flag; Studio unchanged) + setup.diag; lobby payload youAreOwner / options.debugGame / options.diag; `debug` commands and the strat pull owner-only outside Studio; admins also read from the ServerStorage `RMCAdmins` attribute. Client: two host-setup rows, DebugMenu + Strategic gate on DevAccess + ClientState.debugGame, Diag.quiet + DiagAudit follow the option (pinned in selftest/diag.luau), PAD button hidden (Options row is the control). NOT exercised: a published server (owner path, attribute read) — Studio always takes the Studio branch.]

## 19j. shot9 / shot10 + finished regent game [2026-11-14] [done: 2026-11-14 — acceptance/runR.txt: 545 rounds, 24554 commands, code AY99-6SDW-04P43, ALL HASHES MATCH, 0 script errors. ROOT CAUSE of "left side starting menu collides": PanelDress placed panels while the viewport read 1x1 (cut to 0.30, clamped into a corner), then its deferred Position handler adopted that spot as the panel's home -> area floor + written-value compare (SPEC gotchas 13/14). Also: game HUD guis off on the deck (HudGate); Cities / Research panels under their top-centre buttons; wait-status line under the research chip; name tabs on the six heading-less panels; regent dialog is centre by its own offsets (it was displaced by the same bug). Deck rebuilt: DeckPlan.luau (pure, gate 43) + Deck.luau — five stations in a row (pad + sign: title, explanation, per-phase status), glass railings, glass look-down balcony, four lit pylons, banner; pad/prompt/spawn/floor names unchanged; SPECTATE and GOTO CAPITOL now read open while a game runs. Look of the deck and of the fixed panels NOT yet seen.]

## 19k. independent review of the unrun run-R code + phone toggle row [2026-11-14] [done: 2026-11-14 — review (read-only agent, diff fbb8ce9..HEAD): no load-time error, no hole in the owner/debug gating, Deck contract consistent. Fixed from it: lobby resume box over the last seat card in the idle phase; advice cards (regent card could be lost, play advice was marked seen while refused, a card could reappear after game over); THEATER gate (needs a view post-game, admins keep mid-game entry, re-evaluated without a view push); deck sign canvas 600x330 with a one-line title; name tab excluded from heading detection and kept on screen; Diag starts quiet outside Studio; isAdmin requires a user-owned place for the CreatorId match. NOT fixed, to check in Studio: AutomaticCanvasSize / AutomaticSize under a UIScale (seat list, setup bars, name tabs) at 1920x1080; turn-log scroll-to-bottom; the menu row wraps the clock to a second row at ~1280 px wide when the Ship button shows. Phone: LeftStack.luau — the four bottom-left toggles as one row of 44 px icon squares; needs a phone-emulator run.]

## 19l. run-S first read (shot11: deck during the start countdown) [2026-11-14] [done: 2026-11-14 — log at 3 min: 0 failure kinds, 0 errors, 27 of 27 icons, every panel fitted at scale 1.25 in the real 2208x911 area (the 1x1 / 800x600 readings are gone), name tabs reported on 6 panels, no game HUD on the deck. SEEN in shot11: deck with railings, lit edge, pylons, five station signs, seat card panel. Fixed from it: a pre-game seat card showed a pool civ name ("Romans") though civs are drawn at start (the game gave English) -> "Seat N · civilization drawn at start"; Kick button on the player's own seat removed; turn chip ("joining…"), End Turn and the AI button hidden on the deck (HudGate). Phone: unit cards row follows the action bar's fit. EndScreen still reports heading=NONE (its headline is larger than the heading rule) — left. Station sign text is small from the spawn camera distance — to judge from a closer shot.]

## 19m. run-S second session (21:06Z) log read [2026-11-14] [done: 2026-11-14 — boot audit: 0 failure kinds, 0 errors, 27 of 27 icons, 30/30 guis, 0 texts under 14 px. Finding: RMCOverlays reported heading='City influence' and RMCDebugMenu its warning line — the heading scan had restyled a first row. Both now carry a name tab (`TAB_TITLE` wins over the scan); end-screen headline styled in place. Commit 7a5508f. gamesim-golden-neutral.]

## 19n. run-S playtest notes + U5 [2026-11-14] [done: 2026-11-14 — deck pads stand 0.3 proud (their tops were coplanar with the 0.06 walkway strips: the flicker); welcome banner 40 px title / 24 px body, up to 900 px wide, 14 s; the place file's template spawn no longer draws its mark (decal hidden, spawn disabled); U5 `UiTheme.row` on city list / research picker / build catalog; CityPanel, TurnLog, Options, TechTree legend, WorkedTiles, Historian hint texts raised to 14 px. Commits 3ffe860, e14f55c + this one. Needs a fresh Play to show. gamesim-golden-neutral.]

## 19o. run-S shot12 / shot13 + regent log [2026-11-14] [done: 2026-11-14 — (A) income tooltip = reading card (title, gold / science / treasury values in colour, rates, codes in monospace; card sizes to its text); (B) mountains and hills rebuilt from ellipsoids (`AssetFactory` sphere with `ellipsoid`, no new PROP_SHAPES key): summit = nested foot / body / crown + fitted snow, hills = three low domes; gate 36 pins rewritten, full massif 14 parts (was up to 32); (C) tech tree = dependency graph (`TechTreeLayout.luau` pure, gate 44): 19 level columns x up to 8 rows, 115 elbow lines, sideways scroll, era colour per box, opens on the current research; the garbled row text in shot13 was a contextual UIStroke outlining the text; (log) 134 `roundInFlight` rejects in 36 s with the regent on — `ClientState.send` now sends nothing while away, BuildQueue waits; `researching = ""` normalised to nil in the client view (top line read "researching:  - 10 turns"; auto-research could not arm). Look not verified in Studio. gamesim-golden-neutral.]

## 19p. run-S shot15 + playtest notes [2026-11-14] [done: 2026-11-14 — (A) civilization choice: `CivGallery.luau` centred overlay (Random first = default, left / right buttons and arrow keys, civ colours, leader, special strength, AI temperament, first cities, "taken by"); opened from the own seat card and from the host panel's "Your civilization" button; server `pickCiv` (seated players, before the start, one player per civ) and a roster swap at start - [R4INIT] prints the final civ list so the replay is unchanged in form; (B) every click-opened panel has a close X: `PanelDress` adds `PanelClose` where a panel has none (Cities, Statistics, Options, Diplomacy, Turn log, Legend, Map overlays, Debug); (C) tech tree hover / long-press card: era, state, blurb, needs, leads to, units / buildings / wonders / government it opens; mountain resource marker in the free ring gap; end-screen headline named Heading. Gate 45 (grep pins). Not verified in Studio. gamesim-golden-neutral.]

## 19q. run-S shot16 [2026-11-14] [done: 2026-11-14 — terrain: mountains back to the cone massif on the grey base (the ellipsoid summits read as blobs); hills = block at 50 % of its old height (`ViewRenderer.tileTop`) + two rolling ellipsoid ridges with a valley through the centre (`TerrainSculpt.hills`, gate 36). Panels: Cities = city cards (population badge coloured by size, DISORDER / CELEBRATING chips, production dot by kind, progress bar); Government = government card with colour band and traits, three coloured rate bars with steppers, switch buttons incl. locked ones that say what they need; Research = progress header + rows that expand to the tech information (`TechInfo.luau`, shared with the tech tree hover card) with a Research button; Options states coloured (ON green / off grey / choice blue); `PanelDress.REFONT` gives the reading face to Options, Map overlays, lobby + host setup, Diplomacy, regent dialog, city-name prompt, end screen, fast-forward, city panel, Encyclopedia, Ship. Monospace kept on purpose: turn log, statistics, legend, AI strategy, debug. Not verified in Studio. gamesim-golden-neutral.]

## 19r. session 2026-11-15 00:00Z [done: 2026-11-15 — shot17: hill ridges removed (read as eggs), hill = bare half-height block, resource marker and mine visible on it (gate 36 pin); city panel and host setup panel in the card style; CityPanel `openCityId` declared before `paintQueue` (queue strip never showed); toast exempt from the DiagAudit overlap check (the one DIAG FAIL of the session). gamesim-golden-neutral]

## 19s. shot18 [done: 2026-11-15 — Legend rebuilt as a Controls panel from `LegendData` (key caps, three sections; gate 46: every bound key documented or exempt); Turn log filter chips from `TurnLogView.chipLayout` (the six emoji headers collided), rows with a coloured kind word, reading face (gate 47); Turn log / Legend / Diplomacy / Map overlays panels open beside the button column instead of over it. gamesim-golden-neutral]

## 19t. Statistics [done: 2026-11-15 — panel rebuilt from `StatsView` (civ cards with labelled figures and battle record, wonders list, captioned score chart, scrolls past 460 px); the fog rule is pinned by gate 48; Zz / Au chips and the odds label raised to 14 px. gamesim-golden-neutral]

## 19u. shot19 [done: 2026-11-15 — city catalog offered the Barbarian Leader: list now follows `CatalogInfo.availability` (mirror of setProduction: barb-only + obsolete hidden, coast, nukes); hover card with the encyclopedia entry on every catalog and Built-here row; gate 49 over the real rulesets. gamesim-golden-neutral]

## 19v. T2b slope corner fills [done: 2026-11-15 — shot20 confirmed the skirt orientation; `TerrainSkirts.corners` + CornerWedgePart fill, apex corner measured at run time by raycast (`probeApex`), diagonals in the cache key; gate 37 pins. Wants one close shot. gamesim-golden-neutral]

## 19w. Military, Statistics access, feature list [done: 2026-11-15 — top-row Military and Statistics (J) buttons, Statistics button on the end screen; `Military.client.luau` + `MilitaryView.luau` (military-overview.js twin, gate 50); feature parity list `roblox/parity/*.txt` + `roblox/selftest/feature-parity.mjs` + generated `roblox/PARITY.md` (gate 51): 205 browser features = 115 available, 37 partial, 39 missing, 14 n/a; 18 user scenarios = 6 playable, 2 degraded, 10 blocked. gamesim-golden-neutral]

## 19x. Plan step 0 harness [done: 2026-11-15 — UI tour (`UiTour` / `TourPlan`, Debug menu > Run UI tour, 18 stops, gate 52), `roblox/tools/after-run.js` (gate 53), `TopRowPlan` for the five-button top row (gate 54), gate 55 (local read before declaration); badges added to the plan as step 8. Step 0.4 (run A + C) is the user's. gamesim-golden-neutral]

## 19y. Badge rules [done: 2026-11-15 — plan step 8.1: `BadgeRules.luau`, 50 badges + earning rules, gate 56; awarding (8.3) waits on three rulings and the badge ids. Found: host setup difficulty reaches only the content-citizen count (plan step 1.0). gamesim-golden-neutral]

## 19z. Run A findings [done: 2026-11-15 — tour 18/18, 0 DIAG FAIL; fixed: `debug` passed inside `options` at game creation (engine reads the top level), so Studio games were never debug-enabled and all debug commands were refused; same fix in `roblox/acceptance/assemble.js`; tour reports refused staging. gamesim-golden-neutral]

## 19za. Discovery splash [done: 2026-11-15 — user: a discovery needs a bigger splash with the encyclopedia information. `DiscoveryView.luau` (content: unlock chips, now-open vs later, research prompt, regent-only timeout; gate 57) + `DiscoveryCard.client.luau` redrawn as a centred card on a dimmed backdrop; tour stop `discovery`. gamesim-golden-neutral]

## 19zb. Difficulty levels [done: 2026-11-15 — plan step 1.0: host setup offers the engine's seven levels and passes the id to createGame (before: nothing passed, every game ran as prince); `[R4INIT] levels=7`, save `levels = 7`, legacy logs / saves handled the old way; gate 58. Wants one Studio game on a non-default level. gamesim-golden-neutral (Roblox setup only; no engine change)]

## 19zc. City screen [done: 2026-11-15 — plan step 1.1-1.4: specialists (+ Tax / + Sci / Reset), previous / next city, food and growth line with starving warning, capital mark, disorder in the subtitle, trade route list; `CityView.luau`, gate 59; 8 parity rows flipped to yes. Not seen in Studio. gamesim-golden-neutral]

## 19zd. Empire overview [done: 2026-11-16 — plan step 2: Economy tab in the Cities panel (net pinned to playerIncome over a real game), yields / gold / science / upkeep per Cities row, Population / Cities / Techs charts beside Score; `EmpireView.luau`, gate 60; tour stop `economy` (20 stops); income readers moved to the own-cities shim (the raw view broke playerIncome once rival cities were known); capital mark follows capitalOf. Session 2026-11-15 23:xxZ (godemperor, levels=7): replay hash-exact, tour 19/19. Not seen in Studio. gamesim-golden-neutral]

## 19ze. Bottom bar vs corner toggles [done: 2026-11-16 — session 2026-11-15 ended turn 546 (score victory p3, godemperor, replay hash-exact, final 0x770d2b89); audit raised 2 FAIL at a 1222 px viewport: the action bar at its 0.5 floor still ran into Turn log and AI. `BarFit.luau` (gate 61): shrink between the corners down to 0.7, below that the bar takes its own strip above them at full width. Not seen in Studio. gamesim-golden-neutral]

## 19zf. Unit orders [done: 2026-11-16 — plan step 3: Help Wonder (button + H), route dots while selected + Cancel route, tile-following labels (Drain / Clear / Plant / Rail), hover card with the reason on every order button, Disband confirm; `UnitOrders.luau`, gate 62 (1,408 settlers-job cases vs `improvements.startWork`, Help Wonder vs `cities.helpWonder`). The Road button now sends `railroad` on a roaded tile (it always sent `road`). 8 parity rows to yes. Not seen in Studio. gamesim-golden-neutral]

## 19zg. Session 2026-11-16 14:51Z + camera F guard [done: 2026-11-16 — 40x25 continents, 3 civs, prince, levels=7, seed 840743, regent on: 546 turns, score victory p1, final 0x9a25f498, replay hash-exact; 0 DIAG FAIL, 0 warnings, 0 errors; tour 20 of 20 (first run with the Economy stop); 893 of 27,966 commands refused (3.2 %: impassable 796, zoc 49, techRequired 48); 0.55-0.76 s per turn. Session 08:11Z: F (follow-avatar) toggled three times in 1.5 s while walking; F is now ignored while W / A / S / D is held (gate 46 pin). The user confirmed the walk is right again. Plan revised: `specs/roblox-parity-plan.md` revision 2. gamesim-golden-neutral]

## 19zm. Pedia art P2 [done: 2026-11-23 — user pick: style C (diorama). 22 wonder models as data (20-54 parts, each on a ground slab in its setting), contact sheets `roblox/art/wonders-1..4.png` read and three models corrected from them (Magellan rocks, Hoover Dam camera, SETI dish facing). Part format gained `tilt`; gate 65 now checks exact tilted bounds, a model per wonder, diorama minimums. Encyclopedia: 130 of 186 entries with a picture. Gallery grid (K) shows all models. Not run in Studio. gamesim-golden-neutral]

## 19zl. Pedia art P1 [done: 2026-11-23 — encyclopedia picture box: units as turning models, advances as the glyph on its era card, terrain as a 3 x 3 patch of real tiles with props and the special resource (`PediaArt` pure + `PediaPicture`, gate 66). 108 of 186 entries have a picture; 78 keep the text-only pane until P2 / P4 / P5. `TileHeight` now holds the tile-top rule for the map and the picture; `TileProps.rebuild` takes an uncached flag. First ViewportFrame in this client. Not run in Studio. gamesim-golden-neutral]

## 19zk. Pedia art P0 [done: 2026-11-23 — rulings: code-built art, rival wonders = small card, scene about 8 s skippable, buildings as 3D models. `StructureModels` (data, 7 shapes, 16 roles, arch expansion, bottom-up order), `StructureBuilder` (Parts), `roblox/tools/model-preview.js` + `.html` + `model-export.luau` (headless contact sheet through the vendored three.js, read only), gate 65. Sheet: `roblox/art/pyramids-styles.png` (A icon 4 parts, B courses 22, C diorama 25); the three also stand behind the gallery grid (K). Builder not run in Studio. Open: USER picks a style. gamesim-golden-neutral]

## 19zj. Encyclopedia pictures + wonder scene: design and plan [done: 2026-11-18 — `specs/roblox-pedia-art.md`: 186 entries, 108 with reusable art (unit models, tech glyphs, terrain tiles), 78 to draw (22 wonders, 21 buildings, 6 governments, 29 concepts); model data + headless preview sheet; scene beats and rules; steps P0-P6. Nothing built. Open: five user decisions (spec section 4). gamesim-golden-neutral]

## 19zi. Badge awards [done: 2026-11-17 — rulings: milestones count regent turns, victory badges need half the turns ended by the user, debug-used games earn nothing, only the winning seat wins. `BadgeTrack` + `BadgeIds` (all 0) + `BadgeAward`, hooks in `GameServer` (`badgeEvents`, `onTurn`), `roblox/selftest/badge-track.luau` over a real 80-turn engine game (gate 64), `after-run.js` prints earned keys. Not run in Studio. Open: USER creates the 50 badges and pastes ids (plan 8.4). gamesim-golden-neutral]

## 19zh. Rulings 2026-11-16: treaty actions, big maps, skip vote [done: 2026-11-16 — (1) Foreign-relations panel acts: accept / reject, offer peace, declare war (two presses), Propose card (peace / demand tribute / tech swap or gift), envoy card for an incoming offer; `DiplomacyView` rules + `roblox/selftest/diplomacy-actions.luau` drive the real engine through filterView (gate 63); dip-03..08 to yes, S11 playable. (2) mp-15 n/a, S17 playable. (5) large / xlarge / huge offered in the host setup with a latency label (server `MAP_SIZES` + lobby), gf-34 yes, S01 playable. Parity: 141 available, 24 partial, 25 missing, 15 n/a; scenarios 11 playable, 3 degraded, 4 blocked. Not run in Studio; no game on a big map has been run. gamesim-golden-neutral]

## 19zn. Pedia art P3-P5 + pyramid fix [done: 2026-11-23 — after Studio session 21:17Z (pictures drew, 0 failures; user: pyramids were four outward spikes, governments had no picture). Pyramid pieces moved to the quarter where the corner wedge's tall corner meets the axis (`StructureBuilder`, `AssetFactory`; apex measured at local +x -z). Wonder scene: `WonderScene` rules + 22 blurbs, `WonderStage.client` (stage away from the map, parts rise bottom-up, quarter orbit, card; rival card; skip), Options > wonder scenes, two Debug menu rows, tour stop `wonder`, `after-run.js` scene line, gate 67. 21 building models, 6 government and 29 concept emblem models; 186 of 186 entries have a picture; caption line under the picture; wonder entries lead with the blurb. Sheets in `roblox/art/`. 67 gates. Scene, new pictures and caption not run in Studio. gamesim-golden-neutral]

## 19zs. Plan R1-R7 built [done: 2026-11-25 — after session 2026-11-25 06:53Z (153 turns, 0 DIAG FAIL, replay hashes match, tour 18/21: city-hover, overlays, wonder failed). Log analysis: the three tour failures were the tour's own faults (auto end turn kept ending turns under it and view pushes rebuilt the rows; a pointer MouseLeave hid the previewed card; the overlay tick at the default 14 px; the wonder card's full-screen gui sits at -inset and was judged off screen) - fixed in 0d29df9. 1.15-1.35 s per turn is the 1 s auto-end delay (the 2026-11-23 2.28 s spike did not recur). The 486 `startWork` techRequired refusals of 23:25Z are the engine AI under the regent: roads proposed on river tiles without Bridge Building (`engine/ai.js` 1312 / 3528 / 3544 skip the bridge check that `improvements.js` 67-70 enforces), same lane as the 171 nothingToAttack refusals - report only. Built: R1 tour action stops (12), R2.1 automation priority (gate 69), R2.2 encyclopedia search (70), R2.3 sound switch / volume / minimap (71), R3 diplomat missions (72), R4 specialists / queue reorder / replay play and speed (73), building pictures on city rows (66), R6.2 city keys (74), R6.3 banners (75), R6.4 motion options (76), info-19 civ card (77), R5.1 design D screen fit + four overlap fixes (78), R5.3 touch (79), R7.2 / R7.3 report, R7.4 Options sections (80). Parity 164 / 21 / 5 / 15 n/a; 18 of 18 scenarios playable. Not run in Studio: all of the above. gamesim-golden-neutral]

To check in Studio after 19zs (one tour run covers most: Debug menu > Run UI tour, then `node roblox/tools/after-run.js`): the 12 action stops (a Diplomat beside a rival city makes act-diplomat run instead of skip; a second city makes act-city-cycle run); civilization card at the start of a new game; Missions picker prices; Auto priority button on an automated Settlers; encyclopedia search; Options sections, volume -/+, minimap switch, reduce animation; build queue < > x; Cities row specialists line; replay Play / speed after a finished game; Home flies to the capital, 1 / 2 / 3 and C with a city open; building pictures on city rows (and frame time with a long catalog); the action bar at a narrow window (it now starts right of the toggle column when lifted); a phone run in the device emulator (R5.2): taps select, long press GoTo / odds, menu row and minimap above the bar.

Noticed, other lanes (report only): the engine AI proposes `startWork road` on river tiles without Bridge Building and repeats it every turn for the same settler (486 refusals in one regent game, 23:25Z) - `engine/ai.js` lines 1312, 3528, 3544; a golden-moving fix for the engine lane.

## 20. Next [open] (2026-11-16, after session 14:51Z)

**Plan of record: `specs/roblox-parity-plan.md` revision 2 (2026-11-16).** Order: R1 tour action stops, R2 three one-item unblocks (automation priority, encyclopedia search, sound switch and volume), R3 diplomats, R4 degraded scenarios, R5 phone, R6 comfort, R7 housekeeping, R8 badges.

State (2026-11-25): 205 browser features = 164 available, 21 partial, 5 missing, 15 n/a; 18 scenarios = 18 playable. 80 gates. Open in the plan: R5.2 (user: emulator run), R7.1 (script splits, after a Studio run), Diplomacy card style, R8.4 (user: badge ids).

Built, pressed by nobody yet (the regent held the seat in every full game; the tour opens panels and presses nothing): city specialists / previous city / food line (step 1), Economy tab and chart chips by hand (step 2), order labels, hover reasons, Disband confirm, route dots and Cancel route, Help Wonder (step 3), bottom bar lift under about 1,300 px. R1 turns these into tour lines; until then the hand list is in `roblox/PLAYTHROUGH-UI.md`.

Rulings 2026-11-16: diplomacy built (19zh), skip vote n/a, statistics charts stay as the browser's, big maps offered. Badges ruled and built 2026-11-17 (19zi). Open: badge ids (user, plan 8.4).

## 19zo. Civ gallery scenes + wonder preview switch [done: 2026-11-24 — after Studio session 2026-11-23 23:25Z (195 turns, 0 DIAG FAIL, replay hashes match; pictures structure 22 / unit 6 / plate 2; scenes: 2 own, 3 rival, camera restored both times; user: pyramids, buildings, governments, concepts fine; the Debug menu scene ignored Options > wonder scenes off; the civilization window wants art). `CivEmblems`: a scene per civilization + random in the gallery card (`EMBLEMS.civs`, banner roles tinted with the civ's colours via `StructureBuilder.build` tint), sheets `roblox/art/civs-1-8.png`, `civs-9-15.png`; gallery 780 wide. `WonderScene.ownMode` is the one rule for scene vs card (plan and the Debug preview). Gate 65 pins both. Not run in Studio. gamesim-golden-neutral]

## 19zp. Resources overlay + city view yield labels [done: 2026-11-24 — user request. `YieldIcons` (pure): one row per resource, one glyph per point. City view (`WorkedTiles`): the tile label is sized in studs and fills the tile (was 64 x 30 px, one line at 14 px). Map overlays panel: fourth switch "Resources" labels every known tile within 9 tiles of the camera focus (at most 361 labels, follows the camera, hidden while a city view is open); `ClientState.cameraFocus`. Log line `[Overlays] resources on: N tile label(s) around x,y`. Gate 68. Not run in Studio. gamesim-golden-neutral]

## 19zq. Drawn yield icons + AUTO size [done: 2026-11-24 — user request after seeing 19zp. Food = ear of wheat, shields = coin, trade = two arrows passing each other (`YieldIcons.ICONS`; colours unchanged), drawn once per resource and shared by every label (`YieldLabel`, `EditableGlyph.primsContent`, `shade` tone); glyph text is the fallback. AUTO on the city centre at 60 % of the label height. Resources overlay labels sit on a dark chip, `MaxDistance` 600. Tile info card reads its glyph line from `YieldIcons.inline` (one source). `tools/icon-preview.js` + `roblox/art/yield-icons.png`; `after-run.js` lines for the civ gallery and yield icons. Gate 68 extended. Not run in Studio. gamesim-golden-neutral]

## 19zr. Resources overlay lies on the tile [done: 2026-11-24 — user after session 23:46Z ("icons look good"; no grey backdrop, should seem part of the tile, slightly raised). The label is a `SurfaceGui` on the top face of a clear plate 0.2 studs above the tile top; no backdrop; a dark shadow copy of each row for contrast; drawn over props so forests and peaks do not hide it. To check in Studio: which way the rows face from the default camera (turn the plate 180 degrees if upside down). Gate 68. Not run in Studio. gamesim-golden-neutral]

Second track: `specs/roblox-pedia-art.md` (encyclopedia pictures + wonder scene). P0-P5 built 2026-11-23 (19zk-19zn): 186 of 186 entries have a picture; the wonder scene is built. Left: buildings on the city panel rows, P6 map landmark (needs a ruling). info-18 is yes since 2026-11-24 (the scene ran in Studio 23:25Z).

Studio sessions 2026-11-23 21:17Z and 23:25Z: encyclopedia pictures of every kind (unit, wonder, building, government, concept, advance, terrain) drew with 0 failures, drag turns the model, the corrected pyramid is solid, the wonder scene and the rival card played and handed the camera back (2 scenes, 3 rival cards), map heights unchanged. Sessions 2026-11-23 23:46Z and 2026-11-24 21:35Z: civ gallery opened with its picture drawn; yield icons drawn as images (user: "icons look good"); Resources overlay switched on (25 labels at that point); 152 turns, 0 DIAG FAIL, replay hashes match. Still not run in Studio or not confirmed by eye: the flat Resources labels (19zr: which way the rows face, contrast without the backdrop), AUTO at 60 %, the Debug wonder preview with the Options switch off, tour stop `wonder` (no tour run since 2026-11-16), treaty actions panel / envoy / Propose cards, big map sizes, badge tracking past one command.

Noticed in session 2026-11-24 21:35Z (other lane, report only): 171 of 602 commands were `moveUnit` refused with `nothingToAttack` under the regent.

Noticed in session 23:25Z (not traced): 486 of 3,684 commands were `startWork` refused with `techRequired` (settler work proposed before its advance); 2.28 s per turn in turns 98-146 against 0.07-0.31 s in the other spans (prince, 40x25, 4 civs).

Known gaps, own lane: the wonder card's effect line has a fixed height (a long effect text can overflow); the K gallery grid does not show the civ scenes; the civ gallery is 780 px wide and has not been looked at on a phone-sized viewport; unit models are the low-detail baseline (user: "crude").

Earlier open items still standing:
- Two-player civilization pick contention; owner paths on a published server (need a second account / a published place). Run D.
- Touch: a long-press on a city catalog row both shows the card and picks. Folded into R5.

Noticed, other lanes (report only, `luau/` is read-only here):
- Regent seat refusals by game: 3,184 of 27,254 (60x38, 6 civs); 1,793 of 21,805; 41.8 % on godemperor (session 2026-11-15 23:xxZ); 893 of 27,966 on prince (14:51Z). `aiModule.pickCommand` proposes moves the engine refuses; they replay as refusals.
- `visibility.filterView` does not carry `players[].reputation`, so the Foreign-relations panel can not show a rival's reputation band (the browser reads full state in local play). The client code is in place and shows it once the field arrives.
- Turn time under the regent: 3.5 s per turn late on 60x38 / 6 civs; 4.1 s for turns 410-546 of the godemperor 40x25 game; 0.55-0.76 s on prince 40x25. The godemperor figure is not explained.

## 21. Soundtrack on Roblox [architect, queued 2026-11-16] [closed: 2026-11-17 — user ruling "roblox keeps old tunes": no Roblox work; the uploaded `tune-creation` / `tune-splash` assets stay. Reopen only by ruling.]

The browser plays ten synth pieces (`client/music/pieces/*.json`, theme rule
`shared/music-theme.js`, A119). Roblox has no live synth, so the pieces would
reach it as rendered audio assets (an offline render of the same FM patches,
like `tools/render-sounds.js` did for the cues) played by a Luau port of
`themeFor`. Until then Roblox keeps the uploaded `tune-creation` /
`tune-splash` assets. Needs a decision on rendering + upload before work.

---

## Not in this file (user-side, for completeness)

C1b remains a USER Studio session, not lane work: midgame-join verify,
publish, `ROBLOX_EXPERIENCE_URL`, one-motif EditableImage glyph render.
The ~32 provisional glyph motifs stay ally-gated. Neither blocks the
items above.
