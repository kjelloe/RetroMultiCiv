#!/usr/bin/env bash
# Save/recording summary — wrapper so agents stay inside `bash debugging/*`.
#   debugging/info.sh <file.json>
cd "$(dirname "$0")/.." && node debugging/save-info.js "$@"
