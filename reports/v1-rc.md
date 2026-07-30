# v1.0 release candidate — the evidence digest

DRAFT, assembled ahead of the RC marker (`specs/v1-release-checklist.md` step 1).
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
**[RC]** re-confirm the floors on the RC marker.

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
**[RC]** naval acceptance for the water-heavy shapes — running; feeds the
ship-or-hold decision filed as human-workitems B3.

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
