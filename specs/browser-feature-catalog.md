# Browser feature catalog — the Roblox parity reference

Architect-authored (2026-07-18, user-requested: "make sure the roblox agent
knows of all the features in the browser version"). This is the COMPLETE
browser-client feature list. The roblox-helper OWNS the parity column:
annotate every row (PRESENT / PARTIAL / MISSING / N-A-platform / DEFERRED
+reason), file luau-twin requests or direction questions per row, and keep
the column current as browser features land (each helper done-mail that adds
a client feature should trigger a row here). docs/13 holds the tiered
roadmap; THIS is the flat inventory that guarantees nothing is unknown.

## Core play

| feature | browser home | notes |
|---|---|---|
| world render (terrain mesh, fog, props, cities, units) | renderer/three | Roblox: ViewRenderer |
| unit select / move / attack, stack panel | input.js, panels | |
| action bar (found/irrigate/mine/road/fortress/pillage/fortify/skip/disband/goto) | input.js | |
| GoTo route-preview + multi-turn plans | input.js (client-side plans) | |
| move hints + step legality | move-hints.js | Roblox: MoveHints/StepLegality |
| combat odds preview on hover | input.js sitePreview family | |
| city view: yields, food box, production, buy, sell, workers (manual tiles), specialists | panels.js | |
| per-city BUILD QUEUE (C3, in flight tonight) | queue over logged commands | |
| settler site preview (fog-honest rating) | input.js | |
| next-unit cycling, needs-orders gate, auto-select | input.js/session | |
| off-turn pre-work: setRates/setResearch/setProduction/setWorkers from waiting seats (A54) | engine whitelist + session queue | server seats get it free |
| CP17 caravan trade routes (marker-0052): establish button/key Y, 🐫 windfall turnlog line, city-panel route list | engine/trade.js + input/turnlog/panels | luau/trade.luau twin SHIPPED — annotate |
| research bar + panel (beelines, sliders tax/sci/lux) | hud/panels | |
| government revolutions UI | panels research tab | |
| end turn + confirm-with-movable-units, E-flow | hud/input | |
| hotseat (multi-human one screen, handoff cover) | handoff.js | N-A-platform? rule it |
| spectator mode (view-only, seat-action-free — audited) | ?spectate=1 | |

## Screens & overlays

| feature | browser home | notes |
|---|---|---|
| world MINIMAP click/drag-to-jump, fog-honest (C1, tonight) | minimap.js | |
| breakdown TOOLTIPS (yields/food/prod/upkeep/mood/income) (C2, tonight) | title attrs | Roblox shape differs |
| tech-discovery CARD (era, blurb slot, unlock deep-links) | discovery-card.js + tech-blurbs.js | blurbs = ally content, shared data |
| Civilopedia (4 catalogs + concepts, deep-links, unlock maps) | pedia.js/pedia-concepts.js | Roblox R19 shipped — keep synced |
| onboarding ADVICE cards (muteable, pedia links) | advice.js/advice-gate.js | |
| turn log (classes, filters, jump-to, fog rules) | turnlog.js | |
| end screen (victory + score breakdown, SPACE branch) | endscreen.js | |
| statistics: per-civ time-series charts, battles, wonders timeline | stats.js/stats-data.js | sandbox replay-driven |
| historian interstitials + age markers | historian.js | |
| replay THEATER (scrubber, verdict, per-civ fog) | replay.js/replay-events.js | Roblox R18 shipped |
| SPACESHIP screen: graphical assembly, characteristics, launch confirm, rival banners (H8, tonight) | ship.js | consumes luau/spaceship.luau counters |
| fast-forward overlay (?age= starting age) | ff-overlay.js + shared/fastforward.js | luau twin APPROVED, roblox-lane in flight |
| options: autoEnd/autoNext/hideFuture/clock/tips/discovery-cards/civ-palette/world-look-equiv | options.js | |
| accessibility civ-color palette (deuteranopia-safe, both color spaces) | palette.js | Roblox: needs a direction ruling |
| sound: synth cues + tunes, volume/mute, soundboard review | sound.js/sound-map.js | CIV_THEMES (PD hybrid) coming |
| mobile: ?mlog overlay, d-pad, touch pan/pinch | mlog.js/dpad.js | N-A (Roblox native input) — confirm |

## Multiplayer / server

| feature | browser home | notes |
|---|---|---|
| LAN lobby: create (seed/civs/humans/size/MAPTYPE/difficulty/AGE/combat-bestof3/chat/spectators), join by code, seat picker, kick/block, chat, skip-vote | lobby.js + server | R24 parity audit IN FLIGHT — this row is that task |
| join codes (boot-entropy fresh; resume-by-code stable) | server/lobby.js | |
| resume-by-gamecode flow (validate+start; --debug-gated listings) | lobby.js L2 | Roblox R10 has resume box |
| AI regency (armed regent, stance select, 🤖 narration) | regency.js/regent-driver.js | stance display = Perfectionist tags |
| reconnect tokens, seat rebind, autosave/restart | server | Roblox rolling autosave shipped |
| game code fingerprint chip + saved chips | hud | |
| ruleset-compat pin (stamp at create, strict at load, drift override) | engine+server+saves.js | luau twin shipped marker-0045 |
| spectator omniscient view (host-controlled) | server | |
| master-index global browse (announce/list/connect, 8-hash match) | tools/master.js + lobby 🌍 | deploy gated on user's VM |
| match-report S1 writer (consent, seat-labels) — in flight tonight | server | Roblox: N-A v1? rule it |

## Engine features with no UI (twins already exist — listed so nothing hides)

Stance-mix heterogeneous AI (builder/Perfectionist assignment); settler
food upkeep; worked-tile blockade; ZOC city-capture exemption; barbarians
era-tiers; government re-eval (SHIPPED marker-0051 — AI-only, stays
no-UI); goody huts (QUEUED N13); diplomacy D1-D2 (QUEUED, pre-ruled);
space race arrival/victory (marker-0049). Caravan trade routes moved UP
to Core play row CP17 at marker-0052 (UI landed with the engine).

## Process rule (standing)

When a browser feature lands (helper done-mail), the architect adds the
row here; the roblox-helper annotates parity within its next working
session and files twin requests / direction questions BY ROW ID. The user
sees the parity column in R-item done-mails.
