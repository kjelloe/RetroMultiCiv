// Happiness (docs/04 §1): citizens are happy, content, or unhappy. The first
// rules.contentCitizens workers are content, later ones born unhappy.
// Luxuries (trade split + entertainers) and content bonuses (Temple chain,
// wonders) repair the mood, worst-first. A city with unhappy > happy is in
// DISORDER: it produces no shields and contributes no gold/bulbs (food is
// unaffected). Specialists (idle citizens) never count as unhappy:
// Entertainers make luxuries, Taxmen gold, Scientists bulbs (pop >= 5 for
// the latter two). Deviation from Civ 1: luxuries are computed from the
// city's raw trade even during disorder, so disorder cannot lock itself in.
import { workedTiles, cityYields, effectPct, wonderActive } from './cities.js';
import { sortIds } from './combat.js';
import { governmentOf } from './government.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

// Explicit specialists are stored on the city; entertainers are the rest of
// the citizens who work no tile.
function specialistsOf(city, workedCount) {
  const taxmen = city.taxmen === undefined ? 0 : city.taxmen;
  const scientists = city.scientists === undefined ? 0 : city.scientists;
  let entertainers = city.pop - workedCount - taxmen - scientists;
  if (entertainers < 0) entertainers = 0;
  return { entertainers, taxmen, scientists };
}

function cityMood(state, city, ruleset) {
  const rules = ruleset.rules;
  const player = state.players[city.owner];
  const workedCount = workedTiles(state, city, ruleset).length - 1; // minus center
  const s = specialistsOf(city, workedCount);
  const workers = city.pop - s.entertainers - s.taxmen - s.scientists;

  let unhappy = workers - rules.contentCitizens;
  if (unhappy < 0) unhappy = 0;
  let content = workers - unhappy;
  let happy = 0;

  // war unhappiness (Republic/Democracy): each military unit from this city
  // that is away from any of the player's city tiles upsets citizens
  const gov = governmentOf(state, city.owner, ruleset);
  if (gov.warUnhappiness > 0) {
    let abroad = 0;
    for (const uid of sortIds(Object.keys(state.units))) {
      const u = state.units[uid];
      // air-truth: freeSupport units (diplomat, caravan) never cause away-from-home
      // war unhappiness — the same predicate the shield-upkeep count uses.
      if (u.home !== city.id || ruleset.units[u.type].attack <= 0
          || ruleset.units[u.type].freeSupport === true) continue;
      let atHome = false;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        if (c && c.owner === city.owner && c.x === u.x && c.y === u.y) atHome = true;
      }
      if (!atHome) abroad = abroad + 1;
    }
    let war = abroad * gov.warUnhappiness;
    while (war > 0 && content > 0) { content = content - 1; unhappy = unhappy + 1; war = war - 1; }
    while (war > 0 && happy > 0) { happy = happy - 1; unhappy = unhappy + 1; war = war - 1; }
  }

  // luxuries: every luxPerStep upgrades one citizen one step, worst first
  const luxRate = player.luxRate === undefined ? 0 : player.luxRate;
  let lux = idiv(cityYields(state, city, ruleset).trade * luxRate, 100);
  lux = lux + idiv(lux * effectPct(city, ruleset, 'luxBonus'), 100);
  lux = lux + s.entertainers * rules.specialistOutput;
  let steps = idiv(lux, rules.luxPerStep);
  while (steps > 0 && unhappy > 0) { unhappy = unhappy - 1; content = content + 1; steps = steps - 1; }
  while (steps > 0 && content > 0) { content = content - 1; happy = happy + 1; steps = steps - 1; }

  // buildings: content bonuses calm unhappy citizens
  let bonus = 0;
  for (const id of city.buildings === undefined ? [] : city.buildings) {
    const eff = ruleset.buildings[id].effect;
    if (eff.contentBonus === undefined) continue;
    let b = eff.contentBonus;
    if (eff.contentDoubleTech !== undefined && player.techs.indexOf(eff.contentDoubleTech) !== -1) {
      b = b * 2;
    }
    if (id === 'temple' && wonderActive(state, 'oracle', ruleset)) {
      const oracleHome = state.cities[state.wonders['oracle']];
      if (oracleHome && oracleHome.owner === city.owner) b = b * 2;
    }
    bonus = bonus + b;
  }
  // wonders owned by this player: empire-wide and in-city moods
  let happyBonus = 0;
  let allContent = false;
  for (const wid of sortIds(Object.keys(state.wonders === undefined ? {} : state.wonders))) {
    if (!wonderActive(state, wid, ruleset)) continue;
    const home = state.cities[state.wonders[wid]];
    if (!home || home.owner !== city.owner) continue;
    const eff = ruleset.wonders[wid].effect;
    if (eff.contentEverywhere !== undefined) bonus = bonus + eff.contentEverywhere;
    if (eff.happyEverywhere !== undefined) happyBonus = happyBonus + eff.happyEverywhere;
    if (eff.allContentInCity === true && home.id === city.id) allContent = true;
  }
  // martial law: garrisoned military units pacify (government-limited)
  if (gov.martialLawMax > 0) {
    let martial = 0;
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.owner === city.owner && u.x === city.x && u.y === city.y
          && ruleset.units[u.type].attack > 0) martial = martial + 1;
    }
    if (martial > gov.martialLawMax) martial = gov.martialLawMax;
    bonus = bonus + martial;
  }
  while (bonus > 0 && unhappy > 0) { unhappy = unhappy - 1; content = content + 1; bonus = bonus - 1; }
  if (allContent) { content = content + unhappy; unhappy = 0; }
  while (happyBonus > 0 && content > 0) { content = content - 1; happy = happy + 1; happyBonus = happyBonus - 1; }

  return {
    happy, content, unhappy, workers, lux,
    entertainers: s.entertainers, taxmen: s.taxmen, scientists: s.scientists,
    disorder: unhappy > happy
  };
}

// Turn wrap (before cities harvest): store/refresh each city's disorder flag
// so processCities and playerIncome read one consistent verdict all turn.
function updateDisorder(state, ruleset, events) {
  for (const cityId of state.cityOrder === undefined ? [] : state.cityOrder) {
    const city = state.cities[cityId];
    if (!city) continue;
    const disorder = cityMood(state, city, ruleset).disorder;
    if (disorder && city.disorder !== true) {
      city.disorder = true;
      events.push({ type: 'cityDisorder', cityId });
    } else if (!disorder && city.disorder === true) {
      delete city.disorder;
      events.push({ type: 'cityOrderRestored', cityId });
    }
  }
}

export { cityMood, updateDisorder, specialistsOf };
