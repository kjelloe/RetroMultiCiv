# Server crash resilience: crashdump + OOM graceful-exit + self-restart (architect, 2026-07-19)

> User request (2026-07-19, after the turn-2623 drop + a gaming-PC outage
> where the cause was unknown): record crashes to a crashdump FILE + stdout/
> stderr so a crash is diagnosable; and if it's an OOM, exit gracefully +
> self-restart. GOLDEN-NEUTRAL server OPS (no engine/state/save-format change —
> crashdumps are ops artifacts; graceful-exit reuses the existing per-command
> autosave). HARDENING lane (server robustness; pairs with the ws-timeout
> triage #1732). Applies wherever the server runs: dev-PC WSL (run.sh) AND the
> gaming PC (run.ps1, Windows).

Current gaps (measured): the server registers SIGTERM/SIGINT but NO
`uncaughtException`/`unhandledRejection` handler and NO memory watchdog; a
crash leaves only whatever reached `/tmp/multiciv-server.log`. `run.sh` starts
+ monitors but does NOT auto-restart on death. Autosave IS per-command
(server/index.js) → games already resume from autosave, so graceful-exit +
restart loses at most the in-flight command.

## Part 1 — Crash observability (crashdump)

New `server/crash.js` (or a top-of-`index.js` block), installed before the
server starts:
- `process.on('uncaughtException', (err, origin) => { writeCrashdump(err,
  origin); process.exit(70); })` and `process.on('unhandledRejection',
  (reason) => { writeCrashdump(reason, 'unhandledRejection'); process.exit(70);
  })`. (Distinct exit code 70 = "crash, please restart" for the wrapper.)
- `writeCrashdump(err, origin)` — write SYNCHRONOUSLY (the process is dying;
  `fs.writeFileSync`) to `crashdumps/crash-<ISO>.log` AND mirror a one-line
  summary to `process.stderr`:
  - timestamp (ISO), origin, err.name/message/**stack**;
  - `process.memoryUsage()` (rss/heapTotal/heapUsed/external/arrayBuffers) +
    `require('node:v8').getHeapStatistics().heap_size_limit` + the heapUsed/limit %;
  - `process.uptime()`, `process.pid`, `process.version`, argv;
  - BEST-EFFORT game context (wrap in try/catch so the dump NEVER throws):
    per active game the id + turn + unit/city counts (the biggest-state signal
    for scale crashes like turn-2623).
  - The whole function is try/catch-wrapped: a crashdump failure must not mask
    the original crash (fall back to stderr).
- `crashdumps/` is gitignored (add to .gitignore) — ops artifacts, never
  committed. A short docs/16 §2 note that crashdumps exist + where.

## Part 2 — OOM graceful-exit (memory watchdog)

True V8 OOM ("JavaScript heap out of memory") is FATAL and often un-catchable —
so the goal is to exit gracefully BEFORE V8 hits it:
- A periodic watchdog (a `setInterval`, unref'd, e.g. every 15–30s, tunable via
  a `--mem-check-sec` flag): read `process.memoryUsage().heapUsed` vs
  `v8.getHeapStatistics().heap_size_limit`.
- On crossing a SOFT threshold (`--mem-soft-pct`, default ~85%): log a WARNING
  (stderr + a `crashdumps/oom-<ISO>.log` memory dump, same shape as the crash
  one but non-fatal), then — because autosave is per-command the games are
  ALREADY safe — do one final best-effort autosave-all and `process.exit(70)`
  (the same restart code). The wrapper restarts; clients reconnect + resume
  from autosave (resume-by-code / --game). At most the in-flight command is
  lost.
- ALSO register the V8 near-heap-limit hook as a last-resort for a fast spike
  the interval misses: `v8.setHeapSnapshotNearHeapLimit(1)` is NOT it — use the
  documented path (`--heapsnapshot-near-heap-limit=1` writes a snapshot then
  exits; or the programmatic `require('v8').getHeapStatistics()` polling is the
  portable main mechanism). Keep the periodic watchdog as the primary; the hook
  is optional belt-and-braces (flag it if the API is awkward — don't block on it).
- **This DISTINGUISHES the turn-2623 mystery:** if the next long game OOMs, the
  oom-dump records it (memory climbing to the limit at high turn/unit counts);
  if instead it's the event-loop BLOCK (ws-timeout #1732, process stays alive),
  no oom-dump fires — so the two dumps disambiguate crash-vs-block.

## Part 3 — Self-restart wrapper (run.sh + run.ps1)

- **run.sh (dev PC / WSL):** wrap the server launch in a restart loop — on the
  server exiting, log `"[wrapper] server exited code=$c at $(date)"` to the
  server log, and RESTART, with **backoff + a crash-loop cap** (e.g. if it exits
  >N times in M seconds, stop and print "boot-crash loop — not restarting" so a
  broken build doesn't spin forever). Exit code 70 (crash/OOM) and unexpected
  deaths → restart; a clean SIGTERM/SIGINT (operator stop) → do NOT restart.
- **run.ps1 (gaming PC / native Windows — the box that went dark):** the same
  restart loop in PowerShell (try/finally around the node process, same backoff
  + cap + clean-stop detection). This is the one that matters for the gaming PC.
- Keep stdout/stderr redirected to the server log (run.sh already does
  `> /tmp/multiciv-server.log 2>&1`); the crashdumps/ files are the structured
  record on top of that.

## Scope / verification

- GOLDEN-NEUTRAL, server + wrapper only. No engine/state/save-format/Luau
  change. crashdumps are ops artifacts (gitignored).
- Tests: a unit test that `writeCrashdump` produces a well-formed file from a
  synthetic error (+ never throws when the game-context probe fails); a test
  that the watchdog's threshold check fires the graceful-exit path at a mocked
  high heapUsed (inject the memory reader so it's deterministic, no real OOM).
  The wrapper restart loop is shell/PowerShell — smoke-verify the loop restarts
  on a non-zero exit and does NOT restart on SIGTERM (a scripted check, not the
  node suite).
- docs/16 §2 (operator card): crashdumps location + the --mem-soft-pct /
  --mem-check-sec flags + "the wrapper auto-restarts on crash/OOM; resume is
  automatic via per-command autosave".

## OOM ROOT CAUSE — the unbounded recording log (traced 2026-07-19, #1870)

The OOM watchdog above is the safety net; this is the actual per-turn leak that
trips it in a long game. Traced from the user's "could a 2000+ turn game OOM?" ask.

**Finding (`server/game.js`):** the per-game `log` array is built unconditionally at
game start (`log = []` at init only) and appended on EVERY command, NEVER trimmed:
- `apply()` + `playRegentSeat()`: one `{t:'cmd', turn, cmd}` per command (~100–230 B
  retained). **Regent-played human seats log EVERY regent command** (moves/production/
  research), so a REGENCY game (the turn-2623 case) grows fast: R seats × C cmds/turn,
  and a late-game unit-spam seat issues dozens–hundreds of move cmds/turn.
- `endTurn()`: one `{t:'round', turn, activePlayer, hash}` per round (~62 B) — cheap
  (~260 KB at 2623 turns). The per-command entries dominate.
- Pure-AI players driven inside `endTurn` are NOT logged per-command (only the round
  hash). The state itself does NOT accumulate (replaced + GC'd each turn); no full-state
  snapshots are retained (only hashes) — verified.

**Estimate:** 3 regent seats × ~80 cmd/turn ≈ 110 MB at t2623; 6 × ~150 ≈ 420 MB. Plus
the large late-game state + V8 overhead → plausibly OOMs a default ~1.5 GB old-space.

**Fix (routed to hardening #1870; server-only → golden-neutral):** PREFERRED = stream
per-command entries to a disk file incrementally, keep only round-hash entries in RAM,
and have the end-of-game match-report replay the streamed file (bounds RAM to
~round-hashes). Alternatives: cap the in-memory log to the last N rounds; opt-out full
recording for marathon games. CONSTRAINT: the recording is the tamper/replay contract
(`tools/replay.js` + `server/report.js` match-report + the `fullLog` send at
`server/index.js`) — any fix must keep replay-from-initialState → finalHash working.

## Provenance

`original` — operational robustness for self-hosting (docs/12). Driven by the
turn-2623 drop + the unknown-cause gaming-PC outage. Pairs with the ws-timeout
event-loop fix (#1732): together they cover crash (this) AND block (that).
