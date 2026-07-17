// A58a: pure catalog TEXT — the structured ruleset effect fields rendered to
// human strings, plus the tech cross-link maps. DATA → STRING ONLY: no DOM, no
// THREE, no engine imports, so panels.js, the A58b pedia panel, AND a future
// Roblox help surface all consume the SAME renderer (the A88 dual-source lesson
// applied ahead of time). Extracted verbatim from panels.js — behaviour is
// byte-identical; makeCatalogText(ruleset) closes over the ruleset tables the
// renderers reference (techs for names, units/buildings/wonders for the maps).

// opts.wonderMark: the suffix appended to wonder names in techUnlocks (default
// ' 🏆' for the panels/pedia; turnlog passes '' — its only difference from the
// panels build, so the map is otherwise byte-identical and shared here).
export function makeCatalogText(ruleset, opts) {
  const { techs, units, buildings, wonders } = ruleset;
  const wonderMark = opts && opts.wonderMark !== undefined ? opts.wonderMark : ' 🏆';

  // plain-language lines for the structured effect fields (tools/mapdata.js overlays)
  const EFFECT_TEXT = {
    halvesGrowthFood: () => 'keeps half the food box when the city grows',
    growthPast10: () => 'lets the city grow beyond population 10',
    veteranUnits: () => 'new units here start as veterans',
    defenseMultiplier: v => `defenders ×${v} against attacks`,
    taxBonus: v => `+${v}% gold in this city`,
    sciBonus: v => `+${v}% science in this city`,
    luxBonus: v => `+${v}% luxuries in this city`,
    contentBonus: v => `calms ${v} unhappy citizen${v > 1 ? 's' : ''}`,
    contentDoubleTech: v => `doubled once you know ${techs[v].name}`,
    corruptionReduction: v => `−${v}% corruption in this city`,
    shieldBonus: v => `+${v}% shields in this city`,
    boostsFactory: () => 'doubles the Factory bonus here',
    isPalace: () => 'your capital — no corruption at the seat of power',
    contentEverywhere: v => `${v} content citizen${v > 1 ? 's' : ''} in every city`,
    happyEverywhere: v => `${v} happy citizen${v > 1 ? 's' : ''} in every city`,
    allContentInCity: () => 'everyone in this city stays content',
    doublesTemple: () => 'your Temples work twice as hard',
    cityTradeBonus: () => '+1 trade on every trade tile here',
    wallsEverywhere: () => 'city walls in all your cities'
  };

  function effectText(def) {
    const parts = [];
    for (const key of Object.keys(def.effect || {})) {
      if (EFFECT_TEXT[key]) parts.push(EFFECT_TEXT[key](def.effect[key]));
    }
    if (def.obsoleteBy) parts.push(`obsolete with ${techs[def.obsoleteBy].name}`);
    return parts.join(' · ');
  }

  // tech id -> what it unlocks / which techs need it (research + pedia sublines)
  const techUnlocks = {};
  const techLeadsTo = {};
  {
    const add = (map, key, name) => { (map[key] = map[key] || []).push(name); };
    for (const id of Object.keys(units)) if (units[id].tech !== '') add(techUnlocks, units[id].tech, units[id].name);
    for (const id of Object.keys(buildings)) if (buildings[id].tech !== '') add(techUnlocks, buildings[id].tech, buildings[id].name);
    for (const id of Object.keys(wonders)) if (wonders[id].tech !== '') add(techUnlocks, wonders[id].tech, wonders[id].name + wonderMark);
    for (const id of Object.keys(techs)) {
      for (const p of techs[id].prereqs) add(techLeadsTo, p, techs[id].name);
    }
  }

  return { effectText, techUnlocks, techLeadsTo, EFFECT_TEXT };
}
