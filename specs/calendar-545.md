# Calendar 545 — the 550-turn normal game (user ruling 2026-07-20)

## Ruling

Normal game target: **~550 turns**, achieved primarily by slowing the EARLY
`yearSteps` toward Civ 1's pacing (user ruling; options presented and picked
via the two-question form, "Classic 545" + "Two markers").

New `data/rules.json` `yearSteps`:

```json
[{"until": 0, "step": 20}, {"until": 1500, "step": 10},
 {"until": 1850, "step": 5}, {"until": 2100, "step": 2}]
```

Landmarks (verified by walking `nextYear`): turn 200 = 1 AD, turn 350 = 1500,
turn 420 = 1850, **turn 545 = 2100 (game end)**. Replaces the current
50/25/20/10/5/2 table (t100 = 1 AD, t395 = end) — every step value is one of
Civ 1's own (20/10/5/2), just fewer bands. Start 4000 BC and end 2100 AD are
unchanged; `?marathon=1` (endYear 9999) continues at 2 y/turn past 2100 as
today.

## Why (evidence chain)

XII.5 probes (xii5 spec §11): normal 395-turn games NEVER reach space —
research leaders finish 26–29 of 68 techs vs the 46-tech space closure;
neither difficulty nor stance closes it. Ally verdict (§10): space belongs in
normal games (~t300–400 of a Civ-4-length game). Series comparison: Civ 1
≈550+ turns to 2100, Civ 2 420–570 to 2020, Civ 4 460–500 to 2050 — our 395
is the outlier, 15–45% fewer turns for the same arc. Lengthening the game via
the calendar is the authenticity-PRESERVING lever; bulb costs stay untouched
in this slice (secondary knob only if 545 turns still falls short — "primarily
yearSteps" per the ruling).

## Sequencing (user-picked: two markers)

1. **Marker N — XII.5 core fix lands first** (D2 = GO): the verified
   space-drive core fix + its golden re-record. Frees the six 25h-held locks
   and unblocks hardening 2b / D3 server-surfacing / 11b behind it.
2. **Marker N+1 — this slice**: yearSteps swap + its OWN full golden
   re-record (JS + Luau data checksum + every pinned scenario/sim hash that
   moves). Two re-records by design — clean attribution.
3. **Probe re-run after N+1** (the §11 harness, normal length = now 545t):
   measures the calendar's effect on the space race in isolation. Report the
   ally-§10 fields. If leaders still fall short of the 46-tech closure,
   bulb-cost tuning opens as the follow-up knob (separate ruling).

## Slice contents (engine lane, golden-affecting)

- `data/rules.json` yearSteps swap (above) — data-only; engine `nextYear`
  walk is table-driven and unchanged.
- `test/year.test.js` landmark wraps re-pinned to the new table
  (60→-1000-style anchors become 150→-1000 etc.).
- Full golden re-record per docs/05 process; Luau twins gate re-pinned
  (rules.json checksum + scenario final hashes + sim checkpoint hashes).
- Doc touches: CLAUDE.md play-section mentions of turn counts if any;
  `docs/how-to-host.md` § Sizing by RAM `--max-turns` tier values recalibrate
  (300/500/800/1500 were sized against a 395-turn game; ~1.4× them);
  `docs/12` §5 capacity note if it cites turns.
- Downstream awareness (no code change expected): `--max-turns` (yearAtTurn)
  and `shared/fastforward.js` age turns read the same table — verify the
  `?age=` fast-forward turn anchors still make sense on the stretched curve
  (they are year-based? confirm during the slice).

## Verification

- `nextYear` walk prints the four landmarks above.
- One full soak seed at 545 turns (chaos on) green.
- The §11 probe harness on 3 seeds × 545t: report techs-at-end distribution
  vs the 46 closure (the success metric this slice exists for).

## Permanent boundary (ally caution, 2026-07-21 — adopted)

Turn-year mapping stays DATA-DEFINED and one-directional: simulation reads
turns/state; UI maps turns to date labels; **displayed dates never feed AI,
victory, yields, saves, or replay logic**. Clarification of our standing
design: `state.year` is engine state (derived per-round from yearSteps) and
`rules.endYear` ends the game — Civ 1-authentic, deterministic, golden-safe.
The prohibited pattern is label→logic inference, and none exists.
