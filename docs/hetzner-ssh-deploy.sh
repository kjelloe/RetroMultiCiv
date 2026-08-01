#!/bin/bash
# =============================================================================
# RetroMultiCiv — ssh-deploy template (companion to docs/hetzner-cloud-init.yaml)
# =============================================================================
# Pushes local code to the RetroMultiCiv Hetzner host + restarts the services.
# Sanitised reference copy — to use it:
#   1. Copy to the repo root:  cp docs/hetzner-ssh-deploy.sh ssh-deploy.sh
#      (root ssh-deploy.sh is gitignored — keep your filled-in copy private)
#   2. Replace every <PLACEHOLDER>:
#        <DEPLOY_USER>  — your server username (matches cloud-init `users:`)
#        <YOUR_DOMAIN>  — e.g. multiciv.example.com (or the bare IP)
#   3. chmod +x ssh-deploy.sh, then run ./ssh-deploy.sh
#
# ALLOWLIST deploy: only what the server RUNS is synced — client/ engine/
# shared/ data/ server/, the master-index + maintenance tools, and the package
# files (~120 files). Dev/internal files (docs, specs, tests, screenshots,
# CI, editor/agent config…) never leave your machine, and the box's runtime
# state (saves/, crashdumps/) is never touched. RetroMultiCiv is
# config-via-systemd-flags + FILE saves — there is NO .env to copy.
#
# The allowlist is deliberate: an earlier EXCLUDE-list version leaked agent
# config, specs, tests, screenshots and a binary .rbxl onto a public box.
# Exclude lists fail open — keep this an allowlist, and dry-run (rsync -avn)
# any change to the include set before deploying.
#
# The three self-heal steps below (dir ownership, ~/.npm ownership, npm-missing
# check) exist because Hetzner cloud-init's runcmd phase can silently fail to
# complete, leaving no Node and a root-owned /opt. See docs/how-to-host.md
# § "Deploy troubleshooting" for how to confirm that and replay the phase.
# =============================================================================
set -euo pipefail

DEPLOY="<DEPLOY_USER>@<YOUR_DOMAIN>"
APP="/opt/retromulticiv"
SSH="ssh -p 2222"    # add -i ~/.ssh/<your-key> if it isn't your default key

# ---- one SSH connection for the whole deploy --------------------------------
# Without this every step opens its own connection: three passphrase prompts on a
# key without an agent, three chances to be dropped mid-deploy, and three sshd
# auth attempts in quick succession (which rate-limiting can refuse). ControlMaster
# opens ONE connection, reuses it for every step, and closes it at the end.
MUX_SOCK="${TMPDIR:-/tmp}/multiciv-deploy-%r@%h:%p"
SSH="$SSH -o ControlMaster=auto -o ControlPath=$MUX_SOCK -o ControlPersist=300 -o ServerAliveInterval=30 -o ServerAliveCountMax=6"
cleanup_mux() { ssh -O exit -o ControlPath="$MUX_SOCK" "$DEPLOY" 2>/dev/null || true; }
trap cleanup_mux EXIT

# ---- key into the agent once, so the deploy prompts at most once ------------
# With multiplexing above, an agent-less key prompts exactly once per deploy.
# Loading it into a running agent makes that zero for the rest of the session.
# Skipped silently when no agent is running (ssh-add needs SSH_AUTH_SOCK) or when
# the key is already loaded — this is convenience, never a requirement.
KEYFILE="$HOME/.ssh/<your-key>"
if [ -n "${SSH_AUTH_SOCK:-}" ] && [ -r "$KEYFILE" ]; then
  if ! ssh-add -l 2>/dev/null | grep -q "$(ssh-keygen -lf "$KEYFILE" 2>/dev/null | awk '{print $2}')"; then
    echo "==> Adding the deploy key to your ssh-agent (once per session)"
    ssh-add "$KEYFILE" || echo "    (skipped — continuing; you will be prompted once)"
  fi
fi

# ---- deploy provenance guard (what is about to become public) ---------------
# This script deploys the WORKING TREE, not a tag: whatever is checked out here
# goes to the public box. Print the provenance and stop for confirmation when it
# is not a declared save point. `--yes` skips the prompt (CI / repeat deploys).
YES=0; [ "${1:-}" = "--yes" ] && YES=1
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  SHA=$(git rev-parse --short HEAD)
  MARKER=$(git tag --points-at HEAD | grep '^marker-' | tail -1 || true)
  DIRTY=$(git status --porcelain | grep -vc '^??' || true)
  echo "==> Deploying working tree: $BRANCH @ $SHA ${MARKER:+(tag: $MARKER)}"
  RISK=0
  if [ "${DIRTY:-0}" -gt 0 ]; then
    echo "    !! $DIRTY uncommitted tracked change(s) — they WILL be published"; RISK=1
  fi
  if [ -z "${MARKER:-}" ]; then
    echo "    !! HEAD is not a marker-NNNN tag — unreviewed work may be included"; RISK=1
  fi
  if [ "$RISK" -eq 1 ] && [ "$YES" -eq 0 ]; then
    read -r -p "    Continue anyway? [y/N] " REPLY
    case "$REPLY" in y|Y|yes|YES) ;; *) echo "    aborted — nothing was sent"; exit 1 ;; esac
  fi
fi

echo "==> Ensuring $APP exists and is owned by the deploy user"
$SSH "$DEPLOY" "sudo mkdir -p $APP/saves $APP/crashdumps && sudo chown -R \$(id -un):\$(id -gn) $APP && \
  if [ -d ~/.npm ]; then sudo chown -R \$(id -u):\$(id -g) ~/.npm; fi"

# Age snapshots are a BUILD STEP (dev bakes, rsync ships, the box never bakes).
# The bake only depends on the engine rulesets, and it is minutes of fast-forward
# in the post-doctrine density era — so skip it when data/*.json is unchanged
# since the last successful bake (stamp file, gitignored alongside the output).
SNAP_STAMP="data/age-snapshots/.deploy-ruleset-stamp"
RULESET_NOW=$(cat data/*.json | sha1sum | cut -d' ' -f1)
if [ -f "$SNAP_STAMP" ] && [ -f data/age-snapshots/manifest.json ] \
   && [ "$(cat "$SNAP_STAMP")" = "$RULESET_NOW" ]; then
  echo "==> Age snapshots already current for this ruleset — skipping the bake"
else
  echo "==> Freshening age snapshots (ruleset changed or first run; this takes minutes)"
  BAKE_T0=$SECONDS
  if node tools/bake-age-snapshots.js; then
    mkdir -p data/age-snapshots && echo "$RULESET_NOW" > "$SNAP_STAMP"
    echo "    bake completed in $((SECONDS - BAKE_T0))s"
  else
    echo "WARN: snapshot bake failed — hosted ?age= falls back to live fast-forward (correct, not instant)"
  fi
fi

# ---- shared-box sanity: are the NEIGHBOURS about to break us? ---------------
# This box hosts other games (ops/multi-game-hosting.md). Their configs share
# one nginx and one certificate, so their mistakes become our outage. Checked
# BEFORE we restart, so a bad neighbour is visible while the old process is
# still serving.
echo "==> Shared-box sanity"
$SSH "$DEPLOY" "
  # 1. nginx config validity. Not our file, but a broken one means the NEXT
  #    reload (ours, a neighbour's, or certbot's renewal) takes every site down.
  if ! sudo nginx -t 2>/dev/null; then
    echo '    !! nginx -t FAILS on this box — the next reload will drop EVERY site.'
    echo '       Output above names the file. Fix or unlink it before deploying.'
  fi
  # 2. do our ports still belong to us? a neighbour binding 8123 first turns our
  #    restart into a crash-loop that healthz alone reports as a dead server.
  for p in 8123 8200; do
    owner=\$(sudo ss -ltnp 2>/dev/null | grep -w \":\$p\" | grep -oE 'users:\(\(\"[^\"]+' | head -1 | cut -d'\"' -f2)
    if [ -n \"\$owner\" ] && [ \"\$owner\" != 'node' ]; then
      echo \"    !! port \$p is held by '\$owner', not node — a neighbour may have taken it\"
    fi
  done
  # 3. headroom. A neighbour filling the disk breaks our autosave writes; a
  #    neighbour eating RAM gets us OOM-killed even though we behaved.
  df -h / | awk 'NR==2 && \$5+0 > 90 { print \"    !! disk \" \$5 \" full — autosaves will start failing\" }'
  free -m | awk '/^Mem:/ { if (\$7 < 200) print \"    !! only \" \$7 \"MB available — OOM risk on this box\" }'
  # 4. who else lives here (informational: know your neighbours before blaming us)
  echo -n '    neighbours: '; ls /etc/nginx/sites-enabled/ 2>/dev/null | tr '\n' ' '; echo
"

echo "==> Syncing runtime code to $DEPLOY:$APP (allowlist)"
rsync -av --no-owner --no-group \
    --exclude 'data/custom-art' \
    --exclude '*:Zone.Identifier' \
    --exclude 'data/wiki-extract' \
    --include '/client/***' \
    --include '/engine/***' \
    --include '/shared/***' \
    --include '/data/***' \
    --include '/server/***' \
    --include '/tools/' \
    --include '/tools/master.js' \
    --include '/tools/serve-maintenance.js' \
    --include '/tools/host-selfcheck.sh' \
    --include '/package.json' \
    --include '/package-lock.json' \
    --include '/LICENSE' \
    --exclude '*' \
    -e "$SSH" \
    ./ "$DEPLOY:$APP/"

# One-time stale-artefact sweep: --exclude stops FUTURE pushes but does not
# remove what earlier deploys already put on the box. Zone.Identifier files and
# the local-only art directory are removed here; harmless to run every time.
$SSH "$DEPLOY" "rm -rf $APP/data/custom-art; find $APP -name '*:Zone.Identifier' -delete 2>/dev/null || true"

echo "==> Installing deps (ws) + restarting master + game"
$SSH "$DEPLOY" \
    "if ! command -v npm >/dev/null 2>&1; then \
       echo 'ERROR: npm not found on the server — Node is not installed.'; \
       echo 'Fix (on the server): curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs'; \
       exit 1; \
     fi && \
     cd $APP && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev) && \
     sudo systemctl restart retromulticiv-master retromulticiv-game && \
     sleep 3 && \
     systemctl is-active retromulticiv-game retromulticiv-master && \
     curl -fsS http://127.0.0.1:8123/healthz && echo ' <- game answering' && \
     curl -fsS http://127.0.0.1:8200/servers >/dev/null && echo 'master answering'"

# CONTENT CHECK: a half-finished rsync leaves a SERVING box on a mixed tree —
# healthz still answers 200. Compare the ruleset the box actually holds.
RULES_LOCAL=$(sha1sum data/rules.json | cut -d' ' -f1)
RULES_REMOTE=$($SSH "$DEPLOY" "sha1sum $APP/data/rules.json | cut -d' ' -f1")
if [ "$RULES_LOCAL" != "$RULES_REMOTE" ]; then
  echo "ERROR: deployed data/rules.json differs from local (partial sync?)"
  echo "       local $RULES_LOCAL != box $RULES_REMOTE — re-run the deploy"
  exit 1
fi
echo "    ruleset verified on the box ($RULES_LOCAL)"
# The sleep+healthz tail is the DEPLOY GUARD (2026-07-25 lesson, how-to-host
# troubleshooting #8): `restart` + an immediate is-active can report success
# while the unit crash-loops — boot-time validations (e.g. the --public-addr
# format check) lie dormant on a long-running process until the NEXT restart,
# i.e. this deploy. A dead listener now fails the deploy loudly.

# PUBLIC verification — through nginx and TLS, not just the loopback port.
# The loopback checks above prove OUR process is alive; they say nothing about
# whether the public site works, because they bypass nginx entirely. A neighbour
# with a broken server block, a default_server hijack, or an expired shared
# certificate takes the site down while 127.0.0.1 still answers happily. This is
# the check that would have caught it.
PUBLIC_HOST="${DEPLOY#*@}"
echo "==> Verifying the PUBLIC endpoint (https://$PUBLIC_HOST)"
PUB=$(curl -fsS --max-time 15 "https://$PUBLIC_HOST/healthz" 2>/dev/null || true)
if [ -z "$PUB" ]; then
  echo "ERROR: the public endpoint did not answer, though the local port did."
  echo "       That means nginx or TLS, not the game: check 'sudo nginx -t',"
  echo "       the certificate expiry, and whether a neighbour site grabbed the"
  echo "       default vhost. The old process may still be serving — check before"
  echo "       assuming an outage."
  exit 1
fi
case "$PUB" in
  *'"ok"'*) echo "    public healthz OK" ;;
  *) echo "ERROR: the public endpoint answered, but not with OUR health body."
     echo "       Another site is likely bound to this name (default_server or a"
     echo "       duplicate server_name). Body was: $PUB"
     exit 1 ;;
esac

echo "==> Deployed + verified serving."
echo "    Logs:        $SSH $DEPLOY 'journalctl -u retromulticiv-game -f'"
echo "    Bug reports: $SSH $DEPLOY 'ls -t /opt/retromulticiv/bug-reports | head'   # newest player 🐞 reports"
