# Global "find a game" — the server-only host service

Status: DESIGNED 2026-07-14 (user-directed while phase 5 summits).
Nothing here is queued until the user flips DNS; the code item (A50,
hardening) is written but gated on that decision.

## 1. The model (one decision resolves everything)

Games run ON the public server — the same `server/index.js` that
hosts LAN games today, on a small VM behind nginx/TLS and a DNS name.
There is NO directory of home-hosted games and no NAT traversal:
"find a game" lists games living on this one host, nothing else.

Why this shape wins:
- Every hard internet problem (NAT, dead hosts, heartbeats, stale
  listings) simply does not exist — the registry and the games share
  a process, exactly as they do on LAN today.
- The client needs ZERO changes: `?server=1` against the public
  origin is the same protocol, same lobby, same browse panel (A41),
  same reconnect/token/seat-code machinery (A46).
- The failure domain is honest: if the host is down, everything is
  down, and everyone can see why.

AMENDED 2026-07-14 (user): the hosted-games model is joined by a
**master-index service** (§6) — the QuakeWorld/Counter-Strike
pattern: privately hosted servers, run by people who know how to
host, announce themselves to a global lookup list. The user's VM
plays both roles: it hosts games AND runs the index, with its own
server simply the first entry.

Out of scope, permanently-until-demand: accounts, matchmaking,
mid-game host migration, NAT relays (self-hosters port-forward, as
in the old days — that is the admission ticket).

## 2. What already exists (shipped, tested)

- Multi-game process: the lobby registry tracks many games by gameId;
  create/join/resume all key off it.
- Join codes (docs/07) as the private-game capability; A41's opt-in
  public listing (code and IPs never leave the server).
- Moderation: host kick + per-game IP block (A37); chat off-switch;
  spectator gating.
- Recovery: autosave per game into `saves/`, resume-from-save (A34),
  token reconnect, per-seat reclaim codes (A46, in queue).
- Liveness under absence: skip-vote + host skip (phase 4), AI regency
  (A40 — queued; on a public host this is the difference between
  "game dies when a stranger quits" and "game continues").
- Measured capacity: A38's tables (8-human round fan-out under 0.5s;
  ~1.7s/round worst case xlarge/16) — a 2-4 vCPU VM hosts dozens of
  concurrent turn-based games; idle ws connections are near-free.

## 3. What must exist before DNS flips (= A50, the hardening item)

1. **Join-by-id closed for private games** (A41 review finding):
   `{t:'join'}` with a raw gameId succeeds today. Public games:
   fine (capability-by-listing). Non-public games: require the join
   code (or a seat token/seat code for reclaim). Resume-from-lobby
   keeps working — it is host-flow, and on the public host "revive
   our Friday game" = resume by GAME CODE, which doubles as the
   authorization (whoever holds the code was in the game).
2. **Per-IP rate limits** on join/create/listGames/chat beyond the
   existing per-conn ones; caps: max concurrent games, max
   connections, max games created per IP per hour.
3. **Lifecycle expiry**: lobbies created-not-started expire (e.g.
   30 min); finished games unlist at gameOver + retention window;
   abandoned games (all seats disconnected > N days) archive their
   save and free the id. Saves directory gets a size budget.
4. **Payload discipline**: the 64KB ws cap exists; add a
   messages-per-second-per-conn general limiter (chat already has
   one).
5. **Ops surface**: a `/healthz` HTTP endpoint (process up, game
   count, connection count) for the VM's monitoring; structured
   one-line log per join/create/expire for post-incident reading.
6. **No accounts, v1**: names stay free-form; abuse handling is the
   existing per-game kick/block + global rate limits. If abuse
   outgrows that, an invite-code allowlist mode is the designed
   escape hatch (one server flag), not accounts.

## 4. Rollout phases (user-owned, ops details live off-repo)

- **Phase A (zero code)**: DNS name → the user's own PC, port
  forwarded, LAN server exposed as-is for a supervised weekend test
  with friends. A50 SHOULD land first even for this.
- **Phase B**: small VM per the user's proven single-VM Node recipe
  (nginx TLS termination, ws upgrade block with a long
  proxy_read_timeout — turn-based games idle for minutes; systemd;
  save-directory backups). The repo carries no personal specifics.
- **Phase C**: the master index goes live (§6) — the user's VM adds
  the lookup service; self-hosters announce with one flag.

## 5. Capacity & cost honesty

Turn-based + chunked AI rounds means CPU bursts are short and rare;
memory per game is one state object (tens of KB) + logs. The
plausible bottleneck is nothing technical: it is moderation of a
public lobby list. That is why v1 ships private-by-default with
opt-in listing, and why the allowlist escape hatch exists.

Concrete per-box-RAM tuning (2/4/8/16/32 GB: heap size, MemoryMax,
`--max-games/-civs/-size/-turns`, the watchdog interplay) lives in
`docs/how-to-host.md` § "Sizing by RAM"; the deployable one-box shape
(game + master behind nginx/TLS) is `docs/hetzner-cloud-init.yaml` +
`docs/hetzner-ssh-deploy.sh`.

## 6. The master index (A51 — the QuakeWorld/CS pattern, user-set 2026-07-14; 1.0-REQUIRED; **CODE BUILD GREEN-LIT 2026-07-17** (user last-call ruling) — announce protocol + index service + in-client server browser build now, tested against a local index; only DEPLOYMENT stays gated on the user scheduling DNS + the host box)

A bulletin board, not a broker: the master lists servers; game
traffic NEVER touches it. Players browse the index and connect
DIRECTLY to the chosen host's ws origin.

- **Announce**: `server/index.js --announce <master-url> [--public-name
  "Kjell's Friday server"]` heartbeats every ~60s over plain HTTP
  POST: name, advertised host:port, protocol version + rules-data
  checksums (the eight canonical hashes — clients see instantly
  whether a server speaks their ruleset), open public games count
  (the A41 listGames summary, already computed). No heartbeat for
  ~3 minutes → delisted. One flag = listed; stop the server = gone.
- **Validate before listing** (the classic master behavior): on
  first announce and periodically, the master probes the advertised
  address with a cheap HTTP GET (`/healthz` from A50) — unreachable
  hosts (NAT misconfigured, firewall) are held OFF the list with the
  reason available to the announcing server, which surfaces it in
  its console ("master says: unreachable from the internet — check
  port forwarding"). Dead listings were the old master lists' curse;
  this kills them at the door.
- **The service itself**: a small plain-node HTTP process (zero new
  dependencies) — `tools/master.js` or a `--master` mode of the
  server; in-memory registry + TTL sweep, no database (a restart
  just means hosts re-announce within a minute). Rate limits and
  size caps on announcements; an entry is a few hundred bytes. It
  COLOCATES on whatever box already exists (the game VM, or even
  the phase-A PC) — it carries no secrets (public listings only),
  so plain HTTP behind the alias is an acceptable v1; TLS arrives
  with the nginx front whenever the box gets one. Standing up a
  dedicated master host is explicitly NOT required.
- **Client**: the find-a-game panel gains a "global" tab when a
  master URL is configured — server rows (name, version match,
  games open, ping-ish reachability age) → pick one → the existing
  A41 browse flow against THAT host's origin (ws connections are
  not CORS-restricted; the client stays a static page from anywhere).
  Version-mismatched servers show greyed with the checksum hint, not
  hidden — honesty over curation.
- **Trust model, stated plainly in the UI**: a listed server is
  someone's private machine; your name and chat go to it. Join codes,
  kicks, blocks all work exactly as on LAN because it IS the LAN
  server, someone else's. The master curates nothing beyond
  reachability + version tags; an abuse-report path is a v2 question
  only if the list outgrows friends-of-friends.

**Operating constants (BUILT — `tools/master.js`, tested in
`test/master.test.js`; the code is the truth if these drift):**

| constant | value | meaning |
| --- | --- | --- |
| heartbeat cadence | ~60 s | `--announce` posts (server/index.js; `announceIntervalMs` test override) |
| TTL | 3 min | no heartbeat this long → the sweep delists |
| re-probe | 5 min | a listed entry is revalidated when its last probe is older |
| probe | GET `/healthz`, 3 s timeout | ANY http response = reachable; connect/timeout failure holds the entry off-list with the reason |
| address guard | pre-probe | loopback/private/link-local/0/8 literals refused (anti-relay, #1077); DNS names pass in v1 (resolution check = hardening follow-up); `allowPrivate` = local-test escape hatch only |
| announce rate floor | 5 s/IP | a hammered `/announce` gets 429; the 60 s cadence never trips it |
| body cap | 4 KB (hard-abort 16×) | an entry is a few hundred bytes; names cap at 80 chars |
| `/servers` | CORS `*` | the client is a static page from anywhere; game traffic never touches the master |
