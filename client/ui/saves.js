// Saving: F5/F9 quick save via localStorage, Shift+S/L JSON files, drag & drop.
const SAVE_KEY = 'retromulticiv-save';

export function initSaves(ctx) {
  const { session, sel, panels, hud } = ctx;

  function stateLooksValid(s) {
    return Boolean(s) && Boolean(s.map) && Array.isArray(s.map.tiles)
      && s.map.tiles.length === s.map.width * s.map.height
      && Boolean(s.units) && Boolean(s.players) && Array.isArray(s.playerOrder);
  }

  // Accepts a save-file envelope ({ format: 'retromulticiv-save', state }) or a
  // bare state object (older localStorage saves).
  function loadStateObject(obj, sourceLabel) {
    const s = obj && obj.format === 'retromulticiv-save' ? obj.state : obj;
    if (!stateLooksValid(s)) {
      hud.note(`✗ not a RetroMultiCiv save (${sourceLabel})`);
      return;
    }
    sel.unitId = null;
    sel.cityId = null;
    sel.lastMoved = null;
    panels.closeAll();
    session.replaceState(s);
    hud.note(`📂 loaded ${sourceLabel} (turn ${s.turn})`);
  }

  function loadFromFile(file) {
    file.text().then(text => {
      try {
        loadStateObject(JSON.parse(text), file.name);
      } catch (err) {
        hud.note(`✗ ${file.name}: ${err.message}`);
      }
    });
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) loadFromFile(fileInput.files[0]);
    fileInput.value = '';
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'F5') { // quick save (classic)
      e.preventDefault();
      localStorage.setItem(SAVE_KEY, JSON.stringify(session.state));
      hud.note(`💾 saved (turn ${session.state.turn})`);
      return;
    }
    if (e.key === 'F9') { // quick load
      e.preventDefault();
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { hud.note('no save found'); return; }
      try {
        loadStateObject(JSON.parse(raw), 'quick save');
      } catch (err) {
        hud.note(`load failed: ${err.message}`);
      }
      return;
    }
    if (e.key === 'S') { // Shift+S: download a JSON save file (debugging/sharing)
      const envelope = {
        format: 'retromulticiv-save',
        savedAt: new Date().toISOString(),
        turn: session.state.turn,
        state: session.state
      };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `retromulticiv-turn${session.state.turn}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      hud.note(`💾 downloaded ${a.download}`);
      return;
    }
    if (e.key === 'L') { // Shift+L: load from a JSON file
      fileInput.click();
    }
  });

  // drag & drop a save file anywhere on the page
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) loadFromFile(e.dataTransfer.files[0]);
  });
}
