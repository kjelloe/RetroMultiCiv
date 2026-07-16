# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-14 — completed items moved to
the Done log at the bottom.

## Pending — verify in real play

- [ ] **Next LAN session verification list** (everything landed since
  the 07-14 acceptance test; two machines needed for the kick/block
  items):
  - [ ] Lobby **chat**: messages flow both ways; host toggles chat OFF
    live (joiner's panel hides, sends bounce) and back ON.
  - [ ] Chat hygiene: paste something HTML-ish (`<b>hi</b>`) — must
    render as literal text, never formatting.
  - [ ] **Kick**: host ⛔ → inline confirm → the kicked player gets the
    friendly "removed" screen, their seat frees in the roster, and
    they CAN rejoin with the code.
  - [ ] **Kick-and-block**: same but rejoin bounces with the blocked
    message. NOTE: block is per-IP — from one machine via localhost it
    blocks everyone, so test from the second PC.
  - [ ] Host-only **IP-on-hover** on roster rows (joiners must NOT see
    IPs on theirs).
  - [ ] **14-seat lobby**: crank slots up on a medium+ map; seat picker
    offers p1–p14; a size below medium caps lower (xsmall 7/small 12).
  - [ ] **Turn-log filters** in a live game (and rival-vs-rival combat
    appearing per the B5 fog rules).
  - [ ] **City name pills + tier looks** at normal zoom on both
    machines' GPUs.
  - [ ] **Animation feel** over a LAN session (flags/glide/smoke;
    "reduce animation" honored).
  - [ ] **Stronger normal AI**: does a normal-difficulty game still
    feel fair? (soak median is now 18 AI cities; expect real pressure).
  - [ ] Resume-from-save via the lobby (A34, once reviewed): pick a
    save in the host flow, everyone rejoins, game code matches.
  - [ ] **Regency hand-off** (A40-s2): hand your seat to the 🤖
    mid-LAN-game, watch it play a few turns (others keep playing
    normally), take it back — feels clean? Then kill your browser
    while the regent drives and rejoin: regency survived?
  - [ ] **Ally round-5 UX questions** (his priority 5 — the human
    feedback that matters now): is waiting/turn ownership obvious?
    does chat distract from game-critical status? does seat-code
    recovery FEEL trustworthy (try it from the second PC)? do the
    City-influence and forces overlays clarify or clutter? do
    spectators understand what they can see and do?
- [ ] **Splash diorama feel** (A42 slice 2, first visit only —
  `?splash=1` forces it any time): does the 9-second camera drift feel
  calm or distracting? One constant to slow it; say the word.
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

## THE MORNING LIST (2026-07-16 — mostly DONE by mid-morning)

✅ dev_night reviewed + merged · ✅ war-lab verdict read, doctrine
ADOPTED (per-combat-rule, docs/15 §3) · ✅ A71 Decision column ruled
(B20 + A83 green-lit) · ✅ canonical config confirmed (7 civs, A84)
· ✅ soundboard signed off (A77 CLOSED; board = permanent tooling).
REMAINING: ~~Studio run2~~ ✅ DONE mid-day (88 turns/579 commands,
replayed hash-exact BOTH engines, accepted) — superseded by the
AFTERNOON LIST below.

## THE AFTERNOON LIST (2026-07-16 — after the R7 velocity day)

1. **Merge marker — always the LATEST the architect declares
   consistent** (your ruling). Declared at this writing: the sync
   commit after this edit (the architect names it in chat).
2. **Studio runC** — one session, THREE deliverables:
   (a) the R7 arc: R7a small UI (auto-next/auto-end defaults,
   nearest next-unit, grey/dead gating, research at top center),
   R7b (unit billboards, site stars, discovery splash), R7d (odds
   preview vs browser numbers, C city list, J statistics, code
   chip, three-state End Turn) + run2 leftovers: click the TAX
   STEPPERS once, note the fog verdict;
   (b) **V void-cover screenshots** (frame / galaxy / none) for
   the art pick;
   (c) **F9 gallery grid screenshot** (R8) — every unit silhouette
   as native Parts, BOTH cone variants (fan | stack) side by side,
   for the cone-fidelity pick. If pyramids render inside-out, say
   so — known one-line apex fix.
3. **Two art picks from the runC screenshots** (soundboard
   pattern): void cover (parchment frame vs galaxy) and cone mode
   (wedge-fan vs disc-stack).
4. **Standing, low-effort**: keep a Shift+D recording from real
   browser games you play, one per difficulty when it happens —
   they seed the HUMAN BENCHMARK row the AI tuning now targets
   ("challenging, legible, fair" vs YOUR line, docs/05 §12).
5. **Coming to you later** (no action yet): barracks sell-price
   confirm + M-target pinning after the B13 window closes and the
   canonical re-baseline runs; a breaking-change alert precedes
   the window-close marker (full golden re-record).

1. **Review + merge dev_night** — the whole night is one diff; the
   architect's briefing (work / discoveries / decisions) comes with
   your first message.
2. **Read the war-lab verdict** (ratio sweep × combat rules) and
   the baseline tables — then the target-tuning + canonical-config
   decisions (civ count 4 vs 7, M9 definition).
3. **Studio run2** — now covers R5 (city panel, possession) AND R6
   (action bar, research picker, turn log, move hints) in one
   session, under the replay bar.
4. **Soundboard session** — --debug, /debugging/soundboard.html,
   comments file back.
5. **Rule the A71 Decision column** (docs/01 §11 table — ships
   can't bombard coasts is the headline gap).

## Pending — decisions / ops

- [ ] **Sound listening pass (A77, when it lands)**: run the server
  with `--debug`, open `/debugging/soundboard.html` — every sound
  as a numbered ▶ row, the tunes below, a comment box per sound;
  click through, type reactions, hit "download comments" and hand
  me the file. Your ears are the acceptance test; the helper ships
  defaults, you tune.

- [ ] **README screenshot re-shoot — UNBLOCKED (A60 landed)**: same
  seeds now yield historic city names (my verification shot shows
  "Tenochtitlan" where "City c3" was). Re-run your favorite world,
  replace docs/screenshot.png / -cityview.png at leisure.

- [ ] **R5 STUDIO RUN (run2 — the second fun one)**: pull on the
  Roblox PC if you haven't since the roblox-helper's R5 push, then
  in Studio: click your own city → change production + rush-buy;
  press P on a selected unit and walk it with WASD (map-absolute:
  W=north), N to hop units, F to dismount; confirm the fog verdict
  (no glitch-in/out with streaming off). Play enough turns to make
  it a real recording, then hand the Output log over — run2.txt must
  replay hash-exact through both engines incl. your production
  commands and possessed moves (the R4 bar is the standing bar).

- [x] 2026-07-15 — **R4 STUDIO ACCEPTANCE RUN: PASSED AND CLOSED** —
  36 turns played in Studio (98 commands, cities founded, a combat
  lost); assemble.js verdict ALL HASHES MATCH incl. the
  pre-registered boot hash 0x0ca5d97c and the game code; the
  architect's independent replay on the dev machine returned the
  verdict verbatim. Phase 5's formal acceptance criterion met to the
  letter; release tagged v0.5. Three playtest fixes verified
  hands-on same night (ray inset, Baseplate, streaming fog).

- [x] 2026-07-14 — **R3 click probe DONE, R3 ACCEPTED**: 30+ picks
  script-verified against mock-state, side-face and boundary cases
  all green (the adjacent mountain pair splitting at its shared wall
  was the money shot).
- [ ] **Pull on the Roblox PC**: tonight's pushes carry the P5-4/5/6
  items, the docs/09 trap additions (incl. the R3 input trap), and
  A46 — mail/locks flow live over the hub, but doc/queue text travels
  by git.
- [ ] **Commit: GO (suite 230/230)** — carries the all-ten port
  milestone (P5-6/P5-7 luau), A45 overlays + panel reorder, the
  tier-1 chromium CI step, CLAUDE.md playwright whitelist, docs/12
  global-host design + gated A50, A47–A49 items, docs/03/09 syncs.
  Suggested: "All ten scenarios cross-language + A45 overlays, docs/12
  global host, UI-test tiers (chromium in CI), A46-A50 queued, 230
  tests". Push both branches as before.
- [ ] **Glance at tomorrow's 03:00 nightly** (Actions tab) — it
  answers three questions at once after the next push: soak green
  (400-turn fix on the cron path), the lune gates on schedule, and
  the browser UI cases running in CI for the FIRST time (tier 1 —
  they self-skipped every night until now; expect the suite step to
  take a few minutes longer).
- [ ] **Hub IP-drift note (standing ops)**: this PC was .116 during
  the LAN test, is .112 now — DHCP moves it. If the hub stops
  answering after a reboot: re-check `ipconfig`, update the one-line
  `.agent-mail/remote` file on the Roblox PC (or reserve this PC's IP
  in the router / use the Windows hostname instead).

## Later (not yet actionable)

- [ ] **Global "find a game" + internet hosting**: the LAN-local
  listing SHIPPED (A41 — public lobbies opt-in, browse panel). The
  INTERNET half stays parked: your Hetzner recipe is stored verbatim
  in `ops/hosting-recipe.md` (gitignored); first stop needs zero code
  — DNS `retromulticiv.kjell.today` → your PC → existing join codes.
  Before real public exposure: the hardening item (rate limits, caps,
  and the join-by-guessable-gameId decision A41's review flagged).
- [ ] **16+ civs roster**: cap is shipped at 14 (A38); going past it
  waits on the Civ 2/3/4 roster adaptation (perks → our specialty
  schema) and new visual identities through the designer ally's
  acceptance loop.
- [ ] **Phase-6 acceptance criterion on record**: diplomacy legibility
  (phase-2 verdict question 4) — permanent war is the current rule;
  when diplomacy ships, it must be legible in play.
- [ ] **Two design considerations noted 2026-07-14** (full scope notes
  parked in agent-workitems, architect designs first — your call on
  when): (a) **Civ2-style combat option** — per-unit health, damage
  instead of instant death, healing over time (faster in cities /
  fortifications, which would arrive with it); (b) **Civ4-style
  strategic resource chains** — iron etc. on the map; units/buildings
  need a connected (road/rail/sea) + improved resource tile to build.
  Also on the game-v2 shelf: **Civ4-style culture areas** (real border
  mechanics in engine state — noted 2026-07-14, very later; A45's
  territory overlay covers the visual need until then) and
  **mobile-friendly UI/UX** (join on the go, pairs with AI regency —
  noted 2026-07-14; touch controls + responsive panels, same codebase).

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
