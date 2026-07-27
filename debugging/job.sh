#!/usr/bin/env bash
# job.sh — detached job runner for long sims (survives session/harness teardown).
#
# The launcher setsid-detaches the job into its OWN session + process group,
# with stdin/stdout/stderr cut from the calling shell; all state lives on disk
# under debugging/jobs/<id>/ so any later session (or another agent) can poll
# it. The filesystem is the hub — no server process.
#
#   debugging/job.sh run <id> -- <command ...>   launch detached, print a receipt
#   debugging/job.sh list                        one line per job (state, runtime)
#   debugging/job.sh tail <id> [N]               last N lines of out.log (default 20)
#   debugging/job.sh wait <id> [timeout-s]       block until DONE/DEAD (default 540s)
#   debugging/job.sh kill <id>                   kill the job's whole process group
#
# Per-job files: cmd (the exact command), out.log (combined output), pid,
# started/finished (epoch), status ("exit=N" written by the wrapper on finish —
# its ABSENCE with a dead pid means the job was killed from outside).
# A finished job's dir is rotated to <id>.old-<epoch> on re-run of the same id.
#
# Kill uses the NEGATIVE pgid, so worker children (e.g. soak.js --worker) die
# with the parent — no orphan workers eating CPU.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOBS="$ROOT/debugging/jobs"

state_of() { # $1 = jobdir -> RUNNING | DONE(exit=N) | DEAD | UNKNOWN
  local dir="$1" pid
  if [ -f "$dir/status" ]; then echo "DONE($(cat "$dir/status"))"; return; fi
  pid="$(cat "$dir/pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "RUNNING"; return; fi
  [ -n "$pid" ] && { echo "DEAD"; return; }
  echo "UNKNOWN"
}

cmd="${1:-help}"; shift 2>/dev/null || true
case "$cmd" in
  run)
    id="${1:?usage: job.sh run <id> -- <command ...>}"; shift
    [ "${1:-}" = "--" ] && shift
    [ $# -gt 0 ] || { echo "no command given after --" >&2; exit 2; }
    dir="$JOBS/$id"
    if [ -d "$dir" ]; then
      if [ "$(state_of "$dir")" = "RUNNING" ]; then
        echo "job $id is RUNNING (pid $(cat "$dir/pid")); pick another id or: job.sh kill $id" >&2
        exit 1
      fi
      mv "$dir" "$dir.old-$(date +%s)"
    fi
    mkdir -p "$dir"
    printf '%q ' "$@" > "$dir/cmd"; echo >> "$dir/cmd"
    date +%s > "$dir/started"
    {
      printf '#!/usr/bin/env bash\n'
      printf 'cd %q\n' "$ROOT"
      printf '%q ' "$@"; printf '\n'
      printf 'rc=$?\n'
      printf 'date +%%s > %q\n' "$dir/finished"
      printf 'echo "exit=$rc" > %q\n' "$dir/status"
    } > "$dir/wrapper.sh"
    chmod +x "$dir/wrapper.sh"
    setsid nohup "$dir/wrapper.sh" >> "$dir/out.log" 2>&1 < /dev/null &
    echo $! > "$dir/pid"
    disown 2>/dev/null || true
    echo "launched $id pid $(cat "$dir/pid") -> debugging/jobs/$id/ (poll: job.sh list | tail $id)"
    ;;
  list)
    [ -d "$JOBS" ] || { echo "(no jobs)"; exit 0; }
    found=0
    for dir in "$JOBS"/*/; do
      [ -d "$dir" ] || continue
      case "$dir" in *.old-*/) continue ;; esac
      found=1
      id="$(basename "$dir")"
      st="$(state_of "$dir")"
      start="$(cat "$dir/started" 2>/dev/null || echo 0)"
      end="$(cat "$dir/finished" 2>/dev/null || date +%s)"
      mins=$(( (end - start) / 60 ))
      lines="$(wc -l < "$dir/out.log" 2>/dev/null || echo 0)"
      echo "$id  $st  ${mins}m  out.log:${lines}L  $(head -c 100 "$dir/cmd" 2>/dev/null)"
    done
    [ "$found" = 1 ] || echo "(no jobs)"
    ;;
  tail)
    id="${1:?usage: job.sh tail <id> [N]}"; n="${2:-20}"
    dir="$JOBS/$id"
    [ -d "$dir" ] || { echo "no such job $id" >&2; exit 1; }
    echo "== $id  $(state_of "$dir") =="
    tail -n "$n" "$dir/out.log" 2>/dev/null || echo "(no output yet)"
    ;;
  wait)
    id="${1:?usage: job.sh wait <id> [timeout-s]}"; budget="${2:-540}"
    dir="$JOBS/$id"
    [ -d "$dir" ] || { echo "no such job $id" >&2; exit 1; }
    waited=0
    while [ "$(state_of "$dir")" = "RUNNING" ] && [ "$waited" -lt "$budget" ]; do
      sleep 10; waited=$((waited + 10))
    done
    st="$(state_of "$dir")"
    echo "$id $st after ~${waited}s"
    [ "${st#DONE}" != "$st" ]
    ;;
  kill)
    id="${1:?usage: job.sh kill <id>}"
    dir="$JOBS/$id"
    pid="$(cat "$dir/pid" 2>/dev/null)" || { echo "no such job $id" >&2; exit 1; }
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
      sleep 2
      kill -0 "$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
      echo "killed $id (pgid $pid, workers included)"
    else
      echo "$id already not running ($(state_of "$dir"))"
    fi
    ;;
  *)
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
