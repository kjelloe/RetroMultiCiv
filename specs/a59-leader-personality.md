# A59 — leader personality attributes: buildable spec (architect, 2026-07-18)

Operationalizes the designer ally's leader-config design
(specs/leader-attributes.md — the four-axis personality model, per-leader
configs, favorites-as-modifiers). A59 is the D3 PREREQUISITE: D3's AI
negotiation reads leader personality (aggressive leaders demand more,
accept less; Gandhi signs peace, Shaka doesn't). Scoped NARROW and
golden-neutral-in-behavior: A59 ships the DATA + the read SEAM; the AI
does not yet BEHAVE by personality (that's D3 for diplomacy, and a later
window for personality-driven stance assignment / modes — the
ally-endorsed "measure the baseline before adding behavior").

## 1. The data (per leader)

Each leader gains a `personality` object — four NORMALIZED axes summing
to 1.0 (a build guard asserts the sum per leader at load, in an
engine-side check, not runtime): `{ aggression, science, growth,
defense }`. The stance LABEL becomes a PRESENTATION category derived
from the dominant axis (aggression→aggressive, science→science,
growth→growth/builder, defense→defensive) — NOT the behavioral
definition (the axes are). Plus the ally's per-leader fields where not
already present: `favoriteUnit` (a real unit id), `favoriteWonder` (a
wonder id or none), `beelineTechs`. Values come from the ally's table
(specs/leader-attributes.md §"leader personality model" + the wonder
table) — e.g. Caesar 0.75/0.10/0.10/0.05, Shaka 1.00/0/0/0, Gandhi
growth-dominant with favoriteWonder michelangelos-chapel, Shaka/Genghis
favoriteWonder none (conquest personalities capture, don't build).

WHERE: **RESOLVED (architect, direct check 2026-07-18):** civs.json
IS one of the 8 twins-checksum-tracked data/*.json files, so personality
goes THERE (each civ = one leader in Civ1) — no new file needed. It's
hand-maintained, and personality axes are hand-authored (the ally's
values), so the fit is clean. Prior-art VERIFIED clean: civ entries
today hold name/color/cities/specialty/visual only (no personality/
favoriteUnit/leader/stance), and NO engine/*.js reads any personality/
aggression/favoriteUnit field — so the golden-neutral-in-behavior claim
holds by construction. Adding personality moves civs.json's checksum →
rulesetHash ripple → A82a/002 re-record (budgeted, the N10/N13 class),
rounds/winner UNCHANGED (nothing behaves differently). Add `leader`
(name) + `personality` per civ.

## 2. The seam (read-only)

- `personalityOf(state, pid, ruleset) -> { aggression, science, growth,
  defense }` — the leader's axes (default = the current stance's implied
  axes if a leader lacks a personality, so absent data reproduces
  today).
- `stanceFromPersonality(personality) -> stance label` — the dominant
  axis, ties broken by a fixed axis order (deterministic).
- `favoriteModifier(kind, id, ruleset) -> bounded int` — the ally's
  "favorites are bounded score modifiers, not overrides": a small
  additive bonus (e.g. +N to a wonder's build-priority score for its
  owner's favoriteWonder), NOT a hard pick. In A59 this seam EXISTS but
  is wired to a NO-OP default (bonus 0) — the behavioral wiring
  (favorites actually nudging AI choice) is a later window with its own
  sweep. Named now so D3/modes have the seam.

## 3. Golden classification

- Adding personality to an engine ruleset file moves the rulesetHash +
  that file's data checksum → A82a map-type anchors + scenario 002
  re-record (the standing doctrine for any ruleset edit).
- BEHAVIORALLY NEUTRAL: the current stance ASSIGNMENT is UNCHANGED
  (still the marker-0043 seeded Fisher-Yates — A59 does NOT make the
  assignment personality-driven; that is the follow-on behavioral
  window). The favoriteModifier is a no-op. personalityOf is read by
  nothing in the soak (D3 isn't built). So soak/natural/turn-100 +
  witness rounds/winner UNCHANGED — the A76/N10 "rulesetHash-only shift"
  class. VERIFY (don't assume): if any soak hash moves BEHAVIORALLY
  (rounds/winner), a personality read leaked into the AI path —
  investigate, don't re-record.

## 4. What A59 does NOT do (scope fence)

- Does NOT change AI behavior (no personality-driven stance assignment,
  no favorite nudging, no diplomacy — all later).
- The stance-mix's random assignment stays; A59 only makes the LABEL
  derivable and the axes readable.
- D3 (diplomacy negotiation) is the first CONSUMER — it reads
  personalityOf for demand/accept thresholds. A later "personality
  stances" window makes the assignment itself personality-driven (with
  the elim-band sweep, since it shifts the stance distribution).

## 5. Tests

- Build guard: every leader's personality sums to 1.0 (unit test over
  the data).
- personalityOf returns the axes; the absent-leader default reproduces
  the current stance's axes.
- stanceFromPersonality dominant-axis + tie-break (unit test).
- favoriteModifier returns 0 in A59 (the no-op pin — proves the seam is
  inert until wired).
- Scenario: a crafted state's personalityOf + stanceFromPersonality
  pinned cross-language (small; the axes are data, deterministic).
- Goldens: A82a/002 re-record (rulesetHash); soak/natural rounds+winner
  VERIFIED unchanged (behaviorally neutral).

## 6. Provenance

The four-axis model, per-leader values, favorites-as-bounded-modifiers,
and the Gandhi/Shaka/Caesar signatures are the designer ally's design
(specs/leader-attributes.md). The favorite-wonder assignments are
Civ1-flavored (the ally's intentional table — some leaders build none).
The stance-label-from-dominant-axis is the ally's presentation rule.
