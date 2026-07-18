# marker-0059 — N9b: AI build-priority + the builder wonder-drive

The AI-quality lever the ally's framework and three measurements
pointed at: the AI now converts production into buildings and — the
user's ruling — *some civs visibly commit to wonders*. A two-phase
close (code byte-shaped → sim sweep → one golden re-record).

## The building lever

At the production-choice site, when a city would pick a UNIT past its
garrison floor and is not threatened, a buildable yield-building whose
PAYBACK beats the stance-scaled ceiling wins instead. The payback
denominator reuses the engine's OWN income math — `cityEconOutput`
extracted byte-neutrally from `playerIncome` (RULE A, the anti-drift
seam: preview and charge agree by construction), not a parallel
formula. It DEFERS to defence under war (R3), keeps an in-progress
building via R1 decision-stickiness (no flip-flop shield forfeit).

The sim sweep's key finding (sim-runner #1583): at war level dg=30 the
lever is INERT to tune — cities are threatened often, so it correctly
defers, and the modest ~8% building share is the HONEST selective
outcome, not a miss. High building at dg=30 is *incompatible* with
keeping wars happening — which the user reframed as correct:
elimination is a function of the personality mix, and a peaceful mix's
high-building/low-elim IS the economic ending. So the lever builds
when safe, defers when threatened — right across every mix; only the
outcome distribution shifts.

## The builder wonder-drive (Finding-3 fix)

Two probes (the bugfixer's diagnostic + the sim-runner's marathon to
t751) agreed the wonder-drive NEVER fired — a full-tech civ with 110
post-space-flight turns started no wonder. Root cause: the drive was
buried inside the garrison/saturation cascade, and a builder capital
almost never reached it (its militia scout away, so it holds 0
defenders exactly at the wonder window). HOISTED to a first-class
capital-intent check above the cascade.

Deviation ratified (data-driven): the gate is NOT-THREATENED alone,
not min-garrison-1 — instrumentation disproved the "1+ defender"
premise (0 defenders at the wonder window). Frontier-safety comes from
the per-turn enemyNear re-check + R1 revert (a menaced capital falls
to defence even mid-wonder), not a static count. A 0-defender capital
drives only while no enemy is within the threat radius. The
hard-min-garrison follow-up (stop the capital's first defender
scouting away) is noted, out of N9b scope.

Bar met: a builder capital BEGINS + PERSISTS on a wonder (safe game,
first fire t138, persisted 63 turns; test #7). Completion is
horizon-gated — the marathon proves the finish (~t641 space-flight),
like Apollo at ~t700.

## Goldens (the one re-record)

Behavioral, from the LEVER only (the wonder-drive is builder-only and
the all-balanced soak roster never exercises it — verified). Soak
200/300/400 → 0x6d6f42f2 / 0x51c4cfab / 0xc0687bf2, natural
r395/p2/0xe4c741ea. Turn-100 anchor UNCHANGED (0xd5c51a95, luau-twins
untouched), A82a/002/data checksums UNCHANGED (no rulesetHash — all
knobs are ai.js behavior tables). JS==Luau on the balanced soak AND a
builder game (0x9f93211f @ t151 — the wonder-drive twin verified
directly since the soak roster wouldn't). Witness replays clean.
Suite 573/573; pins synced.

## Acceptance (sim-runner, follow-up validation on shipped code)

The deterministic 573/573 + JS==Luau + begins+persists gate the
marker. **Post-marker validation RESOLVED (sim-runner #1597 + the
barb-heavy probe #1634):** frontier-safety HOLDS and the 0-defender
exposure is SELF-LIMITING — the wonder-drive's own not-threatened gate
defers to defense exactly when a threat exists, so under 6× barb
pressure it fires 1/25 seeds (vs 7/25 normal) and builder survival is
identical with/without it. The scout-away follow-up is therefore
DEPRIORITIZED (self-safe by construction — the gate is the guard).

## Constants

pbMax 40, pbMult builder 150 / balanced 100 / defensive+science+growth
125 / aggressive 50, wonderMinShields 5 (sim-swept, provisional
confirmed FINAL).
