// L5: the MOBILE DEBUG OVERLAY (?mlog=1) — a phone has no console, so this
// on-screen scrollable overlay lets it self-report: boot-progress marks,
// captured errors, and ws frame types in/out. Client-only, any server mode.
// The param is captured at MODULE EVAL (the A45 trap) and the buffer starts
// collecting from first import, so early boot marks are never lost — the
// overlay DOM attaches lazily once <body> exists.
const ENABLED = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('mlog') === '1';

const buffer = [];
let listEl = null;

function stamp() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    + `.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function render(line) {
  if (!listEl) return;
  const row = document.createElement('div');
  row.textContent = line;
  listEl.appendChild(row);
  while (listEl.childNodes.length > 300) listEl.removeChild(listEl.firstChild);
  listEl.scrollTop = listEl.scrollHeight;
}

// the one logging entry point — safe to call whether or not ?mlog=1 is on
export function mlog(kind, detail) {
  if (!ENABLED) return;
  const line = `${stamp()} ${kind}${detail !== undefined ? ' ' + detail : ''}`;
  buffer.push(line);
  if (buffer.length > 300) buffer.shift();
  render(line);
}

export function mlogEnabled() { return ENABLED; }

function attach() {
  if (!ENABLED || listEl || typeof document === 'undefined' || !document.body) return;
  const panel = document.createElement('div');
  panel.id = 'mlog';
  panel.innerHTML = '<div id="mlog-head">📱 mlog <button id="mlog-clear">clear</button></div><div id="mlog-list"></div>';
  document.body.appendChild(panel);
  listEl = panel.querySelector('#mlog-list');
  panel.querySelector('#mlog-clear').addEventListener('click', () => { listEl.textContent = ''; });
  for (const line of buffer) render(line);
  // errors reach the overlay even when the page's own capture misses them
  window.addEventListener('error', e => mlog('ERROR', `${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', e => mlog('REJECT', String(e.reason)));
}

if (ENABLED && typeof document !== 'undefined') {
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach);
  mlog('boot', 'mlog armed');
}
