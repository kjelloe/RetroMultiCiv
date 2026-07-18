# hardening/ — server load harness

Reproducible flood harness for the server-robustness lane (`docs/17`). It spawns
the real `server/index.js` in its own process and drives N **separate** flooder
processes, so any latency a co-player "canary" sees is server-side, not harness
contention. Run from the repo root:

    node hardening/cmd-flood.mjs <flooders> <secs> <seats> <port>

Output is one JSON line: the canary's command→ack latency baseline (no flood) vs
under-load (p50/p99), plus RSS and liveness. This is the tool behind the
combined-sweep numbers in `docs/16 §2.2` (the layered budget held a co-player at
p50 ~278 ms under 6 authenticated flooders vs ~834 ms for the per-connection-only
build). `flood-worker.mjs` is its per-flooder subprocess.

The fast, deterministic regression guards live in `test/` (run via
`node --test test/*.test.js`): `server-limits.test.js` (pure rate/budget/cap +
`clientIpFrom`/`originAllowed` math, injected clock) and
`server-hardening.test.js` (the guards over a real socket: command budget,
message cap, connect-rate, proxy XFF, Origin, static headers, heartbeat,
seat-grace, silent-squatter, SIGTERM, tamper). This harness is for measurement at
scale, not CI.

## Measured gotcha

`send()` backpressure (a stuck reader dropped over `--max-outbuf-mb`) is
harness-verified, not a `node --test` — its trip depends on TCP send/recv
buffering, not deterministic in-process. A slow-consumer probe pauses a
spectator socket and drives turns until the server terminates it.
