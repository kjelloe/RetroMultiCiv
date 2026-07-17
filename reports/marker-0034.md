# marker-0034 — B23d relaxed scout threat-veto (structural exploration fix)

- **Commit:** 9e558fe (tag marker-0034)
- **Base:** marker-0033 + everything committed between (A82a phase-1/2 map
  types, A57 left-stack reflow, the N4 defer, the N9 root-cause note).
- **Type:** engine AI change (golden-moving); both engines + goldens re-recorded.
- **Tests:** 450/450 zero-skip.
- **Status:** committed + pushed; PENDING the sim-runner's exploration A/B
  before the architect declares the marker consistent (tests pass; the
  behavioral confirm that exploration recovers is the open gate).

## Delta since marker-0033

### N4 garrison cap — measured and DEFERRED (not shipped)
Before B23d, the N4 garrison-cap slice was built end-to-end (engine + byte-
faithful luau twin + sweep test) and measured against the sim-runner's
pacifist unit-bloat tripwire (seed 6, 7 civs, medium, no chaos,
defenderGatePct=100):

- HEAD 1023 units → N4 disband-off 820 (−20%) → N4 disband-on 646 (−37%).

N4 cleared the >1000 tripwire but the interior-economy measurement at the
default config (#980) was decisive against it: at the warlike dg=30 default
the AI is ~82% military and builds ~0 buildings regardless, so freeing
interior production became more military/settlers rather than economy
(bldgPct 0.5→0.0, imprPct 69→58, pop down). The garrison cap degraded the
economy floors it was meant to help. Ruled DEFER (#981); all N4 work reverted
to canonical (tree byte-clean, no golden movement from N4). The code is
preserved off-tree as the basis for a re-scoped per-empire soft unit cap (the
bloat is empire-level city/settler churn, not per-city garrison stacking).

### Engine: B23d — relaxed scout threat-veto
The `isScout` threat-veto previously benched a scout whenever its NEAREST OWN
CITY was within `threatRadius` of a visible enemy. That coupled exploration to
garrison pressure: a scout ranging safely far away was recalled the moment any
home city was menaced, and a multi-city civ whose cities were pressured
stopped exploring entirely (the exploration deficit, sim-runner #797).

B23d vetoes a scout ONLY when the SCOUT ITSELF is within `aiScoutVetoRadius`
(new knob, default 2) of a visible enemy — the scout's own safety, not its
city's. The `guards>=2` departure floor in the garrison block already keeps a
city from being stripped below one defender, so scouting and garrison safety
are now decoupled: a safe far scout keeps ranging while its home city is
menaced; a scout adjacent to a threat is still benched (it would otherwise walk
into it).

- `engine/ai.js`: veto rewritten to `enemyNear(scout.x, scout.y, aiScoutVetoRadius)`;
  the now-orphaned `nearestOwnCity` helper removed (isScout was its only caller).
- `data/rules.json`: `aiScoutVetoRadius: 2` added (sweepable).
- `luau/ai.luau`: byte-shaped twin (veto + orphan removal).
- `test/scout-allocation.test.js`: the B23b city-menaced-veto test replaced by
  B23d behavior (distant scout ranges while its city is menaced; scout adjacent
  to a threat benched) plus an `aiScoutVetoRadius` sweep (radius 2 vs 3). 7/7.

### Goldens re-recorded (behavior change; JS == Luau confirmed)
- soak checkpoints 100/200/300/400:
  0x021b89c6/0x5eb2ad2e/0x2cfa85b1/0x73f85601 → 0x140d2a34/0x2bb3e3e9/0x00c070ec/0x09e4cec2
- natural end: 0x71bf50f1 → 0xf8800a5d (395 rounds, winner p2, unchanged)
- `luau-twins` turn-100 anchor + `sim-smoke` pin → 0x140d2a34
- witness (`debugging/logs`, gitignored) regenerated under B23d: turn 121,
  finalHash 0xa02b849e, replays clean.

JS and Luau produce identical hashes at every checkpoint and the natural end
(`luau/sim-smoke.luau 400` / `natural`).

## Breaking notes
- Golden re-record: any lane pinned to the old soak/natural hashes updates to
  the values above. `aiScoutVetoRadius` is a new `data/rules.json` key (the
  twins count-check picks it up; the twin reads it with a default-2 fallback).
- No save-format or protocol change.

## Test state
450/450, zero skip (full `debugging/t.sh` run), luau twins green under lune.
