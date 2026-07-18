// N12 / A92 debug commands (agent-workitems.md A92). A god-mode command family
// (actions grantGold / spawnUnit / grantTech / revealMap) gated on
// state.debugEnabled (fixed at game creation). RECORDED like any command so
// replays stay hash-exact; the FIRST successful use sets state.debugUsed=true
// PERMANENTLY — the taint the game-code display + highscore honor (docs/07 trust
// loop). Both fields are OMIT-SAFE (absent in normal games), so the goldens are
// untouched. No turn check: debug is issuable anytime, against ANY target player.
// Lua-portable subset; all numbers/ids come from the command or the ruleset.
import { grantTech } from './tech.js';

// A single `debug` command carrying an `action`; one dispatch entry, one taint.
function debugCommand(state, cmd, ruleset) {
  if (state.debugEnabled !== true) return { ok: false, reason: 'debugDisabled' };
  const player = state.players[cmd.playerId];
  if (!player) return { ok: false, reason: 'unknownPlayer' };
  const action = cmd.action;
  const events = [];

  if (action === 'grantGold') {
    player.gold = player.gold + cmd.amount;
    if (player.gold < 0) player.gold = 0; // gold never goes negative (invariant)
  } else if (action === 'spawnUnit') {
    const def = ruleset.units[cmd.unitType];
    if (!def) return { ok: false, reason: 'badUnitType' };
    if (cmd.x < 0 || cmd.x >= state.map.width || cmd.y < 0 || cmd.y >= state.map.height) {
      return { ok: false, reason: 'outOfBounds' };
    }
    // even god-mode must not create a mixed-owner stack (the core invariant)
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.x === cmd.x && u.y === cmd.y && u.owner !== cmd.playerId) {
        return { ok: false, reason: 'occupiedByEnemy' };
      }
    }
    const unitId = 'u' + state.nextUnitId;
    state.nextUnitId = state.nextUnitId + 1;
    state.units[unitId] = {
      id: unitId, type: cmd.unitType, owner: cmd.playerId,
      x: cmd.x, y: cmd.y, moves: def.moves, fortified: false, veteran: false
    };
  } else if (action === 'grantTech') {
    if (!ruleset.techs[cmd.tech]) return { ok: false, reason: 'unknownTech' };
    if (player.techs.indexOf(cmd.tech) !== -1) return { ok: false, reason: 'alreadyKnown' };
    // reuse the N11 acquisition seam: fires obsolete-sell + Leonardo, and IS the
    // command path A4 goody huts will grant through
    grantTech(state, cmd.playerId, cmd.tech, ruleset, events);
  } else if (action === 'revealMap') {
    const size = state.map.width * state.map.height;
    const explored = [];
    for (let i = 0; i < size; i++) explored.push(1);
    player.explored = explored;
  } else {
    return { ok: false, reason: 'unknownDebugAction' };
  }

  state.debugUsed = true; // permanent taint
  events.push({ type: 'debugCommand', playerId: cmd.playerId, action });
  return { ok: true, events };
}

export { debugCommand };
