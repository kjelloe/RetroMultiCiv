// Collapsible combat log: every battle, capture, and elimination that touches
// the player, including what AI civs and barbarians did during their turns.
// The first combat also flashes a center-screen pointer to the log.
export function initCombatLog(ctx) {
  const { session, HUMAN } = ctx;
  const { units } = session.ruleset;
  const details = document.getElementById('combat-log');
  const summary = details.querySelector('summary');
  const list = document.getElementById('combat-list');
  const flash = document.getElementById('flash-banner');
  let count = 0;
  let firstCombatShown = false;

  function flashMessage(text) {
    flash.textContent = text;
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 5000);
  }

  function playerName(state, pid) {
    return state.players[pid] ? state.players[pid].name : pid;
  }

  function add(text, cls) {
    count++;
    const div = document.createElement('div');
    div.textContent = `T${session.state.turn} · ${text}`;
    if (cls) div.className = cls;
    list.prepend(div);
    while (list.children.length > 60) list.removeChild(list.lastChild);
    summary.textContent = `⚔ Combat log (${count})`;
  }

  session.onChange((state, events) => {
    for (const e of events) {
      if (e.type === 'combatResolved') {
        const involvesMe = e.attackerOwner === HUMAN || e.defenderOwner === HUMAN;
        if (!involvesMe) continue;
        const att = `${playerName(state, e.attackerOwner)} ${units[e.attackerType].name}`;
        const def = `${playerName(state, e.defenderOwner)} ${units[e.defenderType].name}`;
        let text, cls;
        if (e.winner === 'attacker') {
          text = `⚔ ${att} defeated ${def} at (${e.x},${e.y})`
            + (e.unitsLost > 1 ? ` — whole stack lost (${e.unitsLost})` : '');
          cls = e.attackerOwner === HUMAN ? 'win' : 'loss';
        } else {
          text = `🛡 ${def} repelled ${att} at (${e.x},${e.y})`;
          cls = e.defenderOwner === HUMAN ? 'win' : 'loss';
        }
        add(text, cls);
        if (!firstCombatShown) {
          firstCombatShown = true;
          details.open = true;
          flashMessage(cls === 'win'
            ? '⚔ First combat — victory! Details in the Combat log (bottom left)'
            : '⚔ First combat — a unit was lost. Details in the Combat log (bottom left)');
        }
      } else if (e.type === 'cityCaptured' && (e.from === HUMAN || e.to === HUMAN)) {
        const name = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        add(`🏰 ${name} captured by ${playerName(state, e.to)} (+${e.plunder} gold plundered)`,
          e.to === HUMAN ? 'win' : 'loss');
      } else if (e.type === 'playerDefeated') {
        add(`💀 ${playerName(state, e.playerId)} eliminated`, e.playerId === HUMAN ? 'loss' : 'win');
      } else if (e.type === 'barbariansSpawned') {
        add('🏴 barbarian uprising reported somewhere in the wilds');
      }
    }
  });
}
