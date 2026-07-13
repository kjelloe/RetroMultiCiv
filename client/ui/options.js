// Player options (⚙, top right) and the gameplay Help panel (❓). Options
// are client preferences in localStorage — never game state, never hashed.
const KEY = 'retromulticiv-options';
const DEFAULTS = {
  autoEndTurn: false,     // end the turn as soon as every unit has moved
  autoNextUnit: true,     // jump to the next idle unit when one is spent
  hideFuture: false,      // hide not-yet-buildable items in the city catalog
  hideNoMovesHint: false, // mute the center "press E" hint
  clock: 'off',           // off | elapsed | time
  slowPokeSecs: '30',     // A26: turn-log note after waiting this long (0 = off)
  muteTurnBanner: false   // A25: suppress the 🔔 your-turn banner + chime
};

export function initOptions(ctx) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { stored = {}; }
  const values = Object.assign({}, DEFAULTS, stored);

  ctx.options = {
    get(k) { return values[k]; },
    set(k, v) {
      values[k] = v;
      localStorage.setItem(KEY, JSON.stringify(values));
      syncPanel();
      syncClock();
    }
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
    <label><input type="checkbox" data-opt="autoEndTurn"> Auto end turn when every unit has moved</label>
    <label><input type="checkbox" data-opt="autoNextUnit"> Auto-select the next unit when one is spent</label>
    <label><input type="checkbox" data-opt="hideFuture"> Hide future units/buildings in the city catalog</label>
    <label><input type="checkbox" data-opt="hideNoMovesHint"> Hide the "press E to end the turn" hint</label>
    <label><input type="checkbox" data-opt="muteTurnBanner"> Mute the "your turn" banner and chime (LAN games)</label>
    <label>Clock
      <select data-opt="clock">
        <option value="off">off</option>
        <option value="elapsed">minutes played</option>
        <option value="time">time of day</option>
      </select>
    </label>
    <label>Slow player note, seconds (0 = off)
      <input type="number" data-opt="slowPokeSecs" min="0" step="5" style="width:64px">
    </label>`;
  document.body.appendChild(panel);

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
      happy ones stops producing shields and taxes (food still grows). Fix it by:
      raising the luxuries rate (research panel), pulling citizens off the fields
      to work as entertainers (city view), building a Temple/Colosseum/Cathedral,
      or garrisoning military units under governments with martial law.</div>
    <div class="help-entry"><b>⚡ Revolutions</b> — switching government means a few turns of
      Anarchy (no taxes or research) unless you own the Pyramids.</div>
    <div class="help-entry"><b>🏭 Production</b> — when a city completes a building, pick something
      new or it defaults to militia. Units repeat (∞) until you change them.</div>
    <div class="help-entry"><b>🏛 Capital</b> — press <b>C</b> with no city selected to fly to your
      capital (the Palace city, or your oldest). With a city selected, C cycles
      its buildable improvements instead.</div>
    <div class="help-entry"><i>More entries will land here as systems grow.</i></div>`;
  document.body.appendChild(helpPanel);
  helpPanel.querySelector('.panel-close').addEventListener('click', () => helpPanel.classList.add('hidden'));
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
