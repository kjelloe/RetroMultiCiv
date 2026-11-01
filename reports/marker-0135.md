# marker-0135 — retaliation-only AI nukes, the Roblox queue, a stricter command door

**Tag:** `marker-0135` at `7c161aa` · **merge-consistent — the user may
merge this** (supersedes marker-0133 and marker-0134; 0134 was declared
not merge-consistent for a stale test, fixed here). Includes a STAMP-ONLY
golden re-record and one wire tightening; both below. User go 2026-11-01.

The tag is local only (no GitHub credentials in the agent shell):
`git push origin dev_night marker-0133 marker-0134 marker-0135`.

## Delta since marker-0134

| Commit | What |
|---|---|
| `7ec846c` | marker-0134 report + doc sync |
| `495a4fb` | P3 retaliation-only AI nukes (engine + Luau twins, stamp-only re-record); the stale P4 test fixed |
| `b119137` | pedia combat concept + docs/01 nuke row; marker/sync-pass skills count failures |
| `1666b33` | Roblox queue items 1-6, 8, 9 (headless) |
| `2ca4d42` | A116 recorded; Luau plan status |
| `7c161aa` | A116 the command door refuses floats and null; saves-dir test flake |

## Items

1. **P3 — retaliation-only AI nukes (A115).** The AI never strikes first.
   Every detonation increments `players[attacker].nukesUsed`; a civ that
   has met and is at war with such a civ builds up to
   `rules.nukeDoctrine.maxStock` (2) nuclear units and strikes the
   aggressor's largest known, defended city in range, never one within
   `safeDistance` (2) of its own cities. The strike flies its whole leg in
   one turn (fuel 1). Why: patch-plan P3 — a one-sided weapon contradicted
   the "same engine as you" claim. The first-use half stays on
   plan-version2. `test/ai-nuke.test.js` (5 cases, JS == Luau).
2. **The stale P4 test.** `test/tech.test.js` asserted the pre-P4 clamp; it
   was red at marker-0134, hidden by `t.sh`'s 40-line failure cap. `t.sh`
   now prints a `FAIL:` line per failing test; the marker and sync-pass
   skills say to count them.
3. **Roblox queue (8 of 9 items).** Animals, era roads/rails and city road
   joins, the `roadStageFor` twin, Gamepedia → Encyclopedia, the
   `buildingSold` turn-log line, encyclopedia concept sync, the ruleset
   re-bake, and the GameServer command door (item 6: `luau/state-string.luau`;
   `claimSeat` and non-state-legal payloads refused). Verified by the
   `roblox/selftest` parity harnesses and a lune compile; no Studio here.
   Item 7 and the visual checks need the user's Studio session.
4. **A116 — the browser command door refuses floats and null.**
   `onlyStateValues` gates every `cmd`; before, a float or null passed the
   door and, if the engine stored it, the next hash threw and closed the
   game. Lobby options keep the looser string check.
5. **Encyclopedia text.** The combat concept states the nuke rule; the
   upkeep concept (0134) states the bankruptcy rule.

## Golden re-record (P3, stamp-only)

`rules.nukeDoctrine` moves the rulesetHash stamp; no AI in the soak ever
detonates a nuke, so behaviour is unchanged: BEHAVIOR_SOAK and
BEHAVIOR_NATURAL did not move.

| Pin | New |
|---|---|
| GOLDEN_SOAK 100 / 200 / 300 / 400 | 0x85358d50 / 0x8cd88873 / 0x3829de74 / 0x06bfeed9 |
| GOLDEN_NATURAL | 0xdce82beb (545 rounds, winner p2) |
| Scenario 002 / 024 | 0x4e9a27f3 / 0x8220b2fb (024: nukesUsed) |
| ff-parity | 0x11a7fcd4 turn 25 grant 22 |
| age-snapshot CANONICAL_PIN | 0x0c3ab9c6 |
| nine map-type pins | in test/luau-twins.test.js |

Luau `sim-smoke.luau 400` and `natural` reproduce every pin.

## Breaking notes

- Goldens re-recorded (stamp-only, above).
- Wire: the socket now refuses a `cmd` holding a non-integer number or
  null (badShape). No shipped client sends either; fastengine's client must
  send integers only.
- Roblox: the GameServer refuses non-allowlisted command types and
  non-state-legal payloads; the baked rulesets were regenerated.
- fastengine mirrors `engine/combat.js` (nukesUsed); named in `495a4fb`.

## Test state

- `node --test test/`: 1085 tests; 1084 pass, 10 skipped; the one failure
  was the saves-dir flake, fixed in `7c161aa` and green alone.
- Playwright lane: 65 passed, 2 skipped.
- Luau: twins gate (lune 0.10.5) green; full goldens match.
- Roblox parity harnesses: all exit 0.
