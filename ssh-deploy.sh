#!/bin/bash
# ssh-deploy.sh — push local code to the RetroMultiCiv Hetzner host + restart.
#
# Sanitised: set DEPLOY to <your-username>@<your-host>. RetroMultiCiv is
# config-via-systemd-flags + FILE saves — so there is NO .env to copy, and this
# EXCLUDES the server's runtime state (saves/, crashdumps/) so a deploy never
# clobbers live games. Auth is SSH key on port 2222 (see docs/hetzner-cloud-init.yaml).
set -euo pipefail

DEPLOY="<DEPLOY_USER>@multiciv.kjell.today"
APP="/opt/retromulticiv"

echo "==> Syncing code to $DEPLOY:$APP (excluding runtime state + local/dev files)"
rsync -av \
    --exclude node_modules \
    --exclude .git \
    --exclude saves \
    --exclude crashdumps \
    --exclude cloud-init.yaml \
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
