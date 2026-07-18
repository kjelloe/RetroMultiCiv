# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`. Refreshed 2026-07-14 — completed items moved to
the Done log at the bottom.

## 2026-07-17 evening — current decisions + verifications

**DECIDE (only you can):**
- [ ] **Ending #4 horizon (space victory) — measured decision menu**
  (sim-runner #1399/#1408/#1410, 2026-07-18): at natural AI pace space
  is UNREACHABLE in 400 turns (0/25 seeds even reach flight) but the
  research rate ACCELERATES late-game, landing space-flight ~t650-720
  with zero engine change. Forcing it into 400t needs ~5× research
  speed and STILL builds no Apollo (0/8) — impractical. Options:
  (A) longer horizon: natural/~700-750-turn games reach space with no
  tuning (cost: game length + a late-game perf note); (B) rate lever:
  bounded impractical, not recommended standalone; (C) ?age=
  fast-forward starts for space scenarios (already exists).
  **Recommendation: A (or A+C).** Default if unanswered: endYear
  stays as-is; space remains reachable in natural mode and age-starts.
- [ ] **Push gaming-PC dev_night** (now 5 local commits on the
  marker-0054 lineage: batches 2-5 + the re-bake trio, tip `fc3fc03`
  — sim-runner #1443, which also asks whether you want an interim
  push checkpoint as the stack grows). Until this push lands, the
  roblox lane's code (build queue, ship/discovery/end/historian
  screens, minimap/tooltips/palette, advice cards, fastforward twin)
  exists only on that machine, and the bugfixer's ff-parity
  twins-gate registration stays blocked on it.
- [ ] **N11 provenance FYI (default: proceed as labeled)** — the
  reviewer's wiki check reframed the queued upgrades item: Leonardo's
  Workshop is NOT a Civ1 wonder (Civ2 debut; our 21-wonder roster is
  verified exactly Civ1's), and manual upgrade-for-gold enters the
  series at Civ3. Both halves ship as labeled imports under your
  civ-mixing ruling (specs/n11-upgrades.md: Civ3-shape command,
  Civ2-authentic Leonardo, original-projection chain rows where Civ1
  lacks intermediates). Object if you'd rather skip either half;
  silence = build as specced.
- [ ] **Merge marker-0057** (supersedes 0056; adds N12 debug commands [engine half, taint-flagged] + N11 complete [3a Civ3-shape upgrades + 3b Leonardo, labeled], the seam bundle, B28 audit fix + N10 caravan trade
  routes — windfall + live top-3 route bonus, 4 new cross-language
  scenario pins, full-but-behavior-identical golden ripple via the
  ruleset pin — plus the client half, T1 portrait, L8 lobby
  robustness, H8 real-engine ship screen, gov telemetry.)
- [ ] ~~Merge marker-0051~~ (superseded; the
  night shipped 0043→0051): stance-mix v1 (some civs build wonders,
  dg=30 intact), the A51 find-a-game pipeline, A54 off-turn
  rates/research/production, the ruleset-compat pin, settler food
  upkeep (your flat-1 ruling), A79 blockade + B27 ZOC fix (your live
  siege), the A76 SPACE RACE (ending #4), the A50 command budget,
  government re-eval (AIs now reach Republic — the all-Monarchy
  economy stall from your LAN save is the target), the four Civ2/4
  picks (minimap, tooltips, build queue, sentry+automation), S1 match
  reports, the L/X LAN+mobile batch, roblox batch-2. Biggest merge
  since 0033 — merge the latest marker I declare consistent.
- [ ] **Settler-upkeep — final choice (measured, arc closed):** the
  progressive variant DOESN'T work — settlers are a PIPELINE (each
  founds+vanishes; rarely 2-3 alive at once), so free-first-N never
  bites (≈ baseline, no cap). A per-settler food tax CANNOT deliver
  'fewer BETTER-fed cities' — flat-1 = fewer+smaller (cities −24%,
  pop −34%); progressive = no change. Your options:
  (a) KEEP flat-1 as shipped (expansion cap, accepted economy cost);
  (b) revert to 0 (no cap, baseline economy);
  (c) keep flat-1 AND design the real fewer-better-fed lever —
  Civ4-style rising settler cost by city count (provenance-labeled)
  or leaning on Civ1-authentic corruption/distance. Default if you
  don't pick: (a) stands.

**HAND TO THE DESIGNER ALLY (cover note ready):**
- [ ] Send `specs/ally-cover-note-2026-07-17-evening.md` — their
  framework landing (stance-mix v1 shipped on their direction),
  the civ-mixing ruling applied, and THREE asks: 68 original
  tech-discovery blurbs (new authoring task, any subset useful),
  a Civ1 substitute for Sun Tzu's War Academy in their leader
  table (it's Civ2), and the small pedia flags (movement/regency
  concepts, the Oracle ×4 stacking question).
- [ ] **World-look pick (a/b/c)** — Roblox session: Options → world
  look → flip retro/enhanced live → screenshot both → pick
  retro-faithful / enhanced / enhanced-with-notes. Blocks nothing
  today (R20 keeps building behind the toggle) but decides the
  DEFAULT + orders the bigger-lift backlog (docs/13
  visual-fidelity section).
- [ ] **Civ2/4 feature picks** — which of the five client-only items:
  world minimap / yield+happiness tooltips / per-city build queue /
  sentry-wake / worker automation (specs/civ24-features-proposal.md;
  any subset, independent). Feeds the helper's queue after
  A54 + docs-sync + palette.
- [ ] **Mobile T0** — user-runnable phone check (~1h: open the LAN
  client on your phone, note WebGL/fps/first-3-blockers per
  specs/mobile-plan.md T0), then T1 go/no-go.
- [ ] **Match-report consent shape** — bless the two-level consent
  model (operator off-by-default + player seat veto + seat-label
  anonymization) before the server slice builds
  (specs/match-report-corpus.md).
- [ ] **Live strategic overlay** — want the v1.5 per-AI
  stance/mode/threat snapshot visible in-client during play?
  (Cheap now the telemetry landed; yes/no.)
- [ ] **Shift+D recordings of your own play** — a game or two,
  whenever you play; they seed the human-benchmark corpus (the
  PRIMARY AI metric per the ally's framework,
  specs/ai-modes-framework.md §A).
- [ ] **A50 command-rate budget — HOW to land it** (from your 1.0
  design-debt question; the design exists, docs/17 item 0): (a) spawn
  the dedicated hardening lane on its own clone (isolation, docs/17
  as written — needs your machine-capacity call), or (b) fold item 0
  into a normal bugfixer server window with lane-boundary care
  (faster, no new agent). One-word answer works.
- [x] **Your 1.0 pick, the ruleset pin — ALREADY DONE** (2026-07-17
  evening, marker-0045): stamped at creation, strict at load with
  operator override, lineage-honest. Your selection was shipped
  before the relay arrived.
- [x] **Authenticity batch — RULED 2026-07-17 (reviewer session):**
  freeUnitsPerCity=3 ratified as a labeled Civ2 borrow; settler food
  upkeep ADOPTED flat-1 (bugfixer window after the ruleset pin);
  barbarian gold ransom ADOPTED bundled with A4; anarchy clamp kept +
  documented; Civ4 civics parked with an interest note. Landed in
  docs/01 §11-tail (5d776e4).
- [x] **Civ-mixing ruling — GIVEN 2026-07-17:** Civ1/2/4 mixes OK
  when they make sense; provenance labels (Civ1-authentic /
  Civ2-shape / Civ4-shape / original) are the house standard.
- [x] **Stance-mix dg question — RESOLVED 2026-07-17, no action:**
  the dg40-vs-dg50 pin choice was withdrawn; heterogeneous stances
  deliver wonders at dg=30 UNCHANGED (marker-0043, gate green).

**FROM YOUR 2026-07-18 LAN PLAYTEST (X-batch filed as L1-L5):**
- [x] **README screenshot swap (your X.4) — DONE 2026-07-18** (863ec95):
  both candidates found (the second was named candidate-cityview.png)
  and swapped into the README's existing two-shot structure — the
  turn-256 Aztec world as the hero, the Tenochtitlan city view for the
  strategic layer; captions refreshed.
- The rest of the batch (hosting-screen cleanup, resume-button flow with
  --debug-gated listings, lobby auto-fit, join-code-per-boot fix, mobile
  ?mlog overlay + the seated-start bug your X.6 spectator test narrowed)
  is FILED to the helper — no action needed from you.

**VERIFY (roblox acceptance, carried):**
- [ ] Save `roblox/acceptance/runD.txt`; retest the deck-resident
  avatar flow (the two carried items from the run-4 batch).

## Earlier 2026-07-17 — decisions + fresh verifications

**DECIDE (only you can):**
- [x] **Merge marker-0033** — DONE 2026-07-17 (merged + `npm ci`).
- [x] **NEXT MAJOR TRACK — DECIDED 2026-07-17: FINISH AI-QUALITY
  FIRST** (ally's ordering). Engine lane after N4: B23d relaxed-veto
  → N3-build-tune → N1/N2 gov+tech, until the M-floors clear. THEN
  A59 leaders → D1-D2 diplomacy, A76 space race, A51 master index.
  Diplomacy/space/master-index are DEFERRED (designed + ready, but
  the AI foundation comes first). Client lane may do UI polish +
  the last art (bomber/nuclear) meanwhile.
- [ ] **RESOLVED (no action, FYI):** M11 war-lethality — you PINNED
  defenderGatePct 30 (elim ~29%). Opener-scout doctrine — MEASURED +
  REJECTED (halves expansion). Both closed.

**VERIFY IN ROBLOX STUDIO (gaming PC — lots landed):**
- [ ] Deferred from the morning: **pyramid re-look**, **worked-tile
  view**, **galaxy round 2** (parallax stars/milky-way/nebulae, moon
  killed — V twice from boot), the **K** gallery toggle.
- [ ] New surfaces since: **R12 batch** (government panel, bold unit
  fonts, city billboards, research status, P ride/dismount), **R9
  observation-deck lobby** (deck+pads, host/join/takeover), **R11
  click ride pad**, **R13/R15 city panel** (sell + plain-language
  effects), **R7c-3 3D worked-tile editing**, **R10 save/resume by
  game code** (DataStore). Re-bake picked up all the new unit art
  (tank/apc/catapult/diplomat/phalanx/musket/rifle/knight/carrier).

**AUTHOR WITH THE ALLY (v1 drafts marked, awaiting your voice):**
- [x] **Pedia concept prose** — DONE 2026-07-17: ally editorial pass folded
  verbatim (d2200f1). 14 entries now (11 revised + 3 new: cities & worked
  tiles, research & tech tree, buildings & wonders), first-game learning-path
  order. Game-code wording RECONCILED 2026-07-17: the ally corrected the pedia
  entry to "not a password — a state-match check", and A98's "resume
  passphrase" language was renamed to "resume gamecode" (user ruling) across
  docs/how-to-host.md, server/index.js + protocol.js, test/server.test.js, and
  the A98 item — it identifies which saved game to resume, matching the ally.
- [ ] **Art review-table eyeball** — the gallery now renders distinct
  silhouettes for tank/APC/catapult/diplomat/phalanx/musketeers/
  riflemen/knights/carrier; bomber+nuclear are the last two. Screenshot
  `/debugging/gallery.html` to bless them.

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

## THE MORNING-3 LIST (2026-07-17 — night-2 ran; read the architect's marker report first)

1. **Read the MORNING REPORT** (deliveries per marker) — includes
   accumulated breaking-change notes (overnight markers were
   pre-authorized; the report is where the acks live now).
2. **Merge the latest declared marker** to dev/main.
3. **Reviews deferred to you**: pyramid roof + worked-tile 3D
   overlay (Studio look), GALAXY ROUND 2 re-look (V-cycle — your
   FRAME pick stands unless the new sky wins), R9 lobby flow if it
   landed.
4. **The M11 pinning session** — the post-B26 elim table should be
   waiting; the band dials will finally connect.
5. Standing: human-benchmark recordings; ally round-7 send
   (plan-update is current).

## THE AFTERNOON LIST (2026-07-16 — after the R7 velocity day)

1. **Merge marker — always the LATEST the architect declares
   consistent**. Declared at this writing: **marker-0022**
   (through the B23 exploration re-record — the winner-flipping
   one — + A59 final config + the diplomacy relationship model).
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
3. **Art picks**: ✅ void = FRAME (galaxy → art round 2: needs a
   far richer backdrop). REMAINING: cone mode (wedge-fan vs
   disc-stack) — gallery grid is on **K** after the F9-console
   collision fix; say "fan" or "stack" + whether pyramids render
   inside-out.
4. **Standing, low-effort**: keep a Shift+D recording from real
   browser games you play, one per difficulty when it happens —
   they seed the HUMAN BENCHMARK row the AI tuning now targets
   ("challenging, legible, fair" vs YOUR line, docs/05 §12).
5. **Confirms available now** (wiki-silent rulings, veto any):
   (a) barracks sell price = FULL BUILD COST (40g); (b) NO
   AMPHIBIOUS ASSAULT — aboard units unload to open land first
   (no Marine in Civ 1); (c) transport capacities trireme 2 /
   sail 3 / frigate 4 / transport 8; (d) fighter fuel 1 / bomber
   fuel 2 / carrier airCapacity 8 / nuclear fuel 1 + strikes-once-
   consumed (A72 CLOSED — all canonical, wiki tables absent).
6. **1.0 rulings recorded** (2026-07-16 quad session — no further
   action): maximal cut (docs/03 block) — full D1–D6, Roblox
   Tier 3 at launch, master index in 1.0, all content extras;
   pollution AUTHENTIC-ON; nukes enabled everywhere + lobby
   toggle; debug commands with permanent DEBUG taint; A59 leaders
   build-ready after sweeps. YOUR future gate on the master index:
   scheduling DNS + the host box (docs/12 phase C) — sometime
   before 1.0.
6. **Coming to you later** (no action yet): the M-TARGET PINNING
   session once the post-B21 re-baseline + knob sweeps land
   (sim-runner in flight) — the first tuning conversation where
   M6/M11 mean something; B22's disorder fix goes in right after
   if the tail survives B21.

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
