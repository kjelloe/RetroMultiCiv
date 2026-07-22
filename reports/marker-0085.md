# marker-0085 — naval-loop slice A: the settle-overseas core (MERGE-CONSISTENT)

Tagged at `68035ea` (2026-07-22 morning). **MERGE-CONSISTENT — supersedes
0084. Current merge candidate** (17th consecutive, 0069–0085). Reviewer
clean-clone GREEN with TAG-GO (#2200): 750/747 zero-fail, luau-400 pin
UNCHANGED — the delivery is provably golden-neutral.

## What changed (delta since 0084)

The complete AI settle-overseas mechanism, in both engines, landed
DORMANT and fixture-proven (the #2198 B-split after the measured C
nudge missed): continent flood-fill detection, carrier selection
ladder (trireme→sail→frigate→transport), settler embark, loaded-carrier
sail (bounded sea-BFS), cargo disembark, overseas founding. A crafted
6x5 two-continent acceptance test drives a settler through the ENTIRE
loop unaided in both engines (ai.test 40/40). The core fires only when
an overseas best-site and a reachable carrier coincide — never on the
gated seeds — so every golden pin is byte-unchanged (dormancy verified
empirically AND by code-gate read). Plus: gateTechTurn witness field
(`6898866`) and the sim-driver mapType threading.

## The measured story (three sweeps in one window)

Probe baseline: 0/4 archipelago seeds found overseas cities — the AI
never fields a navy there. Option C (saturation nudge) was measured:
the loop ENGAGED (a settler boarded a built carrier) but completed ~0
— the authentic trireme open-sea gamble sinks wide crossings, and C
moved goldens broadly. Per ruling #2198 C was reverted and the B split
executed. The NAVAL-PRESENCE slice (pre-open done, Q1–Q8 ruled #2201:
bootstrap build on pure saturation, sea-only exploration, trireme
coastal-hug + sail-era open-ocean pathing, bounded naval beeline, two
witnessed sub-slices, seaPathRadius knob to rules.json) makes the core
ARM in soak; it opens as presence-1 next.

## Gates

Reviewer: clean-clone + engine-diff GREEN (#2200) — dormancy both-ways
check, no-state-persistence flood-fill, determinism sweep (no RNG,
fixed orders, bounded BFS), twin byte-shape, fixture cross-language.
One confirm-intent flag (seaPathRadius not yet a rules knob) — folded
into presence-1 by ruling. Gate-B: golden-neutral (pins unchanged =
the luau gate result carries); real sim-runner re-run still invited on
wake (covers 0084+0085).

## Test state

750/747 clean-clone zero-fail; ai.test 40/40; twins gate green,
scenario count 57.
