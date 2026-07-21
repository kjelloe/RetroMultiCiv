# Browser feature catalog — the Roblox parity reference

Architect-authored (2026-07-18, user-requested: "make sure the roblox agent
knows of all the features in the browser version"). This is the COMPLETE
browser-client feature list. The roblox-helper OWNS the parity column:
annotate every row (PRESENT / PARTIAL / MISSING / N-A-platform / DEFERRED
+reason), file luau-twin requests or direction questions per row, and keep
the column current as browser features land (each helper done-mail that adds
a client feature should trigger a row here). docs/13 holds the tiered
roadmap; THIS is the flat inventory that guarantees nothing is unknown.

Parity first pass: roblox-helper, 2026-07-18 (mail @r25). Row ids (CP/SO/MP
prefixes) are the handles for twin requests and direction questions.

## Core play

| id | feature | browser home | parity (roblox) |
|---|---|---|---|
| CP1 | world render (terrain mesh, fog, props, cities, units) | renderer/three | PARTIAL — ViewRenderer covers terrain/fog/units + danger overlay (roblox extra); run-F added tile IMPROVEMENTS (road/rail/irrigation/mine/fortress, gate 13) + a PROGRESSIVE city model (pop-tier size + the SHARED shared/city-era.js band styles ancient/classicalMedieval/industrial/modernSpace, gate 12); decorative TILE PROPS (trees/resources) still the pending art pass |
| CP2 | unit select / move / attack, stack panel | input.js, panels | PRESENT — Select + stack tab cards w/ A/D/M stats |
| CP3 | action bar (found/irrigate/mine/road/fortress/pillage/fortify/skip/disband/goto) | input.js | PRESENT — full set incl. Fort + Pillage (2026-07-18, #1371) |
| CP4 | GoTo route-preview + multi-turn plans | input.js (client-side plans) | PRESENT — R14 plans + breadcrumb preview + r20 button |
| CP5 | move hints + step legality | move-hints.js | PRESENT — MoveHints/StepLegality (gate-7 pinned) |
| CP6 | combat odds preview on hover | input.js sitePreview family | PRESENT — OddsPreview |
| CP7 | city view: yields, food box, production, buy, sell, workers, specialists | panels.js | PRESENT — CityPanel + WorkedTiles (buy w/ price confirm, roblox extra); food-box progress shape differs (billboard) |
| CP8 | per-city BUILD QUEUE (C3, tonight) | queue over logged commands | PARTIAL — BuildQueue.luau shipped (#1364, ratified @baf3e1f9): Q+ per row, auto-advance, drop-and-try-next; no per-item reorder/remove yet (v1 divergence, accepted) |
| CP9 | settler site preview (fog-honest rating) | input.js | PRESENT — ViewRenderer siteLine draws a 1-3 star rating on own settlers via the read-only ai.goodCitySpot on a view shim (fog-approximate, the browser's own shape); was mis-annotated MISSING |
| CP10 | next-unit cycling, needs-orders gate, auto-select | input.js/session | PRESENT — N/auto-next + garrison exclusion |
| CP11 | off-turn pre-work (A54 whitelist) | engine whitelist + session queue | PRESENT — engine-side; roblox client sends freely, server validates |
| CP12 | research bar + panel (beelines, sliders) | hud/panels | PRESENT — picker + rate steppers (Government panel) + auto-select option (roblox extra) |
| CP13 | government revolutions UI | panels research tab | PRESENT — GovernmentPanel switch row: a button per known government (skip anarchy + current, tech-gated) issues setGovernment; mid-revolution shows "⚡ Anarchy — N turns until &lt;pending&gt;". 1:1 of panels.js gov-row, reads own-seat view fields (zero server change), golden-neutral; gate 21 pins it |
| CP14 | end turn + confirm-with-movable-units, E-flow | hud/input | PRESENT — A29 three-state |
| CP15 | hotseat (multi-human one screen, handoff cover) | handoff.js | N-A-platform CONFIRMED @38e36677 — one client per player; LAN seats replace it |
| CP16 | spectator mode (view-only) | ?spectate=1 | PRESENT — SPECTATE deck pad (host toggle, default ON); omniscient filterView via the twin's no-player-row path; sends stay notSeated. LAW amended in SPEC.md per @d1ce4920 |
| CP17 | caravan trade routes (marker-0052): establish button/key Y, 🐫 windfall turnlog line, city-panel route list | engine/trade.js + input/turnlog/panels | PRESENT — Trade button + windfall banner + tooltip ROUTE REPORT (marker-0054 tradeRouteReport: arrows + over-cap marks) + 6 reject texts |
| CP18 | unit UPGRADE button (N11 3a, marker-0055 engine: cost display, veteran-carries tooltip, reject texts) | engine/upgrade.js + input.js (K key, priced button, veteran tooltip) | PRESENT — ActionBar priced Upg button (live upgradeCost, own-city gate, ordinary upgradeUnit command) + 3 reject texts; veteran tooltip = SO2 surface add later |
| CP19 | goody-hut entry + leader-ransom presentation (N13, marker-0058 engine: hut prop, barbleader silhouette, own-seat fog toasts/turnlog) | engine/huts.js + props/turnlog/toasts (hut prop, barbleader gallery row, own-seat fog lines) | PARTIAL — own-seat hutEntered banners live (advance/gold/mercs/ambush/nothing); hut PROP + barbleader silhouette ride the CP1 props/art pass (user look-approval pending); recipes arrive via the shared bake |
| CP20 | sentry (fog-honest wake radius 2) + settler AUTOMATION (view-based policy, manual-order cancel) (C4) | automate.js | PRESENT — SENTRY (Zz card toggle, fog-honest radius-2 wake) + settler AUTOMATION (Au card toggle, SettlerAuto.client.luau: view-based road/mine/irrigate/railroad policy, per-view re-check, ordinary commands, manual-order cancel) both shipped per rulings @1e2f43eb/@6679e9c0 |
| CP21 | debug panel 🐞 + permanent DEBUG watermark (A92 both halves; taint in hash) | debug-panel.js + hud/saves/endscreen | PRESENT — DebugMenu.client.luau (Studio-only thin client) + Hud DEBUG chip; endscreen/save watermark echoes = later polish |

## Screens & overlays

| id | feature | browser home | parity (roblox) |
|---|---|---|---|
| SO1 | world MINIMAP click/drag-to-jump (C1) | minimap.js | PRESENT — Minimap.client.luau (flat Frame grid per ruling @38e36677; fog-honest, diff-painted, downsampling, click/drag jump; ViewportFrame = docs/13 polish tier) |
| SO2 | breakdown TOOLTIPS (C2) | title attrs | PARTIAL — Tooltip.luau (hover 0.35s / long-press 0.5s per ruling) live on the HUD income ledger + city-yields ledger; more surfaces attach incrementally |
| SO3 | tech-discovery CARD | discovery-card.js + tech-blurbs.js | PRESENT — DiscoveryCard.client.luau: queued transients, pedia deep links, research prompt, options mute; all 68 ally blurbs ported 1:1 from tech-blurbs.js, kept in sync by check.sh gate 11 |
| SO4 | Civilopedia | pedia.js/pedia-concepts.js | PRESENT — R19; 16 concept articles (gate 14) + run-F #9 per-unit/building flavor blurbs (PediaBlurbs.luau, 28 units + 21 buildings ported 1:1 from the browser canonical table client/ui/unit-building-blurbs.js, gate 16 cross-platform parity + ruleset coverage — same id→string tables both sides) |
| SO5 | onboarding ADVICE cards | advice.js/advice-gate.js | PRESENT — AdviceCards.client.luau (10 cards, original prose, session-once, options mute; localStorage-less divergence flagged) |
| SO6 | turn log (classes, filters, jump-to, fog rules) | turnlog.js | PARTIAL — log present (L toggle); classes + filters PORTED 2026-07-21 (TurnLogClasses.luau 1:1 of client/ui/turnlog-classes.js, filter strip in TurnLog.client, gate 22); jump-to (row→camera) still a separable follow-up. D3 diplomacy Tier-A ADDED (#1878): the three treaty events narrated via diplomacyRow (1:1 port of shared/diplomacy-view.js diplomacyEventRow) + view-derived first-contact (scanContacts parity); gate 17 pins it. first-contact live today. TWIN LANDED (bb8ce1d #1984): treaty events now surface under fog so Tier-A narration is LIVE over ?server=1, and filterView exposes state.relations → D3 Tier-B DONE: Diplomacy.client.luau Foreign-relations panel (🤝/Y, per-civ relationLabel + reputation) + DiplomacyView.luau (1:1 port of shared/diplomacy-view.js relationLabel), gate 19 pins parity. Read-only legibility; treaty actions later |
| SO7 | end screen (victory + score breakdown, SPACE branch) | endscreen.js | PRESENT — EndScreen.client.luau on the server's full-state {t=endscreen} frame (scoreBreakdown twin; conquest/score/space headlines) |
| SO8 | statistics: time-series charts, battles, wonders timeline | stats.js/stats-data.js | PRESENT — score-over-time chart (per-round world-public series, {t=stats} pull) + battles/wonders timelines PORTED 2026-07-21: GameServer accumulates statsBattles (combatResolved) + statsWonders (wonderBuilt) world-public, rides the {t=stats} pull; Statistics.client folds ⚔ W-L per civ + a 🏛 Wonders timeline (stats-data.js twin, gate 24) |
| SO9 | historian interstitials + age markers | historian.js | PRESENT — Historian.client.luau on the server's ageChanged standings frame (world-public score twin) |
| SO10 | replay THEATER | replay.js/replay-events.js | PRESENT — R18 (post-game gate per THE LAW) |
| SO11 | SPACESHIP screen (H8) | ship.js | PRESENT — Ship.client.luau (#1370): flat-Frame assembly w/ red-box rule, stats table, two-step launch, rival banners; no-mock + X-close divergences accepted @41a65e71 |
| SO12 | fast-forward overlay (?age=) | ff-overlay.js + shared/fastforward.js | PRESENT — R24 lobby stepper + chunked server ff; run-F #2 added the FastForward.client DIORAMA (animated growing skyline + progress bar) on the server's {t=ffProgress} stream during the ff wait |
| SO13 | options set | options.js | PARTIAL — autoEnd/autoNext/hideFuture/hint/clock present + roblox extras (look, border art, ride pads, auto-research) + discovery-cards + civ-palette (deuteranopia-safe) + advice-tips rows ALL wired (each flips ClientState.options.<flag> the feature already reads). PRESENT (2026-07-21 audit: the "rows follow their features" note was stale) |
| SO14 | accessibility civ-color palette | palette.js | PRESENT — Palette.luau (the browser's exact deuteranopia-safe pairs) at all 4 civ-color seams (ViewRenderer, Statistics, Minimap, ReplayTheater) + options row; visual.primary half carried but consumer-less on Roblox |
| SO15 | sound: synth cues + tunes | sound.js/sound-map.js | DEFERRED @38e36677 — Roblox Sound needs uploaded audio assets (user/account step the browser synth avoids); wait for CIV_THEMES + the user's asset-path decision |
| SO16 | mobile: ?mlog overlay, d-pad, touch | mlog.js/dpad.js | N-A-platform CONFIRMED — Roblox native touch + RidePad + long-press already cover it |
| SO17 | 🧠 live strategic overlay (per-AI stance/mode/threat/units; ?debug=1 + spectator only) | strategic-overlay.js + shared/strategic.js | PRESENT — Strategic.client.luau (🧠 panel, spectator/Studio-gated) over the SERVER's {t=strat} full-state strategicSnapshot pull (luau/strategic.luau twin @e73d631); mode icons ⚔🌱🏛🛡, colored threat, unit counts, palette chips |
| SO18 | 🌳 tech tree (XII.6): graphical DAG + client beeline + procedural glyphs | tech-tree.js + tech-glyphs.js + shared/beeline.js | PARTIAL — Roblox tier = the ERA-GROUPED-LIST fork (docs/13) + client beeline: TechTree.client.luau (🌳/Shift+T, ✓/○/·/◇ states, click avail→setResearch / locked→beeline goal) over Beeline.luau (ported shared/beeline.js, gate-15 lune parity over all 68 techs); golden-neutral (setResearch only, goal = session state). Procedural per-tech GLYPHS = phase 2 (name labels first; motifs ~36 solid + ~32 provisional pending the ally motif pass) |

## Multiplayer / server

| id | feature | browser home | parity (roblox) |
|---|---|---|---|
| MP1 | LAN lobby create-options + join + seats + kick + chat + skip-vote | lobby.js + server | PARTIAL — R24b: seed/civs/humans/size/maptype/difficulty/age/combat ALL PRESENT (+maxIdle roblox extra); chat DEFERRED (R9 deck-chat ruling), per-seat civ pick DEFERRED (roster slice), skip-vote N-A-superseded @38e36677 (R22 idle-regency covers AFK; a griefer-vote case would be a NEW row), kick PRESENT (admin) |
| MP2 | join codes (boot-entropy fresh) | server/lobby.js | N-A-platform — walk-on pads join in-server; cross-server join is Roblox matchmaking. Resume codes ARE present (MP3) |
| MP3 | resume-by-gamecode flow | lobby.js L2 | PRESENT — R10 box + GET RESUME CODE + rolling autosave/saved chip |
| MP4 | AI regency (armed regent, stance select, narration) | regency.js/regent-driver.js | PARTIAL — disconnect+idle+toggle regency PRESENT (R22); STANCE-SELECT PORTED 2026-07-21 (RegentDialog.client.luau 1:1 of client/ui/regency.js — 🤖 opens a 5-stance picker; GameServer stores regentStance[pid] + feeds pickCommand's 5th arg, NO engine change since both twins accept stance; gate 23). Narration lines remain a light follow-up (the SO6 'regent' turn-log class exists) |
| MP5 | reconnect tokens, seat rebind, autosave/restart | server | PRESENT (platform shape) — UserId is the token (seat rebind on rejoin), rolling autosave shipped |
| MP6 | game code fingerprint chip + saved chips | hud | PRESENT — chip + saved chip |
| MP7 | ruleset-compat pin | engine+server+saves.js | PRESENT — engine-side (marker-0045); R24b saves record difficulty/combat so resume rebuilds identical rules |
| MP8 | spectator omniscient view | server | PRESENT — with CP16 (host setup toggle carries the browser server flag) |
| MP9 | master-index global browse | tools/master.js | N-A-platform CONFIRMED @38e36677 — Roblox public servers/matchmaking are the discovery layer |
| MP10 | match-report S1 writer | server | N-A v1 CONFIRMED @38e36677 — DataStore writer = post-1.0 candidate |
| MP11 | Marathon (play-until-victory) host option — setup + LAN lobby checkbox → rulesOverrides.endYear=9999 | setup.js/lobby.js/server + main.js | PRESENT — lobby marathon toggle → applyRuleOverrides endYear=9999 (same merged-rules path as difficulty/combat; save/resume + R4INIT carry it) |
| MP12 | server hardening: cmd budget (marker-0050) + malformed-frame crash guard + 64KB maxPayload + kick-path budget preserve (slice 1) | server/limits.js + index.js (docs/17 lane) | N-A-platform CONFIRMED — Roblox transport/framing is engine-managed (no raw ws, no maxPayload to set); game-logic budgets ride the engine twin. The docs/17 hardening lane has no Roblox surface |

## Engine features with no UI (twins already exist — listed so nothing hides)

Stance-mix heterogeneous AI (builder/Perfectionist assignment); settler
food upkeep; worked-tile blockade; ZOC city-capture exemption; barbarians
era-tiers; government re-eval (SHIPPED marker-0051 — AI-only, stays
no-UI); unit upgrades + Leonardo (SHIPPED markers 0055/0056 — client
row CP18); goody huts + leader ransom (SHIPPED marker-0058 — client
row CP19); debug commands (SHIPPED marker-0057 — client row CP21);
diplomacy D1-D2 (QUEUED, pre-ruled); space race arrival/victory
(marker-0049). Caravan trade routes moved UP to Core play row CP17
at marker-0052 (UI landed with the engine).

Parity note: all of the above reach Roblox FREE through the luau twins the
moment they land (the server runs the same engine); only their UI surfaces
need rows here when the browser grows them (SO11 is the space race's).

## Process rule (standing)

When a browser feature lands (helper done-mail), the architect adds the
row here; the roblox-helper annotates parity within its next working
session and files twin requests / direction questions BY ROW ID. The user
sees the parity column in R-item done-mails.
