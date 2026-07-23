# Roblox intro animation — "One City Through Time" (user feature 2026-07-25)

Roblox-only, near-v1-for-Roblox (NOT a browser/mobile v1 item). A
~25s staged intro played before the lobby, skippable always. Design
ruled by the architect from the user's two proposals (time-traversal
→ nuke; rocket → blast): keep the era arc AND the rocket-brightening
finale, but END ON THE LAUNCH, not destruction — the game's identity
is the historical arc ("A World Begun"; the ally's release copy), and
the space launch is the aspiration the intro should plant. War
appears as a MIDDLE chapter, never the conclusion.

## The sequence (~25 s total; every beat skippable)

1. **The empty world** (~4 s): the terrain diorama under a slow
   camera drift — coast, forest, a special resource glinting (the
   motif assets). No UI.
2. **The founding** (~4 s): a lone Settler part-figure walks in,
   plants the first city (ancient tier appears with the founding
   puff). Title card fades in over it — see the TITLE rule below.
3. **The arc** (~10 s): ONE continuous slow orbit of that city while
   it advances through the four era bands (ancient →
   classical/medieval → industrial → modern/space — the existing
   city-tier visuals), era units marching past in sequence (militia →
   legion → knights → musketeers → riflemen → tank), one wonder
   rising beside it, and ONE brief battle beat mid-arc (two unit
   groups clash at the edge of frame, a city changes owner-color) —
   war as a chapter of history.
4. **The launch** (~5 s): the space rocket ignites and LIFTS OFF from
   the city; exhaust glow floods the frame, screen brightens to
   white (the user's brightening beat, recast as launch) →
5. **Fade** (~2 s): white → the lobby/menu, already composed (the
   browser boot-fade idiom: never reveal scaffolding).

## Rules

- **SKIP button, lower-right** (user-specified), visible from frame
  one, instant (→ step 5's fade, shortened). Gamepad/touch reachable.
- **Auto-skip for returning players**: a seen-flag (DataStore when
  available, else session attribute); Options gains "▶ Replay intro".
  First-time default = play.
- **Assets: existing only.** Everything comes from TileProps /
  city-tier / wonder / unit part-recipes already mirrored to Roblox.
  No new art, no uploaded video/images — a staged scene + camera
  script (TweenService), fully procedural. If a beat needs an asset
  we don't have, cut the beat, don't invent art.
- **TITLE CARD IS SWAPPABLE**: naming is pending the professional
  trademark search — ship with the working title text (or no text,
  just the founding beat) behind ONE constant; swapping to "A World
  Begun" later is a one-string change. Never bake the candidate title
  into imagery.
- **Sound**: ride the provisional SoundId worksheet (an intro cue row
  is welcome) — sound remains Studio-gated; the animation must work
  silent.
- **No engine involvement**: the scene is hand-staged parts, NOT a
  simulated game (no RNG, no state) — golden-neutral by construction,
  deterministic by being scripted.
- **Never blocks multiplayer**: joining a specific game (deep-link /
  invite) skips the intro entirely.

## Verification

Studio screencap of each beat for the user's acceptance session
(rides the existing publish-gate session); SKIP works from every
beat; returning-player auto-skip verified; a slow-device check (the
scene must be lightweight — one city, ~8 units, one rocket).

## Not in scope

Browser/mobile intro (v2 shelf if ever); narrative voice-over; any
destruction finale (explicitly ruled out — the nuke reading conflicts
with the title identity and the Roblox audience posture).
