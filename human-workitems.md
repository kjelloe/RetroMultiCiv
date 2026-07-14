# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-14 — completed items moved to
the Done log at the bottom.

## Pending — verify in real play

- [ ] **Next LAN session verification list** (everything landed since
  the 07-14 acceptance test): lobby **chat** (host toggle on/off live),
  **kick** and **kick-and-block** (block is per-IP — on one machine via
  localhost it blocks everyone; test from two machines), the 14-seat
  lobby + seat picker, log filters, city name pills + tier looks,
  animations feel (`?anim` default on), and the noticeably **stronger
  normal-difficulty AI** (median 18 cities on soak — does a normal game
  still feel fair?).
- [ ] **Feel-test backlog** (largely exercised by the 2026-07-14
  acceptance session — tick whatever you consider covered): waves
  III/IV polish (battle linger, centered mini-map + real center
  yields, per-player hand-off landing, C-to-capital, one-tech-ahead
  catalog, hover move arrow, Civ-style calendar pacing to ~turn 395,
  starting-age fast-forward + its 10–20s wait on big maps).
- [ ] **End Turn latency late-game** (standing): if End Turn stalls
  noticeably vs a big AI (10–24 cities on some seeds), report turn
  number + Shift+D file.
- [ ] **Ally round-4 playtest checks** (his two non-automatable
  follow-ups, next session): (a) can the water highlights ever be
  mistaken for rails, GoTo routes, or grid seams in ordinary play?
  (his rule: water soft/broken/low-contrast; rails dark crisp
  land-bound; routes player-colored and unmistakable); (b) do city
  population badges become visually dominant at normal zoom in dense
  late games? (his suggestion if so: fade when zoomed out, or show
  only own/selected/hovered).

## Pending — decisions / ops

- [ ] **Pull on the Roblox PC**: the 611499b→HEAD pushes carry the B10
  item text, docs/09 P5-3 trap block, and the R4 visibility
  requirement — the roblox-helper's mail/locks flow live over the hub,
  but doc/queue text travels by git.
- [ ] **Glance at the first nightly with the lune step** (Actions tab,
  after tonight's 03:00 run or a manual dispatch): the suite job now
  installs lune v0.10.5, so the Luau twin gates run in CI for the
  first time instead of self-skipping.
- [ ] **Next commit checkpoint**: when B10 (scenario re-pin), A34
  (lobby resume), and R3 (Studio camera/selection) land reviewed —
  I'll suggest the one-liner as usual.
- [ ] **Hub IP-drift note (standing ops)**: this PC was .116 during
  the LAN test, is .112 now — DHCP moves it. If the hub stops
  answering after a reboot: re-check `ipconfig`, update the one-line
  `.agent-mail/remote` file on the Roblox PC (or reserve this PC's IP
  in the router / use the Windows hostname instead).

## Later (not yet actionable)

- [ ] **Global "find a game" + internet hosting**: LAN-local listing
  is now underway as A41 (helper queue, after A34). The INTERNET
  half stays parked: your Hetzner recipe is stored verbatim in
  `ops/hosting-recipe.md` (gitignored); first stop needs zero code —
  DNS `retromulticiv.kjell.today` → your PC → existing join codes.
  Before real public exposure: the hardening bullet (rate limits,
  caps) becomes its own item.
- [ ] **16+ civs roster**: cap is shipped at 14 (A38); going past it
  waits on the Civ 2/3/4 roster adaptation (perks → our specialty
  schema) and new visual identities through the designer ally's
  acceptance loop.
- [ ] **Phase-6 acceptance criterion on record**: diplomacy legibility
  (phase-2 verdict question 4) — permanent war is the current rule;
  when diplomacy ships, it must be legible in play.

## Playtest findings inbox

(add bugs/refinements here or hand them over in chat as before — Shift+D
diagnostics files into `debugging/logs/` for anything that looks like an
engine issue; for `?server=1` games send `saves/<gameId>.json` instead)

- ✅ 2026-07-13 — Wave V (LAN playtest, g3 recording) RECEIVED and
  routed: bug 0 (research crash) = B3 with architect triage (engine
  innocent, replays hash-exact; a rival playerId reaches researchCost);
  items 1–7 = A22–A27 (routing redirects, hotseat checkbox, lobby civ
  assignment — g3 proved every LAN player has no civ —, banner
  dismiss/suppress, waiting-status + slow-poke log, lobby seat
  management). Per-slot difficulty parked in docs/04 (engine change,
  golden lock). Re-verify in the next LAN session once B3/A22/A24
  land.

## Done log

- ✅ 2026-07-14 — **Phase-5 launch COMPLETE, both machines**: Studio +
  Rojo + private Experience on the Roblox PC, lune on all three boxes,
  mail hub live cross-PC (port 8970 portproxy + firewall), roblox-helper
  AND sim-runner spawned and kit-validated. Results already banked:
  P5-1/2/3 done (Node ≡ lune ≡ Studio proven, ten-for-ten setup hashes,
  dispatcher + movement/visibility green cross-language), R1/R2 done
  (anchors + first Parts world in Studio).
- ✅ 2026-07-14 — **Phase-2 hotseat verdict delivered: ACCEPTED.** Ten
  original questions all good; hotseat 6/7 pass — question 4
  (diplomacy legibility) scoped to phase 6. Verdict recorded as a
  labeled appendix in `specs/phase2-assessment.md`. ALL phase gates
  through 4 now passed.
- ✅ 2026-07-14 — Queue decisions resolved: **big-lobby scaling GO**
  (A38 landed same day — measured probe, cap raised to 14, seat picker
  followed in A37) and **find-a-game v1 GO** (A41 queued after
  A34/A37 by design).
- ✅ 2026-07-14 — Nightly lune install done (workflow pins the v0.10.5
  release zip, suite job only; URL verified live).
- ✅ 2026-07-14 — Old recordings cleanup (pre-2026-07-12 files removed
  from `debugging/logs/`).
- ✅ 2026-07-14 — **ALLY LOOP COMPLETE, FULL SIGN-OFF RECEIVED**:
  round 4 approved A1.7 as the browser reference implementation,
  formally validated phases 2–4, blessed phase 5's continuation, and
  reviewed render-spec.json ("substantial success"). All his edits
  applied same-day; his 7 follow-ups routed (A44 + 2 playtest checks).

- ✅ 2026-07-14 — **PHASE 4 ACCEPTED**: two-machine LAN session (2
  humans + spectator + AI), survived BOTH tortures — network kill on
  the host PC AND a server-process kill with save-resume ("it
  worked!"). The turn-53 server save replays hash-exact (395 commands,
  105 rounds, 0xebaa99b1); game code CS3E-4SQN-TN6DH noted. Wave VI
  (14 refinements + 1 bug) filed from the same session — routed.
- ✅ 2026-07-13 — Commit checkpoint landed (8f674b9): wave IV complete
  (A16–A21), run scripts + fixes, sync passes #7/#8, 180-test baseline;
  the untracked-fastforward landmine confirmed defused (both files
  tracked).
- ✅ 2026-07-13 — 16+ civs decision: draw from Civ 2/3/4, adapt perks
  to the specialty schema (recorded in the parked scaling item).
- ✅ 2026-07-13 — Arctic poles decided + implemented: impassable ice wall
  (terrain domain `ice` via the mapdata overlay; unit test added;
  suite green with no golden movement).
- ✅ 2026-07-13 — dev merged to main; 3 AM nightly cron armed.
- ✅ 2026-07-13 — **AI happiness batch 4**: approved conditionally
  ("do it if it helps God-Emperor") → won at lab iteration 3 of 10
  (entertainers-on-disorder): GE stagnation 39%→3% confirmed on 25
  real seeds by the sim-runner; side effect = stronger normal AI.

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
