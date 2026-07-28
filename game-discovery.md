# How RetroMultiCiv solved global server discovery

Written for a coding ally building the same problem in a sibling
project. This is the design we shipped, the protocol, and the traps we
hit — the parts that transfer. Our code references: `tools/master.js`
(the index service), `server/index.js` (`--announce`),
`client/ui/setup.js` (the browser tab), tests in
`test/master.test.js` + `test/server-announce.test.js`; full design
history in `docs/12-global-host.md`.

## 1. The shape: a bulletin board, not a broker

We copied the old QuakeWorld/Counter-Strike master-server pattern and
deliberately nothing newer:

- **Game servers are self-hosted** by people who can port-forward
  (that is the admission ticket — no NAT traversal, no relays).
- **A tiny master index** lists servers. Game traffic NEVER touches
  it: players browse the list, then connect DIRECTLY to the chosen
  host's own websocket origin.
- One box can play both roles. Ours does: the same VM hosts games and
  runs the index, with its own game server simply the first entry.

Everything hard about internet multiplayer discovery (NAT, dead
hosts, stale listings, relays, abuse of a central broker) either
disappears or shrinks to one small service with no secrets in it.

Deliberately out of scope until demand proves otherwise: accounts,
matchmaking, host migration, NAT relays, and any directory of
home-hosted games that the master would have to tunnel for.

## 2. The protocol (three verbs, plain HTTP)

The master is a single plain-node HTTP process. No database, no
dependencies: an in-memory registry with a TTL sweep. A restart is
harmless — hosts re-announce within a minute.

**Announce** — the game server runs with
`--announce <master-url> --public-addr host:port [--public-name "…"]`
and POSTs a heartbeat every ~60 s carrying:
- display name (capped 80 chars),
- the advertised `host:port`,
- protocol version + **ruleset checksums** (we send the canonical
  hashes of our eight data files — clients can see instantly whether
  a server speaks their rules),
- a count of open public games (a summary the lobby already computes).

No heartbeat for 3 minutes → the sweep delists. One flag = listed;
stopping the server = gone from the list. That is the entire
lifecycle contract.

**Probe** — the classic master-list behavior, and the single most
important feature: **validate before listing.** On first announce and
every 5 minutes thereafter, the master GETs the advertised address's
`/healthz` (3 s timeout). Any HTTP response = reachable; a connect
failure or timeout holds the entry OFF the list, with the reason
returned to the announcing server, which prints it on its own console
("master says: unreachable from the internet — check port
forwarding"). Dead listings were the curse of every old master list;
probe-before-list kills them at the door, and the console echo turns
the master into a self-service port-forwarding debugger for hosts.

**List** — `GET /servers` returns the registry as JSON with
`Access-Control-Allow-Origin: *`. The client is a static page served
from anywhere; CORS-open is safe because the list is public data and
game traffic never touches the master.

## 3. The client UX: honesty over curation

The find-a-game panel gains a "global" tab when a master URL is
configured. Each row: server name, version/ruleset match, open public
games, and a reachability age. Two decisions that mattered:

- **Version-mismatched servers are greyed, not hidden**, with the
  checksum hint visible. Hiding them makes "where did the server go"
  support questions; greying them teaches the ecosystem what version
  drift looks like.
- **The trust model is stated in the UI**: a listed server is
  someone's private machine; your name and chat go to it. Join codes,
  kicks, and blocks all work exactly as on LAN because it IS a LAN
  server — someone else's. The master curates nothing beyond
  reachability and version tags.

Also: when no master is configured, the tab explains that state
actionably instead of dead-ending (our review caught a silent
dead-end here — worth testing explicitly). We also tried a hardcoded
default master URL as a fallback and dropped it: a 404/no-CORS answer
from an unconfigured default produces confusing client errors, so
"configured or absent" beats "guessed".

## 4. The guards (each one earned by a concrete failure)

- **`--public-addr` is `host:port`, never a URL.** The value is split
  at the last `:`; a scheme yields a garbage host and every heartbeat
  gets `badAddress`. We reject it at boot now. Behind a TLS proxy the
  correct value is the PUBLIC port (`example.com:443`), not the
  internal port the process listens on — our first live deploy hit
  exactly this.
- **Anti-relay address guard**: loopback / RFC1918 / link-local /
  `0/8` literals are refused pre-probe, so nobody can use your master
  to advertise (or probe) internal addresses. A local-test escape
  hatch flag exists; DNS names pass in v1 (resolving them and
  re-checking is a hardening follow-up).
- **Rate + size caps**: announces are floored at one per 5 s per IP
  (the 60 s cadence never trips it; a hammer gets 429); bodies cap at
  4 KB with a hard abort at 16×. An entry is a few hundred bytes —
  there is no reason to accept more.
- **The master carries no secrets** (public listings only), so plain
  HTTP behind a DNS alias was an acceptable v1; TLS arrives with
  whatever nginx front the box grows. This is what makes colocation
  free — standing up a dedicated master host is explicitly not
  required.

## 5. Operating constants (what we tuned them to)

| knob | value | why |
| --- | --- | --- |
| heartbeat | ~60 s | cheap; fast enough for "stopped = gone soon" |
| delist TTL | 3 min | 3 missed heartbeats — tolerant of blips, honest about death |
| re-probe | 5 min | listed entries get revalidated on read when stale |
| probe | GET /healthz, 3 s | ANY http response counts; only connect-level failure delists |
| announce floor | 5 s/IP | 12× headroom over the cadence |
| body cap | 4 KB | entries are ~hundreds of bytes |

## 6. What we'd tell you to copy first

1. **Probe-before-list.** It is the difference between a useful list
   and a graveyard, and it doubles as host self-diagnostics.
2. **Checksums in the announce.** Version text lies; content hashes
   don't. Grey mismatches, don't hide them.
3. **In-memory + TTL, no database.** The announce loop IS your
   persistence; design the restart to be a non-event.
4. **Keep game traffic off the master.** The moment the master
   relays anything, you own NAT traversal, scaling, and abuse for
   every game on the list.
5. **Make the game server print what the master thinks of it.** Every
   support question about "why am I not listed" answers itself.
6. **Reject bad `--public-addr` shapes at boot**, and document the
   TLS-proxy port trap — it will be your most common misconfiguration.
