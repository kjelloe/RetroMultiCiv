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
| CP1 | world render (terrain mesh, fog, props, cities, units) | renderer/three | PARTIAL — ViewRenderer covers terrain/fog/cities/units + danger overlay (roblox extra); TILE PROPS not rendered yet (flagged, art pass) |
| CP2 | unit select / move / attack, stack panel | input.js, panels | PRESENT — Select + stack tab cards w/ A/D/M stats |
| CP3 | action bar (found/irrigate/mine/road/fortress/pillage/fortify/skip/disband/goto) | input.js | PRESENT — full set incl. Fort + Pillage (2026-07-18, #1371) |
| CP4 | GoTo route-preview + multi-turn plans | input.js (client-side plans) | PRESENT — R14 plans + breadcrumb preview + r20 button |
| CP5 | move hints + step legality | move-hints.js | PRESENT — MoveHints/StepLegality (gate-7 pinned) |
| CP6 | combat odds preview on hover | input.js sitePreview family | PRESENT — OddsPreview |
| CP7 | city view: yields, food box, production, buy, sell, workers, specialists | panels.js | PRESENT — CityPanel + WorkedTiles (buy w/ price confirm, roblox extra); food-box progress shape differs (billboard) |
| CP8 | per-city BUILD QUEUE (C3, tonight) | queue over logged commands | PARTIAL — BuildQueue.luau shipped (#1364, ratified @baf3e1f9): Q+ per row, auto-advance, drop-and-try-next; no per-item reorder/remove yet (v1 divergence, accepted) |
| CP9 | settler site preview (fog-honest rating) | input.js | MISSING — direction Q: billboard rating over the selected settler's tile? |
| CP10 | next-unit cycling, needs-orders gate, auto-select | input.js/session | PRESENT — N/auto-next + garrison exclusion |
| CP11 | off-turn pre-work (A54 whitelist) | engine whitelist + session queue | PRESENT — engine-side; roblox client sends freely, server validates |
| CP12 | research bar + panel (beelines, sliders) | hud/panels | PRESENT — picker + rate steppers (Government panel) + auto-select option (roblox extra) |
| CP13 | government revolutions UI | panels research tab | PARTIAL — rates + government display present; the REVOLUTION switch flow needs verify/wire |
| CP14 | end turn + confirm-with-movable-units, E-flow | hud/input | PRESENT — A29 three-state |
| CP15 | hotseat (multi-human one screen, handoff cover) | handoff.js | N-A-platform CONFIRMED @38e36677 — one client per player; LAN seats replace it |
| CP16 | spectator mode (view-only) | ?spectate=1 | PRESENT — SPECTATE deck pad (host toggle, default ON); omniscient filterView via the twin's no-player-row path; sends stay notSeated. LAW amended in SPEC.md per @d1ce4920 |
| CP17 | caravan trade routes (marker-0052): establish button/key Y, 🐫 windfall turnlog line, city-panel route list | engine/trade.js + input/turnlog/panels | PRESENT — Trade button + windfall banner + tooltip ROUTE REPORT (marker-0054 tradeRouteReport: arrows + over-cap marks) + 6 reject texts |
| CP18 | unit UPGRADE button (N11 3a, marker-0055 engine: cost display, veteran-carries tooltip, reject texts) | engine/upgrade.js; browser slice IN FLIGHT (helper #1493) | annotate when the browser slice lands (engine already FREE via luau/upgrade.luau) |
| CP19 | goody-hut entry + leader-ransom presentation (N13, marker-0058 engine: hut prop, barbleader silhouette, own-seat fog toasts/turnlog) | engine/huts.js; browser slice IN FLIGHT (helper #1493) | annotate when the browser slice lands (engine FREE via luau/huts.luau) |
| CP20 | sentry (fog-honest wake radius 2) + settler AUTOMATION (view-based policy, manual-order cancel) (C4) | automate.js | to annotate — direction Q welcome (automation shape on Roblox?) |
| CP21 | debug panel 🐞 + permanent DEBUG watermark (A92 both halves; taint in hash) | debug-panel.js + hud/saves/endscreen | PRESENT (provisional, architect-noted) — DebugMenu.client.luau + Hud DEBUG chip shipped in batch 7 (767ee95); roblox-helper refines |

## Screens & overlays

| id | feature | browser home | parity (roblox) |
|---|---|---|---|
| SO1 | world MINIMAP click/drag-to-jump (C1) | minimap.js | PRESENT — Minimap.client.luau (flat Frame grid per ruling @38e36677; fog-honest, diff-painted, downsampling, click/drag jump; ViewportFrame = docs/13 polish tier) |
| SO2 | breakdown TOOLTIPS (C2) | title attrs | PARTIAL — Tooltip.luau (hover 0.35s / long-press 0.5s per ruling) live on the HUD income ledger + city-yields ledger; more surfaces attach incrementally |
| SO3 | tech-discovery CARD | discovery-card.js + tech-blurbs.js | PRESENT — DiscoveryCard.client.luau: queued transients, pedia deep links, research prompt, options mute; blurbs empty-tolerant BOTH sides until the ally's lines land (sync flagged) |
| SO4 | Civilopedia | pedia.js/pedia-concepts.js | PRESENT — R19; sync check each pedia change |
| SO5 | onboarding ADVICE cards | advice.js/advice-gate.js | PRESENT — AdviceCards.client.luau (10 cards, original prose, session-once, options mute; localStorage-less divergence flagged) |
| SO6 | turn log (classes, filters, jump-to, fog rules) | turnlog.js | PARTIAL — log present (L toggle); classes/filters/jump-to not ported |
| SO7 | end screen (victory + score breakdown, SPACE branch) | endscreen.js | PRESENT — EndScreen.client.luau on the server's full-state {t=endscreen} frame (scoreBreakdown twin; conquest/score/space headlines) |
| SO8 | statistics: time-series charts, battles, wonders timeline | stats.js/stats-data.js | PARTIAL — score-over-time chart live (per-round world-public series, {t=stats} pull per ruling @d1ce4920); battles/wonders timelines = later adds |
| SO9 | historian interstitials + age markers | historian.js | PRESENT — Historian.client.luau on the server's ageChanged standings frame (world-public score twin) |
| SO10 | replay THEATER | replay.js/replay-events.js | PRESENT — R18 (post-game gate per THE LAW) |
| SO11 | SPACESHIP screen (H8) | ship.js | PRESENT — Ship.client.luau (#1370): flat-Frame assembly w/ red-box rule, stats table, two-step launch, rival banners; no-mock + X-close divergences accepted @41a65e71 |
| SO12 | fast-forward overlay (?age=) | ff-overlay.js + shared/fastforward.js | PARTIAL — function PRESENT (R24 lobby stepper + chunked server ff); progress overlay during the ff wait not built |
| SO13 | options set | options.js | PARTIAL — autoEnd/autoNext/hideFuture/clock present + roblox extras (look, border art, ride pads, auto-research); tips/discovery-cards/palette rows follow their features |
| SO14 | accessibility civ-color palette | palette.js | PRESENT — Palette.luau (the browser's exact deuteranopia-safe pairs) at all 4 civ-color seams (ViewRenderer, Statistics, Minimap, ReplayTheater) + options row; visual.primary half carried but consumer-less on Roblox |
| SO15 | sound: synth cues + tunes | sound.js/sound-map.js | DEFERRED @38e36677 — Roblox Sound needs uploaded audio assets (user/account step the browser synth avoids); wait for CIV_THEMES + the user's asset-path decision |
| SO16 | mobile: ?mlog overlay, d-pad, touch | mlog.js/dpad.js | N-A-platform CONFIRMED — Roblox native touch + RidePad + long-press already cover it |

## Multiplayer / server

| id | feature | browser home | parity (roblox) |
|---|---|---|---|
| MP1 | LAN lobby create-options + join + seats + kick + chat + skip-vote | lobby.js + server | PARTIAL — R24b: seed/civs/humans/size/maptype/difficulty/age/combat ALL PRESENT (+maxIdle roblox extra); chat DEFERRED (R9 deck-chat ruling), per-seat civ pick DEFERRED (roster slice), skip-vote N-A-superseded @38e36677 (R22 idle-regency covers AFK; a griefer-vote case would be a NEW row), kick PRESENT (admin) |
| MP2 | join codes (boot-entropy fresh) | server/lobby.js | N-A-platform — walk-on pads join in-server; cross-server join is Roblox matchmaking. Resume codes ARE present (MP3) |
| MP3 | resume-by-gamecode flow | lobby.js L2 | PRESENT — R10 box + GET RESUME CODE + rolling autosave/saved chip |
| MP4 | AI regency (armed regent, stance select, narration) | regency.js/regent-driver.js | PARTIAL — disconnect+idle+toggle regency PRESENT (R22); regent STANCE SELECT + narration lines not ported |
| MP5 | reconnect tokens, seat rebind, autosave/restart | server | PRESENT (platform shape) — UserId is the token (seat rebind on rejoin), rolling autosave shipped |
| MP6 | game code fingerprint chip + saved chips | hud | PRESENT — chip + saved chip |
| MP7 | ruleset-compat pin | engine+server+saves.js | PRESENT — engine-side (marker-0045); R24b saves record difficulty/combat so resume rebuilds identical rules |
| MP8 | spectator omniscient view | server | PRESENT — with CP16 (host setup toggle carries the browser server flag) |
| MP9 | master-index global browse | tools/master.js | N-A-platform CONFIRMED @38e36677 — Roblox public servers/matchmaking are the discovery layer |
| MP10 | match-report S1 writer | server | N-A v1 CONFIRMED @38e36677 — DataStore writer = post-1.0 candidate |

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
