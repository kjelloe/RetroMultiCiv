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

## 20. Next [open], order in specs/roblox-native-look.md §5: read the first logged Play Solo -> fixes; phone unit cards / bottom-left toggles / research cluster (from the phone audit); T2b corner fills (after a screenshot confirms the T2 wedge orientation); U5 panel chrome, river banks.

---

## Not in this file (user-side, for completeness)

C1b remains a USER Studio session, not lane work: midgame-join verify,
publish, `ROBLOX_EXPERIENCE_URL`, one-motif EditableImage glyph render.
The ~32 provisional glyph motifs stay ally-gated. Neither blocks the
items above.
