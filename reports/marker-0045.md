# marker-0045 — ruleset-compat pin + stance-view rider

- **Commit:** 0332757 (tag marker-0045)
- **Base:** marker-0044 + golden-neutral commits (docs long-tail + gates,
  ally cover note, tech-card spec, sync).
- **Type:** engine golden window (goldens re-recorded — the pin adds a field
  to every createGame state).
- **Tests:** 479/479 zero-skip; JS==Luau.
- **Status:** CONSISTENT — the merge candidate.

## Part 1 — stance-view rider (golden-neutral)

`filterView` passes `player.stance` through for ALL players (views are never
hashed). Stance is intentionally PUBLIC — Civ 1 showed leader personalities
openly. `RIVAL_PLAYER_KEYS` (the deep-audit whitelist of public rival
fields) gains `stance`. Unblocks the Roblox Statistics-panel Perfectionist
tag (R21's second half).

## Part 2 — ruleset-compat pin (reviewer-designed policy, adopted)

Hosted persistent games will span code updates; nothing pinned a save to
the rules that produced it.

- **Stamp at creation:** `createGame` writes `state.rulesetHash`
  ('0x7a1d0b92' for the default ruleset) = statehash of the loaded ruleset,
  via the ONE sanctioned engine→shared import (`shared/statehash`,
  docs/02 §4 rule 11); byte-shaped luau twin.
- **Strict at load:** server `--game` load + client save-load refuse a
  mismatched save naming both hashes, unless `--allow-ruleset-drift` (or
  the client confirm). Absent field = exempt (old saves/fixtures unchanged).
- **Lineage honest:** the pin is never rewritten on load — a
  drift-overridden game keeps its original hash (docs/07 §4).
- **Diagnostics warn-only:** tools/replay.js warns on stderr (stdout
  verdict-equality with the luau replayer unaffected).
- **Policy rule 3** (finish on the version you started) is operator
  guidance, not machinery — no migration in v1.

## Goldens (blast radius: every createGame state)

soak 0xefa3ae01/0xc782413c/0x8050f539/0x75910847, natural 0x842e5a94,
002-contract 0x34b9c127, A82a map-type anchors (4), witness 0x1d424e8a.
mapgen.test.js's cross-ruleset identity test legitimately needed a
compare-the-MAP fix (two different rulesets now stamp different hashes by
design); intent preserved. fastforward untouched (a==b determinism holds).

## What this buys

Hosted resume safety (refusal instead of silent divergence), match-report
corpus bucketing by ruleset (the #1118 ingest gate's precondition), and
replay debugging that says "wrong ruleset" instead of "weird divergence".

## Next in the stream

Settler food upkeep (user-ruled flat 1 food/settler) — the last ruled
engine item in the queue.
