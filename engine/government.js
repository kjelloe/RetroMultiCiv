// Governments (docs/04 §2): each government (data/governments.json) sets
// rate caps, unit upkeep, the despotism tile penalty, corruption, martial
// law, and war unhappiness. Switching means a revolution: some turns of
// Anarchy, then the new government takes over (the Pyramids skip the
// anarchy, Civ 1). Players without a `government` field are Despotism —
// keeps every pre-governments state valid and hash-stable.

function governmentOf(state, playerId, ruleset) {
  // an unknown player (e.g. a pseudo-city probe without an owner) is treated
  // as despotism — the default everyone starts under
  const player = state.players[playerId];
  const id = !player || player.government === undefined ? 'despotism' : player.government;
  return ruleset.governments[id];
}

// The capital: the city holding a Palace, else the player's oldest city.
function capitalOf(state, playerId, ruleset) {
  let first = null;
  for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
    const city = state.cities[cid];
    if (!city || city.owner !== playerId) continue;
    if (first === null) first = city;
    for (const b of city.buildings === undefined ? [] : city.buildings) {
      if (ruleset.buildings[b].effect.isPalace === true) return city;
    }
  }
  return first;
}

// Trade lost to corruption for one city (0 at the capital; Courthouse helps).
function corruptionFor(state, city, trade, ruleset) {
  const gov = governmentOf(state, city.owner, ruleset);
  if (gov.corruptionFactor === 0) return 0;
  const capital = capitalOf(state, city.owner, ruleset);
  if (!capital || capital.id === city.id) return 0;
  let dist;
  if (gov.fixedCorruptionDist !== undefined) {
    dist = gov.fixedCorruptionDist;
  } else {
    let dx = capital.x - city.x;
    if (dx < 0) dx = -dx;
    if (state.map.wrapX && state.map.width - dx < dx) dx = state.map.width - dx;
    let dy = capital.y - city.y;
    if (dy < 0) dy = -dy;
    dist = dx > dy ? dx : dy;
  }
  let corruption = Math.floor((trade * dist * gov.corruptionFactor) / 200);
  if (corruption > trade) corruption = trade;
  // Courthouse (corruptionReduction percent)
  for (const b of city.buildings === undefined ? [] : city.buildings) {
    const cut = ruleset.buildings[b].effect.corruptionReduction;
    if (cut !== undefined) corruption = corruption - Math.floor((corruption * cut) / 100);
  }
  return corruption;
}

// Clamp a player's rates to the government's cap; overflow goes to tax
// first, then luxuries (caps are >= 60, so a fit always exists).
function clampRates(player, gov, rules) {
  let tax = player.taxRate === undefined ? rules.defaultTaxRate : player.taxRate;
  let sci = player.sciRate === undefined ? rules.defaultSciRate : player.sciRate;
  let lux = player.luxRate === undefined ? 0 : player.luxRate;
  if (sci > gov.maxRate) sci = gov.maxRate;
  if (tax > gov.maxRate) tax = gov.maxRate;
  if (lux > gov.maxRate) lux = gov.maxRate;
  let rest = 100 - tax - sci - lux;
  const taxRoom = gov.maxRate - tax;
  const taxAdd = rest < taxRoom ? rest : taxRoom;
  tax = tax + taxAdd;
  rest = rest - taxAdd;
  lux = lux + rest;
  player.taxRate = tax;
  player.sciRate = sci;
  if (lux > 0) player.luxRate = lux; else delete player.luxRate;
}

// Command: start a revolution toward a known government.
function setGovernment(state, cmd, ruleset) {
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const gov = ruleset.governments[cmd.government];
  if (!gov || cmd.government === 'anarchy') return { ok: false, reason: 'badGovernment' };
  if (gov.tech !== '' && player.techs.indexOf(gov.tech) === -1) {
    return { ok: false, reason: 'techRequired' };
  }
  const current = player.government === undefined ? 'despotism' : player.government;
  if (current === cmd.government) return { ok: false, reason: 'alreadyGovernment' };
  if (player.revolutionTurns !== undefined) return { ok: false, reason: 'inRevolution' };

  // the Pyramids: switch instantly, no anarchy (Civ 1)
  let instant = false;
  if (state.wonders !== undefined && state.wonders['pyramids'] !== undefined) {
    const home = state.cities[state.wonders['pyramids']];
    const obsoleteBy = ruleset.wonders['pyramids'].obsoleteBy;
    let active = true;
    if (obsoleteBy !== '') {
      for (const pid of state.playerOrder) {
        if (state.players[pid].techs.indexOf(obsoleteBy) !== -1) active = false;
      }
    }
    if (active && home && home.owner === cmd.playerId) instant = true;
  }
  if (instant) {
    player.government = cmd.government;
    clampRates(player, gov, ruleset.rules);
    return { ok: true, events: [{ type: 'governmentChanged', playerId: cmd.playerId, government: cmd.government }] };
  }
  player.government = 'anarchy';
  player.pendingGovernment = cmd.government;
  player.revolutionTurns = ruleset.rules.revolutionTurns;
  // anarchy caps rates too — a Monarchy running 70% science must drop to
  // the interregnum's 60 immediately (found organically by the sim net)
  clampRates(player, ruleset.governments.anarchy, ruleset.rules);
  return { ok: true, events: [{ type: 'revolutionStarted', playerId: cmd.playerId, government: cmd.government }] };
}

// Turn wrap: revolutions tick down; the new government arrives with clamped rates.
function processRevolutions(state, ruleset, events) {
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player.revolutionTurns === undefined) continue;
    player.revolutionTurns = player.revolutionTurns - 1;
    if (player.revolutionTurns > 0) continue;
    const next = player.pendingGovernment;
    player.government = next;
    delete player.pendingGovernment;
    delete player.revolutionTurns;
    clampRates(player, ruleset.governments[next], ruleset.rules);
    events.push({ type: 'governmentChanged', playerId: pid, government: next });
  }
}

export { governmentOf, capitalOf, corruptionFor, clampRates, setGovernment, processRevolutions };
