# Build-doctrine engine window — slice plan (PROMOTED into v1, user 2026-07-25)

The XX §3 AI/regency city-role build doctrine, PROMOTED to a full v1 behavioral
engine window (user ruling, after the measure-first table). Architect executes
(bugfixer on mobile-session-3, helper stopped). Doctrine source: `refinement-xx.md`
§3 + §3a (user's concrete build order). Baseline: AI builds ~0 buildings/wonders,
tech caps ~30, 0 space launches, M3-pop 20<22 — all one lever.

## Discipline (every slice)
Full golden window: fixture-FIRST (replay fixture or scenario capturing the new
behavior BEFORE the engine change), `engine/*.js` + byte-shaped `luau/` twin changed
TOGETHER, honest sim-golden re-record (classified BEHAVIORAL/STAMP), reviewer
engine-diff gate + sim-runner 25-seed invariants/floors sweep before each marker.
One golden lock at a time. Ruleset numbers stay in `data/*.json` (new building-priority
knobs there, not hardcoded). Determinism via `engine/rng.js` only.

## Sequencing
Opens AFTER the investigateCity 8-file changeset commits (reviewer gate #2680) so the
tree is clean. Slices ordered highest-leverage-first so each lands measurable value:

- **Slice 1 — HAPPINESS + GROWTH buildings** (highest leverage; targets M3-pop + disorder).
  AI builds TEMPLE (happiness gate — before/after granary per §3a) + GRANARY (growth;
  high-food cities may defer to pop 4-5). Expected: M3-pop median back >= 22 (clears the
  advisory → re-add M3-pop to nightly --enforce-floors in the SAME commit), disorder down,
  avgPop up from ~3.1. Smallest, most decisive.
- **Slice 2 — SCIENCE + trade buildings** (research depth). LIBRARY (+ MARKETPLACE for
  gold) in trade-heavy cities. Expected: tech depth past ~30 cap; sets up eventual launches.
- **Slice 3 — CITY ROLES + military concentration.** Deterministic role tag
  (production/science/frontline/spawner/default) from city geography + empire context,
  driving the existing build-priority lever (extends the archetype/N9 machinery). One
  high-shield city = MILITARY (barracks, then units); core cities = DEFENCE-first (phalanx
  asap) → granary → settler.
- **Slice 4 — FRONTIER defence.** CITY WALLS in frontier-exposed cities only; defender
  coverage in core.
- **Slice 5 — WONDERS.** Extend wonderAppetite (archetype window) for GROWTH/HAPPINESS
  wonders; super-food city may take a happiness wonder to run many specialists.

## Notes
- Happiness COVERAGE isn't in `--stats` telemetry (no disorder field) — sim-runner may
  need a small telemetry add to measure slice-1 impact directly; buildings-built count is
  the proxy meanwhile. (Golden-neutral tooling change, not an engine change.)
- Each slice re-measures against the §3a ideal; the promote/bank was decided on the
  baseline table (buildings ~0), so slices report progress-to-ideal.
- v2 shelf (NOT this window): Civ4 draft-from-super-food-wonder-city.
- Pace: multi-slice, days of golden work; architect executes solo + gates per slice.
  Flag to user if the pace warrants reactivating a second engine lane.

## Slice-1 delivery log (2026-07-26)

- **1a @6fc9d6a** — doctrineBuilding landed (fixture-first 7/7, twins 11/11, honest
  behavioral re-record). Gate finding (sim-runner #2760): mechanism DORMANT in the
  canonical sweep — temple coverage 0.9%; root cause: the slot's threat gate, and
  `threatened` is chronic at 7-civ density. M3-pop 25 (PASS ≥22) but not attributable.
- **1b @00c3267** — threat gate dropped (walls-first still outranks; walled-under-threat
  fixture added). Reviewer #2766: CODE GREEN (pristine 967/964/0-fail, twin bit-exact,
  natural holds 545/p2); independent 3-seed canonical probe: coverage 2.0% → 6.2% —
  directionally correct, MODEST. Authoritative figure = the 25-seed sweep (pending).
- **Measurement lessons:** hashes moving ≠ mechanism firing (probe by direct count);
  probe in the CANONICAL config, not the golden-seed sim config (a 4-civ 56x35 seed
  showed 73% — cherry-picked by accident).
- **Open lever (reviewer advisory):** at ~6% coverage most cities stay on the
  defender/walls/army treadmill (garrison floor + walls precede the doctrine under
  chronic threat). If doctrine-DOMINANT development is the intent, the next lever is a
  garrison-floor carve-out or hoisting doctrine above walls — decide on the sweep
  numbers (slice-1c vs fold into slice-2).

## Peace-witness v2 + garrison-roam diagnosis (2026-07-26)

- Peace-witness v1 (2-civ head slice) FALSIFIED: a DUEL (threat 28.8%, 7/10 conquest,
  coverage 0.0%) — civ count does not control conflict; renamed the 2-civ duel witness.
- v2 (user design): personality-selected pair — chinese+germans (defensive stance,
  attackerPerCityPct 0) via the new sim-driver opts.roster + debugging/probe-peace.js
  (@f795a87, golden-neutral). 3-seed local: STILL 0 buildings, 2-10 cities, all seeds
  end in barb-driven elimination of one side.
- **DIAGNOSIS (the deeper W6 blocker): GARRISON ROAM.** Seed-1 sampling: the lone
  p1 city produces militia at every checkpoint while its garrison leaves (t180:
  0 units in city, 37 alive on map). defenders < wantDefenders chronically -> the
  ENTIRE garrisoned block (settlers + doctrine + econ) is unreachable. Explains both
  the peace-pair 0% coverage AND most of the canonical dormancy. The slice-1d lever
  is garrison RETENTION (unit-brain: fortified city garrison must stay), not another
  cascade reorder. Design pending the slice-1c sweep verdict.

### Slice-1d design ruling (user, 2026-07-26)

Retention is ROLE DISCIPLINE, not movement-freezing. Even a defensive civ in a
peaceful world MUST send scouts out — to find excellent food/shield/trade city
sites, learn which direction the other civs are, and spot barbarians to fend
off. Two legs:
1. **Garrison stickiness** — units in the city-defender role stay fortified in
   their city; escort/hunt/explore selection must not poach a standing garrison
   (or must backfill before leaving). Fixes the roam choke (the militia-forever
   loop).
2. **Scouting never zero** — marchRadiusPct gates marching-to-war, not site
   discovery: the defensive stance's scout share needs a real explore radius
   (today marchRadiusPct 0 × exploreMarchRadius 8 = 0, so its scouts stay
   home — the second reason the peace pair stalled at 2 cities). With sites
   discovered and the garrison stable, the §3a settler flow reaches the good
   sites and the doctrine builds behind it.

- **1c sweep VERDICT (#2774): M3-pop FAILS — 15.5 vs floor 22; cities 4.25 (no recovery
  from 1b's 4.5). The 3-seed calibration probe was optimistic; 25-seed is authoritative
  (lesson re-taught). NO marker on 1a-1c. Slice-1d (garrison stickiness + scouting-never-
  zero, user-ruled above) is the fix layer — with the floor open, settlers AND doctrine
  both flow. NOTE: M2-cities 4.25 < enforced floor 6 -> the NIGHTLY canonical soak will
  red on the current tip until 1d lands (known-open, mid-window). Peace-witness huge-map
  variant: no eliminations but still lopsided combat — true-peace parked per rule.**

- **1d @bec9658 — garrison role discipline LANDED (user-ruled).** Fortified-in-city
  units hold their post unless the guard floor survives without them (escort/march
  never checked `fortified`); the brain's stay-home floor aligned with production's
  wantDefenders (#2775 second leg). Scouts still range. ACCEPTANCE (peace pair,
  seed 2 t400): 124 cities + 18% temple/granary coverage (from 0.0%) + 436 pop,
  calendar ending restored. Fixtures: garrison 3/3 revert-proofed; the ff abort
  fixture made deterministic-by-construction; wonder-drive re-pinned seed 12.
  RUNTIME: soak double-run 3.5→36 min (denser worlds = the doctrine working);
  lune smoke timeouts 180→600s. Twins 11/11 (the gate caught a twin nil-call
  pre-push). FINAL gate round queued (sweep = the slice-1 marker verdict).

## Slice-2 RULED FOLDED INTO SLICE-3 (user, 2026-07-26)

Slice-2's target (research depth via library/marketplace) was ACHIEVED BY
SLICE-1's effects, measured before the window opened: fresh 1d sweep states
show libraries/marketplaces building organically (seed 17 @t371: 46 libraries
+ 32 marketplaces + 6 universities / 139 cities; seed 24: present but thin),
and the concept histogram recorded a civ EXHAUSTING the tech tree (Future
Tech researched) by t400 — the ~30-tech ceiling is gone. The payback lever's
existing yield-building path just needed slice-1's growth to feed it.

What slice-2 still owed — ROUTING libraries/markets to trade-heavy cities
specifically (§3a) — is slice-3's city-roles machinery by nature. W6 is now:
**slice-3 (city roles + the v1 war pair: pillage-siege + air-war) →
slice-4 (frontier walls) → slice-5 (wonders appetite).** One golden window
saved; the measure-first discipline paid for itself again.

- **WAR_DECLARED histogram anomaly RESOLVED (code inspection, 2026-07-26):** not a
  gap — D1's default relation is implicit hostility; formal declaration exists only
  as treaty-breaking (AI declares solely from standing peace on war-intent recovery).
  The histogram game's combats ran from the default relation and its one treaty was
  never broken → 0 declarations is correct + Civ1-shaped. The sim-runner owner-tally
  is now optional corroboration, not a blocker.

## Measurement round @canonical scale (sim-runner #2819, 2026-07-27)

First full-scale batch through debugging/job.sh (detached; canary-proven).

- **Build-doctrine CONFIRMED LIVE at scale:** buildingBuilt 1564 over 3
  canonical 400t/7civ games (was 0 at the t100 horizon — that earlier
  "unused" read was purely horizon truncation). wonderBuilt 25,
  cityCelebrating 378, unitUpgraded 237, naval load/unload 29 — the
  doctrine + WLTKD + upgrade systems all fire organically.
- **Disasters ON vs OFF (25-seed canonical pair): IDENTICAL floors**
  (M2 17.5 / M3-pop 64 / M4 91.5 both sides, all 25 clean) — the
  doctrine surplus absorbs disaster losses (disasterStruck ~818/seed).
  Shipping default ON is floor-safe, now measured.
- **Space arc — SHARPER finding:** ssPartBuilt/shipLaunched/spaceVictory
  all 0 YET futureTechResearched=10 — a civ EXHAUSTS the tree and spills
  into Future Tech without ever committing to Apollo/ship. The launch
  blocker is no longer research depth (tree end is reached); it is the
  commit-to-ship step in the drive. Feeds the v1 contested-ending record
  (XII.5 fork) and any v1.x space tuning; marathon run will show whether
  longer horizons change it.
- **W8 motivation confirmed at scale:** espionage family, TECH_EXCHANGED,
  tradeRouteEstablished all 0 (only TRIBUTE_PAID 87 + one peace treaty
  fire) — exactly the econ-pair gap the W8 window closes. WAR_DECLARED=0
  with 508 combats/76 captures corroborates the correct-by-design ruling
  at scale.
- **Natural victory distribution:** first run was a config artifact
  (--turns 400 cut games before endYear ~545); re-launched at 600.

- **Natural victory distribution — COMPLETE (natural2 + relaunch,
  25-seed --turns 600, #2823/#2827): 24/25 endYear-545 SCORE victories +
  1 early elimination (t460).** Winners balanced (Zulus / Egyptians /
  Greeks / Romans all represented); NO space victory anywhere
  (corroborates the commit-gap finding); no runaway conquest — a
  survivor always stands at endYear. The 3 tripwire seeds re-ran clean
  under SIM_MAX_UNITS=4000 (b9e01e3), all three endYear score wins —
  the tripwire hits were unit-count, not gameplay, artifacts.

## Slice-3 DESIGN (city roles + the v1 war pair) — opened 2026-07-28

One behavioral golden window, three sub-parts built sequentially, ONE
re-record at the end. Contracts: refinement-xx §3/§3a (roles),
unit-doctrine-v1x §4 (air) + §5 (pillage-siege, recalled-behavior
label), reviewer #2798 + #2814-16 banked verdicts.

### 3A. City roles (§3/§3a)

A deterministic per-city ROLE from geography + empire context, via the
navalFacts done-cache pattern (`roleFacts` computed once per turn):
rank own cities by SHIELD yield and by TRADE yield (sortIds walks,
integer yields from cityYields).

- **frontline** = `threatened` (existing enemyNear verdict). Effect:
  walls-first (exists as canWall) and BLOCKS the science list (no
  university on the border) — §3 "walls ONLY in frontline cities".
- **production** = top `cityRoles.prodCities` by shields (not
  frontline). Effect list `cityRoles.productionBuildings`:
  barracks → factory → hydro-plant/nuclear-plant/power-plant
  (best-available plant by tech, the §3a "one MILITARY city" +
  factory-era concentration).
- **science** = top `cityRoles.sciCities` by trade (not frontline/
  production). Effect list `cityRoles.scienceBuildings`: library →
  marketplace → university → bank (§3a trade-heavy pairing).
- **spawner** = food surplus >= `spawnerFoodSurplus` AND shields <=
  `spawnerMaxShields` (not any above). Effect: the settler branch's
  empire cap gets +1 headroom for spawner cities (they keep the
  settler loop alive; §3 "high-food/low-production = SETTLER SPAWNER").
- **default** = everything else; existing cascade untouched.

Role building slots into the econ pick: `roleBuilding` (first missing
+ tech-known id from the role list) is tried BEFORE
stanceBuilding/payback in the econ fallback — slice-1 doctrine
(temple/granary) keeps strict priority above it, walls/army slots
unchanged.

- **Happiness ladder** (§3 "ALWAYS"): `buildDoctrine.happinessBuilding`
  generalizes to a LADDER walk — disorder with temple already built
  climbs to colosseum (new `buildDoctrine.happinessLadder:
  ["temple","colosseum"]`; the single-id knob stays as ladder[0] for
  fixture compat).

Knobs (data/rules.json `cityRoles` — rulesetHash STAMP + behavioral,
same cascade as slice-1): prodCities 2, sciCities 2,
spawnerFoodSurplus 3, spawnerMaxShields 4, productionBuildings +
scienceBuildings lists as above.

### 3B. Pillage-siege (§5, recalled-behavior)

The hold-at-city-edge branch (massing/odds wait) stops idling: a
holding attacker standing within `siegePillageRadius` (rules knob, 2 =
the city radius) of the TARGET enemy city, on a tile with an
improvement (irrigation/mine/railroad/road — the improvements.js
pillage order) and moves left, returns `pillage` instead of `wait` —
each held turn strips one improvement from the siege ring (cuts the
defender's yields + reinforcement roads before the assault). Guard:
never within radius 2 of an OWN city (border overlap). No new state,
no RNG; the pillage command already exists (engine/improvements.js).

### 3C. Air war (§4)

The AI currently NEVER fields air units (bestAttackerUnit is
land-only; histogram airCrashed=0). Minimal authentic doctrine:

- **Build**: once at its land army target with an active known enemy
  city (the existing march has a target), a PRODUCTION-role city
  builds bombers up to `airDoctrine.bombers` (2); any city builds ONE
  fighter when a rival AIR unit stands within threatRadius of an own
  city (fog-honest sighting) up to `airDoctrine.fighters` (2).
- **Unit brain** (new `domain === 'air'` block before the generic
  march): a BOMBER strikes the assault target city only while the
  siege exists (>=1 own ground attacker adjacent) AND the city is
  within `airDoctrine.leash` (6) of a friendly base (city) — else it
  returns/holds at base (the fuel-truth leash; fuel 2 = there and
  back). A FIGHTER engages a visible enemy air unit within leash
  (attacksAir interception, odds-gated like any attack), else holds at
  base (defensive posture — never marches).

Knobs in rules.json `airDoctrine` { bombers: 2, fighters: 2, leash: 6 }.

### Fixtures (failing-first, before engine edits)

test/city-roles.test.js: role assignment determinism (crafted 4-city
state: shield-heavy → production, trade-heavy → science, threatened →
frontline blocks science, food-flat → spawner); role building pick
order; happiness-ladder colosseum-on-disorder-with-temple.
test/siege-air.test.js: holding attacker pillages the ring tile (and
not an own-radius tile); bomber holds without siege, strikes with
siege inside leash; fighter holds at base, engages visible enemy air.
Plus scenario JSONs only if a cross-language behavior pin is warranted
(roles are covered by the sim goldens; decide at re-record).

### Gates

Engine+twin one window; #28 discriminator null-and-run (expect
BEHAVIORAL + STAMP: rules.json changes); detached re-record
(job.sh); sim-runner 25-seed sweep + coverage probe (roles: barracks/
factory/library/university per-city-per-role counts; siege: pillaged
events > 0 in war seeds; air: bombers/fighters built in late-era
seeds) + peace-witness re-run; reviewer engine-diff + clean-clone.

## Slice-4 DESIGN SEED (frontier defence) — written 2026-07-28, opens after slice-3 gates

What slice-3 already delivered: `frontline` role (threatened =
enemyNear within threatRadius) + reactive walls (B13g canWall) + the
science-list block on the border. What slice-4 still owes (§3
"frontier-exposed cities ONLY" + "defender coverage in core"):

1. **Proactive frontier detection** — today walls are REACTIVE (a
   visible enemy within 8). A frontier city facing a known rival
   direction should wall BEFORE the stack arrives: fog-honest border
   test = proximity of the nearest KNOWN rival city (explored-map
   read, the nearestKnownEnemyCity machinery) within a knob radius
   (`cityRoles.frontierRadius`, sweep ~12-16). Frontier-but-not-yet-
   threatened cities get walls in the role slot (below canWall's
   urgency, above the role lists).
2. **Core defender floor** — interior cities (neither frontline nor
   frontier) may relax to wantDefenders 1 even under garrisonAlways2
   stances, freeing shields for the role lists; frontier/frontline
   keep the full floor. Measured risk: barb spawns in the interior —
   the sweep + peace witness arbitrate.
3. Explicitly NOT slice-4: unit repositioning (garrison discipline is
   slice-1d and stays); wall-building in EVERY city (the anti-goal).

Gates: fixture-first (frontier-without-visible-threat walls up; an
interior city does not), canonical sweep + peace witness (watch M3 —
wall shields compete with growth), reviewer engine-diff. Expect
BEHAVIORAL + STAMP (new knob).

## Slice-5 DESIGN SEED (wonders appetite) — written 2026-07-28, LAST W6 slice

Existing machinery: wonderAppetite tiers (none/low/med/high) +
WONDER_AFFINITY stance lists + the builder wonderDrive + capital
concentration. What slice-5 owes (§3a):

1. **Role-aware wonder placement** — the wonder-drive city pick is
   capital-concentrated today; a HIGH-shield production-role city
   should be eligible when the capital is busy (roleFacts reuse).
2. **The super-food specialist play** — a spawner-role city with a
   big surplus considers a HAPPINESS wonder (hanging-gardens class)
   even if it mostly benefits itself: it unlocks running many
   specialists there (§3a verbatim). Gate on surplus + appetite ≥
   low + the wonder being in the civ's affinity or happiness class.
3. **Growth/happiness affinity widening** — growth stance's list
   already carries the happiness wonders; the appetite THRESHOLDS
   (wonderLowShields/wonderMedBuildings) may need role-scaling so a
   production-role city starts wonders earlier than a default city.
   Sweep-calibrated, not guessed (the slice-1c lesson).
4. Explicitly NOT slice-5: new wonder EFFECTS (all shipped), Apollo/
   Manhattan gates (own machinery), the v2 draft-from-wonder-city.

Gates: fixture-first (super-food city picks the happiness wonder;
production-role city hosts the drive when the capital is busy),
sweep floors + wonder-count coverage probe (wonderBuilt 25/3-games
canonical is the pre-slice reference), reviewer. Closing slice-5
CLOSES the W6 window → W7 map shapes opens.

## Slices 3-5 delivery log (2026-07-28) — W6 CODE-COMPLETE

All three landed same-day, each fixture-first with an honest re-record;
natural 545/winner-p2 HELD across all four W6 re-records (no macro shift).

- **Slice-3 @692ca7e** (city roles + war pair): roles frontline/production/
  science/spawner + tiered lists + happiness ladder; siege pillage at the
  massing hold; the air brain (bomber-with-siege, fighter interception,
  nuclear inert). BEHAVIORAL + STAMP, BEHAVIOR t100 HELD. Reviewer PASS
  #2831 + pristine clean-clone GREEN #2832 (which also surfaced the
  density-era parallel-flake lesson — engine reds now pair-prove by
  isolation on commit+parent).
- **Slice-4 @d5007db** (frontier defence): proactive frontier walls
  (nearKnownRivalCity, frontierRadius 12) + garrisonNeed = ONE shared floor
  at all three slice-1d sites (interior relaxes to 1 for garrisonAlways2
  stances — a surfaced CONTRACT CHANGE, ai.test re-authored to
  border-scoped). BEHAVIORAL from t100 (the floor acts turn 1) + STAMP.
  Reviewer combined s3+s4 PASS #2836 (3-site alignment confirmed).
- **Slice-5 @be01b87** (wonders appetite): the §3a super-food specialist
  play — allContentInCity wonders host in the best spawner city; persist
  widened to any host. Seed items 1+3 resolved MEASURED-FIRST (placement
  was already highest-shield since #26; thresholds stay sweep-calibrated).
  BEHAVIORAL, NO STAMP — the first stamp-free W6 slice (002/maptype/
  ff-parity held).

OPEN: the W6-closing combined gate at be01b87 (sim-runner sweep #2837 —
floors + role/siege/air/wonder coverage + interior-floor-vs-barbs watch —
+ reviewer #2838). The W6 marker tags on both; W7 map shapes opens after.
