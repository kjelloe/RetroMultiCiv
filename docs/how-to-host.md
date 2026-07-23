# Host your own RetroMultiCiv server

RetroMultiCiv is a plain Node app with **no build step and one dependency**
(`ws`). The same process serves the browser client *and* runs the
authoritative WebSocket game, so "hosting" is just: get Node, get the repo,
run one command. This guide goes from a 30-second local run up to a hardened
public VM with TLS.

- **[Quick start](#quick-start)** — run it locally in under a minute.
- **[Ubuntu + systemd](#ubuntu--systemd)** — a service that survives reboots.
- **[Docker](#docker)** — one container, no host Node needed.
- **[Hetzner (public VM, TLS)](#hetzner--a-public-server-with-tls)** — the
  full promoted walkthrough: firewall, nginx, Let's Encrypt.
- **[Raspberry Pi](#raspberry-pi)** — the ARM/low-memory deltas only.
- **[Reference](#reference)** — every server flag, the ports, what's on disk.

Throughout, the server is `node server/index.js`; `./run.sh` (Linux/macOS/WSL)
and `run.ps1` (Windows) are thin wrappers that add prerequisite checks and a
restart. Nothing here needs a database, a bundler, or a secret — the game
state lives in memory and autosaves to JSON files under `saves/`.

---

## Quick start

Prerequisites: **Node.js LTS** (v18 or newer; v22 LTS recommended) and `git`.

```bash
git clone https://github.com/<owner>/multiciv.git
cd multiciv
npm ci                 # installs the one dependency (ws); no build step
./run.sh               # serves on http://localhost:8123
```

Open **http://localhost:8123/client/?server=1** — the client joins the game
over `/ws` instead of running its own engine. Others on your LAN reach it at
`http://<your-ip>:8123/client/?server=1` (the server binds `0.0.0.0` by
default). Share the 5-letter join code the lobby shows.

Windows (PowerShell), the native twin:

```powershell
.\run.ps1                    # port 8123
.\run.ps1 9000 --civs 4      # another port + server args
```

A bare `/client/` on a **hosted server** redirects to `/client/?server=1`, so a
visitor who just types the domain lands in the server game rather than an
in-browser one that vanishes with the tab. Use **`/client/?local=1`** to reach
the local engine on a hosted box; any other query (`?seed=`, `?civs=`,
`?humans=`…) is served untouched. Off a plain static server (`python3 -m
http.server`) there is no redirect — bare `/client/` is the local engine as
always.

Without `?server=1` the client runs a fully local engine (no server needed) —
that's the single-player / hotseat mode. `?server=1` is what makes it a
*hosted* game other people can join.

> **Play vs. host.** `./run.sh` hosts one authoritative game. Hotseat
> (multiple humans on one keyboard) always plays locally — it does not use
> `?server=1`.

---

## Ubuntu + systemd

For a machine that should keep the server running across crashes and reboots
(a home box, a mini PC, a VM), wrap it in a systemd unit.

**1. Install Node LTS** (NodeSource gives you a current LTS on any Ubuntu):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. Put the app somewhere stable and install deps:**

```bash
sudo mkdir -p /opt/multiciv && sudo chown "$USER" /opt/multiciv
git clone https://github.com/<owner>/multiciv.git /opt/multiciv
cd /opt/multiciv && npm ci
```

**3. Create the service** at `/etc/systemd/system/multiciv.service`:

```ini
[Unit]
Description=RetroMultiCiv server
After=network.target

[Service]
Type=simple
User=multiciv
WorkingDirectory=/opt/multiciv
UMask=0077
ExecStart=/usr/bin/node server/index.js --port 8123 --host 127.0.0.1
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Notes:

- **`--host 127.0.0.1`** binds Node to loopback so only a reverse proxy on the
  same box can reach it. Drop it (default `0.0.0.0`) if you want the server
  directly reachable on the LAN with no proxy.
- Run as a dedicated **non-login user** (`sudo useradd -r -s /usr/sbin/nologin
  multiciv && sudo chown -R multiciv /opt/multiciv`), never root.
- **Secure `saves/`** — it holds seat tokens and game codes. `UMask=0077`
  above makes every autosaved file owner-only from birth; also lock the
  directory once: `sudo -u multiciv mkdir -p /opt/multiciv/saves &&
  sudo chmod 700 /opt/multiciv/saves`.
- Logs go to the journal — no files to rotate: `journalctl -u multiciv -f`.

**4. Enable and start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now multiciv
journalctl -u multiciv -f        # watch it boot
```

Update later with:

```bash
cd /opt/multiciv && git pull && npm ci && sudo systemctl restart multiciv
```

`npm ci` on every update keeps the lockfile authoritative; it's a no-op when
nothing changed.

---

## Docker

The repo **is** the app (no build artifacts), so the image just copies the
source, installs `ws`, and runs Node. A `Dockerfile` and a `compose.yaml` ship
in the repo root.

```bash
docker build -t retromulticiv .
docker run --rm -p 8123:8123 retromulticiv
# → http://localhost:8123/client/?server=1
```

Pass server flags after the image name — they reach `node server/index.js`:

```bash
docker run --rm -p 8123:8123 retromulticiv --civs 6 --size large
```

Persist saved games by mounting a volume over `/app/saves`:

```bash
docker run -d --name multiciv -p 8123:8123 \
  -v multiciv-saves:/app/saves retromulticiv
```

Or with Compose (`docker compose up -d`):

```yaml
services:
  multiciv:
    build: .
    image: retromulticiv
    ports:
      - "8123:8123"
    volumes:
      - multiciv-saves:/app/saves
    restart: unless-stopped
volumes:
  multiciv-saves:
```

> **Prebuilt image.** A GitHub Actions workflow can publish the image to GHCR
> so operators skip `docker build`. That publishes a **public artifact**, so
> it stays disabled until the repo owner opts in — see the note at the top of
> `.github/workflows/docker-image.yml`.

Behind a reverse proxy, run the container on loopback
(`-p 127.0.0.1:8123:8123`) and point nginx at it exactly as in the Hetzner
section — the WebSocket upgrade headers are the same.

---

## Hetzner — a public server with TLS

This is the promoted walkthrough: a single small VM serving
`https://yourdomain` with a Let's Encrypt certificate, a firewall, and nginx
terminating TLS in front of Node. It's a sanitized, RetroMultiCiv-specific
version of a reusable single-VM Node recipe. A **CX22-class** box (2 vCPU,
4 GB) is ample; the game is CPU-light and holds state in memory.

The shape:

```
Browser                         Hetzner VM (one box)
┌───────────────┐   HTTPS 443   ┌──────────────────────────────────────────┐
│ /client/      │ ────────────► │ nginx (TLS termination + reverse proxy)  │
│   ?server=1   │   WSS /ws     │        │  proxy_pass 127.0.0.1:8123       │
│ WebSocket ────┼──────────────►│        ▼  + WebSocket Upgrade headers     │
└───────────────┘               │ node server/index.js  (systemd service)  │
                                │        ▼                                  │
                                │ saves/*.json  (game state, on local disk) │
                                └──────────────────────────────────────────┘
```

nginx is the only thing exposed to the internet; Node listens on
`127.0.0.1:8123` and is never public. **The one RetroMultiCiv-specific detail
is the WebSocket upgrade block for `/ws`** — without it the game socket can't
establish and the client falls back to "connecting…" forever.

### 1. Create the VM

Create an Ubuntu LTS server in the Hetzner console. Add your SSH public key in
the dialog. (Everything below can also be baked into a cloud-init
`user-data` file, but the manual steps are shown so each piece is clear.)

### 2. Base hardening

SSH in, create a deploy user, and lock the box down:

```bash
# as root, first login
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh

apt-get update && apt-get install -y ufw fail2ban nginx
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
systemctl enable --now fail2ban
```

Disable root/password SSH in `/etc/ssh/sshd_config.d/99-hardening.conf`
(`PermitRootLogin no`, `PasswordAuthentication no`), then
`systemctl restart ssh`. From here on, log in as `deploy`.

> ufw opens only 80/443 (+ SSH). Node on `127.0.0.1:8123` is never reachable
> from outside — nginx is the sole front door.

### 3. Install Node + the app

Exactly the [Ubuntu + systemd](#ubuntu--systemd) steps above: NodeSource Node
22, clone into `/opt/multiciv`, `npm ci`, and the same `multiciv.service`
unit (keep `--host 127.0.0.1`). Enable it and confirm with
`curl -sI localhost:8123/client/` returning `200`/`302`.

### 4. nginx reverse proxy — with the `/ws` upgrade block

Create `/etc/nginx/sites-available/multiciv`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name yourdomain.example;

    # the game WebSocket — MUST forward the Upgrade/Connection headers, and
    # X-Forwarded-For so the server can rate-limit per REAL client IP (with
    # `--trust-proxy`); without it every client looks like 127.0.0.1 and the
    # per-IP connect-rate/limits collapse to one shared bucket.
    location /ws {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 1h;      # keep idle game sockets alive
    }

    # everything else: the static client + engine/shared/data
    location / {
        proxy_pass http://127.0.0.1:8123;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/multiciv /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 5. DNS + TLS

**TLS is required for a public host, not optional.** Seat tokens travel over
the game socket; on plain `ws://` they cross the open internet in the clear,
so anyone on the path can hijack a seat. Terminating TLS here makes it `wss://`
and closes that. (On a trusted LAN, plain `ws://` is acceptable.)

Point an **A record** for `yourdomain.example` at the VM's IP. Then let
certbot fetch the certificate and rewrite the nginx site to add HTTPS +
an HTTP→HTTPS redirect:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.example -m you@example.com \
     --agree-tos --non-interactive --redirect
sudo certbot renew --dry-run     # confirm auto-renewal works
```

certbot upgrades the `/ws` and `/` blocks to `listen 443 ssl`; the WebSocket
now runs as **WSS** with no further change — the client uses `wss://` on an
HTTPS page automatically.

Done: **https://yourdomain.example/client/?server=1** is a public game.

### 6. Operate

| Task            | Command                                         |
|-----------------|-------------------------------------------------|
| Tail logs       | `journalctl -u multiciv -f`                     |
| Restart         | `sudo systemctl restart multiciv`               |
| Update          | `cd /opt/multiciv && git pull && npm ci && sudo systemctl restart multiciv` |
| Instant `?age=` starts | `node tools/bake-age-snapshots.js` on your DEV machine before deploying (a build step — the snapshots are gitignored and ship via rsync; without them `?age=` falls back to live fast-forward, which is correct but slower) |
| Back up games   | `cp -a /opt/multiciv/saves ~/multiciv-saves-$(date +%F)` |
| Renew cert test | `sudo certbot renew --dry-run`                  |

`saves/*.json` carry seat tokens and game codes — they are already off the
wire (the hardened static whitelist never serves `saves/`), so treat that
directory as the one thing worth backing up and keeping private.

A host can resume any of these games from the client's lobby — either by
picking it from the list, or by typing its **game code** (the code shown on
every save is the resume gamecode: it identifies which saved game to resume).

Because a save is resumable by code, the server's automatic `saves/` cleanup
retires games in **priority tiers**, never by age alone: a game currently being
played is never touched; **completed** games are retired first (oldest first);
and a **resumable** save (finished-but-not, a game a host could still resume by
its code) is only retired if the budget still doesn't fit once every completed
game is gone. The budget is a count **and** a size cap: `--max-saves` (default
100) and `--max-saves-mb` (default 500). Cleanup runs on boot and roughly once a
minute; foreign files in `saves/` are ignored.

The budget is nonetheless **hard**: if only resumable saves remain and the
directory is still over budget, the oldest resumable is dropped. **Size the
budget generously if you host long-lived resumable games** — resumable saves go
last, but they are not immortal under a tight cap.

### 7. Deploy troubleshooting

Everything below was hit on a real first deploy (2026-07-20, Hetzner CX-class,
Ubuntu LTS). `docs/hetzner-ssh-deploy.sh` already self-heals items 1–3; they are
documented anyway because the same symptoms appear if you deploy by hand.

**First, check whether cloud-init actually finished.** Nearly every failure
below traced back to a single cause: the `runcmd:` phase never ran to
completion, so Node was never installed and `/opt/retromulticiv` was never
chowned. Diagnose it before chasing the individual symptoms:

```bash
cloud-init status --long          # expect: status: done
cloud-init analyze show | tail -30 # per-stage timings
sudo tail -50 /var/log/cloud-init-output.log   # runcmd stdout/stderr lives here
```

The tell is **total runtime**. A cloud-init that reports done in ~10 seconds
did *not* run `package_update` + `package_upgrade` + a NodeSource install — a
real run on this template takes minutes. A short runtime plus a missing `npm`
means `runcmd` was skipped or died early; `cloud-init-output.log` names the
step. Note also that the template's last `runcmd` line is `reboot`, so a
truncated log can simply mean the box rebooted mid-phase. To replay the phase
after fixing the cause:

```bash
sudo cloud-init clean --logs && sudo cloud-init init && sudo cloud-init modules --mode=final
```

Individual symptoms and fixes:

1. **`npm: command not found`, and `node --version` says v18.x.**
   Ubuntu's stock `nodejs` package shipped instead of NodeSource Node 22, and
   the stock package bundles no npm. Install NodeSource directly:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
   ```
   The deploy script now checks for `npm` up front and prints this hint rather
   than failing deep inside the install step.

2. **rsync fails with `Permission denied` / `chgrp: Operation not permitted` on
   `/opt/retromulticiv`.** The directory is still root-owned because the
   `chown` in `runcmd` never ran. The deploy script fixes this itself with a
   pre-step (`sudo mkdir -p … && sudo chown -R $(id -un):$(id -gn) $APP`) and
   passes `--no-owner --no-group` so the unprivileged receiver stops trying to
   preserve source ownership.

3. **`npm error code EACCES … ~/.npm`.** An earlier privileged `npm` left a
   root-owned cache. The script self-heals it conditionally. If the manual
   `chown` then reports *"cannot access '/home/<user>/.npm': No such file or
   directory"*, the home directory itself is root-owned (same root cause) — fix
   that first, non-recursively:
   ```bash
   sudo chown <user>:<user> /home/<user>
   ```

4. **`master says: badAddress` in `journalctl -u retromulticiv-game`.**
   `--public-addr` must be a bare `host:port` — **no scheme**. `server/index.js`
   splits the value at the last `:` to separate host from port, so
   `https://example.com` yields a garbage host and `tools/master.js` rejects the
   announcement. Use the *public* port (443, behind nginx), not the internal
   8123. A scheme is now **rejected at boot** with a clear message, so this
   should only bite a server predating that guard:
   ```
   --public-addr multiciv.example.com:443     # correct
   --public-addr https://multiciv.example.com # badAddress
   ```
   After editing the installed unit: `sudo systemctl daemon-reload && sudo
   systemctl restart retromulticiv-game`, then confirm a `master: listed at …`
   line appears in the journal.

5. **The deploy shipped far more than the runtime.** The original script used an
   rsync *exclude* list, which leaked `.claude/`, `specs/`, `debugging/`
   screenshots, `reports/`, `roblox/` (including a binary `.rbxl`), the whole
   test and `luau/` trees, and the private `ops/` notes — roughly 28 MB of
   internal-only content onto a public box. It is now an **allowlist**
   (`--include` for `client/ engine/ shared/ data/ server/` plus three named
   files in `tools/`, then `--exclude '*'`), which selects ~124 files. Verify
   any change to it with a dry run before deploying:
   ```bash
   # add -n to the script's rsync line, or run the same include/exclude set locally:
   rsync -avn --include '/client/***' … --exclude '*' ./ /tmp/deploy-preview/
   ```
   Prefer allowlists over exclude lists for anything that copies a working tree
   to a public host — an exclude list fails open.

6. **`saves/` is empty after playing a game.** Usually not a server bug. The
   in-browser engine saves to browser localStorage; only `/client/?server=1`
   reaches the authoritative server and writes `saves/*.json`. A current server
   redirects bare `/client/` there, so this is a deployed tree predating that
   redirect, or a URL carrying a query (e.g. `?local=1`, which stays local).
   Confirm by grepping the journal for game/lobby
   activity — a silent journal between two boot blocks means nothing ever hit
   the server.

7. **certbot: `Could not automatically find a matching server block for
   servers.<domain>`** (hit on the real live-box upgrade, 2026-07-23). You ran
   `certbot --nginx -d <domain> -d servers.<domain>` before adding the
   `servers.` nginx block, so the certificate was EXPANDED and saved (both
   names — nothing lost) but the installer had nowhere to wire the new name.
   On a fresh cloud-init this cannot happen (write_files lays the block down
   before runcmd runs certbot); it is a live-box ordering trap only. Fix:
   append the `servers.` server block (cloud-init template ~line 118) with the
   real domain in `server_name`, then let certbot finish exactly as its error
   suggests:
   ```bash
   sudo nginx -t
   sudo certbot install --cert-name <domain>
   sudo systemctl reload nginx
   curl https://servers.<domain>/servers   # {"servers":[...]} once the game announces
   ```
   When asked Expand vs anything else during the original run: **Expand** —
   one cert lineage covering both names, same file paths, no other nginx
   edits.

---

## Listing your server in "Find game" (the public master index)

The official master index lives at **`https://servers.multiciv.kjell.today`**
— every client's Find-game button queries it by default (override with
`?master=<url>`, silence with `?master=off`). To list your server there,
add two flags to your game server:

```
--announce https://servers.multiciv.kjell.today \
--public-addr your.domain.example:443 \
--public-name "My server (EU) 8 civ"
```

- `--public-addr` is the address PLAYERS reach you at: bare `host:port`,
  no scheme; the public port (443 behind nginx), never the internal 8123.
- The index probes your `/healthz` before listing you and drops you ~3
  missed heartbeats after you stop announcing. Version-mismatched servers
  are shown greyed with a checksum hint, never hidden.
- Nothing else is shared: the index stores what you announce (name,
  address, counts) — no game state, no tokens.

## Raspberry Pi

A Pi (3/4/5, or Zero 2 W) hosts a small game fine. Only the deltas from the
Ubuntu path differ:

- **Node on ARM** — NodeSource covers ARM too:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- **Binding port 80 directly** (no nginx) needs the capability, since <1024
  ports are privileged. Either front it with nginx (recommended, same as
  Hetzner) or grant Node the bind capability once:
  ```bash
  sudo setcap 'cap_net_bind_service=+ep' "$(command -v node)"
  # then ExecStart=... --port 80
  ```
  Re-run `setcap` after every Node upgrade (a new binary loses the cap).
- **Memory** — on 1–2 GB models keep the civ count modest; each additional
  civilization adds AI work every turn. A `medium` map with ≤ 6 civs is
  comfortable on a Pi 4. There is no database and no per-connection buffering
  to speak of, so idle memory is small; peak is dominated by AI turn
  processing.

Everything else — systemd unit, nginx `/ws` block, certbot — is identical to
the Ubuntu/Hetzner sections.

---

## Staying up (optional)

Two dependency-free helpers keep an unattended server healthy. Both use only
Node/npm and standard shell tools — nothing to install.

### Maintenance page on repeated crashes

`tools/serve-maintenance.js` wraps the server: it spawns
`node server/index.js`, and if the server exits non-zero several times in a
row it binds the same port itself and serves a static "down for maintenance"
page (HTTP 503). It keeps retrying the real server on an interval and hands the
port back automatically once a retry stays up. Point systemd at the wrapper
instead of the server directly:

```ini
ExecStart=/usr/bin/node tools/serve-maintenance.js --port 8123 --host 127.0.0.1
Environment=MAINTENANCE_CONTACT=you@example.com
```

Tunables (all optional, via env): `MAINTENANCE_CONTACT` (shown on the page),
`MULTICIV_MAX_FAILURES` (default 3), `MULTICIV_RETRY_MS` (default 60000),
`MULTICIV_STABILIZE_MS` (uptime that counts as recovered, default 10000).

### Auto-restart wrapper (run.sh / run.ps1) + crashdumps

For a self-hosted box that isn't under systemd — the gaming PC especially
(Windows, `run.ps1`) — the launch scripts have a built-in supervised mode:

```bash
MULTICIV_SUPERVISE=1 ./run.sh 8123 --host 0.0.0.0        # WSL/Linux
```
```powershell
$env:MULTICIV_SUPERVISE=1; .\run.ps1 8123 --host 0.0.0.0  # native Windows
```

The script then runs the server in the foreground inside a restart loop: a
crash or an OOM graceful-exit (the server exits **70**) or any unexpected death
**auto-restarts** with backoff; a clean operator stop (Ctrl-C / SIGTERM →
exit 0) does **not**. A boot-crash loop is capped (`MULTICIV_RESTART_CAP`,
default 5 restarts within `MULTICIV_RESTART_WINDOW`, default 60s) so a broken
build can't spin forever. Games resume automatically from the per-command
autosave, so at most the in-flight command is lost.

Crashes are recorded to `crashdumps/crash-<ISO>.log` (stack + `memoryUsage` +
V8 heap limit/used% + uptime/pid/argv + per-game turn/unit/city counts); the
memory watchdog writes `oom-<ISO>.log` and graceful-exits at
`--mem-soft-pct` (default 85% of the V8 heap limit) BEFORE V8's fatal
uncatchable OOM — tune the poll with `--mem-check-sec` (default 20). An
`oom-*.log` means a memory crash; a live process with no dump after a stall
means the single-loop block, not a crash. `crashdumps/` is gitignored.

### Nightly dependency self-check

`tools/host-selfcheck.sh` runs `npm audit`; if it's clean it does nothing. If
it finds something, it applies `npm audit fix` **in a throwaway staging copy**,
runs the **full test suite there**, and only if that's green does it swap the
verified lockfile into the live tree and restart the service. The live tree is
never modified before the suite passes — determinism and the one-dependency
whitelist demand the gate, so nothing is ever "auto-fixed" blindly.

```bash
# nightly at 04:00, logging to the deploy user's home
0 4 * * *  cd /opt/multiciv && tools/host-selfcheck.sh >> ~/selfcheck.log 2>&1
```

Env: `MULTICIV_RESTART` (restart command after a swap, default
`sudo systemctl restart multiciv`; set empty under Docker), `MULTICIV_DIR`
(live tree), `MULTICIV_AUDIT_LEVEL` (default `high`). If only a
major-version upgrade would fix an advisory, the script stops and asks for
manual review rather than forcing a breaking change.

> A future option (not built): emailing the maintainer on a failed self-check.
> That needs an outbound-mail dependency, so it waits for an explicit decision.

---

## Reference

### Server flags

`node server/index.js [flags]` (and `./run.sh [PORT] [flags]`, which forwards
everything after the port):

| Flag             | Default   | Meaning                                            |
|------------------|-----------|----------------------------------------------------|
| `--port N`       | `8123`    | HTTP + WebSocket port.                              |
| `--host IP`      | `0.0.0.0` | Bind address. Use `127.0.0.1` behind a proxy.      |
| `--seed N`       | random    | World seed.                                         |
| `--civs N`       | `2`       | Civilizations (2–14, capped by map size).          |
| `--size S`       | `medium`  | `xsmall`…`huge`.                                    |
| `--game FILE`    | —         | Resume a saved server game (e.g. `saves/g42.json`). |
| `--no-save`      | off       | Disable the autosave after each accepted command.  |
| `--max-saves N`  | `100`     | `saves/` count budget; oldest completed/abandoned retire first, active never. |
| `--max-saves-mb N` | `500`   | `saves/` size budget (MB); same rotation policy.   |
| `--max-conns N`  | `200`     | Global concurrent WebSocket connections.           |
| `--max-conns-per-ip N` | `16` | Concurrent connections from one IP.                |
| `--heartbeat-sec N` | `15`   | ws heartbeat interval; a socket missing `--heartbeat-misses` pongs is dropped (detects a locked/backgrounded phone). |
| `--heartbeat-misses N` | `2` | Missed pongs before a half-open socket is terminated. |
| `--seat-grace-sec N` | `45`  | Hold a dropped lobby seat this long (reclaimable by its private reconnect id) before freeing it — a phone keeps its seat across a brief screen-lock. |
| `--max-games N`  | `50`      | Global concurrent games.                           |
| `--max-turns N`  | unlimited | Per-game turn cap: clamps each game's end year to the year reached at turn N (marathon's "play until a win" is clamped down to this). The cheapest bound on total game time **and** recording-log growth. |
| `--max-civs N`   | map limit | Absolute civ ceiling for any game on this host — clamps a client's pick down (the map-size seat limit still applies on top). Bounds per-game state + CPU. |
| `--max-size S`   | `huge`    | Largest map a client may pick (`xsmall`…`huge`); larger picks clamp down. Bounds per-game state + CPU. |
| `--creates-per-hour N` | `20` | New games created per IP per hour.                 |
| `--joins-per-min N` | `30`   | Join/reserve attempts per IP per minute.           |
| `--chat-per-min N` | `60`    | Chat messages per IP per minute.                   |
| `--lobby-ttl-min N` | `60`   | Retire an unstarted lobby after N idle minutes.    |
| `--abandoned-hours N` | `24` | Retire a started game after N hours with no players connected (its save survives — resumable by code). |
| `--share-reports DIR` | off  | Write one anonymized match report per finished game into DIR (players become seat1..N; the lobby shows the notice and any seat can veto; keeps the newest 200). Local files only — nothing uploads. |
| `--bug-reports DIR` | off    | Accept in-client bug reports (the 🐞 button + the error banner): each is written as one JSON file (the player's note + the game recording, code, turn, URL) into DIR, keeping the newest 100. **Write-only** — the directory is never served back over HTTP; read it over ssh. Off by default; per-IP hourly budget + 2 MB cap. |
| `--debug`        | off       | **Dev only.** Serves the WHOLE repo over HTTP.     |

> The connection/game/rate caps default to **LAN-safe** numbers — a normal LAN
> party never approaches them. Tighten them before promoting a host to the
> public internet; they are the first line against enumeration floods,
> game-spam, and connection exhaustion.

> **Resource caps (`--max-turns` / `--max-civs` / `--max-size`)** bound what a
> single game can cost, so a small VM can size itself. `--max-turns` is the key
> one for a public host: without it a client can start a marathon (victory-only)
> game whose per-turn recording log grows unbounded — the exact shape that OOMs a
> 2–4 GB box (see `specs/server-crash-resilience.md`). All three are enforced at
> game creation (clamped, not rejected — except an over-the-*map* civ count still
> gets the friendly "too small" message) and apply to the host's own `--civs` /
> `--size` boot game too. They compose with `--max-games` (how many games) and the
> connection/rate caps (who can connect) to form the host's resource budget.

> **Bug reports (`--bug-reports DIR`).** Players get a 🐞 *Report a bug* button
> in the Options panel, and a one-click *Report this problem* button when an
> error banner appears. Each report bundles their note with the game recording
> (moves + state hashes), game code, turn, and URL — enough to replay the bug
> with `node tools/replay.js <file>`. The server writes one JSON file per report
> into DIR and never serves the directory back (read it over ssh). It is
> **off** unless you pass the flag. On the systemd unit, DIR must be inside
> `ReadWritePaths` (e.g. add `/opt/retromulticiv/bugreports`). With the flag off
> the button still works via its *Download report* fallback (the player sends
> you the file), and local (non-server) games always use that download path.

> **Keep `--debug` off in production.** The default is hardened: only
> `/client/`, `/engine/`, `/shared/`, and `/data/` are served, so `saves/`
> (seat tokens + codes) and `debugging/` never reach the wire. `--debug`
> serves the entire repo for the gallery/diagnostics — use it only on a
> trusted local machine.

### Sizing by RAM

The game holds state in memory (one game ≈ tens of KB of state + a bounded
per-round log) and CPU comes in short turn-based bursts, so a small box goes a
long way. The tables below are **conservative starting points** by total box RAM
— anchored on an observed ~217 MB RSS peak for one busy server under a connection
flood (GC pressure, not a leak) and the "state is tiny, concurrency is the cost"
shape. Watch `journalctl -u retromulticiv-game` + `crashdumps/` and adjust; a
precise per-game RSS-at-scale measurement is still pending.

**Memory guard** — set these together so the *graceful* watchdog wins:

| Box RAM | `--max-old-space-size` (game) | game `MemoryMax` | `--mem-soft-pct` | master `MemoryMax` |
|--------:|:-----------------------------:|:----------------:|:----------------:|:------------------:|
| 2 GB    | `768`                         | `1200M`          | `85`             | `200M`             |
| 4 GB    | `1536`                        | `2G`             | `85`             | `256M`             |
| 8 GB    | `3072`                        | `4G`             | `85`             | `384M`             |
| 16 GB   | `6144`                        | `8G`             | `88`             | `512M`             |
| 32 GB   | `8192` (per process)          | `12G`            | `90`             | `512M`             |

**Game-shape caps** — how big/many games the host allows:

| Box RAM | `--max-games` | `--max-conns` / `-per-ip` | `--max-civs` | `--max-size` | `--max-turns` | `--max-saves-mb` |
|--------:|:-------------:|:-------------------------:|:------------:|:------------:|:-------------:|:----------------:|
| 2 GB    | `3`           | `60` / `8`                | `6`          | `medium`     | `420`         | `200`            |
| 4 GB    | `8`           | `200` / `16`              | `8`          | `large`      | `700`         | `500`            |
| 8 GB    | `20`          | `400` / `24`              | `12`         | `huge`       | `1120`        | `1000`           |
| 16 GB   | `50`          | `800` / `32`              | `14`         | `huge`       | `2100`        | `2000`           |
| 32 GB   | `100`         | `1500` / `48`             | `14`         | `huge`       | unlimited     | `4000`           |

Set `--max-old-space-size` in the unit's `ExecStart` (it's a `node` flag, before
the script): `ExecStart=/usr/bin/node --max-old-space-size=1536 server/index.js …`
— or `Environment=NODE_OPTIONS=--max-old-space-size=1536`.

Why the two memory numbers matter:

- **`--mem-soft-pct` is a percentage of the V8 heap limit** (`heapUsed /
  heap_size_limit`), **not** of system RAM or the cgroup. The default heap limit
  is ~2 GB on *any* box, so without `--max-old-space-size` the watchdog on a 2 GB
  box would never fire before the kernel kills the process. Set the heap size per
  tier so the percentage means what you think.
- Keep systemd **`MemoryMax` a little ABOVE** the heap size (heap + code + socket
  buffers + external). The watchdog trips first → writes a crashdump, autosaves,
  and exits 70 → `Restart=on-failure` brings it back **gracefully**. `MemoryMax`
  is the hard backstop: if RSS ever blows past it the kernel OOM-kills (no
  crashdump). You want the graceful path to win, so `MemoryMax` > heap size.

Two more realities:

- **Node is single-threaded.** RAM buys more *concurrent games*, but one CPU core
  caps how many turns can resolve at once. Turn-based bursts make this rarely
  bite, but past ~8 GB the win is to **scale out** — run several `server/index.js`
  processes on different ports behind nginx, each with its own `--announce` to the
  master — rather than one giant heap (GC pauses grow with heap). The 32 GB row
  assumes this multi-process shape.
- **Colocating the master?** Subtract its budget (the `master MemoryMax` column)
  from the game's share; the tables already leave room for it plus the OS.

`--max-turns` stays the single most important public-host cap regardless of tier:
it bounds both total game time and per-game log growth (the shape that OOMs a
small box — see `specs/server-crash-resilience.md`).

### Ports & paths

- **One port** (`8123` by default) carries both HTTP and the WebSocket.
- `/client/?server=1` — the hosted client. Bare `/` and `/client` 302 to
  `/client/` (keeping query params, so join links work).
- `/ws` — the authoritative game WebSocket. A reverse proxy MUST forward the
  `Upgrade`/`Connection` headers for it.
- `saves/*.json` — the only game state on disk (in-memory otherwise). Autosaved
  after each accepted command unless `--no-save`. Not served over HTTP.

### What this deliberately does not have

No database, no build step, no login/secrets, no external services. The one
runtime dependency is `ws`. That's what makes a single small VM — or a Pi, or
one container — enough to host it.
```
