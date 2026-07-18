# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`.

---

## DECIDE / DO (needs you)

- [ ] **Merge the latest consistent marker.** Current candidate:
  **marker-0062** (late-game save loading — your hosted-game `retromulticiv-server-save` now loads in the browser client, the map recenters on load instead of rendering blank, and a solo "continue my hosted game" no longer hands off to a dead player; golden-neutral, driven red-first by your real turn-1617 save). Supersedes
  **marker-0061** (A59 leader personality — every civ gets a leader + 4-axis personality, the diplomacy-AI foundation; golden-neutral). Supersedes marker-0060 (D1 diplomacy — war/peace states + declare/offer/
  accept/reject + the combat reframe; golden-neutral, phase 6 opens).
  Supersedes 0059 (N9b build-priority + the builder wonder-drive —
  some civs commit to wonders), 0058 (goody huts + leader ransom, N12
  debug, N11 upgrades + Leonardo, N10 caravans), and everything since
  (mobile network fix COMPLETE, server hardening COMPLETE). Merging is
  your GREEN LIGHT for the mobile + LAN testing round.

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
- **D1 diplomacy SHIPPED** (marker-0060): war/peace states + the
  combat reframe, golden-neutral — phase 6 has opened. The D2 client
  (foreign-relations panel + treaty actions) auto-activates on the
  wire-up; D3 (AI negotiation) is now UNBLOCKED (A59 shipped marker-0061) —
  spec specs/d3-ai-diplomacy.md written, pre-open handed to the bugfixer. D3
  is where the AI actually negotiates AND where your mix-conditional
  elimination ruling lands (elim rate = f(leader mix); space launch → all-out
  war on the launcher's capital). Behavioral window — sim-runner sweep first.
- **N9b wonder-drive SHIPPED + validated** (marker-0059): builder
  capitals now commit to wonders (7/25 seeds, minority, no monopoly),
  frontier-safety holds. This is also the launch half of ending-#4 —
  a marathon at the shipped constants confirms Apollo.
- **Server hardening COMPLETE + certified** (docs/17 plan + the v1
  posture re-assessment): the server is **safe to expose on a small
  public VM** with the docs/16 §4 operator checklist.

---

## Parked / future (not now, but on record)

- **Global "find a game" + internet hosting** (A51 master-index):
  the LAN-local find-a-game works; the public master index is gated
  on you scheduling DNS / a VM (docs/12).
- **16+ civ roster:** cap ships at 14 (A38); going past it is a
  deliberate future scope decision.
- **Phase-6 diplomacy D2-D6:** D1 shipped (marker-0060); D2 (audience
  UI + human treaty UI) is the helper's next on the D1 wire-up; D3 (AI
  negotiation) needs A59 leader-attributes; D4-D6 follow. Pre-ruled
  defaults on record (docs/14) — no input needed until D2/D3 land.
- **Live strategic overlay** (🧠 per-AI stance/mode panel): SHIPPED,
  debug/spectator-gated — makes the heterogeneous-AI work visible if
  you want to watch it during a spectate.
