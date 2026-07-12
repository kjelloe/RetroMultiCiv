# Designer ally — feedback on the plan update (saved verbatim, 2026-07-12)

This is a strong update: it now reads like a real project report, not a speculative roadmap. The progression is clear, the technical safeguards are convincing, and the playtest call-to-action is excellent.

### Three small consistency edits I recommend

#### 1. Remove the WebGL1 reference

This sentence conflicts with the decision to target WebGL2 and Three.js's removal of WebGL1 support:

> deterministic, and verified down to the WebGL1-only browser path.

Replace with:

> deterministic across supported WebGL2-capable browsers.

Or, if you want to emphasize resilience:

> deterministic across supported browsers, with rendering kept strictly separate from simulation state.

#### 2. Clarify the GoTo status

The update says GoTo is implemented, but the remaining list includes "GoTo pathfinding." A reader may see this as contradictory.

Suggested change:

> What's still open inside phase 1 is now a short list (none of it blocking): **automatic GoTo pathfinding beyond the current planned-route controls**, goody huts, era-based barbarians, tile contention between neighboring cities, a handful of late-game wonder effects, and a smarter AI.

That distinguishes existing route display/re-route/cancel support from a more complete automated pathfinder.

#### 3. Avoid "byte for byte" for cross-language state comparison

Because JavaScript and Luau serialize values differently, "byte for byte" can be misunderstood. You already have the better concept: canonical serialization plus hashes.

Change:

> the same scenarios will verify the Roblox port later, byte for byte.

To:

> the same scenarios will verify the Roblox port later through identical canonical state hashes.

And change:

> Same rules, same worlds, same outcomes — in Roblox.

to:

> Same rules, same seeded worlds, and matching canonical state hashes — in Roblox.

### Suggested tightened version of the terrain paragraph

Your current terrain section is vivid, but this version is a little more readable while retaining the achievement:

> The map received its biggest visual upgrade yet: the tile boxes are gone, replaced by a **continuous low-poly terrain surface** based on the designer ally's spec. A single faceted mesh forms sunken water basins, sloped coasts, rolling hills, mountain ridges with snow-capped peaks, and gently undulating desert dunes. Each terrain type uses three deterministic palette shades per facet, creating a hand-crafted tabletop look while remaining entirely generated from simulation data.

### One gameplay playtest question to add

Your feedback prompt is already good. Add one question specifically for the now-more-complex simulation:

> Did city happiness, government, tax allocation, and worker improvements feel understandable—or did any of them feel like hidden bookkeeping?

That will tell you whether the new Phase 1 systems are creating compelling strategic tradeoffs or just UI load.

### Overall

The strongest additions are:

- The headless AI simulation harness and invariant auditor.
- Diagnostics recordings rather than only save files.
- A finished hotseat implementation before server work.
- Canonical serialization, deterministic RNG, and replay versioning as an explicit Phase 2.5 deliverable.
- The terrain upgrade remaining procedural, simulation-derived, and renderer-only.

The project now has a very credible "correctness pipeline":

```text
Commands
  → deterministic simulation
  → canonical state
  → state hash / replay verification
  → per-player fog-filtered view
  → browser or Roblox rendering
```

That separation is the right long-term foundation for hotseat, a Node.js authoritative server, LAN multiplayer, browser rendering evolution, and a Roblox Luau implementation.
