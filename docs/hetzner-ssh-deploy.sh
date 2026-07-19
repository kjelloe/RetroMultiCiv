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
# RetroMultiCiv is config-via-systemd-flags + FILE saves — so there is NO .env to
# copy, and this EXCLUDES the server's runtime state (saves/, crashdumps/) so a
# deploy never clobbers live games. Auth is SSH key on port 2222 (see the
# cloud-init template's SSH-hardening block).
# =============================================================================
set -euo pipefail

DEPLOY="<DEPLOY_USER>@<YOUR_DOMAIN>"
APP="/opt/retromulticiv"

echo "==> Syncing code to $DEPLOY:$APP (excluding runtime state + local/dev files)"
rsync -av \
    --exclude node_modules \
    --exclude .git \
    --exclude saves \
    --exclude crashdumps \
    --exclude cloud-init.yaml \
    --exclude ssh-deploy.sh \
    --exclude .agent-mail \
    --exclude 'debugging/sim' \
    --exclude test-results \
    --exclude playwright-report \
    --exclude 'data/wiki-extract' \
    --exclude out.jsonl \
    --exclude resume.txt \
    -e "ssh -p 2222" \
    ./ "$DEPLOY:$APP/"

echo "==> Installing deps (ws) + restarting master + game"
ssh -p 2222 "$DEPLOY" \
    "cd $APP && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev) && \
     sudo systemctl restart retromulticiv-master retromulticiv-game && \
     systemctl is-active retromulticiv-game retromulticiv-master"

echo "==> Deployed. Logs: ssh -p 2222 $DEPLOY 'journalctl -u retromulticiv-game -f'"
