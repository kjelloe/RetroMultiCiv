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

    # the game WebSocket — MUST forward the Upgrade/Connection headers
    location /ws {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
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

---

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
| `--max-games N`  | `50`      | Global concurrent games.                           |
| `--creates-per-hour N` | `20` | New games created per IP per hour.                 |
| `--joins-per-min N` | `30`   | Join/reserve attempts per IP per minute.           |
| `--chat-per-min N` | `60`    | Chat messages per IP per minute.                   |
| `--lobby-ttl-min N` | `60`   | Retire an unstarted lobby after N idle minutes.    |
| `--abandoned-hours N` | `24` | Retire a started game after N hours with no players connected (its save survives — resumable by code). |
| `--debug`        | off       | **Dev only.** Serves the WHOLE repo over HTTP.     |

> The connection/game/rate caps default to **LAN-safe** numbers — a normal LAN
> party never approaches them. Tighten them before promoting a host to the
> public internet; they are the first line against enumeration floods,
> game-spam, and connection exhaustion.

> **Keep `--debug` off in production.** The default is hardened: only
> `/client/`, `/engine/`, `/shared/`, and `/data/` are served, so `saves/`
> (seat tokens + codes) and `debugging/` never reach the wire. `--debug`
> serves the entire repo for the gallery/diagnostics — use it only on a
> trusted local machine.

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
