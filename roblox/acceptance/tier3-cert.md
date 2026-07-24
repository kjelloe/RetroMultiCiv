# Roblox Tier 1–3 certification RE-AUDIT (roblox-helper)

Re-run of `specs/roblox-tier1-3-certification.md` (orig. 2026-07-21) against the
current tree for the #2028 axis-4 close-out. Feeds the user's Studded round-2 review.

- **Tree audited:** dev_night @ `06448dd` (roblox gate-4 re-bake + gate-14 pedia mirror).
- **Precondition — re-bake in-tree:** CONFIRMED. `roblox/data/generated/rulesets/rules.luau`
  carries the difficulties table + `seaPathRadius: 30`; `RulesetHashes.luau` rules=`0xf42526cd`,
  wonders=`0x3fddc425`; gate 4 `generated data matches sources` PASS.
- **Precondition — marker-0086 in-tree:** CONFIRMED. `f836d4e` is an ancestor of HEAD.
- **Selftest gates:** `bash roblox/check.sh` → **ALL GREEN, 29 gates** (see evidence below).
- **Parity vs luau/ (read-only consume):** 44 `luau/*.luau` modules present; cross-language
  gates 3 (rng/statehash/gamecode), 7 (StepLegality lune), 9 (fastforward JS==luau turn-25),
  15 (beeline JS==luau, 68 goals) all PASS.

## Verdict: **PASS**

Every 1.0-required Tier 1–3 row is PRESENT, FOLDED, N-A, or an ACCEPTED divergence. No row
is MISSING. Since the 2026-07-21 cert, three named residuals have CLOSED (SO6, MP4, SO8-core);
the remaining residual is art/user-gated polish, not core loop.

## Gate evidence (check.sh, 29/29 PASS)

- gate 1 rojo build; gate 2 all 70+ ModuleScripts in built place; gate 5 recipe keys cover units;
  gate 6 no platform-reserved KeyCodes; gate 8 billboard-button lint; gate 10 palette covers civ colors;
  gate 13 tile improvements all drawn; gate 18 Studded style covers terrain + no trademark.
- **Cross-language (luau twins):** gate 3, gate 7, gate 9, gate 15.
- **Data re-bake:** gate 4 (rules/units/wonders/terrain generated == source).
- **Browser-source parity mirrors:** gate 11 tech-blurbs, 12 city-era, 14 pedia-concepts (23),
  16 pedia unit/building blurbs, 17 diplomacy turnlog, 19 diplomacy panel, 20 wait-status,
  21 government switching, 22 turn-log classes, 24 stats battles/wonders, 25 tile props,
  26 tech-glyph era palette, 27 sound cue map, 28 turn-log jump-to, 29 regent narration.

## Tier 1 — core loop

| Row | Status | Evidence |
|---|---|---|
| Action bar (unit orders) | PRESENT | ActionBar.client; gate 2/6 |
| Research picker | PRESENT | ResearchPicker.client |
| Tech tree + beeline | PRESENT | TechTree.client + Beeline; gate 15 |
| Tech-discovery blurbs (68) | PRESENT | PediaBlurbs + DiscoveryCard; gate 11 |
| City visuals ERA×size | PRESENT | renderer/city-era; gate 12 |
| Tax/science steppers | PRESENT | GovernmentPanel.client |
| Government switching | PRESENT | GovernmentPanel.client; gate 21 |
| **Turn log** | **PRESENT (was PARTIAL)** | TurnLog.client + TurnLogClasses; SO6 landed — classes gate 22, jump-to gate 28 |
| Combat odds preview | PRESENT | OddsPreview.client |
| City-site preview | PRESENT | ViewRenderer siteLine (fog-honest) |
| End-turn states | PRESENT | Hud.client three-state |
| Move hints | PRESENT | MoveHints.client |
| GoTo | PRESENT | GoToPlan.client + pathfind twin |
| Wait-status | PRESENT | WaitStatus.client; gate 20 |

## Tier 2 — management depth

| Row | Status | Evidence |
|---|---|---|
| City list / paging | PRESENT | CityList.client |
| Build catalog locks+effects | PRESENT | CityPanel + CatalogText |
| Per-city build queue | ACCEPTED-DIV | BuildQueue; Q+ auto-advance, no per-item reorder (v1) |
| Worked-tile assignment | PRESENT | WorkedTiles.client |
| Sell building | PRESENT | CityPanel R13 |
| Options set | PRESENT | Options.client (all rows wired) |
| Save/load + game code | PRESENT | SaveStore + Hud chip; DataStore, docs/07 code |
| Civilopedia | PRESENT | Pedia + PediaConcepts; gate 14/16 (pedia-concepts now 23 incl the 7 mirrored this cycle) |
| First-timer advice | PRESENT | AdviceCards.client |
| Tech-discovery card | PRESENT | DiscoveryCard.client |
| Spaceship screen | PRESENT | Ship.client + spaceship.luau twin |
| **Statistics** | **PRESENT (was PARTIAL)** | Statistics.client; SO8 battles/wonders now mirrored, gate 24 |
| Breakdown tooltips | PARTIAL | Tooltip.client; more surfaces incremental (SO2, open-ended polish) |
| World render | PRESENT-core | renderer/three; terrain/fog/units/improvements/city-era + tile-props mirror gate 25; decorative art = user-look residual (CP1/CP19) |
| Diplomacy panel + turnlog | PRESENT | Diplomacy + DiplomacyView; gates 17, 19 (D-line since orig cert) |

## Tier 3 — multiplayer/social (1.0-required)

| Row | Status | Evidence |
|---|---|---|
| Lobby (deck, seats, pads) | PRESENT | Lobby.client + Deck (observation deck, START/JOIN pads) |
| TAKE OVER AI CIV pad | PRESENT | Deck — phase-running random vacant seat |
| Spectators | PRESENT | Deck + GameServer — tokenless omniscient (host-controlled default per docs/13 fog-leak amendment) |
| Wait-status | PRESENT | WaitStatus.client; gate 20 |
| Skip-vote | FOLDED | superseded by regency + XIV §30 auto-takeover/auto-skip (docs/08 §7); no authoritative equivalent to the social skip-VOTE |
| **Regency (armed regent)** | **PRESENT (was PARTIAL)** | ClientState away + GameServer + RegentDialog; MP4 landed — stance-select wired client→GameServer→pickCommand gate 23, narration gate 29 |
| Seat codes / reconnect | N-A / PRESENT | UserId IS identity (reconnect free); resume-code via SaveStore covers cross-server; no dedicated Rejoin module by design |
| Chat | N-A | Roblox age-restriction ruling — no in-game chat; turn-log + pads carry communication |
| Per-seat civ pick | ACCEPTED-DIV | roster slice deferred (R9 ruling) |

## Residuals (art / user-gated — NOT agent-executable, do not block cert)

1. **CP1/CP19 decorative art** — tile props / hut prop / barb-leader silhouette: the prop MIRROR
   is in-tree (gate 25); decorative art itself awaits the user look-approval pass.
2. **SO18 tech-glyphs phase-2** — ~32 provisional motifs; gate 26 pins the era-palette. Pending the
   ally motif-concept pass / EditableImage Studio spike (user-parked).
3. **SO15 sound** — SoundMap catalogue present incl the 4 §26 discovery cues (gate 27); SoundIds
   are silent until the user/account audio-upload step.
4. **SO2 tooltips** — incremental surface coverage; open-ended polish, not a discrete gap.
5. **Studded round-2** — user Studio screenshot review (this file is its input).

## Residuals CLOSED since the 2026-07-21 cert

- **SO6** turn-log classes/filters/jump-to — LANDED (TurnLogClasses; gates 22, 28).
- **MP4** regent stance-select + narration — LANDED (RegentDialog; gates 23, 29).
- **SO8-core** stats battles/wonders timelines — LANDED (gate 24 mirror).

Axis-4 (Roblox multiplayer) remains certifiable as closed for parity; the residual set is art +
user-gated polish only.
