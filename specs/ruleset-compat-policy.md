# Policy proposal: save/ruleset compatibility across versions

Advisory write-up from the reviewer; decisions belong to the architect/user.
Trigger: hosted persistent games (docs/12) will span code updates; today
nothing pins a save to the rules that produced it.

## Current state (verified at origin/dev_night b883c9c)

- docs/02 §7 shows `rulesetHash` in the save envelope, but NO JS code
  computes or checks it (zero grep hits outside docs) — the field is
  aspirational. Saves load as plain state.
- The Roblox lane HAS the concept (data/generated/RulesetHashes.luau, the
  8-file boot data gate) — the natural source of truth to mirror.
- The game code (docs/07) detects STATE tampering but not ruleset drift:
  a save replayed under changed rules diverges silently or mid-game.

## Proposed policy (three rules, one flag)

1. **Pin at creation.** createGame stamps `state.rulesetHash` — the
   statehash (shared/statehash.js, already cross-language) of the loaded
   ruleset object. One integer-string field, written once at creation, so
   it rides every save automatically. NOTE: this is a state-shape change →
   fixture first, both engines, one golden window, goldens re-record once.
   Doing it EARLY is the cheap moment (every later window inherits it).
2. **Check at load, default strict.** Server/client loading a save compares
   the pinned hash to the running ruleset: match → load; mismatch → REFUSE
   with a clear message naming both hashes. Operator override:
   `--allow-ruleset-drift` loads anyway (stamped into the game code lineage
   so replays/reports are honest about it). Scenario/test states without
   the field stay exempt (omit-safe, old fixtures unchanged).
3. **Finish on the version you started.** The 1.0 operator guidance
   (docs/12 how-to-host + the docs/16 quick-card): running games finish on
   the server version that started them; update between games. No
   migration machinery in v1 — migration is a non-goal until a real case
   forces it (and then it is an explicit tool, never an implicit load-time
   mutation).

## What this buys

- Hosted resume safety: an operator upgrading mid-season gets a refusal
  instead of a silently diverging game.
- Match-report corpus integrity (proposal #1118): the ingest gate can
  bucket recordings by rulesetHash — cross-version telemetry never mixes.
- Replay debugging: tools/replay.js can assert the recording's pin before
  replaying, turning "weird divergence" into "wrong ruleset" instantly.

## Non-goals (explicit)

- No semantic versioning of individual rules; the hash treats the ruleset
  as one unit. (Cheap, exact, and matches how the twins gate already
  checksums data files.)
- No save migration/upgrade tooling in v1.
- No enforcement for hand-crafted test states (field omitted = exempt).

## Decision points for the architect/user

D1: adopt rule 1 now (early golden window) vs at 1.0 — recommend NOW.
D2: strict-by-default at load (recommended) vs warn-and-load.
D3: whether the override stamps the game code lineage (recommended yes).
