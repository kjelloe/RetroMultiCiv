# Night-2 morning report (2026-07-17, architect)

## TL;DR
- **Merge candidate: marker-0030 (`1b41862`)** — the only marker I declare
  consistent. marker-0028 was STRUCK (B23b regression — caught and fixed the
  same night; full story below).
- **Before anything else after merging: `npm ci`** (new devDependency
  `@playwright/test`, user-pre-approved 2026-07-14, arrived with A49).
- Three engine golden re-records tonight (B26, B23b, N3+B23c combined).
  Final goldens: soak `0x67220be7 / 0xbf549246 / 0xe28e365f / 0xb88d908b`,
  natural `r395 / p2 / 0x72c846cc`.
- Headline capabilities: **the AI builds ships** (N3, first time ever), wars
  have discipline (B26), the game has a full **Civilopedia** (A58), the
  server is hardened for public hosting (A50 items 1–3+3b), and a Playwright
  multi-client UI lane guards it nightly (A49).

## Deliveries per marker (dev_night)
- **marker-0025** (`5c2d067`): docs/16 hostile-stream scale test folded —
  no crash/leak/integrity breach at 200 hostile clients; the real gap is
  event-loop FAIRNESS (a legit user is starved at ≥50 flooders) → A50 item 4
  upgraded to a measured per-connection-budget requirement.
- **marker-0026** (`10048b4`): B26 defender march discipline (golden move
  #1 — defenderGate gates all attack-initiation; the natural-end winner
  flipped p1→p2). A93+H1b M-floor enforcement (soak floors + a nightly
  canonical lane in REPORT mode; flips to enforcing when M2/M3 close).
- **marker-0027** (`a10855b`): merge of the gaming-PC sweeps — R12
  Playtest-C batch (government panel, 2× bold unit fonts, always-on city
  billboards, research status, P ride/dismount, dismounted-Next fix, DEBUG
  button), R9 lobby place (deck+pads), galaxy art round 2 (parallax
  starfield + milky-way band + nebulae, default moon killed).
- **marker-0028** (`60bf126`) — **STRUCK**: A50 items 1–3+3b complete
  (join-by-id closed for private games, per-IP rate limits + global caps,
  tiered saves rotation, lifecycle expiry), A49 H3a (playwright lane), and
  B23b phased scout allocation (golden move #2 — regressed; below).
- **marker-0029** (`dddb79f`): B23c regression fix + N3 naval probe
  (golden move #3, one combined window): guards>=2 floor restored; the AI
  now researches map-making (after monarchy), builds ships in coastal
  cities (1 per coastal city, cap 4), boat-scouts range them, and a
  decision-layer guard keeps AI land units off sea until N3b loading
  doctrine (no silent unit leaks). Suite 439/439; sim-runner gated the fix
  (floors green, cities median 11).
- **marker-0030** (`1b41862`): B26b percent-shaped war-doctrine gates — an
  IDENTITY refactor (goldens byte-unchanged = the proof) so your M11 pin
  ships as an integer pct, no floats in either engine.
- Post-0028 commits inside 0029/0030's line: A49 H3b (reconnect +
  spectator + moderation specs + nightly ui-lane job → A49 COMPLETE),
  resourceCov telemetry (all six M-floors now measurable), A67 tank+APC
  with the full CI visual-golden cycle (A67 CLOSED; A67b/A88b queued from
  its findings), A99 onboarding advisor (extends A78 — 3 new cards), A58
  Civilopedia end-to-end (a/b/c/d), N4 design pinned (held), B23d queued.

## The B23b regression story (honesty section)
B23b (phased scout allocation, your doctrine) shipped gate-green but
regressed the game: expansion crashed (seed2: 34 cities → 5), exploration
fell to ~7%. **Caught within the hour** by the sim-runner's clean marker
A/B and by the A93 M-floors on their first night of enforcement. Root
(evidence-first; my opener hypothesis was only partial): B23b dropped the
guards>=2 scout-departure floor — multi-city civs stripped every garrison
at once to meet the scout quota and lost their cities to barbs; the threat
veto can't cover it because barbs spawn unseen. Fix: a one-line floor
restore (quota/veto/fast+boat pools all kept). N3's re-record was held so
nothing baked on the bad base. Consequence for your doctrine: the
sole-guard OPENER is disabled again (decision 3 below).

## Decisions for YOU this morning
1. **MERGE**: pull dev_night, `npm ci`, merge **marker-0030**.
2. **M11 PIN (5 minutes, packet ready — sim-runner #795)**: set
   `aiWarDoctrine["1"].defenderGatePct = 30` (currently 100). Sweep says:
   pct100 = elim 0% (too pacifist), pct0 = 36% (bloodbath edge),
   **pct30 = elim 29% — band center — AND peak conquest AND best economy
   (a free win)**. pct40 = conservative alternative (21.5%). Keep
   attackerPerCity 1, massSize 4. A **knob rider** ships in the same
   one-line window: `aiScoutQuotaByCities {1:3,2:6,3:10}` (first contact
   at t75 vs t141 — the AI meets you much sooner). One small re-record
   covers both; the bugfixer is briefed.
3. **OPENER DOCTRINE CALL**: your "first military unit scouts" opener is
   off again (it lost capitals to unseen barbs). Option: a 1-CITY-ONLY
   opener exception, testable in one sweep. Go/no-go.
4. **EXPLORATION (FYI, plan set)**: the 8%-vs-22% deficit is STRUCTURAL —
   no quota table fixes it (sim-runner #797). B23d (relax the veto to
   bench only scouts that are THEMSELVES near threat) is queued behind N4;
   it's the only path to both green floors and 22% exploration.
5. **ALLY EDITORIAL**: `client/ui/pedia-concepts.js` — 11 Civilopedia
   concept entries, v1-draft-marked for the ally's voice pass (leader-
   dialogue flow). Plus A67's ranked art table (catapult + diplomat next).
6. **ROBLOX STUDIO LOOK** (carried over + tonight): pyramid re-look,
   K-toggle, R12 surfaces, galaxy round 2, R9 lobby. The re-bake to
   marker-0030 (defenderGate + scout + naval knobs + tank/APC recipes) was
   ordered; check the roblox lane's manifest mail for its status.

## Tomorrow's engine sequence (proposed)
M11 pin window (rules-only: pct30 + quota rider, one re-record) → N4
garrison cap (design locked #792: redeploy-first, border =
enemyNear(threatRadius); seed-6 bloat tripwire is the red case) → B23d
relaxed veto (sim-runner gates like B23c). Each window sim-gated.

## Process notes
- **Three-strikes TRIPPED** (stale-fact class: B18 re-offer, A72
  mis-sequence, A99 duplicated the shipped A78): augmentation adopted —
  every new item spec now carries a cited prior-art check. The helper's
  pre-build grep caught it; the rule already refined once more (grep the
  capability's SYNONYMS — the helper's own ❓/pedia near-miss).
- One real race averted (dev-PC commits vs gaming-PC pushes, merged clean)
  → push-immediately-after-commit adopted; one FALSE race flag (stale
  remote-tracking ref) → divergence claims now verify with ls-remote.
- The A48 visual-golden discipline ran end-to-end (A67): CI actual →
  eyeball → commit. The A93 floors caught a real regression on night one.

## Fleet ledger
- **helper**: A93, H1b, A50 items 1–3+3b, A49 (H3a+H3b), A67 (+CI golden
  cycle), A99, A58 (inventory→a→b→c→d) — 11 accepted slices, zero rework;
  stood down on-call at 04:40 with the right engineering rationale.
- **bugfixer**: B26, B23b, resourceCov, N3+B23c combined, B26b identity —
  five golden-lock windows plus the B23c evidence report that killed my
  hypothesis with data; N4 design-locked for tomorrow.
- **sim-runner**: hostile-scale test, post-B26 elim grid (+ massSize
  honesty correction), the B23b regression catch, the B23c gate, the M11
  free-win packet, the quota-sweep structural verdict; roblox sweeps as
  git operator.
- **roblox-helper**: R12 batch, R9 lobby, galaxy round 2, R11 in flight,
  R10 unparked, R7c-3 proposal pending your look; re-bake to marker-0030
  ordered.
