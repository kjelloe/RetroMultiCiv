# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-13 — completed items moved to
the Done log at the bottom.

## Pending — verify in real play

- [ ] **Phase-4 two-machine LAN acceptance** (ACTIONABLE — slices 1–3 +
  spectator mode code-complete, suite 170/170): `./run.sh` on one
  machine (it prints the WSL port-forward/firewall commands itself;
  or host natively on Windows with `.\run.ps1`); both browsers
  to `http://<host-ip>:8123/client/` → Host a LAN game on one, Join by
  the 5-char code on the other (pick a seat; your names should show in
  the waiting room), start, play a few turns. Then the roadmap
  acceptance: kill the at-turn player's browser mid-turn (⏳ waiting
  banner; try host-skip, and the propose/vote if you seat a third
  human), reconnect and continue; kill the SERVER mid-game,
  `./run.sh 8123 --game saves/<gameId>.json`, both rejoin. Also eyeball
  the 🔔 your-turn / ⏳ waiting / vote banners — integration-tested but
  not yet visually verified (A13's honest note). Ticking this = phase 4
  accepted. PRE-FLIGHT DONE (2026-07-13): a four-client end-to-end test
  now passes on localhost (create → join by code with a seat pick →
  named seats → full round in seat order → identical game codes on all
  four → per-seat fog) — multi-machine is now a networking exercise, not
  a software risk. The server now binds 0.0.0.0 (was loopback-only —
  found via your question!) and run.sh echoes the LAN URL. WSL2 hosts
  need the two PowerShell one-liners in gettingstarted §4 (portproxy +
  firewall). Optional while you're at it: a third browser can now join
  as a spectator (Spectate checkbox on the join form, or
  `?server=1&spectate=1` against a `./run.sh` boot game) — screenshot-
  verified headless, one human eyeball welcome.
- [ ] **Score & declare the phase-2 hotseat acceptance**: your turn-35
  hotseat session replayed hash-exact and produced wave III — what's
  left is the verdict: score it against the 10 questions in
  `specs/gameplay-reference.md`, the 7 hotseat questions in
  `specs/plan-feedback.md`, and the ally's comprehension question
  (did happiness/government/tax/workers feel understandable or like
  hidden bookkeeping?). Tick = phase 2 formally closed.
- [ ] **Wave-III fix verification** (next hotseat/solo session): GoTo now
  continues across hotseat hand-offs (the turn-35 bug); city squares act
  roaded+irrigated (watch your capital's yields — the food gain appears
  after leaving Despotism); starts spawn ≥3 tiles from the polar edges.
  A16 (accepted 2026-07-13) adds the client half — feel-test these too:
  the camera lingers on battles instead of jumping away, the city-view
  mini-map is centered and the center tile shows its real (roaded +
  irrigated) yields, hotseat hand-offs land each player on THEIR
  last-moved unit (else their capital), and **C** with nothing selected
  flies to your capital. Wave IV (accepted 2026-07-13): the build
  catalog hides items beyond one tech ahead (A18), hovering a
  neighboring tile shows a move arrow when the step is legal (A19),
  and the year now advances Civ-style (50yr ancient → 2yr modern;
  games run to ~turn 395 — watch late-game pacing). A20 (accepted
  2026-07-13): the setup screen offers a **starting age** (Ancient →
  Space Age) — the world fast-forwards under AI and every civ receives
  the prior eras' techs at takeover. Helper's timing note: Renaissance
  ≈3–5s on a small map; Modern/Space on bigger maps run ~10–20s behind
  the progress counter — feel it once before the LAN session. A
  Renaissance-start LAN game might be the most fun acceptance test.
- [ ] **End Turn latency late-game** (standing): if End Turn stalls
  noticeably vs a big AI (10–24 cities on some seeds), report turn
  number + Shift+D file.

## Pending — decisions / ops

- [ ] **Ally sign-off loop for A14/A15**: send him the exhibits —
  `debugging/gallery-factions-a14.png` (his own acceptance criteria from
  `specs/civ-visuals.md`) and `debugging/gallery-water-a15.png` — for
  design sign-off, plus the pending thank-you for authoring the table
  (`ally-reply-assets.md` has the broader asset-plan reply if not yet
  shared). His plan-update feedback (2026-07-13) is applied — the
  refreshed `plan-update.md` is ready to re-share.
- [ ] **Old recordings cleanup** (at leisure): everything in
  `debugging/logs/` predating 2026-07-12's engine changes no longer
  replays (expected — goldens re-recorded); the bugfixer has marked all
  six existing files pre-triaged. Delete when convenient.
- [ ] **Commit checkpoint**: A2/A21/A18/A19 are committed (fef7fae);
  the tree still carries the sync-pass-#7 doc updates (README 170,
  docs/03 phase-4 status, CLAUDE.md server flags/run scripts,
  gettingstarted spectate row) — small, safe to fold into the next
  commit.

## Later (not yet actionable)

- [ ] **Roblox/phase-5 setup**: Studio project, publishing, lune
  toolchain install for CI (approved 2026-07-12) — when the port starts.
- [x] 2026-07-13 — **AI happiness batch 4: approved conditionally**
  ("do it if it helps God-Emperor") — criterion + design sketch recorded
  in docs/04; architect's queue, golden lock required.

## Playtest findings inbox

(add bugs/refinements here or hand them over in chat as before — Shift+D
diagnostics files into `debugging/logs/` for anything that looks like an
engine issue; for `?server=1` games send `saves/<gameId>.json` instead)

## Done log

- ✅ 2026-07-13 — Arctic poles decided + implemented: impassable ice wall
  (terrain domain `ice` via the mapdata overlay; unit test added;
  suite green with no golden movement).
- ✅ 2026-07-13 — dev merged to main; 3 AM nightly cron armed.

- ✅ 2026-07-12 — Wave-II spot-check, combat-default preference
  (best-of-three stays), terrain look on real GPUs, AI settler re-route
  + military behavior checks (user cleared the batch).
- ✅ 2026-07-12 — Phase 3 accepted (20/67/112/120-turn socket games all
  replay hash-exact; resume + tamper-rejection verified).
- ✅ 2026-07-12 — First nightly run green (soak + suite, run 29208654981);
  telemetry pulled and scored.
- ✅ 2026-07-12 — Ally comms: asset-plan reply + terrain deviations +
  WebGL1 stance conveyed; ally authored the 14-civ table in response.
- ✅ 2026-07-12 — Hotseat playtest session run (turn 35, seed 12345,
  replayed hash-exact) → wave III filed; formal scoring still pending
  (see above).
