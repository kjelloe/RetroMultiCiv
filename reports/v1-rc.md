# v1.0 release candidate — the evidence digest

Assembled for the RC marker (`specs/v1-release-checklist.md` step 1). Updated
2026-08-01: **the v1 engine programme is COMPLETE** — W1–W8 all built, gated and
tagged (marker-0111), full suite 1027/1027 with zero failures.
Each axis states what shipped, WHAT PROVES IT, and what is knowingly left out.
Written to be checkable: every claim names the gate, sweep, or measurement that
backs it, so the release decision reads evidence rather than assertion.

Fill-in markers `[RC]` are the numbers that must come from the RC marker's own
clean-clone + sweep, not from an earlier one.

## Axis 1 — every Civ 1 system faithful

Terrain (incl. rivers), cities, units, the full 28-unit roster, one-shot combat
with veterans/ZOC/stack-death/capture, happiness and disorder, the government
ladder with revolutions, corruption and war weariness, improvements through
railroads and transforms, barbarians, huts, wonders (21, world-unique), the
complete 68-advance tree, pollution and global warming, the seven disasters,
score and the 2100 AD end.

**Proof:** `test/scenarios/` JSON fixtures pinned cross-language (JS == Luau),
the unit/mechanics suites under `node --test test/`, and the wiki-dump
extraction as the numeric authority (`tools/wiki2data.js` → `data/*.json`).
**Known gap, banked by ruling:** the workturns/transforms companion pass.

## Axis 1b — Civ 1 feature audit

Closed at marker-0107: W1 diplomacy repair, W2 building effects (Mfg. Plant, SDI),
W3 the score happy term, W4 We-Love-the-King-Day, W5 the re-home relabel.
**Proof:** each shipped in its own golden window with a reviewer gate and an
honest #28 classification; the audit list itself is in `specs/`.

## Axis 2 — diplomacy D1–D6

Contact and audiences, cease-fire and peace, tribute and technology demands,
reputation with a memory, the senate, embassies and diplomat missions.
**Proof:** marker-0104 closed the arc; scenarios pinned both engines.

## Axis 3 — AI at the M-targets

The doctrine set: build doctrine (temple/granary first, city roles, tiered role
build lists, frontier walls), the war pair (siege pillage, bomber/fighter
doctrine), and the econ pair (offensive diplomat, caravan chain + peace routes).
**Proof:** floors measured on the canonical 25-seed sweep — M2-cities 18,
M3-pop 66 (3× the pinned floor of 22), M4-improvement 93%, M10-buys 14,
resource coverage 85.5% — plus coverage counted DIRECTLY rather than inferred
from hashes (walls 75% border vs 33% interior; barracks 239 / library 215 across
428 cities; `helpWonder` commands matching `wonderHelped` events 1:1).
Floors re-confirmed on the W8 gate sweep: M2-cities 18, M3-pop 66, M4 93%,
M10-buys 14, resource coverage 85.5%. **[RC]** one final confirmation rides the
RC sweep at the release tip.

**The acceptance discipline is the part worth defending at review.** W8 shipped
with green fixtures, an honest re-record and a faithful twin — and was still half
inert in play: ~94 diplomat missions produced 2 accepted steals, and 624 route
commands produced ZERO routes, because the doctrine kept issuing commands the
engine rejects. Both causes were fixed and re-measured: **34 missions → 34
accepted outcomes with zero waste, routes 3/3.** No hash could have shown that;
the counts did.

## Axis 4 — Roblox tier-3 multiplayer

The whole deterministic engine runs in Luau and provably matches the JavaScript
engine; a Studio session's command log replays hash-exact through the browser
engine. **Proof:** `test/luau-twins.test.js` 11/11 — rng/statehash/gamecode
anchors, every scenario, the nine map-type pins, ff-parity, the golden-seed sim
to turn 100, and replay-verdict equality.
**Open (not a v1.0 gate, ruled):** the one Studio sitting — publish, store art,
genre, sound upload — and the UI playthrough checklist prepared for it.

## Axis 5 — public hosting + master index

Live. Authoritative server, lobby with join codes, seat reconnection, AI regency,
spectators, autosave/restart, the QuakeWorld-style master index, and a hardened
deploy path. **Proof:** the server suites (protocol, seats, tamper-reject, LAN-4,
rejoin, limits), a physical two-machine acceptance (network cut + server kill,
replayed hash-for-hash), and the live box.

## Axis 6 — maps, sound, reference, advisor, CI

Nine map types (the four classic plus fractal, oval, ring, inland-sea, clover
with balanced starts), 32 approved sound assets, the Encyclopedia, the advisor
card system, and the nightly soak. **Proof:** marker-0110's clean-clone and
independent lune reproduction; the additivity sweep 24/25 (single failure a
documented pre-existing tripwire).
Naval acceptance MEASURED and RULED (2026-07-31): the AI declines overseas
settlement on ring/inland-sea/oval — and equally on **continents, the shipped
default**, with archipelago the outlier at 5 overseas cities (the control that
proves the probe fires). So the novelty shapes are **no worse than the default**
on this axis. User ruling: SHIP them as the labelled opt-in group; the doctrine
gap is filed as `specs/unit-doctrine-v1x.md` §8 with its acceptance pinned to the
probe, not to a hash.

## Cross-cutting: determinism

One pure engine, state as plain data, every draw seeded and ordered; two
independent implementations agreeing byte-for-byte; the natural golden holding
545 rounds / winner p2 across SEVEN consecutive re-records spanning the entire
W6–W8 doctrine programme. Any game can prove itself: Shift+D downloads a
replayable recording, and `tools/replay.js` re-runs it.

## What v1.0 knowingly does not include

Nukes in the AI doctrine (v1.x, pending the marathon lane), counter-espionage
(a Civ 2 mechanic awaiting a civ-mixing decision), toroidal wrap (v2), and the
Roblox client's remaining parity tiers (a v1.x point release by ruling).

## Release mechanics status

- `GAME_VERSION` in `shared/version.js` is already `1.0.0`.
- Deploy defaults ruled and documented as the v1 baseline (how-to-host).
- GHCR publish is a repo-variable flip plus one verified run (checklist 4b).
- README/release-notes copy is in hand from the ally, title-swappable; the
  browser, mobile and Roblox clients now all display **A World Begun**.
- **User gate outstanding:** the professional trademark search on the title.

## Test health — stated plainly, because it was nearly overstated

The suite is **1027/1027, zero failures**, and the way it got there matters more
than the number. Three standing reds had been carried for several windows under
the label "known flake". Audited on a user instruction, only ONE was
environmental:

- **N3 "a coastal naval civ builds a ship"** — a REAL regression from W6 slice-3,
  dismissed four times because the isolation runs that "cleared" it were of the
  wrong file (`ai.test.js`, where the test does not exist, instead of
  `naval-probe.test.js`). Root-caused by toggling one knob and bisected with
  clean worktrees; the fixture had been silently covering two contracts, now
  split and both pinned.
- **B13 witness** — a genuinely stale artifact after the behavioural windows,
  regenerated.
- **Browser smoke** — the only real contention case, fixed at source (runner
  concurrency cap, an empty-dump retry, and four real-time budgets raised after
  measuring an onboarding session at 91.8s against a 35s deadline).

The reviewer lane owned the miss unprompted — and the architect's share was
larger than it looks: marker-0109 and marker-0110 both carry that flake
characterisation **in the architect's own words**, repeated from the reviewer's
verdict without ever running the file. A verdict adopted without checking is a
verdict owned, and that is how an unverified claim reached three tagged markers.
The rules that prevent it are now binding in `docs/18`: find the failing test's file mechanically, treat a recurring
red as a regression signal, and require evidence per run before the word "flake"
is used. **A release should be able to say what its green means.** This one can.

## Usage metrics (shipped in v1.0 by ruling)

Built by the hardening lane to `specs/metrics-v1.md`, reviewed for code,
placement AND privacy independently, merged. Counts only — no IPs, user agents,
tokens, names, game ids or seeds, and no per-request log; the endpoint is
loopback-checked on the SOCKET address and returns 404 (not 403) remotely so it
is not advertised. The operator reads it with one line over SSH. Rationale for
shipping it at 1.0 rather than after: post-hoc metrics cannot describe a launch
week.

The surface is also **documented where the project claims to enumerate its
surfaces**: `docs/16-security-assessment.md` §9 now carries the endpoint's
posture and the operator quick-card names it (reviewer PASS, merged at
`a0e59b3`). Adding a hosted surface without updating the assessment that lists
them is the ordinary way a security document goes quietly stale.

## Recommendation

The engine, client, server, Roblox twin, tests and documentation are at the bar
the checklist sets. **The RC marker can be tagged as soon as the RC sweep and
clean-clone confirm at the release tip** — everything after that is the
user-executed sequence: merge to main, `v1.0.0`, redeploy, GHCR flip.
