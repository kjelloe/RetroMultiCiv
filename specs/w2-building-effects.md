# W2 — Mfg. Plant + SDI Defense effects (engine window, architect)

Wiki-authoritative Civ1 semantics (dump-verified, not guessed):

## Mfg. Plant
Wiki `Mfg. Plant (Civ1)`: **"Production increased by 100%. Makes Factory obsolete.
Power Plants increase production."** (cost 320 / req Robotics / maint 6 — matches the
existing `data/buildings.json` entry, effect currently `{}`). Factory page confirms: "If
a Mfg. Plant is built in a city with a Factory, the Factory becomes redundant; it no
longer increases production and can be sold off."

Engine model (`engine/cities.js cityShieldOutput`, lines 796–814): `shieldBonus` is
SUMMED across buildings via `effectPct`, then DOUBLED if any `boostsFactory` plant (or
Hoover) powers the city. Factory = `shieldBonus:50` → +50%, powered → +100%.

**W2 change:**
- Mfg. Plant effect → `{ "shieldBonus": 100, "obsoletesFactory": true }`.
- In `cityShieldOutput`: if the city has a building with `obsoletesFactory:true`, EXCLUDE
  the Factory's shieldBonus from the sum (Civ1 "Factory redundant") — so Mfg alone = 100,
  Mfg+Factory = 100 (not 150), Mfg+plant = 200 (doubling still applies; "Power Plants
  increase production"). Keeps the doubling convention already used for Factory.
- Twin: `luau/cities.luau` mirrors byte-shaped.

## SDI Defense
Wiki: SDI is "the best - and only - defense against Nukes"; the Palace and SDI Defense are
immune to sabotage. Civ1 scope: a city with SDI Defense is protected from nuclear attack.

Engine: `engine/combat.js` nuke-blast path (~line 199) performs no SDI check.
**W2 change:** SDI Defense effect → `{ "blocksNuke": true }`. In the nuke path: if the
TARGET city (or the city on the target tile) has a building with `blocksNuke:true`, the
nuke is intercepted — no detonation/area-kill/pollution; emit an intercept event
(NUKE_INTERCEPTED, catalog + sound). (Sabotage-immunity for SDI/Palace is a separate
smaller item; scope-check whether diplomat-missions already excludes them — if not, note
it, don't expand W2.)
- Twin: `luau/combat.luau` mirrors.

## Golden classification
Both DORMANT at the sim seeds (AI builds ~0 buildings, rarely nukes) → expect
GOLDEN-NEUTRAL to sim goldens; PROVE via fixture-first SCENARIO(s):
- Mfg scenario: city Mfg-only = +100%; Mfg+Factory = +100% (redundant); Mfg+plant = +200%.
- SDI scenario: nuke on SDI city → intercepted, city intact, no pollution; nuke on non-SDI
  city → normal detonation (control).
Fixture FIRST (pin the cross-language final.hash), then engine + twin, then verify sim
goldens STAMP-identical. Files: engine/cities.js, engine/combat.js, data/buildings.json,
luau/cities.luau, luau/combat.luau, test/scenarios/06X-*.json (+ event catalog for
NUKE_INTERCEPTED). Locks held.
