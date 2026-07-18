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

- **A59 leader personality SHIPPED** (marker-0061): every civ gets a
  leader + a 4-axis personality (aggression/science/growth/defense) — the
  data foundation the diplomacy AI reads. Golden-neutral in behaviour.
- **Late-game save loading SHIPPED** (marker-0062): load a hosted-game
  save in the client, camera recenters on load, dead human seats collapse
  to AI. Driven red-first by your real turn-1617 save.
- **D3 AI diplomacy — IN BUILD** (marker-0063 incoming): the AI now
  negotiates (war/peace, met-state + first contact), and this is where
  your **mix-conditional elimination** lands (elim rate = f(leader mix))
  plus the **space-launch coalition** (a launch turns the others toward
  the launcher's capital). Behavioral window — code done, in the two-phase
  golden re-record + a mix-conditional sim-runner sweep.
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
