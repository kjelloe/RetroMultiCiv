// Collapsible turn log: what happened each turn — growth, completions,
// research, first contact with rivals, and every battle, capture, and
// elimination that touches the player (including AI/barbarian turns).
// The first combat flashes a center-screen pointer to the log.
import { filterView } from '../../engine/visibility.js';

export function initTurnLog(ctx) {
  const { session, hud, HUMAN } = ctx;
  const { units, buildings, wonders, techs } = session.ruleset;
  const details = document.getElementById('turn-log');
  const summary = details.querySelector('summary');
  const list = document.getElementById('turn-list');
  const flashMessage = hud.flash; // center-screen transient banner
  let count = 0;
  let firstCombatShown = false;

  // tech id -> unit/building/wonder names it unlocks (for discovery entries)
  const techUnlocks = {};
  for (const set of [units, buildings, wonders]) {
    for (const id of Object.keys(set)) {
      if (set[id].tech === '') continue;
      (techUnlocks[set[id].tech] = techUnlocks[set[id].tech] || []).push(set[id].name);
    }
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
    summary.textContent = `📜 Turn log (${count})`;
  }

  // first contact: any rival whose unit or city enters the player's view
  const met = {};
  function scanContacts(state, announce) {
    const view = filterView(state, HUMAN);
    const seen = {};
    for (const u of Object.values(view.units || {})) seen[u.owner] = true;
    for (const c of Object.values(view.cities || {})) seen[c.owner] = true;
    for (const pid of Object.keys(seen).sort()) {
      if (pid === HUMAN || met[pid]) continue;
      met[pid] = true;
      if (!announce) continue;
      const name = playerName(state, pid);
      add(`👁 first contact: ${name} sighted`, 'loss');
      flashMessage(pid === 'barb'
        ? '🏴 Barbarians sighted!'
        : `👁 You have made contact with the ${name}!`);
    }
  }
  scanContacts(session.state, false); // whoever is visible at start is already known

  function ownCity(state, cityId) {
    return state.cities[cityId] && state.cities[cityId].owner === HUMAN;
  }

  session.onChange((state, events) => {
    if (events.length === 0) {
      // wholesale state replacement (load): re-baseline contacts silently
      for (const k of Object.keys(met)) delete met[k];
      scanContacts(state, false);
      return;
    }
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
            ? '⚔ First combat — victory! Details in the Turn log (bottom left)'
            : '⚔ First combat — a unit was lost. Details in the Turn log (bottom left)');
        }
      } else if (e.type === 'cityCaptured' && (e.from === HUMAN || e.to === HUMAN)) {
        const name = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        add(`🏰 ${name} captured by ${playerName(state, e.to)} (+${e.plunder} gold plundered)`,
          e.to === HUMAN ? 'win' : 'loss');
      } else if (e.type === 'playerDefeated') {
        add(`💀 ${playerName(state, e.playerId)} eliminated`, e.playerId === HUMAN ? 'loss' : 'win');
      } else if (e.type === 'barbariansSpawned') {
        add('🏴 barbarian uprising reported somewhere in the wilds');
      } else if (e.type === 'cityFounded' && ownCity(state, e.cityId)) {
        add(`🏛 ${state.cities[e.cityId].name} founded`, 'win');
      } else if (e.type === 'cityGrew' && ownCity(state, e.cityId)) {
        add(`🌾 ${state.cities[e.cityId].name} grows to population ${e.pop}`, 'win');
      } else if (e.type === 'cityStarved' && ownCity(state, e.cityId)) {
        add(`🍂 famine in ${state.cities[e.cityId].name} — population ${e.pop}`, 'loss');
      } else if (e.type === 'unitBuilt' && ownCity(state, e.cityId)) {
        add(`⚒ ${state.cities[e.cityId].name} completed ${units[e.unitType].name}`);
      } else if (e.type === 'buildingBuilt' && ownCity(state, e.cityId)) {
        add(`🏠 ${state.cities[e.cityId].name} completed ${buildings[e.building].name}`);
      } else if (e.type === 'wonderBuilt') {
        // wonders are world news (Civ 1 announces them to everyone)
        const mine = ownCity(state, e.cityId);
        const where = mine
          ? state.cities[e.cityId].name
          : `a ${playerName(state, state.cities[e.cityId].owner)} city`;
        add(`🏆 ${wonders[e.wonder].name} completed in ${where}`, mine ? 'win' : 'loss');
        if (mine) flashMessage(`🏆 ${state.cities[e.cityId].name} completes the ${wonders[e.wonder].name}!`);
      } else if (e.type === 'wonderLost' && ownCity(state, e.cityId)) {
        add(`🏆 ${state.cities[e.cityId].name} lost the race for ${wonders[e.wonder].name} (shields kept)`, 'loss');
      } else if (e.type === 'improvementBuilt' && e.owner === HUMAN) {
        const label = e.work === 'irrigate' ? 'irrigation' : e.work;
        add(`🛠 ${label} completed at (${e.x},${e.y})`, 'win');
      } else if (e.type === 'techDiscovered' && e.playerId === HUMAN) {
        const unlocks = techUnlocks[e.tech] || [];
        add(`🔬 ${techs[e.tech].name} discovered`
          + (unlocks.length ? ` — unlocks ${unlocks.join(', ')}` : ''), 'win');
      }
    }
    scanContacts(state, true);
  });
}
