# Onboarding advisor — event hint cards (user-ruled shape, 2026-07-20/21)

Ruling: the 1.0-required onboarding advisor is **contextual, dismissible
hint cards fired by first-time events**, each linking into the pedia.
Rejected shapes (recorded): persistent checklist panel; on-demand
state-inspecting council (→ v2 candidate pool if ever wanted).

## Shape

- A card appears once per TRIGGER per profile (localStorage seen-list, like
  the E-hint mute; never in game state — golden-neutral by construction).
- Card = advisor line (ally-written copy, friendly voice) + "Tell me more"
  (opens the relevant pedia article via the existing pedia/hover-card
  machinery) + "Got it" (dismiss). An ⚙ Options toggle "Show advisor hints"
  (default ON) + "Reset hints".
- Client-only; renders through the discovery-card/hover-card component
  family being built in XIV §22/§26 — build AFTER those land so it reuses,
  not duplicates.

## Trigger list (v1 — ~15 first-time events; the enumerated contract)

1. First city founded (work tiles, defender-before-second-settler)
2. First unit produced / build queue opened
3. Research idle (no current research 2+ turns)
4. First contact with a rival civ
5. First war declared on you / by you
6. First civil disorder (tax/luxury/temple remedies)
7. First city growth stall (food, granary)
8. First naval unit (transport basics; trireme coastal warning — pairs
   with naval-truth when it lands)
9. First goody hut sighted
10. First barbarian sighting
11. First wonder available to build
12. First government unlocked beyond Despotism (revolution how-to)
13. First diplomacy audience (D-line dependent; card ships dormant until
    the diplomacy UI path exists on the surface in play)
14. First pollution tile (A91-dependent, dormant until A91)
15. Endgame approach (endYear minus ~30 turns: victory conditions pointer)

Trigger detection reads state transitions client-side (session.onChange
diffing), never engine hooks — zero engine footprint.

## Copy

The ally writes the 15 card texts once the trigger list is confirmed —
relay ask AFTER the XIV hover/discovery components land so the visual
frame is real. Card copy ≤ 40 words each, pedia link carries the depth.

## Routing

helper queue (golden-neutral client), sequenced after the XIV hover-info +
discovery-overlay items (component reuse). Roblox parity: docs/13 Tier-2
addendum later (same trigger contract, Roblox-native cards).
