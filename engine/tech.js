// Research: trade arrows from worked city tiles split into gold (tax) and
// science bulbs (sci) by per-player rates; bulbs buy advances whose cost
// escalates with the number of techs already known (Civ 1 global escalation,
// not per-tech prices). Luxuries, corruption and government caps come later.
import { cityYields } from './cities.js';

function idiv(a, b) {
  return Math.floor(a / b);
}

function researchCost(state, playerId, ruleset) {
  const known = state.players[playerId].techs.length;
  return ruleset.rules.techBaseCost * (known + 1);
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
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  if (!ruleset.techs[cmd.tech]) return { ok: false, reason: 'unknownTech' };
  if (knows(player, cmd.tech)) return { ok: false, reason: 'alreadyKnown' };
  if (!prereqsMet(player, cmd.tech, ruleset)) return { ok: false, reason: 'prereqsMissing' };
  player.researching = cmd.tech;
  return { ok: true, events: [{ type: 'researchSet', playerId: cmd.playerId, tech: cmd.tech }] };
}

function setRates(state, cmd, _ruleset) {
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const { tax, sci } = cmd;
  const valid = Number.isInteger(tax) && Number.isInteger(sci)
    && tax >= 0 && sci >= 0 && tax + sci === 100
    && tax % 10 === 0 && sci % 10 === 0;
  if (!valid) return { ok: false, reason: 'badRates' }; // luxuries join the split later
  player.taxRate = tax;
  player.sciRate = sci;
  return { ok: true, events: [{ type: 'ratesSet', playerId: cmd.playerId, tax, sci }] };
}

// Runs once per game turn (turn wrap): collect trade, split, maybe discover.
function processResearch(state, ruleset, events) {
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player.taxRate === undefined) player.taxRate = ruleset.rules.defaultTaxRate;
    if (player.sciRate === undefined) player.sciRate = ruleset.rules.defaultSciRate;
    if (player.bulbs === undefined) player.bulbs = 0;

    let trade = 0;
    for (const cid of state.cityOrder || []) {
      const city = state.cities[cid];
      if (city && city.owner === pid) trade += cityYields(state, city, ruleset).trade;
    }
    player.gold = player.gold + idiv(trade * player.taxRate, 100);
    player.bulbs = player.bulbs + idiv(trade * player.sciRate, 100);

    if (player.researching !== '' && player.researching !== undefined) {
      const cost = researchCost(state, pid, ruleset);
      if (player.bulbs >= cost) {
        player.bulbs = player.bulbs - cost; // overflow carries into the next advance
        player.techs.push(player.researching);
        events.push({ type: 'techDiscovered', playerId: pid, tech: player.researching });
        player.researching = '';
      }
    }
  }
}

export { researchCost, availableTechs, setResearch, setRates, processResearch, prereqsMet };
