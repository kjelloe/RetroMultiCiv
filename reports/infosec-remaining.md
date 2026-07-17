# RetroMultiCiv — Infosec remaining work (handoff for the infosec ally)

Prepared 2026-07-17 by the architect. Companion to the full assessment
`docs/16-security-assessment.md` (threat model, surface enumeration,
posture per component). This file is the SHORT actionable list: what is
already done, what remains, ranked, with the measured evidence behind
each item. A dedicated infosec helper agent will own the fixes.

## Context in one paragraph
One Node process, two protocols on one port: HTTP (static files only,
whitelisted) and WebSocket `/ws` (the game protocol). No accounts, no
passwords, no payments, no PII beyond display names + host-visible peer
IPs. Determinism/replay is the anti-tamper (a client can only send
legal-but-hostile commands for its OWN seat; state corruption is caught).
The residual risk class is AVAILABILITY/FAIRNESS, not integrity — proven
by the scale sweep below. TLS is terminated at a reverse proxy (out of
process, by design); ws:// on open networks exposes seat tokens in
transit, so the host guide marks TLS REQUIRED for public hosting.

## DONE (shipped + verified, for context — do not redo)
- HTTP static handler hardened by default (A61): whitelist + traversal
  guard, 404-before-resolve. `--debug` opens the repo — local-dev only.
- WS frame cap 64 KB, JSON-parse guarded, field validation, one
  parse/route/seat-auth chokepoint. Seat tokens server-issued, playerId
  server-stamped, reclaim only for empty seats. Tamper-rejection tested.
- Chat text-only (no HTML injection), 1/sec/conn.
- A50 items 1-3+3b (committed, in marker-0030):
  1. private lobbies joinable ONLY by their code (gameId enumeration
     closed).
  2. per-IP rate limits (join/create/chat) + global connection/game caps
     (`server/limits.js`, clock-injectable). JOIN limiter empirically
     CONFIRMED working (90/120 same-IP joins rejected, 2026-07-17).
  3. tiered saves rotation (active never evicted, completed first,
     resumable last under a hard budget) + gameOver unlist + 8 tuning
     flags.
  3b. lifecycle expiry (unstarted-lobby TTL, abandoned-game archive —
     save survives, resumable), LAN default exempt.
- Scale sweep executed (docs/16 gap 6): outsider connect/cmd floods,
  connect-churn, join-churn, join-limiter verify, insider cmd-storm — NO
  crash, NO leak, NO integrity breach at any level (up to 200 clients /
  32.5k cmd/s). Harnesses live in the sim-runner's `~/sim-lab/`
  (hostile-scale.mjs, connect-churn.mjs, join-probe.mjs,
  joined-cmd-storm.mjs + flood-worker.mjs — separate-process pattern).

## REMAINING — ranked (this is the ally's queue)

### 0. Per-connection command budget — HIGHEST severity (started games)
- **Measured:** an authenticated joined seat spamming valid-token
  `{t:'cmd'}` starves everyone: ONE flooder → canary latency 1 ms → 4.5 s
  (p99 8.8 s); THREE+ → total starvation (zero acks/10 s). Server stays
  up; pure fairness collapse. Per-IP connect/join caps do nothing (each
  flooder is one admitted seat).
- **Fix:** per-connection token-bucket on the cmd/endTurn path; cheap
  `{t:'rejected',code:'rateLimited'}` over budget; consider a per-turn
  command sanity cap. A/B the bucket size so a legit fast-clicker stays
  under the flood threshold (sim-runner can run this).
- **Scope:** `server/index.js` cmd path + `server/limits.js`. This is
  the standing A50 "item 4."

### 1. Per-IP connect-RATE window
- **Code-verified gap** (limits.js has only a CONCURRENCY cap, no connect
  rate window) + attempt-rate measured (~3.5k open/close per sec evades
  the concurrency cap; short-lived sockets rarely hit maxConnsPerIp=16
  simultaneously). RSS peaks ~217 MB under churn (GC pressure, not a
  leak).
- **Fix:** per-IP sliding-window connect-rate cap alongside the existing
  concurrency cap.

### 2. `/ws` Origin allow-list (cross-origin / DNS-rebinding)
- WebSockets are CORS-exempt: any web page a victim visits can open a
  socket to a LAN/public server (rebinding reaches localhost). Impact
  bounded — attacker gets its OWN seat, never the victim's token — but a
  distinct griefing/resource surface, and it matters once the master
  index normalizes cross-origin connections.
- **Fix:** optional Origin allow-list for public hosts, OFF by default on
  LAN.

### 3. HTTP nicety caps (minor)
- No explicit URL-length / header-size cap beyond Node defaults; add
  `X-Content-Type-Options: nosniff` on static responses. Static-only
  surface, low severity.

### 4. WS token rotation on reconnect (nice-to-have, not yet queued)

### 5. Master-index trust surface (FUTURE — only when A51 ships)
- Listings are unauthenticated claims; the index must never be able to
  harm a listed server, and a listed server must not be able to poison
  the index. Re-assess before the master index announces third-party
  servers. Not code today.

## Deployment guardrails already documented (`docs/how-to-host.md`)
Public host: TLS via reverse proxy, ufw 80/443 only, dedicated user,
`chmod 700 saves/`, NEVER `--debug`, watchdog + nightly self-check,
MAINTENANCE_CONTACT set. LAN host: defaults are safe.

## Suggested working split for the infosec helper agent
- It owns `server/limits.js` + the `server/index.js` cmd/connect paths +
  `docs/16` + this file; consumes the sim-runner's `~/sim-lab/` harnesses
  read-only as red cases (each fix gets a red test before the green).
- Items 0 and 1 are the same slice (both live in limits.js) and should
  ship together with the sim-runner A/B for the bucket size.
- Coordinate through the same agent-mail hub; claim server files by lock
  before editing (the engine lane never touches server/, so contention is
  low).
