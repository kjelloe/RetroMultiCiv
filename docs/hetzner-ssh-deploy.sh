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
# =============================================================================
set -euo pipefail

DEPLOY="<DEPLOY_USER>@<YOUR_DOMAIN>"
APP="/opt/retromulticiv"
SSH="ssh -p 2222"    # add -i ~/.ssh/<your-key> if it isn't your default key

echo "==> Syncing runtime code to $DEPLOY:$APP (allowlist)"
rsync -av \
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

echo "==> Installing deps (ws) + restarting master + game"
$SSH "$DEPLOY" \
    "if ! command -v npm >/dev/null 2>&1; then \
       echo 'ERROR: npm not found on the server — Node is not installed.'; \
       echo 'Fix (on the server): curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs'; \
       exit 1; \
     fi && \
     cd $APP && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev) && \
     sudo systemctl restart retromulticiv-master retromulticiv-game && \
     systemctl is-active retromulticiv-game retromulticiv-master"

echo "==> Deployed. Logs: $SSH $DEPLOY 'journalctl -u retromulticiv-game -f'"
