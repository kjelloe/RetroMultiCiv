// N11 unit upgrades (specs/n11-upgrades.md). A unit standing in an owned city
// upgrades to its units.json `upgradesTo` successor for gold (window 3a, Civ3-
// shape; the formula lives in rules.upgrade). Leonardo's Workshop (window 3b,
// Civ2) reuses applyUpgrade with keepVeteran=false. Lua-portable subset; all
// numbers come from the ruleset.

// The city on tile (x, y), or null. Local scan (keeps upgrade.js dependency-free).
function cityAtTile(state, x, y) {
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.x === x && c.y === y) return c;
  }
  return null;
}

// Replace a unit with its upgradesTo successor IN PLACE, pinned ONCE here for
// both windows (reviewer R2). moves = min(remaining, new type's moves): upgrading
// must NOT refund spent movement (the pay-to-move exploit). There is NO
// persistent hp in this engine (the whole-unit combat model), so nothing else
// resets. veteran per keepVeteran — window 3a's PAID upgrade carries it (true);
// window 3b's free Leonardo upgrade drops it (false, Civ2). Returns the old type.
function applyUpgrade(state, unit, ruleset, keepVeteran) {
  const from = unit.type;
  const targetId = ruleset.units[from].upgradesTo;
  const newDef = ruleset.units[targetId];
  unit.type = targetId;
  if (unit.moves > newDef.moves) unit.moves = newDef.moves;
  if (keepVeteran !== true) unit.veteran = false;
  return from;
}

// The successor's cost premium in gold, or the rejection reason. Shared so the
// command and the client cost-preview agree.
function upgradeCost(unit, ruleset) {
  const def = ruleset.units[unit.type];
  const targetId = def.upgradesTo;
  if (targetId === undefined) return null;
  const newDef = ruleset.units[targetId];
  if (!newDef) return null;
  const diff = newDef.cost - def.cost;
  const up = ruleset.rules.upgrade;
  return up.baseGold + up.goldPerShield * (diff > 0 ? diff : 0);
}

// upgradeUnit { unitId } — window 3a, human-issued (AI never sends it, so the
// sim goldens move only by the rulesetHash of the new data, not behaviorally).
function upgradeUnit(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const city = cityAtTile(state, unit.x, unit.y);
  if (city === null || city.owner !== unit.owner) return { ok: false, reason: 'notInCity' };
  const def = ruleset.units[unit.type];
  const targetId = def.upgradesTo;
  if (targetId === undefined) return { ok: false, reason: 'noUpgrade' };
  const newDef = ruleset.units[targetId];
  if (!newDef) return { ok: false, reason: 'noUpgrade' };
  const player = state.players[cmd.playerId];
  if (newDef.tech !== '' && player.techs.indexOf(newDef.tech) === -1) return { ok: false, reason: 'noUpgrade' };
  const cost = upgradeCost(unit, ruleset);
  if (player.gold < cost) return { ok: false, reason: 'notEnoughGold' };
  player.gold = player.gold - cost;
  const from = applyUpgrade(state, unit, ruleset, true);
  return { ok: true, events: [{
    type: 'unitUpgraded', playerId: cmd.playerId, unitId: unit.id, from, to: unit.type, gold: cost
  }] };
}

export { upgradeUnit, applyUpgrade, upgradeCost, cityAtTile };
