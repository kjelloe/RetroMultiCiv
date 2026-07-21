# Human work items — RetroMultiCiv

Things only a human (Kjell / friends) can decide or verify. The old,
cluttered version is in `archive/human-workitems.md`. This is a clean
slate — done items are dropped, not struck through.

Convention: `[ ]` open, `[x]` done. Agent/coder tasks live in
`./agent-workitems.md`. An HTML companion is `human-workitems.html`
(regenerated from this file).

_Last synced: 2026-07-21 (marker-0076 = candidate, 0077/air-truth in gate; naval ruled FULL-loop; ally endings package routed)._

---

## DECIDE / DO (needs you)

_Catch-up: `reports/away-window-brief.md` (the 7h run) + reports/marker-0069..0076._

- [ ] **Redeploy from marker-0076** — nine consistent markers since your
  last deploy (0069–0076): 545-turn games, the whole xiv-ai arc, settler
  pop-cost, city-as-road, A50 server hardening (healthz/invite-code), the
  helper's client wave. Three live-box checks + optional
  `--bug-reports` flag as before.

- [ ] **Ally relay: thanks + routed confirmation.** Their endings/
  disasters/difficulty package is fully routed (engine couplings reached
  the builder BEFORE the affected slices; endgame moments queued;
  7-step ladder rides the difficulty slice). Worth telling them: the
  "replay as witnessing history as a ghost" defeat idea and the naming
  revision are both in the record verbatim. Their advisor-copy table
  arrives with the component build as promised.

- [x] ~~Domain: founders.eu~~ **RETRACTED — Founders withdrawn (Steam
  collision, specialist round).** New flow: clearance checks on the five
  candidates (The Work of Ages leads) BEFORE any registration — post-v1
  unless you fancy running the screen early. Runbook §8 updated.

- [x] **NAVAL — RULED (a) full loop in v1** (five steps + basic escort;
  war-committed invasion w/ 3:1; sequenced after naval-truth).
  `specs/naval-loop-v1.md`; queued.

- [ ] **Studio session** (one sitting covers all): Studded style review +
  D3 relations panel + manifest-v3 slices + NEW CP1 tile-props; save
  `runG.txt` while there.

- [ ] **Terrain §29 desaturation check** — screenshot pair, ally's test.

_Recently landed (since your redeploy list last refreshed):_ marker-0076
(city-as-road); Gate-B fallbacks 0072–0075 all UPGRADED to real greens by
sim-runner; ratchet locked (M2≥6/M3≥28/M4≥50) on the 25-seed authentic
re-baseline; settler-timing sweep FLIPPED its hypothesis (pop≥2 optimal;
cap-sweep is the density lever, queued); naval-loop probe running; A50
remainder landed; disasters ruled IN (authentic-ON + toggle, fact-pack
build-ready); air-truth in build; hover-cards ⅔ live; CP1 tile-props on
Roblox; D4–D6 design-complete; release runbook live (severity scale,
versioning rule, naming §8); branding brief written.

---

## PLAYTEST (high value right now)

- [ ] **Fresh LAN session on marker-0069+** — player-facing systems that
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
