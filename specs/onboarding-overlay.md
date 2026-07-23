# First-timer onboarding overlay (user + friend playtest feedback, 2026-07-24)

A friend's first session: did not understand the AI-regency button.
Fix: a one-time CARTOONY-ARROW overlay pointing at the main controls,
on TWO screens. Helper lane, golden-neutral, no assets (procedural
SVG/CSS arrows — hand-drawn wobble style, label text on each arrow).

## Where and what

1. **Host/setup screen overlay** — arrows to the main choices (start a
   game, host/join LAN, Find game, the resume card when present).
2. **First in-game screen overlay** — shown once when a player's first
   game boots:
   - BIG arrows: Research · Government · unit actions bar ·
     end-of-turn (the mini button) · **AI regency** (caption must
     EXPLAIN it: "AI plays your turns while you're away — click to
     hand over / take back").
   - SMALL arrows: Options · Civilopedia · Foreign relations ·
     Controls · Turn log.

## Behavior

- One-time per browser: `rmc_onboarding_seen` in localStorage (per
  screen); dismiss on any click / Esc; a small "?" in Options re-shows
  it on demand.
- Overlay is a transparent full-screen layer ABOVE the HUD (no layout
  reflow — the rejoin-banner lesson); arrows anchor to the live button
  positions (getBoundingClientRect at show-time; re-anchor on resize).
- Composes with the advisor cards (the advisor says WHAT to do; this
  overlay says WHERE things are) — do not merge the systems.
- Also: give the AI-regency button itself a plain tooltip
  (title text) with the same one-line explanation, permanent.
- Roblox parity note: the Roblox port gets its own equivalent later
  (queue to roblox-helper after the runI batch; same two-screen shape).

## Verification

Browser test: overlay renders on a fresh profile, localStorage
suppresses on second boot, "?" re-shows; screenshot both overlays for
the user's acceptance.
