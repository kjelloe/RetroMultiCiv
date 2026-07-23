// Game-setup screen (phase 2): shown on a bare URL. Picks your civilization
// (each has a Civ 1-flavored specialty), how many civs play, how many of the
// leading slots are human (hotseat), and an optional seed — then reloads
// with ?seed=&civs=&humans=&civ= so the bootstrap stays one path.
import { victoryOptions, DEFAULT_VICTORY } from '../../shared/victory-presets.js';
import { matchSnapshot } from '../../shared/age-snapshots.js';

export function showSetupScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'setup-screen';
  overlay.innerHTML = `
    <div id="setup-box">
      <h2>RetroMultiCiv <button id="setup-help" type="button" title="new here?" aria-label="new here?">?</button></h2>
      <p class="setup-hint">One deterministic engine, one world, 4000 BC — or any age you pick.
        Play solo against the AI, pass the keyboard in hotseat, or host a LAN game
        friends join with a 5-letter code.<span id="setup-maxciv-line"></span></p>
      <p class="setup-hint setup-proof">Every history can be replayed.</p>
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
      <label>Map type
        <select id="setup-maptype">
          <option value="continents" selected>Continents</option>
        </select>
      </label>
      <p class="setup-hint" id="setup-maptype-hint"></p>
      <label>Difficulty
        <select id="setup-difficulty">
          <option value="trainer">Trainer</option>
          <option value="chieftain">Chieftain</option>
          <option value="warlord">Warlord</option>
          <option value="prince" selected>Prince</option>
          <option value="king">King</option>
          <option value="emperor">Emperor</option>
          <option value="godemperor">God-Emperor</option>
        </select>
      </label>
      <label>Combat calculations
        <select id="setup-combat">
          <option value="authentic" title="one dice roll, like the 1991 original">Authentic Civ 1</option>
          <option value="bestof3" selected title="best-of-three: fewer heartbreaking upsets">Best-of-three</option>
        </select>
      </label>
      <label title="the Manhattan Project wonder unlocks nuclear weapons for everyone; uncheck to ban nukes entirely">Nuclear weapons
        <input id="setup-nukes" type="checkbox" checked>
      </label>
      <label title="how the game can be won and when it ends">Victory conditions
        <select id="setup-victory">
          ${victoryOptions().map(o => `<option value="${o.id}"${o.id === DEFAULT_VICTORY ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
      <label>Starting age
        <select id="setup-age"><option value="ancient" selected>Ancient (4000 BC)</option></select>
      </label>
      <p class="setup-hint" id="setup-age-hint"></p>
      <label>World seed <input id="setup-seed" type="text" inputmode="numeric" placeholder="random"></label>
      <div id="setup-primary">
        <button id="setup-start">Start game</button>
        <button id="setup-find">Find game</button>
      </div>
      <div id="setup-lan">
        <button id="setup-host" class="setup-lan-btn">Host LAN game</button>
        <button id="setup-join" class="setup-lan-btn">Join LAN game</button>
      </div>
      <div id="setup-find-list" class="hidden"></div>
      <p class="setup-hint" id="setup-host-guide"><a href="host-guide.html" target="_blank" rel="noopener">Hosting guide ↗</a> · <a href="https://github.com/kjelloe/RetroMultiCiv/issues" target="_blank" rel="noopener">Report issue ↗</a></p>
    </div>`;
  document.body.appendChild(overlay);
  // Tab-loss fix (user ruling 2026-07-22): a local game autosaves to
  // localStorage every turn (saves.js); returning to the bare page offers an
  // inline resume. Server use stays limited to the LAN buttons (Host/Join/
  // Find) — single-player and hotseat never touch the server.
  try {
    const rec = JSON.parse(localStorage.getItem('rmc_local_autosave') || 'null');
    if (rec && rec.state && rec.turn !== undefined) {
      const card = document.createElement('div');
      card.id = 'setup-resume';
      card.innerHTML = `<span>▶ <b>Resume your local game?</b> turn ${rec.turn}`
        + `${rec.civName ? ' · ' + rec.civName : ''}</span>`
        + `<span><button id="setup-resume-yes">Resume</button>`
        + `<button id="setup-resume-no" title="discard the autosave">🗑 Discard</button></span>`;
      const panel = overlay.firstElementChild;
      panel.insertBefore(card, panel.firstChild);
      document.getElementById('setup-resume-yes').addEventListener('click', () => {
        location.href = location.pathname + '?resume=local';
      });
      document.getElementById('setup-resume-no').addEventListener('click', () => {
        localStorage.removeItem('rmc_local_autosave');
        card.remove();
      });
    }
  } catch (e) { /* corrupt record — the card just doesn't show */ }
  const setupBox = document.getElementById('setup-box');

  // A42/A62: an animated diorama BEHIND the setup card — the renderer +
  // assets ARE the splash art (a coast, a walled city, a few units; A28
  // sway + A15 water animate themselves; we add slow camera drift). A62
  // (user 2026-07-15): ALWAYS ON (the first-visit-only flag was retired —
  // he missed it as a return visitor). Still skipped by reduce-animation,
  // headless (navigator.webdriver) and every demo/e2e param, and by
  // ?splash=0; ?splash=1/?splashstill=1 force it for screenshots.
  const sq = new URLSearchParams(location.search);
  let reduceAnim = false;
  try { reduceAnim = JSON.parse(localStorage.getItem('retromulticiv-options') || '{}').reduceAnimation === true; } catch (e) { /* fresh */ }
  const demoParams = ['setupdemo', 'lobbydemo', 'e2ehost', 'e2ejoin', 'e2ehostform', 'e2ejoinform', 'e2echat'];
  // A48: ?splashstill=1 — the diorama frozen at drift phase 0 (t=0 camera,
  // animations off) for a BYTE-STABLE visual-regression golden
  const splashStill = sq.get('splashstill') === '1';
  const splashForced = sq.get('splash') === '1' || splashStill;
  const splashWanted = splashForced || (
    sq.get('splash') !== '0'
    && !reduceAnim
    && !navigator.webdriver
    && !demoParams.some(p => sq.has(p))
  );
  if (splashWanted) {
    // A77: the title theme under the diorama — a music-only sound instance
    // (honors the ⚙ music toggle; webdriver is already excluded above; the
    // context resumes on the first click per browser autoplay policy)
    import('./sound.js').then(({ initSound }) => {
      let so = { soundMaster: '70', soundMusic: true };
      try { so = Object.assign(so, JSON.parse(localStorage.getItem('retromulticiv-options') || '{}')); } catch (e) { /* fresh */ }
      initSound({ options: { get: k => so[k] }, session: null }).playTune('splash');
    }).catch(() => { /* audio is best-effort */ });
    const dio = document.createElement('div');
    dio.id = 'setup-diorama';
    overlay.insertBefore(dio, setupBox);
    import('../renderer/renderer.js').then(async ({ createRenderer }) => {
      const civs = await fetch('../data/civs.json').then(r => r.json()).catch(() => ({}));
      // a small crafted coast: ocean west, a river-mouth city, escorts
      const W = 14, H = 10;
      const tiles = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          tiles.push({
            t: x < 4 ? 'ocean' : x < 5 ? 'plains' : x > 11 ? 'hills' : y < 2 ? 'forest' : 'grassland',
            visible: true, river: x === 7 && y > 4
          });
        }
      }
      const view = {
        map: { width: W, height: H, wrapX: false, tiles },
        players: {
          p1: { id: 'p1', name: 'Romans', color: '#3b7dd8' },
          p2: { id: 'p2', name: 'Zulus', color: '#b0632f' }
        },
        cities: { // a harbor city on the LEFT band — the card owns the center
          c1: { id: 'c1', name: 'Roma', owner: 'p1', x: 5, y: 5, pop: 6, buildings: ['city-walls', 'palace'] }
        },
        units: {
          u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 6, y: 7, moves: 1 },
          u2: { id: 'u2', type: 'legion', owner: 'p1', x: 5, y: 4, moves: 1, fortified: true },
          u3: { id: 'u3', type: 'trireme', owner: 'p1', x: 2, y: 5, moves: 1 },
          u4: { id: 'u4', type: 'cavalry', owner: 'p2', x: 12, y: 4, moves: 1 }
        }
      };
      const r = createRenderer(dio);
      if (r.setFactions) {
        r.setFactions({
          p1: civs.romans && civs.romans.visual, p2: civs.zulus && civs.zulus.visual
        });
      }
      r.setViewState(view);
      r.setZoom(10);
      if (splashStill) {
        // A48: freeze — drift phase 0 camera, sway/water off, one still frame
        if (r.setReduceAnimation) r.setReduceAnimation(true);
        r.centerOn(8.5, 4.8); // sin(0) = 0 → the drift's phase-0 position
      } else {
        const t0 = performance.now();
        const drift = () => { // slow pan: the harbor city rides the left band
          if (!document.getElementById('setup-diorama')) return; // screen left
          r.centerOn(8.5 + Math.sin((performance.now() - t0) / 9000) * 1.1, 4.8);
          requestAnimationFrame(drift);
        };
        drift();
      }
    }).catch(() => dio.remove()); // no WebGL etc: the plain screen is fine
  }

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
    // #2305: when the current config EXACTLY matches a pre-baked snapshot, the
    // later-age start loads instantly (no live walk) — surface it as a hint.
    let snapManifest = null;
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const instantHit = () => {
      if (!snapManifest || ageEl.value === 'ancient') return false;
      const seed = parseInt((val('setup-seed') || '').trim(), 10);
      if (!Number.isFinite(seed)) return false; // a random (blank) seed is never pre-baked
      return matchSnapshot(snapManifest, {
        age: ageEl.value, size: val('setup-size'), seed, civs: parseInt(val('setup-civs'), 10),
        mapType: val('setup-maptype'), difficulty: val('setup-difficulty'), picked: val('setup-civ') || null
      }) !== null;
    };
    const hint = () => {
      const base = ageEl.value === 'ancient' ? ''
        : 'the AI plays history first — worlds arrive with cities and roads';
      ageHint.textContent = base + (instantHit() ? ' · ⚡ instant (pre-baked)' : '');
    };
    ageEl.addEventListener('change', hint);
    // re-evaluate the instant hint when any config axis it depends on changes
    for (const id of ['setup-seed', 'setup-size', 'setup-civs', 'setup-maptype', 'setup-difficulty', 'setup-civ']) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', hint);
    }
    fetch('../data/age-snapshots/manifest.json').then(r => (r.ok ? r.json() : null)).then(m => { snapManifest = m; hint(); }).catch(() => { /* no snapshots → no hint */ });
    hint();
    // A82a: map types from rules.mapTypes — data-driven like the ages; the
    // hint line carries the HONEST world description (the label must match
    // the world the preset actually generates). Absent table = Continents only.
    // A82a-gate (user decision, specs/map-types-reference.md): naval maps sit
    // in an ADVANCED group until the AI can cross water (N3) — AI opponents
    // sit trapped on island maps today. Optgroups render only in the opened
    // list, so the closed control (and the splash golden) never moves.
    const MT_LAUNCH = ['continents', 'pangaea'];
    const mtEl = document.getElementById('setup-maptype');
    const mtHint = document.getElementById('setup-maptype-hint');
    if (mtEl && mtHint && rules.mapTypes) {
      mtEl.textContent = ''; // regroup: the static Continents option moves into Launch
      const groups = { launch: 'Launch', advanced: 'Advanced — naval AI in progress' };
      const els = {};
      for (const [key, label] of Object.entries(groups)) {
        els[key] = document.createElement('optgroup');
        els[key].label = label;
        mtEl.appendChild(els[key]);
      }
      for (const [id, mt] of Object.entries(rules.mapTypes)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = mt.name || id;
        if (id === 'continents') opt.selected = true;
        els[MT_LAUNCH.includes(id) ? 'launch' : 'advanced'].appendChild(opt);
      }
      const mtRefresh = () => {
        const mt = rules.mapTypes[mtEl.value];
        const advanced = !MT_LAUNCH.includes(mtEl.value);
        mtHint.textContent = ((mt && mt.desc) || '') + (advanced ? ' — naval AI in progress' : '');
      };
      mtEl.addEventListener('change', mtRefresh);
      mtRefresh();
    }
    // A42: the splash's civ count is DATA-DRIVEN — it updates itself when a
    // bigger roster ships (never hardcode the 14). Null guards: demo hooks
    // (?lobbydemo) swap the setup DOM before this async fetch lands.
    const ceiling = Math.max(...Object.values(rules.maxCivsBySize || { any: 7 }));
    const maxCivLine = document.getElementById('setup-maxciv-line');
    if (maxCivLine) maxCivLine.textContent = ` Up to ${ceiling} civilizations.`;
    // A38: the map size gates the civ count (measured seats-per-size table)
    // — the dropdown offers only what the selected size seats reliably
    const sizeSel = document.getElementById('setup-size');
    const civsHint = document.getElementById('setup-civs-hint');
    if (!sizeSel || !civsHint) return; // demo path dropped the form
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

  // ?lobbydemo=host|joiner|blocked|kicked — A37 waiting-room UI states
  const lobbyDemoKind = new URLSearchParams(location.search).get('lobbydemo');
  if (lobbyDemoKind) {
    import('./lobby.js').then(m => m.lobbyDemo(setupBox, lobbyDemoKind));
  }
  // ?e2ehostform=1 (A34 screenshots): open the HOST FORM (not auto-create) so
  // the resume-a-save picker renders against the live server's inventory
  if (new URLSearchParams(location.search).get('e2ehostform') === '1') {
    import('./lobby.js').then(m => m.startHostFlow(setupBox,
      { civs: 2, humans: 2, size: 'medium', age: 'ancient' }));
  }
  // ?e2ejoinform=1 (A41 screenshots): open the JOIN form so the browse list
  // renders against the live server's public lobbies
  if (new URLSearchParams(location.search).get('e2ejoinform') === '1') {
    import('./lobby.js').then(m => m.startJoinFlow(setupBox));
  }

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
    const maptype = document.getElementById('setup-maptype').value;
    const victory = document.getElementById('setup-victory').value;
    const nukes = document.getElementById('setup-nukes').checked;
    location.search = `?seed=${seed}&civs=${civs}&humans=${humans}${civ}`
      + (size !== 'medium' ? `&size=${size}` : '')
      + (difficulty !== 'prince' ? `&difficulty=${difficulty}` : '')
      + (combat !== 'authentic' ? `&combat=${combat}` : '')
      + (age !== 'ancient' ? `&age=${age}` : '')
      + (maptype !== 'continents' ? `&maptype=${maptype}` : '')
      + (!nukes ? '&nonukes=1' : '')
      + (victory !== DEFAULT_VICTORY ? `&victory=${victory}` : '');
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
      nukes: document.getElementById('setup-nukes').checked, // manhattan-gate: host no-nukes toggle
      seed: parseInt(document.getElementById('setup-seed').value, 10) || undefined,
      age: document.getElementById('setup-age').value, // A20: LAN lobbies inherit it
      maptype: document.getElementById('setup-maptype').value, // A82a
      victory: document.getElementById('setup-victory').value // victory-conditions preset
    };
  }
  document.getElementById('setup-host').addEventListener('click', () => {
    import('./lobby.js').then(m => m.startHostFlow(setupBox, worldOptions()));
  });
  document.getElementById('setup-join').addEventListener('click', () => {
    import('./lobby.js').then(m => m.startJoinFlow(setupBox));
  });

  // XIV §17: the "New here?" hint overlay — the ally's verbatim copy, one
  // obvious "Got it" dismiss (also tap-outside / Esc). Cards sized for mobile.
  document.getElementById('setup-help').addEventListener('click', () => {
    if (document.getElementById('setup-help-overlay')) return;
    const o = document.createElement('div');
    o.id = 'setup-help-overlay';
    const rows = [
      ['Start Game', 'Begin a new single-player world. Choose your civilization, map, and opponents, then lead your people from their first settlement onward.'],
      ['LAN Game', 'Host a multiplayer game for people on your network. Create a lobby, choose the settings, and share the join code when you are ready.'],
      ['Find game', 'Browse the public games other people are hosting right now and jump straight into one.'],
      ['Join Game', 'Enter a five-letter join code to meet friends in an existing multiplayer lobby. You can join before the host starts the game.']
    ];
    const card = document.createElement('div');
    card.id = 'setup-help-card';
    const h = document.createElement('h3'); h.textContent = 'New here?';
    card.appendChild(h);
    for (const [name, body] of rows) {
      const r = document.createElement('div'); r.className = 'setup-help-row';
      const b = document.createElement('b'); b.textContent = name;
      const s = document.createElement('span'); s.textContent = body;
      r.append(b, s); card.appendChild(r);
    }
    const got = document.createElement('button');
    got.id = 'setup-help-got'; got.type = 'button'; got.textContent = 'Got it';
    card.appendChild(got);
    o.appendChild(card);
    document.body.appendChild(o);
    const close = () => { o.remove(); window.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    got.addEventListener('click', close);
    o.addEventListener('click', e => { if (e.target === o) close(); });
    window.addEventListener('keydown', esc);
  });

  // XIV §18: "Find game" — the in-client master-index browser (docs/12 §6).
  // Fetches /master/servers (same-origin on the hosted box; ?master=URL for
  // self-hosters), lists public servers, tap to open that host's game. Server
  // names are UNTRUSTED (from the master) — built with textContent, never HTML.
  document.getElementById('setup-find').addEventListener('click', () => {
    const list = document.getElementById('setup-find-list');
    if (!list.classList.contains('hidden')) { list.classList.add('hidden'); return; }
    list.classList.remove('hidden');
    list.textContent = 'Loading games…';
    const masterUrl = new URLSearchParams(location.search).get('master') || '/master/servers';
    fetch(masterUrl).then(r => r.json()).then(data => {
      const servers = (data && Array.isArray(data.servers)) ? data.servers : [];
      list.textContent = '';
      if (servers.length === 0) {
        list.textContent = 'No public games right now — host one, or ask a friend for a join code.';
        return;
      }
      for (const s of servers) {
        const row = document.createElement('button');
        row.className = 'setup-find-row'; row.type = 'button';
        const nm = document.createElement('b'); nm.textContent = s.name || '(unnamed server)';
        const meta = document.createElement('span');
        meta.textContent = `${Number.isInteger(s.openGames) ? s.openGames : 0} open · ${s.protocolVersion || 'v?'}`;
        row.append(nm, meta);
        if (typeof s.host === 'string' && Number.isInteger(s.port)) {
          row.addEventListener('click', () => { location.href = `//${s.host}:${s.port}/client/?server=1`; });
        } else { row.disabled = true; }
        list.appendChild(row);
      }
    }).catch(() => { list.textContent = 'Could not reach the game list — check your connection or the master URL.'; });
  });

  // e2e: ?e2ehost=1 auto-hosts a tiny 1-human game and starts it (the browser
  // test's lobby boot path); &e2ehold=1 stops at the waiting room (screenshots).
  const params = new URLSearchParams(location.search);
  if (params.get('e2ehost') === '1') {
    import('./lobby.js').then(m => m.startHostFlow(setupBox,
      { // A38: ?e2ecivs/?e2esize override the tiny default (12-civ shots)
        civs: parseInt(params.get('e2ecivs') || '2', 10),
        humans: parseInt(params.get('e2ehumans') || '1', 10), // A49: 2-human lobby for the multi-client UI lane
        size: params.get('e2esize') || 'xsmall', seed: 12345
      },
      {
        auto: true, name: 'Kjell', hold: params.get('e2ehold') === '1',
        chat: params.get('e2echat') || null // A37: XSS e2e sends this payload
      }));
  }
}
