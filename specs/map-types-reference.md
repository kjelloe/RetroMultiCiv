# Map types — designer-ally reference set (2026-07-17, verbatim)

*(Design reference for the A82 map-type program. Civ IV's set varied by
edition/expansion/script — treat as a reference, not a per-edition claim.
Source the ally cites: CivFanatics Civ IV Map Scripts Guide.)*

## Recommended phased set

The ally recommends launching with a FOCUSED, land-focused group, then adding
specialist/naval maps once naval transport + air systems are validated. Key
gating rule: **do not expose naval-dependent maps until the AI reliably
completes the full naval loop (build ship → explore → transport → land →
support a foothold).** On an island map today the AI would be trapped on its
start landmass (we measured aboardCount=0, crossWater=never).

### Launch set (land-focused; no naval back-half required)
- **Continents** — two to several large landmasses separated by oceans; the
  all-purpose default. CAVEAT: a landmass can get too many starts → balance
  on players-per-landmass, not just local quality.
- **Pangaea** — one dominant supercontinent; fast contact, land war,
  diplomacy. Naval has little purpose until late.
- **Fractal** — highly variable procedural world (may resemble any of the
  above). Launch WITH a defined seed corpus so pathological worlds can't hide.
- **Inland Sea** — empires ring a large central sea; mixed land/naval, the
  centre is a highway. The central water must be large + connected.
- **Lakes** — land-heavy, broken by inland lakes; naval deliberately minor.
  Do NOT treat lakes as ocean access in pathfinding/transport/naval metrics
  (useful as a naval-investment control map).
- **Random** — chooses from the supported types.

### Advanced / post-naval-AI-acceptance (unlock when the naval suite is green)
- **Archipelago** — many small islands; naval exploration/transport/coastal.
- **Terra** — Old World start, empty New World across an ocean; the best
  acceptance map for ocean-going AI. No civ may start in the New World.
- **Islands** — each civ on a substantial island; fairer than Archipelago.
- **Big & Small** — continents + scattered islands; a good long-term "default
  random" candidate once naval AI is dependable.

### Post-launch / specialist
Highlands, Great Plains, Ice Age, Oasis (strict start normalization),
Custom Continents (setup/sim tool), Hub (multiplayer variant), Mirror
(fairness/test mode), Shuffle (announce the chosen script; every included
type must meet the same fairness + AI-quality floor).

## Proposed first public menu
```
Map Type
• Continents   — large landmasses and overseas exploration
• Pangaea      — one great landmass, early contact and land war
• Fractal      — an unpredictable natural world
• Inland Sea   — empires around a shared central sea
• Lakes        — land-rich world with inland water
• Random       — chooses from the supported map types
```
Advanced (unlocked when their acceptance suite is green): Archipelago,
Terra, Islands, Big & Small.

## Map-profile AI input (the AI-programme caveat)
Map type must set an INITIAL PLANNING PRIOR for the AI, not just terrain — and
NEVER grant omniscient map knowledge. The AI still confirms properties from
fog-honest observation. Example profile:
```javascript
{ mapType: 'terra', landConnectivity: 'separated',
  overseasExpansionExpected: true, coastalCitiesValuable: true,
  navalExplorationPriority: 'high', transportInvasionExpected: true,
  chokepointFrequency: 'medium' }
```
e.g. Archipelago raises the value of coastal scouting + Map Making, but must
NOT reveal where another island/rival/target is. Standing rule:
**map-aware strategy is good; map-cheating AI is not.**
