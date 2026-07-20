// In-client BUG REPORT (helper queue #3, user-requested 2026-07-20 for the
// public test server). A one-click way for playtesters to report a problem. The
// dialog takes free text and AUTO-ATTACHES the Shift+D recording (initial state
// + command log + hashes, whatever the session holds), plus game code, turn and
// URL params — and the error text when opened from the error banner. On a
// SERVER game "Send report" POSTs to /bug-report (a write-only sink); every game
// also offers "Download instead" — the offline Shift+D fallback that works for
// local games and whenever a POST fails. Golden-neutral: reads only what the
// session already exposes; issues no engine commands.

export function initBugReport(ctx) {
  const { session } = ctx;
  const hud = ctx.hud;
  const isServer = () => session.gameId !== undefined;
  let lastError = null; // set when opened from the error banner
  let dialog = null;

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

  // the recording IS the attachment — the session owns it (local = the full
  // recording; server = the client's sent-command view + remote flag).
  function buildPayload(text) {
    let diagnostics = null;
    try {
      diagnostics = session.exportDiagnostics({
        url: location.href,
        urlParams: location.search,
        errors: ctx.errors || [],
        rulesOverrides: ctx.rulesOverrides || {}
      });
    } catch (_e) { diagnostics = null; } // never let assembly throw
    let code = null;
    try { code = ctx.gameCode(); } catch (_e) { /* pre-boot / server */ }
    return {
      format: 'retromulticiv-bug-report-client', version: 1,
      text: String(text || ''),
      errorText: lastError || null,
      gameId: (isServer() && session.gameId) || null,
      gameCode: code || null,
      turn: session.state ? session.state.turn : null,
      mode: isServer() ? 'server' : 'local',
      reportedAt: new Date().toISOString(),
      diagnostics
    };
  }

  function download(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `retromulticiv-bug-turn${payload.turn != null ? payload.turn : '0'}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function post(payload) {
    const r = await fetch('/bug-report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return true;
  }

  function flash(msg) { if (hud && hud.flash) hud.flash(msg); }

  function close() { if (dialog) { dialog.remove(); dialog = null; } }

  function open(prefillError) {
    if (prefillError !== undefined && prefillError !== null) lastError = String(prefillError);
    close();
    const server = isServer();
    dialog = document.createElement('div');
    dialog.id = 'bug-report';
    dialog.innerHTML = `<div id="bug-report-card">
      <div class="panel-head"><h3>🐞 Report a bug</h3><button class="panel-close" id="bug-x">✕</button></div>
      <label for="bug-text">What happened?</label>
      <textarea id="bug-text" rows="4" placeholder="Describe what you were doing and what went wrong…"></textarea>
      ${lastError ? `<div id="bug-error">Error: <code>${esc(lastError)}</code></div>` : ''}
      <div id="bug-attached">
        <div class="bug-attached-title">Attached (game data only — no personal info):</div>
        <ul>
          <li>the game recording (moves + state hashes) — lets us replay the bug</li>
          <li>game code, turn, and the page's URL settings</li>
          ${lastError ? '<li>the error message shown above</li>' : ''}
        </ul>
      </div>
      <div id="bug-report-buttons">
        ${server ? '<button id="bug-send">Send report</button>' : ''}
        <button id="bug-download">${server ? 'Download instead' : 'Download report'}</button>
        <button id="bug-cancel">Cancel</button>
      </div>
      <div id="bug-report-note" class="hidden"></div>
    </div>`;
    document.body.appendChild(dialog);

    const textEl = dialog.querySelector('#bug-text');
    const note = dialog.querySelector('#bug-report-note');
    textEl.focus();
    dialog.querySelector('#bug-x').addEventListener('click', close);
    dialog.querySelector('#bug-cancel').addEventListener('click', close);
    dialog.querySelector('#bug-download').addEventListener('click', () => {
      download(buildPayload(textEl.value));
      flash('🐞 Bug report downloaded — attach it when you tell us about the problem');
      close();
    });
    const sendBtn = dialog.querySelector('#bug-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true;
        note.classList.remove('hidden');
        note.textContent = 'Sending…';
        const payload = buildPayload(textEl.value);
        try {
          await post(payload);
          flash('🐞 Thanks — your bug report was sent');
          close();
        } catch (e) {
          // POST failed (disabled / rate-limited / offline) — fall back to a
          // download so the report is never lost.
          note.textContent = 'Could not send — downloading the report instead so you can attach it.';
          download(payload);
          setTimeout(close, 1500);
        }
      });
    }
    // Escape closes, but not while typing in the textarea (let it bubble there)
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
  }

  // one-click from the error banner (main.js dispatches on window.error)
  window.addEventListener('rmc-error', e => {
    lastError = e && e.detail ? String(e.detail) : lastError;
    showBannerButton();
  });

  // a small floating "report this problem" button that appears once an error
  // has surfaced (the banner's one-click affordance).
  let bannerBtn = null;
  function showBannerButton() {
    if (bannerBtn) return;
    bannerBtn = document.createElement('button');
    bannerBtn.id = 'bug-report-banner-btn';
    bannerBtn.textContent = '🐞 Report this problem';
    bannerBtn.addEventListener('click', () => open(lastError));
    document.body.appendChild(bannerBtn);
  }

  return { open, buildPayload };
}
