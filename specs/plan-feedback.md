# Designer ally — feedback on the phase 1/2 status update

*(received 2026-07-11, in response to plan-update.md; kept verbatim like the
other specs/ documents. Adopted items are tracked in docs/03-roadmap.md.)*

This is an **excellent Phase 1 status update**. It is specific, readable for
non-programmers, and—most importantly—the implementation order is sound.

The strongest parts:

- **Deterministic simulation + pinned replay hashes**: exactly the right
  foundation for networking and a later Luau port.
- **Hotseat before networking**: validates player identity, fog filtering,
  turn hand-off, and UX without transport/reconnect complexity.
- **Server-authoritative Phase 3 before LAN Phase 4**: correct order.
- **Art factory seam already in place**.
- **Clear player-facing feedback prompts**.

## Two wording improvements

1. Avoid "recreating Civilization" in the public description — prefer
   "a browser-based, turn-based 4X strategy game inspired by early
   civilization-building games" or "implementing classic early-4X mechanics
   through an original, deterministic simulation engine."
2. Avoid promising "line-for-line" Luau portability — JS/Luau differ
   (0- vs 1-based arrays, iteration order, numeric behavior, JSON null vs
   nil, key-order assumptions). Stronger: "built around a deterministic,
   data-oriented simulation architecture designed for a mechanical
   module-by-module port to Roblox Luau", and "recorded command replays will
   be run through both engines, comparing canonical state hashes after
   every turn."

## One critical Phase 2 requirement: a view projection boundary

Do not merely hide units visually. Add a formal simulation-to-view boundary:
createPlayerView(canonicalState, playerId) -> fog-filtered snapshot -> UI.
The view must EXCLUDE (not conceal): enemy units on hidden tiles; enemy city
production/population details/garrisons if not visible; unexplored terrain;
events outside the player's knowledge; AI internals; other players'
research, treasury, production.

Hotseat acceptance criterion: switching from Player A to Player B must never
allow B to recover A's hidden information through map memory, panels, logs,
keyboard shortcuts, dev tools, or retained UI state. (Canonical state living
in browser memory is acceptable for friendly local play, but the UI boundary
should behave as if it already received a server-filtered snapshot.)

## Phase 2 requirements table

| Area | Requirement |
|---|---|
| Player setup | Choose Human or AI for every civilization slot. |
| Hand-off | Full-screen overlay: "Pass device to [Civilization Name]." |
| Fog | Rebuild the displayed map only from the active player's view. |
| Logs | Filter events by player knowledge. |
| Save/load | Persist canonical state; restore the active-player hand-off flow. |
| AI | Summarized results rather than revealing hidden motion. |
| Input | Clear selection, hover, previews, panels at hand-off. |
| Testing | Test fog projection independently of rendering. |

Optional: an "AI turn fast-forward" toggle showing only player-knowable
outcome messages.

## Phase 3 recommendations

Make the contracts explicit now: client sends command envelopes only
({ commandId, gameId, playerId, type, payload }); the server authenticates,
validates, reduces canonical state, persists, creates player views,
broadcasts. Structured rejections ({ type: COMMAND_REJECTED, commandId,
code, message }) rather than silent failure. The client never
authoritatively resolves rules.

## Determinism checklist before the Roblox port

Engine-owned PRNG only; PRNG state in canonical state; never rely on JS
key iteration order; sort IDs where order matters; integer-only values;
exact rounding rules; canonical serialization order for hashing; exclude
cosmetic fields from the hash; no timestamps in simulation; versioned
replay format; cross-engine test vectors for rolls/mapgen/combat/movement/
production/research. Roblox Random.new(seed) must NOT be assumed to match —
port your own PRNG exactly in both languages.

## Small roadmap adjustment

Promote canonical serialization + state-hash specification into an explicit
deliverable ("Phase 2.5 — Determinism Contract"): canonical serializer
defined; hash algorithm documented; replay format versioned; RNG golden
vectors; player-view projection tests.

Suggested phase labels: 2 hotseat + player-view projections · 2.5
determinism contract + replay interoperability · 3 Node authoritative
server · 4 LAN + reconnection · 5 Luau port with replay conformance ·
6+ post-foundation systems.

## Additional hotseat playtest questions (keep the original ten)

1. At hand-off, did you ever see information you should not know?
2. Was it obvious whose turn it was and what to do?
3. Did hidden enemy movement feel fair rather than confusing?
4. Meeting another human, was the diplomacy/war state understandable?
5. Did fog-of-war make exploration and borders strategically interesting?
6. Did AI turns feel too slow, too opaque, or too revealing?
7. Could you resume a saved hotseat game without confusion?

Overall: the plan is credible and technically disciplined. The most valuable
next investment is the **player-view projection layer** and its automated
tests — the seam that makes hotseat, server multiplayer, and Roblox all fit
together cleanly.
