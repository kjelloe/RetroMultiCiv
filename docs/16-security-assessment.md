# Information-security assessment — hosting a RetroMultiCiv server

Status: A95 first assessment, architect, 2026-07-16; gap-6 scale
sweep executed + folded 2026-07-17. Re-assess when A50 lands,
when the master index (A51) goes live, and before any 1.0 public
push. Companion: `docs/how-to-host.md` (operator guidance),
`docs/12-global-host.md` §3 (the hardening queue this feeds).
**Open remaining work is enumerated for the infosec ally in
`reports/infosec-remaining.md` (shareable handoff).** Further
security analysis is being moved to a dedicated infosec helper
agent (owner decision 2026-07-17) — this doc records measured
findings; the ally/agent drives the fixes.

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
- **Frame cap 64 KB** enforced at BOTH layers now: `protocol.js
  MAX_FRAME` (application) AND the ws-server `maxPayload` (protocol,
  rejects before the payload buffers) — hardening slice 1
  (marker-0059 era). JSON parse guarded, malformed frames rejected
  without throw. **Per-socket `error` handler** (slice 1): an
  oversized/malformed frame emits `'error'`; without a listener Node
  threw and crashed the whole process — one bad client = full DoS.
  Now swallowed (ws closes that socket). Field-level validation:
  names ≤ 24 chars, chat ≤ 200 chars, commands routed through one
  parse/validate chokepoint (`server-protocol.test.js` covers
  parse/route/seat-auth; `server-hardening.test.js` covers the
  malformed-frame battery + kick-path budget preserve).
- **Command budget** (marker-0050 + slice 2, SHIPPED): a LAYERED
  budget — per-connection O(1) token bucket (backstop, spent before
  route, preserved across kicks) PLUS a per-SEAT bucket (shared
  across a seat's sockets — closes the multi-socket/reconnect bypass)
  PLUS a per-connection all-message cap over every frame type (closes
  the vote/ping flood the cmd-only budget missed). Swept defaults:
  seat cmd 15/s+40, endTurn 2/s+4, msg 30/s+60 (combined sweep:
  co-player p50 278ms under 6 flooders vs ~834ms per-connection-only).
- **Heartbeat + half-open reaping** (slice 2.5, SHIPPED): ws ping
  every 15s; a socket missing 2 pongs is `terminate()`d so its close
  handler fires deterministically — the only way a locked/backgrounded
  phone's HALF-OPEN socket (readyState OPEN, no close event) becomes
  detectable. Was the top availability gap for mobile hosting.
- **Lobby seat-grace** (slice 2.5 Part B, SHIPPED): a dropped lobby
  seat is held ~45s (not released instantly) and reclaimable ONLY by
  its private `reconnectId` (issued in the joinedLobby reply, NEVER in
  the public roster — a live seat is never displaceable). Lets a
  briefly-locked phone keep its seat. Client wake-reconnect (present
  the id) is the helper's Part C.
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
- Residual (→ gap list, = the A50 queue): per-CONNECTION 1/sec
  limits already exist on chat, listGames, AND reclaim — but (a)
  join/create have NO limit at all, and (b) per-connection limits
  reset with a fresh socket, so they rate-limit politeness, not
  abuse. Per-IP limits + global caps (games, connections,
  creates/IP/hour) and lobby TTL/expiry are what is missing — a
  determined abuser can spawn games or hold sockets until memory
  pressure. THIS IS THE MAIN OPEN RISK for a public host today;
  acceptable on LAN. (Review-verified: helper, 2026-07-16.)

### 2.3 Data at rest
- `saves/*.json` contain full game state INCLUDING seat tokens —
  file-system permission is the only guard. Operator guidance:
  run as a dedicated user, `chmod 700 saves/` (in
  `docs/how-to-host.md`); the systemd unit does this. Docker: the
  named volume inherits container isolation.
- No secrets in the repo; `ops/` is gitignored personal.
- Verified safe (review): `gameId` is server-generated (never
  client input) so the saves path has no client-controlled
  traversal; the bare-`/` redirect echoes the query but Node
  rejects CRLF in header values — no header injection.

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
  *New-dep cadence (2026-07-17, A49):* `@playwright/test` entered
  `devDependencies` for the nightly UI lane — dev-only, excluded by
  `--omit=dev`, so the hosted posture is unchanged; recorded here per
  the re-assess-on-new-dependency trigger. `npm audit` reported 0
  vulnerabilities at install.
- **Availability**: A96 watchdog serves a static 503 maintenance
  page (dependency-free) after N failed starts; systemd restarts
  cover crashes. The engine is synchronous per command — a slow
  command blocks the loop; frame cap + validation bound this.
  **Scale-tested 2026-07-17 (sim-runner, gap 6 executed)**: under
  a live hostile flood (20/50/100/200 clients, up to 32.5k cmd/s
  of forged tokens, malformed JSON, oversized payloads, seat
  spam) the server NEVER crashes, state integrity holds, and RSS
  plateaus ~150 MB (per-connection buffers, released on
  disconnect — no leak). The failure mode is FAIRNESS, not
  integrity or memory: a legitimate canary client connects but
  receives ZERO replies once ≥50 hostile clients flood (onset
  between 20 and 50) — the single-threaded loop services the
  flood FIFO and starves everyone else. A flood doesn't kill the
  server; it makes it useless. (→ gap list 1, upgraded.)

### 2.5 The game protocol as an integrity boundary
Commands are the ONLY state mutation path; every command is
validated by the same reducer that replays verify. A malicious
client can at worst send legal-but-hostile commands for ITS OWN
seat. Save-tamper is caught by the game code (docs/07). Debug
commands (A92, when built) are legality-gated at game creation
and permanently taint the game code — they cannot masquerade as
a legitimate game.

## 3. Gap list (feeds A50; ranked)

0. **PER-CONNECTION COMMAND BUDGET (A50 item 4) — HIGHEST-SEVERITY
   availability gap for STARTED games. MEASURED + CONFIRMED
   2026-07-17 (sim-runner #812).** Authenticated joined-seat
   cmd-storm: a flooder that has legitimately joined a seat spams
   valid-token {t:'cmd'} — clears auth, reaches game.apply(),
   rejected as a bogus move but only AFTER consuming the loop.
   Dose-response (canary cmd→ack latency): baseline 1 ms; ONE
   flooder → p50 4.5 s / p99 8.8 s; THREE+ → total starvation
   (zero acks/10 s). Server never crashes, integrity intact —
   pure fairness collapse. Per-IP connect/join caps (items 1-2)
   do NOTHING here: each flooder is one admitted connection under
   every cap. The ONLY control is a per-connection command-rate/
   cost budget (token-bucket on cmd/endTurn, cheap-reject over
   budget with the existing {t:'rejected',code:'rateLimited'}
   shape). In a public game ANY joined seat can do this to
   everyone. This is the top hosting risk once games are public.
1. Per-IP rate limits (join/create/listGames/chat-burst) + global
   caps — the standing A50 items; REQUIRED before promoting
   public hosting beyond supervised weekends. **Measured
   (2026-07-17): the per-IP JOIN limiter is empirically CONFIRMED
   WORKING (90/120 same-IP joins correctly rejected). But rate
   limits alone are NOT enough — also needs the item-4 command
   budget above; and CONNECTION churn (~3.5k open/close per sec)
   evades the concurrency cap, so item 4 also wants a per-IP
   connect-RATE window (code-verified gap: limits.js has none).**
2. Lifecycle expiry: unstarted-lobby TTL, gameOver unlist +
   retention, saves/ size budget (A50).
3. Join-by-id closed for non-public games (A50 §1). **CLOSED
   2026-07-18 (H-1, helper): the `list` frame now strips joinCode
   from non-public lobby rows — existence still lists, the code is
   the secret. Companion H-1 fixes same slice: `listSaves` code/
   name disclosure was already --debug-gated (L2); `resumeFromFile`
   → `createGame` now try/caught (a corrupt save rejects `badSave`,
   never crashes the path); the saves/ dir scan is cached (2s TTL,
   shared by listSaves + resumeByCode) instead of re-parsed per
   request. Red-first tests in server-lobby.test.js.**
4. No Origin check on `/ws` (helper review finding): WebSockets
   are CORS-exempt, so any web page a victim visits can open a
   socket to a LAN/public server (DNS-rebinding reaches
   localhost). Impact bounded — the attacker gets its OWN seat,
   never the victim's token — but it is a distinct griefing/
   resource surface that matters once the master index normalizes
   cross-origin connections. Fix: optional Origin allow-list for
   public hosts, off by default on LAN; lands with A50.
5. HTTP nicety caps (URL length, header size explicit) +
   `X-Content-Type-Options: nosniff` on static responses — minor.
6. Scale test: many-connection + hostile-command-stream soak —
   **EXECUTED 2026-07-17 (sim-runner)**: no crash, no leak, no
   integrity breach at N=200 / 32.5k cmd/s; findings folded into
   §2.4 and gaps 1/4. **CHURN VARIANTS EXECUTED 2026-07-17 morning
   (sim-runner #805/#807)**: (a) connect-churn at ~3.5k open/close
   per sec — server alive, seat-reservation cleanup robust, but the
   A50 admission cap is a CONCURRENCY cap that short-lived churn
   sockets rarely trip, the canary starves, and RSS peaks higher
   than the flood case (~217 MB, per-connection object churn/GC
   pressure) → A50 item 4 also needs a per-IP connect-RATE cap,
   not only the command budget. (Rate-gap is CODE-VERIFIED —
   limits.js has no connect-rate window — plus attempt-rate
   measured; the harness's raw refused=0 was blind to server-side
   reject frames, see (b).) (b) POSITIVE verification: the item-2 JOIN
   limiter empirically WORKS — 120 sequential same-IP joins drew
   90 rateLimited rejects (the first churn harness simply never
   read reject frames; corrected probe: join-
7. WS token rotation on reconnect — nice-to-have, not queued.

## 4. Operator quick-card (mirrors how-to-host.md)

- Public host: TLS via reverse proxy, ufw allow 80/443 only,
  dedicated user, `chmod 700 saves/`, NEVER `--debug`, watchdog +
  nightly self-check on, `MAINTENANCE_CONTACT` set.
- LAN host: defaults are safe; `--no-spectators` if the game
  should be private even to viewers.
- Docker: the image runs hardened defaults; flags pass through
  `docker run IMAGE --flags`.
- `--share-reports DIR` (off by default) only ever WRITES local
  files (anonymized recordings, seat-vetoable, rotation-capped);
  it opens no listener and serves nothing — zero new surface.

## 5. Review cadence

Re-run this assessment: (a) when A50 lands (close gaps 1–3 above
and re-rank), (b) before the master index announces third-party
servers (new trust surface: the INDEX must never be able to harm
a listed server, and listings are unauthenticated claims), (c) at
any new dependency, (d) at 1.0.
