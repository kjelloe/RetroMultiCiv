// A78: first-timer tutorial advice. Short, contextual ADVICE OFFERS surfaced
// the first time a player meets a system — a settler, a city view, civil
// disorder, a save code. Each offer shows ONCE (a per-id first-visit flag in
// localStorage, like the old splash flag), never blocks input, and never
// appears for returning players or the e2e/webdriver paths. Dismiss one with
// "OK, got it" or silence them all with "No thanks"; re-enable in ⚙. The prose
// is short + original (the A58 pedia carries the depth; advice links in once it
// lands). Client-only, localStorage-only — never game state.
import { adviceGate, SEEN_KEY } from './advice-gate.js';

// id → { title, text }. Kept short — a nudge, not a manual.
const ADVICE = {
  'unit-selected': { title: 'Moving units', text: 'Click a unit to select it, then click an adjacent tile to move. The action bar along the bottom holds its orders — fortify, sentry, and GoTo for longer journeys.' },
  'settler': { title: 'Founding a city', text: 'Settlers build your empire. Move one onto good ground — grassland near water is ideal — and use the Found City action (B) to plant a city there.' },
  'city-view': { title: 'Running a city', text: 'Open a city to choose what it builds and where its citizens work. When it finishes, pick something new or it falls back to building militia.' },
  'combat-hover': { title: 'Picking your fights', text: 'Hovering a visible enemy shows the attack odds. A fight is never certain — terrain, fortification, and veteran units all tilt the result.' },
  'disorder': { title: 'Civil disorder', text: 'A city where unhappy citizens outnumber happy ones (😠) stops making shields and taxes. Raise the luxuries rate, turn citizens into entertainers, or build a Temple.' },
  'tech-choice': { title: 'Choosing research', text: 'When your beakers fill you pick the next advance. Techs unlock units, buildings, and wonders — beeline the ones your strategy needs, or broaden for score.' },
  'save-code': { title: 'Your game code', text: 'That code is this game\'s fingerprint. Anyone who loads the save should see the same code — it proves the game state was not tampered with.' },
  'regent': { title: 'The AI regent', text: 'You can hand a turn to the AI regent (🤖) — it plays your civ under the same rules. Take back control whenever you like.' }
};

function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; }
}

export function initAdvice(ctx) {
  const { session } = ctx;
  const isBot = typeof navigator !== 'undefined' && navigator.webdriver === true;
  let seen = loadSeen();
  const queue = [];
  let card = null;

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
      </div>`;
    document.body.appendChild(card);
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
      for (const e of events || []) {
        if (e.type === 'cityDisorder' && ownCity(state, e.cityId)) offer('disorder');
        else if (e.type === 'saveCode') offer('save-code');
        else if (e.type === 'regentTurn') offer('regent');
      }
      if (hasOwnSettler(state)) offer('settler');
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
