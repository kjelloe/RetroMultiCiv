# marker-0112 — the release candidate

**Tag:** `marker-0112` at `2e0511c` (dev_night)
**Previous:** marker-0111 at `db76757`
**Delta:** 28 commits, 58 files, +2457 / −184
**Consistency: MERGE-CONSISTENT — the user may merge this.** It supersedes
0102–0111 and is the tree the v1.0 release is cut from.

This marker exists because the RC gate found something. The plan on 2026-08-02
was to tag the RC directly from marker-0111; the canonical sweep came back
24/25 and the failing seed turned out to be a real engine defect rather than a
harness artifact. Root-causing it found a second defect, and a user report found
a third. All three are fixed here, each in its own window, each independently
gated.

---

## 1. The barbarian ceiling + capture garrisons (`f210760`)

**What the sweep found.** Seed 25 failed the sim-driver's >1000-unit invariant
at turn 340: 1004 units, of which **695 were barbarian-owned** — 69% of
everything on the map against 309 for all five surviving civs combined. Two
civs were already dead and barbarians held their cities.

**Root cause.** `engine/cities.js processCities()` iterates `state.cityOrder`
with no owner filter, and `engine/combat.js captureCity()` set the captured city
to produce a defender. A barbarian-held city therefore kept its food box, kept
growing, and kept shipping units forever, with no upkeep to bound it.
Reproduced on a crafted state rather than inferred: one size-3 grassland
barbarian city produced 6 militia in 80 turns and grew while doing it.

**User rulings (2026-08-02), in the order given.** Barbarian cities keep
producing **basic units** — they are nomads, not an administration — so the
architect's first proposal (freeze production in barbarian-held cities) was NOT
taken. Every other civ follows the regular building procedure **at its own tech
level**. A **ceiling of 128** replaces the upkeep barbarians never paid, and at
the ceiling the hordes **furthest from a civ city** give up first. An earlier
draft (a flat 30-tile self-disband radius) was withdrawn by the user.

**What shipped.** `captureCity` now calls `bestDefenderUnit` — the helper
founding has used since §46 — so the captor garrisons at its own era: militia →
phalanx → musketeers → riflemen → mech-inf. Barbarians hold no techs, so the
same helper returns militia for them **with no special case in the code**: the
nomad outcome falls out of the general rule instead of sitting beside it as an
exception that could later drift. `enforceCap` in `engine/barbarians.js` ranks
barbarian units by distance to the nearest **non-barbarian** city (a barbarian
city is a camp, not a raid target, so it must not keep a horde alive) and
disbands furthest-first with an id tie-break so both engines agree. Omit
`rules.barb.maxUnits` and there is no cap at all.

`barbariansDispersed` is **deliberately silent** in the turn log: the units it
removes are by construction the ones no seat can see, so announcing them would
report events from inside the fog.

**Provenance.** The ceiling and the disbanding are **RetroMultiCiv, not
recreated Civ 1** — the wiki documents only the *leader* disbanding once clear
of civ cities. The captured-city economy fix IS faithfulness: *"Barbarians do
not function as a regular civilization"* is explicit in the source.

## 2. The diplomacy met-gate, A105 (`845a036` + `6926d34`)

**User report:** the diplomacy panel listed every living civ **by name** and
offered a peace treaty to civs on the far side of an unexplored map. A fog leak
plus a mechanic that should not exist.

It was a deliberate D1 deferral that outlived its reason. D1 deferred `notMet`
because there was no engine met-state; D3 then shipped `contactPass` and
omit-safe `met`, which retired the objection — but nothing consumed it on the
command path and the deferral note stayed. **That is how a deliberate deferral
quietly becomes a defect: the reason expires and the note does not.**

Client half: `haveMet()` in `shared/diplomacy-view.js`, mirroring engine `metOf`
including its omit-safe reading; unmet civs render as an anonymous row, kept
rather than hidden because setup and the score already reveal how many powers
exist. Engine half: `diplomacyCommand()` rejects unmet targets, twinned, pinned
cross-language by scenario 069 across all three command kinds.

**Golden-neutral by measurement** — the goldens did not move, because
`engine/ai.js` already gated its own diplomacy on `metOf`.

**A finding that fell out of the migration.** `contactPass` creates the pair
entry as `{ state: 'war' }` and only then sets met, so a met pair always carries
an explicit war entry and `declare` returns `alreadyWar`. **Declare-from-default
is unreachable in play, and `WAR_DECLARED` is in practice a treaty-break event.**
Coherent — Civ 1 has no formal declaration and war is the default — but written
down nowhere, and two unit tests plus scenario 012 were asserting a path that
cannot occur. All three now pin the real behaviour.

## 3. CI had been failing every night, for three reasons (`2e0511c`)

None a defect in the game; all three made the nightly useless as a signal.

- **The natural soak ran 400 turns and cannot reach its own victory.** The
  step's comment said the calendar puts 2100 AD at ~turn 395 — true when
  written, stale since: `GOLDEN_NATURAL` pins the score victory at round 545. So
  every seed reported "NO VICTORY by turn 400". `specs/measurement-program.md`
  §6 documented this exact artifact (#2823) and mandated `--turns 600`; CI was
  never updated to match. **The spec knew; the workflow did not.**
- **The job exceeded its 45-minute budget and was cancelled**, which reads as a
  failure with no failing assertion. W6–W8 made late-game states 15–20× heavier
  per turn. Raised to 120.
- **The visual goldens were never handed over to CI.** `visual-check.sh` says in
  its own header that the committed PNGs were bootstrapped locally and the first
  CI nightly re-records the authoritative set. That handover never happened, so
  the byte-compare mismatched from 18 July onward. Re-recorded from the
  dev_night CI actuals; both images were **opened and eyeballed**, not merely
  byte-swapped.

---

## Golden re-record

One behavioural window (§1); §2 and §3 moved nothing.

| pin | from | to |
|---|---|---|
| `GOLDEN_SOAK` t100–t400 | 0x1392d799 / 0x096df72c / 0x5d92e626 / 0x55dff9e5 | **0x6d5e57f7 / 0xfe085012 / 0x35a50384 / 0xfbabb143** |
| `GOLDEN_NATURAL` | 545 / p2 / 0x7550defb | **545 / p2 / 0x4f2c1018** |
| `BEHAVIOR_SOAK` | 0x184dd153 / 0x24ad814c / 0x104a0912 / 0x3d8e2731 | **UNCHANGED** |
| `BEHAVIOR_NATURAL` | 0xa7463164 | **0xffa2a785** |
| scenario 002 | 0x3ca07386 | 0x8b6d7d26 |
| scenario 012 | 0x58c90df3 | 0xc4a23d25 (rewritten) |
| scenario 068 / 069 | — | 0xe306b2d9 / 0x2a4acd11 (new) |
| age-snapshot `CANONICAL_PIN` | 0x85843449 | 0xb9c64c9c |
| `FF_PARITY_PIN` | 0x46ab7030 | 0x83b04c7d (turn 25 / grant 22 unmoved) |
| nine map-type anchors | — | all nine (stamp) |
| Luau sim-smoke t100 | 0x1392d799 | 0x6d5e57f7 |

**The #28 classification is unusually clean.** All four `BEHAVIOR_SOAK`
checkpoints are byte-identical to the W8 record, so neither change fires within
400 turns on 4 civs at 56×35. Only `BEHAVIOR_NATURAL` moved — and the natural
game runs 545 rounds, long enough for a post-gunpowder capture and for
barbarians to reach the ceiling. That is the signature you want: the change bites
where it should and nowhere else. Those held soak hashes are also the
anti-paste-back evidence, since a pasted-back stamp move cannot produce four
unchanged behaviour hashes beside four changed full ones.

Natural **545 / p2 holds an eighth consecutive re-record.**

## Gates

**Reviewer, `f210760` — GREEN, 0 fail.** Pristine clean-clone with a fresh
object store: 1047 tests / 1044 pass / 0 fail / 3 skipped. It reproduced the #28
split independently under lune rather than accepting the architect's
classification, and — correctly — declined to declare the axis closed on hashes,
naming the sweep as the authoritative proof.

**Reviewer, A105 delta — CONFIRMED, no defects.** Verified golden-neutrality by
*control flow* (all four AI diplomacy emissions sit inside the `metOf`-gated
loop at `ai.js:2595`; no diplomacy command appears in the sim driver or chaos
injection), which is a stronger argument for this question than a sim run.

**Sim-runner, canonical 25-seed sweep at `f210760` — CLEAN.**

| metric | f210760 | a0e59b3 | floor |
|---|---|---|---|
| M2-cities | 18 | 18 | ≥ 6 ✅ |
| M3-pop | **67** | 63 | ≥ 22 ✅ |
| M4-improvement % | 91 | 91.5 | ≥ 50 ✅ |
| M10-buys | 15 | 16 | > 0 ✅ |
| M10-treasury | 0 | 0 | < 50 ✅ |
| resource coverage % | **84.5** | 83 | ≥ 80 ✅ |

All 25 seeds reach t401 with no tripwire. Seed 25 — the failure — completes
clean. Pop and coverage came *up*, because seed 25 now contributes a full
late-era game instead of aborting.

**Does the ceiling actually fire?** Measured directly rather than inferred from
the tripwire not firing:

- binds on **4 of 25 seeds** (rounds 181–240), held **101–187 rounds**
- global max barbarian count **128 exactly** — never exceeded
- non-binding seeds peak at **4–73** barbarians, untouched
- global max total units **530**, against 1004 before
- seed 25: 465 total, 128 barbarian, clean to t401

So it is a load-bearing mechanic on 16% of seeds and correctly inert on the
rest. The failure mode worth worrying about — a cap that deletes the threat
rather than bounding it — did not happen.

**Cross-machine determinism.** The architect ran the same sweep on the dev box
while the sim-runner was blocked; seed 25's final hash is `0xf3b2ea53` on both
machines with identical medians.

## Test state

1048 tests. The two browser probes that failed under full parallel load
(measured 36.3s and 35.3s against 20-second windows, green twice in isolation on
the right file) were fixed at source by raising four live-page budgets, per
docs/18 rule 5 — not labelled flaky. The reviewer's one note stands on the
record: a 90s ceiling widens the window in which a real slowdown on those paths
passes silently, accepted as the trade for suite-load contention.

## Breaking notes

- `data/rules.json` gains `barb.maxUnits` → `rulesetHash` moves → every
  `createGame` stamp moves. Roblox re-baked at `ae21749`.
- Save compatibility: unaffected. No state shape changed.
- A running game on an older tree will diverge on replay, as with any
  behavioural window.

## What this marker deliberately does not close

Barbarian units still only hunt within `HUNT_RADIUS` 8 and idle otherwise, which
is the likelier reason hordes accumulate at all. Making them seek at any range
was discussed with the user and NOT built: it changes AI aggression and needs
its own measurement. Filed rather than smuggled in.
