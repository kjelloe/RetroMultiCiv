// Civilization score and game-end detection.
// Victory: conquest (last civilization standing) or highest score at the end
// year. Only players created with `alive: true` (i.e. real game participants
// from createGame) can be eliminated — hand-crafted test states without the
// flag are exempt, which also keeps their scenario hashes stable.
// A73: the score by COMPONENT (population / techs / wonders) so the end screen
// and the historian's report render the real arithmetic, never a parallel one.
// score() is the total; the sum + order are unchanged, so state.winner and the
// goldens are byte-identical (hash-neutral refactor).
import { pruneDiplomacy } from './diplomacy.js';

function scoreBreakdown(state, playerId, ruleset) {
  const player = state.players[playerId];
  let citizens = 0;
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (city && city.owner === playerId) citizens += city.pop;
  }
  let wonders = 0;
  if (state.wonders !== undefined) {
    for (const wid of Object.keys(state.wonders)) {
      const home = state.cities[state.wonders[wid]];
      if (home && home.owner === playerId) wonders++;
    }
  }
  const rules = ruleset.rules;
  const population = citizens * rules.scorePerCitizen;
  const techs = player.techs.length * rules.scorePerTech;
  // XII.2: each Future Tech level scores like a normal advance (house value,
  // defaulted to scorePerTech). futureTech is 0 until the tree is exhausted, so
  // this term is 0 for every non-marathon game (byte-identical breakdown).
  const futureTechScore = (player.futureTech === undefined ? 0 : player.futureTech) * rules.scorePerFutureTech;
  const wonderScore = wonders * rules.scorePerWonder;
  return { population, techs, futureTech: futureTechScore, wonders: wonderScore, total: population + techs + futureTechScore + wonderScore };
}

function score(state, playerId, ruleset) {
  return scoreBreakdown(state, playerId, ruleset).total;
}

function hasAssets(state, playerId) {
  for (const uid of Object.keys(state.units)) {
    if (state.units[uid].owner === playerId) return true;
  }
  for (const cid of state.cityOrder || []) {
    const city = state.cities[cid];
    if (city && city.owner === playerId) return true;
  }
  return false;
}

// Runs once per game turn (turn wrap), after cities/research/barbarians.
function checkGameEnd(state, ruleset, events) {
  if (state.gameOver) return;

  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player.alive !== true) continue; // never participated or already out
    if (!hasAssets(state, pid)) {
      player.alive = false;
      pruneDiplomacy(state, pid); // D1: drop treaties/offers touching the dead civ (omit-safe: no-op when relations is empty, so the soak is unmoved)
      events.push({ type: 'playerDefeated', playerId: pid });
    }
  }

  const contenders = [];
  for (const pid of state.playerOrder) {
    if (state.players[pid].alive === true) contenders.push(pid);
  }
  const participating = contenders.length
    + state.playerOrder.filter(pid => state.players[pid].alive === false).length;
  if (participating < 2) return; // crafted states without alive flags: no game end

  if (contenders.length === 1) {
    state.gameOver = true;
    state.winner = contenders[0];
    events.push({ type: 'gameOver', winner: state.winner, victory: 'conquest' });
    return;
  }

  if (state.year >= ruleset.rules.endYear && contenders.length > 0) {
    let best = contenders[0];
    for (const pid of contenders) {
      if (score(state, pid, ruleset) > score(state, best, ruleset)) best = pid;
    }
    state.gameOver = true;
    state.winner = best;
    events.push({ type: 'gameOver', winner: best, victory: 'score' });
  }
}

export { score, scoreBreakdown, checkGameEnd, hasAssets };
