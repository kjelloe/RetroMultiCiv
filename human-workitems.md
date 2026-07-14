# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-13 — completed items moved to
the Done log at the bottom.

## Pending — verify in real play

- [x] 2026-07-14 — **Phase-4 two-machine LAN acceptance: PASSED** (2
  humans + spectator + AI; network kill on the host PC AND server kill
  + save-resume both survived; turn-53 save replays hash-exact; moved
  to the Done log).
- [x] 2026-07-14 — **Phase-2 hotseat verdict delivered: ACCEPTED.**
  Ten original questions all good; hotseat questions 6/7 pass —
  question 4 (diplomacy legibility) scoped to phase 6 (no diplomacy
  exists yet; noted as a phase-6 acceptance criterion). Verdict
  recorded as a labeled appendix in `specs/phase2-assessment.md`.
  Phase 2 formally closed — ALL phase gates through 4 now passed.
- [ ] **Feel-test backlog** (largely exercised by the 2026-07-14
  acceptance session — tick whatever you consider covered): waves
  III/IV polish (battle linger, centered mini-map + real center
  yields, per-player hand-off landing, C-to-capital, one-tech-ahead
  catalog, hover move arrow, Civ-style calendar pacing to ~turn 395,
  starting-age fast-forward + its 10–20s wait on big maps). Wave VI
  items get their own verification pass once B5/B6/A29+ land.
- [ ] **End Turn latency late-game** (standing): if End Turn stalls
  noticeably vs a big AI (10–24 cities on some seeds), report turn
  number + Shift+D file.

## Pending — decisions / ops

- [ ] **Nightly workflow: lune install step** (from P5-1): the Luau
  twin test self-skips without lune, so CI silently loses the anchor
  gate until `.github/workflows/nightly-soak.yml` installs the
  official lune-org binary (curl the pinned v0.10.5 release zip)
  before `node --test`. Say go and I'll queue the workflow edit with
  a claim, or edit it yourself with the commit.

- [ ] **Commit checkpoint**: the tree carries the phase-4 acceptance
  markings (docs/03/08/09, plan-update, README), the full wave-VI
  routing (B5/B6, A29–A37, the architect engine batch), and the
  helper's in-flight A28 — commit at a green-suite stop.
- [x] 2026-07-14 — Queue decision (a): **big-lobby scaling GO** —
  activated as A38 (probe at 4/8/12/16 + shipped cap raised to 14,
  gated on measurements; 16 stays test-only until the Civ 2/3/4
  roster + ally identities).
- [x] 2026-07-14 — Queue decision (b): **find-a-game v1 GO** — A41
  confirmed in the helper's queue (after A34/A37 by design: listing
  without kick would be premature). Both post-acceptance decisions
  now resolved.
- [ ] **Phase-5 kickoff prerequisite** (when you want the port to
  start): Roblox Studio project + lune toolchain install (approved
  2026-07-12) — docs/09 is otherwise ready and now unblocked.
- [ ] **Sim-runner agent — spawn when phase 5 needs it, ON THE
  ROBLOX PC** (decided 2026-07-14): docs/11 is the role prompt —
  measurement executor, zero write footprint, jobs by mail tagged
  'measure'; hub connection is the same remote one-liner. Honest
  hardware note: its CPU is the contribution (relieves this box's 16
  contended threads) — the 4070 sits idle for sims but earns an
  optional second duty running GPU-real screenshot sweeps. Trigger:
  P5-2+ parity gates; I'll say when, or spawn early if you like.
- [ ] **Ally loop — final relay**: he SIGNED OFF on A1.6a/b
  (2026-07-13) pending his three-point gallery checklist, which the
  architect ran and passed (verdicts + fresh shots
  `debugging/gallery-signoff-{grid,props}.png`; details in docs/03 art
  track). Remaining human step: relay the checklist verdicts + the
  shots to him, share the refreshed `plan-update.md` (both his feedback
  rounds applied — and it now leads with **PHASE 4 ACCEPTED**, via his
  own stress-test script), and the thank-you for the civ table. HIS
  NEW REQUEST is queued as A43: a machine-readable render spec
  (`specs/render-spec.json`, generated + drift-guarded) so his system
  can validate the rendering design beyond visuals — tell him it's
  coming, and that the rendering CODE is already public in the repo
  under `client/renderer/three/` (the export gives him the
  declarative tables with a schema, not a code dump).
- [x] 2026-07-14 — Old recordings cleanup done (pre-2026-07-12 files
  removed from `debugging/logs/`).

## Later (not yet actionable)

- [ ] **Global "find a game" + internet hosting**: noted 2026-07-13 —
  parked item with full design facts in agent-workitems; your Hetzner
  recipe is stored verbatim in `ops/hosting-recipe.md` (gitignored).
  First stop needs zero code: DNS `retromulticiv.kjell.today` → your
  PC → existing join codes. The public game LISTING is a small item
  (lobby registry already tracks everything); decide after LAN
  acceptance. Before real public exposure: the hardening bullet
  (rate limits, caps) becomes its own item.
- [ ] **Big-lobby scaling (8/12/16 players)**: noted 2026-07-13 — a
  parked probe item with the full fact sheet lives in agent-workitems
  ("PARKED — Big-lobby scaling"). 16+ civs decided: draw from Civ
  2/3/4 rosters, adapt perks to our specialty schema; new visual
  identities go through the designer ally's acceptance loop. Queue
  after the two-machine acceptance.
- [ ] **Phase-5 second gear — ON THE ROBLOX PC** (Rojo approved
  2026-07-14; spec + structure written = docs/10-roblox-agent.md,
  R1–R3 queued in agent-workitems). Your steps on that machine:
  1. Clone the repo (git is the cross-machine transport — commit/push
     here first so docs/10 + the R-queue travel).
  2. Install **Roblox Studio**, sign in, confirm a Baseplate opens.
  3. Install **Rojo** (executable + the Studio plugin from its docs).
  4. Create a private Experience ("RetroMultiCiv dev").
  5. **Mail hub** (live cross-PC mail + locks): on THIS machine run
     `python3 tools/agent-mail.py serve` (port 8970) and open it
     through WSL once, in an ADMIN PowerShell:
     `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0
     listenport=8970 connectaddress=$(wsl hostname -I).Trim()
     connectport=8970` + `netsh advfirewall firewall add rule
     name="RetroMultiCiv mail 8970" dir=in action=allow protocol=TCP
     localport=8970`. On the Roblox PC's clone:
     `echo http://192.168.1.112:8970 > .agent-mail/remote` — its
     agent-mail commands then share this mailbox + lock registry live.
     ⚠ IP DRIFT: this PC was .116 during the LAN test, is .112 now —
     DHCP moves it. Sturdier options: reserve this PC's IP in the
     router, or use the Windows hostname instead of the IP in the
     remote file (LAN name resolution usually works); if the hub stops
     answering after a reboot, re-check `ipconfig` here and update the
     one-line remote file there.
  6. Start a Claude Code session in the clone and point it at
     `docs/10-roblox-agent.md` — that file IS the role prompt; it
     claims R1 and mails through the hub like the local agents do.
  7. You still pump git both ways for CODE (agents never touch git);
     the hub only carries mail and locks.
- [x] 2026-07-13 — **AI happiness batch 4: approved conditionally**
  ("do it if it helps God-Emperor") — criterion + design sketch recorded
  in docs/04; architect's queue, golden lock required.

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
