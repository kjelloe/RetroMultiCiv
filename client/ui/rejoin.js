// XII.4 (user, mobile playtest): the DON'T-LOSE-YOUR-GAME pair for server games.
// A mobile edge-swipe = browser BACK = the page UNLOADS and navigates AWAY, so
// Part C's socket-reconnect (which needs the page still loaded) can't help. Two
// client-only, golden-neutral features:
//   (1) armSessionGuard — a beforeunload prompt while a real seat is live (the
//       native "Leave the game?" catches the accidental swipe-back); disarmed at
//       game over / for spectators / in local mode.
//   (2) maybeShowRejoinBanner — on the setup screen, if a server game was left
//       mid-play, a one-tap Rejoin that reopens ?server=…&game=… (the seat token
//       already in localStorage, docs/16, auto-reclaims the seat).
// The active-game entry lives ONLY in localStorage; no engine, no state.

const ACTIVE_KEY = 'retromulticiv-active-game';

function readActive() {
  try { const s = localStorage.getItem(ACTIVE_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}
function writeActive(entry) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(entry)); } catch (e) { /* private mode */ }
}
export function clearActiveGame() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* private mode */ }
}

// Server-game boot: keep the active-game entry fresh, prompt on an accidental
// unload, and clear both at game over. opts = { session, serverParam, name }.
export function armSessionGuard(opts) {
  const { session, serverParam } = opts;
  if (!serverParam) return;                       // local/hotseat: no server seat to lose
  if (session.playerId === 'spectator') return;   // view-only: nothing to rejoin

  function guard(e) { e.preventDefault(); e.returnValue = ''; return ''; }
  let armed = false;
  function arm() { if (!armed) { window.addEventListener('beforeunload', guard); armed = true; } }
  function disarm() { if (armed) { window.removeEventListener('beforeunload', guard); armed = false; } }

  function refresh() {
    const st = session.state;
    if (!st) return;
    if (st.gameOver === true) { disarm(); clearActiveGame(); return; } // clean end
    if (!session.playerId) return;
    arm();
    writeActive({
      gameId: session.gameId,
      serverParam: String(serverParam),
      seatCode: session.seatCode || '',   // A46 recovery code (fallback if the token is gone)
      code: session.serverCode || '',     // docs/07 game code (display)
      name: opts.name || '',
      turn: st.turn,
      ts: Date.now()
    });
  }
  session.onChange(refresh);
  refresh();
}

// Mount a rejoin banner ABOVE the menu panel as its OWN element (a sibling in
// #setup-screen), never inside #setup-box — inside the box it reflows/distorts
// the menu. The parent gets .has-rejoin so the screen stacks (column) with the
// banner over the centered panel. Falls back to in-box if there is no parent.
function mountAbove(host, banner) {
  const parent = host.parentNode;
  if (parent) { parent.classList.add('has-rejoin'); parent.insertBefore(banner, host); }
  else host.insertBefore(banner, host.firstChild);
}

// Setup screen: surface a left-behind server game as a one-tap rejoin. Standalone
// (runs before ctx exists) — reads localStorage only, no-op when there's nothing
// stored (so a local game, which never writes the entry, never shows it).
export function maybeShowRejoinBanner(box) {
  const e = readActive();
  if (!e || !e.gameId) return null;
  const host = box || document.getElementById('setup-box');
  if (!host) return null;

  const banner = document.createElement('div');
  banner.id = 'rejoin-banner';
  const label = e.code ? `game ${e.code}` : 'your game';
  const when = e.turn !== undefined ? ` · turn ${e.turn}` : '';
  const line = document.createElement('span');
  // HONEST claim: this is the LAST-SEEN snapshot, not the server's live truth —
  // the game may have moved on or ended since (surfaced on rejoin, below).
  line.textContent = `⏳ You left ${label} — as of your last visit${when}.`;
  banner.appendChild(line);

  const go = document.createElement('button');
  go.id = 'rejoin-go';
  go.textContent = '↩ Rejoin';
  go.addEventListener('click', () => {
    const sp = e.serverParam || '1';
    location.search = `?server=${sp === '1' ? '1' : encodeURIComponent(sp)}&game=${encodeURIComponent(e.gameId)}`;
  });
  const dismiss = document.createElement('button');
  dismiss.id = 'rejoin-dismiss';
  dismiss.className = 'setup-lan-btn';
  dismiss.textContent = '✕ Dismiss';
  dismiss.addEventListener('click', () => { clearActiveGame(); banner.remove(); });

  banner.appendChild(go);
  banner.appendChild(dismiss);
  mountAbove(host, banner);
  return banner;
}

// PURE: map a server join-reject code to its graceful card treatment. Only a
// DEFINITIVE server answer (the game is gone / ended) is `definitive: true` —
// those clear the stored record. A network failure (socket error/close) is NOT
// definitive, so a still-valid game is never wiped by a transient hiccup.
const REJOIN_FAIL = {
  gameEnded: { label: 'This game has ENDED.', offerEnd: true },
  gameOver: { label: 'This game has ENDED.', offerEnd: true },   // code alias tolerance
  noSuchGame: { label: 'That game is no longer on the server.', offerEnd: false }
};
export function classifyRejoinReject(code) {
  const f = REJOIN_FAIL[code];
  return f ? { definitive: true, label: f.label, offerEnd: f.offerEnd } : { definitive: false };
}

// After a failed rejoin, downgrade the card GRACEFULLY on the setup screen —
// never a raw error banner. Returns true when it handled a definitive reject
// (record cleared + card shown); false for a non-definitive code so the caller
// keeps its normal error path. `opts.save`/`opts.endscreen` (server-provided on
// gameEnded) get a "View final result" affordance when present.
export function renderRejoinFailure(box, code, opts) {
  const c = classifyRejoinReject(code);
  if (!c.definitive) return false;
  clearActiveGame(); // conservative: only on a definitive server answer
  const host = box || document.getElementById('setup-box');
  if (!host) return true; // record cleared even if there is nowhere to render

  const banner = document.createElement('div');
  banner.id = 'rejoin-banner';
  banner.classList.add('rejoin-failed');
  const line = document.createElement('span');
  line.textContent = `⏳ ${c.label}`;
  banner.appendChild(line);

  const end = opts && (opts.endscreen || opts.save);
  if (c.offerEnd && end) {
    const view = document.createElement('button');
    view.id = 'rejoin-go';
    view.textContent = '🏁 View final result';
    view.addEventListener('click', () => {
      try { window.dispatchEvent(new CustomEvent('rmc-rejoin-final', { detail: end })); } catch (_) { /* no-op */ }
    });
    banner.appendChild(view);
  }
  const dismiss = document.createElement('button');
  dismiss.id = 'rejoin-dismiss';
  dismiss.className = 'setup-lan-btn';
  dismiss.textContent = '✕ Dismiss';
  dismiss.addEventListener('click', () => banner.remove());
  banner.appendChild(dismiss);

  mountAbove(host, banner);
  return true;
}
