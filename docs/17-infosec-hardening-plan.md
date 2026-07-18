### Markdown handoff for the local infosec agent

You can save this as something like `docs/17-infosec-hardening-plan.md` or append it to the existing short handoff.

```markdown
# RetroMultiCiv — Infosec hardening implementation plan

Prepared: 2026-07-17  
Audience: local infosec/coding agent  
Scope: Node.js backend, WebSocket protocol, HTTP static handler, hostile simulations  
Primary goal: prepare the self-hosted service for safe public exposure on individual PCs and small VPS hosts.

## 1. Security posture summary

RetroMultiCiv is a small self-hosted multiplayer game server:

- One Node.js process.
- One public port.
- HTTP serves static files only.
- WebSocket endpoint at `/ws` carries the game protocol.
- No accounts, passwords, payments, or sensitive PII.
- User-visible data is limited mainly to display names and host-visible peer IPs.
- Seat tokens are server-issued.
- `playerId` is server-stamped.
- Determinism/replay catches state corruption.
- Main residual risk class is **availability and fairness**, not confidential-data theft or authoritative-state compromise.

The most important known issue is that a player with a valid joined seat can spam valid `{t:'cmd'}` messages and starve other players. The server survives, but gameplay fairness collapses.

## 2. Existing shipped controls — do not redo

The following are already shipped and verified. Treat them as baseline context, not as pending work.

### HTTP static handler

- Static serving is whitelist-based.
- Path traversal guard exists.
- 404 happens before path resolution.
- `--debug` opens the repo and is local-dev only.

### WebSocket protocol

- WebSocket frame cap: 64 KB.
- JSON parsing is guarded.
- Field validation exists.
- There is one parse/route/seat-auth chokepoint.
- Seat tokens are server-issued.
- `playerId` is server-stamped.
- Reclaim only works for empty seats.
- Tamper rejection has been tested.

### Chat

- Text-only.
- No HTML injection.
- 1 message/second/connection.

### A50 items 1-3 and 3b

Already committed in marker `0030`:

1. Private lobbies are joinable only by their code.
2. Per-IP rate limits exist for join/create/chat.
3. Global connection/game caps exist.
4. `server/limits.js` is clock-injectable.
5. JOIN limiter was empirically confirmed:
   - 90/120 same-IP joins rejected.
   - Date: 2026-07-17.
6. Tiered save rotation exists:
   - Active games are never evicted.
   - Completed games are evicted first.
   - Resumable games are evicted last under a hard budget.
7. `gameOver` unlists games.
8. Lifecycle expiry exists:
   - unstarted lobby TTL,
   - abandoned-game archive,
   - save survives,
   - resumable,
   - LAN default exempt.

### Scale sweep already executed

Harnesses live in the sim-runner's `~/sim-lab/` directory:

- `hostile-scale.mjs`
- `connect-churn.mjs`
- `join-probe.mjs`
- `joined-cmd-storm.mjs`
- `flood-worker.mjs`

Observed result:

- No crash.
- No leak.
- No integrity breach.
- Tested up to:
  - 200 clients,
  - approximately 32.5k commands/second.

Known failure mode:

- Availability/fairness collapse under authenticated command spam.

## 3. Current highest-priority issues

## P0 — Per-connection / per-seat command budget

### Severity

Highest for started games.

### Measured behavior

An authenticated joined seat spamming valid-token `{t:'cmd'}` messages can starve other players.

Measured canary latency:

- No flooder: approximately 1 ms.
- One flooder: up to 4.5 s, p99 approximately 8.8 s.
- Three or more flooders: total starvation, zero acknowledgements within 10 s.

Server stays alive. The failure is not process integrity. It is gameplay fairness and event-loop starvation.

### Required fix

Add a token-bucket limiter on the command path.

Minimum behavior:

- Applies to `cmd`.
- Applies to `endTurn` if it uses the same expensive or fairness-sensitive path.
- Rejects over-budget commands cheaply.
- Sends a minimal rejection message:

```json
{"t":"rejected","code":"rateLimited"}
```

- Does not execute expensive game logic for rejected commands.
- Does not broadcast rejected commands.
- Does not log every rejection individually.
- Cleans up limiter state on socket close and game cleanup.

### Recommended keying

Prefer the command limiter to be attached to the authenticated gameplay identity, not only the raw socket.

Recommended hierarchy:

1. Seat/session-level command budget.
2. Connection-level secondary budget.
3. Optional per-game aggregate safety budget if simulations show one game can starve the whole process.

Reason: if one player can open multiple sockets for the same seat or repeatedly reconnect, a purely per-connection limiter may be bypassable.

If the current protocol guarantees only one active socket per seat, document that invariant and test it.

### Suggested starting values

Do not treat these as final. Use the sim-runner to A/B them.

Initial candidate:

- `cmd` sustained rate: 10-20 commands/second/seat.
- `cmd` burst: 30-60 commands/seat.
- `endTurn` sustained rate: much lower, possibly 1-2/second/seat.
- `endTurn` burst: 2-4/seat.

Tune against real UX:

- rapid clicking,
- unit movement,
- queueing actions,
- end-turn spam,
- reconnect/resync behavior.

### Optional additional control

Consider a per-turn command sanity cap if it matches game design.

Example:

- Maximum N accepted gameplay commands per seat per turn.
- Reset on turn advance.
- Exempt purely informational messages.
- Reject excess with `rateLimited` or a more specific code.

Only add this if it is clear as a gameplay rule. Avoid hidden limits that break legitimate late-game turns.

## P1 — Per-IP connect-rate window

### Severity

High for public exposure.

### Current gap

`server/limits.js` currently has a per-IP concurrency cap, but not a connect-rate cap.

Measured attack:

- Open/close churn reaches approximately 3.5k attempts/second.
- This evades the concurrency cap because short-lived sockets rarely exceed `maxConnsPerIp=16` simultaneously.
- RSS peak observed around 217 MB.
- This appears to be GC pressure, not a leak.

### Required fix

Add a per-IP connection-attempt rate limiter at the earliest practical point in the HTTP upgrade path.

Minimum behavior:

- Keep the existing per-IP concurrency cap.
- Add a sliding-window or token-bucket limiter for connection attempts.
- Reject excessive upgrade attempts before allocating game/session resources.
- Close cheaply.
- Keep tracking structures bounded.
- Expire idle IP limiter state.
- Avoid per-attempt noisy logs.

### Important proxy/IP requirement

Do not blindly trust `X-Forwarded-For`.

Rules:

- If the Node process is directly exposed, use the TCP peer address.
- If deployed behind a reverse proxy:
  - Node should preferably bind to loopback only.
  - Only trust forwarded IP headers from a known local/trusted proxy.
  - Document this explicitly in `docs/how-to-host.md`.
- Never let arbitrary clients choose their apparent IP via headers.

## P2 — `/ws` Origin allow-list

### Severity

Medium for public hosting. Lower for LAN.

### Problem

WebSockets are not protected by browser CORS in the same way as `fetch`.

A malicious website visited by a player can attempt to open a WebSocket to:

- a public RetroMultiCiv server,
- a LAN server,
- possibly localhost through DNS rebinding-style scenarios.

Impact is bounded:

- Attacker gets its own seat.
- Attacker does not get the victim's seat token unless leaked elsewhere.

Still, this creates a browser-based griefing/resource surface.

### Required fix

Add optional WebSocket `Origin` validation.

Recommended mode:

- Default LAN mode: off/permissive.
- Public mode: explicit allow-list required.
- Configurable by environment variable or server flag.

Example configuration names:

- `PUBLIC_ORIGIN_ALLOWLIST`
- `WS_ORIGIN_ALLOWLIST`
- `RETROMULTICIV_ALLOWED_ORIGINS`

Exact name should match project conventions.

### Validation requirements

- Compare exact normalized origins.
- Do not use substring checks.
- Avoid broad regexes unless absolutely necessary.
- Decide and document whether missing `Origin` is accepted.
  - Browser clients normally send it.
  - Native clients may not.
- In public browser-only mode, rejecting missing `Origin` is reasonable.

Reject during the WebSocket upgrade before allocating seat/game resources.

## P3 — HTTP nicety caps

### Severity

Low, but cheap.

### Required additions

For static responses:

- Add:

```http
X-Content-Type-Options: nosniff
```

Also verify or add:

- Explicit URL length cap.
- Conservative handling of oversized headers where the Node server supports it.
- No directory listing.
- Correct content types.
- No accidental serving outside the static whitelist.
- Appropriate cache headers:
  - immutable assets may be long-cacheable,
  - HTML entrypoint should not be cached forever.

## P4 — WebSocket token rotation on reconnect

### Severity

Nice-to-have.

Do not implement before P0/P1 unless it is extremely cheap.

Review later:

- token entropy,
- token scope,
- token leakage through logs,
- token invalidation on game end/archive,
- whether reconnect token rotation complicates legitimate reconnection.

## P5 — Master-index trust surface

### Severity

Future. Only applies when A51/master index ships.

Do not implement now unless working directly on A51.

Before A51, perform a separate threat review.

Required design questions:

- Are listings authenticated?
- Can the index command or influence listed servers?
- Can a listed server poison the index?
- Can user-controlled metadata become browser-rendered HTML?
- Are registration/listing sizes capped?
- Are listing claims expired?
- Is liveness verified?
- What happens if the index is malicious, stale, down, or malformed?
- Does the client automatically connect to third-party endpoints from the index?

Required principle:

- The index must not be able to harm a listed server.
- A listed server must not be able to poison the index or other users' discovery experience.

## 4. Additional security checks to add

The current list is good. Add these verification items while touching the server edge.

## A. Trusted proxy and IP derivation

Add a clear helper or documented function for client IP derivation.

It should answer:

- Are we behind a proxy?
- Which proxy addresses are trusted?
- Which header, if any, is trusted?
- What happens if a direct client sends `X-Forwarded-For`?

Test cases:

- Direct client, no proxy header.
- Direct client with spoofed `X-Forwarded-For`.
- Trusted local proxy with valid forwarded IP.
- Malformed forwarded IP.
- Multiple forwarded IPs.

Expected result:

- Spoofed headers from untrusted peers are ignored.
- Rate limits cannot be bypassed by changing request headers.

## B. Slow consumers and outbound backpressure

Once inbound command flooding is controlled, slow readers may become the next availability issue.

Check:

- Does each WebSocket expose buffered outbound bytes?
- Is there a max outbound buffer per connection?
- What happens if a client stops reading but stays connected?
- Are broadcasts queued unboundedly?
- Can one slow player increase memory for the whole game?

Recommended behavior:

- Track outbound buffered amount.
- Disconnect or degrade slow consumers over a threshold.
- Avoid unbounded per-socket queues.
- Ensure broadcast fan-out is bounded.

## C. Unauthenticated socket cap

Before a client joins or authenticates to a seat, it should have a short grace period and bounded resource footprint.

Check/add:

- Max unauthenticated sockets globally.
- Max unauthenticated sockets per IP.
- Join/auth timeout.
- Cleanup timer on socket close.

## D. Logging safety

Ensure logs do not expose secrets or become an attack vector.

Do not log:

- seat tokens,
- full join URLs containing tokens/codes,
- raw oversized messages,
- arbitrary user display names without sanitization/escaping in structured logs.

For repeated abuse:

- aggregate counters,
- sample logs,
- periodic summaries.

Avoid logging once per rejected command under flood.

## E. Metrics

Add or verify lightweight counters:

- active sockets,
- active games,
- sockets per IP,
- join/create/chat rejected,
- connect attempts rejected,
- commands rejected by rate limit,
- origin rejects,
- malformed-frame rejects,
- event-loop delay if available,
- RSS/heap,
- outbound-buffer disconnects.

Metrics do not need a full telemetry stack. Even periodic structured logs are sufficient for small hosts.

## F. Dependency and runtime baseline

Verify and document:

- supported Node.js LTS version,
- lockfile is committed,
- dependency update/audit routine,
- no dev-only debug flags in public hosting,
- production launch command,
- least-privilege runtime user.

## 5. Implementation plan

## Step 1 — Inspect current server edge

Files expected to be owned by this work:

- `server/limits.js`
- `server/index.js`
- `docs/16-security-assessment.md`
- current short infosec handoff file
- `docs/how-to-host.md`

Before editing:

- Claim locks through the agent-mail hub.
- Coordinate with the engine lane.
- Do not modify engine/game determinism code unless strictly required.

Answer these from code before implementing:

1. Which WebSocket library is used?
2. Where is the HTTP upgrade accepted?
3. Where is the WebSocket message parsed?
4. Where is seat authentication checked?
5. Where do `cmd` and `endTurn` enter game logic?
6. Can one seat have multiple live sockets?
7. How is client IP currently derived?
8. Are existing limiters clock-injectable and testable?
9. Is there already socket cleanup on close/error?
10. Is there any existing ping/pong heartbeat?

## Step 2 — Add red simulations before fixes

Use the sim-runner harnesses in `~/sim-lab/`.

The goal is to capture current failure clearly before fixing.

Required red cases:

1. Single authenticated command flooder causes canary latency collapse.
2. Three authenticated command flooders cause total canary starvation.
3. Open/close connect churn bypasses concurrency cap.
4. Spoofed forwarded-IP headers do not bypass limits, if proxy support exists or is added.
5. Optional: slow consumer causes outbound buffering, if easy to simulate.

Record:

- command rate,
- accepted commands,
- rejected commands,
- canary ack latency,
- canary ack count,
- RSS,
- heap,
- event-loop delay if available,
- socket count,
- duration,
- host machine details.

## Step 3 — Implement `limits.js` primitives

Add reusable, clock-injectable limiters.

Preferred primitives:

- token bucket,
- fixed/sliding window if already used by project style,
- bounded map with expiry.

Required properties:

- deterministic tests with injected clock,
- cheap check path,
- explicit cleanup,
- no unbounded key growth,
- useful result object.

Suggested result shape:

```js
{
  allowed: true,
  remaining: 12,
  retryAfterMs: 0
}
```

or:

```js
{
  allowed: false,
  reason: "rateLimited",
  retryAfterMs: 250
}
```

Keep style consistent with existing `server/limits.js`.

## Step 4 — Enforce command budget in `server/index.js`

Place the limiter after enough validation to know the seat/session, but before expensive game logic.

Required behavior:

1. Receive WebSocket message.
2. Enforce frame cap / parse guard as currently done.
3. Validate basic shape.
4. Authenticate route/seat token.
5. For `cmd`/`endTurn`, check command budget.
6. If over budget:
   - send cheap rejection,
   - do not mutate game state,
   - do not broadcast,
   - increment counter,
   - return.
7. If allowed:
   - proceed to existing command handling.

Do not change game-rule validation semantics except where required for rate limiting.

## Step 5 — Enforce connect-rate budget on upgrade

Place at the earliest practical point in the HTTP upgrade path.

Required behavior:

1. Derive client IP safely.
2. Check per-IP connect-attempt limiter.
3. Check existing per-IP concurrency limiter.
4. Check global connection cap.
5. Optionally check origin allow-list.
6. Reject cheaply if any check fails.
7. Only then allocate WebSocket/game resources.

Rejection should be small and immediate.

Avoid expensive body parsing, game lookup, or logging before rejection.

## Step 6 — Add optional Origin allow-list

Add configuration.

Recommended behavior:

- If allow-list is empty or unset:
  - keep current LAN-friendly behavior.
- If allow-list is set:
  - require exact match.
  - reject non-matching origins.
  - decide whether missing origin is rejected; document this.

Suggested documentation:

- LAN hosts do not need this.
- Public browser deployments should set it.
- It is a browser abuse mitigation, not authentication.

## Step 7 — Add HTTP static headers and request niceties

Add:

```http
X-Content-Type-Options: nosniff
```

Verify/add:

- URL length cap.
- header/request-size behavior.
- static whitelist still works.
- traversal tests still pass.
- `--debug` remains local-dev only and documented as unsafe for public hosting.

## Step 8 — Run green simulations

Re-run red cases.

Required acceptance criteria:

### Command flood

Under one authenticated flooder:

- canary continues receiving acknowledgements,
- canary p99 latency remains within agreed target,
- flooder receives `rateLimited` rejects,
- server RSS/heap remains bounded,
- no integrity errors.

Under three or more authenticated flooders:

- canary still makes progress,
- server remains responsive,
- reject rate increases,
- no total starvation.

### Connect churn

Under high open/close churn:

- attempt limiter rejects most excess attempts,
- RSS does not grow unbounded,
- post-GC memory returns near baseline,
- existing legitimate connections remain usable.

### Normal play

With normal simulated players:

- no visible false-positive rate limiting,
- rapid legitimate UI interactions remain acceptable,
- reconnect still works,
- end-turn still works,
- chat limiter behavior unchanged.

### Mixed workload

Run at least one mixed test:

- 32 players,
- normal commands,
- one or more command flooders,
- some reconnects,
- some chat,
- connect churn in parallel if feasible.

Expected:

- no crash,
- no leak,
- no integrity breach,
- non-abusive seats continue making progress.

## 6. Suggested default limit values

These are initial candidates only. Tune with simulations.

```txt
Per-seat cmd sustained rate:       10-20/sec
Per-seat cmd burst:                30-60
Per-seat endTurn sustained rate:   1-2/sec
Per-seat endTurn burst:            2-4

Per-IP connect attempts:           10-30/sec
Per-IP connect burst:              20-60

Unauthenticated socket timeout:    5-15 sec
Max unauthenticated sockets/IP:    small, e.g. 2-4
```

Do not ship defaults solely from this table. Use simulation results.

## 7. Documentation updates required

Update `docs/16-security-assessment.md` with:

- new command budget design,
- connect-rate limiter design,
- Origin allow-list behavior,
- measured before/after results,
- residual risk,
- any assumptions about reverse proxies and client IP.

Update the short actionable infosec handoff with:

- P0/P1 status,
- measured evidence,
- chosen limit defaults,
- known tradeoffs,
- future follow-up items.

Update `docs/how-to-host.md` with:

- TLS required for public hosting,
- Node should bind to loopback behind a reverse proxy,
- firewall should expose only proxy ports,
- trusted proxy/IP-header rules,
- how to configure Origin allow-list,
- never use `--debug` publicly,
- dedicated user,
- `chmod 700 saves/`,
- watchdog/service restart guidance,
- recommended Node LTS version.

## 8. Public-host release gate

Do not mark the service public-host-ready until all of these are true:

- P0 command limiter implemented.
- P1 connect-rate limiter implemented.
- Existing join/create/chat limiters still pass.
- Command-flood simulations pass.
- Connect-churn simulations pass.
- Normal-play simulations pass.
- Rejected work is cheap and does not log per event under flood.
- Client IP derivation is safe behind the documented deployment model.
- Public-host guide documents TLS and reverse proxy requirements.
- `--debug` is clearly forbidden for public exposure.
- No seat tokens or join secrets appear in logs.

## 9. Non-goals for this pass

Do not spend this pass on:

- account systems,
- passwords,
- payments,
- anti-cheat beyond server-side command legality and fairness limits,
- master-index authentication,
- token rotation complexity,
- large architectural rewrites,
- engine determinism changes.

The purpose of this pass is targeted hardening for a small self-hosted public WebSocket game.

## 10. Final deliverables

Expected deliverables from this work:

1. Code changes in:
   - `server/limits.js`
   - `server/index.js`
   - possibly related server tests
2. Simulation outputs showing red-to-green:
   - command flood,
   - connect churn,
   - normal play,
   - mixed workload if feasible
3. Updated docs:
   - `docs/16-security-assessment.md`
   - this short infosec queue/handoff
   - `docs/how-to-host.md`
4. Clear chosen defaults for:
   - command budget,
   - connect-attempt rate,
   - Origin allow-list mode,
   - any unauthenticated socket timeout/cap if added
5. Residual-risk note:
   - app-layer limits reduce abusive workload,
   - they do not stop distributed volumetric attacks,
   - public hosts should still use TLS, firewalling, reverse proxy controls, and a watchdog.

## 11. Guiding principle

Reject abusive work as early, cheaply, and predictably as possible.

Every limiter must be:

- bounded,
- cleaned up,
- tested with an injected clock where practical,
- cheap on the rejection path,
- documented,
- validated against hostile simulations and normal gameplay.
```
