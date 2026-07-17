# marker-0044 — A54 off-turn pre-work (verified-core window, golden-neutral by measurement)

- **Commit:** b9be818 (tag marker-0044)
- **Base:** marker-0043 + the sync/spec/report commits.
- **Type:** verified-core engine change (paired twins), golden-neutral BY
  MEASUREMENT — the sim goldens never moved; scenario 011 added as the pinned
  cross-language contract (0x37dd1a6c, fixture-first: run RED before the change).
- **Tests:** 469/469 zero-skip at close (473 with the follow-on gate batch),
  browser e2e 16/16, playwright 12/12.
- **Status:** consistent; the merge candidate at tag time.

## What this delivers (player-visible)

While the AI plays its round — or while a rival human holds the turn in a LAN
game — the four SAFE commands now apply immediately from the waiting seat:
`setRates`, `setResearch`, `setProduction`, `setWorkers` (the self-scoped
whitelist). Everything else still bounces notYourTurn (pinned by the
scenario's rejected steps: foundCity, buy, etc.).

## Shape (the helper's judgment, ratified)

- The item sketched "loosen the turn check in applyCommand"; the real
  architecture has PER-FUNCTION checks — the change drops the notYourTurn
  line from exactly four self-scoped functions in engine/tech.js +
  engine/cities.js and their luau twins. `OFFTURN_WHITELIST` exported from
  both engine indexes as the cross-layer contract.
- SERVER: no protocol change needed — game.apply already stamps the seat and
  delegates; the engine was the single rejector. New ws case proves the
  waiting seat's setRates applies mid-rival-turn (asserted through the fog
  from its own view) while off-turn foundCity still bounces.
- LOCAL SESSION (flagged deviation, RATIFIED): whitelisted commands issued
  during the chunked AI round QUEUE and FLUSH AT ROUND END — not between AI
  turns as sketched — because the recording stores the round as ONE entry; a
  mid-round application would be invisible to the replayer. Flush-at-round-end
  keeps every existing recording valid and replay-exact (tested to the final
  hash). Between-AI-turns granularity = a recording-format decision, parked.
- UI enablement was FREE: the panels never disabled off-turn; the engine was
  the rejector (the A29 bounce pattern), so the flows just work.

## Also in the marker-0043→0044 span (untagged, golden-neutral)

v1.5 telemetry (15de89e — per-AI strategic snapshot + outcome rows in soak
--stats), the sync pass (counts 445→466, human-workitems evening block,
docs/15 stance section), spec exports + the 0-byte repair, the node-v24
test-runner fix, docs sync from the reviewer sweep (stale rows, ratified
deviations), roblox re-bake + world-look toggle manifests.

## Next in the stream

marker-0045 = the ruleset-compat pin window (bugfixer; stance pass-through
rider first), opened on this base.
