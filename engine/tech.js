// Research: trade arrows from worked city tiles split into gold (tax) and
// science bulbs (sci) by per-player rates; bulbs buy advances whose cost
// escalates with the number of techs already known (Civ 1 global escalation,
// not per-tech prices). Luxuries, corruption and government caps come later.
import { cityYields, effectPct, sellBuildingFrom } from './cities.js';
import { governmentOf, corruptionFor } from './government.js';
import { routeArrows } from './trade.js';
import { leonardoUpgrade } from './upgrade.js';
import { difficultyOf, hasHumanSeat } from './difficulty.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

function researchCost(state, playerId, ruleset) {
  const player = state.players[playerId];
  const known = player.techs.length;
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
  return out;
}

function setResearch(state, cmd, ruleset) {
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  // A54 off-turn pre-work: self-scoped (touches only the issuing player's
  // state, zero rng) — legal while a rival moves; no turn check
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
function cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset) {
  if (city.disorder === true) return { gold: 0, bulbs: 0 };
  let trade = cityYields(state, city, ruleset).trade;
  trade = trade - corruptionFor(state, city, trade, ruleset);
  // A89: the live permanent trade-route bonus adds ON TOP, post-corruption
  // (R1: base arrows exclude routes; route trade is corruption-free). No-op
  // (0) for a city without routes — the AI fields no caravans, so the sim
  // goldens are untouched. Lux stays on raw tile trade (existing deviation).
  trade = trade + routeArrows(state, city, ruleset);
  const cityTax = idiv(trade * taxRate, 100);
  const citySci = idiv(trade * sciRate, 100);
  let gold = cityTax + idiv(cityTax * effectPct(city, ruleset, 'taxBonus'), 100);
  let bulbs = citySci + idiv(citySci * effectPct(city, ruleset, 'sciBonus'), 100);
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
  let gold = 0, bulbs = 0, maintenance = 0;
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    if (city.buildings !== undefined) {
      for (const b of city.buildings) maintenance += ruleset.buildings[b].maintenance;
    }
    if (city.disorder === true) continue; // civil disorder: no taxes, no research
    if (anarchy) continue; // anarchy: the state collects nothing
    const eco = cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset);
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
        player.researching = '';
        grantTech(state, pid, got, ruleset, events);
      }
    }
  }
}

export { researchCost, availableTechs, setResearch, setRates, processResearch, playerIncome, cityEconOutput, prereqsMet, grantTech };
