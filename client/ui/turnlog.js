// Collapsible turn log: what happened each turn — growth, completions,
// research, first contact with rivals, and every battle, capture, and
// elimination that touches the player (including AI/barbarian turns).
// The first combat flashes a center-screen pointer to the log.
import { filterView, filterEvents } from '../../engine/visibility.js';
import { availableTechs } from '../../engine/tech.js';
import { classifyEvent, LOG_CLASSES } from './turnlog-classes.js';
import { makeCatalogText } from './catalog-text.js';
import { PART_LABELS } from './ship.js'; // A76: the ship-event lines share the screen's names

export function initTurnLog(ctx) {
  const { session, hud } = ctx;
  const { units, buildings, wonders, techs } = session.ruleset;
  const details = document.getElementById('turn-log');
  const summary = details.querySelector('summary');
  const list = document.getElementById('turn-list');
  const flashMessage = hud.flash; // center-screen transient banner
  let count = 0;
  let firstCombatShown = false;

  // A39: per-player display filters — a funnel row ON the log panel (the
  // noise is noticed here, not in ⚙ Options), persisted with the other
  // prefs. Filtering is DISPLAY-time via container classes over the
  // retained entries: toggling a class back on reveals suppressed history
  // (within the 60-entry cap). 🌍 world news has no checkbox by design.
  const filters = Object.assign(
    { combat: true, cities: true, research: true, rival: true, saves: true, regent: true },
    (ctx.options && ctx.options.get('logFilters')) || {});
  function applyFilters() {
    for (const c of LOG_CLASSES) list.classList.toggle('hide-' + c.id, filters[c.id] === false);
  }
  const filterRow = document.createElement('div');
  filterRow.id = 'log-filters';
  const filterBtn = document.createElement('button');
  filterBtn.id = 'log-filter-toggle';
  filterBtn.textContent = '⚙ filters';
  filterBtn.title = 'choose which entries this log shows';
  const filterBoxes = document.createElement('span');
  filterBoxes.id = 'log-filter-boxes';
  filterBoxes.className = 'hidden';
  for (const c of LOG_CLASSES) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = filters[c.id] !== false;
    box.addEventListener('change', () => {
      filters[c.id] = box.checked;
      if (ctx.options) ctx.options.set('logFilters', filters);
      applyFilters();
    });
    label.appendChild(box);
    label.appendChild(document.createTextNode(' ' + c.label));
    filterBoxes.appendChild(label);
  }
  const worldNote = document.createElement('span');
  worldNote.id = 'log-filter-world';
  worldNote.textContent = '🌍 world news always shows';
  filterBoxes.appendChild(worldNote);
  filterBtn.addEventListener('click', () => filterBoxes.classList.toggle('hidden'));
  filterRow.appendChild(filterBtn);
  filterRow.appendChild(filterBoxes);
  details.insertBefore(filterRow, list);
  applyFilters();

  // tech id -> unit/building/wonder names it unlocks (for discovery entries).
  // A58b: shared catalog-text map; wonderMark '' = plain wonder names (the log's
  // only difference from the panels build — verified byte-identical otherwise).
  const { techUnlocks } = makeCatalogText(session.ruleset, { wonderMark: '' });

  function playerName(state, pid) {
    return state.players[pid] ? state.players[pid].name : pid;
  }

  // loc {x, y}: entries about a place get a ⌖ that flies the camera there;
  // klass (A39): the filter class this entry belongs to (lg-<class>)
  function add(text, cls, loc, klass) {
    count++;
    const div = document.createElement('div');
    div.textContent = `T${session.state.turn} · ${text}`;
    div.className = [cls, klass ? 'lg-' + klass : ''].filter(Boolean).join(' ');
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
      add(`👁 first contact: ${name} sighted`, 'loss', null, 'rival');
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
    // A30: loads announce themselves with the synthetic stateReplaced event
    // — a plain empty notify is now just a repaint (the chunked AI round
    // emits those between players) and must NOT wipe the contact baseline
    if (events.some(e => e.type === 'stateReplaced')) {
      met = {};
      scanContacts(state, false);
      return;
    }
    // A39: the log narrates only what this viewpoint could SEE — the same
    // engine filter the server applies per seat (B5); in local games the
    // session's round events are omniscient, so this is the fog gate
    const seen = filterEvents(state, events, ctx.HUMAN);
    for (const e of seen) {
      // filter class (A39): tags the entry for the display-time filter row
      const klass = classifyEvent(e, ctx.HUMAN,
        cid => state.cities[cid] ? state.cities[cid].owner : null);
      const put = (text, cls, loc) => add(text, cls, loc, klass);
      if (e.type === 'saveCode') {
        // A33: the autosave broadcast's code, one line per changed code
        put(`💾 saved · code ${e.code}`);
      } else if (e.type === 'regentTurn' && e.playerId === ctx.HUMAN) {
        // B11: the regent's per-turn audit line — the seat owner can WATCH
        // what the AI did with their empire (the item's visibility ask)
        const bits = [];
        const n = t => e.byType[t] === undefined ? 0 : e.byType[t];
        if (n('moveUnit') > 0) bits.push(`${n('moveUnit')} move${n('moveUnit') === 1 ? '' : 's'}`);
        if (n('fortify') > 0) bits.push(`${n('fortify')} fortified`);
        if (n('startWork') > 0) bits.push(`${n('startWork')} work${n('startWork') === 1 ? '' : 's'} started`);
        if (e.research !== '') bits.push(`research → ${techs[e.research].name}`);
        for (const id of e.production) {
          const def = units[id] || buildings[id] || wonders[id];
          bits.push(`production → ${def ? def.name : id}`);
        }
        if (n('setWorkers') > 0) bits.push('citizens reassigned');
        if (n('foundCity') > 0) bits.push(`${n('foundCity')} cit${n('foundCity') === 1 ? 'y' : 'ies'} founded`);
        put(`🤖 regent played your turn${bits.length ? ': ' + bits.join(' · ') : ' (nothing to do)'}`);
      } else if (e.type === 'combatResolved') {
        const att = `${playerName(state, e.attackerOwner)} ${units[e.attackerType].name}`;
        const def = `${playerName(state, e.defenderOwner)} ${units[e.defenderType].name}`;
        const involvesMe = e.attackerOwner === ctx.HUMAN || e.defenderOwner === ctx.HUMAN;
        if (!involvesMe) {
          // A39: the B5 live narration — rival battles inside my view
          put(`👀 ${e.winner === 'attacker' ? `${att} defeated ${def}` : `${def} repelled ${att}`}`
            + ` at (${e.x},${e.y})`, '', { x: e.x, y: e.y });
          continue;
        }
        let text, cls;
        if (e.winner === 'attacker') {
          text = `⚔ ${att} defeated ${def} at (${e.x},${e.y})`
            + (e.unitsLost > 1 ? ` — whole stack lost (${e.unitsLost})` : '');
          cls = e.attackerOwner === ctx.HUMAN ? 'win' : 'loss';
        } else {
          text = `🛡 ${def} repelled ${att} at (${e.x},${e.y})`;
          cls = e.defenderOwner === ctx.HUMAN ? 'win' : 'loss';
        }
        put(text, cls, { x: e.x, y: e.y });
        if (!firstCombatShown) {
          firstCombatShown = true;
          details.open = true;
          flashMessage(cls === 'win'
            ? '⚔ First combat — victory! Details in the Turn log (bottom left)'
            : '⚔ First combat — a unit was lost. Details in the Turn log (bottom left)');
        }
      } else if (e.type === 'unitLoaded' && e.owner === ctx.HUMAN) {
        const u = state.units[e.unitId];
        put(`⚓ ${u ? units[u.type].name : 'a unit'} boarded a transport at (${e.x},${e.y})`, '', { x: e.x, y: e.y });
      } else if (e.type === 'unitUnloaded' && e.owner === ctx.HUMAN) {
        const u = state.units[e.unitId];
        put(`🏖 ${u ? units[u.type].name : 'a unit'} landed at (${e.x},${e.y})`, '', { x: e.x, y: e.y });
      } else if (e.type === 'cargoLost' && e.owner === ctx.HUMAN) {
        put(`🌊 a unit went down with its transport at (${e.x},${e.y})`, 'loss', { x: e.x, y: e.y });
      } else if (e.type === 'airCrashed' && e.owner === ctx.HUMAN) {
        put(`✈💥 an air unit ran out of fuel and crashed at (${e.x},${e.y})`, 'loss', { x: e.x, y: e.y });
      } else if (e.type === 'unitConsumed' && e.owner === ctx.HUMAN) {
        put(`☢ your missile struck and was spent at (${e.x},${e.y})`, '', { x: e.x, y: e.y });
      } else if (e.type === 'cityCaptured') {
        const name = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        if (e.from === ctx.HUMAN || e.to === ctx.HUMAN) {
          put(`🏰 ${name} captured by ${playerName(state, e.to)} (+${e.plunder} gold plundered)`,
            e.to === ctx.HUMAN ? 'win' : 'loss', cityLoc(state, e.cityId));
        } else { // A39: a rival conquest inside my view
          put(`👀 ${playerName(state, e.to)} captured ${name}`, '', cityLoc(state, e.cityId));
        }
      } else if (e.type === 'playerDefeated') {
        put(`💀 ${playerName(state, e.playerId)} eliminated`, e.playerId === ctx.HUMAN ? 'loss' : 'win');
      } else if (e.type === 'barbariansSpawned') {
        put('🏴 barbarian uprising reported somewhere in the wilds');
      } else if (e.type === 'ageChanged') { // A75: world news (the interstitial is the loud form)
        const age = (session.ruleset.rules.ages || []).find(a => a.id === e.age);
        put(`🌍 the world enters the ${age ? age.name : e.age} Age`);
      } else if (e.type === 'cityFounded') {
        if (ownCity(state, e.cityId)) {
          put(`🏛 ${state.cities[e.cityId].name} founded`, 'win', cityLoc(state, e.cityId));
        } else if (state.cities[e.cityId]) { // A39: a rival city rises in view
          put(`👀 ${playerName(state, state.cities[e.cityId].owner)} founded ${state.cities[e.cityId].name}`,
            '', cityLoc(state, e.cityId));
        }
      } else if (e.type === 'cityGrew' && ownCity(state, e.cityId)) {
        put(`🌾 ${state.cities[e.cityId].name} grows to population ${e.pop}`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'cityStarved' && ownCity(state, e.cityId)) {
        put(`🍂 famine in ${state.cities[e.cityId].name} — population ${e.pop}`, 'loss', cityLoc(state, e.cityId));
      } else if (e.type === 'unitBuilt' && ownCity(state, e.cityId)) {
        put(`⚒ ${state.cities[e.cityId].name} completed ${units[e.unitType].name}`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'buildingBuilt' && ownCity(state, e.cityId)) {
        put(`🏠 ${state.cities[e.cityId].name} completed ${buildings[e.building].name}`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'buildingSold' && e.playerId === ctx.HUMAN) {
        // B13/A63: obsoleted building auto-sold; A86: a manual sell (no suffix)
        const cityName = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        const suffix = e.reason === 'obsolete' ? ', obsolete' : '';
        put(`💰 ${cityName} sold ${buildings[e.building].name} (+${e.gold}g${suffix})`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'wonderHelped' && e.playerId === ctx.HUMAN) {
        // A83: a caravan poured its shields into a wonder in progress
        const cityName = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        put(`🐫 ${cityName} — caravan helped build ${wonders[e.wonder].name} (+${e.shields}⚒)`, '', cityLoc(state, e.cityId));
      } else if (e.type === 'tradeRouteEstablished' && e.playerId === ctx.HUMAN) {
        // A89: own-seat windfall line — amounts + partner (shape CONFIRMED by
        // the N10 window, bugfixer #1417: { playerId, cityId, partnerCityId,
        // gold, bulbs }; the engine catches up in the trade.js seam bundle)
        const homeName = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        const partnerName = state.cities[e.partnerCityId] ? state.cities[e.partnerCityId].name : e.partnerCityId;
        const amounts = e.gold !== undefined ? ` (+${e.gold}💰 +${e.bulbs !== undefined ? e.bulbs : e.gold}🔬)` : '';
        put(`🐫 ${homeName} opens a trade route with ${partnerName}${amounts}`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'wonderBuilt') {
        // wonders are world news (Civ 1 announces them to everyone)
        const mine = ownCity(state, e.cityId);
        const where = mine
          ? state.cities[e.cityId].name
          : `a ${playerName(state, state.cities[e.cityId].owner)} city`;
        put(`🏆 ${wonders[e.wonder].name} completed in ${where}`, mine ? 'win' : 'loss', mine ? cityLoc(state, e.cityId) : null);
        if (mine) flashMessage(`🏆 ${state.cities[e.cityId].name} completes the ${wonders[e.wonder].name}!`);
      } else if (e.type === 'wonderLost' && ownCity(state, e.cityId)) {
        put(`🏆 ${state.cities[e.cityId].name} lost the race for ${wonders[e.wonder].name} (shields kept)`, 'loss');
      } else if (e.type === 'ssPartBuilt' && e.playerId === ctx.HUMAN) {
        // A76 presentation: name the part and the count toward its max
        const parts = session.ruleset.rules.ssParts;
        const max = parts && parts[e.part] ? parts[e.part].max : '?';
        const cityName = state.cities[e.cityId] ? state.cities[e.cityId].name : e.cityId;
        put(`🚀 ${cityName} completes spaceship ${PART_LABELS[e.part] || e.part} (${e.count}/${max})`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'shipLaunched') {
        // the race is public (world news, both seats' logs)
        const mine = e.playerId === ctx.HUMAN;
        put(`🚀 ${mine ? 'your spaceship is away' : `${playerName(state, e.playerId)} LAUNCHES a spaceship`}`
          + ` — arrival turn ${e.arrivalTurn} (${e.flightYears} years)`, mine ? 'win' : 'loss');
      } else if (e.type === 'shipDestroyed') {
        const mine = e.playerId === ctx.HUMAN;
        put(`☄ ${mine ? 'your' : `the ${playerName(state, e.playerId)}`} spaceship is destroyed with its capital`,
          mine ? 'loss' : 'win');
      } else if (e.type === 'spaceVictory') {
        const mine = e.playerId === ctx.HUMAN;
        put(`🌌 ${mine ? 'your colonists reach' : `${playerName(state, e.playerId)} reaches`} Alpha Centauri`
          + ` — ${e.population.toLocaleString('en-US')} colonists, ${e.successPct}% success`, mine ? 'win' : 'loss');
        if (mine) flashMessage('🌌 Planetfall — a new world is yours!');
      } else if (e.type === 'improvementBuilt' && e.owner === ctx.HUMAN) {
        const label = e.transformedTo !== undefined
          ? `terrain worked into ${e.transformedTo}`
          : (e.work === 'irrigate' ? 'irrigation' : e.work) + ' completed';
        put(`🛠 ${label} at (${e.x},${e.y})`, 'win', { x: e.x, y: e.y });
      } else if (e.type === 'cityDisorder' && ownCity(state, e.cityId)) {
        put(`😠 civil disorder in ${state.cities[e.cityId].name}!`, 'loss', cityLoc(state, e.cityId));
        flashMessage(`😠 Civil disorder in ${state.cities[e.cityId].name} — appease your citizens (luxuries, temples, entertainers)`);
      } else if (e.type === 'cityOrderRestored' && ownCity(state, e.cityId)) {
        put(`😊 order restored in ${state.cities[e.cityId].name}`, 'win', cityLoc(state, e.cityId));
      } else if (e.type === 'revolutionStarted' && e.playerId === ctx.HUMAN) {
        put(`⚡ revolution! anarchy until ${session.ruleset.governments[e.government].name} takes hold`);
      } else if (e.type === 'governmentChanged' && e.playerId === ctx.HUMAN) {
        put(`🏛 new government: ${session.ruleset.governments[e.government].name}`, 'win');
        flashMessage(`🏛 The ${session.ruleset.governments[e.government].name} is established!`);
      } else if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) {
        const unlocks = techUnlocks[e.tech] || [];
        put(`🔬 ${techs[e.tech].name} discovered`
          + (unlocks.length ? ` — unlocks ${unlocks.join(', ')}` : ''), 'win');
        // the discovery card carries the research prompt when it's enabled —
        // the flash only fires as the FALLBACK (no double-flash, per spec)
        if ((!ctx.discoveryCard || !ctx.discoveryCard.enabled())
            && availableTechs(state, ctx.HUMAN, session.ruleset).length > 0) {
          flashMessage(`🔬 ${techs[e.tech].name} discovered! Choose new research — press T or click the research bar`);
        }
      }
    }
    scanContacts(state, true);
  });

  // note: external one-off narration (A26 slow-poke etc.) — same list, same cap
  return { resetViewer, note: add };
}
