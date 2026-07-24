# marker-0102 — A8 tile contention + coastal-build + Founder's Record + XIX + guards + hardening merges

Tag: `marker-0102` at `17b4fb8`. **Merge-consistent — the user may merge
this.** (River landed immediately AFTER this tag at `8da9029` and is
mid-gate — it is deliberately outside the marker.)

Delta: marker-0101 (`38a29b5`) → `17b4fb8`, 33 commits.

## Engine (golden-moving, all re-records honest + sweep-verified)

- **#32 A8 tile contention, fork-b** (`376ff03`): two cities never
  double-work a tile. Contention resolved once per turn
  (`resolveAllWorked`: manual > auto, older city wins ties, centres
  pre-claimed) threaded through the real-game paths (processCities /
  playerIncome / updateDisorder / pollution); AI hypothetical
  evaluations keep the pre-A8 non-contended model (measured 5–18×
  per-call cost made per-eval contention infeasible; the modelling
  ruling is recorded in the A8 spec thread). Perf on the golden seed
  INVERTED to 0.53× baseline — contention slows growth, shrinking the
  workload. Re-records: CANONICAL_PIN `0x723cbf7a`, scenario 063, sim
  goldens `0x84feaa76/0xfc4c8765/0x0b3bdc8f/0xcaeeb8fb`, natural
  `0x71ddb121`. **Gate evidence: Gate-B green #2510 + 25-seed sweep
  GREEN (invariants + ratchet floors) #2540 at `1ff9e5a`.**
- **#35 coastal-build** (`95261a1`, XVII §5): sea units require a
  center-coastal city (`cityIsCoastal` shared helper, scenario 064,
  `test/coastal-build.test.js`). Reviewer green #2524,
  golden-neutral-measured.

## Client

- **#34 Founder's Record COMPLETE** (`68fac99`): all four ending
  moments (conquest, space, retirement, defeat) + the Continue-gated
  scaffold, `?ending=` preview, 11 acceptance screenshots.
- **Refinement XIX 8/8** (`07b3ea9` + `528fe90` spec): regency hint
  box, top-bar gov width, endscreen-stats + replay `collectStatsAsync`
  time-budget chunking, replay view polish, tech-tree button
  regression fix.
- **Regression guards 2 + 5** (`76c5489`, `c5d7ac0`): the A45 lint
  (no lazy `location.search` reads in client/ui function bodies) and
  the perf-budget contract (chunked stats must yield mid-run and match
  sync byte-for-byte).

## Server (merged at the tag tip, both reviewer-gated)

- **gameover-reveal** (`13d89e0`, merge `eb458e8`): the gameOver view
  push carries the unfiltered map — strictly `=== true` gated, additive
  field, no pre-endgame leak (reviewer security review #2537 GREEN;
  `test/server-gameover-reveal.test.js`). Implements ruling #2496
  (fog lapses at game over).
- **reject-reasons export** (`6056a87`, merge `17b4fb8`): server
  reject codes centralized into `REJECT_REASONS` — regression-guard
  1's server half (reviewer PASS #2542;
  `test/server-reject-reasons.test.js`).

## Roblox (sim-runner-committed, architect-merged)

- Intro "One City Through Time" staged scene (`1e3e549`, `d32f99a`)
  incl. the camera-fight fix after the user's Studio test; runL
  playtest batch + WaitStatus rojo-collision fix (`bb9ea36`).

## Specs / docs / process

- Refinement XX captured (`c6eb2bd`): pedia rename behind PEDIA_NAME
  (Gamepedia Fandom-brand collision flagged — user rules the string),
  game-start civ splash, the AI city-role build doctrine (measure-first
  routing).
- Roblox store descriptions captured verbatim + 4 fact corrections
  (`ee38256`, `42abd85`); ally round-trip complete — specials ACCEPTED,
  iteration narrowed to game-antler + 3 guards (`1a478bb`, `62299b1`).
- Docs-currency audit fixes (`1ff9e5a`): docs/01 tile-contention +
  late-join, docs/02 rosters, CLAUDE.md client roster +11, docs/13
  intro. Deploy guard + troubleshooting #8 (`b41ad38`). RC drafts:
  evidence digest (`d5ed180`), README frame (`3356718`). Test-count
  sync 852 → 886 (`5383b56`).

## Test state

Full suite at the tag: 897 tests / 6 known browser-CDP flakes (19/19
when isolated) — the same envelope the A8 sweep verified at `1ff9e5a`.
Post-merge server suites re-run at `17b4fb8`: 45/45. luau-twins 11/11.

## Breaking / notes

- No protocol or save-format breaks. gameover-reveal is additive
  (old clients ignore the field).
- River (`8da9029`, after the tag) is a BEHAVIORAL golden window
  mid-gate (reviewer engine-diff + 25-seed sweep queued) — do not
  merge past the tag until marker-0103 declares it consistent.
