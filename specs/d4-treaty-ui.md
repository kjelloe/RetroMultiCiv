# D4 human-treaty UI (client half) — envoy-modal reuse (ruled 2026-07-24)

The client shape for HUMAN treaties in LAN games, settled before the
D4 engine window opens so the helper window is turnkey. RULED: reuse
the shipped envoy-modal pattern — no new negotiation screen in v1
(the Civ1 audience screen stays on the v2 shelf).

## Outbound (proposing)

- The diplomacy panel's per-civ row gains a **Propose…** button when
  the target is met and the D4 engine terms allow it.
- Propose opens a small chooser (the discovery-card frame idiom):
  the legal D4 terms as buttons — **Peace / Ceasefire / Tribute
  (gold amount stepper) / Tech swap (two pickers, own-offer +
  requested)** — exactly the engine's parley command surface, no
  client-invented terms.
- Sending issues the normal D4 command over the socket (session.apply
  path; off-turn queuing composes via the shipped §31 machinery).

## Inbound (receiving)

- An incoming human offer arrives as the EXISTING envoy blocking
  modal (emblem + name + terms rendered from the event payload):
  Accept / Reject / Consider-later, Esc = later, persists — identical
  to the AI-offer flow the users already know. One modal, both
  senders.

## Rules of the shape

- Fog-honest: only known civs, only terms the engine validates; the
  client never computes treaty legality (server/engine rejects are
  surfaced via the standard reject toast).
- Regency: a regent never auto-accepts a human offer — offers wait
  for the human's return (compose with the rejoin/wait machinery);
  the engine timeout default (docs/14) applies.
- Roblox parity: the same event payloads drive the Roblox port's
  modal (its runI batch already mirrors the envoy modal) — no new
  contract.

## Build routing

Helper item, queued durable, GATED on the D4 engine slice landing
(the engine payload shapes freeze then). Estimated small: chooser +
stepper + two pickers on existing frames + tests (mock-WS pattern
from §31). Golden-neutral.
