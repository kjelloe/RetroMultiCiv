# marker-0070 — Calendar-545: the ~550-turn normal game

Delta since marker-0069 (XII.5 core-fix re-record). One slice: the yearSteps
swap that stretches a normal game from ~395 turns to ~545, per the user ruling
(specs/calendar-545.md). Data-only engine change + its full golden re-record.
Follows marker-0069 as the second of the two-marker split (clean attribution).

## What changed and why

- **data/rules.json `yearSteps`** — replaced the six-band 50/25/20/10/5/2 table
  with the four-band `[{until:0,20},{until:1500,10},{until:1850,5},{until:2100,2}]`.
  Every step value is one of Civ 1's own (20/10/5/2); the change is fewer, slower
  early bands. Start 4000 BC and end 2100 AD unchanged. `nextYear` is table-driven
  (engine/index.js), so no engine-code change. rulesetHash moved
  cf919a65 (was the XII.5 victoryDrive hash).
  Verified landmarks (yearAfter(wraps), wraps = turn-1): yearAfter(200)=0 (1 AD),
  yearAfter(350)=1500, yearAfter(420)=1850, yearAfter(545)=2100 (score end,
  turn 546). Natural all-AI game now runs 545 rounds (was 395).

- **The `ages` table was NOT touched** (verified, not an oversight): its per-age
  `turn` anchors (renaissance 190, industrial 256, modern 305, space 325) are
  turn counts fed to fastforward.js as targetTurn. Research is turn-paced, not
  year-paced, so the tech state at a given turn is unchanged by the calendar — a
  `?age=` start gives the same world as before; only the displayed year at that
  turn shifts. No recalibration needed (spec: "no code change expected").

## Golden re-record (rulesetHash + year-in-state ripple)

Unlike marker-0069 (a rulesetHash-only ripple that left crafted scenarios
byte-identical), the calendar moves `state.year`, which IS hashed, so every
scenario that ADVANCES A TURN in an ancient/BC year moved. Later-era scenarios
stayed byte-identical — old and new tables share the same step for years ≥ 1000
(10/5/2), so only ancient-era scenarios drift. That is the expected shape.

- **22 scenario final hashes** re-recorded (the ancient-era set): 001, 002, 003,
  004, 005, 006, 007, 008, 009, 010, 012, 015, 016, 018, 019, 022, 023, 027,
  029, 030, 034, 039. The other ~23 scenarios are byte-identical.
- **test/simulation.test.js**
  - GOLDEN_SOAK checkpoints 100/200/300/400 + finalHash →
    0x9b26dc5f / 0xf3630524 / 0x974b9494 / 0x1d462162 (rounds 400 unchanged; the
    soak runs endYear=9999 so only the hashed year sequence moved).
  - GOLDEN_NATURAL → rounds 395→**545**, winner p2 (unchanged), finalHash
    0xd5a7d301. The turn budget + test name moved 399→550 (the game now ends
    ~turn 546). This re-record is NOT behaviorally-neutral by design — the whole
    point is a longer game; the same civ still wins the score end.
- **test/luau-twins.test.js** — turn-100 checkpoint → 0x9b26dc5f; A82a map-type
  presets → continents 123ad8c1 / pangaea 7ca74dfa / archipelago 2e244d61 /
  islands 37a995bc; FF_PARITY_PIN → 0x1192dca7; rulesetHash-chain comment
  extended (… → 0x1192dca7 Calendar-545). The luau data-checksum test is a
  cross-language agreement check (not a frozen pin), so it passed unchanged.
- **test/year.test.js** — the six landmark anchors re-pinned to the new table:
  yearAfter(150)=-1000, (200)=0, (300)=1000, (350)=1500, (420)=1850, (545)=2100.
  The past-end guard and the no-yearSteps flat-+20 test are unchanged.

## Cross-lane re-pins (calendar ripple beyond the golden subset)

Two year-at-turn assertions in files outside the calendar-545 lock subset moved
because the year math changed. Both claimed by lock + flagged to the owning
lanes; mechanical re-pins only, no logic change:

- **test/lobby.test.js** — yearAtTurn(turn 2) -3950 → -3980 (first step +50 → +20).
- **test/server.test.js** — the #1875 operator-caps test: `--max-turns 100`
  clamps endYear to yearAtTurn(100), which on the stretched calendar is -2020
  (99 steps of +20 from -4000), was -25. The cap still ends the game at turn 100;
  only the year that encodes "turn 100" changed.

## Doc touch

- **docs/how-to-host.md** — the RAM-sizing `--max-turns` tiers recalibrated ~1.4×
  (the natural game grew 395→545): 300/500/800/1500 → 420/700/1120/2100
  (32 GB stays unlimited). This preserves the same "fraction of a full game" each
  RAM tier affords. docs/12 and CLAUDE.md carry no turn-count figures that moved.

## The measurement this slice exists for (§11 probe at 545t, 3 seeds)

Does the longer calendar alone let AI leaders reach the space tech chain?
Result: it helps, but does NOT close the gap on its own.

- Leader techs-at-end grew from 26–29 / 68 (at 395t) to **38–47 / 68** at 545t
  (seed 11 = 38, seed 42 = 40, seed 7 = 47) — a real +12–18 techs from the extra
  ~150 turns of research.
- But space-flight was unlocked in **0 of 3** seeds (sfUnlock never fires), so
  no civ builds Apollo or launches. Notably seed 7 reached 47 techs — past the
  46-tech prerequisite COUNT — yet still no space-flight, because the AI does not
  prioritise the space tech PATH (computers/rocketry/…); the shortfall is now as
  much tech-CHOICE as tech-COUNT.

Per specs/calendar-545.md, this opens the follow-up knob as a SEPARATE ruling:
bulb-cost tuning and/or AI space-tech prioritisation (ties into XII.5b /
xiv-ai-behavior). The calendar itself is the authenticity-preserving base and
lands on its own merits (longer, Civ-1-paced game); it is not sold as delivering
space launches.

## Test state

Full suite green on the re-record: only reds are the known non-marker flakes —
the local gitignored B13 witness recording (self-skips on clean clones), the
SIGTERM server-shutdown flake, and the XIV server tests that flake under
parallel load (all pass isolated). luau-twins 9/9 (JS==Luau bit-exact), year
3/3, one 545t soak (chaos on) clean + deterministic (final 0xca588d02).
Gate-B heavy-Luau (200/300/400/natural) is sim-runner's confirm on the
stabilized tree.
