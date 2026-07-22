# Archetype wonders — "some civs MUST build wonders" (v1 slice spec)

_Drafted 2026-07-22 (architect) per ruling #2160 stage 2; the user's
standing archetype/endings vision is the source (heterogeneous per-civ
AI; four target endings; A40 stances as the vehicle). Provenance:
`original` (Civ1's AI built wonders opportunistically; personality-keyed
wonder APPETITE is our design). Engine lane, golden move, after the
naval-presence slices. Build gate: bugfixer pre-open + impl-confirm
against the OPEN QUESTIONS below._

## The problem (measured)

Sweeps 4–6 (25 seeds, 545t): `wonders == {}` in every sampled game —
`topGoal: wonder` in ~1% of stats rows. The AI *never* builds wonders
outside the builder stance's narrow `wonderDrive`, so: no Apollo gate,
no Great Library/Lighthouse effects in AI hands, an empty wonder
landscape for human players to walk over, and the endings vision
(civs with legible identities) has no wonder-shaped identity at all.

## Shape (small, data-driven, stance-keyed)

1. **STANCES gains a `wonderAppetite` column** (data via the existing
   STANCES table in ai.js — builder HIGH, science MED, balanced LOW,
   growth/defensive LOW, aggressive NONE). Appetite = the priority
   class a wonder build gets in city production selection, NOT a
   scripted target list.
2. **Wonder pick stays the existing `nextWonder`** (cheapest-available
   today) — EXTENDED to prefer wonders whose effect matches the stance
   (science→Great Library class, builder→economic, etc.) via a small
   effect-class map in the overlay tables (tools/mapdata.js pattern,
   never hand-edited JSON). A59 leader personalities already map to
   stances, so civs get wonder identities for free.
3. **Guards**: capital-or-best-shield city only; never while the city
   is the civ's sole defender-short city (docs/15 floors); committed
   space civs keep the apollo-narrow TOP override; gold-rush stays
   forbidden (#1899).
4. **The soak-visible effect** (unlike the dormant naval core): wonders
   START appearing in all-AI games — a BIG golden move + full
   re-record, with a non-degeneracy witness (wonder count per game in a
   sane band, M-floors green — wonder shields must not starve
   expansion below the ratcheted floors).

## Acceptance

- 25-seed sweep: ≥1 wonder built in >half the seeds by t400; M2/M3/M4
  floors green; no stance builds zero-defense wonder-rush cities.
- Cross-language fixture: a builder-stance crafted state picks a
  wonder; an aggressive control does not.
- Composes with the space arc: if the research-depth fork later makes
  space-flight reachable, Apollo emerges through this same appetite
  (the committed-civ override already exists).

## Open questions (impl-confirm before build)

- Q1 appetite mechanics: priority-class insertion point in the build
  selector (above buildings, below urgent defense?) — bugfixer grounds.
- Q2 effect-class map granularity: 3 classes (science/economy/military)
  or per-wonder? Lean: 3 classes, data-driven.
- Q3 witness thresholds: proposed above; probe first, propose from data
  (the naval pattern).
- Q4 ally input: personality→wonder mapping flavor (the reviewer's A59
  work + the ally's civ-identity writing) — invite before the window
  opens; not blocking (the effect-class default stands without it).

## Ally framework ADOPTED (2026-07-22 reply — supersedes the 3-class default)

Identity-first principle (verbatim): "A personality should favor a
wonder because it advances that civilization's chosen story, not merely
because its numeric effect scores highly." Appetite keys on STRATEGIC
IDENTITY with effects as supporting evidence. Two guardrails, adopted
as acceptance criteria: (1) NO universal wonder-hoarding personality —
choices must reveal character; (2) PROJECT COHERENCE beats local value
— a committed civ's wonder picks reinforce its project (space /
conquest / naval / diplomatic) unless a real setback changes its
circumstances. The ally's 8-personality table (Builders / Scientists /
Explorers / Diplomats / Conquerors / Stewards / Industrialists /
Visionary) maps onto our stance+leader-personality system via the
bridge in specs/ally-ask-wonder-list.md; the per-wonder
primary/secondary/never-unless mapping arrives from the ally against
that list (our 3-class default ships only if it doesn't).

## MAPPING DELIVERED (2026-07-22 second ally reply) — build from it

The full 22-wonder primary/secondary/never-unless table is captured in
specs/ally-deliverables-2026-07-22-wonders.md and REPLACES the 3-class
default (Q2 resolved: per-wonder, data-driven from the table). New build
constraints from the same reply: global-unlock clause primary for
Manhattan/Apollo; obsolescence-aware appetite decay; effect-driven
stability across the A7 landings. Q4 resolved: Explorer/Diplomat nuance
preferably rides A59 leader-personality biases (ally's stated cleaner
solution) — pre-open grounds feasibility, affinity flags are the
fallback. Open impl-confirm now reduces to Q1 (selector insertion
point) + Q3 (witness thresholds from probe).
