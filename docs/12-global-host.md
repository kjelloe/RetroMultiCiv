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

Out of scope, permanently-until-demand: multi-host directory,
accounts, matchmaking, mid-game host migration.

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
- **Phase C (only on demand)**: the find-a-game v2 directory
  question reopens IF multiple people want to host. Not before.

## 5. Capacity & cost honesty

Turn-based + chunked AI rounds means CPU bursts are short and rare;
memory per game is one state object (tens of KB) + logs. The
plausible bottleneck is nothing technical: it is moderation of a
public lobby list. That is why v1 ships private-by-default with
opt-in listing, and why the allowlist escape hatch exists.
