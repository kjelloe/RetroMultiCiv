#!/usr/bin/env bash
# A96 host self-check — a nightly dependency audit with brakes.
#
# npm audit the live tree; if it is clean, do nothing. If it finds something,
# apply `npm audit fix` in a THROWAWAY STAGING COPY, run the FULL test suite
# there, and only if it is green swap the fixed lockfile back to the live tree
# and restart the service. The live tree is NEVER modified before the suite has
# passed on the fix — determinism and the dependency whitelist demand the gate.
#
#   tools/host-selfcheck.sh
#
# Meant for a nightly cron on the host, e.g.:
#   0 4 * * *  cd /opt/multiciv && tools/host-selfcheck.sh >> ~/selfcheck.log 2>&1
#
# Env:
#   MULTICIV_DIR          live tree (default: this repo root)
#   MULTICIV_RESTART      command to restart the service after a swap
#                         (default: "sudo systemctl restart multiciv"; set empty
#                          to skip the restart, e.g. under Docker)
#   MULTICIV_AUDIT_LEVEL  npm audit --audit-level (default: high)
set -uo pipefail

LIVE="${MULTICIV_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
RESTART="${MULTICIV_RESTART-sudo systemctl restart multiciv}"
LEVEL="${MULTICIV_AUDIT_LEVEL:-high}"

log() { echo "[selfcheck $(date -Iseconds)] $*"; }

cd "$LIVE" || { log "cannot cd to live tree $LIVE"; exit 1; }
if [ ! -f package-lock.json ]; then
  log "no package-lock.json in $LIVE — not a deployable tree; nothing to do"
  exit 0
fi

# 1. audit the live tree (read-only). npm audit exits non-zero when it finds
#    vulnerabilities at/above --audit-level.
if npm audit --audit-level="$LEVEL" >/dev/null 2>&1; then
  log "npm audit clean (level=$LEVEL) — no action"
  exit 0
fi
log "npm audit found issues (level=$LEVEL) — verifying a fix in staging"

# 2. staging copy: exactly what is deployed, minus the regenerable/host-only dirs
STAGING="$(mktemp -d)"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT
if ! command -v rsync >/dev/null 2>&1; then
  log "rsync is required for the staged fix; install it (apt-get install rsync)"
  exit 1
fi
rsync -a \
  --exclude node_modules --exclude .git --exclude saves \
  --exclude debugging/logs --exclude debugging/sim \
  "$LIVE"/ "$STAGING"/

# 3. install, fix, and GATE in staging — never on the live tree
cd "$STAGING" || { log "staging cd failed"; exit 1; }
if ! npm ci >/dev/null 2>&1; then
  log "npm ci failed in staging — aborting, live tree untouched"
  exit 1
fi
npm audit fix >/dev/null 2>&1   # semver-compatible fixes only (no --force)

if cmp -s "$LIVE/package-lock.json" "$STAGING/package-lock.json"; then
  log "npm audit fix changed nothing (a fix likely needs a major upgrade / --force)"
  log "MANUAL REVIEW needed — not applying anything automatically; live tree untouched"
  exit 1
fi

log "fix staged — running the full suite in staging (the gate)"
if ! node --test test/ >/tmp/selfcheck-suite.log 2>&1; then
  log "SUITE FAILED on the fix — NOT swapping; live tree untouched. See /tmp/selfcheck-suite.log"
  exit 1
fi
log "suite GREEN on the fix"

# 4. swap the verified lockfile into the live tree and rebuild deterministically
cp "$STAGING/package.json" "$LIVE/package.json"
cp "$STAGING/package-lock.json" "$LIVE/package-lock.json"
cd "$LIVE" || exit 1
if ! npm ci >/dev/null 2>&1; then
  log "npm ci FAILED on the live tree after swap — restart the service manually and review"
  exit 1
fi
log "live tree updated to the verified fix"

# 5. restart the service (unless disabled)
if [ -n "$RESTART" ]; then
  log "restarting: $RESTART"
  if eval "$RESTART"; then
    log "restart OK — self-check complete"
  else
    log "restart command FAILED — the code is fixed but the service needs a manual restart"
    exit 1
  fi
else
  log "MULTICIV_RESTART empty — skipping restart (restart the service yourself to load the fix)"
fi
exit 0
