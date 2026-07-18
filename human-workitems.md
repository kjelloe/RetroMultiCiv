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
  _In flight:_ **marker-0063 (D3 AI diplomacy)** — a BEHAVIORAL window,
  now auto-progressing (phase-1 re-record done + audit-ledger + proofs
  passed; the sim-runner is running the constant sweep → phase-2 →
  marker-0063). No user action to get there — it's the next candidate
  once the sweep + phase-2 land.

- [x] **Gaming PC back online** — both sim-runner and roblox-helper
  recovered; the D3 sweep is resuming (marker-0063 auto-progressing again)
  and the Roblox run-F work is pushing again. No further action.

- [ ] **Forward the unit + building pedia-blurb request to the ally**
  (from your Roblox run-F item 9). Like the 68 tech blurbs, but a short
  blurb per UNIT and per BUILDING — what it is + a historical backdrop/
  fact. Original prose, cross-platform (browser pedia + Roblox), data
  separate from rules. I'll prepare the exact id list for the ally; this
  line is the reminder to relay it. Not blocking.

---

## PLAYTEST (high value right now)

- [ ] **Fresh LAN session on marker-0062+** — player-facing systems that
  no human has played: goody huts, caravan trade routes, unit upgrades,
  the debug panel (🐞), the spaceship screen, and the late-game save
  loading. A session field-tests them AND (with Shift+D recordings) seeds
  **benchmark corpus #2** (the primary AI metric). Try **Marathon mode**
  (the "play until victory" checkbox) if you want to see the late game.

- [x] **Mobile T0 — CLOSED.** You confirmed nav (direct + d-pad), zoom,
  screensaver-resume, and regency; the helper then verified select / move /
  production on touch (Pixel-5) and **fixed a real blocker** — the city
  panel didn't scroll at phone height, so most of the buildable catalog was
  unreachable (mobile production was broken). Fixed + regression-tested.
  Worth a confirming pass on your own phone, but no longer an open question.

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
- **World-look = ENHANCED** (your Roblox run-F item 4): resolves the
  standing world-look pick → enhanced is the default (retro stays a
  toggle). This UNBLOCKS the roblox lane's CP1 art pass. Your run-F
  feedback is triaged in `specs/roblox-runF-triage-2026-07-19.md` — most
  items are Roblox-only (roblox-helper owns them); the cross-platform ones
  (unit/building blurbs, city-name lists, era-based city looks) are routed.
- **Tech tree + beeline + glyphs SHIPPED** (XII.6, your request): a
  graphical 🌳 tech-tree (era columns, prerequisite edges, ✓/○/· states) in
  addition to the list, a **beeline** (click a distant tech → it auto-researches
  the path), and a procedural **icon per tech**. All golden-neutral client.
  The ally's 33 motif concepts are implemented and glyphs now show on all
  three surfaces (tree, discovery card, research readout) — **XII.6 is
  COMPLETE end-to-end.** (One glyph, horseback-riding, is flagged as an
  optional later tighten.)
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
- **D3 AI diplomacy — PHASE-1 DONE, sweeping** (marker-0063 auto-
  progressing): the AI negotiates (war/peace, met-state + first contact) —
  where your **mix-conditional elimination** and the **space-launch
  coalition** land. Both proofs passed; phase-1 re-recorded (~16 scenarios,
  audit ledger, JS==Luau). The sim-runner is running the constant sweep;
  then phase-2 re-record → marker-0063. No user action needed.
- **City-look-by-era SHIPPED** (your Roblox run-F item 8): city visuals now
  vary by ERA band (ancient thatch → classical stone+keep → industrial
  brick+smokestacks → modern/space glass+dome) composing with the size
  tiers, per the ally's editorial verdict (silhouette not recolor; owner
  color on the base ring). Render-only, fog-honest. Roblox uses the same
  shared band contract for its item-8 parity.
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
- **Server crash resilience — being built** (your request): crashes now
  get recorded to a `crashdumps/` file + stderr (stack + memory + per-game
  turn/unit counts), so next time you'll know if it was the node process
  and whether it was OOM. Plus an OOM memory-watchdog that autosaves +
  exits gracefully before V8's fatal OOM, and a `run.sh`/`run.ps1` restart
  loop that auto-restarts on crash (games resume from per-command autosave).
  This ALSO disambiguates the turn-2623 mystery: an OOM leaves an oom-dump;
  the event-loop-block (ws-timeout, below) leaves the process alive with no
  dump. Routed to the server-robustness lane (#1752, spec written).
- **Late-game ws-timeout (turn 2623) — being triaged:** your very-long
  hosted game dropped the socket. Diagnosed as SERVER-side (the client was
  reconnecting correctly; the server wasn't completing the handshake) — at
  that extreme scale a single AI turn-chain blocks the server's event loop
  past the heartbeat window. Routed to the server-robustness lane (#1732);
  a busy-tolerant heartbeat + yielding within the AI chain are the fixes.
  Beyond the validated scale (turn-1617), so it's a real hosting-robustness
  item, not a regression. If you can, note whether the `node` process was
  still alive or had exited when it happened.
- **Roblox run-F items in progress:** most are roblox-helper's (panels,
  tile improvements, debug/DataStore config, the city-name render fix);
  city-look-by-era (item 8) SHIPPED on the browser (see FYI), the shared
  contract is ready for the Roblox port; city-name lists get expanded (in
  the queued data window); the unit/building blurbs await your ally forward
  (Decide/Do). No input needed beyond that forward.
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
