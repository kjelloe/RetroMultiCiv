// Saving: F5/F9 quick save via localStorage, Shift+S/L JSON files, drag & drop.
import { hashState } from '../../shared/statehash.js';
import { GAME_VERSION, versionMismatch } from '../../shared/version.js';
const SAVE_KEY = 'retromulticiv-save';

// The Shift+S save envelope, DOM-free so it unit-tests (B16). The A47 diag
// block makes the save's whole history replayable; it must carry everything
// tools/replay.js needs to rebuild the ruleset the game actually ran with.
export function buildSaveEnvelope(session, ctx) {
  const code = ctx.gameCode ? ctx.gameCode() : null;
  const envelope = {
    format: 'retromulticiv-save',
    gameVersion: GAME_VERSION, // §30 envelope stamp — never hashed; loaders gate the major
    savedAt: new Date().toISOString(),
    turn: session.state.turn,
    state: session.state
  };
  if (code) envelope.code = code; // the file carries its own code (docs/07)
  // A47: the full-history block (never game state — hashes untouched) so a
  // loaded save's replay theater spans the game's whole life; guarded so
  // server-mode / recording-less sessions simply omit it
  if (session.exportDiagnostics) {
    const d = session.exportDiagnostics();
    if (d && d.log) {
      // B16: the ruleset overrides the game RAN with travel with the history
      // — without them a replay reconstructs the wrong rules and reports
      // phantom divergence (the turn-371 hunt). {} means "default rules,
      // recorded"; absence means a pre-B16 save (replay warns).
      envelope.diag = {
        gameVersion: GAME_VERSION,
        initialState: d.initialState,
        log: d.log,
        rulesOverrides: ctx.rulesOverrides || {}
      };
    }
  }
  return envelope;
}

// B16 apply-on-load (architect ruling @1220b527): the save IS the game — its
// recorded rulesOverrides replace the URL's on load, in place, so the live
// engine and every future envelope run the loaded game's actual rules. A URL
// param must never silently mutate a loaded game's difficulty. Returns a
// human notice line, or null when the save records nothing (pre-B16 saves
// keep the status quo — their rules are unknowable). DOM-free for tests.
const DIFFICULTY_NAMES = { 6: 'Trainer', 5: 'Easy', 4: 'Medium', 3: 'Hard', 2: 'God-Emperor' };
export function applyLoadedRules(session, ctx, diagBlock) {
  if (!diagBlock || diagBlock.rulesOverrides === undefined || !ctx.baseRules) return null;
  const ov = diagBlock.rulesOverrides;
  const rules = session.ruleset.rules;
  const next = Object.assign({}, ctx.baseRules, ov);
  // mutate IN PLACE: the engine closure and every module hold this object
  for (const k of Object.keys(rules)) {
    if (next[k] === undefined) delete rules[k];
  }
  Object.assign(rules, next);
  ctx.rulesOverrides = ov; // the next envelope stamps the loaded game's truth
  const bits = [];
  if (ov.contentCitizens !== undefined && DIFFICULTY_NAMES[ov.contentCitizens]) {
    bits.push(`${DIFFICULTY_NAMES[ov.contentCitizens]} difficulty`);
  }
  if (ov.combatRounds !== undefined && ov.combatRounds > 1) bits.push('best-of-3 combat');
  for (const k of Object.keys(ov)) {
    if (k !== 'contentCitizens' && k !== 'combatRounds') bits.push(`${k}=${ov[k]}`);
  }
  return bits.length > 0 ? `⚖ rules from save: ${bits.join(' · ')}` : null;
}

export function initSaves(ctx) {
  const { session, sel, panels, hud } = ctx;

  // Where the per-game "last seen" code lives (docs/07 §4 auto-compare):
  // gameId in server mode, the world seed otherwise.
  const codeKey = 'retromulticiv-lastcode-' + (session.gameId
    || 'seed' + (new URLSearchParams(location.search).get('seed') || '0'));
  const isServer = () => session.gameId !== undefined;

  // Persistent game-code toast (docs/07 §3–4): shows the verification code and
  // STAYS until dismissed — "note this code" must not vanish like a 5s banner.
  // B15: the persistence is by design, but the DISMISS must be unmissable —
  // the whole toast is a click target (plus Escape), not just the small ✕.
  const codeToast = document.createElement('div');
  codeToast.id = 'code-toast';
  codeToast.className = 'hidden';
  codeToast.title = 'click to dismiss';
  codeToast.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);'
    + 'z-index:40;background:#141d2e;border:1px solid #26324a;border-radius:8px;'
    + 'padding:10px 14px;color:#cdd8ea;font:13px ui-monospace,monospace;max-width:90vw;'
    + 'box-shadow:0 4px 16px rgba(0,0,0,.5);cursor:pointer;';
  document.body.appendChild(codeToast);
  codeToast.addEventListener('click', () => codeToast.classList.add('hidden'));
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') codeToast.classList.add('hidden');
  });
  function showCode(html) {
    codeToast.innerHTML = html + ' <button id="code-toast-x" title="dismiss" '
      + 'style="margin-left:10px;background:#26324a;border:1px solid #5b6f96;'
      + 'border-radius:4px;color:#e6edf7;cursor:pointer;font:inherit;'
      + 'font-weight:bold;padding:2px 9px;">✕ dismiss</button>';
    codeToast.classList.remove('hidden');
    // the ✕ keeps its own handler (belt and braces — the toast-wide click
    // covers it, but the button must never become decorative)
    document.getElementById('code-toast-x').addEventListener('click',
      () => codeToast.classList.add('hidden'));
  }

  // Save a code and offer it for noting; also stash it for the hand-off screen.
  function announceSave(turn, code) {
    if (!code) { hud.note(`💾 saved (turn ${turn})`); return; }
    ctx.lastSaveCode = code;
    localStorage.setItem(codeKey, code);
    // A46: the seat code rides next to the game code — the recovery secret
    // for rejoining from another device (a LIVE seat rejects it by design,
    // so switching devices means closing the old tab first)
    const seat = session.seatCode
      ? `<br><span title="rejoin from another device with this code — close the old tab first">`
        + `your seat code <b>${session.seatCode}</b> (rejoin from another device)</span>`
      : '';
    // A92: a debug-tainted game's code chip carries the PERMANENT watermark
    // (docs/07 trust loop — the code still verifies, but everyone sees the
    // game used god-mode commands)
    const taint = session.state && session.state.debugUsed === true
      ? ' <b style="color:#e8b0a8">⚠ DEBUG</b>' : '';
    showCode(`💾 Saved turn ${turn} — game code <b>${code}</b>${taint}. Every player should note it.${seat}`);
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

  // Accepts a CLIENT save envelope ({ format:'retromulticiv-save', state }), a
  // SERVER save envelope ({ format:'retromulticiv-server-save', state, diag })
  // — a user's hosted-game save is the latter — or a bare state object (older
  // localStorage saves).
  function loadStateObject(obj, sourceLabel) {
    // §30 envelope version gate: refuse a MAJOR-version mismatch with a friendly
    // line instead of a hash surprise (legacy/version-less saves are exempt).
    const verMsg = versionMismatch(obj && obj.gameVersion);
    if (verMsg) { hud.note(`✗ ${verMsg} (${sourceLabel})`); return; }
    const isServerSave = Boolean(obj && obj.format === 'retromulticiv-server-save');
    const s = obj && (obj.format === 'retromulticiv-save' || isServerSave) ? obj.state : obj;
    if (!stateLooksValid(s)) {
      hud.note(`✗ not a RetroMultiCiv save (${sourceLabel})`);
      return;
    }
    // ruleset-compat pin (specs/ruleset-compat-policy.md): a save created under a
    // DIFFERENT ruleset diverges silently — block with a confirm override. Omit-
    // safe: older saves lack the pin -> loaded without a check.
    if (s.rulesetHash !== undefined && session.ruleset) {
      const cur = '0x' + (hashState(session.ruleset) >>> 0).toString(16).padStart(8, '0');
      if (s.rulesetHash !== cur
          && !(typeof confirm === 'function' && confirm(`This save was created under a different ruleset (${s.rulesetHash} vs ${cur}); it may diverge mid-game. Load anyway?`))) {
        hud.note(`✗ ruleset drift (${s.rulesetHash} ≠ ${cur}) — load cancelled`);
        return;
      }
    }
    // A SERVER save records EVERY human seat (some now DEAD); loaded LOCALLY it
    // would hotseat hand off to them. Collapse non-self humans to AI so a solo
    // "continue my hosted game" plays on against the AIs — self = the first
    // ALIVE human (else the first human). (A client hotseat save is untouched.)
    if (isServerSave) {
      const humanPids = s.playerOrder.filter(pid => s.players[pid] && s.players[pid].human);
      const self = s.playerOrder.find(pid => s.players[pid] && s.players[pid].human && s.players[pid].alive !== false)
        || humanPids[0];
      for (const pid of humanPids) if (pid !== self) s.players[pid].human = false;
    }
    sel.unitId = null;
    sel.cityId = null;
    sel.lastMovedBy = {}; // unit ids from another game could collide
    panels.closeAll();
    // B16 apply-on-load: the save's recorded rules replace the URL's — the
    // loaded game keeps ITS difficulty and the composed recording stays
    // replayable by construction (notice line below, never a dialog)
    const rulesNotice = applyLoadedRules(session, ctx, obj && obj.diag);
    // A47: a save carrying a diag block seeds the recorder with the game's
    // full history (the replay theater then spans every session); older
    // saves without it replay from the load point
    session.replaceState(s, obj && obj.diag);
    if (rulesNotice) hud.note(rulesNotice);
    // resume at the right seat: the active player if human, else the first
    // human — behind the hand-off cover, as if the turn had just passed
    const viewer = s.players[s.activePlayer] && s.players[s.activePlayer].human
      ? s.activePlayer
      : s.playerOrder.find(pid => s.players[pid] && s.players[pid].human);
    if (viewer && viewer !== ctx.HUMAN && ctx.handoff) {
      ctx.handoff.show(s.players[viewer].name, s.players[viewer].color, () => {});
      ctx.setHuman(viewer);
    }
    // recenter the camera on the loaded empire — boot centers on load, but a
    // mid-session load otherwise leaves the camera on the OLD (now off-map,
    // blank) position, so the world looks empty until a unit is selected
    const focusPid = viewer || ctx.HUMAN;
    const focus = Object.values(s.cities).find(c => c.owner === focusPid)
      || Object.values(s.units).find(u => u.owner === focusPid);
    if (focus && ctx.renderer && ctx.renderer.centerOn) ctx.renderer.centerOn(focus.x, focus.y);
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

  // XIV §5+§8: the Save/Load actions, named so the ⚙ Options buttons (always
  // visible — the ONLY save path on a touch device with no keyboard) share the
  // exact same code as Shift+S / Shift+L. Local games download a save file;
  // server games download the authoritative server save (Save) or explain that
  // resume is server-side (Load).
  function saveGame() {
    if (isServer()) { fetchServerSave(); return; }
    const envelope = buildSaveEnvelope(session, ctx);
    download(envelope, `retromulticiv-turn${session.state.turn}.json`);
    announceSave(session.state.turn, envelope.code || null);
  }
  function loadGame() {
    if (isServer()) { hud.flash('📂 Server games load server-side — restart with --game <save>'); return; }
    fileInput.click();
  }

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
      saveGame();
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
      loadGame();
    }
  });

  // drag & drop a save file anywhere on the page
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (isServer()) { hud.flash('📂 Server games load server-side — restart with --game <save>'); return; }
    if (e.dataTransfer.files.length > 0) loadFromFile(e.dataTransfer.files[0]);
  });

  // Entry-default ruling (2026-07-22): a LOCAL game persists itself. An
  // autosave lands in localStorage at every turn boundary and on tab-hide,
  // so closing the tab no longer loses the game — the setup screen offers
  // resume (main.js ?resume=local boots from this record). Server games are
  // server-saved and skip all of this. rmc_* keys are permanent codenames.
  const AUTO_KEY = 'rmc_local_autosave';
  const isMock = new URLSearchParams(location.search).has('mock');
  let quotaNoted = false;
  function writeAutosave() {
    if (isServer() || isMock) return;
    try {
      const p = session.state.players[ctx.HUMAN] || {};
      localStorage.setItem(AUTO_KEY, JSON.stringify({
        format: 'retromulticiv-local-autosave', savedAt: Date.now(),
        turn: session.state.turn, civName: p.name || p.civ || '',
        rulesOverrides: ctx.rulesOverrides || {},
        state: session.state
      }));
    } catch (err) {
      // quota or serialization — the game keeps running; say it once
      if (!quotaNoted) { quotaNoted = true; hud.note(`autosave unavailable: ${err.name || 'error'} — use 💾 to save to a file`); }
    }
  }
  let lastAutoTurn = -1;
  session.onChange(() => {
    if (isServer() || isMock) return;
    if (session.state.turn !== lastAutoTurn) { lastAutoTurn = session.state.turn; writeAutosave(); }
  });
  window.addEventListener('pagehide', writeAutosave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writeAutosave();
  });

  // 💾 corner button — upper right, LEFT of the 📖 civilopedia icon (saves
  // initializes after pedia, so firstChild lands left of it). Same action as
  // Shift+S / the ⚙ Options Save button: download the full save file.
  const corner = document.getElementById('corner-buttons');
  if (corner) {
    const b = document.createElement('button');
    b.id = 'save-game-btn'; b.title = 'save game (Shift+S)'; b.textContent = '💾';
    corner.insertBefore(b, corner.firstChild);
    b.addEventListener('click', saveGame);
  }

  // XIV §5+§8: exposed so ui/options.js can offer always-visible Save/Load
  // buttons (the touch-device save path); `server` lets the panel adapt copy.
  return { saveGame, loadGame, isServer: () => isServer() };
}
