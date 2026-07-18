# N11 — unit upgrades + Leonardo's Workshop: buildable spec (architect, 2026-07-18)

Grounded in reviewer fact-check #1445 (pre-spec, data-first). HEADLINE
REFRAME: neither half is Civ1. Leonardo's Workshop debuted in CIV2
(the overview page's matrix says civ1=no; wonders.json's 21 entries
are verified as exactly Civ1's real roster — the workitem's "already
in wonders.json" assumed a wonder that never existed). Manual
upgrade-for-gold enters the series at CIV3 (no Upgrade page exists
for Civ1 or Civ2; Civ2's only upgrade path IS Leonardo). Both ship as
labeled imports under the civ-mixing ruling: 3a = Civ3-shape, 3b =
Civ2-shape (chains Civ2-authentic-by-table where clean, original-
projection where the Civ1 roster lacks intermediates). Surfaced to
the user in human-workitems as an FYI with proceed-as-labeled default.

Two windows, in order (bugfixer slicing #1440, adopted):

## Window 3a — upgradesTo data + manual upgradeUnit (behaviorally golden-neutral; rulesetHash ripple budgeted)

1. **The upgradesTo overlay** (UNIT_OVERLAY in tools/mapdata.js →
   units.json regenerated), Civ1-roster projection of the Civ2 table:
   - `militia → musketeers`, `phalanx → musketeers`,
     `legion → musketeers`, `musketeers → riflemen`
     [Civ2-authentic-by-table; pikemen/archers rows dropped — units
     absent from the Civ1 roster]
   - `catapult → cannon`, `cannon → artillery` [Civ2-authentic-by-table]
   - `chariot → knights`, `cavalry → knights` [original-projection;
     Civ1 lacks elephant/crusaders/dragoons. Deliberately NO
     `knights → armor` — the Civ2 table never extends mounted chains
     to Armor; inventing that would be a new chain, not a projection]
   - `trireme → sail`, `sail → frigate`, `frigate → transport`
     [original-projection, transport-lineage reading; labeled
     deliberately — Civ1's frigate is also a warship]
   - `ironclad → cruiser` [original-projection; no destroyer in Civ1]
   - NO-OP (no successor authored): settlers, diplomat, caravan,
     cruiser, and every chain endpoint. Provenance class goes in the
     overlay comment PER ROW (the blockade/settler-upkeep comment
     pattern) — Civ2-authentic-by-table vs original-projection kept
     separate.
   - Consistency check: where obsoletedBy chains overlap these rows,
     the upgrade target's enabling tech must match or postdate the
     obsoleting tech (unit test, not hand-eyeball).
2. **Command `upgradeUnit { unitId }`** [Civ3-shape; formula = house
   choice, no wiki formula exists]: unit stands in an OWNED city;
   owner knows the successor's tech; cost
   `gold = rules.upgrade.baseGold + rules.upgrade.goldPerShield *
   max(0, costNew - costOld)` (10 / 2; all numbers in a new
   rules.json `upgrade` block); gold deducted, unit type replaced
   in place (hp/moves per the new type's fresh values, position and
   id kept). **Veteran CARRIES on the paid upgrade** (house choice,
   Civ3-consistent — you paid; contrast 3b). Rejections:
   `notYourUnit`/`notYourTurn` (standard), `notInCity` (not on an
   owned city tile), `noUpgrade` (no upgradesTo row or successor
   tech unknown), `notEnoughGold`.
3. **Golden footprint:** rules.json upgrade block + units.json
   upgradesTo rows → rulesetHash moves → FULL createGame ripple
   (A82a/002/soak/natural/turn-100/witness re-record; the A89
   standing doctrine — the workitem's "golden-safe slice" wording is
   retired). Behaviorally neutral: AI never issues upgradeUnit in 3a.
   Scenario pins: an in-city upgrade (veteran-carry asserted), a
   cost-formula pin (windfall-math style), the noUpgrade and
   notEnoughGold rejections.
4. Client half (helper, post-window, A90 pattern): action-bar Upgrade
   button w/ cost, REASON_TEXT rows, turnlog line.

## Window 3b — Leonardo's Workshop (behavioral golden window, SEPARATE)

WONDER_OVERLAY row: requires `invention`, obsolete with `automobile`,
cost 400 [Civ2-authentic; both tech ids exist in data/techs.json].
Effect, per the Civ2 article (NOT the overview page — its
"one per turn" line contradicts the detailed article and matches the
freeciv rule it links; stub-vs-detail doctrine, the N10 precedent):

- TRIGGER: each tech discovery/acquisition by the wonder's owner, and
  at no other time (units gained between discoveries wait).
- SCOPE: ALL eligible units at that trigger (no per-turn ration);
  eligible = unit has an upgradesTo row AND the owner knows the
  successor's tech.
- PROGRESSION: ONE STEP along the chain per trigger per unit (a
  chariot takes multiple discoveries to reach knights' successor even
  if the end tech is already known).
- COST: free. VETERAN: LOST — the replacement is non-veteran
  (Civ2-article-explicit; contrast 3a's paid carry).
- DETERMINISM: iterate the owner's units in unitOrder (id ascending);
  no RNG draws.
- Bribery-acquired-city upgrades: D-family note only (no bribery
  pre-diplomacy).

Golden footprint: wonders.json row → rulesetHash ripple AND
behavioral movement (any AI holding Leonardo upgrades on its
discoveries) → soak/natural/turn-100 may move behaviorally; full
re-record budgeted; scenario pin: a Leonardo owner discovers a tech →
exactly one step, all eligible units, veteran dropped.

## Tests

Fixture-first both windows; the 3a scenarios above; 3b scenario; unit
tests for the overlay-vs-obsoletedBy consistency check and the
one-step-per-trigger rule; suite + twins green both engines; both
data checksums re-pin per window.

## Provenance summary

3a command Civ3-shape (formula house-choice, labeled); upgradesTo
rows individually labeled Civ2-authentic-by-table or
original-projection; 3b mechanics Civ2-authentic (article-cited, with
the overview-page conflict resolved by stub-vs-detail); Civ1's wonder
roster remains exactly its real 21 — Leonardo is an ADDITION labeled
Civ2, not a correction.
