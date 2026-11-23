# Roblox UI playthrough — Studio sitting checklist

The Roblox half of the two-surface UI playthrough (browser/mobile half:
`test-ui/mobile-playthrough.spec.js`). Studio cannot be driven headless from
this lane, so this checklist makes the user sitting cheap and complete: every
step says what to tap, what should happen, and the one thing most likely to be
wrong. Steps carry their docs/13 parity tier so a failure reads as
"tier N row" and not "felt wrong".

**Setup:** `rojo serve` from `roblox/` (or open `roblox/RetroMultiCiv.rbxl`
and sync), Studio → Play. Two-client steps (16, 18) need Studio's
"Start Server + 2 Players" — they are grouped at the end so a solo pass
covers steps 1–15 without a restart.

**Artifacts:** screenshot after the EXPECT of each step marked 📷, named
`roblox/acceptance/playthrough/NN-<slug>.png` (acceptance/ is never
committed — the set is for human review, numbered like the browser run's).

**Sound is LIVE** as of the Open Cloud upload run (2026-08-04, #2922): all 32
`SoundAssets.luau` cues carry real `rbxassetid://` ids, so combat/found/tech/
wonder/etc. should play at the approved browser-mix Volume (the sound=false
Options row still mutes). Silence on a cue IS a finding now — check the id
resolved and the asset is public.

**Style/size/font/placement polish is post-1.0 by ruling** — log layout
items only if they block reading or tapping.

---

## The short way: the UI tour (run A, about 3 minutes)

1. Play. Start the default game. Found the capital (B, confirm the name).
2. Bottom-left: Debug (Studio) > "Run UI tour (stages + checks all panels)".
3. Hands off. A yellow caption names each stop ("Tour 07/20 Military");
   each surface stays up 1.5 s. Watch for anything that looks wrong; the
   log already has what can be measured.
4. Afterwards, in the terminal: `node roblox/tools/after-run.js`. It lists
   only the stops that did not pass, plus diagnostics and the replay
   verdict.
5. Optional (run C): press the AI button, pick a stance, leave the game to
   its end, then run `after-run.js` again.

The tour opens surfaces; it presses nothing (2026-11-16). Until the action
stops of `specs/roblox-parity-plan.md` step R1 exist, these want a hand
check, about two minutes with the staged units: Settlers on a swamp or
forest (button reads Drain / Clear / Plant), on a roaded tile with Railroad
known (Rail); hover a greyed order (reason card); X once ("Sure? (X)"),
twice (unit gone); G then a far tile (dots stay, button reads "Cancel
route"); Caravan in a city building a wonder (Help Wonder, H); city panel
+ Tax / + Sci / Reset; Cities > Economy net equals the gold chip; narrow
the Studio window under about 1,300 px (bottom bar moves above the corner
buttons). Diplomacy (Y) once a rival is met: Offer peace reads "offer sent"
afterwards; Propose... > Demand tribute / Tech swap; an AI offer raises the
envoy card on your turn; Declare war under a treaty asks twice.
Encyclopedia (2026-11-23): click one unit (turning model, drag turns it),
one advance (glyph on the era card), one terrain (3 x 3 tile patch), one
wonder (diorama model), one building, one government, one concept (models
too); a gold caption line sits under the picture. The Pyramids must be
solid pyramids, not four spikes. Debug menu > "Play wonder scene (next
wonder)": bars close, the model rises piece by piece, the camera circles,
a card with Encyclopedia / Go to city / Continue; a click during the build
skips to the card; afterwards the map view and every HUD part are back.
"Show rival wonder card": a small card at the top for 6 s. Options >
wonder scenes off: the card only (the Debug menu row too). Before a game:
Choose civilization shows a turning scene per civilization with a banner
in its colours. K (Studio) shows all 43 wonder and
building models behind the gallery grid. Badges:
`after-run.js` lists the keys a game earned; a tour run uses debug
commands, so that game earns none afterwards.

The tour grants gold and advances and adds three units (a debug game: the
DEBUG mark stays on). The numbered steps below remain the full hand script
for what the tour does not open (lobby, gallery, end screen, replay).

---

## Pre-sitting headless clears (already run by the roblox lane)

- `roblox/check.sh` ALL GREEN — 67 gates on tip
  3e5dff8: anchors + statehash/rng/gamecode twins, gate-4 baked-data
  freshness (rules 0xe8c9e1cd, the held W8 re-bake), scenario twins, the
  pedia/blurb/tile-prop/sound-map/turn-log mirror gates, glyph parity (68),
  seat-registry hook.
- Everything below therefore tests PRESENTATION AND WIRING, not rules: any
  wrong number on screen is a client display bug, not an engine bug.

---

## A. Boot and lobby (solo client)

1. **Intro plays on join** — Tier 4 (intro, frozen v5b) 📷
   - Tap: nothing; just join.
   - Expect: 5-beat "one city through time" camera flight; title
     **"A World Begun"** + subtitle "Start with one city. Build a
     civilization that lasts."; regular UI HIDDEN except a large
     `SKIP ▸` button lower-right; title holds ~5 s longer than the beats.
   - Likely wrong: camera bounces or free-falls (the intro must own only
     the CFrame while Camera.client keeps asserting Scriptable — a
     regression here is the known late-character-spawn trap).

2. **Skip works** — Tier 4
   - Tap: `SKIP ▸` during any beat.
   - Expect: instant white-out → observation deck; normal UI restored.
   - Likely wrong: HUD elements that never re-show (they were hidden by the
     intro and must all be re-enabled on skip).

3. **Observation deck + greeting** — Tier 3 (lobby slice) 📷
   - Tap: look around; read the greeting board.
   - Expect: greeting "Welcome to A World Begun! …"; spectator-by-default
     (no seat auto-claim). Since run-R the deck is a railed glass platform:
     a banner, five stations in a row facing the spawn (START A NEW GAME,
     JOIN GAME, TAKE OVER AI CIV, SPECTATE, GOTO CAPITOL), each a pad with
     a sign behind it — title, what it does, and a status line (green
     "OPEN - walk onto the pad" or an amber reason) that changes with the
     lobby phase; a glass look-down balcony at the front edge. No game HUD
     (action bar, research buttons, bottom-left toggles, minimap) on the
     deck before a game exists.
   - Likely wrong: a pad touch that answers with nothing — every pad touch
     must toast either an action or a reason.

4. **Host setup panel** — Tier 3 📷
   - Tap: the NEW GAME pad.
   - Expect: "New game" panel with a "Your civilization: Random" button at
     its top right (opens the civilization gallery: left / right through
     the civs, Random first; the same button is on your seat card in the
     Game lobby panel; a civ another player picked reads "Taken by ..."); one card per option (name left, value right in blue, segment strip under it) for map
     size / civilizations / human seats / **map type (9 segments:
     archipelago, clover, continents, fractal, inland-sea, islands, oval,
     pangaea, ring)** / max idle / starting age / difficulty / combat.
   - Likely wrong: map-type taps landing on the WRONG preset — the bar
     order must stay alphabetical because the server steps sorted keys
     (this is the W7 picker, new this window — give it two or three taps
     both directions).

5. **Seat claim + start** — Tier 3
   - Tap: JOIN pad (claims seat 1), then the green start button.
   - Expect: toast confirms the claimed seat; world generates; you spawn
     as the seated player; HUD status line shows turn 0/1, gold, research.
   - Likely wrong: claiming a seat while the setup panel is open leaving a
     stale panel on screen.

## B. Core loop (Tier 0/1)

6. **Unit select + move hints** — Tier 0/1 📷
   - Tap: your settlers.
   - Expect: selection ring; move hints on reachable tiles; the fixed
     bottom action bar fills with legal actions only.
   - Likely wrong: action buttons enabled for illegal actions (the
     precheck gates the SEND; a dead tap with no toast is the bug shape).

7. **Move** — Tier 0
   - Tap: an adjacent highlighted tile.
   - Expect: unit walks; moves counter in the bar decrements; fog opens.
   - Likely wrong: the unit teleporting (render-anim regression) or hints
     not refreshing after the move.

8. **Found a city — name prompt (F1, built 2026-11-14)** — Tier 0/1 📷
   - Tap: `Found` on the action bar (or B).
   - Expect: a small centered card "Name your city" with a TextBox
     pre-filled with the civ's next roster name (e.g. `Rome`), FOUND and
     CANCEL. FOUND (or Enter) founds under the shown/typed name; CANCEL
     founds nothing. Billboard appears with name + pop; settlers consumed;
     turn log gains the founding row. Type a custom name once: it must
     appear on the billboard; game keys must work again after the card
     closes (focus released).
   - Likely wrong: the B keypress typed into the box; the on-screen
     keyboard covering FOUND on a phone; a moderated name not falling back
     to `Colony N` with the toast.

9. **City panel** — Tier 0/2 📷
   - Tap: the city billboard.
   - Expect: panel with a round population badge and the city name, a
     coloured food / shields / gold line, the mood faces, a production
     card (kind dot, name, progress bar, n/cost, Buy), then the catalog in
     sections (Built here with Sell, Units, Buildings, Wonders) - each row
     a colour stripe by kind, the cost and a Q+ chip on the right, the
     item being built tinted green; worked tiles in the world
     (single-tap toggles a worked tile).
     Under the yields: a food line ("+2 food a turn  box 14/30  grows
     in 8 turns", red STARVING when short; hover = the arithmetic), the
     mood faces, then "n free  n tax  n sci" with + Tax / + Sci / Reset
     (greyed below size 5 or with nobody free; hover says why). "<" ">"
     beside the X go to the previous / next city. The line under the name
     says "capital" for the capital and turns red in civil disorder.
     Hovering any row (0.35 s; long-press on touch) shows a card: name,
     kind, the encyclopedia text, the effect, figures, what it requires.
     The Barbarian Leader is never listed; an obsolete unit leaves the
     list; in an inland city ships read "needs a coastal city".
   - Likely wrong: a long name running under the cost or the lock
     reason; on touch, the long-press both shows the card and picks the
     row (the 0.5 s pick-and-close is older); the queue strip at the bottom not appearing after Q+ (it
     never showed before 2026-11-15: a variable was read before its
     declaration).
   - Likely wrong: worked-tile toggle not applying (it was rebuilt from
     double-click to single-tap + debounce in runL — re-verify).

10. **Build queue** — Tier 2 📷
    - Tap: in the city panel, queue two items (e.g. warrior, then
      granary).
    - Expect: queue list renders in order; first item shows turns-left;
      removing the head promotes the next.
    - Likely wrong: the queue accepting a duplicate wonder or not
      refreshing after completion.

11. **End turn + AI round** — Tier 0/1
    - Tap: End Turn (Return).
    - Expect: wait-status HUD shows the AI round progressing; control
      returns; year advances in the status line.
    - Likely wrong: a hang past ~10 s — note WHICH civ the wait-status
      names if it stalls (that names the AI-round chain break).

12. **Turn log: classes, filters, jump-to** — Tier 2 (SO6) 📷
    - Tap: open the turn log; toggle a class filter; tap a row with a
      location.
    - Expect: the panel stands to the RIGHT of the bottom-left button
      column (no button drawn over it); one row of six filter chips
      (coloured dot + Combat / Cities / Research / Rivals / Saves /
      Regent, none touching); each line reads turn, a coloured kind word
      (City, War, World ...), then the text; filters hide/show classes
      (an off chip is dark); the target button on a located row centres
      the camera on its tile (centerOn — gates 28/29 pin the mirror).
    - Likely wrong: jump-to centring on the wrong tile after map wrap;
      the Turn log tab's X sitting on a chip.

12b. **Legend** 📷
    - Tap: Legend in the bottom-left column.
    - Expect: a "Controls" panel beside the column: three sections
      (Units, Game, Camera and mouse), each row = key caps on the left
      and one line of text on the right; scrolls; an X closes it. The
      Diplomacy and Map overlays panels also open beside the column.
    - Likely wrong: a cap running into the text column; the last rows
      cut off under the panel edge.

12d. **Military** 📷
    - Tap: Military in the top row.
    - Expect: a "Military" panel: a totals line (units, combat, civil,
      veteran), a count per unit type, then one row per unit (name,
      attack / defense, moves, where it is, which city supports it). A
      click on a row closes the panel, moves the camera there and
      selects the unit.
    - Likely wrong: the top row now holds five buttons; on a narrow
      window it can reach the turn chip on the left.

12c. **Statistics** 📷
    - Tap: Statistics (J) in the top row, or J (after a few turns, so the chart has samples); also the Statistics button on the end screen.
    - Expect: a "Statistics" panel top centre: one card per civ (colour
      disc, name, You / Human / Perfectionist chips, labelled figures;
      your own card adds Gold, Techs, Rule and Research, a rival card
      shows only Cities seen and Units in sight), "Battles n won n lost"
      at a card's right once it has fought, a Wonders list, then "Score
      over time" with one dotted line per civ; an X closes it.
    - Likely wrong: a long civ name running under its chips; with 14
      civs the body must scroll, not grow past the screen.

13. **Research + discovery moment** — Tier 1 📷
    - Tap: the research chip; pick a tech (or open the Tech Tree graph - boxes by level with dependency lines, scrolls sideways - and
      set a beeline goal); end turns until it lands.
    - Expect: picker lists techs with turn costs; on completion a
      DISCOVERY SPLASH: the map dims and a centred card shows "ADVANCE
      DISCOVERED", the name on an era-coloured band, the encyclopedia
      text, chips for every new unit / building / wonder (a click opens
      that encyclopedia entry), "You can now research ...", and Choose
      research / Encyclopedia / Continue. It stays until you press one.
      Under the AI regent it leaves by itself after 7 s.
    - Likely wrong: the discovery card appearing during the AI round
      instead of at your turn start (event-order bug), or a glyph
      rendering as a blank frame.

14. **Options + pedia spot-check** — Tier 2
    - Tap: Options (sound/palette rows present); open the Encyclopedia, one
      concept page and one unit page.
    - Expect: pedia text matches the browser wording (em-dash rendered as
      " - " on concepts); options toggle without error.
    - Likely wrong: a pedia page overflowing its frame with no scroll.

15. **Save code + soft reset** — Tier 3 (R10) 📷
    - Tap: hover the top-left turn chip (the game code and the last autosave code are in its tooltip since run-R); host opens Options -> "Save - get resume code"; host taps reset
      (Studio path).
    - Expect: the code chip is selectable/readable (no clipboard on
      Roblox — read/retype is the platform shape); reset in Studio takes
      the SOFT path (PlaceId 0 guards TeleportService) back to the deck
      with client caches wiped — fog must be fully black again on the
      next game (the runN regression).
    - Likely wrong: stale fog or stale billboards after the in-place
      reset.

## C. Two-client steps (Start Server + 2 Players)

16. **Second seat + hotjoin** — Tier 3 📷
    - Tap: client B claims the second seat mid-game via the JOIN pad.
    - Expect: B lands on the configured mid-game seat path (strongest-
      second pick), sees only its own fog; A is undisturbed.
    - Likely wrong: B seeing A's visibility for one frame before the
      seat filter applies.

17. **Resume by code** — Tier 3 (R10)
    - Tap: after a reset, type the saved code into the idle-phase resume
      box, tap RESUME.
    - Expect: the game restores at the saved turn; seats re-map; a wrong
      code toasts a clear rejection.
    - Likely wrong: the TextBox keeping keyboard focus so movement keys
      type into it after RESUME (focused-TextBox guard).

18. **End screen is public** — Tier 3/4 📷
    - Tap: play a small map to any end (or concede path), both clients.
    - Expect: endscreen shows to BOTH players (post-game is public);
      score itemization reads "pop + happy + techs (+future) + wonders";
      replay theater is reachable by the defeated player too.
    - Likely wrong: the seated-gate not dropping at gameOver, locking the
      loser out of the theater.

---

## D. Screenshot plan (the reviewable set)

| # | Artifact | Captures |
|---|---|---|
| 01 | `01-intro-title.png` | Step 1 — title beat, "A World Begun" |
| 02 | `02-deck.png` | Step 3 — deck, greeting, pads |
| 03 | `03-setup-panel.png` | Step 4 — all 8 bars incl. 9-segment map type |
| 04 | `04-first-turn.png` | Step 6 — selection + hints + action bar |
| 05 | `05-city-founded.png` | Step 8 — name card, then the billboard with the chosen name |
| 06 | `06-city-panel.png` | Step 9 — full panel |
| 07 | `07-build-queue.png` | Step 10 — 2-item queue |
| 08 | `08-turn-log.png` | Step 12 — filtered log |
| 09 | `09-discovery-card.png` | Step 13 — card with glyph |
| 10 | `10-save-chip.png` | Step 15 — readable game code |
| 11 | `11-second-seat.png` | Step 16 — client B seated view |
| 12 | `12-endscreen.png` | Step 18 — itemized score, both clients |

## E. Known-unreachable / expected-absent (do not spend sitting time)

- **City RENAME** — the found-time name prompt exists (step 8); renaming
  an existing city has no surface on either platform's Roblox side.
- **Diplomacy audiences beyond D3** — D4–D6 client UI is post-1.0 by
  ruling, and D3+ parity is additionally blocked server-side (filterView
  omits `state.relations`; needs a golden-window change). Skip diplomacy
  depth checks.
- **Sound cues** — NOW LIVE (upload run 2026-08-04, #2922): 32/32 assetIds
  filled, so this is a testable item this sitting, no longer expected-absent.
  Verify a few cues fire (combat, found, tech, wonder) and the Options mute
  row silences them.
- **Live-server instance reset** (TeleportAsync + reserved server) — not
  reachable in Studio (PlaceId 0); Studio verifies the soft path only.
- **Clipboard copy of the game code** — no clipboard API on Roblox;
  read/retype IS the accepted shape, not a gap.

## F. Findings routed (write down, do not fix during the sitting)

- **F1 — BUILT 2026-11-14, Studio look pending:** found-city name prompt
  (`FoundCity.luau` + `CityNames.luau`; server text filter in GameServer;
  check.sh gate 33). Verify at step 8.
- **F2 (from the 2026-08-05 publish screenshot, `roblox/debugging/roblox-screenshot-close.png`):**
  **world-space labels collide and become unreadable at close camera range.**
  At turn 288 with several cities in view, the city name/pop lines and the unit
  strength lines overlap into an unreadable block — "BANGALORE (pop 3)" runs
  through "Cavalry 2/1" and "Militia 1/1", and neighbouring `Settlers 0/1`
  labels merge. Repro: stand the avatar among 3+ adjacent cities at default
  camera height. It reads as a rendering fault rather than as density, which is
  the part that matters — this is a legibility defect, not a cosmetic one.
  Browser avoids it by drawing labels in screen space with collision handling.
  Routes to the docs/13 parity tiers; NOT a v1.0 gate (the Roblox client is a
  v1.x point release) but it is the first thing a new player sees.
  **BUILT 2026-11-14, Studio look pending:** `LabelDeclutter.luau` + a 0.2 s
  pass in ViewRenderer hide the lower-priority label of any colliding pair
  (city > selected unit > own unit > other unit; nearer wins a tie); check.sh
  gate 34. Verify with the same repro; tune `SLACK` / `textWidth` if labels
  hide while visibly clear of each other.
- **Look check (run-O + run-P, built unattended 2026-11-14 — first Studio
  look still owed).** After one Play Solo into a game, the agent reads
  `node roblox/tools/studio-log.js --diag`; the user only needs to play and
  screenshot. Expected in the log: `0 failure kind(s)`, `icons drawn N of N
  wanted`, no `overlap` / `off-screen` / `label clipped` / `MISSING` line.
  If `icon` FAILs with a permissions message: Game Settings → Security →
  "Allow Mesh / Image APIs". To look at (screenshots into
  `roblox/debugging/`): (a) top-row and action-bar buttons rounded,
  outlined, white pictograms, one evenly spaced top-right row with no gap
  where Ship is hidden, the clock left of it; (b) the tree and target
  buttons show an icon, not an emoji; (c) mountains are three-summit
  massifs with snow in ALL three looks, a unit on a mountain tile visible
  between the summits, mountain gold on a flank; hills are a low bare block
  (no shapes on top; coal and a mine stand on it in plain sight); (d) enhanced look only:
  sloped skirts toward lower neighbours with the outer corners filled
  (no square notch where two slopes meet), none toward unexplored tiles,
  none burying a road or unit; (e) panel close buttons red, Buy / START
  GAME green; (f) narrow the Studio window below ~1100 px: Options /
  Encyclopedia / Ship collapse to icon squares, nothing overlaps;
  (g) Options → world look enhanced → retro → enhanced: the depth haze
  comes back (it did not before run-P); (h) every action verb has an
  icon and a readable label, the bar sits between the bottom-left toggles
  and End Turn without touching either; (i) enhanced look: a sand rim on
  low coasts, none under cliffs or ice; forests are mixed spruce +
  round-crowned trees with trunks, tile centre open; (j) Studio device
  emulator on a phone preset: menus are five icon squares above End
  Turn, only applicable verbs show — then send the log, the overlap lines
  are the remaining phone work.
- Add sitting findings here as `F3, F4, …` with the step number and a
  one-line repro.
