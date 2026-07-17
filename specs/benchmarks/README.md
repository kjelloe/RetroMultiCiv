# Human-benchmark corpus

Real-play recordings feeding the human-benchmark gap — the PRIMARY
AI-quality metric (specs/ai-modes-framework.md §A). Tracked here (not
debugging/logs/, which is gitignored) so they travel to the sim-runner's
clone for trajectory ingest.

Rules: contributor-consented only (these are the user's own saves);
player names stay seat-labeled; recordings restart at load points, so
FRESH-BOOT Shift+D captures (no loading) give the richest trajectories.
Replay-verify (`node tools/replay.js <file>`) before committing — a
divergent recording is debugging material, not benchmark material.

| file | game | scope | verified |
|---|---|---|---|
| retromulticiv-g1-3.json | user LAN 7civ 40×25, t256/1775AD | post-load tail (4 cmds) + rich t256 state; Aztecs(human) 2c/6u/37t vs Greeks(AI) 9c/111u/37t — the garrison-bloat class field-confirmed | 0x1ea16096 exact, 2026-07-18 |
