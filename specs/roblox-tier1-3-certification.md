# Roblox docs/13 Tier 1–3 parity certification (roblox-helper, 2026-07-21)

Approved by the architect (#2033) as the certification-before-closure of
1.0 axis-4 (Roblox multiplayer). Every docs/13 Tier 1–3 row is verified
against the ACTUAL modules with broad-term greps (per the
`audit-verify-against-modules` lesson — the earlier #2020 grep false-
negatived resume-code and the take-over pad on token spelling). Status
legend: **PRESENT** (built + verified) / **PARTIAL** (core present, named
adds pending) / **DEFERRED** (gated on a user/art/account step) /
**FOLDED** (superseded by another system) / **N-A** (platform makes it
moot) / **ACCEPTED-DIV** (a deliberate v1 divergence).

## Tier 1 — core loop (docs/13 §"Tier 1"; already "CLOSED 2026-07-16")

| Row | Module(s) | Status | Evidence |
|---|---|---|---|
| Action bar (unit orders) | ActionBar.client | PRESENT | B/G/Space/X/I/M/R + improvement orders |
| Research picker (bulbs/turn) | ResearchPicker.client | PRESENT | T toggle; one-ring rule |
| Tech tree (XII.6 era-list + beeline) | TechTree.client + Beeline | PRESENT | 🌳/Shift+T, gate 15 beeline parity; glyphs phase-2 art (SO18) |
| Tech discovery blurbs (68) | PediaBlurbs + DiscoveryCard | PRESENT | gate 11 |
| City visuals ERA×size | renderer/three + city-era | PRESENT | gate 12 |
| Tax/science steppers | GovernmentPanel.client | PRESENT | steppers (sliders fight orbit) |
| Government switching (CP13) | GovernmentPanel.client | PRESENT | **NEW 2026-07-21** setGovernment switch row, gate 21 |
| Turn log | TurnLog.client | PARTIAL | events present (L); classes/filters/jump-to pending → SO6 |
| Combat odds preview | OddsPreview.client | PRESENT | R7d |
| City-site preview | ViewRenderer siteLine | PRESENT | CP9 fog-honest rating |
| End-turn states | Hud.client | PRESENT | A29 three-state |
| Move hints | MoveHints.client | PRESENT | R6 |
| GoTo (deferred row) | GoToPlan.client | PRESENT | R14 + pathfind twin |
| Wait-status | WaitStatus.client | PRESENT | **NEW 2026-07-21** HUD line, gate 20 |

## Tier 2 — management depth

| Row | Module(s) | Status | Evidence |
|---|---|---|---|
| City list / paging | CityList.client | PRESENT | R7d (C) |
| Build catalog locks+effects | CityPanel + CatalogText | PRESENT | lock reasons + effects |
| Per-city build queue (CP8) | BuildQueue.client | ACCEPTED-DIV | Q+ auto-advance; no per-item reorder/remove (v1) |
| Worked-tile assignment | WorkedTiles.client | PRESENT | R7c-3 tap-to-toggle |
| Sell building (A86) | CityPanel R13 | PRESENT | one sale/city/turn |
| Options set | Options.client | PRESENT | autoEnd/next/hideFuture/hint/clock/void/ridePad/look/autoResearch + discovery-cards + civ-palette + advice-tips rows all wired (SO13 done; catalog was stale) |
| Save/load + game code | SaveStore + Hud chip | PRESENT | R10; DataStore, docs/07 code |
| Civilopedia (A58) | Pedia + PediaConcepts | PRESENT | R19; catalog-text/pedia-concepts twins |
| First-timer advice | AdviceCards.client | PRESENT | SO5 |
| Tech-discovery card | DiscoveryCard.client | PRESENT | SO3 |
| Spaceship screen | Ship.client | PRESENT | SO11; spaceship.luau twin |
| Breakdown tooltips (SO2) | Tooltip.client | PARTIAL | HUD/city ledgers; more surfaces incremental |
| Statistics (SO8) | Statistics.client | PARTIAL | score-over-time live; battles/wonders timelines pending |
| World render (CP1) | renderer/three | PARTIAL | terrain/fog/units/improvements/city-era done; decorative TILE PROPS = art pass |

## Tier 3 — multiplayer/social (1.0-REQUIRED)

| Row | Module(s) | Status | Evidence |
|---|---|---|---|
| Lobby (deck, seats, pads) | Lobby.client + Deck | PRESENT | R9 observation deck, START/JOIN pads |
| TAKE OVER AI CIV pad | Deck (TakeoverPad) | PRESENT | phase-running random vacant seat |
| Spectators | Deck (SpectatePad) + GameServer | PRESENT | tokenless omniscient view |
| Wait-status | WaitStatus.client | PRESENT | **NEW** gate 20 |
| Skip-vote | — | FOLDED | superseded by R22 regency + XIV §30 auto-takeover/auto-skip (docs/08 §7): an away/idle seat is regent-driven or auto-skipped, so the round never stalls; the browser's social skip-VOTE has no authoritative-model equivalent. A griefer-vote case would be a NEW row |
| Regency (armed regent) | ClientState away + GameServer R22 | PARTIAL | disconnect+idle+toggle present; regent STANCE-SELECT + narration lines not ported → MP4 |
| Seat codes / reconnect | (UserId) + rejoin | N-A / PRESENT | UserId IS identity — reconnect free; resume-code (R10) covers cross-server |
| Chat | — | N-A | Roblox age-restriction ruling (docs/13): no in-game chat; turn-log + pads carry communication |
| Per-seat civ pick | (lobby) | ACCEPTED-DIV | roster slice deferred (R9 ruling) |

## Certification result

Tiers 1–3 are **substantively COMPLETE**: every 1.0-required row is
PRESENT, FOLDED, N-A, or an ACCEPTED divergence. No row is MISSING.
Axis-4 (Roblox multiplayer) is certifiable as closed for parity; the
residual is named POLISH, not core loop.

## Real gaps surfaced → recommend as queue items (agent-executable, golden-neutral)

1. **SO6** — turn-log classes/filters/jump-to: port `client/ui/turnlog-classes.js` categorization + a class-filter UI into `TurnLog.client`. Read-only over existing events.
2. **MP4** — regent stance-select + narration: the five-stance dialog (`client/ui/regency.js`) + regent turn-log lines. **FLAG: the stance may need a protocol field** (the away/regency message currently carries no stance) — a GameServer/shared-protocol touch; confirm scope before building.
3. ~~**SO13**~~ — DONE (already wired: discovery-cards/civ-palette/advice-tips Options rows; catalog was stale — the 3rd false-negative after resume-code + take-over).
4. **SO8** — statistics battles + wonders timelines (needs a public per-round data series — likely a GameServer stats-push field, not pure client; scope needed).
5. **SO2** — attach tooltips to more surfaces (open-ended incremental polish, not a discrete gap).

**Agent-executable pure-client backlog is now essentially EXHAUSTED**: SO6 built,
SO13 was already done, MP4 needs a protocol/engine scope, SO8 needs a server
data-series. The remaining roblox work is the art-gated set (tech-glyphs/CP1/
sound) + the user-parked items (Studded round-2, runG.txt). Recommend the
architect either scope MP4/SO8 or accept the lane is parity-complete pending
art + user.

## Art / user-gated (NOT agent-executable — do not queue as build)

- **CP1** decorative tile props (trees/resources) + **CP19** hut prop / barbleader silhouette — the pending art pass (user look-approval).
- **SO18** tech-glyphs phase-2 — ~32 provisional motifs pending the ally motif-concept pass.
- **SO15** sound — Roblox audio assets need a user/account upload step.
- **Studded round-2** — user Studio screenshot review (parked).

## docs/13 note to apply (architect-directed, #2033)

Annotate the docs/13 Tier-3 "Waiting/skip-vote/wait-status" row: skip-vote
is SUPERSEDED by the regency / auto-takeover model (docs/08 §7 + XIV §30);
wait-status shipped 2026-07-21.
