// Client reject-code copy (regression-guard 1, ruled #2523) — a PURE, node-testable
// module so the CLIENT-SUPERSET test (test/reject-coverage.test.js) can assert the
// client renders EVERY server REJECT_REASONS code. lobby.js calls rejectText for
// in-lobby refusals; a curated FRIENDLY subset gets specific wording, and every
// other reason falls to an intelligible generic line — that fallback is what makes
// the client cover a SUPERSET of the server vocabulary by construction. A new
// server reason therefore renders gracefully with no client change; add it to
// FRIENDLY only when it deserves bespoke wording. (The rejoin.js REJOIN_FAIL switch
// handles the DEFINITIVE game-gone reasons with its own graceful cards.)
export const REJECT_COPY = Object.freeze({
  chatOff: 'chat is switched off in this lobby',
  tooFast: 'chat rate limit — slow down a little',
  noLobby: 'the server no longer sees your lobby seat — your message did not send'
});

export function rejectText(code) {
  return REJECT_COPY[code] || `server rejected: ${code}`;
}
