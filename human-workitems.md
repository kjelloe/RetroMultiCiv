# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`.

---

## DECIDE / DO (needs you)

- [ ] **Merge the latest consistent marker.** Current candidate:
  **marker-0058** (goody huts + leader ransom, N12 debug commands,
  N11 upgrades+Leonardo, N10 caravans, the seam bundle, B28). Note:
  **marker-0059 (N9b build-priority) is imminent** — it's in its
  two-phase close (constant sweep running); once tagged it will be
  the merge candidate. Merge whichever marker I last declare
  consistent.

- [ ] **Send the designer-ally cover note** —
  `specs/ally-cover-note-2026-07-17-evening.md`. THREE asks: 68
  original tech-discovery blurbs (any subset useful — the
  discovery-card blurb slots sit empty on BOTH browser and Roblox
  until these land), a Civ1 substitute for Sun Tzu's War Academy in
  the leader table (it's Civ2), and the small pedia flags
  (movement/regency concepts, the Oracle ×4 stacking question).

- [ ] **World-look pick (a/b/c)** — a Roblox session: Options → world
  look → flip retro/enhanced live → screenshot both → pick
  retro-faithful / enhanced / enhanced-with-notes. Blocks nothing
  today (building continues behind the toggle) but sets the DEFAULT
  and orders the visual-fidelity backlog (docs/13). This also gates
  the roblox lane's CP1 art pass.

---

## PLAYTEST (high value right now)

- [ ] **Fresh LAN session on marker-0058+** — five player-facing
  systems shipped tonight with NO human having played them: goody
  huts, caravan trade routes, unit upgrades, the debug panel (🐞), and
  the spaceship screen. A session field-tests all five AND (with
  Shift+D recordings) seeds **benchmark corpus #2** (the primary AI
  metric). Try **Marathon mode** (the new "play until victory"
  checkbox) if you want to see the late game.

- [ ] **Mobile render check (T0) — fold into the playtest.** From your
  phone: does the world render at all / rough fps while panning /
  first 2-3 broken things. That's the only open mobile question — the
  network drop-out blocker is fully fixed (see FYI). Decides whether
  single-player mobile needs a perf pass.

- [ ] **Roblox acceptance (carried):** save `roblox/acceptance/runD.txt`
  and retest the deck-resident avatar flow.

---

## FYI — recently shipped / resolved (no action)

- **Mobile network fix COMPLETE** (heartbeat + lobby seat-grace +
  client wake-reconnect): a briefly screen-locked phone now reconnects
  and keeps its LAN seat. This was the "phone stranded in the lobby"
  failure from your last LAN test.
- **Ending-#4 space victory — corrected framing:** measured at 750
  turns, longer-horizon games reach space-flight TECH (~t581-711) but
  the AI never BUILDS Apollo (0/4 seeds). So the space *victory* needs
  N9b's builder-wonder-drive (in flight, sweeping now) — the
  longer-horizon ruling stands, the wonder-drive is the launch half.
  A marathon re-run at N9b's tuned constants is the proof.
- **N11 provenance:** shipped as labeled imports (Leonardo = Civ2,
  manual upgrade = Civ3-shape) under your civ-mixing ruling. No
  objection needed; done.
- **Server hardening COMPLETE** (the docs/17 plan): command budget,
  malformed-frame crash guard, per-IP connect-rate, Origin/static
  headers, backpressure, graceful shutdown. A v1 security posture
  re-assessment + operator quick-card ("safe to expose publicly?") is
  the hardening lane's next deliverable.

---

## Parked / future (not now, but on record)

- **Global "find a game" + internet hosting** (A51 master-index):
  the LAN-local find-a-game works; the public master index is gated
  on you scheduling DNS / a VM (docs/12).
- **16+ civ roster:** cap ships at 14 (A38); going past it is a
  deliberate future scope decision.
- **Phase-6 diplomacy** (D1-D2): war/peace + treaties, pre-ruled
  defaults on record (docs/14); the architect writes the spec next to
  keep the engine pipeline fed — no input needed until it lands.
- **Live strategic overlay** (🧠 per-AI stance/mode panel): SHIPPED,
  debug/spectator-gated — makes the heterogeneous-AI work visible if
  you want to watch it during a spectate.
