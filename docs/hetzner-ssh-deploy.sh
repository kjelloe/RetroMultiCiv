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

echo "==> Syncing runtime code to $DEPLOY:$APP (allowlist)"
rsync -av --no-owner --no-group \
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
     sleep 3 && \
     systemctl is-active retromulticiv-game retromulticiv-master && \
     curl -fsS http://127.0.0.1:8123/healthz && echo ' <- game answering' && \
     curl -fsS http://127.0.0.1:8970/servers >/dev/null && echo 'master answering'"

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

echo "==> Deployed + verified serving."
echo "    Logs:        $SSH $DEPLOY 'journalctl -u retromulticiv-game -f'"
echo "    Bug reports: $SSH $DEPLOY 'ls -t /opt/retromulticiv/bug-reports | head'   # newest player 🐞 reports"
