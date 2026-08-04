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

## Pre-sitting headless clears (already run by the roblox lane)

- `roblox/check.sh` ALL GREEN — 31 gates / 103 PASS assertions on tip
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
     (no seat auto-claim); NEW GAME and JOIN pads visible below the deck.
   - Likely wrong: a pad touch that answers with nothing — every pad touch
     must toast either an action or a reason.

4. **Host setup panel** — Tier 3 📷
   - Tap: the NEW GAME pad.
   - Expect: "New game (you are the host)" panel; segmented bars for map
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

8. **Found a city — NOTE: no name dialog on Roblox** — Tier 0/1 📷
   - Tap: `Found` on the action bar (or B).
   - Expect: city founded IMMEDIATELY, auto-named `Colony 1` — the Roblox
     client has NO name prompt (browser divergence, see Findings §F1);
     billboard appears with name + pop; settlers consumed; turn log gains
     the founding row.
   - Likely wrong: nothing blocks here by design — if a modal DOES appear,
     that is new/unexpected code. (On the browser this step traps
     automation in the name field; Roblox cannot reproduce that trap
     today because the dialog does not exist.)

9. **City panel** — Tier 0/2 📷
   - Tap: the city billboard.
   - Expect: panel with pop, food/shield/trade rows, worked tiles
     (single-tap toggles a worked tile), production picker with turn
     counts, buy button with cost, Close and Next-city side by side.
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
    - Expect: rows are class-coloured; filters hide/show classes; tapping
      a row centres the camera on its tile (centerOn — gates 28/29 pin
      the mirror).
    - Likely wrong: jump-to centring on the wrong tile after map wrap.

13. **Research + discovery moment** — Tier 1 📷
    - Tap: the research chip; pick a tech (or open the 🌳 tech tree and
      set a beeline goal); end turns until it lands.
    - Expect: picker lists techs with turn costs; on completion the
      DISCOVERY CARD presents the tech with its procedural glyph and
      blurb; dismiss returns play.
    - Likely wrong: the discovery card appearing during the AI round
      instead of at your turn start (event-order bug), or a glyph
      rendering as a blank frame.

14. **Options + pedia spot-check** — Tier 2
    - Tap: Options (sound/palette rows present); open the Gamepedia, one
      concept page and one unit page.
    - Expect: pedia text matches the browser wording (em-dash rendered as
      " - " on concepts); options toggle without error.
    - Likely wrong: a pedia page overflowing its frame with no scroll.

15. **Save code + soft reset** — Tier 3 (R10) 📷
    - Tap: read the game-code chip (HUD/options); host taps reset
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
| 05 | `05-city-founded.png` | Step 8 — billboard "Colony 1" |
| 06 | `06-city-panel.png` | Step 9 — full panel |
| 07 | `07-build-queue.png` | Step 10 — 2-item queue |
| 08 | `08-turn-log.png` | Step 12 — filtered log |
| 09 | `09-discovery-card.png` | Step 13 — card with glyph |
| 10 | `10-save-chip.png` | Step 15 — readable game code |
| 11 | `11-second-seat.png` | Step 16 — client B seated view |
| 12 | `12-endscreen.png` | Step 18 — itemized score, both clients |

## E. Known-unreachable / expected-absent (do not spend sitting time)

- **City NAME PROMPT and rename** — the browser founds via a name dialog;
  Roblox auto-names `Colony N` and has no rename surface. Finding §F1,
  routed to the architect (not fixable in this sitting).
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

- **F1 (pre-logged by this checklist):** found-city name-prompt parity —
  browser has a confirm-by-tap name dialog, Roblox auto-names with no
  prompt. Tier-1 row divergence; needs an architect route (dialog vs
  ruled-divergence note in docs/13).
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
- Add sitting findings here as `F3, F4, …` with the step number and a
  one-line repro.
