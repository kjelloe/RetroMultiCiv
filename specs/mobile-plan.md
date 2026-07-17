# Mobile plan: phone-playable client without touching the desktop experience

Advisory write-up from the reviewer. Prior art: the PARKED/GAME-V2
"Mobile-friendly UI/UX" item (user note 2026-07-14, agent-workitems.md) —
same client codebase, CSS + input-mode switches, no fork. This plan tiers
that item so T0 can run today and each later tier is an independent,
client-only, golden-neutral slice. The desktop path is protected by
construction: every change is gated by input-capability detection
(`pointer: coarse` media query / touch presence) or small-viewport media
queries, and the existing nightly UI lane keeps the desktop layout pinned.

## T0 — establish the facts (no code, ~an hour, user-runnable)

Goal: learn whether the current client already boots and renders on a real
phone, before designing anything.

1. Serve the repo on the LAN as usual (`./run.sh` or the python one-liner)
   and open `http://<dev-pc-ip>:8123/client/?seed=1` from a phone on the
   same network. run.sh already prints the WSL port-forward guidance.
2. What to look for, in order:
   - Does the WebGL context come up? (three.js r162 auto-falls back to
     WebGL1; modern iOS Safari / Android Chrome are WebGL2 anyway, so this
     should pass. `?diag=1` shows the capability probe.)
   - Frame rate while panning (the scene is low-poly; expect fine, but this
     is the measurement that decides whether T1 needs a DPR cap).
   - What is usable TODAY with single-finger mouse-emulation taps, and what
     is dead (expected dead: anything hover-dependent — combat odds, move
     hints; expected awkward: panel layout in portrait, small hit targets).
3. Record: device, browser, WebGL1-or-2, fps feel, first three blockers.
   That list is the T1 acceptance basis.
4. Optional CI hook (one small test, can come with T1 instead): a Playwright
   mobile-viewport + touch-emulation smoke in the nightly test-ui/ lane —
   boots the client at 390x844, taps a tile, asserts the HUD updated. From
   then on mobile facts accumulate nightly and desktop stays pinned by the
   existing tests.

## T1 — playable: input layer (directly after T0; independent of T2)

T1 is implementable immediately after T0 — it does not depend on any layout
work. It is confined to the input path (ui/input.js + the renderer's
pointer handling in client/renderer/three/), which is why it is small:

- Unify on Pointer Events (main.js already dispatches PointerEvents in its
  scripted paths; real handlers that still listen to mouse events move to
  pointerdown/up/move — one mechanical pass, desktop behavior identical).
- Tap = pick (already nearly true once pointer-unified), two-finger
  pan + pinch zoom on the canvas (renderer camera already exposes
  setZoom/centerOn; the gesture just drives them), `touch-action: none` on
  the canvas so the browser doesn't consume the gestures.
- Long-press = hover surrogate: after ~350 ms press-and-hold, synthesize the
  hover pick (combat odds, tile readout, move hints). docs/13 already chose
  long-press for Roblox touch, so the interaction language stays consistent
  across clients.
- DPR cap (renderer.setPixelRatio(min(devicePixelRatio, 2))) if and only if
  T0 measured jank.

Exit criteria: on a phone, a full local game turn is possible — select,
move, attack (odds via long-press), open a city, change production, end
turn. Desktop unchanged (nightly UI lane green, gallery/splash goldens
byte-identical — input code does not touch render output).

Size: the smallest real tier. All golden-neutral.

## T2 — comfortable: portrait layout (the larger pass; after T1)

T2 is deliberately separate because it is WIDER, not harder: it touches most
ui/ modules' CSS and some DOM structure, and needs visual QA on two form
factors. Content:

- Small-viewport media queries: the left HUD stack collapses to a top strip;
  panels (city view, research, stack) become full-screen sheets with a close
  affordance instead of floating windows; turn log collapses to a badge.
- An action strip for the selected unit's orders (the roblox lane's run-4
  action strip is the model — same concept, DOM version), replacing
  keyboard-first orders on touch.
- Hit-target pass: 44 px minimum on touch, spacing on end-turn/next-unit.
- Hotseat hand-off cover and setup screen at portrait widths.

Exit criteria: comfortable portrait play; desktop layout pixel-unchanged at
desktop widths (media-query gated), nightly lane green.

Size: the biggest tier — mostly CSS/layout volume + QA, low logic risk.
Golden-neutral throughout.

## T3 — polish (optional, later)

- PWA manifest + icon for home-screen install (server games need the network
  anyway; no offline ambition beyond the static shell).
- Pairs with AI regency (A40) for the check-in-from-a-phone flow the parked
  item describes: open the game, make the key decisions, let the regent
  handle the rest.
- Audio: mobile autoplay policies require the first synth cue to follow a
  user gesture — one-line unlock on first tap.

## Sequencing summary

T0 (facts, today) → T1 (input, small, directly after — no dependency on
layout) → T2 (layout, the wide pass) → T3 (polish, opportunistic). Each tier
ships alone, labelled golden-neutral, and none opens an engine golden window.
The mobile item stays parked until the architect queues it; T0 requires no
unparking since it changes nothing.
