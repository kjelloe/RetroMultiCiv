# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-13 — completed items moved to
the Done log at the bottom.

## Pending — verify in real play

- [ ] **Phase-4 two-machine LAN acceptance** (ACTIONABLE — slices 1–3
  code-complete, suite 159/159): `./run.sh` on one machine; both browsers
  to `http://<host-ip>:8123/client/` → Host a LAN game on one, Join by
  the 5-char code on the other (pick a seat; your names should show in
  the waiting room), start, play a few turns. Then the roadmap
  acceptance: kill the at-turn player's browser mid-turn (⏳ waiting
  banner; try host-skip, and the propose/vote if you seat a third
  human), reconnect and continue; kill the SERVER mid-game,
  `./run.sh 8123 --game saves/<gameId>.json`, both rejoin. Also eyeball
  the 🔔 your-turn / ⏳ waiting / vote banners — integration-tested but
  not yet visually verified (A13's honest note). Ticking this = phase 4
  accepted.
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
- [ ] **End Turn latency late-game** (standing): if End Turn stalls
  noticeably vs a big AI (10–24 cities on some seeds), report turn
  number + Shift+D file.

## Pending — decisions / ops

- [ ] **Merge `dev` → `main`**: both nightly runs went green from the
  `dev` branch via manual dispatch — but the 3 AM cron only arms once
  the workflow file lands on `main`. Merging also publishes phase 3+4,
  the game code, and the guards to the default branch.
- [ ] **Arctic poles: passable or wall?** (wave-III #5 follow-up):
  today's behavior is Civ 1-authentic — E-W wrap, hard N-S edges, and
  arctic cap rows that units CAN walk on. If you'd rather the poles be
  an impassable ice wall, it's a one-line data change — say the word.
- [ ] **Ally sign-off loop for A14** (after the helper lands it): send
  him the 14-civ gallery-row screenshots — his own acceptance criteria
  from `specs/civ-visuals.md` — for design sign-off, plus the pending
  thank-you for authoring the table (`ally-reply-assets.md` has the
  broader asset-plan reply if not yet shared).
- [ ] **Old recordings cleanup** (at leisure): everything in
  `debugging/logs/` predating 2026-07-12's engine changes no longer
  replays (expected — goldens re-recorded); the bugfixer has marked all
  six existing files pre-triaged. Delete when convenient.
- [ ] **Commit checkpoint**: the working tree carries A13 (lobby UI),
  wave III (engine + GoTo fix), the B-queue/A16/A17 items, docs/09, and
  the guards — a known-green 159-test baseline worth committing before
  the next batch lands.

## Later (not yet actionable)

- [ ] **Roblox/phase-5 setup**: Studio project, publishing, lune
  toolchain install for CI (approved 2026-07-12) — when the port starts.
- [ ] **AI happiness management verdict**: nightly God-Emperor telemetry
  shows the AI can't cope with contentCitizens 2 (47% stagnant) — decide
  eventually whether an "AI luxuries/entertainers" batch 4 is worth it
  or God-Emperor stays a humans-only difficulty.

## Playtest findings inbox

(add bugs/refinements here or hand them over in chat as before — Shift+D
diagnostics files into `debugging/logs/` for anything that looks like an
engine issue; for `?server=1` games send `saves/<gameId>.json` instead)

## Done log

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
