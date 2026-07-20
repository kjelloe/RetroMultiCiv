# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-20 late (XIV in build; XII.5 D1+D2 RULED — core-fix marker then calendar-545 marker; probe re-run follows)._

---

## DECIDE / DO (needs you)

- [x] **XII.5 + calendar — BOTH RULED (2026-07-20 late).** D1: normal game
  targets ~550 turns via Civ-1-pace early yearSteps — "Classic 545" table
  picked (t200=1AD, t350=1500, t545=2100 end; `specs/calendar-545.md`).
  D2: GO — the verified XII.5 core fix lands FIRST as its own marker, the
  calendar slice follows as a second marker (two re-records, clean
  attribution), then the probe re-runs at 545t to measure whether the
  calendar closes the space gap (bulb tuning only if it does not).
  Bugfixer instructed (#1930); the six 25h-held locks are moving again.

- [x] **Refinement XIV — 31 playtest items triaged and queued** (2026-07-20
  evening, browser+iPad+phone session). Spec: `specs/refinement-xiv.md`.
  15 helper items (correctness first: regency-stops-at-gameOver, mobile
  Save/Load, E-hint bug, civ-shuffle bias — root-caused as LCG low-bit bias),
  1 parked engine batch (settler pathing, regency economics, AI treasury —
  behind XII.5), 1 roblox style item. The helper already shipped the first:
  bare `/client/` now 302s to `?server=1` (redeploy to pick it up). Your
  playtest artifacts both verified — the 396-turn diagnostics **replays
  bit-exact** (engine determinism confirmed on a live-box game).

- [x] **Hetzner test deploy — DONE 2026-07-20, box is live and serving.**
  `multiciv.kjell.today` → 49.12.106.125, deployed from the local dev_night
  working tree. Health check green: ufw (2222/80/443 only), fail2ban, nginx,
  certbot, Node v22.23.1, units active, caps line accurate. Findings from the
  run are written up in `docs/how-to-host.md` § "Deploy troubleshooting" and
  fixed in the templates.

- [ ] **Confirm three live-box items** (fast; only you can see the box):
  1. Is the installed unit's `--public-addr` now the bare `multiciv.kjell.today:443`
     form, and does `journalctl -u retromulticiv-game` show `master: listed at …`
     rather than `master says: badAddress`? (A scheme is rejected at boot now,
     so a stale unit will refuse to start rather than mis-announce — see below.)
  2. The box is the **2 GB** tier (`multiciv-2gb`), but the unit carries the
     4 GB defaults. Apply the 2 GB row from `docs/how-to-host.md` § "Sizing by
     RAM": heap 768, `MemoryMax=1200M`, `--max-games 3`.
  3. Does a `?server=1` game now write into `/opt/retromulticiv/saves/`?
     (The empty-saves puzzle resolved as play going through the bare `/client/`
     URL, which runs the in-browser engine — the default-redirect fix is queued.)
  **Heads-up on 1:** the new boot guard means a unit still carrying
  `--public-addr https://…` will now **fail to start** instead of running
  mis-announced. If the box is currently up on a scheme value, fix the unit
  before the next restart or deploy.

- [x] **Two server-only playtest bugs — BOTH FIXED + committed** (helper,
  2026-07-20 late): the endscreen crash (shared `score-view.js` fog-guard —
  honest "—" rows instead of a crash, all four score callers, tested) and the
  bare-`/client/` → `?server=1` redirect (`?local=1` escape). Bonus third
  delivery: the **in-client bug-report feature** (🐞 dialog + auto-attached
  recording; write-only opt-in `--bug-reports` server route). All reach the
  live box on your **next redeploy** — until then keep sharing `?server=1`.

- [ ] **Studio screenshot review — Studded/Brick world style** (roblox,
  `a2335b0`, 18 gates green): the first implementation of the third world
  style is committed; roblox-helper waits on your in-Studio screenshot pass
  (ally invariants: silhouettes readable, studs sparse, terrain FLATTER than
  the other styles) before iterating.

- [ ] **marker-0068 tagged — do NOT merge yet.** OOM fix complete + A101
  operator-caps verified (`reports/marker-0068.md`). Explicitly NOT
  merge-consistent: the XII.5 golden window is open (re-record in flight).
  **Latest merge-consistent marker remains 0067.** The next consistent
  declaration comes with marker N (XII.5 core fix).

- [x] **v1/v2 plan trees added as living documents** (your request):
  `plan-version1.md` (the 1.0 dependency tree, updated per marker) +
  `plan-version2.md` (the loose v2.0-or-later shelf).

- [x] **Markers 0063–0067 tagged — MERGED.** You've been merging as they land.
  Shipped 2026-07-19 (each has a `reports/marker-00NN.md`):
  - **0063** (golden-neutral): city-era determinism fix (Shift+D recordings
    verify again) + unit/building Civilopedia blurbs.
  - **0064** (BEHAVIORAL): **D3 AI diplomacy** — the AI negotiates war/peace at
    swept `peaceAcceptThreshold=30`. Gate-B (Luau parity) green.
  - **0065** (behavior-neutral): data-label — Caesar→Colossus (a 3rd
    wonder-race pair) + railroad rename, regen-durable.
  - **0066** (golden-neutral server): **crash resilience** (your request) —
    crashdump on uncaughtException/OOM + memory-watchdog (autosave + graceful
    exit before fatal OOM) + `MULTICIV_SUPERVISE=1` self-restart loop.
  - **0067** (golden-neutral server): **ws-timeout fix** — busy-tolerant
    heartbeat, no false connection-reap during an event-loop block (turn-2623).
  Everything through marker-0062 sits below these.
  _In flight (no user action) — several markers converging:_
  - **XII.5 space-drive** (your "regent never idles" feedback) — core fix
    CONFIRMED (witness 1: Apollo now built vs the 0/42 baseline, JS==Luau,
    zero economic regression). The measure-first probe COMPLETED and reframed
    the ruling — see the top DECIDE item; spec §11 has the data. Ruled out on
    authenticity: gold-rushing Apollo (a Wonder — Civ 1 forbids it; the 1991
    accelerant was caravans, which the AI deliberately doesn't field).
  - **OOM/write-amp fix** (from your turn-2623 question) — slice 1 (kill the
    per-command autosave write-amplification) done + landing; slice 2a (bound
    the in-RAM log) DELIVERED, landing behind XII.5. Golden-neutral server.
    Meanwhile `--max-turns` on the test host bounds the same OOM shape.
  - **Operator resource caps** (your host-sizing request) — `--max-turns` /
    `--max-civs` / `--max-size` done (helper A101), plus the warn-not-fail
    rider (unknown server flags WARN instead of crash-looping + a boot
    `caps:` line showing the effective caps). Landing. Golden-neutral server.
  - **11b city names** (ally-delivered, verified) + **D3 server-surfacing**
    (a traced gap — AI diplomacy is invisible over the server/LAN path; fix
    queued) — both queued in the engine lane behind XII.5.

- [x] **Gaming PC back online** — both sim-runner and roblox-helper
  recovered; the D3 sweep is resuming (marker-0063 auto-progressing again)
  and the Roblox run-F work is pushing again. No further action.

- [x] **Unit + building pedia blurbs — DELIVERED by your ally** (run-F item
  9). You relayed the request and the ally's copy is back: 28 units + 21
  buildings, id-verified 28/28 + 21/21 against the data files, saved verbatim
  to `specs/ally-unit-building-blurb-response-2026-07-19.md`. Now being wired
  in as a `unitBlurbs`/`buildingBlurbs` data table (browser pedia + build
  tooltip → helper; Roblox parity → roblox-helper), exactly like the 68 tech
  blurbs. No further action.

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

- **Hosting Q&A answered** (your sizing/firewall questions): **ports** — game
  server `8123` (HTTP + WebSocket on the *same* port), master index `8200`
  (both `--port`-configurable); firewall = open 22/80/443 behind nginx (keep
  8123/8200 localhost), or 22/8123/8200 direct. **Sizing** — RAM is the driver:
  ~5–10 games on 2 GB, ~15–25 on 4 GB; 40 GB SSD ample; the master index adds
  only ~100 MB. The **operator resource caps** (above) let a host bound this; a
  precise RSS-per-game measurement is queued to the sim-runner to firm up the
  numbers.
- **Coordination tooling** (internal, your requests): the agent system now has a
  `coordinator` role alias, a live **status board** (waiting/working/blocked),
  and per-lane **work stacks** — so no lane sits idle waiting for direction and
  blocked lanes raise their hand. Keeps v1 delivery moving without me
  hand-routing every task.
- **Crash resilience + ws-timeout SHIPPED** (markers 0066/0067, your requests):
  crashdumps + OOM watchdog + self-restart loop, and a busy-tolerant heartbeat
  that stops false connection-reaps during an event-loop block. Together they
  cover the turn-2623 drop (crash vs block). See `specs/server-crash-resilience.md`.
- **Turn-2623 OOM root-caused** (your memory question) — traced to the server's
  unbounded recording `log` (`server/game.js`): every human/regent command is
  logged and never trimmed, so a long regency game grows ~110–420 MB by t2623,
  which with the large late-game state can OOM. The state itself doesn't leak.
  Fix routed to hardening (stream per-command entries to disk, keep only the
  tiny round-hashes in RAM); the OOM watchdog will confirm + auto-recover
  meanwhile. Recorded in `specs/server-crash-resilience.md`.
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
- **D3 AI diplomacy — SHIPPED** (marker-0064, `87cfe3b`): the AI negotiates
  (war/peace, met-state + first contact) at the swept `peaceAcceptThreshold=30`
  — where your **mix-conditional elimination** and the **space-launch
  coalition** land. Two-phase close: byte-shaped JS==Luau → sim-runner sweep →
  one re-record; Gate-B (Luau full parity) + full suite green, bugfixer-verified.
  D3 opens the phase-6 diplomacy line (D4–D6 follow, docs/14).
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
- **Roblox run-F — 10/11 committed** (`ba9ad3f`): the roblox-helper's batch
  landed (panels, tile improvements, debug/DataStore config, city-name
  render fix, ff-diorama, pedia movement/regency, selftest gates 12–14);
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
