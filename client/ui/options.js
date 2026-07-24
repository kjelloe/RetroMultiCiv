// Player options (⚙, top right) and the gameplay Help panel (❓). Options
// are client preferences in localStorage — never game state, never hashed.
import { PALETTES } from './palette.js';
import { PEDIA_NAME } from './pedia-name.js';
const KEY = 'retromulticiv-options';
const DEFAULTS = {
  autoEndTurn: false,     // end the turn as soon as every unit has moved
  autoNextUnit: true,     // jump to the next idle unit when one is spent
  showUnitMove: true,     // XIV §23: pace multi-unit GoTo moves (~200ms/unit) so they're followable
  hideFuture: false,      // hide not-yet-buildable items in the city catalog
  hideNoMovesHint: false, // mute the center "press E" hint
  clock: 'off',           // off | elapsed | time
  slowPokeSecs: '30',     // A26: turn-log note after waiting this long (0 = off)
  muteTurnBanner: false,  // A25: suppress the 🔔 your-turn banner + chime
  reduceAnimation: false, // A28: no sway/smoke/flashes, instant movement
  soundMaster: '70',      // A77: master volume 0-100 (string: it's a range input)
  soundEffects: true,     // A77: event sound effects (separate from reduceAnimation)
  soundMusic: true,       // A77: the creation + splash tunes
  firstTimeTips: true,    // A78: contextual first-timer advice (re-enable resets)
  civPalette: 'default',  // palette pass: display-time civ-color remap (ui/palette.js)
  discoveryCards: true,   // the tech-discovery card (ui/discovery-card.js)
  showMinimap: true       // XIV §36: show the world minimap (OFF hides it; layout reflows)
};

export function initOptions(ctx) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { stored = {}; }
  const values = Object.assign({}, DEFAULTS, stored);

  const watchers = [];
  ctx.options = {
    get(k) { return values[k]; },
    set(k, v) {
      values[k] = v;
      localStorage.setItem(KEY, JSON.stringify(values));
      syncPanel();
      syncClock();
      for (const w of watchers) w(k, v);
    },
    // live consumers (A28 renderer animations) — called with (key, value)
    watch(fn) { watchers.push(fn); }
  };

  // --- top-right buttons + clock -------------------------------------------
  const corner = document.createElement('div');
  corner.id = 'corner-buttons';
  corner.innerHTML = `
    <span id="game-clock"></span>
    <button id="open-help" title="gameplay help">❓</button>
    <button id="open-options" title="options">⚙</button>`;
  document.body.appendChild(corner);

  // --- options panel ---------------------------------------------------------
  const panel = document.createElement('div');
  panel.id = 'options-panel';
  panel.className = 'panel hidden';
  panel.innerHTML = `
    <div class="panel-head"><h3>⚙ Options</h3><button class="panel-close" data-close="options-panel">✕</button></div>
    <div id="options-saverow">
      <button id="opt-save" type="button">💾 Save game</button>
      <button id="opt-load" type="button">📂 Load game</button>
    </div>
    <label><input type="checkbox" data-opt="autoEndTurn"> Auto end turn when every unit has moved</label>
    <label><input type="checkbox" data-opt="autoNextUnit"> Auto-select the next unit when one is spent</label>
    <label><input type="checkbox" data-opt="showUnitMove"> Show unit movement (pace GoTo moves so you can follow them)</label>
    <label><input type="checkbox" data-opt="hideFuture"> Hide future units/buildings in the city catalog</label>
    <label><input type="checkbox" data-opt="hideNoMovesHint"> Hide the "press E to end the turn" hint</label>
    <label><input type="checkbox" data-opt="muteTurnBanner"> Mute the "your turn" banner and chime (LAN games)</label>
    <label><input type="checkbox" data-opt="reduceAnimation"> Reduce animation (no sway, smoke, or combat flashes; units move instantly)</label>
    <label>Clock
      <select data-opt="clock">
        <option value="off">off</option>
        <option value="elapsed">minutes played</option>
        <option value="time">time of day</option>
      </select>
    </label>
    <label>Slow player note, seconds (0 = off)
      <input type="number" data-opt="slowPokeSecs" min="0" step="5" style="width:64px">
    </label>
    <label>🔊 Sound volume
      <input type="range" data-opt="soundMaster" min="0" max="100" step="10" style="width:120px">
    </label>
    <label><input type="checkbox" data-opt="soundEffects"> Sound effects (combat, cities, discoveries, era changes)</label>
    <label><input type="checkbox" data-opt="soundMusic"> Music (world-creation and title themes)</label>
    <label><input type="checkbox" data-opt="firstTimeTips"> Show first-time tips (re-check to see them again)</label>
    <label><input type="checkbox" data-opt="discoveryCards"> Show discovery cards when an advance completes</label>
    <label><input type="checkbox" data-opt="showMinimap"> Show minimap</label>
    <label>Civ colors
      <select data-opt="civPalette">
        <option value="default">default</option>
        ${Object.keys(PALETTES).map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
    </label>
    <div id="options-report"><button id="open-onboarding" type="button">🧭 Show controls guide</button><button id="open-bug-report" type="button">🐞 Report a bug</button></div>`;
  document.body.appendChild(panel);

  const onboardBtn = panel.querySelector('#open-onboarding');
  if (onboardBtn) onboardBtn.addEventListener('click', () => {
    panel.classList.add('hidden'); // close Options so the arrows aren't over it
    if (ctx.onboarding) ctx.onboarding.show('game');
  });
  const reportBtn = panel.querySelector('#open-bug-report');
  if (reportBtn) reportBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    if (ctx.bugReport) ctx.bugReport.open();
  });

  // XIV §5+§8: always-visible Save/Load — the only save path on a touch device
  // with no keyboard (Shift+S/L unreachable). Close the panel first so a save
  // dialog / file picker isn't hidden behind it.
  const saveBtn = panel.querySelector('#opt-save');
  const loadBtn = panel.querySelector('#opt-load');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    if (ctx.saves) ctx.saves.saveGame();
  });
  if (loadBtn) loadBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    if (ctx.saves) ctx.saves.loadGame();
  });

  function syncPanel() {
    for (const el of panel.querySelectorAll('[data-opt]')) {
      const k = el.dataset.opt;
      if (el.type === 'checkbox') el.checked = values[k] === true;
      else el.value = values[k];
    }
  }
  panel.addEventListener('change', e => {
    const k = e.target.dataset.opt;
    if (!k) return;
    ctx.options.set(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });
  panel.querySelector('.panel-close').addEventListener('click', () => panel.classList.add('hidden'));
  document.getElementById('open-options').addEventListener('click', () => {
    helpPanel.classList.add('hidden');
    syncPanel();
    panel.classList.toggle('hidden');
  });
  syncPanel();

  // --- gameplay help panel (❓) — grows entry by entry ------------------------
  const helpPanel = document.createElement('div');
  helpPanel.id = 'gameplay-help';
  helpPanel.className = 'panel hidden';
  helpPanel.innerHTML = `
    <div class="panel-head"><h3>❓ Gameplay help</h3><button class="panel-close" data-close="gameplay-help">✕</button></div>
    <div class="help-entry"><b>😠 Civil disorder</b> — a city where unhappy citizens outnumber
      happy ones stops producing shields and taxes (food still grows). Raise
      luxuries, add entertainers, or build a Temple. <a class="pedia-deeplink" data-concept="disorder">📖 more in the pedia</a></div>
    <div class="help-entry"><b>⚡ Revolutions</b> — switching government means a few turns of
      Anarchy (no taxes or research) unless you own the Pyramids. <a class="pedia-deeplink" data-concept="governments">📖 more in the pedia</a></div>
    <div class="help-entry"><b>🏭 Production</b> — when a city completes a building, pick something
      new or it defaults to militia. Units repeat (∞) until you change them. <a class="pedia-deeplink" data-concept="upkeep">📖 more in the pedia</a></div>
    <div class="help-entry"><b>🏛 Capital</b> — press <b>C</b> with no city selected to fly to your
      capital (the Palace city, or your oldest). With a city selected, C cycles
      its buildable improvements instead. <a class="pedia-deeplink" data-concept="corruption">📖 more in the pedia</a></div>
    <div class="help-entry"><i>Full reference in the 📖 ${PEDIA_NAME} (?).</i></div>`;
  document.body.appendChild(helpPanel);
  helpPanel.querySelector('.panel-close').addEventListener('click', () => helpPanel.classList.add('hidden'));
  // A58c deep-link: jump from a quick tip into the pedia's concept entry
  helpPanel.addEventListener('click', e => {
    const a = e.target.closest('.pedia-deeplink'); if (!a) return;
    helpPanel.classList.add('hidden');
    if (ctx.pedia) ctx.pedia.openTo('concepts', a.dataset.concept);
  });
  document.getElementById('open-help').addEventListener('click', () => {
    panel.classList.add('hidden');
    helpPanel.classList.toggle('hidden');
  });

  // --- clock -----------------------------------------------------------------
  const clockEl = document.getElementById('game-clock');
  const startedAt = Date.now();
  function syncClock() {
    const mode = values.clock;
    if (mode === 'elapsed') {
      const mins = Math.floor((Date.now() - startedAt) / 60000);
      clockEl.textContent = `⏱ ${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
    } else if (mode === 'time') {
      const d = new Date();
      clockEl.textContent = `🕐 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      clockEl.textContent = '';
    }
  }
  setInterval(syncClock, 10000);
  syncClock();
}
