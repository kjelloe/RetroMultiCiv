# A49 — playwright nightly lane: v1 scope (architect, 2026-07-21)

Nightly-only (never in `node --test test/`); dev-dep approved; H3a install
done. The v1 flow set — each a separate spec file in test-ui/:
1. TWO-CLIENT LOBBY: host creates → join by code → both see the start;
   seat list consistency.
2. PLAY + VISIBILITY: 3 turns of moves across two clients — fog views
   differ correctly; D3 war/peace events reach both (the D3-surfacing
   regression guard).
3. RECONNECT: kill a client mid-game, rejoin by token, state resumes
   (docs/06 seat semantics — the flow browser.test.js cannot cover).
4. ENDSCREEN: drive a tiny game to gameOver over ?server=1 — endscreen
   renders on the fog-filtered view (the score-view regression guard).
5. MOBILE VIEWPORT SMOKE: 390x844 viewport — save/load reachable, city
   panel scrolls, pinch handlers registered (the §10 class of bug).
Failure artifacts: screenshot + console dump per flow. Green = all five;
the lane is a 1.0 axis-6 item and an RC-gate input (S1 finder).
