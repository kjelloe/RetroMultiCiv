# Roblox playtest run F — architect triage (2026-07-19)

User playtested the Roblox variant (roblox/acceptance/runF.txt) and gave the
11 items DIRECTLY to the roblox-helper (it runs on the gaming PC). This is the
ARCHITECT layer: routing + the cross-platform / shared calls so nothing gets
solved Roblox-only when it's really shared.

## Roblox-only (roblox-helper owns — it has the feedback)
1. **Panel mutual-exclusion** — clicking Legend / Debug / Turn Log must HIDE the
   other two (they overlap the selected panel). Roblox UI.
3. **Regent-takeover countdown cancels on user activity** (move a unit / change
   build / pick a tech). CONFIRMED Roblox-only: the browser regency has NO
   idle-countdown-to-takeover (grep clean) — so this is a Roblox-client feature;
   cancel-on-any-user-command is the right rule.
5. **Tile improvements not shown** — roads / mines / irrigation / fortresses need
   rendering on the tile. The BROWSER already draws these (renderer/three
   infrastructure: rail ties, mine entrance, irrigation patches — A15) — so this
   is Roblox RENDER PARITY, roblox-helper.
6. **Debug panel blocked** — `rejected (commandId 13): debugDisabled`. The debug
   command family (A92) requires `state.debugEnabled` set AT CREATE. The Roblox
   game needs a debug-enabled create path (the browser's `?debug=1` equivalent).
   Roblox setup/config.
7. **"Get resume code" fails** — `[SaveStore] DataStore unavailable (Studio API
   access off?)`. Roblox Studio disables DataStore API access by default; enable
   it in Studio game settings, OR the SaveStore needs a no-DataStore fallback
   (in-memory code for Studio playtests). Roblox config / SaveStore robustness.
10. **Current-research label position** — move it just above the Research + Cities
    buttons. Roblox UI layout.
11a. **City names show `c11`/`c12`** — a Roblox RENDER BUG: the engine never emits
    a bare `cN` as a NAME (cityName fallback is "New <name>" then "<Civ> Outpost
    <n>"; `cN` is the city ID). The Roblox client is rendering `city.id`, not
    `city.name`. Fix: render `.name`. (Also verify player.civ is set in Roblox
    games — if civ is undefined the name is "City cN".) roblox-helper.

## World-look DECISION (item 4) — RESOLVED
4. **Default world look = ENHANCED.** This answers the standing human-workitems
   "world-look pick (a/b/c)". Set enhanced as the DEFAULT (roblox Options).
   UNBLOCKS the roblox CP1 art pass (was gated on this pick). docs/13 default
   updates to enhanced; retro stays available as a toggle.

## Cross-platform / architect (do NOT let these be Roblox-only)
9. **Unit + building Civilopedia blurbs** — a blurb per UNIT and per BUILDING
   (what it is + historical backdrop/facts), like the 68 tech blurbs. This is
   CONTENT + CROSS-PLATFORM: author ORIGINAL prose (the ally, parallel to the
   tech blurbs), wire into the browser pedia/catalog (helper) as data, roblox
   consumes later. → ally request prepared (see human-workitems). NOT
   Roblox-authored. The pedia-concepts + tech-blurbs precedent applies.
11b. **Expand civ city-name lists** — civs.json carries only 8 names/civ, so a
    civ founding >8 cities hits "New <name>" / "Outpost <n>" on BOTH platforms.
    A shared DATA enhancement: extend each civ's `cities` list to ~16 real
    historical names (civs.json is hand-maintained — edit directly). Improves
    browser too. Low-priority; pairs with the 11a render fix.
2. **World-development panel on an AI-forwarded start** — when a game starts with
   AI fast-forward (age start), show the world developing (diorama/animation).
   DESIGN feature; the browser has the ff engine (shared/fastforward.js) and
   could want the same panel. Roblox-helper does the Roblox version; browser
   parity is a separate design item. Lower priority.
8. **City visuals grow by SIZE and AGE** — start as a small hut cluster, grow with
   population AND change look by era (ancient vs industrial vs space). The BROWSER
   has size tiers (CITY_TIERS, A36) but NOT era-based looks — so "city look by
   era" is a new shared render feature (Roblox + browser parity). Roblox-helper
   does Roblox; a browser era-look pass is a separate design item. Lower priority.

## Actions
- Record world-look=enhanced; update human-workitems; tell roblox-helper CP1 is
  unblocked. — DONE
- Prepare the ally unit/building-blurb request (item 9). — human-workitems
- Flag 11a (render .name) + 3 (Roblox-only) + the shared 11b/2/8 to roblox-helper
  so it routes correctly. — mail
