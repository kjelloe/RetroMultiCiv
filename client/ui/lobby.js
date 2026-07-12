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
  try {
    localStorage.setItem(GAMEID_KEY, msg.gameId);
    localStorage.setItem('retromulticiv-token-' + msg.gameId, msg.token);
  } catch (e) { /* private mode: the reload join will bind a fresh seat */ }
  location.search = `?server=1&game=${msg.gameId}`;
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

function seatLine(s, mySeat) {
  if (!s.human) return `<span class="lobby-ai">${s.seat} · AI</span>`;
  if (!s.reserved) return `<span class="lobby-open">${s.seat} · — open —</span>`;
  const you = s.seat === mySeat ? ' (you)' : '';
  return `<b>${s.seat} · ${s.name}${you}</b>`;
}

function renderWaitingRoom(box, info, isCreator, onStart) {
  box.innerHTML = `
    <h2>Game lobby</h2>
    <p class="setup-hint">join code — tell your friends:</p>
    <p id="lobby-code">${info.joinCode}</p>
    <div id="lobby-roster"></div>
    <p class="setup-hint" id="lobby-status">${isCreator
      ? 'start when everyone is seated — open seats become AI'
      : 'waiting for the host to start…'}</p>
    ${isCreator ? '<button id="setup-start">Start game</button>' : ''}
    <p class="setup-hint"><a href="./">← back (leaves your seat)</a></p>`;
  if (isCreator) document.getElementById('setup-start').addEventListener('click', onStart);
  updateRoster(info.lobby, info.seat);
}

function updateRoster(lobby, mySeat) {
  const el = document.getElementById('lobby-roster');
  if (el && lobby) el.innerHTML = lobby.seats.map(s => `<div>${seatLine(s, mySeat)}</div>`).join('');
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
    const ws = openLobbySocket((msg, sock) => {
      if (msg.t === 'created') {
        mySeat = msg.seat;
        renderWaitingRoom(box, msg, true, () => sock.send(JSON.stringify({ t: 'start' })));
        if (auto && !(flags && flags.hold)) sock.send(JSON.stringify({ t: 'start' }));
      } else if (msg.t === 'lobby') {
        updateRoster(msg.lobby, mySeat);
      } else if (msg.t === 'rejected') {
        fail(box, `server rejected: ${msg.code}`);
      }
    }, () => fail(box, 'no game server — start it with: node server/index.js'));
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'create', name, options })));
  }
  if (auto) { create(flags.name || 'Host'); return; }
  box.innerHTML = `
    <h2>Host a LAN game</h2>
    <p class="setup-hint">uses the world options you just picked</p>
    <label>Your name <input id="lobby-name" type="text" maxlength="24" value="Player 1"></label>
    <button id="setup-start">Create game</button>
    <p class="setup-hint"><a href="./">← back</a></p>`;
  document.getElementById('setup-start').addEventListener('click',
    () => create(document.getElementById('lobby-name').value.trim() || 'Player 1'));
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
      // the hand-back moment (docs/08 §3) — only worth a chime with 2+ humans
      if (s.activePlayer === ctx.HUMAN && humanCount() > 1 && !s.gameOver) {
        ctx.hud.banner('🔔 Your turn');
      }
      prevActive = s.activePlayer;
    }
    render();
  });
}

// Join: by code, with an optional seat pick (falls back to first free).
export function startJoinFlow(box) {
  box.innerHTML = `
    <h2>Join a LAN game</h2>
    <label>Your name <input id="lobby-name" type="text" maxlength="24" value="Player 2"></label>
    <label>Join code <input id="lobby-code-in" type="text" maxlength="5" placeholder="Q7F2M"></label>
    <label>Seat
      <select id="lobby-seat"><option value="">auto</option>
        ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="p${n}">p${n}</option>`).join('')}
      </select>
    </label>
    <button id="setup-start">Join</button>
    <p class="setup-hint" id="lobby-status"></p>
    <p class="setup-hint"><a href="./">← back</a></p>`;
  document.getElementById('setup-start').addEventListener('click', () => {
    const name = document.getElementById('lobby-name').value.trim() || 'Player';
    const code = document.getElementById('lobby-code-in').value.trim().toUpperCase();
    const seat = document.getElementById('lobby-seat').value || undefined;
    if (code.length !== 5) { fail(box, 'a join code is 5 characters'); return; }
    let mySeat = null;
    const ws = openLobbySocket((msg) => {
      if (msg.t === 'joinedLobby') {
        mySeat = msg.seat;
        renderWaitingRoom(box, msg, false, null);
      } else if (msg.t === 'lobby') {
        updateRoster(msg.lobby, mySeat);
      } else if (msg.t === 'rejected') {
        fail(box, msg.code === 'noSuchGame' ? 'no game with that code'
          : msg.code === 'gameFull' ? 'that game is full'
          : msg.code === 'alreadyStarted' ? 'that game already started — ask for the save/token'
          : `server rejected: ${msg.code}`);
      }
    }, () => fail(box, 'no game server — start it with: node server/index.js'));
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'join', joinCode: code, name, seat })));
  });
}
