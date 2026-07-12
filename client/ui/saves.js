// Saving: F5/F9 quick save via localStorage, Shift+S/L JSON files, drag & drop.
const SAVE_KEY = 'retromulticiv-save';

export function initSaves(ctx) {
  const { session, sel, panels, hud } = ctx;

  // Where the per-game "last seen" code lives (docs/07 §4 auto-compare):
  // gameId in server mode, the world seed otherwise.
  const codeKey = 'retromulticiv-lastcode-' + (session.gameId
    || 'seed' + (new URLSearchParams(location.search).get('seed') || '0'));
  const isServer = () => session.gameId !== undefined;

  // Persistent game-code toast (docs/07 §3–4): shows the verification code and
  // STAYS until dismissed — "note this code" must not vanish like a 5s banner.
  const codeToast = document.createElement('div');
  codeToast.id = 'code-toast';
  codeToast.className = 'hidden';
  codeToast.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);'
    + 'z-index:40;background:#141d2e;border:1px solid #26324a;border-radius:8px;'
    + 'padding:10px 14px;color:#cdd8ea;font:13px ui-monospace,monospace;max-width:90vw;'
    + 'box-shadow:0 4px 16px rgba(0,0,0,.5);';
  document.body.appendChild(codeToast);
  function showCode(html) {
    codeToast.innerHTML = html + ' <button id="code-toast-x" style="margin-left:8px;'
      + 'background:none;border:1px solid #46587c;border-radius:4px;color:#7d8aa5;'
      + 'cursor:pointer;font:inherit;padding:1px 6px;">✕</button>';
    codeToast.classList.remove('hidden');
    document.getElementById('code-toast-x').addEventListener('click',
      () => codeToast.classList.add('hidden'));
  }

  // Save a code and offer it for noting; also stash it for the hand-off screen.
  function announceSave(turn, code) {
    if (!code) { hud.note(`💾 saved (turn ${turn})`); return; }
    ctx.lastSaveCode = code;
    localStorage.setItem(codeKey, code);
    showCode(`💾 Saved turn ${turn} — game code <b>${code}</b>. Every player should note it.`);
  }

  // Server mode: the client holds only a filtered view, so it can't compute the
  // authoritative code or a loadable state. Both Shift+S and Shift+D fetch the
  // server's own save (docs/06 static host serves saves/<gameId>.json).
  function fetchServerSave() {
    fetch(`/saves/${session.gameId}.json`).then(r => {
      if (!r.ok) throw new Error(`no server save yet (${r.status})`);
      return r.text();
    }).then(text => {
      download(JSON.parse(text), `retromulticiv-${session.gameId}.json`);
      let code = null;
      try { code = JSON.parse(text).code || null; } catch (e) { /* pre-slice-3 save */ }
      hud.flash('💾 Server games save server-side — downloaded the server save');
      if (code) showCode(`💾 Server save — game code <b>${code}</b>. Every player should note it.`);
    }).catch(err => hud.flash(`✗ ${err.message} — the server autosaves after your first move`));
  }

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
    // resume at the right seat: the active player if human, else the first
    // human — behind the hand-off cover, as if the turn had just passed
    const viewer = s.players[s.activePlayer] && s.players[s.activePlayer].human
      ? s.activePlayer
      : s.playerOrder.find(pid => s.players[pid] && s.players[pid].human);
    if (viewer && viewer !== ctx.HUMAN && ctx.handoff) {
      ctx.handoff.show(s.players[viewer].name, s.players[viewer].color, () => {});
      ctx.setHuman(viewer);
    }
    hud.note(`📂 loaded ${sourceLabel} (turn ${s.turn})`);
    // docs/07 §4: show the loaded code and auto-compare with the last code this
    // browser saw for this game (the verbal comparison remains the real backstop).
    const code = ctx.gameCode ? ctx.gameCode() : null;
    if (code) {
      const noted = localStorage.getItem(codeKey);
      let cmp = ' Compare with what you noted.';
      if (noted === code) cmp = ' <span style="color:#51cf66">✓ matches your last session.</span>';
      else if (noted) cmp = ` <span style="color:#ff6b6b">⚠ differs from your noted code (${noted}).</span>`;
      localStorage.setItem(codeKey, code);
      showCode(`📂 Loaded turn ${s.turn} — game code <b>${code}</b>.${cmp}`);
    }
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

  function download(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    hud.note(`💾 downloaded ${filename}`);
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
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'F5') { // quick save (classic)
      e.preventDefault();
      if (isServer()) { hud.flash('💾 Server games autosave server-side — Shift+S downloads the save'); return; }
      localStorage.setItem(SAVE_KEY, JSON.stringify(session.state));
      announceSave(session.state.turn, ctx.gameCode());
      return;
    }
    if (e.key === 'F9') { // quick load
      e.preventDefault();
      if (isServer()) { hud.flash('📂 Server games load server-side — restart with --game <save>'); return; }
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
      if (isServer()) { fetchServerSave(); return; }
      const code = ctx.gameCode();
      const envelope = {
        format: 'retromulticiv-save',
        savedAt: new Date().toISOString(),
        turn: session.state.turn,
        state: session.state
      };
      if (code) envelope.code = code; // the file carries its own code (docs/07)
      download(envelope, `retromulticiv-turn${session.state.turn}.json`);
      announceSave(session.state.turn, code);
      return;
    }
    if (e.key === 'D') { // Shift+D: diagnostics recording (replayable command log)
      if (isServer()) { fetchServerSave(); return; } // client diag is a stub in server mode
      const diag = session.exportDiagnostics({
        url: location.href,
        errors: ctx.errors || [],
        rulesOverrides: ctx.rulesOverrides || {} // difficulty etc — replay applies them
      });
      download(diag, `retromulticiv-diag-turn${session.state.turn}.json`);
      hud.flash('🧪 Diagnostics downloaded — verify with: node tools/replay.js <file>');
      return;
    }
    if (e.key === 'L') { // Shift+L: load from a JSON file
      if (isServer()) { hud.flash('📂 Server games load server-side — restart with --game <save>'); return; }
      fileInput.click();
    }
  });

  // drag & drop a save file anywhere on the page
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (isServer()) { hud.flash('📂 Server games load server-side — restart with --game <save>'); return; }
    if (e.dataTransfer.files.length > 0) loadFromFile(e.dataTransfer.files[0]);
  });
}
