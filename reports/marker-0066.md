# marker-0066 — server crash resilience (#1752, the user's crash-detection request)

**Tag:** `marker-0066` → `c3ad704`
**Class:** gamesim-golden-neutral (server/ops/docs only — no engine/data/luau/goldens).
**Breaking:** no. Safe merge. Opt-in behaviour (the supervise loop is `MULTICIV_SUPERVISE=1`;
default hosting is byte-unchanged).

## Delta since marker-0065

The server crash-resilience feature the user requested (crash detection + logging to a
crashdump file + stdout/stderr; graceful exit + self-restart on OOM). Delivered by the
hardening lane on branch `hardening-crashdump`, landed as a clean fast-forward
(`1e54e29 → c3ad704`, linear).

### server/crash.js (new)
- **`writeCrashdump`** — an `uncaughtException`/`unhandledRejection` writes
  `crashdumps/crash-<ISO>.log` (stack + memory + per-game turn/unit/city counts) + a
  one-line stderr mirror, then `exit(70)`. Never throws — formatting, file IO, and the
  game-probe are each try/catch-wrapped so a dump failure can't mask the original crash.
- **`startMemoryWatchdog`** — polls `heapUsed` vs the V8 `heap_size_limit`; at
  `--mem-soft-pct` (default 85%) it writes `oom-<ISO>.log` + a best-effort autosave-all
  + `exit(70)` **before** V8's fatal uncatchable OOM. Every side effect (memory readers,
  exit, clock, IO dir, timer) is injectable → fully tested with no real crash/OOM.

### server/index.js (connect/boot region — hardening's exclusive lane)
`gameProbe` (per-game turn/unit/city counts) + `autosaveAll` exposed from `startServer`;
handlers installed EARLY with a by-reference deps object (catches boot crashes too);
watchdog started post-boot; flags `--mem-soft-pct` / `--mem-check-sec`.

### run.sh + run.ps1
Opt-in `MULTICIV_SUPERVISE=1` foreground restart loop: a crash/OOM (exit 70) or
unexpected death → auto-restart with backoff (1,2,4…30s); a clean operator stop
(exit 0 / SIGTERM/SIGINT) → NO restart; a crash-loop cap (`MULTICIV_RESTART_CAP`
default 5 / `_WINDOW` 60s) → "boot-crash loop, not restarting", exit 1. Default
(env unset) = the existing detach-and-report path, byte-unchanged.

### docs
`docs/16-security-assessment.md` §2.4 operator note + `docs/how-to-host.md` "Staying up":
crashdump location, the two mem flags, and the **crash-vs-block tell** — an `oom-*.log`
= memory crash; a live process + no dump = the event-loop block (the #1732 ws-timeout,
being fixed separately on `hardening-heartbeat`).

## Verification
- Suite GREEN: 638 pass / 0 fail / 2 env-skip (hardening #1859; +7 in
  `test/server-crash.test.js` — dump shape+game context, probe-throws-safe,
  write-fail-returns-null, watchdog fire/quiet/reader-fail, installed-handler exit-70).
- `run.sh` supervise loop smoke-tested with a fake `node` driving the real loop:
  restart-on-70 + clean-stop-no-restart + crash-loop-cap all correct (hardening #1860).
- sim-runner clean-clone land: golden-neutral confirmed by diff (no engine/data/luau);
  full suite green; clean FF, linear (#1866).

## Impact for the user
Directly answers the turn-2623 mystery: the next long hosted game leaves an `oom-*.log`
if it was a memory crash, or a live process with no dump if it was the event-loop block
(#1732). And `MULTICIV_SUPERVISE=1` keeps a hosted game up across crashes (resuming from
the per-command autosave). Provenance: original operational hardening (docs/17 lane).
