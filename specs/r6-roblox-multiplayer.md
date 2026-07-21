# R6 — Roblox multiplayer seats (user-ruled 2026-07-21; Tier-3's substrate)

## The two rulings

1. **Per-platform populations in 1.0, bridge-compatible by design.** Roblox
   players play multiplayer INSIDE Roblox: a Roblox server instance runs the
   authoritative Luau engine (the twin — identical rules by the phase-5
   guarantee); browser players stay on Node/ws + the master index. No
   protocol bridging, no Roblox↔internet auth in 1.0. BUT the seat model
   below keeps the browser's seat-token CONCEPT intact underneath, so a
   post-1.0 cross-play bridge (plan-version2.md entry) is a transport
   problem, not a redesign.
2. **Seat identity = Roblox UserId.** Joining a game instance claims a seat
   by UserId; reconnection is automatic (the platform guarantees identity).
   No token typing on touch/gamepad. JOIN CODES survive with a narrower
   job: choosing WHICH lobby/game to enter (parity with the browser's
   5-letter codes, and they read well in Roblox social flows).

## Design shape (for the roblox lane to build against, docs/13 Tier-3)

- **Server authority**: the Roblox SERVER script owns game state and runs
  the Luau engine reducer — clients render views and submit commands,
  mirroring docs/06's authority split 1:1. filterView runs server-side
  (fog-honesty identical to `?server=1`).
- **Seat registry**: `seats[pid] = { userId, name, joinedAt }` — the
  UserId plays the role seat TOKENS play in docs/06. Internally keep a
  `seatCode` field beside it (generated, never surfaced in 1.0): that is
  the bridge-compatibility hook — a future bridge exports it as a browser
  seat token. Zero UI cost now.
- **Lobby flow**: instance owner hosts (Civ 1 setup panel per Tier-3);
  join code shown as today; a joining player picks an open seat → bound to
  UserId. Rejoin after disconnect: automatic re-bind on UserId match
  (docs/08 seat-grace semantics, platform-backed).
- **Regency + skip-vote**: the docs/08 machinery ports as-is (the §30
  auto-takeover host option included) — regents are engine-side and
  identical across platforms by the twin guarantee.
- **Spectators**: UserIds not holding seats = spectators if the host
  option allows (parity with --no-spectators).
- **Saves**: Roblox DataStore keyed by game id; the save FORMAT is the
  shared JSON shape (statehash-verified), so a Roblox save is inspectable
  by the same tooling (and a bridge could resume one on Node, later).
- **Master index**: Roblox discovery uses Roblox's own server browser in
  1.0 (platform-native); the QuakeWorld master stays browser-world. A
  post-1.0 bridge could announce Roblox instances to the master — shelf.

## Sequencing

Design-ready NOW (this file); build enters the roblox lane after Tier-1
core loop (its queue), targeting Tier-3 via R6 → seats → lobby → regency
port order. No engine/golden impact (Luau engine unchanged; this is
Roblox-side session/UI architecture). The reviewer's gate at build time:
authority split fidelity vs docs/06 (no client-trusted state).
