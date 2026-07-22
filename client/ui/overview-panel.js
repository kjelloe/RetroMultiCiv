// XIV §34/§41: the shared OVERVIEW-PANEL component — a centered `.panel` with a
// top-bar toggle button and a scrollable one-row-per-entity table; click a row
// to act. The city overview (§34) and military overview (§41) both build on it,
// passing only their headers + row builder. Client-only, golden-neutral: it
// renders whatever the caller's build() returns and never touches game state.
export function makeOverviewPanel(ctx, opts) {
  // opts: { icon, title, buttonId, buttonTitle, panelId, tableId, rowClass,
  //         anchorId (button inserted before this element, else appended to body),
  //         build() -> { headers:[{label,title?}], rows:[{cells:[html], onClick?, title?}], empty? } }
  const { session } = ctx;

  const btn = document.createElement('button');
  btn.id = opts.buttonId;
  btn.title = opts.buttonTitle;
  btn.textContent = opts.icon;
  const anchor = opts.anchorId ? document.getElementById(opts.anchorId) : null;
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
  else document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = opts.panelId;
  panel.className = 'panel hidden';
  panel.innerHTML = `<div class="panel-head"><h3>${opts.icon} ${esc(opts.title)}</h3>`
    + '<button class="panel-close" title="close (Esc)">✕</button></div>'
    + `<div class="overview-body" id="${opts.panelId}-body"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('.overview-body');
  panel.querySelector('.panel-close').addEventListener('click', close);

  function draw() {
    const { headers, rows, empty } = opts.build();
    if (!rows || rows.length === 0) {
      body.innerHTML = `<div class="overview-empty">${esc(empty || 'nothing to show')}</div>`;
      return;
    }
    const thead = '<thead><tr>' + headers.map(h =>
      `<th${h.title ? ` title="${esc(h.title)}"` : ''}>${h.label}</th>`).join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.map((r, i) =>
      `<tr class="${opts.rowClass} overview-row" data-i="${i}"${r.title ? ` title="${esc(r.title)}"` : ''}>`
      + r.cells.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
    body.innerHTML = `<table id="${opts.tableId}" class="overview-table">${thead}${tbody}</table>`;
    body.querySelectorAll('.' + opts.rowClass).forEach(tr => {
      const r = rows[Number(tr.dataset.i)];
      if (r && r.onClick) tr.addEventListener('click', () => { close(); r.onClick(); }); // navigate away
    });
  }

  function open() { draw(); panel.classList.remove('hidden'); }
  function close() { panel.classList.add('hidden'); }
  function toggle() { panel.classList.contains('hidden') ? open() : close(); }
  btn.addEventListener('click', toggle);
  // stay live while open; the caller's build() reads ctx.HUMAN per draw
  if (session.onChange) session.onChange(() => { if (!panel.classList.contains('hidden')) draw(); });

  return { open, close, toggle, btn, panel, isOpen: () => !panel.classList.contains('hidden') };
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
