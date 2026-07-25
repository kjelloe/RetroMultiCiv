# marker-0105 — W1+W2 engine program (diplomacy sabotage-discovery + building effects)

**Tag:** `marker-0105` @ `b05a934` · **Consistency:** MERGE-CONSISTENT (user may merge this).
**Supersedes** marker-0104 (@bbfa85c) as the merge candidate.
**Reviewer gate:** clean-clone `--full` + engine-diff + independent lune twin
repro GREEN on both halves — W1 #2724, W2 #2736 (@df90536f).

## Delta since marker-0104

Two serialized engine golden windows from the ordered v1 engine program
(`specs/engine-program-v1.md`), plus two golden-neutral batches riding on top.

| Commit | Lane | Class | Summary |
|---|---|---|---|
| `9dfc975` | bugfixer | STAMP-only | W1 diplomacy: discovered-sabotage + investigateCity re-apply |
| `a7f9da7` | architect | STAMP-only | W2 building effects: Mfg. Plant + SDI nuke-intercept |
| `fcfc574` | sim-runner | golden-neutral | roblox W2 data re-bake (buildings/rules twins) |
| `b05a934` | helper | golden-neutral | mobile-session-3 interaction cluster + #11 + #15 |

## W1 — diplomacy sabotage-discovery (@9dfc975, bugfixer)

- **discovered-sabotage:** a steal-tech / sabotage mission roll now produces a
  DISCOVERY outcome, botch-amplified via `discoveryPctOnSuccess` /
  `discoveryPctOnFail`; discovery applies a reputation hit through the shared
  `applyReputationHit` path + grievance fallout. `engine/diplomacy.js` +
  `engine/diplomat-missions.js` and their `luau/` twins.
- **investigateCity re-apply** (scenario 065 pin, behavioral `0x8771d49a`).
- New knobs in `data/rules.json` (in the rulesetHash) → STAMP-only createGame
  cascade re-record; BEHAVIOR_SOAK/NATURAL byte-identical. GOLDEN_SOAK re-pinned
  `0x318ba4c3..`. Twins 11/11 JS==Luau.
- Fixtures: `test/diplomat-missions.test.js` (+55), event-catalog +4.

## W2 — building effects (@a7f9da7, architect)

- **Mfg. Plant:** `shieldBonus 100` + `obsoletesFactory`. The Factory shield
  bonus is excluded when a `boostsFactory`/`obsoletesFactory` building powers the
  city (Mfg.+Factory = +100%, not +150%); Power Plant doubling path unchanged.
  Two-pass deterministic integer sum in `engine/cities.js` `cityShieldOutput` +
  `luau/cities.luau` twin. Fixture `test/cities.test.js`.
- **SDI Defense:** `blocksNuke` effect + `rules.sdiInterceptPct 70` (Civ1
  wiki-verified: 70% intercept, protects only the city it sits in). A nuke on a
  city holding an SDI building rolls `rollRange(state.rngState, 100) < 70` →
  intercepted: no detonation, garrison + city survive, one-shot missile still
  consumed, `nukeIntercepted` event. The intercept draw threads the shared RNG
  ONLY on a nuke-vs-SDI-city, so the AI soak stream is untouched (dormant path).
  `engine/combat.js` `resolveAttack` + `luau/combat.luau` twin. Fixtures
  `test/combat.test.js` (pct-100 hit, pct-0 miss).
- Effects authored in `tools/mapdata.js` BUILDING_OVERLAY (buildings.json
  REGENERATED, not hand-edited — the mapdata-regen guard).
- Coverage: `obsoletesFactory` + `blocksNuke` effect text (catalog-text.js);
  `nukeIntercepted` registered in EVENT_TYPES + classifyEvent + soundForEvent.
- NEW cross-language scenario `066-sdi-intercept.json` (final `0x7d67d913`,
  rngState 42 → 32<70 intercept) runs the SDI intercept through BOTH engines.

## Golden re-records (W2 stamp cascade — STAMP-ONLY)

Both W1 and W2 edit a `data/*.json` in the rulesetHash (rules.json + buildings.json),
so the createGame stamp ripples into every createGame golden while the trajectory
is unchanged. The reviewer EMPIRICALLY verified this (independent lune repro), not
just asserted it — the AI-buildable Mfg. Plant risk was checked and cleared.

- `simulation.test.js` GOLDEN_SOAK `{100 0x484da93c, 200 0xe40d5a2b, 300
  0x529a0dec, 400 0xa7c3a1b5}` / GOLDEN_NATURAL `0xb6232e74` (545, p2).
- **BEHAVIOR discriminator UNCHANGED** (proof of stamp-only): BEHAVIOR_SOAK
  `0x7d88a531 / 0x47486030 / 0xd7aee69b / 0xef6bf46c`, BEHAVIOR_NATURAL
  `0x8d3c2153` — byte-identical to D5/W1. Rounds 400/545 + winner p2 unchanged.
- `scenarios/002-mapgen-determinism.json` `0x03465e9c`.
- `age-snapshots` CANONICAL_PIN `0x67171377`.
- `luau-twins`: sim-smoke checkpoint 100 `0x484da93c`; FF_PARITY_PIN
  `0xc247f5e7`; A82a maptype pins (continents a65baa2e / pangaea 29c44de3 /
  archipelago 9eda0c80 / islands 060966f8). Data-hashes: buildings.json
  `0x0b40a48f`, rules.json `0x37015786` (== sim-runner re-bake).

## Golden-neutral batches on top

- **roblox W2 re-bake (@fcfc574):** roblox-data twins regenerated from the new
  buildings.json/rules.json (GATE-4 style). No engine logic; golden-neutral.
- **mobile-session-3 (@b05a934):** interaction-cluster tap model (#8/#12/#14 +
  B1), #11 end-turn next-movable auto-select, #15 minimap portrait height bug.
  Client + renderer only, no engine/state/hash. move-hints.test.js 14/14,
  browser e2e 19/19.

## Breaking notes

None. STAMP-only + golden-neutral. No protocol/save-format change. Running games
and other lanes need no reaction beyond the roblox data re-bake already landed.

## Test state at b05a934

Full suite `debugging/t.sh`: **954 pass / 1 fail / 0 skipped** locally. The one
red is `save-envelope.test.js` "B13 witness" reading
`debugging/logs/retromulticiv-witness-b13.json` — a **gitignored, untracked**
local recording, stale from before the W1/W2 stamp re-records. It self-skips in a
clean clone (absent), which is why the reviewer's clean-clone was 951/0-fail with
3 skipped. NOT a merge-consistency blocker; regen routed to sim-runner (#2650).
