# Designer-ally response — 2026-07-21 (VERBATIM, relay via user)

Reply to specs/ally-status-update-2026-07-21.md. Contents: the space-race AI
slice design (eligibility gate + project scoring + visible tradeoff +
measurement table), a calendar-boundary caution, terrain-relief confirmation
(incl. the Studded-mode note), and advisor-copy readiness. Routing:
specs/xii5b-space-project.md (the buildable slice, pending user GO),
specs/calendar-545.md (boundary note), specs/refinement-xiv.md §29/§15
(terrain), specs/advisor-hint-cards.md (readiness note).

---

### This is excellent news

The calendar correction is the right intervention. A normal game ending before any civilization can plausibly reach the late tree makes the Space Race theoretical content; a roughly **545-turn historical arc** gives the full technology tree room to breathe without making Space automatic.

The most valuable result is this:

> The remaining problem is no longer research throughput. It is purposeful late-game research selection.

That is a healthy, tractable AI problem—and a much more interesting one than simply reducing technology costs.

### Space-race AI: recommended next slice

Treat Space as an explicit, evaluated **strategic project**, rather than an incidental collection of late technologies.

An AI may enter `space-race` behavior only when it meets a visible eligibility gate:

- Has reached the industrial or modern era.
- Is among the research leaders, or within a defined science-gap threshold of the leader.
- Has a secure core: no capital emergency, no immediate invasion danger, and adequate threat-relative garrison.
- Can plausibly reach the required path before the game's expected end.
- Is not already committed to a stronger victory project, such as a near-term conquest win.

Once eligible, the AI should score the space path using rules-derived information:

```text
spaceProjectScore =
  scienceCapacity
  + productionCapacity
  + coreSafety
  + remainingTurnFeasibility
  - militaryEmergency
  - pathResearchCost
  - opponentSpaceLead
```

The exact weights should remain simulator-tuned. The important behavioral requirement is simple: once a civilization commits, its **research queue must deliberately prefer prerequisite technologies that lead toward required spaceship components**, rather than selecting merely locally attractive technologies.

#### Visible tradeoff

A Space-focused AI should become legible to a human player:

- prioritizes science and productive core cities;
- builds the needed late infrastructure rather than arbitrary marginal units;
- reserves enough defense to avoid being an easy target;
- deprioritizes optional branch technologies with no path contribution;
- abandons or pauses the project if core safety collapses.

That produces the desired tension: a human can recognize the emerging launch threat and choose whether to race it, pressure it, negotiate with it, or invade it.

**Provenance:** `original`, guided by the project's human-benchmark AI methodology.

### Measurement guidance for the next experiment

For every candidate `space-race` run, report both the strategic decision and the outcome:

| Metric | Why it matters |
|---|---|
| `spaceEligibleTurn` | Shows whether the gate opens early enough to matter. |
| `spaceCommitTurn` | Measures hesitation after eligibility. |
| `spaceAbandonTurn` and reason | Distinguishes sensible interruption from erratic behavior. |
| Required-tech path completion percentage | Confirms research actually follows the project. |
| Off-path tech count after commitment | Measures distraction. |
| First component start / completion | Shows whether production follows research. |
| Launch turn / victory turn | Primary pacing outcome. |
| Military threat at commitment and launch | Tests whether Space remains strategically contestable. |
| Human-benchmark regression floors | Ensures the new behavior does not make baseline AI weaker. |

The interesting initial target is not "every game produces a Space victory." It is:

> In appropriate peaceful, long-running games, at least one civilization recognizes and pursues the Space route; under real pressure, it can be delayed, deterred, or forced to abandon the attempt.

### One caution on the calendar revision

Make the turn-year mapping **presentation-only and data-defined**. The historical year labels can change, but game pacing should remain governed by the existing turn sequence and rules, not by calculations that infer behavior from displayed calendar years.

This is not a concern with the change as described—just worth retaining as a permanent boundary:

- simulation reads turn counts and state;
- UI maps turns to dates;
- date labels do not feed AI, victory, yields, saves, or replay logic.

That keeps the adjustment deterministic and golden-safe.

### Terrain relief: the proposed overlap is sensible

`Hills ≈ 2` and `mountains ≈ 8` is a good first screenshot candidate.

It gives hills approximately one quarter of mountain height, preserving the original cap while still ensuring a meaningful gap between flat terrain, hills, and mountains. The deciding question should indeed be visual, using the desaturation check:

- flat terrain reads as essentially level;
- hills read as a broad raised landform;
- mountains remain dominant, unmistakable landmarks.

For the **Studded** mode in particular, err toward slightly *lower* hills at first. Stepped geometry and visible studs already create depth; excessive physical elevation may make ordinary terrain read as cluttered.

### Acknowledged: advisor cards

The event-hint-card format is right: short, friendly, contextual, and linked to the relevant Civilopedia concept. I am ready for the 15 first-time moments once the event list and exact encyclopedia target IDs are finalized.
