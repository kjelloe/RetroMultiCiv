// Phase-4 lobby flows (docs/08 §2, boot path per mail @704be920): a PRE-BOOT
// handshake that runs inside the setup screen's box, on its OWN WebSocket —
// create / join-by-code / waiting room / start. When the server starts the
// game it pushes the phase-3 {joined} (token + gameId) down this same socket;
// we persist both into the exact localStorage keys session-remote reads and
// reload into ?server=1&game=<gameId> — the game then boots through the
// UNCHANGED remote session, which reconnects onto the already-BOUND seat
// (closing this lobby socket releases nothing post-start; releaseSeat only
// fires while the entry is still a lobby).
//
// KNOWN LIMIT (accepted for phase 4, @704be920): retromulticiv-gameid is one
// slot — one concurrent server game per browser origin; joining a second game
// re-points the slot at it.

import { shouldReconnect, reconnectFrame, backoffDelay, wakeIsSuspect } from '../../shared/lobby-reconnect.js';
import { victoryOptions, DEFAULT_VICTORY } from '../../shared/victory-presets.js';
import qrcode from '../vendor/qrcode.min.js';

// join-share: the invite URL a host shares from the lobby — the friend's client
// opens the Join form with the code prefilled (setup.js ?join=).
export function inviteUrl(code) {
  return `${location.origin}/client/?join=${encodeURIComponent(code)}`;
}
// render `text` as a QR into `canvas` (crisp black/white modules, quiet border).
function renderQR(canvas, text, scale = 4) {
  try {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), quiet = 2, size = (n + quiet * 2) * scale;
    canvas.width = size; canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) g.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
    return true;
  } catch (e) { return false; }
}

// join-share "show QR code": a top overlay over the whole menu with a BIG scan
// target, the URL text, close (× / click-outside / Esc), and "open QR in new
// tab" — a same-origin BLOB url (NEVER data: in window.open, a popup/security
// trap). User-TRIGGERED (not auto-shown), so it never sits over the setup/lobby
// during an e2e flow the way the onboarding overlay did.
function showQrOverlay(url) {
  const layer = document.createElement('div');
  layer.id = 'qr-overlay';
  layer.innerHTML = `<div id="qr-card">
    <canvas id="qr-big" aria-label="scan to join this game"></canvas>
    <div id="qr-url"></div>
    <div id="qr-btnrow">
      <button id="qr-open" class="setup-lan-btn">↗ Open QR in new tab</button>
      <button id="qr-close" class="setup-lan-btn">✕ Close</button>
    </div></div>`;
  document.body.appendChild(layer);
  layer.querySelector('#qr-url').textContent = url;
  renderQR(layer.querySelector('#qr-big'), url, 8); // big scan target
  function close() { document.removeEventListener('keydown', onKey, true); layer.remove(); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } }
  layer.addEventListener('click', e => { if (e.target === layer) close(); }); // click OUTSIDE the card
  layer.querySelector('#qr-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  layer.querySelector('#qr-open').addEventListener('click', () => {
    layer.querySelector('#qr-big').toBlob(blob => {
      if (blob) window.open(URL.createObjectURL(blob), '_blank'); // same-origin blob, not data:
    });
  });
}

const GAMEID_KEY = 'retromulticiv-gameid';

// A51c: the master-index URL — ?master= captured at MODULE EVAL (the A45
// trap: main.js canonicalizes the URL after boot, a lazy read would miss it)
// and persisted, so "configured" survives reloads. Clearable by ?master=off.
const MASTER_KEY = 'retromulticiv-master';
// The well-known public master index (user DNS record 2026-07-22) — the
// QuakeWorld pattern's whole point: Find game works out of the box. ?master=
// overrides it (persisted), ?master=off disables it (persisted as 'off' so
// the default does not resurrect on reload).
const DEFAULT_MASTER = 'https://servers.multiciv.kjell.today';

// late-join §2: describe a listed game row from the server's contract fields
// (state/turn/era/joinable — additive over the old `status`). PURE + exported so
// the row rendering is unit-tested without a live server; falls back to the old
// status shape when a pre-late-join server omits the new fields.
const ERA_NAME = { ancient: 'Ancient', classicalMedieval: 'Medieval', industrial: 'Industrial', modernSpace: 'Modern' };
// late-join §4: the contract `serverFull` message — the user's three options.
const SERVER_FULL_MSG = 'This server is full of active games — wait for a slot, find another server, or join an ongoing game from Find game.';
export function describeGameRow(g) {
  const state = g.state || (g.status === 'lobby' ? 'open' : 'running');
  const who = `${g.hostName}'s game`;
  if (state === 'open') {
    return { text: `${who} · ${g.openSeats}/${g.totalSeats} seats open · ${g.size} · ${g.age}`, action: 'join' };
  }
  const turn = g.turn !== undefined ? ` · turn ${g.turn}` : '';
  if (state === 'paused') {
    return { text: `${who} · paused${turn}`, action: g.joinable ? 'takeover' : 'spectate' };
  }
  const era = g.era ? ` · ${ERA_NAME[g.era] || g.era}` : ''; // running / in progress
  return { text: `${who} · in progress${turn}${era}`, action: g.joinable ? 'takeover' : 'spectate' };
}

const MASTER_PARAM = new URLSearchParams(location.search).get('master');
if (MASTER_PARAM) { try { localStorage.setItem(MASTER_KEY, MASTER_PARAM); } catch (e) { /* private mode */ } }
function masterUrl() {
  let v = MASTER_PARAM;
  if (!v) { try { v = localStorage.getItem(MASTER_KEY); } catch (e) { v = null; } }
  if (v === 'off') return null;
  return v || DEFAULT_MASTER;
}
// A51c: a picked GLOBAL server's ws base; null = this page's own host. The
// lobby socket AND the post-join game boot both honor it — main.js already
// accepts a full ws URL in ?server= (phase-3), so the reload carries it.
let joinOrigin = null;

function wsUrl() {
  return joinOrigin || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

function persistAndBoot(msg) {
  const spectator = msg.playerId === 'spectator'; // A17: tokenless viewer
  try {
    localStorage.setItem(GAMEID_KEY, msg.gameId);
    if (!spectator) localStorage.setItem('retromulticiv-token-' + msg.gameId, msg.token);
  } catch (e) { /* private mode: the reload join will bind a fresh seat */ }
  // A51c: a global pick boots against THAT host's ws origin (main.js's
  // ?server=<url> path); a local join keeps the plain server=1 form.
  // L5: carry ?mlog=1 through the reload — a phone diagnosing the lobby→start
  // boot needs the on-screen log to survive into the game, not die at the reload.
  const mlogOn = new URLSearchParams(location.search).get('mlog') === '1'; // a45-ok: boot/lobby read
  location.search = `?server=${joinOrigin ? encodeURIComponent(joinOrigin) : '1'}&game=${msg.gameId}`
    + (spectator ? '&spectate=1' : '')
    + (mlogOn ? '&mlog=1' : '');
}

// L8 (the L5 root cause's client half): a lobby connection whose SEAT was
// released pre-start (phone slept, socket died, the live[pid] rule seated an
// AI) still receives the {t:'started'} broadcast but never a 'joined' — the
// old pump ignored 'started' and the lobby DOM went stale forever. Now it
// gets the truth and its options.
function showMissedStart(box, gameId) {
  if (!box) return;
  box.innerHTML = `<h2>Game lobby</h2>
    <p class="setup-hint">⚠ the game started WITHOUT your seat — your connection
      dropped in the lobby (a sleeping phone releases its seat), so an AI took it.</p>
    <p class="setup-hint">rejoin from the join screen with your seat code (if the
      game showed you one), or watch as a spectator:</p>
    <button id="lobby-miss-spectate" class="setup-lan-btn">👁 Spectate</button>
    <button id="lobby-miss-join" class="setup-lan-btn">↩ Join screen</button>
    <p class="setup-hint"><a href="./">← back to setup</a></p>`;
  const spec = document.getElementById('lobby-miss-spectate');
  if (spec) spec.addEventListener('click', () => {
    location.search = `?server=${joinOrigin ? encodeURIComponent(joinOrigin) : '1'}&game=${gameId}&spectate=1`;
  });
  const join = document.getElementById('lobby-miss-join');
  if (join) join.addEventListener('click', () => startJoinFlow(box));
}

// L8: a transient system line in the lobby chat log (falls back to the
// status line) — chat rejections and other in-lobby refusals surface here
// instead of nuking the waiting room (the chatting-alone illusion killer).
function lobbyNotice(text) {
  const log = document.getElementById('lobby-chat-log');
  if (log) {
    const line = document.createElement('div');
    line.className = 'lobby-notice';
    line.textContent = `⚠ ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    return true;
  }
  const st = document.getElementById('lobby-status');
  if (st) { st.textContent = `⚠ ${text}`; return true; }
  return false;
}

function rejectText(code) {
  return code === 'chatOff' ? 'chat is switched off in this lobby'
    : code === 'tooFast' ? 'chat rate limit — slow down a little'
    : code === 'noLobby' ? 'the server no longer sees your lobby seat — your message did not send'
    : `server rejected: ${code}`;
}

// One shared little message pump: onMsg returns nothing; onDead runs when the
// socket closes/errors while we still expected it (pre-boot). L8: 'started'
// without a 'joined' = the missed-seat screen, centrally for every flow.
//
// Part C (mobile-resilience.md) — WAKE-RECONNECT: pass `joinFrameFn` (a thunk
// returning the join/joinListed frame) to make a SEAT-holding socket survive a
// screen-lock. The pump captures the reconnectId the server issues at
// joinedLobby (Part B); when the socket drops OR wakes suspect (hidden long,
// still-OPEN = the half-open shape), it re-establishes and re-sends the frame
// carrying `lobbyReconnect`, silently reclaiming the grace-held seat. Backoff +
// cap; past the cap (or with no seat/id) it falls through to the L8 truth
// screen exactly as before. Query sockets (no joinFrameFn) keep the old
// behavior: send on their own 'open' handler, wake→dead, no reconnect.
function openLobbySocket(onMsg, onDead, joinFrameFn) {
  const canReconnect = typeof joinFrameFn === 'function';
  let ws = null;
  let booted = false;
  let deadShown = false;
  let everOpened = false;
  let reconnectId = null;
  let attempts = 0;   // reconnect tries since the last healthy reply
  let pending = false; // a reconnect timer is queued
  let hiddenAt = 0;    // when the tab last went hidden (0 = visible)

  function dead() {
    if (booted || deadShown) return;
    deadShown = true;
    onDead(everOpened);
  }

  function drop() {
    if (booted || deadShown || pending) return;
    if (shouldReconnect({ canReconnect, reconnectId, booted, deadShown, attempts })) {
      pending = true;
      attempts += 1;
      const delay = backoffDelay(attempts);
      setTimeout(() => { pending = false; if (!booted && !deadShown) connect(); }, delay);
    } else {
      dead();
    }
  }

  function connect() {
    const sock = new WebSocket(wsUrl());
    ws = sock;
    sock.addEventListener('open', () => {
      if (sock !== ws) return; // a superseded socket
      everOpened = true;
      if (canReconnect) {
        const base = joinFrameFn();
        const frame = reconnectId ? reconnectFrame(base, reconnectId) : base;
        try { sock.send(JSON.stringify(frame)); } catch (e) { /* races the close */ }
      }
    });
    sock.addEventListener('message', ev => {
      if (sock !== ws) return;
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.reconnectId) reconnectId = msg.reconnectId; // Part B reclaim secret
      attempts = 0; // a live reply = a healthy link
      if (msg.t === 'joined') { booted = true; persistAndBoot(msg); return; }
      if (msg.t === 'started' && !booted) {
        booted = true; // stop the dead-socket path from overwriting the message
        showMissedStart(document.getElementById('setup-box'), msg.gameId);
        return;
      }
      onMsg(msg, sock);
    });
    const onClose = () => { if (sock === ws) drop(); };
    sock.addEventListener('close', onClose);
    sock.addEventListener('error', onClose);
    return sock;
  }

  const wake = () => {
    if (document.visibilityState !== 'visible' || booted || deadShown) return;
    const suspect = wakeIsSuspect(hiddenAt, Date.now());
    hiddenAt = 0;
    if (ws && ws.readyState >= WebSocket.CLOSING) { drop(); return; } // the OS killed it
    // half-open defense: an OPEN socket that slept long is suspect — tear it
    // down and reconnect (reclaim is idempotent within the server's grace)
    if (canReconnect && reconnectId && suspect && ws && ws.readyState === WebSocket.OPEN) {
      try { ws.close(); } catch (e) { /* ignore */ }
      drop();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else wake();
  });
  window.addEventListener('pageshow', wake);
  return connect();
}

// civ names for the host's per-slot dropdowns (fetched once, cached)
let civsPromise = null;
function loadCivs() {
  if (!civsPromise) civsPromise = fetch('../data/civs.json').then(r => r.json()).catch(() => ({}));
  return civsPromise;
}

function seatLine(s, mySeat, civs) {
  const civTag = s.civ && civs && civs[s.civ] ? ` · ${civs[s.civ].name}` : '';
  if (!s.human) return `<span class="lobby-ai">${s.seat} · AI${civTag}</span>`;
  if (!s.reserved) return `<span class="lobby-open">${s.seat} · — open —${civTag}</span>`;
  const you = s.seat === mySeat ? ' (you)' : '';
  return `<b>${s.seat} · ${s.name}${you}</b>${civTag}`;
}

function renderWaitingRoom(box, info, hostCtl, onStart, sendFn) {
  box.innerHTML = `
    <h2>Game lobby</h2>
    <p class="setup-hint">join code — tell your friends:</p>
    <p id="lobby-code">${info.joinCode}</p>
    <div id="lobby-share">
      <canvas id="lobby-qr" aria-label="scan to join this game"></canvas>
      <div id="lobby-share-row">
        <input id="lobby-invite" type="text" readonly value="${inviteUrl(info.joinCode)}">
        <button id="lobby-copy" class="setup-lan-btn">📋 Copy</button>
      </div>
      <p class="setup-hint">scan the code (tap it to enlarge), or copy the link — friends on your network join straight in</p>
    </div>
    ${hostCtl ? `<p class="setup-hint">slots: <button id="slot-minus" class="setup-lan-btn">−</button>
      <span id="slot-count"></span> <button id="slot-plus" class="setup-lan-btn">+</button>
      · <label id="lobby-chat-toggle">chat <input id="lobby-chat-on" type="checkbox"></label>
      · <label id="lobby-joining-toggle" title="while open, joiners fill empty (and AI) seats; while closed, new joins are rejected">joining open <input id="lobby-joining-on" type="checkbox" checked></label></p>` : ''}
    <div id="lobby-roster"></div>
    <div id="lobby-chat" class="hidden">
      <div id="lobby-chat-log"></div>
      <div id="lobby-chat-row">
        <input id="lobby-chat-text" type="text" maxlength="200" placeholder="say something…">
        <button id="lobby-chat-send" class="setup-lan-btn">send</button>
      </div>
    </div>
    <p class="setup-hint hidden" id="lobby-reports">📊 match reports ON — when this game
      finishes, its anonymized recording (players become seat1..N) is saved on the
      host for balance analysis. Any seat may
      <button id="lobby-report-veto" class="setup-lan-btn">not share this game</button></p>
    <p class="setup-hint" id="lobby-status">${hostCtl
      ? 'start when everyone is seated — open seats become AI'
      : 'waiting for the host to start…'}</p>
    ${hostCtl ? '<button id="setup-start">Start game</button>' : ''}
    <p class="setup-hint"><a href="./">← back (leaves your seat)</a></p>`;
  { // join-share: QR + copy-link (everyone in the room can invite)
    const url = inviteUrl(info.joinCode);
    const qrEl = document.getElementById('lobby-qr');
    if (qrEl) {
      renderQR(qrEl, url); // inline thumbnail — click to enlarge (the "show QR code" overlay)
      qrEl.style.cursor = 'zoom-in';
      qrEl.title = 'show a bigger QR code';
      qrEl.addEventListener('click', () => showQrOverlay(url));
    }
    const copyEl = document.getElementById('lobby-copy');
    const invEl = document.getElementById('lobby-invite');
    if (copyEl) copyEl.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); } // https/localhost only
      catch (e) { if (invEl) { invEl.focus(); invEl.select(); } } // http LAN fallback: select for manual copy
      copyEl.textContent = '✓ Copied';
      setTimeout(() => { copyEl.textContent = '📋 Copy'; }, 1500);
    });
  }
  if (hostCtl) {
    document.getElementById('setup-start').addEventListener('click', onStart);
    document.getElementById('slot-minus').addEventListener('click',
      () => hostCtl.send({ t: 'setSlots', civs: hostCtl.count - 1 }));
    document.getElementById('slot-plus').addEventListener('click',
      () => hostCtl.send({ t: 'setSlots', civs: hostCtl.count + 1 }));
    document.getElementById('lobby-chat-on').addEventListener('change',
      e => hostCtl.send({ t: 'setChat', on: e.target.checked }));
    // XVII §3: host toggles whether new players may join (contract: the server
    // sets lobby.joiningOpen and rejects blocked joins with code 'joiningClosed')
    document.getElementById('lobby-joining-on').addEventListener('change',
      e => hostCtl.send({ t: 'setJoining', open: e.target.checked }));
  }
  // A37 chat: send via Enter or the button; incoming lines land through
  // appendChat — textContent only, so payloads render inert (no innerHTML)
  if (sendFn) {
    const text = document.getElementById('lobby-chat-text');
    const submit = () => {
      const t = text.value.trim();
      if (t.length === 0) return;
      sendFn({ t: 'chat', text: t.slice(0, 200) });
      text.value = '';
    };
    document.getElementById('lobby-chat-send').addEventListener('click', submit);
    text.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
  // S1: the veto rides the same lobby socket as chat/start
  const vetoBtn = document.getElementById('lobby-report-veto');
  if (vetoBtn && sendFn) vetoBtn.addEventListener('click', () => sendFn({ t: 'reportVeto' }));
  syncChatPanel(info.lobby, hostCtl);
  updateRoster(info.lobby, info.seat, hostCtl);
}

// S1: the consent notice follows the server's roster flags — shown only when
// the host runs --share-reports; a veto flips it to "not shared" for everyone
function syncReportNotice(lobby) {
  const p = document.getElementById('lobby-reports');
  if (!p || !lobby) return;
  if (lobby.reportVetoed === true) {
    p.classList.remove('hidden');
    p.textContent = '📊 match report NOT shared — a seat declined for this game';
    return;
  }
  p.classList.toggle('hidden', lobby.shareReports !== true);
}

// A37: the chat panel follows the host's live toggle (roster options.chat).
// S1's report notice syncs here too — every lobby-frame site already calls
// this, so the notice tracks live without touching six call sites.
function syncChatPanel(lobby, hostCtl) {
  syncReportNotice(lobby);
  const panel = document.getElementById('lobby-chat');
  if (!panel || !lobby) return;
  const on = !lobby.options || lobby.options.chat !== false;
  panel.classList.toggle('hidden', !on);
  const box = document.getElementById('lobby-chat-on');
  if (box) box.checked = on;
  // XVII §3: reflect the host's joining-open state (default open) on the toggle
  const jbox = document.getElementById('lobby-joining-on');
  if (jbox) jbox.checked = lobby.joiningOpen !== false;
}

function appendChat(msg) {
  const log = document.getElementById('lobby-chat-log');
  if (!log) return;
  const line = document.createElement('div');
  // A52: a local HH:MM timestamp (chat is transient — the time is a client
  // render detail, never sent or stored). textContent keeps it XSS-inert.
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  line.textContent = `[${time}] ${msg.name}: ${msg.text}`;
  log.appendChild(line);
  while (log.children.length > 50) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

// A37: the friendly full-screen for a kicked joiner
function showKicked(box) {
  box.innerHTML = `<h2>Game lobby</h2>
    <p class="setup-hint">⛔ the host removed you from the lobby</p>
    <p class="setup-hint"><a href="./">← back to setup</a></p>`;
}

// A27: the host sees interactive rows (AI↔Open toggle on unreserved slots +
// a civ pick; each civ once, Random = the A24 shuffle at start); joiners see
// the same list read-only, updating live off the lobby broadcasts. Layout
// leaves room for a future per-slot difficulty cell (parked, engine change).
function updateRoster(lobby, mySeat, hostCtl) {
  const el = document.getElementById('lobby-roster');
  if (!el || !lobby) return;
  if (hostCtl) hostCtl.count = lobby.seats.length;
  const countEl = document.getElementById('slot-count');
  if (countEl) countEl.textContent = String(lobby.seats.length);
  loadCivs().then(civs => {
    if (!document.getElementById('lobby-roster')) return; // room closed meanwhile
    const taken = {};
    for (const s of lobby.seats) if (s.civ) taken[s.civ] = s.seat;
    el.textContent = '';
    for (const s of lobby.seats) {
      const row = document.createElement('div');
      row.className = 'lobby-row';
      const label = document.createElement('span');
      label.innerHTML = seatLine(s, mySeat, civs);
      row.appendChild(label);
      if (hostCtl) {
        if (!s.reserved) { // the SILENT flip still never touches occupants
          const toggle = document.createElement('button');
          toggle.className = 'setup-lan-btn';
          toggle.textContent = s.mode === 'ai' ? 'make open' : 'make AI';
          toggle.addEventListener('click', () => hostCtl.send({
            t: 'setSlot', seat: s.seat, mode: s.mode === 'ai' ? 'open' : 'ai'
          }));
          row.appendChild(toggle);
        }
        if (s.reserved && s.seat !== mySeat) {
          // A37 (supersedes @3b520ebc by user decision): kicking is an
          // EXPLICIT host action with an inline confirm — never silent
          if (s.ip) row.title = `connection: ${s.ip}`; // host-only hover identity
          const kick = document.createElement('button');
          kick.className = 'setup-lan-btn lobby-kick';
          kick.textContent = '⛔';
          kick.title = `remove ${s.name} from the lobby`;
          kick.addEventListener('click', () => {
            kick.replaceWith(...(() => {
              const confirmK = document.createElement('button');
              confirmK.className = 'setup-lan-btn lobby-kick';
              confirmK.textContent = `kick ${s.name}`;
              confirmK.addEventListener('click', () => hostCtl.send({ t: 'kick', seat: s.seat }));
              const confirmB = document.createElement('button');
              confirmB.className = 'setup-lan-btn lobby-kick';
              confirmB.textContent = '+ block';
              confirmB.title = 'kick and block their address from this game';
              confirmB.addEventListener('click', () => hostCtl.send({ t: 'kick', seat: s.seat, block: true }));
              const cancel = document.createElement('button');
              cancel.className = 'setup-lan-btn';
              cancel.textContent = '✕';
              cancel.addEventListener('click', () => updateRoster(lobby, mySeat, hostCtl));
              return [confirmK, confirmB, cancel];
            })());
          });
          row.appendChild(kick);
        }
        const pick = document.createElement('select');
        const rnd = document.createElement('option');
        rnd.value = '';
        rnd.textContent = 'Random';
        pick.appendChild(rnd);
        for (const id of Object.keys(civs).sort()) {
          if (taken[id] && taken[id] !== s.seat) continue; // each civ once
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = civs[id].name;
          if (s.civ === id) opt.selected = true;
          pick.appendChild(opt);
        }
        pick.addEventListener('change',
          () => hostCtl.send({ t: 'setSlot', seat: s.seat, civ: pick.value }));
        row.appendChild(pick);
      }
      el.appendChild(row);
    }
    // ?e2ekick=1 (A37 screenshots): open the first kick confirm deterministically
    if (new URLSearchParams(location.search).get('e2ekick') === '1') { // a45-ok: e2e boot hook
      const b = el.querySelector('.lobby-kick');
      if (b) b.click();
    }
  });
}

function fail(box, text) {
  const st = document.getElementById('lobby-status');
  if (st) { st.textContent = `✗ ${text}`; return; }
  box.innerHTML = `<h2>Game lobby</h2><p class="setup-hint">✗ ${text}</p>
    <p class="setup-hint"><a href="./">← back to setup</a></p>`;
}

// Host: create with the setup form's world options. auto/hold drive the e2e.
export function startHostFlow(box, options, flags) {
  const auto = flags && flags.auto;
  function create(name) {
    box.innerHTML = '<h2>Game lobby</h2><p class="setup-hint">creating game…</p>';
    let mySeat = null;
    const hostCtl = { count: 2, send: null }; // A27: roster controls post via the lobby ws
    const ws = openLobbySocket((msg, sock) => {
      if (msg.t === 'created') {
        mySeat = msg.seat;
        hostCtl.send = frame => sock.send(JSON.stringify(frame));
        renderWaitingRoom(box, msg, hostCtl,
          () => sock.send(JSON.stringify({ t: 'start' })), hostCtl.send);
        if (auto && flags && flags.chat) { // A37 XSS e2e: echo a chat payload
          hostCtl.send({ t: 'chat', text: flags.chat });
        }
        if (auto && !(flags && flags.hold)) sock.send(JSON.stringify({ t: 'start' }));
      } else if (msg.t === 'lobby') {
        syncChatPanel(msg.lobby, hostCtl);
        updateRoster(msg.lobby, mySeat, hostCtl);
      } else if (msg.t === 'chat') {
        appendChat(msg);
      } else if (msg.t === 'rejected') {
        if ((msg.code === 'chatOff' || msg.code === 'tooFast' || msg.code === 'noLobby')
            && lobbyNotice(rejectText(msg.code))) return; // L8: in-lobby refusals land where the user looks
        fail(box, msg.code === 'seatReserved'
          ? 'that seat is taken — they can leave, or pick another slot for the AI'
          : msg.code === 'civTaken' ? 'another slot already has that civilization'
          : msg.code === 'mapTooSmall' // A38: measured seats-per-size table
            ? `a ${msg.size} map seats up to ${msg.maxCivs} civilizations — pick a bigger map or fewer civs`
          : (msg.code === 'serverFull' || msg.code === 'tooManyGames') ? SERVER_FULL_MSG // late-join §4/§6
          : `server rejected: ${msg.code}`);
      }
    }, opened => fail(box, opened
      ? 'lobby connection lost (a sleeping phone drops its seat) — reload to rejoin'
      : 'no game server — start it with: node server/index.js'));
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'create', name, options })));
  }
  if (auto) { create(flags.name || 'Host'); return; }
  // A27 (d): size + starting age live ON the host form — hosting shouldn't
  // require the setup-screen detour (they default from whatever it passed)
  const SIZES = ['xsmall', 'small', 'medium', 'large', 'xlarge', 'huge'];
  const AGES = ['ancient', 'renaissance', 'industrial', 'modern', 'space'];
  // L1: wrapped-label rows — the A53 two-column grid the START PAGE uses
  // styles them for free; the interleaved hints move below the rows so the
  // grid scans cleanly. L2: "Resume game" TOGGLES the panel — the new-game
  // options hide and the code entry takes over (save LISTINGS only ever
  // arrive under the server's --debug; the server gates listSaves). The code
  // INPUT is lobby-code-INPUT — #lobby-code is the waiting room's 30px code
  // display and the shared id was leaking that font onto the input.
  box.innerHTML = `
    <h2>Host a LAN game</h2>
    <div id="lobby-newgame">
      <p class="setup-hint">world options — slots and civs come next, in the lobby</p>
      <label>Your name <input id="lobby-name" type="text" maxlength="24" value="Player 1"></label>
      <label>Map size
        <select id="lobby-size">${SIZES.map(s =>
          `<option value="${s}"${s === options.size ? ' selected' : ''}>${s}</option>`).join('')}</select>
      </label>
      <label>Starting age
        <select id="lobby-age">${AGES.map(a =>
          `<option value="${a}"${a === options.age ? ' selected' : ''}>${a}</option>`).join('')}</select>
      </label>
      <label>Allow spectators <input id="lobby-allow-spec" type="checkbox"></label>
      <label>Enable lobby chat <input id="lobby-allow-chat" type="checkbox" checked></label>
      <label>List publicly <input id="lobby-public" type="checkbox"></label>
      <label title="when listed publicly, newcomers can join a game already in progress by taking over an AI civilization (only when this AND List publicly are on)">Late joining <input id="lobby-late-join" type="checkbox" checked></label>
      <label title="a dropped or idle player's seat is handed to the AI so the game never stalls; off = their turn is auto-skipped instead">Auto AI takeover <input id="lobby-auto-takeover" type="checkbox" checked></label>
      <label title="how the game can be won and when it ends">Victory conditions
        <select id="lobby-victory">
          ${victoryOptions().map(o => `<option value="${o.id}"${o.id === DEFAULT_VICTORY ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
      <p class="setup-hint">spectators see the whole map — admit people you'd
        let stand behind your chair; listed games appear on everyone's
        Browse screen, no code needed (both off by default)</p>
      <button id="setup-start">Create game</button>
      <button id="lobby-resume-toggle" class="setup-lan-btn">Resume game</button>
    </div>
    <div id="lobby-resumeview" class="hidden">
      <p class="setup-hint">resume a saved game by its game code (the code your
        save shows; knowing it is the permission — players re-pick their
        seats by name)</p>
      <label>Game code <input id="lobby-code-input" type="text" maxlength="20"
        placeholder="e.g. ABCD-EFGH-JKLMN"></label>
      <button id="lobby-code-btn">Validate and start</button>
      <button id="lobby-resume-back" class="setup-lan-btn">← new game</button>
      <div id="lobby-resume" class="hidden">
        <p class="setup-hint">— saves on this host (--debug only) —</p>
        <div id="lobby-saves"></div>
      </div>
    </div>
    <p class="setup-hint"><a href="./">← back</a> · <a href="host-guide.html" target="_blank" rel="noopener">Hosting guide ↗</a></p>`;
  const newView = document.getElementById('lobby-newgame');
  const resumeView = document.getElementById('lobby-resumeview');
  document.getElementById('lobby-resume-toggle').addEventListener('click', () => {
    newView.classList.add('hidden');
    resumeView.classList.remove('hidden');
  });
  document.getElementById('lobby-resume-back').addEventListener('click', () => {
    resumeView.classList.add('hidden');
    newView.classList.remove('hidden');
  });
  document.getElementById('setup-start').addEventListener('click', () => {
    options.allowSpectators = document.getElementById('lobby-allow-spec').checked;
    options.chat = document.getElementById('lobby-allow-chat').checked; // A37
    options.public = document.getElementById('lobby-public').checked;   // A41
    options.lateJoining = document.getElementById('lobby-late-join').checked; // late-join §1 (pairs with public)
    options.autoTakeover = document.getElementById('lobby-auto-takeover').checked; // XIV §30
    options.victory = document.getElementById('lobby-victory').value; // victory-conditions preset
    options.size = document.getElementById('lobby-size').value;
    options.age = document.getElementById('lobby-age').value;
    create(document.getElementById('lobby-name').value.trim() || 'Player 1');
  });
  // A34: the host machine's saves, newest first — resume loads it on the
  // server (seats reset) and this connection joins it straight away
  const savesWs = openLobbySocket((msg, sock) => {
    if (msg.t === 'saves' && msg.saves.length > 0) {
      const host = document.getElementById('lobby-saves');
      if (!host) return;
      document.getElementById('lobby-resume').classList.remove('hidden');
      for (const s of msg.saves.slice(0, 8)) {
        const row = document.createElement('div');
        row.className = 'lobby-row lobby-save';
        const year = s.year < 0 ? `${-s.year} BC` : `${s.year} AD`;
        const who = s.players.filter(p => p.human).map(p => p.name).join(', ');
        const label = document.createElement('span');
        label.textContent = `turn ${s.turn} · ${year} · ${who || 'all AI'}`
          + (s.code ? ` · code ${s.code}` : '') // pre-docs/07 saves carry none
          + (s.loaded ? ' · live' : '');
        row.appendChild(label);
        const btn = document.createElement('button');
        btn.className = 'setup-lan-btn';
        btn.textContent = s.loaded ? 'join' : 'resume';
        btn.addEventListener('click', () => sock.send(JSON.stringify({ t: 'resume', file: s.file })));
        row.appendChild(btn);
        host.appendChild(row);
      }
    } else if (msg.t === 'resumed') {
      // the join boots the game via the shared {t:'joined'} path
      sock.send(JSON.stringify({
        t: 'join', joinCode: msg.gameId,
        name: document.getElementById('lobby-name').value.trim() || 'Player 1'
      }));
    } else if (msg.t === 'rejected') {
      fail(box, msg.code === 'noSuchSave' ? 'that save is gone from saves/'
        : msg.code === 'badSave' ? 'that file is not a server save'
        : msg.code === 'noSuchCode' ? 'no saved game on this server has that code'
        : msg.code === 'noCode' ? 'enter a game code first'
        : `server rejected: ${msg.code}`);
    }
  }, () => { /* no server: the Create click surfaces the real error */ });
  savesWs.addEventListener('open', () => savesWs.send(JSON.stringify({ t: 'listSaves' })));
  // A98: resume by the docs/07 game code — the same savesWs handles the
  // {t:'resumed'} reply (shared with the A34 pick-a-save flow above)
  document.getElementById('lobby-code-btn').addEventListener('click', () => {
    if (savesWs.readyState !== WebSocket.OPEN) { fail(box, 'no game server is running to resume from'); return; }
    const code = document.getElementById('lobby-code-input').value.trim();
    savesWs.send(JSON.stringify({ t: 'resumeByCode', code }));
  });
}

// --- in-game turn flow (docs/08 §3, §4, §6) — server mode only ---------------
// "Your turn" on the hand-back, "waiting for <name>" when the at-turn player
// dropped, and the skip controls: the HOST may skip directly; anyone may
// propose, passing at MORE than 2/3 of connected human seats excluding the
// at-turn player. The server enforces all of it; these are just the buttons.
export function initMultiplayerFlow(ctx) {
  const session = ctx.session;
  const presence = {};   // playerId -> connected (humans only)
  let vote = null;       // { target, yes, needed } while a skip vote is open
  let prevActive = session.state && session.state.activePlayer;

  const el = document.createElement('div');
  el.id = 'mp-status';
  el.className = 'hidden';
  document.body.appendChild(el);

  // the host seat is the FIRST human seat (creator = p1 in lobby games, first
  // human in resumed/boot games) — display heuristic only; the server rejects
  // a non-host skipTurn regardless
  function amHost() {
    const s = session.state;
    const first = s.playerOrder.find(p => s.players[p].human);
    return first === ctx.HUMAN;
  }
  function humanCount() {
    const s = session.state;
    return s.playerOrder.filter(p => s.players[p].human).length;
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    const s = session.state;
    if (!s || s.gameOver) { el.classList.add('hidden'); return; }
    const active = s.activePlayer;
    el.textContent = '';
    if (vote && vote.target === active && ctx.HUMAN !== active) {
      el.append(`⏭ skip ${s.players[active].name}'s turn? ${vote.yes}/${vote.needed} `);
      el.append(button('vote yes', () => session.sendMeta({ t: 'vote', yes: true })));
      el.append(button('vote no', () => session.sendMeta({ t: 'vote', yes: false })));
      el.classList.remove('hidden');
      return;
    }
    if (active !== ctx.HUMAN && s.players[active] && s.players[active].human
        && presence[active] === false) {
      el.append(`⏳ waiting for ${s.players[active].name} (disconnected) `);
      if (amHost()) el.append(button('skip their turn', () => session.sendMeta({ t: 'skipTurn' })));
      else el.append(button('propose skip', () => session.sendMeta({ t: 'proposeSkip' })));
      el.classList.remove('hidden');
      return;
    }
    el.classList.add('hidden');
  }

  session.setMetaHandler(msg => {
    if (msg.t === 'presence') {
      if (msg.all) Object.assign(presence, msg.all);
      else presence[msg.playerId] = msg.connected;
    } else if (msg.t === 'skipVote') {
      vote = { target: msg.target, yes: msg.yes, needed: msg.needed };
    } else if (msg.t === 'turnSkipped') {
      vote = null;
      const p = session.state && session.state.players[msg.playerId];
      ctx.hud.note(`⏭ ${p ? p.name : msg.playerId}'s turn was skipped`);
    } else if (msg.t === 'turn') {
      if (vote && msg.activePlayerId !== vote.target) vote = null;
    }
    render();
  });

  session.onChange(() => {
    const s = session.state;
    if (s && s.activePlayer !== prevActive) {
      // the hand-back moment (docs/08 §3) — only worth a chime with 2+ humans;
      // A25: dismissible + mutable, and the chime obeys the same mute
      if (s.activePlayer === ctx.HUMAN && humanCount() > 1 && !s.gameOver) {
        ctx.hud.turnBanner('🔔 Your turn');
      }
      prevActive = s.activePlayer;
    }
    render();
  });
}

// ?lobbydemo=host|joiner|blocked|kicked (A37 screenshots): render the
// waiting-room states from a CRAFTED roster, no server — the ws pairing is
// fragile under the screenshot tool's virtual time (the known ?server=1
// limitation), and the kick/block BEHAVIOR is integration-tested; these
// shots document the UI. hostCtl.send is a no-op.
export function lobbyDemo(box, kind) {
  if (kind === 'blocked') { fail(box, 'the host has blocked you from this game'); return; }
  if (kind === 'kicked') { showKicked(box); return; }
  const info = {
    joinCode: '20A4N', seat: kind === 'host' ? 'p1' : 'p2',
    lobby: {
      options: { chat: true },
      seats: [
        { seat: 'p1', human: true, mode: 'open', reserved: true, name: 'Kjell', ip: '127.0.0.1' },
        { seat: 'p2', human: true, mode: 'open', reserved: true, name: 'Ada', ip: '192.168.1.7' },
        { seat: 'p3', human: false, mode: 'ai' }
      ]
    }
  };
  const hostCtl = kind === 'host' ? { count: 3, send: () => {} } : null;
  renderWaitingRoom(box, info, hostCtl, () => {}, () => {});
  appendChat({ name: 'Kjell', text: 'welcome to the lobby' });
  appendChat({ name: 'Ada', text: 'hi! ready when you are' });
}

// e2e/screenshots: auto-join a lobby by code without the form (?e2ejoin=CODE)
export function autoJoin(box, code, name) {
  let mySeat = null;
  openLobbySocket((msg, sock) => {
    if (msg.t === 'joinedLobby') {
      mySeat = msg.seat;
      renderWaitingRoom(box, msg, null, null, frame => sock.send(JSON.stringify(frame)));
    } else if (msg.t === 'lobby') { syncChatPanel(msg.lobby, null); updateRoster(msg.lobby, mySeat, null); }
    else if (msg.t === 'chat') appendChat(msg);
    else if (msg.t === 'kicked') showKicked(box);
    else if (msg.t === 'rejected') {
      if ((msg.code === 'chatOff' || msg.code === 'tooFast' || msg.code === 'noLobby')
          && lobbyNotice(rejectText(msg.code))) return; // L8
      fail(box, `server rejected: ${msg.code}`);
    }
  }, opened => fail(box, opened
    ? 'lobby connection lost (a sleeping phone drops its seat) — reload to rejoin'
    : 'no game server'),
    () => ({ t: 'join', joinCode: code, name: name || 'Joiner' }));
}

// Join: by code, with an optional seat pick (falls back to first free).
export function startJoinFlow(box) {
  box.innerHTML = `
    <h2>Join a LAN game</h2>
    <label>Your name <input id="lobby-name" type="text" maxlength="24" value="Player 2"></label>
    <div id="lobby-browse">
      <p class="setup-hint">open games on this server:</p>
      <div id="lobby-browse-list"><span class="setup-hint">looking…</span></div>
    </div>
    <div id="lobby-global" class="hidden">
      <p class="setup-hint">🌍 global servers (master index):</p>
      <div id="lobby-global-list"></div>
      <p class="setup-hint">a listed server is someone's private machine — your
        name and chat go to it; the index checks reachability, nothing more</p>
    </div>
    <label>Join code <input id="lobby-code-in" type="text" maxlength="5" placeholder="Q7F2M"></label>
    <label>Seat
      <select id="lobby-seat"><option value="">auto</option>
        ${Array.from({ length: 14 }, (_, i) => `<option value="p${i + 1}">p${i + 1}</option>`).join('')}
      </select>
    </label>
    <label>Spectate <input id="lobby-spectate" type="checkbox"></label>
    <p class="setup-hint">spectators see everything and control nothing —
      only works when the host allowed it</p>
    <label>Seat code <input id="lobby-seatcode" type="text" maxlength="9" placeholder="XXXX-YYYY"></label>
    <p class="setup-hint">rejoining a STARTED game from another device? enter
      the seat code the game showed you (close the old tab first)</p>
    <button id="setup-start">Join</button>
    <p class="setup-hint" id="lobby-status"></p>
    <p class="setup-hint"><a href="./">← back</a></p>`;
  // A41: browse the server's PUBLIC lobbies — click joins through the same
  // reservation path as a code (seat/spectate picks from the form apply)
  function joinVia(frame) {
    let mySeat = null;
    openLobbySocket((msg, sock) => {
      if (msg.t === 'joinedLobby') {
        mySeat = msg.seat;
        renderWaitingRoom(box, msg, null, null, f => sock.send(JSON.stringify(f)));
      } else if (msg.t === 'lobby') { syncChatPanel(msg.lobby, null); updateRoster(msg.lobby, mySeat, null); }
      else if (msg.t === 'chat') appendChat(msg);
      else if (msg.t === 'kicked') showKicked(box);
      else if (msg.t === 'rejected') {
        if ((msg.code === 'chatOff' || msg.code === 'tooFast' || msg.code === 'noLobby')
            && lobbyNotice(rejectText(msg.code))) return; // L8
        fail(box, (msg.code === 'serverFull' || msg.code === 'tooManyGames') ? SERVER_FULL_MSG // late-join §4
          : msg.code === 'noSuchGame' ? 'no game with that code'
          : msg.code === 'gameFull' ? 'that game is full'
          : msg.code === 'alreadyStarted' ? 'that game already started — ask for the save/token'
          : msg.code === 'spectatorsOff' ? 'this game does not allow spectators'
          : msg.code === 'notStarted' ? 'spectating starts once the game does — try again after the host starts'
          : msg.code === 'joiningClosed' ? 'the host has closed joining' // XVII §3
          : msg.code === 'blocked' ? 'the host has blocked you from this game' // A37
          : msg.code === 'notPublic' ? 'that game is no longer listed' // A41
          : `server rejected: ${msg.code}`);
      }
    }, opened => fail(box, opened
      ? 'lobby connection lost (a sleeping phone drops its seat) — reload to rejoin'
      : 'no game server — start it with: node server/index.js'),
      () => frame); // Part C: re-present this join frame on wake-reconnect
  }
  const browseWs = openLobbySocket((msg) => {
    if (msg.t !== 'openGames') return;
    const list = document.getElementById('lobby-browse-list');
    if (!list) return;
    list.textContent = '';
    if (msg.games.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'setup-hint';
      empty.textContent = 'no public games — ask your host for a code';
      list.appendChild(empty);
      return;
    }
    for (const g of msg.games) {
      const d = describeGameRow(g);
      const row = document.createElement('div');
      row.className = 'lobby-row lobby-save';
      const label = document.createElement('span');
      label.textContent = d.text;
      row.appendChild(label);
      const btn = document.createElement('button');
      btn.className = 'setup-lan-btn';
      btn.textContent = d.action === 'join' ? 'join' : d.action === 'takeover' ? 'Join' : 'spectate';
      const doJoin = () => joinVia({
        t: 'joinListed', gameId: g.gameId,
        name: document.getElementById('lobby-name').value.trim() || 'Player',
        seat: d.action === 'join' ? (document.getElementById('lobby-seat').value || undefined) : undefined,
        spectator: d.action === 'spectate' ? true : undefined
      });
      btn.addEventListener('click', () => {
        if (d.action !== 'takeover') { doJoin(); return; }
        // late-join §4: joining a game IN PROGRESS takes over one of its AI
        // civilizations — confirm first (the server assigns + names the civ
        // deterministically in its join answer; the in-game turnlog shows it).
        if (window.confirm(`Join "${g.hostName}'s game" in progress? You'll take over one of its AI civilizations for the rest of the game.`)) doJoin();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  }, () => { /* no server: the Join click surfaces the real error */ });
  browseWs.addEventListener('open', () => browseWs.send(JSON.stringify({ t: 'listGames' })));

  document.getElementById('setup-start').addEventListener('click', () => {
    const name = document.getElementById('lobby-name').value.trim() || 'Player';
    const code = document.getElementById('lobby-code-in').value.trim().toUpperCase();
    const seat = document.getElementById('lobby-seat').value || undefined;
    const spectate = document.getElementById('lobby-spectate').checked || undefined;
    const seatCode = document.getElementById('lobby-seatcode').value.trim().toUpperCase() || undefined; // A46
    if (code.length !== 5) { fail(box, 'a join code is 5 characters'); return; }
    let mySeat = null;
    openLobbySocket((msg, sock) => {
      if (msg.t === 'joinedLobby') {
        mySeat = msg.seat;
        renderWaitingRoom(box, msg, null, null, frame => sock.send(JSON.stringify(frame)));
      } else if (msg.t === 'lobby') {
        syncChatPanel(msg.lobby, null);
        updateRoster(msg.lobby, mySeat, null);
      } else if (msg.t === 'chat') {
        appendChat(msg);
      } else if (msg.t === 'kicked') {
        showKicked(box); // A37: the friendly removal screen
      } else if (msg.t === 'rejected') {
        if ((msg.code === 'chatOff' || msg.code === 'tooFast' || msg.code === 'noLobby')
            && lobbyNotice(rejectText(msg.code))) return; // L8
        fail(box, (msg.code === 'serverFull' || msg.code === 'tooManyGames') ? SERVER_FULL_MSG // late-join §4
          : msg.code === 'noSuchGame' ? 'no game with that code'
          : msg.code === 'gameFull' ? 'that game is full'
          : msg.code === 'alreadyStarted' ? 'that game already started — rejoin with your seat code'
          : msg.code === 'spectatorsOff' ? 'this game does not allow spectators'
          : msg.code === 'notStarted' ? 'spectating starts once the game does — try again after the host starts'
          : msg.code === 'joiningClosed' ? 'the host has closed joining' // XVII §3
          : msg.code === 'blocked' ? 'the host has blocked you from this game' // A37
          : msg.code === 'badSeatCode' ? 'no seat carries that code — check the XXXX-YYYY the game showed you' // A46
          : msg.code === 'seatOccupied' ? 'that seat is still connected — close its tab first, then retry' // A46
          : `server rejected: ${msg.code}`);
      }
    }, opened => fail(box, opened
      ? 'lobby connection lost (a sleeping phone drops its seat) — reload to rejoin'
      : 'no game server — start it with: node server/index.js'),
      // Part C: the wake-reconnect re-presents this exact join frame; the pump
      // adds lobbyReconnect from the id the server issued at joinedLobby
      () => ({ t: 'join', joinCode: code, name, seat, spectator: spectate, seatCode }));
  });

  initGlobalTab(box); // A51c: the master-index browser (shows only when configured)
}

// ── A51c: the GLOBAL tab (docs/12 §6) ─────────────────────────────────────────
// The find-a-game panel lists the master index's servers when a master URL is
// configured (?master=<url>, persisted). Version-MISMATCHED servers show
// greyed with the checksum hint, never hidden — honesty over curation. A pick
// re-points the whole join flow (lobby socket + game boot) at that host.
const DATA_FILES = ['terrain', 'units', 'techs', 'buildings', 'wonders', 'governments', 'civs', 'rules'];
let myHashesPromise = null;
function clientDataHashes() {
  if (!myHashesPromise) {
    myHashesPromise = import('../../shared/statehash.js').then(async ({ hashState }) => {
      const out = {};
      for (const f of DATA_FILES) {
        out[f] = hashState(await fetch(`../data/${f}.json`).then(r => r.json()));
      }
      return out;
    });
  }
  return myHashesPromise;
}

async function initGlobalTab(box) {
  const master = masterUrl();
  const wrap = document.getElementById('lobby-global');
  const list = document.getElementById('lobby-global-list');
  if (!master || !wrap || !list) return;
  wrap.classList.remove('hidden');
  list.textContent = 'asking the index…';
  let servers, mine;
  try {
    [servers, mine] = await Promise.all([
      fetch(master.replace(/\/$/, '') + '/servers').then(r => r.json()).then(o => o.servers || []),
      clientDataHashes()
    ]);
  } catch (e) {
    list.textContent = 'master index unreachable';
    return;
  }
  list.textContent = '';
  if (joinOrigin) {
    const note = document.createElement('p');
    note.className = 'setup-hint';
    note.id = 'lobby-global-active';
    note.textContent = `browsing a global server — everything above targets it now `;
    const back = document.createElement('button');
    back.className = 'setup-lan-btn';
    back.textContent = '× back to this server';
    back.addEventListener('click', () => { joinOrigin = null; startJoinFlow(box); });
    note.appendChild(back);
    list.appendChild(note);
  }
  if (servers.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'setup-hint';
    empty.textContent = 'no servers listed right now';
    list.appendChild(empty);
    return;
  }
  for (const s of servers) {
    const match = DATA_FILES.every(f => s.dataHashes && s.dataHashes[f] === mine[f]);
    const row = document.createElement('div');
    row.className = 'lobby-row lobby-global-row' + (match ? '' : ' lobby-global-mismatch');
    const label = document.createElement('span');
    label.textContent = `${s.name} · ${s.openGames} open · ${s.ageSeconds}s ago`
      + (match ? '' : ' · ⚠ different rules');
    if (!match) row.title = 'this server runs a different ruleset (data checksums differ) — joining will likely fail';
    row.appendChild(label);
    const btn = document.createElement('button');
    btn.className = 'setup-lan-btn';
    btn.textContent = 'browse';
    btn.addEventListener('click', () => {
      joinOrigin = `ws://${s.host}:${s.port}/ws`;
      startJoinFlow(box); // re-render: the browse list + joins now target the pick
    });
    row.appendChild(btn);
    list.appendChild(row);
  }
}
