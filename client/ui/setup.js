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
      <p class="setup-hint">One engine, one world, 4000 BC. Humans play first, in seat order — pass the keyboard when your turn ends.</p>
      <label>Your civilization
        <select id="setup-civ"><option value="">Random</option></select>
      </label>
      <p class="setup-hint" id="setup-specialty"></p>
      <label>Civilizations
        <select id="setup-civs">
          ${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </label>
      <label>Human players (hotseat)
        <select id="setup-humans"><option value="1">1</option></select>
      </label>
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
  });

  const civsEl = document.getElementById('setup-civs');
  const humansEl = document.getElementById('setup-humans');
  function refreshHumans() {
    const civs = parseInt(civsEl.value, 10);
    const keep = Math.min(parseInt(humansEl.value, 10) || 1, civs);
    humansEl.innerHTML = '';
    for (let n = 1; n <= civs; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = n === 1 ? '1 (vs AI)' : `${n} (hotseat)`;
      if (n === keep) opt.selected = true;
      humansEl.appendChild(opt);
    }
  }
  civsEl.addEventListener('change', refreshHumans);
  refreshHumans();

  document.getElementById('setup-start').addEventListener('click', () => {
    const civs = parseInt(civsEl.value, 10);
    const humans = parseInt(humansEl.value, 10);
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
      { civs: 2, humans: 1, size: 'xsmall', seed: 12345 },
      { auto: true, name: 'Kjell', hold: params.get('e2ehold') === '1' }));
  }
}
