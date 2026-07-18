# marker-0055 — N11 window 3a: unit upgrades

## What it delivers

The manual upgrade path, honestly labeled: the reviewer's pre-spec
fact-check established that neither N11 half is Civ1 — Leonardo's
Workshop debuted in Civ2 (the wiki matrix says civ1=no; our 21-wonder
roster verified as exactly Civ1's), and player-initiated
upgrade-for-gold enters the series at CIV3. So 3a ships as a labeled
Civ3-shape import under the civ-mixing ruling, with the user's FYI
(proceed-as-labeled default) filed in human-workitems.

`upgradeUnit { unitId }`: a unit in an owned city whose owner knows
the successor's tech pays `10 + 2 × max(0, costNew − costOld)` gold
(rules.upgrade block) and becomes its successor in place. Veteran
CARRIES on the paid upgrade (house choice, Civ3-consistent —
contrast the coming 3b where Leonardo's free upgrades drop it,
Civ2-article-explicit). The R2 replacement rule is pinned ONCE in
applyUpgrade for both windows: moves = min(remaining, new type's
moves) — the pay-to-move exploit the reviewer caught is closed; the
heal half of that exploit class is structurally moot (units carry no
persistent hp).

## The data

units.json gains 12 upgradesTo rows via UNIT_OVERLAY — the Civ1-roster
projection of the Civ2 Leonardo table with PER-ROW provenance
comments: Civ2-authentic-by-table (the foot funnel
militia/phalanx/legion→musketeers→riflemen, catapult→cannon→artillery)
vs original-projection (chariot/cavalry→knights, the
trireme→sail→frigate→transport transport-lineage, ironclad→cruiser).
Deliberately NO knights→armor — the Civ2 table never extends mounted
chains there. Mid-window the bugfixer caught my consistency-check
wording contradicting the table itself; ruled to the forward-upgrade
invariant `tgtTech ≥ srcTech` (the funnel counter-example named in the
test comment), all 12 rows standing.

## Pins and goldens

Scenarios 035-038 cross-language (in-city upgrade + veteran-carry +
moves-not-refunded 0xe1dd4b67; cost formula 0x658e2ab6; noUpgrade
0xf8c50c3e; notEnoughGold/notInCity 0xcdab717f), PORTED count 37.
Full rulesetHash ripple per the A89 standing doctrine, verified
BEHAVIORALLY NEUTRAL (soak rounds + natural winner unchanged; the AI
never issues upgradeUnit in 3a): soak
0xb626ea6d/0x1cf45915/0x39ed03ae/0x54215fa2, natural 0x23953eca,
A82a anchors + scenario 002 + witness re-recorded, both data
checksums re-pinned, JS==Luau throughout. Suite 532/532; count pins
re-synced at the boundary.

## Next

Window 3b — Leonardo's Workshop (behavioral golden window): the
wonder row via WONDER_OVERLAY (invention/automobile/400), the single
tech-grant seam, one step per discovery for all eligible units,
non-veteran replacements via the same applyUpgrade machinery
(keepVeteran=false). The spec's 3b half is already reviewer-verified;
it opens next in the singular stream.
