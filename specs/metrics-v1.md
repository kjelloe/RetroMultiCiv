# Usage metrics for the game server and the master index (v1.0)

**Ruled by the user 2026-07-31:** scope is **v1.0** (gather information from
launch — post-hoc metrics cannot describe the first week), exposure is
**private by default, localhost-bound**. Lane: **hardening** owns and builds
this; the architect owns this design and reviews the result.

## 1. The questions this must answer

Not "collect everything" — these six, and nothing that fails to serve them:

1. Is anyone arriving? (page loads)
2. Do arrivals become games? (games created)
3. Do games *finish*, or get abandoned? (completed vs abandoned, turns played)
4. Do people come back to a game they left? (seat reclaims)
5. Is discovery working — are servers announcing, and is anyone looking?
   (announces, servers listed, list requests served)
6. Is the box healthy under real load? (peaks, not just current gauges)

If a proposed counter answers none of these, leave it out.

## 2. Privacy contract (binding)

- **Counts only.** No IP addresses, no user agents, no seat tokens, no player
  names, no game IDs, no map seeds — nothing that identifies a person or lets
  one player's session be reconstructed.
- **No cookies, no client-side beacon, no third party.** Page loads are counted
  server-side as HTTP GETs of the client entry document. A visit count is a
  number, not a visitor record.
- **No per-request log.** The metrics file holds totals, never rows.
- Anything that would need a privacy notice to be honest is out of scope. If a
  counter feels like it needs justifying to a player, that is the signal to drop
  it.

## 3. Exposure (user ruling: private, localhost)

- New endpoint `GET /metrics` on BOTH services, returning JSON.
- **Bound to localhost by default.** Served only when the request arrives on a
  loopback connection; a remote request gets the same 404 an unknown path gets
  (not 403 — do not advertise that the endpoint exists).
- Opt-in publication via `--metrics-public` (game server) and the same flag on
  the master. Off unless typed. If it is ever turned on, it still exposes only
  the counters below — never a per-request log.
- The operator reads it over SSH: `curl -s localhost:8123/metrics`. Document
  that line in `docs/how-to-host.md`; it is the whole intended workflow.

## 4. Game-server counters

Cumulative since first start (persisted, §6) unless marked *gauge*.

| counter | incremented when |
|---|---|
| `page_loads` | a GET serves the client entry document (`/client/` or its index) |
| `games_created` | the lobby creates a game (any path: default boot, lobby create, resume-from-save counts as `games_resumed` instead) |
| `games_resumed` | a game is restored from a save/autosave |
| `games_completed` | a game reaches game over (any victory type) |
| `games_abandoned` | a game leaves the registry WITHOUT having reached game over (rotation, shutdown, idle eviction) |
| `turns_played` | each turn advance, summed across games |
| `player_joins` | a seat is claimed with a fresh token |
| `seat_reclaims` | a seat is re-claimed with an existing token (the "came back" signal) |
| `spectator_joins` | a tokenless spectator attaches |
| `bug_reports` | a bug report is accepted (only when `--bug-reports` is on) |
| `peak_games` *gauge* | max concurrent games seen |
| `peak_conns` *gauge* | max concurrent connections seen |
| `started_at` | ISO-free integer epoch seconds of first start (for rate maths) |

**Deliberately NOT counted:** anything per-civ, per-map-type, per-difficulty, or
per-player. Those are gameplay questions the simulation sweeps already answer far
better, and they would push this file toward a behaviour log.

## 5. Master-index counters

| counter | incremented when |
|---|---|
| `announces` | a POST /announce is accepted |
| `announces_rejected` | an announce is refused (bad address/schema) — the misconfiguration signal |
| `servers_listed` *gauge* | entries in the current list |
| `distinct_servers` | count of distinct `host:port` seen since start, as a COUNT (keep a set in memory; persist only its size, never the members) |
| `list_requests` | a GET /servers is served — this is the "find game" demand signal |
| `stale_evictions` | a listing is dropped for missing heartbeats |

## 6. Persistence

- One small JSON file per service, path from `--metrics-file PATH`, defaulting
  to `metrics.json` beside the existing runtime state.
- Written **at most once per 60 s** (dirty-flag; skip the write when nothing
  changed) and once on graceful shutdown. Never per-event — this must not put a
  write in a request path.
- On start, load and continue the counters; a missing or corrupt file starts
  fresh at zero and logs one warning. **A metrics failure must never affect
  serving** — wrap read/write so any throw is caught, logged once, and dropped.
- The file is runtime state: gitignored, never served back to clients, and out
  of the deploy rsync allowlist.

## 6b. Known limits (recorded, not deferred bugs)

- **Counter ceiling.** Counters are safe integers clamped at
  `Number.MAX_SAFE_INTEGER` (2^53-1) — unreachable for a hosted game. The
  original implementation used `| 0` (int32), which does not saturate but WRAPS
  NEGATIVE at 2147483647; a negative `page_loads` would be worse than a stalled
  one, so the coercion was replaced (architect call on the reviewer's note
  #2887). The no-float/integer discipline that motivates `| 0` in engine code
  does not apply here: metrics are runtime counters, never hashed game state.
- **Restart-resilient, not crash-proof.** Persistence is dirty-flagged at most
  once per interval plus one write on graceful shutdown, so a hard kill can lose
  up to one interval of counts. That is the deliberate trade for never putting a
  write in a request path.
- **Module form.** `server/metrics.cjs`, not `.js`: the game server is ESM and
  the master index is CJS, and `.cjs` is the one form both can consume. The spec
  originally said `metrics.js`; the hardening lane flagged the deviation rather
  than silently diverging, which is the behaviour wanted.

## 7. Non-goals

No analytics service, no dashboards, no time-series, no retention cohorts, no
histogram of session lengths. If those are ever wanted, they are built by
reading this endpoint from outside, not by growing it.

## 8. Lane boundaries (read before editing)

`server/index.js` is shared. Per docs/17 the **hardening lane owns the
connection-admission and command-handling paths**; the lobby/resume/rotation
paths belong to the helper lane. To keep this additive:

- Put the counter store in a NEW file `server/metrics.js` (hardening-owned,
  no conflict) exporting `bump(name, n)`, `setPeak(name, v)`, `snapshot()`,
  `load(path)`, `save(path)`.
- Wire from the smallest possible number of call sites, and name them in the
  done-mail so review is cheap. Lock `server/index.js` and state the regions.
- `tools/master.js` is unowned — take it with a lock.
- **No engine, data, or client changes.** This must be golden-neutral: if any
  golden or twin pin moves, something is wrong with the wiring, not the pins.

## 9. Tests required

- Counter unit tests: bump/peak/snapshot maths, and that `load()` of a corrupt
  or absent file yields zeros without throwing.
- `/metrics` is served on loopback and **404s for a non-loopback request** with
  the flag off; served for both with the flag on.
- A lifecycle test: create a game, play a turn, reach game over → the three
  counters move as specified (this is the one that catches wiring drift).
- A master test: announce → list → the two counters move; a rejected announce
  increments `announces_rejected` only.
- Persistence: counters survive a save/load round-trip; the writer does not fire
  more than once per interval.

## 10. Acceptance

Green suites, `/metrics` reachable on loopback and invisible remotely, the
how-to-host line documented, and the counters demonstrably moving in a short
manual session (create → play → finish). Report the call-site list in the
done-mail; the architect reviews wiring placement, not just tests.
