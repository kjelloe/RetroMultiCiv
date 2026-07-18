// Part C (mobile-resilience.md): the pure decision logic behind the lobby
// wake-reconnect, kept DOM-free so the engine-of-the-decision is unit-testable
// in node while lobby.js supplies the actual WebSocket/visibility plumbing.
// A phone that locked its screen leaves the lobby socket half-open; on wake we
// tear it down and re-present the reconnectId issued at joinedLobby (Part B),
// reclaiming the grace-held seat silently. No engine, no state — pure transport.

// A hide longer than this makes an OPEN socket SUSPECT on wake (a screen-lock
// is always longer; a quick desktop tab-switch is not) — the only tell for the
// half-open shape, whose readyState never leaves OPEN.
export const SUSPECT_MS = 8000;
// Backoff + cap so a truly-down server falls through to the L8 truth screen
// instead of retrying forever.
export const MAX_RECONNECT = 6;
export const RECONNECT_BASE = 800;
export const RECONNECT_CAP = 8000;

// Reconnect only a socket that HELD a seat (has a reclaim id) and is still in
// its pre-boot lobby life; a socket that never reserved (no id) or already
// booted/failed keeps the original behavior (the truth screen / no-server).
export function shouldReconnect(s) {
  return !!(s.canReconnect && s.reconnectId && !s.booted && !s.deadShown
    && s.attempts < MAX_RECONNECT);
}

// The join frame re-sent on a reconnect: the original frame plus the reclaim id
// the server matches against a grace-held seat.
export function reconnectFrame(baseFrame, reconnectId) {
  return { ...baseFrame, lobbyReconnect: reconnectId };
}

// Exponential backoff (attempt is 1-based), capped.
export function backoffDelay(attempt, base = RECONNECT_BASE, cap = RECONNECT_CAP) {
  return Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), cap);
}

// A wake is suspect (worth a proactive reconnect of an OPEN socket) only if the
// tab was hidden at least SUSPECT_MS — the phone-slept case.
export function wakeIsSuspect(hiddenAt, now, threshold = SUSPECT_MS) {
  return !!hiddenAt && (now - hiddenAt) >= threshold;
}
