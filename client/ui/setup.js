// Game-setup screen (phase 2): shown on a bare URL. Picks civilizations,
// how many of the leading slots are human (hotseat), and an optional seed —
// then reloads with ?seed=&civs=&humans= so the bootstrap stays one path.
export function showSetupScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'setup-screen';
  overlay.innerHTML = `
    <div id="setup-box">
      <h2>RetroMultiCiv</h2>
      <p class="setup-hint">One engine, one world, 4000 BC. Humans play first, in seat order — pass the keyboard when your turn ends.</p>
      <label>Civilizations
        <select id="setup-civs">
          ${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </label>
      <label>Human players (hotseat)
        <select id="setup-humans"><option value="1">1</option></select>
      </label>
      <label>World seed <input id="setup-seed" type="text" inputmode="numeric" placeholder="random"></label>
      <button id="setup-start">Start game</button>
    </div>`;
  document.body.appendChild(overlay);

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
    location.search = `?seed=${seed}&civs=${civs}&humans=${humans}`;
  });
}
