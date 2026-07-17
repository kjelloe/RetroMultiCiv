# A76 space race — buildable spec (architect, 2026-07-17)

Wiki facts: reviewer #1255 (Spaceship/SS-part pages, 2026-07-09 dump) — the
Civ1 authority. Engine half = N17 (bugfixer); graphical ship screen = H8
(helper; the user ruled GRAPHICAL FROM THE START, 2026-07-17 night queue).
Provenance: Civ1-authentic except the flight-time model (original,
wiki-informed) — labeled below.

## Facts (from the wiki, binding)

- GATE: any civ completing the Apollo Program wonder opens spaceship
  construction for ALL civs holding the part techs. One ship per civ at a
  time; parts build like city improvements and auto-attach; launch is
  irreversible; the ship is DESTROYED if the owner's CAPITAL is captured
  (a new ship may then be built). First arrival ends the game; only the
  first planetfall scores.
- PARTS (tech / cost / mass / max): Structural — Space Flight / 80s /
  100t / max 39. Component — Plastics / 160s / 400t / max 8 per type
  (Propulsion, Fuel; one fuel powers one propulsion fully). Module —
  Robotics / 320s / Habitation+LifeSupport 1600t, Solar 400t / max 4 per
  type (Habitation 10,000 colonists; LifeSupport feeds one Habitation;
  Solar powers TWO other modules).
- BUY: SS parts buy at 8 gold/shield → new `rules.buyGoldPerShieldSS = 8`
  (distinct from buildings 2 / wonders 4).
- MINIMUM VIABLE: ≥1 propulsion + 1 fuel + 1 of each module type +
  sufficient structure.
- SCORING (exact): arrival bonus = idiv(population, 200) * successPct,
  population = habitationModules * 10000.

## Engine shape (N17)

1. **State (omit-safe):** `player.spaceship` object ABSENT until the civ
   builds its first part (old hashes stable). Shape:
   `{ structural, propulsion, fuel, habitation, lifeSupport, solar,
   launched (0|turn), arrivalTurn }` — integer counters only. The Apollo
   gate is DERIVED, not stored: `wonderActive(state, 'apollo-program',
   ruleset)` (the Oracle pattern) — no redundant boolean, no
   disagreement risk (reviewer #1262 REVIEW 2, adopted).
2. **Production:** producing.kind 'ss-part' with id in the six part ids;
   gated on the derived Apollo check + the part tech + the per-type max; completion
   increments the counter (auto-attach — no placement decisions in
   engine). SS buy uses buyGoldPerShieldSS.
3. **Derived characteristics (pure function, both engines):**
   `shipStats(spaceship, ruleset)` → { population, supportPct, energyPct,
   mass, fuelPct, flightYears, successPct } — integer math:
   - population = habitation * 10000
   - supportPct = min(100, idiv(lifeSupport * 100, max(1, habitation)))
   - energyPct = min(100, idiv(solar * 2 * 100, max(1, habitation + lifeSupport)))
   - mass = structural*100 + (propulsion+fuel)*400 + (habitation+lifeSupport)*1600 + solar*400
   - poweredEngines = min(propulsion, fuel)
   - flightYears (ORIGINAL, wiki-informed): base 50 years, scaled by
     mass over thrust — `flightYears = max(5, idiv(mass * 10, max(1,
     poweredEngines * 1600)))` — sim-runner SWEEPS the constants for a
     15–40-year typical window before goldens freeze.
   - successPct = idiv(supportPct + energyPct, 2) - idiv(max(0,
     flightYears - 15), 2), clamped to [5, 100] when the minimum-viable
     set is present, 0 otherwise — the flight term adopts the wiki's
     third qualitative input ("the faster the flight, the higher the
     expected survival"); its constants join the sim sweep.
   - STRUCTURAL SUFFICIENCY (simplification, labeled original;
     reviewer-verified FAITHFUL to the wiki's functional red-box rule —
     only the connection GEOMETRY is presentation): parts FUNCTION only
     up to the structurally supported count: supported =
     idiv(structural * 28, 39) part-slots — 28 non-structural parts
     (8+8+4+4+4) supported at the full 39 structure, integer-exact at
     both endpoints (reviewer #1262 corrected the original 13-slot
     constant, which would have crippled a maxed wiki ship); excess
     parts count mass but not function. The H8 screen may still DRAW
     the frame graphically from the counters.
4. **Commands:** `launchShip` (owner, viable ship, not launched →
   launched = turn, arrivalTurn = turn + idiv(flightYears, yearsPerTurn
   at that era via the existing year table)); no recall. `endTurn` wrap:
   at arrivalTurn with owner alive + capital held → gameOver, space
   victory, the scoring bonus. Capital capture (existing combat path):
   delete player.spaceship (ship destroyed; may rebuild).
5. **Events:** ssPartBuilt, shipLaunched (public — the race is visible),
   shipDestroyed, spaceVictory. All into the event-catalog fixture + both
   classifiers (the #1205 gate forces the decision).
6. **AI (v1 minimal, honest):** builder-stance civs with apolloDone +
   techs add ss-parts to the econ-reserve build set (capital only, after
   buildings); every AI RUSHES the leader's capital when a rival launch
   is visible (shipLaunched is public) — reuse the existing march
   machinery targeting the launching civ's capital. Full AI ship
   strategy = the wave-8/endings work, not v1.
7. **Victory plumbing:** score victory and conquest unchanged; space
   victory joins game-end; `?age=space` fast-forward grants the techs
   (existing machinery).

## Client (H8, GRAPHICAL from the start — user ruling)

The ship screen renders the assembly VISUALLY as parts complete
(structure frame filling in, modules/components attaching — the Civ1
diagram spirit through the house flat-box art style), plus the
characteristics table (population/support/energy/mass/fuel/flight
time/success — the wiki panel contract). Launch button with confirm +
irreversibility warning. Rival launches surface in the turn log + a
banner (the race is public). Roblox parity row lands in docs/13 when H8
ships.

## Tests

Fixture-first scenario (build parts → launch → arrival victory +
capital-capture destruction); shipStats unit rows (the wiki table cases:
full 39/8/8/4/4/4 ship; minimum-viable; unpowered excess); both engines
byte-shaped; goldens re-record at the N17 window (+ ruleset ripple: new
rules keys move rulesetHash → A82a/002 re-record, budgeted).

## Open (deliberately)

Flight-time constants final values (sim-runner sweep before pin);
AI ship-building beyond builder-reserve (endings wave); the Civ1
connection-graph red-box visual (H8 may fake it from counters).
