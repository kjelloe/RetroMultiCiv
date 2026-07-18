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
  line.textContent = `⏳ You left ${label}${when} — still in progress.`;
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
  host.insertBefore(banner, host.firstChild);
  return banner;
}
