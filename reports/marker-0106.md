# marker-0106 — W3 score happy-citizen term

**Tag:** `marker-0106` @ `6cad106` · **Consistency:** MERGE-CONSISTENT (user may merge this).
**Supersedes** marker-0105 (@b05a934) as the merge candidate.
**Reviewer gate:** GREEN #2741 (@0cceafdc) — engine-diff + working-clone tests + twins.

## Delta since marker-0105

One engine golden window (W3 of the ordered engine program) plus its golden-neutral
roblox data re-bake.

| Commit | Lane | Class | Summary |
|---|---|---|---|
| `aa6197e` | architect | STAMP-only | W3 score happy-citizen term (spec §10) |
| `6cad106` | sim-runner / roblox-helper | golden-neutral | roblox W3 data re-bake (rules twin) |

## W3 — score happy-citizen term (@aa6197e, architect)

- `scoreBreakdown` adds a `happy` term = `happyCitizens * rules.scorePerHappy` (1).
  Happy citizens are summed per city via the pure `cityMood()` read over a single
  `resolveAllWorked()` A8-contention snapshot — no RNG, no state mutation.
  `engine/score.js` + `luau/score.luau` twin (byte-shaped). `data/rules.json` gains
  `scorePerHappy` (hand-maintained knob, not generated).
- Pollution term DEFERRED — spec §10 marks it "off/optional in v1."
- Fixtures `test/score.test.js` (8/8): existing breakdown fixtures carry the new
  field; a new case asserts `bd.happy == cityMood().happy * scorePerHappy` (via a
  Cure for Cancer `happyEverywhere` city — no hard-coded literal).

## Golden re-records (STAMP-ONLY)

`rules.json` sits in the rulesetHash, so the createGame stamp ripples into every
createGame golden while the trajectory is unchanged. Verified STAMP-only via the
null-and-run: score() is not hashed and the AI does not read it, so the only
trajectory surface is the endYear score-decided winner (unchanged, p2).

- `simulation.test.js` GOLDEN_SOAK `{100 0x0b84b4d1, 200 0x504ba7a0, 300 0x352eca5d,
  400 0x31e11976}` / GOLDEN_NATURAL `0x2b5c539d` (545, p2).
- **BEHAVIOR discriminator UNCHANGED** (proof of stamp-only): BEHAVIOR_SOAK
  `0xef6bf46c`, BEHAVIOR_NATURAL `0x8d3c2153` — byte-identical, verified by the
  behaviorHash asserts passing while GOLDEN moved.
- `scenarios/002-mapgen-determinism.json` `0x2ee49a35`.
- `age-snapshots` CANONICAL_PIN `0xdb5d13e2`.
- `luau-twins`: sim-smoke checkpoint 100 `0x0b84b4d1`; FF_PARITY_PIN `0xb5d66cb8`;
  A82a maptype pins continents `87cc4189` / pangaea `7db1212e` / archipelago
  `49ccdc73` / islands `1f57f483`.

## Reviewer gate (GREEN #2741 — with a deferred item)

Confirmed clean: Lua-portable subset, determinism (no RNG, pure reads), twin
byte-shape, STAMP-only (#28 BEHAVIOR unchanged), fixture rigor, Civ1 provenance.
Tests run in the working clone at HEAD==aa6197e: score 8/8, simulation+age 14/14,
luau-twins 11/11 under lune.

Deferred (blocked on reviewer-lab sandbox approval this turn, accepted by the user
to tag now): the pristine clean-clone `marker-gate.sh --full` and the 400-turn Luau
golden (`lune sim-smoke.luau 400`). The 100-turn Luau twin + JS 400-turn soak are
both green, so JS==Luau parity is high-confidence; the 400-turn Luau *extension* is
the only unverified surface, on a change that is STAMP-only and dormant in the soak.

## Breaking notes

None. STAMP-only + golden-neutral. No protocol/save-format change.

## Test state at 6cad106

Broad JS suite 789/790 — the only red is `save-envelope.test.js` "B13 witness"
reading the **gitignored, untracked** `debugging/logs/retromulticiv-witness-b13.json`
(stale local artifact; absent in clean clone → self-skips there). Not a
merge-consistency blocker.
