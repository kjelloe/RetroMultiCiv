// A78: first-timer tutorial advice. Short, contextual ADVICE OFFERS surfaced
// the first time a player meets a system — a settler, a city view, civil
// disorder, a save code. Each offer shows ONCE (a per-id first-visit flag in
// localStorage, like the old splash flag), never blocks input, and never
// appears for returning players or the e2e/webdriver paths. Dismiss one with
// "OK, got it" or silence them all with "No thanks"; re-enable in ⚙. The prose
// is short + original (the A58 pedia carries the depth; advice links in once it
// lands). Client-only, localStorage-only — never game state.
import { adviceGate, SEEN_KEY } from './advice-gate.js';
import { filterView, filterEvents } from '../../engine/visibility.js';
import { availableTechs } from '../../engine/tech.js';

// id → { title, text }. Kept short — a nudge, not a manual.
// exported for the audit gate in test/advice.test.js (cards ↔ pedia links)
export const ADVICE = {
  'unit-selected': { title: 'Moving units', text: 'Click a unit to select it, then click an adjacent tile to move. The action bar along the bottom holds its orders — fortify, sentry, and GoTo for longer journeys.' },
  'settler': { title: 'Founding a city', text: 'Settlers build your empire. Move one onto good ground — grassland near water is ideal — and use the Found City action (B) to plant a city there.' },
  'city-view': { title: 'Running a city', text: 'Open a city to choose what it builds and where its citizens work. When it finishes, pick something new or it falls back to building militia.' },
  'combat-hover': { title: 'Picking your fights', text: 'Hovering a visible enemy shows the attack odds. A fight is never certain — terrain, fortification, and veteran units all tilt the result.' },
  'disorder': { title: 'Civil disorder', text: 'A city where unhappy citizens outnumber happy ones (😠) stops making shields and taxes. Raise the luxuries rate, turn citizens into entertainers, or build a Temple.' },
  'tech-choice': { title: 'Choosing research', text: 'When your beakers fill you pick the next advance. Techs unlock units, buildings, and wonders — beeline the ones your strategy needs, or broaden for score.' },
  'save-code': { title: 'Your game code', text: 'That code is this game\'s fingerprint. Anyone who loads the save should see the same code — it proves the game state was not tampered with.' },
  'regent': { title: 'The AI regent', text: 'You can hand a turn to the AI regent (🤖) — it plays your civ under the same rules. Take back control whenever you like.' },
  // A99: three state-triggered cards (predicates below)
  'first-contact': { title: 'Meeting your neighbours', text: 'You have spotted another civilization\'s unit. Contact can bring trade or trouble — watch your borders, and keep a defender in the cities nearest them.' },
  'low-treasury': { title: 'Watch the treasury', text: 'Your gold is running low against your upkeep. Nudge the tax rate up in the tax/science bar — an empty treasury forces your cities to sell off buildings to balance the books.' },
  'fortify-garrison': { title: 'Defend your cities', text: 'A city with no military unit is easy to capture. Move a defender in and Fortify it (F) — a fortified unit behind city walls is far harder to dislodge.' },
  // specs/advisor-hint-cards.md: the onboarding-advisor first-time triggers.
  // PROVISIONAL COPY (ally rewrites once the trigger→pedia table lands, 2026-07-22);
  // each ≤ 40 words, the pedia link (ADVICE_PEDIA below) carries the depth.
  'first-city': { title: 'Your first city', text: 'A city works the tiles around it for food, shields, and trade. Keep a defender inside before you send your next settler out — an empty city is easily taken.' },
  'first-unit': { title: 'Building units', text: 'Cities turn shields into units and improvements. Every unit beyond your government\'s free support costs a shield a turn from its home city, so build what you can afford to keep.' },
  'first-war': { title: 'At war', text: 'You are at war. Move defenders into your border cities and fortify them (F). Attacking is a gamble — terrain, walls, and veterans all sway the odds, so pick your fights.' },
  'growth-stall': { title: 'A hungry city', text: 'This city has run short of food and cannot grow — or is starving. Work more food tiles, build a Granary, or ease unhappiness so citizens return to the fields.' },
  'first-naval': { title: 'Taking to the sea', text: 'Naval units ferry land units across water and scout the coast. Early ships are fragile on the open ocean, so keep them near land until you have sturdier hulls.' },
  'goody-hut': { title: 'A tribal hut', text: 'That hut may hold gold, a friendly tribe, a free unit, or a new advance — but it can also hide raiders. Send a unit you can spare to investigate it.' },
  'barbarian': { title: 'Barbarians', text: 'Barbarians raid cities and pillage the land. They answer to no one and cannot be bargained with. Keep a fortified defender in exposed cities and they will usually look elsewhere.' },
  'wonder-available': { title: 'A Wonder within reach', text: 'You can now begin a Wonder of the World. Each is unique — once a rival finishes it, no one else can. A wonder is a heavy investment, so weigh it against the units and buildings you need.' },
  'new-government': { title: 'A new government', text: 'Your new government changes taxes, corruption, unit support, and how your people view war. Revisit your tax and science rates now — the old settings may no longer serve you best.' },
  'endgame': { title: 'The final stretch', text: 'The end of the age is near. Whoever leads when time runs out — or reaches Alpha Centauri, or conquers the world — wins. Press your strongest path to victory now.' },
  // DORMANT: shipped so the copy exists, but no live trigger yet (see initAdvice).
  'diplo-audience': { title: 'A royal audience', text: 'A rival leader wishes to speak. You can bargain for peace, trade knowledge, or refuse. Weigh their strength and your borders before you answer.' },
  'pollution': { title: 'Pollution', text: 'Industry and crowded cities foul the land, cutting a tile\'s output and risking global warming. Build cleaner improvements and send Settlers to clear polluted tiles.' }
};

// A99: PURE situation predicates (state, me) — exported so Node unit-tests them
// on crafted states with no DOM. The client's session.state is already
// fog-filtered for `me`, so any non-own unit in it is genuinely visible.
const CIVILIAN = { settlers: true, caravan: true, diplomat: true };

export function firstContactWhen(state, me) {
  if (!state || !state.players || !state.players[me]) return false;
  for (const uid of Object.keys(state.units)) {
    if (state.units[uid].owner !== me) return true; // a visible non-own unit = contact
  }
  return false;
}

export function lowTreasuryWhen(state, me) {
  const p = state && state.players && state.players[me];
  if (!p) return false;
  let cities = 0;
  for (const cid of Object.keys(state.cities)) if (state.cities[cid].owner === me) cities += 1;
  if (cities === 0) return false; // no empire to bankrupt yet
  // upkeep proxy: ~3 gold/city of maintenance. The exact bill needs the ruleset,
  // which the (state, me) signature deliberately omits — this is a low-gold
  // NUDGE for a first-timer, not an accountant.
  return p.gold < cities * 3;
}

export function fortifyGarrisonWhen(state, me) {
  if (!firstContactWhen(state, me)) return false; // only nag once an enemy is on the map
  for (const cid of Object.keys(state.cities)) {
    const c = state.cities[cid];
    if (c.owner !== me) continue;
    let garrisoned = false;
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.owner === me && u.x === c.x && u.y === c.y && !CIVILIAN[u.type]) { garrisoned = true; break; }
    }
    if (!garrisoned) return true; // an ungarrisoned own city while an enemy is known
  }
  return false;
}

// advisor-hint-cards.md: additional PURE predicates. Callers pass the
// fog-FILTERED view (filterView) so these are fog-honest by construction —
// a rival unit / hut on an unseen tile is absent from the view.
const BARB_ID = 'barb';

export function hasOwnCityWhen(state, me) {
  if (!state || !state.cities || !state.players || !state.players[me]) return false;
  for (const cid of Object.keys(state.cities)) if (state.cities[cid].owner === me) return true;
  return false;
}

export function barbarianSightedWhen(state, me) {
  if (!state || !state.units || !state.players || !state.players[me]) return false;
  for (const uid of Object.keys(state.units)) if (state.units[uid].owner === BARB_ID) return true;
  return false;
}

export function hutSightedWhen(state, me) {
  if (!state || !state.map || !state.map.tiles || !state.players || !state.players[me]) return false;
  const tiles = state.map.tiles;
  for (const k of Object.keys(tiles)) { const t = tiles[k]; if (t && t.hut) return true; }
  return false;
}

export function wonderAvailableWhen(state, me, ruleset) {
  const p = state && state.players && state.players[me];
  if (!p || !p.techs || !ruleset || !ruleset.wonders) return false;
  const built = state.wonders || {};
  for (const wid of Object.keys(ruleset.wonders)) {
    if (built[wid] !== undefined) continue;               // already built somewhere
    const req = ruleset.wonders[wid].tech;
    if (req === '' || req === undefined || p.techs.indexOf(req) !== -1) return true;
  }
  return false;
}

// project turns to the game-end year from the same data the engine steps by
// (rules.yearSteps); pure + golden-neutral (no state write). Returns a large
// number if the end is not reachable within the guard (defensive).
export function turnsToEndYear(year, rules) {
  if (!rules || rules.endYear === undefined) return 999;
  const steps = rules.yearSteps;
  let y = year, n = 0;
  while (y < rules.endYear && n < 400) {
    let step = 20;
    if (steps && steps.length) { step = steps[steps.length - 1].step; for (const b of steps) { if (y < b.until) { step = b.step; break; } } }
    y += step; n += 1;
  }
  return y >= rules.endYear ? n : 999;
}

export function endgameApproachingWhen(state, ruleset) {
  if (!state || ruleset === undefined) return false;
  return turnsToEndYear(state.year, ruleset.rules) <= 30;
}

function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; }
}

// A58c: advice id → the pedia concept it deepens (a '📖 More' link on the card).
// Audit (#1069): settler + tech-choice linked; unit-selected and regent stay
// UNLINKED on purpose — no concept covers movement basics or regency yet (a
// future concepts pass adds them; a near-miss link is worse than none).
export const ADVICE_PEDIA = {
  disorder: 'disorder', 'save-code': 'gamecode', 'combat-hover': 'veterancy',
  'first-contact': 'zoc', 'low-treasury': 'upkeep', 'fortify-garrison': 'garrison',
  'city-view': 'happiness', settler: 'cities', 'tech-choice': 'research',
  // advisor-hint-cards.md links. goody-hut / endgame / diplo-audience / pollution
  // stay UNLINKED on purpose — no exploration / victory / diplomacy / pollution
  // concept exists yet (a near-miss link is worse than none; the table flags them).
  'first-city': 'cities', 'first-unit': 'upkeep', 'first-war': 'garrison',
  'growth-stall': 'cities', 'first-naval': 'movement', 'barbarian': 'garrison',
  'wonder-available': 'buildings', 'new-government': 'governments'
};

export function initAdvice(ctx) {
  const { session } = ctx;
  const isBot = typeof navigator !== 'undefined' && navigator.webdriver === true;
  let seen = loadSeen();
  const queue = [];
  let card = null;
  let prevActive = null;   // for research-idle: detect a fresh turn for ctx.HUMAN
  let idleTurns = 0;
  const wants = id => adviceGate(id, seen, enabled(), isBot); // gate before any scan

  function enabled() { return !ctx.options || ctx.options.get('firstTimeTips') !== false; }
  function persist() { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { /* private mode */ } }

  // show the next queued, still-unseen advice (one card at a time; non-blocking)
  function pump() {
    if (card) return;
    while (queue.length > 0) {
      const id = queue.shift();
      if (!adviceGate(id, seen, enabled(), isBot) || !ADVICE[id]) continue;
      render(id);
      return;
    }
  }

  function render(id) {
    const a = ADVICE[id];
    card = document.createElement('div');
    card.id = 'advice-card';
    card.dataset.advice = id;
    card.innerHTML = `
      <div class="advice-head">💡 ${escapeHtml(a.title)}</div>
      <div class="advice-body">${escapeHtml(a.text)}</div>
      <div class="advice-actions">
        <button class="advice-ok">OK, got it</button>
        <button class="advice-no">No thanks</button>
        ${ADVICE_PEDIA[id] ? '<button class="advice-pedia">📖 More</button>' : ''}
      </div>`;
    document.body.appendChild(card);
    const pediaBtn = card.querySelector('.advice-pedia');
    if (pediaBtn) pediaBtn.addEventListener('click', () => { if (ctx.pedia) ctx.pedia.openTo('concepts', ADVICE_PEDIA[id]); });
    card.querySelector('.advice-ok').addEventListener('click', () => { seen[id] = true; persist(); dismiss(); });
    card.querySelector('.advice-no').addEventListener('click', () => {
      for (const k of Object.keys(ADVICE)) seen[k] = true; // silence all present + future
      persist(); dismiss();
    });
  }

  function dismiss() { if (card) { card.remove(); card = null; } pump(); }

  // the public trigger: modules call ctx.advice.offer('id') at the moment
  function offer(id) {
    if (!adviceGate(id, seen, enabled(), isBot)) return;
    queue.push(id);
    pump();
  }

  // event-driven triggers observed straight off the round stream (no hooks in
  // the emitting modules needed): disorder, the save-code toast, the regent
  // turn, and the player first holding a settler.
  if (session && session.onChange) {
    session.onChange((state, events) => {
      const me = ctx.HUMAN;
      const ruleset = session.ruleset;
      for (const e of events || []) {
        if (e.type === 'cityDisorder' && ownCity(state, e.cityId)) offer('disorder');
        else if (e.type === 'saveCode') offer('save-code');
        else if (e.type === 'regentTurn') offer('regent');
      }
      if (hasOwnSettler(state)) offer('settler');
      // A99: state-triggered cards (offer() + adviceGate handle once-only + muting)
      if (firstContactWhen(state, me)) offer('first-contact');
      if (lowTreasuryWhen(state, me)) offer('low-treasury');
      if (fortifyGarrisonWhen(state, me)) offer('fortify-garrison');

      // advisor-hint-cards.md: the onboarding first-time triggers. Event-driven
      // ones read the fog-FILTERED event stream (filterEvents) so the player only
      // gets nudges about things they can perceive — the sound.js precedent.
      for (const e of filterEvents(state, events || [], me)) {
        if (e.type === 'cityStarved' && ownCity(state, e.cityId)) offer('growth-stall');
        else if (e.type === 'governmentChanged' && e.playerId === me
          && e.government !== 'despotism' && e.government !== 'anarchy') offer('new-government');
        else if (e.type === 'diplomacy' && e.kind === 'declare' && (e.playerId === me || e.target === me)) offer('first-war');
        else if (e.type === 'pollutionSpread') offer('pollution'); // dormant until A91 fires it
        else if (e.type === 'unitBuilt') {
          const c = state.cities[e.cityId];
          if (c && c.owner === me) {
            offer('first-unit');
            const u = ruleset && ruleset.units && ruleset.units[e.unitType];
            if (u && u.domain === 'sea') offer('first-naval');
          }
        }
      }

      // View-derived cards: scan the fog-honest view, but only build it when a
      // still-unseen card actually needs it (the scan is skipped once all fire).
      if (wants('first-city') || wants('barbarian') || wants('goody-hut')
        || wants('wonder-available') || wants('endgame')) {
        const view = filterView(state, me);
        if (hasOwnCityWhen(view, me)) offer('first-city');
        if (barbarianSightedWhen(view, me)) offer('barbarian');
        if (hutSightedWhen(view, me)) offer('goody-hut');
        if (wonderAvailableWhen(view, me, ruleset)) offer('wonder-available');
        if (endgameApproachingWhen(view, ruleset)) offer('endgame');
      }

      // research-idle: on a fresh turn for me, no advance chosen 2+ turns running.
      if (state.activePlayer === me && prevActive !== me) {
        const p = state.players && state.players[me];
        const idle = p && (p.researching === '' || p.researching === undefined)
          && availableTechs(state, me, ruleset).length > 0;
        idleTurns = idle ? idleTurns + 1 : 0;
        if (idleTurns >= 2) offer('tech-choice');
      }
      prevActive = state.activePlayer;
    });
  }
  function ownCity(state, cid) { const c = state.cities[cid]; return c && c.owner === ctx.HUMAN; }
  function hasOwnSettler(state) {
    for (const uid of Object.keys(state.units)) {
      const u = state.units[uid];
      if (u.owner === ctx.HUMAN && u.type === 'settlers') return true;
    }
    return false;
  }

  // ⚙ "Show first-time tips" re-enabled → forget every seen flag so they can
  // appear again (the user asked for them back)
  function reset() { seen = {}; persist(); }
  if (ctx.options && ctx.options.watch) {
    ctx.options.watch((k, v) => { if (k === 'firstTimeTips' && v === true) reset(); });
  }

  return { offer, reset };
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
