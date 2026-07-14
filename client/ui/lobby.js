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

const GAMEID_KEY = 'retromulticiv-gameid';

function wsUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

function persistAndBoot(msg) {
  const spectator = msg.playerId === 'spectator'; // A17: tokenless viewer
  try {
    localStorage.setItem(GAMEID_KEY, msg.gameId);
    if (!spectator) localStorage.setItem('retromulticiv-token-' + msg.gameId, msg.token);
  } catch (e) { /* private mode: the reload join will bind a fresh seat */ }
  location.search = `?server=1&game=${msg.gameId}` + (spectator ? '&spectate=1' : '');
}

// One shared little message pump: onMsg returns nothing; onDead runs when the
// socket closes/errors while we still expected it (pre-boot).
function openLobbySocket(onMsg, onDead) {
  const ws = new WebSocket(wsUrl());
  let booted = false;
  ws.addEventListener('message', ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.t === 'joined') { booted = true; persistAndBoot(msg); return; }
    onMsg(msg, ws);
  });
  ws.addEventListener('close', () => { if (!booted) onDead(); });
  ws.addEventListener('error', () => { if (!booted) onDead(); });
  return ws;
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
    ${hostCtl ? `<p class="setup-hint">slots: <button id="slot-minus" class="setup-lan-btn">−</button>
      <span id="slot-count"></span> <button id="slot-plus" class="setup-lan-btn">+</button>
      · <label id="lobby-chat-toggle">chat <input id="lobby-chat-on" type="checkbox"></label></p>` : ''}
    <div id="lobby-roster"></div>
    <div id="lobby-chat" class="hidden">
      <div id="lobby-chat-log"></div>
      <div id="lobby-chat-row">
        <input id="lobby-chat-text" type="text" maxlength="200" placeholder="say something…">
        <button id="lobby-chat-send" class="setup-lan-btn">send</button>
      </div>
    </div>
    <p class="setup-hint" id="lobby-status">${hostCtl
      ? 'start when everyone is seated — open seats become AI'
      : 'waiting for the host to start…'}</p>
    ${hostCtl ? '<button id="setup-start">Start game</button>' : ''}
    <p class="setup-hint"><a href="./">← back (leaves your seat)</a></p>`;
  if (hostCtl) {
    document.getElementById('setup-start').addEventListener('click', onStart);
    document.getElementById('slot-minus').addEventListener('click',
      () => hostCtl.send({ t: 'setSlots', civs: hostCtl.count - 1 }));
    document.getElementById('slot-plus').addEventListener('click',
      () => hostCtl.send({ t: 'setSlots', civs: hostCtl.count + 1 }));
    document.getElementById('lobby-chat-on').addEventListener('change',
      e => hostCtl.send({ t: 'setChat', on: e.target.checked }));
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
  syncChatPanel(info.lobby, hostCtl);
  updateRoster(info.lobby, info.seat, hostCtl);
}

// A37: the chat panel follows the host's live toggle (roster options.chat)
function syncChatPanel(lobby, hostCtl) {
  const panel = document.getElementById('lobby-chat');
  if (!panel || !lobby) return;
  const on = !lobby.options || lobby.options.chat !== false;
  panel.classList.toggle('hidden', !on);
  const box = document.getElementById('lobby-chat-on');
  if (box) box.checked = on;
}

function appendChat(msg) {
  const log = document.getElementById('lobby-chat-log');
  if (!log) return;
  const line = document.createElement('div');
  line.textContent = `${msg.name}: ${msg.text}`; // textContent = XSS-inert
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
    if (new URLSearchParams(location.search).get('e2ekick') === '1') {
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
        fail(box, msg.code === 'seatReserved'
          ? 'that seat is taken — they can leave, or pick another slot for the AI'
          : msg.code === 'civTaken' ? 'another slot already has that civilization'
          : msg.code === 'mapTooSmall' // A38: measured seats-per-size table
            ? `a ${msg.size} map seats up to ${msg.maxCivs} civilizations — pick a bigger map or fewer civs`
          : `server rejected: ${msg.code}`);
      }
    }, () => fail(box, 'no game server — start it with: node server/index.js'));
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'create', name, options })));
  }
  if (auto) { create(flags.name || 'Host'); return; }
  // A27 (d): size + starting age live ON the host form — hosting shouldn't
  // require the setup-screen detour (they default from whatever it passed)
  const SIZES = ['xsmall', 'small', 'medium', 'large', 'xlarge', 'huge'];
  const AGES = ['ancient', 'renaissance', 'industrial', 'modern', 'space'];
  box.innerHTML = `
    <h2>Host a LAN game</h2>
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
    <p class="setup-hint">spectators see the whole map — admit people you'd
      let stand behind your chair</p>
    <label>Enable lobby chat <input id="lobby-allow-chat" type="checkbox" checked></label>
    <button id="setup-start">Create game</button>
    <p class="setup-hint"><a href="./">← back</a></p>`;
  document.getElementById('setup-start').addEventListener('click', () => {
    options.allowSpectators = document.getElementById('lobby-allow-spec').checked;
    options.chat = document.getElementById('lobby-allow-chat').checked; // A37
    options.size = document.getElementById('lobby-size').value;
    options.age = document.getElementById('lobby-age').value;
    create(document.getElementById('lobby-name').value.trim() || 'Player 1');
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
  const ws = openLobbySocket((msg, sock) => {
    if (msg.t === 'joinedLobby') {
      mySeat = msg.seat;
      renderWaitingRoom(box, msg, null, null, frame => sock.send(JSON.stringify(frame)));
    } else if (msg.t === 'lobby') { syncChatPanel(msg.lobby, null); updateRoster(msg.lobby, mySeat, null); }
    else if (msg.t === 'chat') appendChat(msg);
    else if (msg.t === 'kicked') showKicked(box);
    else if (msg.t === 'rejected') fail(box, `server rejected: ${msg.code}`);
  }, () => fail(box, 'no game server'));
  ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'join', joinCode: code, name: name || 'Joiner' })));
}

// Join: by code, with an optional seat pick (falls back to first free).
export function startJoinFlow(box) {
  box.innerHTML = `
    <h2>Join a LAN game</h2>
    <label>Your name <input id="lobby-name" type="text" maxlength="24" value="Player 2"></label>
    <label>Join code <input id="lobby-code-in" type="text" maxlength="5" placeholder="Q7F2M"></label>
    <label>Seat
      <select id="lobby-seat"><option value="">auto</option>
        ${Array.from({ length: 14 }, (_, i) => `<option value="p${i + 1}">p${i + 1}</option>`).join('')}
      </select>
    </label>
    <label>Spectate <input id="lobby-spectate" type="checkbox"></label>
    <p class="setup-hint">spectators see everything and control nothing —
      only works when the host allowed it</p>
    <button id="setup-start">Join</button>
    <p class="setup-hint" id="lobby-status"></p>
    <p class="setup-hint"><a href="./">← back</a></p>`;
  document.getElementById('setup-start').addEventListener('click', () => {
    const name = document.getElementById('lobby-name').value.trim() || 'Player';
    const code = document.getElementById('lobby-code-in').value.trim().toUpperCase();
    const seat = document.getElementById('lobby-seat').value || undefined;
    const spectate = document.getElementById('lobby-spectate').checked || undefined;
    if (code.length !== 5) { fail(box, 'a join code is 5 characters'); return; }
    let mySeat = null;
    const ws = openLobbySocket((msg, sock) => {
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
        fail(box, msg.code === 'noSuchGame' ? 'no game with that code'
          : msg.code === 'gameFull' ? 'that game is full'
          : msg.code === 'alreadyStarted' ? 'that game already started — ask for the save/token'
          : msg.code === 'spectatorsOff' ? 'this game does not allow spectators'
          : msg.code === 'notStarted' ? 'spectating starts once the game does — try again after the host starts'
          : msg.code === 'blocked' ? 'the host has blocked you from this game' // A37
          : `server rejected: ${msg.code}`);
      }
    }, () => fail(box, 'no game server — start it with: node server/index.js'));
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'join', joinCode: code, name, seat, spectator: spectate })));
  });
}
