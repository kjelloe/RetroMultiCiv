// Research: trade arrows from worked city tiles split into gold (tax) and
// science bulbs (sci) by per-player rates; bulbs buy advances whose cost
// escalates with the number of techs already known (Civ 1 global escalation,
// not per-tech prices). Luxuries, corruption and government caps come later.
import { cityYields, effectPct, sellBuildingFrom, wonderActive, resolveAllWorked } from './cities.js';
import { governmentOf, corruptionFor } from './government.js';
import { routeArrows } from './trade.js';
import { sortIds } from './combat.js';
import { leonardoUpgrade } from './upgrade.js';
import { difficultyOf, hasHumanSeat } from './difficulty.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

// XII.2 Future Tech (specs/xii2-future-tech.md): the repeatable end-of-tree
// science sink. A synthetic sentinel research target (NOT a real tech id — never
// pushed to player.techs); once the tree is exhausted, researching it accrues
// player.futureTech (the "N"), which scores like a normal advance and escalates
// cost. Civ1-authentic: repeatable, score-only, no cap. Already referenced as the
// age-grant `except` id in data/rules.json.
const FUTURE_TECH_ID = 'future-tech';

function researchCost(state, playerId, ruleset) {
  const player = state.players[playerId];
  // XII.2: the escalation count includes futureTech levels, so each Future Tech
  // costs more than the last (Civ1 feel, no new formula). futureTech is 0 until
  // the tree empties, so every real-tech cost is byte-identical.
  const known = player.techs.length + (player.futureTech === undefined ? 0 : player.futureTech);
  // bulb escalation is an ASYMMETRIC difficulty knob: with a human seat present the
  // per-advance coefficient splits (AI aiBulbInc / human humanBulbInc); all-AI +
  // crafted states keep techBaseCost (prince humanBulbInc == techBaseCost, so a
  // default human game leaves the human unchanged).
  let coeff = ruleset.rules.techBaseCost;
  const d = difficultyOf(state, ruleset);
  if (d !== null && hasHumanSeat(state)) coeff = player.human === true ? d.humanBulbInc : d.aiBulbInc;
  return coeff * (known + 1);
}

function knows(player, techId) {
  return player.techs.indexOf(techId) !== -1;
}

function prereqsMet(player, techId, ruleset) {
  const tech = ruleset.techs[techId];
  if (!tech) return false;
  for (const p of tech.prereqs) {
    if (!knows(player, p)) return false;
  }
  return true;
}

// Sorted for deterministic order in every language.
function availableTechs(state, playerId, ruleset) {
  const player = state.players[playerId];
  const ids = Object.keys(ruleset.techs);
  ids.sort();
  const out = [];
  for (const id of ids) {
    if (!knows(player, id) && prereqsMet(player, id, ruleset)) out.push(id);
  }
  // XII.2: once the REAL tree is exhausted, the only remaining target is the
  // repeatable Future Tech sentinel (tree-exhaustion subsumes the wiki's
  // "Fusion Power + rest of tree" gate — Fusion is in the tree). This fires
  // ONLY on empty, so every non-exhausted game returns the identical real list.
  if (out.length === 0) out.push(FUTURE_TECH_ID);
  return out;
}

function setResearch(state, cmd, ruleset) {
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  // A54 off-turn pre-work: self-scoped (touches only the issuing player's
  // state, zero rng) — legal while a rival moves; no turn check
  // XII.2: the Future Tech sentinel is a valid target ONLY once the real tree is
  // exhausted (availableTechs then offers exactly it); reject it otherwise.
  if (cmd.tech === FUTURE_TECH_ID) {
    if (availableTechs(state, cmd.playerId, ruleset).indexOf(FUTURE_TECH_ID) === -1) {
      return { ok: false, reason: 'treeNotExhausted' };
    }
    player.researching = FUTURE_TECH_ID;
    return { ok: true, events: [{ type: 'researchSet', playerId: cmd.playerId, tech: FUTURE_TECH_ID }] };
  }
  if (!ruleset.techs[cmd.tech]) return { ok: false, reason: 'unknownTech' };
  if (knows(player, cmd.tech)) return { ok: false, reason: 'alreadyKnown' };
  if (!prereqsMet(player, cmd.tech, ruleset)) return { ok: false, reason: 'prereqsMissing' };
  player.researching = cmd.tech;
  return { ok: true, events: [{ type: 'researchSet', playerId: cmd.playerId, tech: cmd.tech }] };
}

function setRates(state, cmd, _ruleset) {
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  // A54 off-turn pre-work: self-scoped — legal while a rival moves
  const tax = cmd.tax;
  const sci = cmd.sci;
  const lux = cmd.lux === undefined ? 0 : cmd.lux;
  const valid = Number.isInteger(tax) && Number.isInteger(sci) && Number.isInteger(lux)
    && tax >= 0 && sci >= 0 && lux >= 0 && tax + sci + lux === 100
    && tax % 10 === 0 && sci % 10 === 0 && lux % 10 === 0;
  if (!valid) return { ok: false, reason: 'badRates' };
  const cap = governmentOf(state, cmd.playerId, _ruleset).maxRate;
  if (tax > cap || sci > cap || lux > cap) return { ok: false, reason: 'rateTooHigh' };
  player.taxRate = tax;
  player.sciRate = sci;
  if (lux > 0) player.luxRate = lux; else delete player.luxRate;
  return { ok: true, events: [{ type: 'ratesSet', playerId: cmd.playerId, tax, sci, lux }] };
}

// Per-turn income for one player, before it is applied: per-city trade split
// so Marketplace/Bank (tax) and Library/University (sci) multiply their own
// city's share; building maintenance comes out of gold. Pure — also used by
// N9b: one city's gold + science CONTRIBUTION (the tax/science split with the
// building taxBonus/sciBonus multipliers applied). Extracted verbatim from
// playerIncome's inner loop so the AI build-payback lever (engine/ai.js) values
// a building by the SAME math the real income uses — a building's valued benefit
// equals its actual benefit by construction (no parallel formula). A disordered
// city contributes nothing; maintenance/anarchy are player-level and stay in
// playerIncome. taxmen/scientists are here for byte-fidelity but cancel in the
// lever's with/without delta (a building never changes specialists).
function cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset, workedIdx) {
  if (city.disorder === true) return { gold: 0, bulbs: 0 };
  let trade = cityYields(state, city, ruleset, workedIdx).trade;
  trade = trade - corruptionFor(state, city, trade, ruleset);
  // A89: the live permanent trade-route bonus adds ON TOP, post-corruption
  // (R1: base arrows exclude routes; route trade is corruption-free). No-op
  // (0) for a city without routes — the AI fields no caravans, so the sim
  // goldens are untouched. Lux stays on raw tile trade (existing deviation).
  trade = trade + routeArrows(state, city, ruleset);
  const cityTax = idiv(trade * taxRate, 100);
  const citySci = idiv(trade * sciRate, 100);
  let gold = cityTax + idiv(cityTax * effectPct(city, ruleset, 'taxBonus'), 100);
  // #29 science wonders (owner's active), additive % on the city's science on top of the
  // building sciBonus: copernicus +100% in its own city; seti +50% every city; isaac-newton
  // +66% OF the building science, owner's cities — but SUPPRESSED while seti is active (R3
  // non-cumulative, seti supersedes).
  let sciPct = effectPct(city, ruleset, 'sciBonus');
  let wSci = 0, setiActive = false, newtonPct = 0;
  for (const wid of sortIds(Object.keys(state.wonders === undefined ? {} : state.wonders))) {
    if (!wonderActive(state, wid, ruleset)) continue;
    const wh = state.cities[state.wonders[wid]];
    if (!wh || wh.owner !== city.owner) continue;
    const eff = ruleset.wonders[wid].effect;
    if (eff.cityScienceBonusPct !== undefined && wh.id === city.id) wSci = wSci + eff.cityScienceBonusPct;
    if (eff.scienceEverywherePct !== undefined) { wSci = wSci + eff.scienceEverywherePct; setiActive = true; }
    if (eff.sciBldgBonusPct !== undefined) newtonPct = eff.sciBldgBonusPct;
  }
  if (newtonPct > 0 && !setiActive) wSci = wSci + idiv(sciPct * newtonPct, 100);
  let bulbs = citySci + idiv(citySci * (sciPct + wSci), 100);
  if (city.taxmen !== undefined) gold += city.taxmen * perSpecialist;
  if (city.scientists !== undefined) bulbs += city.scientists * perSpecialist;
  return { gold, bulbs };
}

// the client HUD to show "gold 200 (+5)" forecasts.
function playerIncome(state, playerId, ruleset) {
  const player = state.players[playerId];
  const taxRate = player.taxRate === undefined ? ruleset.rules.defaultTaxRate : player.taxRate;
  const sciRate = player.sciRate === undefined ? ruleset.rules.defaultSciRate : player.sciRate;
  const perSpecialist = ruleset.rules.specialistOutput;
  const anarchy = governmentOf(state, playerId, ruleset).id === 'anarchy';
  const workedMap = resolveAllWorked(state, ruleset); // A8: one contention snapshot for the loop
  let gold = 0, bulbs = 0, maintenance = 0;
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    if (city.buildings !== undefined) {
      for (const b of city.buildings) maintenance += ruleset.buildings[b].maintenance;
    }
    if (city.disorder === true) continue; // civil disorder: no taxes, no research
    if (anarchy) continue; // anarchy: the state collects nothing
    const eco = cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset, workedMap[cid]);
    gold += eco.gold;
    bulbs += eco.bulbs;
  }
  return { gold, bulbs, maintenance };
}

// Runs once per game turn (turn wrap): collect trade, split, maybe discover.
// B13/A63: discovering a tech SELLS every building it obsoletes from the
// player's cities (Civ 1: barracks at Gunpowder, again at Combustion — the
// obsoletedByTechs list in data/buildings.json). The building is removed and
// its sell price (full build cost × rules.sellPriceRatio, integer gold)
// credited, with a buildingSold event per city for the turn log. Deterministic:
// cityOrder × sorted building ids. Reusable by A86 (manual sell); no per-city
// flag here. Non-roster-owner safe (only iterates the researching player's own
// cities via the owner guard).
function sellObsoletedBuildings(state, pid, discoveredTech, ruleset, events) {
  const buildingIds = Object.keys(ruleset.buildings).sort();
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const city = state.cities[cid];
    if (!city || city.owner !== pid || city.buildings === undefined) continue;
    for (const bid of buildingIds) {
      const def = ruleset.buildings[bid];
      if (def.obsoletedByTechs === undefined || def.obsoletedByTechs.indexOf(discoveredTech) === -1) continue;
      if (city.buildings.indexOf(bid) === -1) continue;
      // A86: shared removal+credit helper (the manual sell uses the same path)
      sellBuildingFrom(state, city, bid, ruleset, events, 'obsolete');
    }
  }
}

// R3 (N11 3b): the SINGLE tech-acquisition seam. Every path that grants a player
// a tech routes here — research now, goody-hut grants and D-family trades later —
// so the acquisition side effects (techDiscovered, obsolete-sell, and Leonardo's
// Workshop auto-upgrade) fire exactly once regardless of source. Leonardo is a
// no-op for a player who does not own an active one (so pre-3b research pins are
// byte-unchanged).
function grantTech(state, pid, techId, ruleset, events) {
  const player = state.players[pid];
  player.techs.push(techId);
  // acquiring a tech finishes any in-progress research of that same tech, so a
  // free grant (hut advance, Leonardo, debug) never double-completes it in
  // processResearch (would push a duplicate). Bulbs carry to the next pick.
  if (player.researching === techId) player.researching = '';
  events.push({ type: 'techDiscovered', playerId: pid, tech: techId });
  sellObsoletedBuildings(state, pid, techId, ruleset, events);
  leonardoUpgrade(state, pid, ruleset, events);
}

function processResearch(state, ruleset, events) {
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player.taxRate === undefined) player.taxRate = ruleset.rules.defaultTaxRate;
    if (player.sciRate === undefined) player.sciRate = ruleset.rules.defaultSciRate;
    if (player.bulbs === undefined) player.bulbs = 0;

    const income = playerIncome(state, pid, ruleset);
    player.gold = player.gold + income.gold - income.maintenance;
    if (player.gold < 0) player.gold = 0; // Civ 1 sells buildings; clamped for now
    player.bulbs = player.bulbs + income.bulbs;

    if (player.researching !== '' && player.researching !== undefined) {
      const cost = researchCost(state, pid, ruleset);
      if (player.bulbs >= cost) {
        player.bulbs = player.bulbs - cost; // overflow carries into the next advance
        const got = player.researching;
        if (got === FUTURE_TECH_ID) {
          // XII.2: a Future Tech level — bump the counter (score-only) and keep
          // researching the sentinel (repeatable, no cap). Never enters techs.
          player.futureTech = (player.futureTech === undefined ? 0 : player.futureTech) + 1;
          player.researching = FUTURE_TECH_ID;
          events.push({ type: 'futureTechResearched', playerId: pid, n: player.futureTech });
        } else {
          player.researching = '';
          grantTech(state, pid, got, ruleset, events);
        }
      }
    }
  }
}

// #29 great-library grant: the lowest sorted tech id a player LACKS that >=2 OTHER
// civilizations know (Civ1 catch-up — prereq-free, one per turn). '' if none.
function libraryCatchUpTech(state, pid, ruleset) {
  const player = state.players[pid];
  for (const tid of sortIds(Object.keys(ruleset.techs))) {
    if (knows(player, tid)) continue;
    let others = 0;
    for (const oid of state.playerOrder) {
      if (oid === pid) continue;
      if (knows(state.players[oid], tid)) others = others + 1;
    }
    if (others >= 2) return tid;
  }
  return '';
}

// #29 darwin grant: the lowest-LEVEL researchable tech a player lacks (prereqs met,
// sorted-id tie-break). '' if none.
function lowestAvailableTech(state, pid, ruleset) {
  const player = state.players[pid];
  let best = '';
  for (const tid of sortIds(Object.keys(ruleset.techs))) {
    if (knows(player, tid) || !prereqsMet(player, tid, ruleset)) continue;
    if (best === '' || ruleset.techs[tid].level < ruleset.techs[best].level) best = tid;
  }
  return best;
}

// #29 wonder tech grants (after research resolves): darwin's one-shot on THIS turn's
// wonderBuilt event, then great-library's per-turn catch-up. Both go through grantTech
// so obsolete-building sales + Leonardo upgrades + the techDiscovered event fire.
function processWonderTechs(state, ruleset, events) {
  for (const ev of events) {
    if (ev.type !== 'wonderBuilt') continue;
    const n = ruleset.wonders[ev.wonder].effect.freeTechsOnBuild;
    if (n === undefined || n <= 0) continue;
    const city = state.cities[ev.cityId];
    if (!city) continue;
    for (let k = 0; k < n; k++) {
      const tid = lowestAvailableTech(state, city.owner, ruleset);
      if (tid === '') break;
      grantTech(state, city.owner, tid, ruleset, events);
    }
  }
  for (const wid of sortIds(Object.keys(state.wonders === undefined ? {} : state.wonders))) {
    if (ruleset.wonders[wid].effect.libraryCatchUp !== true) continue;
    if (!wonderActive(state, wid, ruleset)) continue;
    const home = state.cities[state.wonders[wid]];
    if (!home) continue;
    const tid = libraryCatchUpTech(state, home.owner, ruleset);
    if (tid !== '') grantTech(state, home.owner, tid, ruleset, events);
  }
}

export { researchCost, availableTechs, setResearch, setRates, processResearch, playerIncome, cityEconOutput, prereqsMet, grantTech, processWonderTechs, FUTURE_TECH_ID };
