# Refinement XIV — multi-device playtest of the hosted server (2026-07-20)

_Delivery tracker (see agent-workitems for done-marks): §16 redirect ✅
(REVERSED by user ruling 2026-07-22, b44a344 — bare URLs land LOCAL to
spare the server; server play = explicit /healthz-gated link),
§2-adjacent endscreen fog-guard ✅ (score-view.js shim), bug-report feature ✅
(all three committed f7b52e2), §15 Studded spec + first impl ✅ (a2335b0,
awaiting user Studio review). Engine batch SHIPPED (markers 0071-0082):
§12 pathing+escort ✅ · §13 deficit ladder ✅ · §14 treasury+parley ✅ ·
§40 settler pop-cost ✅ · §50 city-as-road ✅ · §46/§45b queued.
Helper: §24 tile-yield ✅ + §27 tech-tree cards ✅ (hover-info #11 ⅔;
§22 pedia-links remaining), regency lifecycle ✅, save/load buttons ✅.
Remaining helper queue continues from §26 discovery-overlay (queue #12+)._

Source: user + friend playtest on https://multiciv.kjell.today across desktop
browser, iPad (2020), and phone. 29 items, triaged by the architect; each item
below carries its routing. Queue tags reference these section numbers.

Artifacts (both verified 2026-07-20):
- `debugging/logs/g52yt-2.json` — server save, game g52yt-2 (the SECOND game;
  human p1 aztecs), turn 396, 2100 AD, **GAME OVER (winner p5 French) yet
  active player p1** — the live specimen for §2 (regency past game-end) and
  the queued endscreen crash (code 6TER-KETK-VEJEE). `debugging/info.sh`
  verified.
- `debugging/logs/retromulticiv-diag-turn396-client-.json` — Shift+D
  diagnostics of the FIRST game (a LOCAL run: bare `/client/?seed=513984
  &civs=7…godemperor`, human p1 zulus — a different game than g52yt-2 despite
  the shared turn number). **`tools/replay.js` verdict: reproduces EXACTLY**
  (5233 commands + 395 rounds → 0x19ec726e) — engine determinism confirmed on
  a real 396-turn live-box game. The ruleset-drift warning it prints is
  expected (dev_night carries the XII.5 victoryDrive rules the deployed box
  predates).

Lane key: **[helper]** client/UI, golden-neutral. **[engine]** gamesim
behavioral — PARKED behind the open XII.5 golden window, bugfixer lane, needs
design + JS+Luau twin + golden re-record. **[roblox]** roblox-helper, docs/13.

---

## §1 Minimap position [helper]
Move the minimap up to sit directly below the options field (desktop layout).
Pure CSS/layout in the left stack.

## §2 Regency must stop at game end [helper — CORRECTNESS]
When `state.gameOver` is set, ALL AI-regency driving for human seats stops and
no further turn advances. Evidence: g52yt-2 save is GAME OVER with active p1
and the game kept running to turn 396+. `client/ui/regent-driver.js:24` checks
`st.gameOver` per-step, but something still advances turns after game end —
audit the drive loop AND `session.js:139` (the AI-advance while-loop), and the
server path (does the server accept `endTurn` after gameOver?). Server-side
guard too if missing: a finished game accepts no more turn-advancing commands.
Test: load g52yt-2, enable regency, assert turn number frozen.

## §3 Regency minimum turn time [helper]
Regency turns are instant; players can't follow. Add a minimum wall-clock time
per regency-driven human turn, server-configurable, default such that ALL
regency players together take ≥1 s (5 regents → ≥200 ms each). Client flag +
server option (e.g. `--regency-min-turn-ms`, total budget divided by regent
count). Render-side pacing only — never engine state.
**CONFIRMED (user, 2026-07-20): 1 s TOTAL per round is the design**, with the
accepted consequence that bulk regency auto-play over 120–180 turns takes 2–3
minutes rather than seconds — deliberate: watchable beats instant. The `?age=`
pre-game fast-forward (shared/fastforward.js) is NOT paced — it stays instant;
pacing applies only to live regency turns a player can watch.

## §4 Playtest artifacts (no code)
See Artifacts above. Nothing to build; §2's test consumes the save.

## §5 + §8 Save/Load on mobile + client games [helper — DATA-LOSS RISK]
No visible save button on the iPad/mobile layout — a 1060-turn game could not
be saved. Add Save and Load buttons under the ⚙ Options menu (always visible on
every layout), primarily for local singleplayer/hotseat (server games autosave
server-side). Mobile-first: verify reachable on iPad + phone widths.

## §6 Controls tab must match the device [helper]
The controls/help tab shows keyboard shortcuts regardless of device. Desktop:
keep shortcut list. Touch devices: show a gesture legend instead (tap select,
double-tap move/goto, pinch zoom, long-press …) — see §7/§25 for the gestures
it must document. Detect via the same touch heuristic the client already uses.

## §7 Touch unit movement: arrow overlay + attack confirm [helper — MOBILE SLICE]
On touch, selecting a unit shows arrow overlay buttons (the dpad exists —
`client/ui/dpad.js` — surface/extend it) to step the unit. If the target tile
holds an enemy: show a combat overlay with odds and an explicit Attack yes/no.
Shortcut: double-tap a tile = move there (goto pathing if farther than one
step).

## §9 Re-open the endscreen [helper]
After closing the victory/defeat screen there is no way back. Add a "View game
summary" button just above "Watch replay" (persistent post-game, e.g. in the
turn bar or options). Depends on the endscreen-server-crash fix landing first
(already queue #2).

## §10 Mobile pinch-zoom breaks HUD layout [helper — MOBILE SLICE]
Pinch zoom scales the whole page: map zooms but top/bottom bars scale out of
the viewport, and there is no gesture to zoom back out. The pinch should drive
the MAP camera zoom only (renderer zoom), with the HUD pinned via proper
viewport handling (`touch-action`, `user-scalable=no` + in-canvas pinch
handler). Both directions (in AND out).

## §11 Random-civ pick is seed-parity biased [helper — ROOT-CAUSED]
`client/main.js:205-216`: Fisher-Yates driven by a raw LCG
(`seed*1103515245+12345 % 2^31`) with `% (i+1)` on the LOW bits — for an LCG
mod 2^31 the lowest bit alternates with period 2, so `shuffled[0]` (= the
human's civ when none picked) is grossly biased by seed parity. Observed:
repeated Aztec starts. Fix: drive the shuffle with the engine's xorshift32
(`engine/rng.js` algorithm — inline the step; client boot code, NOT engine
state). Verify: distribution over ≥1000 seeds ≈ uniform (rough chi-square in a
test). Golden-neutral: sim/scenario tests pass explicit playerDefs; URL-seed
lineups will change (acceptable, pre-1.0).

## §12 Settler oscillation at ocean inlets [engine — PARKED behind XII.5]
Settler ping-pongs, cannot navigate around an explored 3-deep ocean inlet on
the way to a frontier city site. Two asks: (a) pathing that survives concave
coastline (the goto/step heuristic likely re-evaluates greedily each turn and
flip-flops); (b) doctrine: an escort (militia/phalanx) should precede or
accompany a settler heading to an edge-of-empire site (ties into docs/15 war
doctrine + XII escort logic if any). Needs design; golden-affecting.

## §13 Regency economics: disorder at 0 gold [engine — PARKED behind XII.5]
AI regency (= engine AI driving a human seat) tolerates 0 gold + negative
income → civil disorder, instead of raising tax rate, converting citizens to
specialists (taxmen), or switching government. The engine AI already manages
its own civs' rates — audit why the drive path underuses it, then extend the
economic-adjust policy: at deficit, prefer tax-rate bump → specialists →
government switch before letting disorder bite.

## §14 AI treasury doctrine: rush-buying [engine — PARKED behind XII.5; design]
Observed: AI sitting on >1000 gold with room to expand, not rush-buying
settlers or defenders. Asks: does the AI EVER rush-buy? Design a treasury
doctrine: rush defenders when a city is threatened; with large surplus
(>~200 gold beyond needs) rush settlers/army/parts. NOTE: this is the same
design space as the SHELVED XII.5 rush-buy work (bugfixer #1901/#1902 —
parts-only if greenlit) — fold both into ONE "AI treasury" slice (XII.6
candidate) rather than two overlapping edits. Authenticity guardrail stands:
wonders are never gold-rushed (Apollo ruling #1899); caravans stay human-only.

## §15 Third Roblox world style: "Studded/Brick" [roblox]
Add a third visual style to the Roblox client's style roster: vibrant
flat-saturated brick aesthetic — studs on top of terrain blocks, bevelled
brick geometry, hyper-saturated flat colors (the "Studded"/"Brick style"
look). IP care: ship it under the names **Studded** or **Brick** only — no
LEGO naming/trademarks in code, UI, or store copy. Renderer-only (docs/13
tiers); zero engine impact. Roblox-helper drafts a style spec + screenshot set
first (docs/13 pattern) before building.
**ALLY DESIGN DELIVERED (2026-07-20 evening)** — full art direction in
`specs/ally-design-response-2026-07-20-evening.md` §2: strong yes; guiding
rule = silhouettes/readability first, charm from chunky proportions; per-
element table (terrain/hills/mountains/forests/units/cities/water); studs as
punctuation not blanket noise; LESS terrain relief in this style, not more;
no tiny decorative parts at tactical zoom. Naming ruled: **`Studded` =
player-facing label, `brick` = internal renderer-style id.** The roblox
style spec starts FROM that document.

## §16 Root URL → playable page [helper — IN FLIGHT]
Bare `/client/` 302→`/client/?server=1` is being built right now (queue #1,
helper working). EXTEND: the domain ROOT `/` must also land the visitor in the
game (302 → `/client/?server=1`) so "multiciv.kjell.today" alone works.
`?local=1` escape hatch already specified.

## §17 First-page "?" hint overlay [helper]
Setup screen gets a "?" marker; tapping it overlays friendly arrow callouts
explaining "Start Game" (local vs AI / hotseat), "LAN game" (host a lobby,
share join code), "Join game" (enter a code). Dismiss on tap/Esc.
**COPY DELIVERED by the ally** (`ally-design-response-…` §4) — use verbatim:
title **"New here?"**, the three button texts as written, one obvious
**"Got it"** dismiss button, callout cards sized for mobile legibility (no
precision taps).

## §18 "Find game" — global roster browser [helper; design exists]
Add "Find game" next to "LAN game" on the first page: lists servers from the
master index (docs/12 §6 in-client server browser — the A51 design). Fetches
`/master/servers` (same-origin on the hosted box; configurable master URL for
self-hosters), shows name/players/rules-match, join on tap.

## §19 "Report issue" link [helper]
Front page footer: "Report issue" → https://github.com/kjelloe/RetroMultiCiv/issues.
Complements (does not replace) the queued in-client bug-report feature (#3).

## §20 E-hint mute button missing + setting ignored [helper — BUG]
Friend: the 🔕 mute on the "press E to end the turn" banner sometimes doesn't
render, and the ⚙ "Hide the hint" option didn't take effect. Two call sites
build that banner (`hud.js:143` showNoMovesBanner with 🔕; `input.js:463`
banner WITHOUT 🔕) — likely the input.js path ignores both the option and the
mute. Unify: one banner builder honoring `hideNoMovesHint` everywhere.

## §21 Tech-tree button placement [helper]
Research panel: move the tech-tree button to the panel's lower section and
label it "View technology tree".

## §22 Pedia hover-links in tech text [helper]
Wherever a tech's description names a unit/building/wonder/concept, mark it
(underline/color) and show its civilopedia entry on hover (pedia data already
exists — `pedia.js`/`pedia-concepts.js`/`catalog-text.js`). Reuse one shared
hover-card component with §24/§27.

## §23 Unit-move pacing [helper]
During AI/regency/multi-unit moves, let a unit's tile-step render fully, wait
~200 ms, then move the next unit. Toggleable option "Show unit move", default
ON. Render-side only (anim.js is render-time motion — never engine state).

## §24 Tile-yield hover overlay [helper]
Hovering an empty tile (no unit/city) >300 ms shows a small overlay with the
tile's food/shields/trade yields. Respects fog (visible tiles only). Shares
the §22 hover-card infrastructure. Desktop hover; on touch this is covered by
long-press only if trivially cheap — otherwise desktop-only for now.

## §25 Right-click behavior [helper]
Suppress the browser context menu on the map canvas. Right-button LONG-press
(>300 ms) = goto for the selected unit (same as the touch long-press
semantics). Plain right-click: nothing.

## §26 Tech-discovery celebration overlay [helper]
Research completion currently under-celebrated. On discovery: large overlay —
tech name, era-glyph art (tech-glyphs system; animate if cheap), ~3 s fanfare
cue (new SOUND_IDS row → appears in soundboard.html automatically), the
civilopedia article below. Extends the existing `discovery-card.js` rather
than a new module.
**ALLY DESIGN DELIVERED — SUPERSEDES the sketch above** (`ally-design-
response-…` §1): sequence = soft world-dim (map recedes but stays visible) →
era-colored glyph reveals first, large/centered → tech name → blurb → separate
UNLOCKED consequence panel (rules-derived, apart from flavor) → TWO exits
**"Continue"** and **"Choose Research"**. **NO auto-close** — fanfare ~3 s but
the card stays until the player acts (phone players must not race the UI).
Fanfare is ERA-SPECIFIC (4 characters: ancient drum/reed/bronze; classical-
medieval strings/bell; industrial brass/mechanical; modern rising electronic)
— 4 new SOUND_IDS rows, reviewable in soundboard.html. Card hierarchy mock in
the ally doc.

## §27 Tech-tree hover cards [helper]
Hovering a tech node in the 🌳 tree shows the same mini pedia article the
research panel shows (shared component with §22).

## §28 Top-bar rates + government display [helper]
Top center bar, right of gold: show current tax/sci/lux rates (e.g.
"T50/S40/L10") and the government name. Click → opens the tax panel.

## §29 Terrain relief: flatten the flats, raise the hills [helper — renderer]
Friend: grassland/plains read as hilly even with no hill/mountain neighbors.
In `renderer/three/terrain.js`: flat terrain ids (grassland, plains, desert,
tundra …) get height ~0 when ALL neighbors are flat; hills get a height boost
for contrast; KEEP the existing curving where a tile borders non-flat terrain
(the faceted-surface look). Verify via `debugging/gallery.html` + `shoot.sh`
screenshot pair (before/after), incl. one `--webgl1` pass (r162/WebGL1).
**ALLY ART DIRECTION** (`ally-design-response-…` §3): three strong tiers with
clear GAPS — water 0 / flats ~1 (near-level, minor faceting; color variation
not elevation variation; NO per-tile vertical jitter) / hills 2.5–3 (broad
shoulders, readable plateau) / mountains 6–8 (own the skyline). Forest canopy
may add volume but ground obeys the terrain class. Acceptance test: a
DESATURATED screenshot must still separate flat/hill/mountain by height +
silhouette alone.
**Numeric note:** the user capped hills at ≤25% of mountain height; the
ally's tiers imply ~31–50%. Not silently resolved — implement inside the
overlap (hills ≈2, mountains ≈8 → 25%, honoring both the user cap and the
ally's gap hierarchy) and settle the final ratio at the screenshot review.
**ALLY CONFIRMED the overlap (2026-07-21)**: hills≈2/mountains≈8 is the
first screenshot candidate; desaturation check decides. Extra direction for
the Roblox STUDDED mode: err toward slightly LOWER hills there — stepped
geometry + studs already create depth (relayed to the roblox lane via §15).

## §30 Host option: "Auto AI takeover" [helper — server/lobby]
LAN/multiplayer host option, default **ON**: when a seat's inactivity
countdown reaches 0 OR its player stays disconnected for the same duration,
the AI takes the seat over (the docs/08 AI-regency machinery — this formalizes
WHEN it engages as a host policy). With the option OFF, the same trigger
auto-SKIPS the seat's turn instead of driving it. Lobby checkbox + server flag;
countdown duration reuses/aligns with the existing skip-vote/seat-grace
timers rather than adding a third clock. Server seat/turn logic + lobby UI —
golden-neutral (no engine state), but touches near the docs/17 boundary:
LOCK `server/index.js` regions properly and keep the connect/cmd dispatch
untouched (turn policy lives in server/game.js / lobby.js).

## §31 Order queueing while waiting [helper — client-side]
In multiplayer, allow issuing goto orders while it is NOT your turn: the
client queues them locally and submits them in order the moment your turn
starts — same waiting-time freedom as city/production/research/tax changes.
Implementation stays CLIENT-side (a pending-orders list in session/UI state,
flushed as ordinary commands at turn start) so the engine and server protocol
are untouched; server-side it is just normal commands arriving on-turn.
Show queued orders visually (path hint + a "queued" badge); allow cancel
before flush. Verify the off-turn city/production/research/rates changes the
user cites all genuinely work over `?server=1` too — fix any that silently
no-op off-turn, since the feature's premise is parity with them.

---

## Routing summary

| Queue | Items | Order rationale |
|---|---|---|
| helper (after in-flight redirect + endscreen + bug-report) | §2+§3, §5/§8, §20, §11, §1+§9+§21+§28, §29, §16-ext+§17+§18+§19, §22+§24+§27, §26, §23+§25, §6+§7+§10 | correctness → data-loss → bugs → polish → mobile slice |
| bugfixer (PARKED until XII.5 closes) | §12, §13, §14 (one AI-behavior batch; §14 folds in the shelved rush-buy) | golden window is single-holder |
| roblox-helper | §15 (spec+screenshots first) | independent lane |

User decisions embedded: §3 = 1 s TOTAL regency budget (divided per regent);
§18 placement next to "LAN game"; §29 hills ≤25% of mountains. Flag anything
that contradicts play feel during verification rather than re-asking.

---

# Batch 2 (user playtest, 2026-07-21) — §32–§38

## §32 Unit action-bar width [helper]
Narrow the action buttons slightly so "Disband" fits on the same row as
"Fortify" at default width. CSS only; verify at phone width too.

## §33 Diplomacy envoy modal [helper]
Incoming AI offers (peace etc.) currently surface too passively. On offer
arrival: a MODAL envoy window — civ leader name/glyph, the offer, explicit
buttons Accept / Reject / "Consider later" (offer persists in the diplomacy
panel; no silent expiry). Blocks map input while open (keyboard: Esc =
later). Client-side presentation of the existing D3 offer state —
golden-neutral; D4-D6 will reuse the same envoy frame for richer terms.

## §34 City overview panel [helper]
New button (city icon) LEFT of the research bar → a center panel listing all
own cities: name, population, food/shields/trade, sci/tax contribution,
specialist counts, current build + queue. Vertical scroll when the list
exceeds the panel. Rows click → open that city view. Fog-honest (own cities
only — no filterView concerns).

## §35 Zoom-to on event messages [helper]
Transient messages with a map location ("we have contact with the Chinese",
barbarian raids, disorder, wonder completed…) get a 🔍 zoom-to icon that
pans the camera to the event tile. Wire an optional {x,y} through the
message/banner path; messages lacking coords show no icon. 🔍 approved
("unless better" — 🔍 is the right affordance; keep).
Also applies to turnlog rows where coords exist.

## §36 Minimap visibility option [helper]
⚙ Options: "Show minimap", default ON; OFF hides it (layout reflows).

## §37 Road-aware goto [helper — shared/pathfind.js]
`findPath` must weight road-to-road steps at their real cost (roads
effectively 3x range via the free-step counters the engine already
implements in movement.js:155). Today goto paths ignore roads. Golden-
neutral: findPath only shapes which move commands the CLIENT issues
(recordings replay the commands themselves); engine AI uses its own bfs.
Unit test with a road detour beating a shorter roadless path. shared/ is
Lua-portable — keep the JS subset rules.

## §38 City-view mood block + specialist tooltips + pedia [helper]
Move the "mood" row up, directly below the city name. Keep the existing
"mood" tooltip; ADD per-face hover tooltips (happy/content/unhappy citizen,
entertainer, taxman, scientist — what each one does). Pedia gap confirmed:
specialists exist only inside concept PROSE — add three concept entries
(Entertainer, Tax Collector, Scientist) so the tooltips can link somewhere.

## Batch-2 routing
helper queue, all golden-neutral: quick-UI bundle (§32+§36+§38), city
overview (§34), envoy modal (§33), event zoom-to (§35), road goto (§37).

---

# Batch 3 (user playtest, 2026-07-21) — §39–§42

Artifact: `debugging/logs/retromulticiv-diag-turn137-client.json` — structurally
valid; hash-verify DIVERGES at turn 5 as expected (recorded on the deployed
pre-calendar ruleset; yearSteps moved every round hash). Old recordings cannot
verify across the calendar change — a version-skew property, not a bug.

## §39 Post-conquest disorder [RULED 2026-07-21: shelved to the Civ2-ruleset option]
User disposition: NOT in the Civ1 default (fact-check: Civ1 imposes no
capture disorder — current behavior authentic); NOTED for the future
"Civ 2 ruleset" game option (plan-version2.md). No queue item.
User: shouldn't a conquered city suffer 1 turn (2 for larger?) of civil
disorder? Engine today: capture reduces pop, drops specialists, plunders gold
(combat.js:203) — NO disorder period. Reviewer fact-checks whether this is
Civ 1 or a Civ 2+ memory; if Civ 1, a small engine slice (disorder timer on
capture) joins the queue; if drift, user decides labeled-mix vs skip.

## §40 Settler pop cost + size-1 disband [engine — MISSING CIV1 RULE]
Premise check found the gap is BIGGER than the ask: settler production costs
NO population today (Civ 1: settlers deduct 1 pop when completed; a size-1
city building one is DISBANDED). Slice: engine — completing `settlers`
deducts 1 pop; at pop 1 the city is removed (units keep home=null? audit
homing), golden-affecting + twins. Client — pre-warn when queueing a settler
in a size-1 city ("completing this settler will disband the city"), warn
badge in build panel + city overview. Civ1-authentic.

## §41 Military overview panel [helper]
Military-icon button LEFT of the §34 city button → all own units: type,
att/def/move, upkeep (home city), location (city name or "near <city>" +
coords) with a §35 🔍 zoom-to per row. Vertical scroll. Companion piece to
§34 — share the panel/table component.

## §42 Auto-improve settlers [helper — automation]
Selecting a settler offers "Auto-improve": inline menu for nearest-city
priority — Balanced / Food / Shield / Trade. The settler then works the
city's fat cross: improvements per priority, plus roads everywhere (and
railroad once invented). ENDS when the cross is maximized for the chosen
priority + fully roaded(/railed) — then the unit wakes for new orders.
Client-side automation issuing ordinary commands (automate.js precedent) —
golden-neutral, works over ?server=1 identically. Design notes: never
replace an existing improvement unless priority demands (mine→irrigation
only on Food priority); pause+wake if enemy adjacent (safety, matches
existing automate behavior).

## Batch-3 routing
§41+§42 → helper queue. §40 → bugfixer queue (engine, after the xiv-ai
windows). §39 → reviewer fact-check, then conditional.

---

# Batch 4 (user playtest, 2026-07-21) — §43–§44
(§39–§42 in the resend were batch-3 duplicates; §39's fact-check verdict is
with the user: Civ1 has NO conquest disorder — skip vs labeled-Civ2-mix.)

## §43 City-view build line + visible queue + "+" queueing [helper]
Move the "building …" line UP directly below the Units/Buildings/Wonders
selection panel so current production is always visible; render the build
QUEUE (up to 5 items) below it. Add a "+" affordance at the right of every
catalog row — click = enqueue as item N+1, identical to the existing
shift-click (which stays). Touch-friendly (the "+" is the mobile path to
queueing — shift-click has no touch equivalent). build-queue.js exists;
this is layout + affordance, golden-neutral.

## §44 Palace/capital at founding [helper — UI; engine already authentic]
FINDING: mechanics are ALREADY Civ1-equivalent — engine/government.js
capitalOf() = city-with-Palace ELSE the player's OLDEST city, and
corruption-by-distance flows from it. So the first city IS the capital from
founding with no build needed, and building a Palace elsewhere MOVES the
capital — exactly the user's intent. The gap is presentation:
1. Capital badge (★/Palace icon) on the capital in city view, city overview
   (§34), and the map label.
2. HIDE Palace from the CURRENT capital's build catalog (building it there
   is a 200-shield no-op) — show it elsewhere with tooltip "moves your
   capital here".
3. Pedia: Palace article states the rule (first city = capital; Palace
   relocates it).
ALTERNATIVE (not chosen, surfaced): literally grant a free Palace building
in city #1 (engine, golden-affecting) — adds nothing mechanical over the
fallback; only take it if the user wants the building VISIBLE in the
capital's building list, in which case queue it to the engine lane.

## Batch-4 routing
Both → helper queue, golden-neutral.

## §45 Settler-starvation legibility + rehome (DEBUG find, 2026-07-21; save g52yt-2 Teotihuacan)
ROOT CAUSE (verified in-save): 4 settlers homed to a pop-2 city eat 4
food/turn (engine cities.js:551, settlerFoodUpkeep) — but the CITY PANEL
surplus (panels.js:310) omits settler upkeep entirely: showed "+2/turn,
grows in ~10" while the true net was −2. The city starved to size 1 and
pinned at 0/20 "without explanation". Engine is CORRECT per the user-ruled
flat-1 settler food rule; the UI lies and the player has no repair tool.
(a) [helper — PRIORITY, truth-in-UI] panels.js surplus subtracts settler
    upkeep; the food tooltip itemizes it ("2 citizens eat 4 · 4 settlers eat
    4 → net −2"); a ⚠ starving indicator when net < 0; same fix in the §34
    city-overview food column. Golden-neutral.
(b) [engine] REHOME command (Civ1-authentic 'h' Home): rehomes a unit to the
    city it stands in (shifts upkeep there). New engine command + twins +
    scenario; golden-affecting, engine-lane queue. KEYBIND note: our 'h' =
    helpWonder — resolve (Civ1 precedent favors h=Home; helpWonder can move
    to 'w' or stay caravan-context-only) — small user-facing keybind choice,
    helper decides with the client half.

## §45a addendum (user follow-up): unit HOME CITY display
Verified: the home city is shown NOWHERE in the client (no hud/panels hit).
Fold into §45a scope: the unit info panel shows "home: <city name>" for every
homed unit (settlers prominently — their upkeep is the Teotihuacan trap);
units with no home show "unsupported". Golden-neutral.

## §42 note (user follow-up): tech-gated improvements
Confirmed non-issue by construction: the automation issues ordinary commands
and the ENGINE rejects undiscovered improvements (railroad needs Railroad
etc.); Civ 1 gives irrigation/mine/road from the start. The §42 item needs
no extra gate — the priority menu simply never offers what the engine would
refuse.

## §46 Era-relevant default production (user item "45", renumbered)
Founding hardcodes `producing: militia` (cities.js:326) regardless of era —
a Gunpowder-age city defaults to an obsolete unit. FACTS: militia
obsoletedBy=gunpowder (data, Civ1-authentic — Civ 1 obsoletes Militia at
Gunpowder; "guerrillas appearing later" is Civ 2's Partisans, drift).
Slice [engine, small]: the founding default becomes the BEST AVAILABLE
DEFENDER the owner can build (defense-first tiebreak cost — militia →
phalanx → musketeers → riflemen → mech-inf as techs allow); same fallback
when production completes with an empty queue. Golden-affecting (AI cities
found with better defaults → sim drift) + twins; engine-lane queue.

## §45a second addendum (user, 2026-07-21): settler eaters INLINE in the food row
The settler consumption must be visible in the growth calculation LINE
itself, not tooltip-only. Shape (user's example): the city-view food row
reads like `🌾 6 · 👥 eat 4 · ⚒👤×4 settlers eat 4 → net −2` — i.e. an
inline settler icon + count whenever settlerFood > 0, with the existing
tooltip carrying the long-form explanation ("each settler homed here eats
1 food/turn; rehome or expend settlers to free food"). When net > 0 keep
the growth ETA line; when ≤ 0 show the ⚠ starving/stalled note instead.

---

# Batch 5 (user playtest, 2026-07-21) — §47–§49

## §47 Specific completion messages [helper]
"City completed its work" becomes concrete: "<City> completed Granary" /
"<City> trained a Phalanx" / "<City> finished <Wonder>". Turnlog + banner
paths; carries the §35 🔍 zoom-to (city coords known). Trivial-but-daily.

## §48 Wonder completion splash [helper]
When the PLAYER completes a wonder: a large splash — wonder art (recipes/
gallery asset render or glyph), the pedia article below, ~3 s triumphant
cue (new SOUND_IDS row), buttons "Continue" and "Go to city" (opens that
city to change production). REUSES the §26 discovery-celebration frame
(same no-auto-close rule; fanfare distinct from tech cues). Rival wonder
completions keep the existing modest message (with §47 naming).

## §49 Economic overview panel [helper]
Click the 💰 gold/turn in the top bar → a breakdown panel answering "why is
it −4 now when it was +4 last turn?": per-source income (city taxes after
corruption, trade routes, wonder effects) and per-sink costs (building
maintenance itemized, unit shield/food upkeep by city, settler upkeep),
summing EXACTLY to the top-bar figure. Third member of the overview family —
shares the §34/§41 table component. Fog-free (own empire only).

## Batch-5 routing
All three → helper queue. §48 sequenced after xiv-discovery-overlay (§26)
for frame reuse; §49 after §34 (component reuse); §47 anytime.

## §50 City squares count as roads (river caveat) [engine — Civ1-authentic]
(§49 in the same message was the batch-5 duplicate.) Civ 1: a city square
acts as a ROAD square for movement chaining. Ours does not — movement.js:168
chains on the literal road flag only (verified). Slice [engine + twins,
golden-affecting]: in the road-chain test, a tile counts as roaded when it
holds ANY city; EXCEPT when either endpoint carries the river flag and the
MOVER'S owner lacks bridge-building — rivers break the chain until bridges
(matches the road-on-river build gate; tech id `bridge-building` exists).
Rail chaining unchanged (city ≠ rail). Scenario pins: city→road chain works;
city-across-river does NOT pre-bridge, DOES post-bridge. AI/goto pathing
picks the benefit up automatically (§37's road-aware findPath should mirror
the same rule — note added for the helper item).
