# marker-0074 — §12 settler pathing + escort: the xiv-ai arc closes (MERGE-CONSISTENT)

Tagged at `629aea1` (2026-07-21, end of the user-away window).
**MERGE-CONSISTENT — supersedes 0073. This is the away-window merge
candidate** (sixth consecutive consistent marker, 0069–0074).

## What changed (window 3/3)

- **Inlet pathing**: `bfsStepToward` — a bounded land-only BFS
  (settlerPathRadius=12, deterministic neighbor order) replaces the greedy
  chebyshev single-step for the expander→site walk; greedy-then-hold
  fallback (today's behavior as the safe floor). The user's observed
  oscillation at a 3-deep ocean inlet: fixed, pinned by a crafted-inlet
  fixture that was RED before the fix.
- **Escort doctrine**: the existing unguarded-settler seam strengthened —
  a military unit ACCOMPANIES the frontier expander (stays adjacent);
  stance-scaled reach via STANCES escortRadiusPct (bal 100 / def+agg 150 /
  sci+gro 60 / bld 80). Movement-only; build priority untouched; an
  unescorted expander ADVANCES (escort = protection, not permission).

## The finding that outranks the feature

**All six M-floors CLEAR** on the §12 build — including the three that had
sat breached since marker-0066 (M2-cities 20 vs 6.75; M3-pop 105 vs 36;
M4-improvements 75.25 vs 53). The stuck-settler bug — not marker-0066
timing, not calendar-545 — was the dominant cause of the breach. The
reviewer verified this INDEPENDENTLY (own enforce-floors soak, all 6 clear
on all 4 seeds, leaders 20–68 cities) and corrected its earlier
floors-were-pre-existing concurrence on record. Follow-up queued to
sim-runner: 25-seed confirm → ratchet M2+M3 (M4 marginal, hold).

## Gates

Reviewer clean-clone + engine-diff GREEN (#2058): 677/674/0, luau-400
0xf385bc33, natural 545/p2 unchanged, all six declared checks pass +
the independent M-floor verification. Gate-B: the documented
0072/0073-pattern fallback (sim-runner session inert; author JS==Luau
byte-exact self-witness + architect landing suites 48/48). Real Gate-B
re-runs remain invited on tags 0072–0074.

## Test state

Full suite green at the tag (SIGTERM known-flake passes isolated; B13
local recording re-recorded). Tree clean.

## For agents

§12 locks release at the tag. The engine lane's next queue: settler
pop-cost (§40) → city-as-road (§50) → default-defender (§46) → rehome
(§45b) → air-truth → naval-truth → difficulty → A91. The xiv-ai arc
(§13 economics / §14 treasury / §12 pathing) is complete.
