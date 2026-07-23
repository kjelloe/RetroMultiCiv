# marker-0092 — the AI invades overseas + the rejoin/perf batch (MERGE-CONSISTENT)

Tagged at `0d265b4` (2026-07-24, away window). **MERGE-CONSISTENT —
supersedes 0091. Current merge candidate** (24th consecutive,
0069–0092). Double-green: Gate-B #2313 + reviewer engine-half #2314,
byte-exact, STAMP-ONLY confirmed by both.

## What changed (delta since 0091)

1. **Naval invade slice B (#35)**: a war-committed civ with naval
   superiority now composes an attack force, sails it via the
   presence-loop carriers, and assaults overseas enemy cities —
   launch gated by the fog-honest 3:1 heuristic
   (`invadeRatioPct=300`, counts only SEEN garrison), existing-war
   only (never declares), assault resolved by the UNTOUCHED per-unit
   resolveAttack per the reviewer's docs/15 fact-check. 2-continent
   fixtures + controls; twin byte-faithful.
2. **The rejoin bug closed, both halves** (user-hit): the server join
   path answers three ways — gameEnded (with the reason contract),
   on-demand save-reload after a restart (in-progress games survive
   redeploys now), true noSuchGame — and the client card is honest
   ("as of your last visit"), downgrades gracefully, and renders
   above the menu panel (the layout fix).
3. **The perf triple** (helper): ?age= fast-forward CHUNKS with a
   progress line (no more Firefox unresponsive-page); the
   age-snapshot baker + browser instant-load (21 presets incl. the
   user's 14-civ/medium row; a genesis-fidelity bug caught and fixed
   — baked rosters now replicate the browser's civ-shuffle exactly);
   `⚡ instant` hint in setup.
4. **Two root causes delivered** (bugfixer, builds routed GO):
   the REGENT-STALL (a hardcoded guard=10 caps AI-round traversal —
   ≥12 civs strands the active player on an AI seat; explains the
   user's 14-civ hangs on BOTH platforms; golden-neutral fix) and
   WORKERS>POP (disasters pop-drop skips trimToPop; the pre-existing
   archipelago wall the naval sweep hit — parent-identical, so not a
   0092 blocker; its fix re-opens the naval sweep acceptance).
5. Also banked: the fork pre-measure (#2309) — **bulb-tune RULED
   OUT** (0 launches through −30%); the untracked-file augment caught
   two more never-committed test files.

## Next

Regent-stall fix (golden-neutral, immediate) → workers>pop golden
window → naval sweep acceptance re-run → gov-reeval + the smalls tail.
User-return items: the fork decision brief, redeploy from THIS marker,
roblox-helper session restart, publish gates.
