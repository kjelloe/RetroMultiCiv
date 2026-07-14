// Game-setup screen (phase 2): shown on a bare URL. Picks your civilization
// (each has a Civ 1-flavored specialty), how many civs play, how many of the
// leading slots are human (hotseat), and an optional seed — then reloads
// with ?seed=&civs=&humans=&civ= so the bootstrap stays one path.
export function showSetupScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'setup-screen';
  overlay.innerHTML = `
    <div id="setup-box">
      <h2>RetroMultiCiv</h2>
      <p class="setup-hint">One deterministic engine, one world, 4000 BC — or any age you pick.
        Play solo against the AI, pass the keyboard in hotseat, or host a LAN game
        friends join with a 5-letter code.<span id="setup-maxciv-line"></span></p>
      <label>Your civilization
        <select id="setup-civ"><option value="">Random</option></select>
      </label>
      <p class="setup-hint" id="setup-specialty"></p>
      <label>Civilizations
        <select id="setup-civs">
          ${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </label>
      <p class="setup-hint hidden" id="setup-civs-hint"></p>
      <label>Human players
        <select id="setup-humans"><option value="1">1</option></select>
      </label>
      <label id="setup-hotseat-row" class="hidden">Enable hotseat game
        <input id="setup-hotseat" type="checkbox">
      </label>
      <p class="setup-hint hidden" id="setup-hotseat-hint"></p>
      <label>Map size
        <select id="setup-size">
          <option value="xsmall">XSmall</option>
          <option value="small">Small</option>
          <option value="medium" selected>Medium (Civ 1)</option>
          <option value="large">Large</option>
          <option value="xlarge">XLarge</option>
          <option value="huge">Huge</option>
        </select>
      </label>
      <label>Difficulty
        <select id="setup-difficulty">
          <option value="trainer">Trainer</option>
          <option value="easy">Easy</option>
          <option value="medium" selected>Medium</option>
          <option value="hard">Hard</option>
          <option value="godemperor">God-Emperor</option>
        </select>
      </label>
      <label>Combat calculations
        <select id="setup-combat">
          <option value="authentic">Authentic Civ 1 (one roll)</option>
          <option value="bestof3" selected>Best-of-three (fewer upsets)</option>
        </select>
      </label>
      <label>Starting age
        <select id="setup-age"><option value="ancient" selected>Ancient (4000 BC)</option></select>
      </label>
      <p class="setup-hint" id="setup-age-hint"></p>
      <label>World seed <input id="setup-seed" type="text" inputmode="numeric" placeholder="random"></label>
      <button id="setup-start">Start game</button>
      <div id="setup-lan">
        <button id="setup-host" class="setup-lan-btn">Host LAN game</button>
        <button id="setup-join" class="setup-lan-btn">Join LAN game</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const setupBox = document.getElementById('setup-box');

  // fill the civilization picker (specialty shown under the select)
  const civEl = document.getElementById('setup-civ');
  const specEl = document.getElementById('setup-specialty');
  fetch('../data/civs.json').then(r => r.json()).then(civs => {
    for (const id of Object.keys(civs).sort()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = civs[id].name;
      civEl.appendChild(opt);
    }
    const showSpecialty = () => {
      const c = civs[civEl.value];
      specEl.textContent = c && c.specialty ? `★ ${c.specialty.blurb}` : 'a random civilization awaits';
      // faction emblem chip (art A1.6a) next to the blurb
      if (c && c.visual) {
        import('../renderer/three/factions.js').then(m => {
          if (civs[civEl.value] !== c) return; // selection changed meanwhile
          const img = document.createElement('img');
          img.src = m.emblemDataUrl(c.visual);
          img.style.cssText = 'width:16px;height:16px;vertical-align:-3px;margin-right:6px;border-radius:3px;';
          specEl.prepend(img);
        });
      }
    };
    civEl.addEventListener('change', showSpecialty);
    showSpecialty();
  });

  // starting ages from data/rules.json (A20): later ages fast-forward the
  // world as all-AI history, then the humans take over
  const ageEl = document.getElementById('setup-age');
  const ageHint = document.getElementById('setup-age-hint');
  fetch('../data/rules.json').then(r => r.json()).then(rules => {
    for (const age of (rules.ages || []).slice(1)) { // ancient is already there
      const opt = document.createElement('option');
      opt.value = age.id;
      opt.textContent = `${age.name} (turn ${age.turn})`;
      ageEl.appendChild(opt);
    }
    const hint = () => {
      ageHint.textContent = ageEl.value === 'ancient' ? ''
        : 'the AI plays history first — worlds arrive with cities and roads';
    };
    ageEl.addEventListener('change', hint);
    hint();
    // A42: the splash's civ count is DATA-DRIVEN — it updates itself when a
    // bigger roster ships (never hardcode the 14)
    const ceiling = Math.max(...Object.values(rules.maxCivsBySize || { any: 7 }));
    document.getElementById('setup-maxciv-line').textContent =
      ` Up to ${ceiling} civilizations.`;
    // A38: the map size gates the civ count (measured seats-per-size table)
    // — the dropdown offers only what the selected size seats reliably
    const sizeSel = document.getElementById('setup-size');
    const civsHint = document.getElementById('setup-civs-hint');
    function refreshCivs() {
      const max = (rules.maxCivsBySize && rules.maxCivsBySize[sizeSel.value]) || 14;
      const keep = Math.min(parseInt(civsEl.value, 10) || 2, max);
      civsEl.innerHTML = '';
      for (let n = 2; n <= max; n++) {
        const opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = String(n);
        if (n === keep) opt.selected = true;
        civsEl.appendChild(opt);
      }
      civsHint.textContent = `this map size seats up to ${max} civilizations`;
      civsHint.classList.toggle('hidden', max >= 14);
      refreshHumans();
    }
    sizeSel.addEventListener('change', refreshCivs);
    refreshCivs();
  });

  const civsEl = document.getElementById('setup-civs');
  const humansEl = document.getElementById('setup-humans');
  // A23: humans ≠ hotseat since LAN landed. Multiple humans reveal an
  // explicit hotseat checkbox (default OFF); unchecked, the extra humans
  // are LAN seats and Start routes to hosting a lobby.
  const hotseatRow = document.getElementById('setup-hotseat-row');
  const hotseatEl = document.getElementById('setup-hotseat');
  const hotseatHint = document.getElementById('setup-hotseat-hint');
  const startBtn = document.getElementById('setup-start');
  function refreshMode() {
    const multi = parseInt(humansEl.value, 10) > 1;
    hotseatRow.classList.toggle('hidden', !multi);
    hotseatHint.classList.toggle('hidden', !multi);
    if (multi) {
      hotseatHint.textContent = hotseatEl.checked
        ? 'everyone shares this keyboard — pass it between turns'
        : 'friends join over the network — you host a lobby with a join code';
    }
    startBtn.textContent = !multi ? 'Start game'
      : hotseatEl.checked ? 'Start hotseat game' : 'Host LAN game';
    // A23 residue: hide the secondary Host button when the primary reads the same
    const hostBtn = document.getElementById('setup-host');
    if (hostBtn) hostBtn.classList.toggle('hidden', startBtn.textContent === 'Host LAN game');
  }
  function refreshHumans() {
    const civs = parseInt(civsEl.value, 10);
    const keep = Math.min(parseInt(humansEl.value, 10) || 1, civs);
    humansEl.innerHTML = '';
    for (let n = 1; n <= civs; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = n === 1 ? '1 (vs AI)' : String(n);
      if (n === keep) opt.selected = true;
      humansEl.appendChild(opt);
    }
    refreshMode();
  }
  civsEl.addEventListener('change', refreshHumans);
  humansEl.addEventListener('change', refreshMode);
  hotseatEl.addEventListener('change', refreshMode);
  refreshHumans();
  // ?setupdemo=lan|hotseat presets the multi-human states for screenshots
  // ?e2ejoin=CODE — joiner-view screenshots without driving the form
  const joinCode = new URLSearchParams(location.search).get('e2ejoin');
  if (joinCode) import('./lobby.js').then(m => m.autoJoin(setupBox, joinCode.toUpperCase(), 'Ada'));

  const demo = new URLSearchParams(location.search).get('setupdemo');
  if (demo === 'lan' || demo === 'hotseat') {
    humansEl.value = '2';
    hotseatEl.checked = demo === 'hotseat';
    refreshMode();
  }

  document.getElementById('setup-start').addEventListener('click', () => {
    const civs = parseInt(civsEl.value, 10);
    const humans = parseInt(humansEl.value, 10);
    // A23: multiple humans WITHOUT hotseat = host a LAN lobby (the extra
    // humans are seats to fill by join code). ?humans=N URLs stay hotseat
    // for saved links — only this button routes differently.
    if (humans > 1 && !hotseatEl.checked) {
      import('./lobby.js').then(m => m.startHostFlow(setupBox, worldOptions()));
      return;
    }
    const seed = parseInt(document.getElementById('setup-seed').value, 10)
      || (Date.now() % 1000000);
    const civ = civEl.value ? `&civ=${civEl.value}` : '';
    const size = document.getElementById('setup-size').value;
    const difficulty = document.getElementById('setup-difficulty').value;
    const combat = document.getElementById('setup-combat').value;
    const age = document.getElementById('setup-age').value;
    location.search = `?seed=${seed}&civs=${civs}&humans=${humans}${civ}`
      + (size !== 'medium' ? `&size=${size}` : '')
      + (difficulty !== 'medium' ? `&difficulty=${difficulty}` : '')
      + (combat !== 'authentic' ? `&combat=${combat}` : '')
      + (age !== 'ancient' ? `&age=${age}` : '');
  });

  // --- phase-4 LAN lobby (ui/lobby.js): host with the form's world options,
  // or join by code. Both take over this box; the game itself boots via the
  // ?server=1&game= reload the lobby performs.
  function worldOptions() {
    return {
      civs: parseInt(civsEl.value, 10),
      humans: parseInt(humansEl.value, 10),
      size: document.getElementById('setup-size').value,
      difficulty: document.getElementById('setup-difficulty').value,
      combat: document.getElementById('setup-combat').value,
      seed: parseInt(document.getElementById('setup-seed').value, 10) || undefined,
      age: document.getElementById('setup-age').value // A20: LAN lobbies inherit it
    };
  }
  document.getElementById('setup-host').addEventListener('click', () => {
    import('./lobby.js').then(m => m.startHostFlow(setupBox, worldOptions()));
  });
  document.getElementById('setup-join').addEventListener('click', () => {
    import('./lobby.js').then(m => m.startJoinFlow(setupBox));
  });

  // e2e: ?e2ehost=1 auto-hosts a tiny 1-human game and starts it (the browser
  // test's lobby boot path); &e2ehold=1 stops at the waiting room (screenshots).
  const params = new URLSearchParams(location.search);
  if (params.get('e2ehost') === '1') {
    import('./lobby.js').then(m => m.startHostFlow(setupBox,
      { // A38: ?e2ecivs/?e2esize override the tiny default (12-civ shots)
        civs: parseInt(params.get('e2ecivs') || '2', 10),
        humans: 1, size: params.get('e2esize') || 'xsmall', seed: 12345
      },
      {
        auto: true, name: 'Kjell', hold: params.get('e2ehold') === '1',
        chat: params.get('e2echat') || null // A37: XSS e2e sends this payload
      }));
  }
}
