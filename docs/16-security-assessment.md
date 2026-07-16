# Information-security assessment — hosting a RetroMultiCiv server

Status: A95 first assessment, architect, 2026-07-16. Reviewed
against `server/` at suite-365 state. Re-assess when A50 lands,
when the master index (A51) goes live, and before any 1.0 public
push. Companion: `docs/how-to-host.md` (operator guidance),
`docs/12-global-host.md` §3 (the hardening queue this feeds).

## 1. Scope and threat model

A hosted server exposes ONE process speaking two protocols on one
port: HTTP (static files only) and WebSocket (`/ws`, the game
protocol). No database, no accounts, no payment data, no PII
beyond player-chosen display names and (host-visible only) peer
IPs. The assets worth protecting:

- **seat tokens** — possession = control of a seat in a game;
- **the host's machine** — traversal/RCE classes must be
  impossible;
- **service availability** — a hobby server should degrade
  gracefully, not melt;
- **game integrity** — no client may corrupt state or cheat
  through the protocol (the determinism/replay design is itself
  the anti-tamper: docs/07).

Out of scope by architecture: passwords (none), email (none until
the deferred resend integration), payments (never).

## 2. Surface enumeration and posture

### 2.1 HTTP static handler
- **Posture: hardened by default (A61).** Only
  `client/ engine/ shared/ data/` are servable; everything else
  404s BEFORE path resolution. A `path.normalize` +
  `startsWith(REPO)` guard backstops traversal even inside the
  whitelist (defense in depth — two independent checks).
- `--debug` re-opens the whole repo (incl. `debugging/`,
  soundboard). **Rule restated: `--debug` is for trusted local
  development only, never LAN/public hosting.** The boot log
  states the posture either way.
- Residual: no request-size/URL-length cap beyond Node defaults;
  no per-IP throttle on HTTP (→ gap list, minor — static-only).

### 2.2 WebSocket `/ws`
- **Frame cap 64 KB** (`protocol.js MAX_FRAME`), JSON parse
  guarded, malformed frames rejected without throw. Field-level
  validation: names ≤ 24 chars, chat ≤ 200 chars, commands routed
  through one parse/validate chokepoint (`server-protocol.test.js`
  covers parse/route/seat-auth).
- **Seat auth**: server-issued tokens, sent once on join, held in
  client localStorage; never network-fetchable at rest (A61 —
  `/saves` is outside the whitelist). Reclaim only for EMPTY
  seats; the server stamps `playerId` server-side (a client
  cannot speak as another seat). Tamper-rejection is suite-tested
  (join → play → tamper-reject in `server.test.js`).
- **Chat**: host-toggleable, text-only (client renders literal
  text — user-verified against HTML injection), 1 msg/sec per
  connection.
- **Spectators**: tokenless and view-only omniscient — they can
  see everything (BY DESIGN, host-controlled via
  `--no-spectators`); they can never vote or command.
- Residual (→ gap list, = the A50 queue): no per-IP rate limit on
  join/create/listGames; no global caps (games, connections,
  creates/IP/hour); no lobby TTL/expiry — a determined abuser can
  spawn games or hold sockets until memory pressure. THIS IS THE
  MAIN OPEN RISK for a public host today; acceptable on LAN.

### 2.3 Data at rest
- `saves/*.json` contain full game state INCLUDING seat tokens —
  file-system permission is the only guard. Operator guidance:
  run as a dedicated user, `chmod 700 saves/` (in
  `docs/how-to-host.md`); the systemd unit does this. Docker: the
  named volume inherits container isolation.
- No secrets in the repo; `ops/` is gitignored personal.

### 2.4 Process and platform
- **No TLS in-process** — deliberate. Public hosts terminate TLS
  at a reverse proxy (nginx/caddy walkthrough in the Hetzner
  guide, WS upgrade config included). ws:// on open networks
  exposes tokens in transit → the guide marks TLS as REQUIRED for
  public hosting, optional on trusted LAN.
- **Supply chain**: ONE runtime dependency (`ws`), lockfile
  pinned, `npm ci --omit=dev` in Docker; dev-only deps (lune,
  playwright) never install on a host. A96's nightly audit runs
  `npm audit` and gates any fix behind a full-suite pass in a
  staging copy before swap — no silent self-modification.
- **Availability**: A96 watchdog serves a static 503 maintenance
  page (dependency-free) after N failed starts; systemd restarts
  cover crashes. The engine is synchronous per command — a slow
  command blocks the loop; frame cap + validation bound this, but
  a pathological-but-valid command stream is untested at scale
  (→ gap list, research).

### 2.5 The game protocol as an integrity boundary
Commands are the ONLY state mutation path; every command is
validated by the same reducer that replays verify. A malicious
client can at worst send legal-but-hostile commands for ITS OWN
seat. Save-tamper is caught by the game code (docs/07). Debug
commands (A92, when built) are legality-gated at game creation
and permanently taint the game code — they cannot masquerade as
a legitimate game.

## 3. Gap list (feeds A50; ranked)

1. Per-IP rate limits (join/create/listGames/chat-burst) + global
   caps — the standing A50 items; REQUIRED before promoting
   public hosting beyond supervised weekends.
2. Lifecycle expiry: unstarted-lobby TTL, gameOver unlist +
   retention, saves/ size budget (A50).
3. Join-by-id closed for non-public games (A50 §1).
4. HTTP nicety caps (URL length, header size explicit) — minor.
5. Scale test: many-connection + hostile-command-stream soak
   against a live server (sim-runner candidate job; new).
6. WS token rotation on reconnect — nice-to-have, not queued.

## 4. Operator quick-card (mirrors how-to-host.md)

- Public host: TLS via reverse proxy, ufw allow 80/443 only,
  dedicated user, `chmod 700 saves/`, NEVER `--debug`, watchdog +
  nightly self-check on, `MAINTENANCE_CONTACT` set.
- LAN host: defaults are safe; `--no-spectators` if the game
  should be private even to viewers.
- Docker: the image runs hardened defaults; flags pass through
  `docker run IMAGE --flags`.

## 5. Review cadence

Re-run this assessment: (a) when A50 lands (close gaps 1–3 above
and re-rank), (b) before the master index announces third-party
servers (new trust surface: the INDEX must never be able to harm
a listed server, and listings are unauthenticated claims), (c) at
any new dependency, (d) at 1.0.
