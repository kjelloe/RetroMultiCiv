// Collapsible turn log: what happened each turn — growth, completions,
// research, first contact with rivals, and every battle, capture, and
// elimination that touches the player (including AI/barbarian turns).
// The first combat flashes a center-screen pointer to the log.
import { filterView } from '../../engine/visibility.js';
import { availableTechs } from '../../engine/tech.js';

export function initTurnLog(ctx) {
  const { session, hud } = ctx;
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

  // loc {x, y}: entries about a place get a ⌖ that flies the camera there
  function add(text, cls, loc) {
    count++;
    const div = document.createElement('div');
    div.textContent = `T${session.state.turn} · ${text}`;
    if (cls) div.className = cls;
    if (loc) {
      const jump = document.createElement('button');
      jump.className = 'log-jump';
      jump.textContent = '⌖';
      jump.title = `go to (${loc.x},${loc.y})`;
      jump.addEventListener('click', e => {
        e.stopPropagation();
        ctx.renderer.centerOn(loc.x, loc.y);
      });
      div.appendChild(jump);
    }
    list.prepend(div);
    while (list.children.length > 60) list.removeChild(list.lastChild);
    summary.textContent = `📜 Turn log (${count})`;
  }

  function cityLoc(state, cityId) {
    const c = state.cities[cityId];
    return c ? { x: c.x, y: c.y } : null;
  }

  // first contact: any rival whose unit or city enters the player's view
  let met = {};
  function scanContacts(state, announce) {
    const view = filterView(state, ctx.HUMAN);
    const seen = {};
    for (const u of Object.values(view.units || {})) seen[u.owner] = true;
    for (const c of Object.values(view.cities || {})) seen[c.owner] = true;
    for (const pid of Object.keys(seen).sort()) {
      if (pid === ctx.HUMAN || met[pid]) continue;
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
    return state.cities[cityId] && state.cities[cityId].owner === ctx.HUMAN;
  }

  // hotseat hand-off: the log belongs to the viewpoint — the incoming player
  // starts with a clean sheet and their own contact baseline
  function resetViewer() {
    met = {};
    list.textContent = '';
    count = 0;
    summary.textContent = '📜 Turn log';
    scanContacts(session.state, false);
  }

  session.onChange((state, events) => {
    if (events.length === 0) {
      // wholesale state replacement (load): re-baseline contacts silently
      met = {};
      scanContacts(state, false);
      return;
    }
    for (const e of events) {
      if (e.type === 'combatResolved') {
        const involvesMe = e.attackerOwner === ctx.HUMAN || e.defenderOwner === ctx.HUMAN;
        if (!involvesMe) continue;
        const att = `${playerName(state, e.attackerOwner)} ${units[e.attackerType].name}`;
        const def = `${playerName(state, e.defenderOwner)} ${units[e.defenderType].name}`;
        let text, cls;
        if (e.winner === 'attacker') {
          text = `⚔ ${att} defeated ${def} at (${e.x},${e.y})`
            + (e.unitsLost > 1 ? ` — whole stack lost (${e.unitsLost})` : '');
          cls = e.attackerOwner === ctx.HUMAN ? 'win' : 'loss';
        } else {
          text = `🛡 ${def} repelled ${att} at (${e.x},${e.y})`;
          cls = e.defenderOwner === ctx.HUMAN ? 'win' : 'loss';
        }
        add(text, cls, { x: e.x, y: e.y });
        if (!firstCombatShown) {
          firstCombatShown = true;
          details.open = true;
          flashMessage(cls === 'win'
            ? '⚔ First combat — victory! Details in the Turn log (bottom left)'
            : '⚔ First combat — a unit was lost. Details in the Turn log (bottom left)');
        }
      } else if (e.type === 'cityCaptured' && (e.from === ctx.HUMAN || e.to === ctx.HUMAN)) {
        const name = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        add(`🏰 ${name} captured by ${playerName(state, e.to)} (+${e.plunder} gold plundered)`,
          e.to === ctx.HUMAN ? 'win' : 'loss', cityLoc(state, e.cityId));
      } else if (e.type === 'playerDefeated') {
        add(`💀 ${playerName(state, e.playerId)} eliminated`, e.playerId === ctx.HUMAN ? 'loss' : 'win');
      } else if (e.type === 'barbariansSpawned') {
        add('🏴 barbarian uprising reported somewhere in the wilds');
      } else if (e.type === 'cityFounded' && ownCity(state, e.cityId)) {
        add(`🏛 ${state.cities[e.cityId].name} founded`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'cityGrew' && ownCity(state, e.cityId)) {
        add(`🌾 ${state.cities[e.cityId].name} grows to population ${e.pop}`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'cityStarved' && ownCity(state, e.cityId)) {
        add(`🍂 famine in ${state.cities[e.cityId].name} — population ${e.pop}`, 'loss', cityLoc(state, e.cityId));
      } else if (e.type === 'unitBuilt' && ownCity(state, e.cityId)) {
        add(`⚒ ${state.cities[e.cityId].name} completed ${units[e.unitType].name}`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'buildingBuilt' && ownCity(state, e.cityId)) {
        add(`🏠 ${state.cities[e.cityId].name} completed ${buildings[e.building].name}`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'wonderBuilt') {
        // wonders are world news (Civ 1 announces them to everyone)
        const mine = ownCity(state, e.cityId);
        const where = mine
          ? state.cities[e.cityId].name
          : `a ${playerName(state, state.cities[e.cityId].owner)} city`;
        add(`🏆 ${wonders[e.wonder].name} completed in ${where}`, mine ? 'win' : 'loss', mine ? cityLoc(state, e.cityId) : null);
        if (mine) flashMessage(`🏆 ${state.cities[e.cityId].name} completes the ${wonders[e.wonder].name}!`);
      } else if (e.type === 'wonderLost' && ownCity(state, e.cityId)) {
        add(`🏆 ${state.cities[e.cityId].name} lost the race for ${wonders[e.wonder].name} (shields kept)`, 'loss');
      } else if (e.type === 'improvementBuilt' && e.owner === ctx.HUMAN) {
        const label = e.transformedTo !== undefined
          ? `terrain worked into ${e.transformedTo}`
          : (e.work === 'irrigate' ? 'irrigation' : e.work) + ' completed';
        add(`🛠 ${label} at (${e.x},${e.y})`, 'win', { x: e.x, y: e.y });
      } else if (e.type === 'cityDisorder' && ownCity(state, e.cityId)) {
        add(`😠 civil disorder in ${state.cities[e.cityId].name}!`, 'loss', cityLoc(state, e.cityId));
        flashMessage(`😠 Civil disorder in ${state.cities[e.cityId].name} — appease your citizens (luxuries, temples, entertainers)`);
      } else if (e.type === 'cityOrderRestored' && ownCity(state, e.cityId)) {
        add(`😊 order restored in ${state.cities[e.cityId].name}`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'revolutionStarted' && e.playerId === ctx.HUMAN) {
        add(`⚡ revolution! anarchy until ${session.ruleset.governments[e.government].name} takes hold`);
      } else if (e.type === 'governmentChanged' && e.playerId === ctx.HUMAN) {
        add(`🏛 new government: ${session.ruleset.governments[e.government].name}`, 'win');
        flashMessage(`🏛 The ${session.ruleset.governments[e.government].name} is established!`);
      } else if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) {
        const unlocks = techUnlocks[e.tech] || [];
        add(`🔬 ${techs[e.tech].name} discovered`
          + (unlocks.length ? ` — unlocks ${unlocks.join(', ')}` : ''), 'win');
        if (availableTechs(state, ctx.HUMAN, session.ruleset).length > 0) {
          flashMessage(`🔬 ${techs[e.tech].name} discovered! Choose new research — press T or click the research bar`);
        }
      }
    }
    scanContacts(state, true);
  });

  return { resetViewer };
}
