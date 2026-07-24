// XVII #20/#21: a READ-ONLY client mirror of the per-city upkeep that
// engine/cities.js processCities deducts each turn — for the economy + city
// overview panels only. Client-only, golden-neutral: it reads state and never
// mutates it. Keep in sync with the processCities upkeep block (unit shields +
// settler food) and building maintenance; the currency LABELS matter — Civ1 unit
// upkeep is SHIELDS and settler upkeep is FOOD, neither is gold.
import { governmentOf } from '../../engine/government.js';

export function cityUpkeep(state, cityId, ruleset) {
  const city = state.cities[cityId];
  let bldgGold = 0; // building maintenance (the only GOLD sink)
  for (const b of (city.buildings || [])) bldgGold += (ruleset.buildings[b] || {}).maintenance || 0;

  // unit upkeep in shields (government-dependent); homeless units are free
  const gov = governmentOf(state, city.owner, ruleset);
  let shields = 0;
  if (gov.upkeepShields > 0) {
    let supported = 0;
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.home === cityId && ruleset.units[u.type].freeSupport !== true) supported = supported + 1;
    }
    const owed = (supported - gov.freeUnitsPerCity) * gov.upkeepShields;
    if (owed > 0) shields = owed;
  }

  // settler food upkeep (flat settlerFoodUpkeep per homed settler)
  const settlerUpkeep = ruleset.rules.settlerFoodUpkeep === undefined ? 0 : ruleset.rules.settlerFoodUpkeep;
  let food = 0;
  if (settlerUpkeep > 0) {
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.home === cityId && u.type === 'settlers') food = food + settlerUpkeep;
    }
  }
  return { bldgGold, shields, food };
}
