# Civ1 feature-completeness audit (2026-07-25)

Read-only audit: engine + `data/*.json` cross-referenced against the Civ1 wiki dump
(authoritative per project ruling). Verdict: remarkably faithful, few small gaps.
`docs/01-game-spec.md §11` already tracks most deviations honestly. Wonder roster is
EXACTLY Civ1-complete (Adam Smith's / Marco Polo's are Civ2+ — their absence is correct).

## [ABSENT] genuine Civ1 features not implemented

1. **We Love the King Day / celebration bonus** — the standout gap. Zero
   celebration/WLTKD/rapture refs in engine/shared/data. Spec `docs/01 §4.4` lists it as
   v1 scope ("happy ≥ half and no unhappy ⇒ celebration bonus"); wiki has a Civ1 WLTKD
   page. Happy citizens ARE computed (`engine/happiness.js`) but trigger no effect. NOT in
   the honest §11 deviation list. Low cost (threshold + corruption/trade bonus). → v1.

## [PARTIAL] present but incomplete

2. **Manufacturing Plant inert** — `data/buildings.json` effect `{}`; no engine wiring.
   Wiki: +100% production, obsoletes Factory. `engine/cities.js cityShieldOutput` only
   applies Factory's shieldBonus. → v1 (small: add shieldBonus:100 + wire).
3. **SDI Defense inert** — `data/buildings.json` effect `{}`; nuclear-blast path
   `engine/combat.js` does no SDI check. Wiki: SDI is the ONLY defense vs nukes. Engine
   fully simulates nukes but not their counter — asymmetric hole. → v1.
4. **Diplomat "Investigate City"** — the 6th Civ1 diplomat action. ALREADY IN FLIGHT
   (architect diplomacy window, `specs/d6-discovered-sabotage.md` sequence). → covered.
5. **Score omits happy-citizen term (+ pollution penalty)** — `engine/score.js` has
   pop+techs+futureTech+wonders; spec §10 also has happyCitizens×1 − pollution. Noted in
   §11 but happiness is now a full system, so closeable. → minor.
6. **Bankruptcy clamps instead of selling buildings** — `engine/tech.js` clamps gold to
   0; Civ1 force-sells a building. Already a documented §11 deviation; `sellBuilding`
   (A86) machinery exists to build on. → low priority.

## [PROVENANCE] implemented but mislabeled

7. **Re-home "Home" order mislabeled "Civ 1"** — `engine/movement.js:245` comment. The
   Home/re-home order is Civ2 (no Civ1 Home command). Feature is fine; only the comment's
   provenance is wrong. → trivial relabel to `Civ2-shape` (fold into an engine window).
8. **plan-version2.md stale espionage line** — FIXED @d46fde6 (un-shelved; D6 shipped it).

## Top 3 for a faithful v1 (audit's recommendation)
1. We Love the King Day (the one absent spec-scoped v1 mechanic).
2. Wire Mfg. Plant (+100% production) + SDI Defense (nuclear counter) — two of 21
   buildings buildable-but-inert; SDI glaring since nukes are fully simulated.
3. Re-home provenance comment relabel (trivial).

## Verified COMPLETE (not gaps)
All 21 Civ1 wonders (working effects), all 21 buildings (only #2/#3 inert), full 28-unit
roster + naval-truth + air-truth, corruption/martial-law/war-unhappiness/disorder/
specialists, Communism, Pyramids-any-gov, difficulty ladder, goody huts, caravans+trade
routes, obsolescence/upgrades, pollution+warming+meltdown, 8 disasters, space race, palace.
