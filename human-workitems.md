# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-18._

---

## DECIDE / DO (needs you)

- [ ] **Merge the latest consistent marker.** Current candidate:
  **marker-0062** (late-game save loading — your hosted-game
  `retromulticiv-server-save` now loads in the browser client, the map
  recenters on load instead of rendering blank, and a solo "continue my
  hosted game" no longer hands off to a dead player; golden-neutral,
  driven red-first by your real turn-1617 save). Supersedes **marker-0061**
  (A59 leader personality — every civ gets a leader + 4-axis personality,
  the diplomacy-AI foundation; golden-neutral), 0060 (D1 diplomacy),
  0059 (N9b wonder-drive), 0058, and everything since. Merging is your
  GREEN LIGHT for the mobile + LAN testing round.
  _In flight:_ **marker-0063 (D3 AI diplomacy)** — a BEHAVIORAL window
  (code done, mid re-record); it will be the next candidate when green.

- [ ] **Resume the bugfixer session to finish D3.** D3's code and both
  verification proofs are done; the session was paused mid-re-record at the
  operator's request. On resume it bakes the ~19-scenario re-record + hands
  the sweep to the sim-runner → **marker-0063**. This is the only gate left
  on D3 (nothing's broken — it's staged).

- [ ] **Forward the tech-glyph motif request to the ally** —
  `specs/ally-glyph-request-2026-07-19.md`. The 68 tech icons are built and
  live in the new tech-tree; ~32 of them are provisional (money/atomic/civic
  symbol collisions + abstract techs) and want a one-line motif concept each
  from the ally (parallel to the blurbs). Not blocking — provisional glyphs
  ship meanwhile; the ally's concepts refine them + unlock wiring the
  discovery card + research readout. Review the current set at
  `debugging/glyph-sheet.html`.

- [ ] **World-look pick (a/b/c)** — a Roblox session: Options → world
  look → flip retro/enhanced live → screenshot both → pick
  retro-faithful / enhanced / enhanced-with-notes. Blocks nothing
  today (building continues behind the toggle) but sets the DEFAULT
  and orders the visual-fidelity backlog (docs/13). **This is the one
  thing gating the roblox lane** (its CP1 art pass waits on it).

---

## PLAYTEST (high value right now)

- [ ] **Fresh LAN session on marker-0062+** — player-facing systems that
  no human has played: goody huts, caravan trade routes, unit upgrades,
  the debug panel (🐞), the spaceship screen, and the late-game save
  loading. A session field-tests them AND (with Shift+D recordings) seeds
  **benchmark corpus #2** (the primary AI metric). Try **Marathon mode**
  (the "play until victory" checkbox) if you want to see the late game.

- [ ] **Mobile render check (T0) — fold into the playtest.** From your
  phone: does the world render at all / rough fps while panning /
  first 2-3 broken things. That's the only open mobile *render* question —
  the network drop-out blocker is fully fixed (see FYI). Decides whether
  single-player mobile needs a perf pass.

- [ ] **Mobile seated-start RE-TEST (X.6 follow-up).** The hang you saw
  (phone joined lobby + chatted, but game START showed nothing; spectator
  worked) did NOT reproduce on an active connection — it's the mobile
  socket-drop class, and the fixes for it (heartbeat + lobby seat-grace +
  wake-reconnect, Part A+B+C) shipped AFTER your ~00:00 playtest. Please
  re-test on your phone. If it STILL hangs at start, add `&mlog=1` (the
  overlay now survives the lobby→game reload on its own) and the on-screen
  log will capture exactly where — send me that. One known residual to
  watch: if the phone is fully asleep at the *instant* of Start (past the
  ~45s reclaim), it should land on the "you missed the start" truth screen,
  NOT a blank — flag if it's blank.

- [ ] **Roblox acceptance (carried):** save `roblox/acceptance/runD.txt`
  and retest the deck-resident avatar flow.

---

## FYI — recently shipped / resolved (no action)

- **Designer-ally cover note ANSWERED** — the ally delivered all of it: the
  **68 original tech-discovery blurbs** (the empty discovery-card slots on
  browser + Roblox), the **Movement + Regency + Recordings** pedia concepts,
  ratified the **Oracle ×4** as Civ1-authentic (with a legibility ask), and
  chose **The Colossus** as Caesar's favorite wonder (Great Wall stays
  Frederick's). Now being wired in: client copy → helper (#1711),
  Caesar→Colossus + a `railroad` name fix → engine lane (#1712). Full copy
  captured in `specs/ally-deliverables-2026-07-18.md`. Also ratified the
  provenance-label table and the "personality supplies a preference; the
  world supplies permission" aggression principle.
- **Tech tree + beeline + glyphs SHIPPED** (XII.6, your request): a
  graphical 🌳 tech-tree (era columns, prerequisite edges, ✓/○/· states) in
  addition to the list, a **beeline** (click a distant tech → it auto-researches
  the path), and a procedural **icon per tech**. All golden-neutral client.
  ~32 glyphs are provisional pending the ally motif pass (see Decide/Do).
- **The 68 tech-discovery blurbs SHIPPED** (ally-authored): the empty
  discovery-card slots are filled on browser AND Roblox (parity self-test
  green). Plus the Movement/Regency/Recordings pedia concepts and the
  Oracle ×4 legibility (the happiness breakdown now reads `Temple +4`).
- **A59 leader personality SHIPPED** (marker-0061): every civ gets a
  leader + a 4-axis personality (aggression/science/growth/defense) — the
  data foundation the diplomacy AI reads. Golden-neutral in behaviour.
- **Late-game save loading SHIPPED** (marker-0062): load a hosted-game
  save in the client, camera recenters on load, dead human seats collapse
  to AI. Driven red-first by your real turn-1617 save.
- **D3 AI diplomacy — CODE DONE, PAUSED** (marker-0063 pending your
  resume): the AI negotiates (war/peace, met-state + first contact) — where
  your **mix-conditional elimination** (elim rate = f(leader mix)) and the
  **space-launch coalition** land. Code + both my required proofs passed;
  the bugfixer session was paused mid-re-record at the operator's request.
  Resumes the final re-record + sim-runner sweep → marker-0063 **when you
  restart that session** (see Decide/Do — the one gate left on D3).
- **Server hardening COMPLETE + hardened further**: docs/17 plan + the v1
  safe-to-expose posture, plus added limits.js unit coverage and an
  X-Frame-Options anti-clickjacking header. Safe on a small public VM with
  the docs/16 §4 operator checklist.
- **Mobile network fix COMPLETE** (heartbeat + lobby seat-grace + client
  wake-reconnect): a briefly screen-locked phone reconnects and keeps its
  LAN seat. This was the "phone stranded in the lobby" failure.
- **N9b wonder-drive SHIPPED + validated** (marker-0059): builder capitals
  commit to wonders (minority, no monopoly). The launch half of ending-#4.

---

## Parked / future (on record, mostly no input needed)

- **XII.5 — AI/regency late-game victory drive** (your long-game feedback):
  the regent going "nothing to do" in the end-game is captured — a
  personality-selected drive (aggressive→conquest with weakest/closest
  targeting; science/builder→space) so a late-game seat never idles.
  Specced (specs/xii5-ai-victory-drive.md), queued after D3; a baseline
  measurement is running. No input needed unless you want the regent to
  "win by any means" instead of by its civ's personality.
- **XII.2 — Future Tech N** (your refinement): a repeatable score sink once
  the tree is exhausted, Civ1-authentic. Specced, queued after D3.
- **Phase-6 diplomacy D4–D6:** D1 shipped, D3 in build; D4 (tribute + tech
  terms), D5 (reputation + senate), D6 (embassies) follow. Pre-ruled
  defaults on record (docs/14) — no input needed until they land.
- **Global "find a game" + internet hosting** (A51 master-index): the
  LAN-local find-a-game works; the public master index is gated on you
  scheduling DNS / a VM (docs/12).
- **16+ civ roster:** cap ships at 14 (A38); going past it is a deliberate
  future scope decision.
- **Live strategic overlay** (🧠 per-AI stance/mode panel): SHIPPED,
  debug/spectator-gated — makes the heterogeneous-AI work visible during a
  spectate.
