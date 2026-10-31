# marker-0134 — P4: bankruptcy sells a building

**Tag:** `marker-0134` at `6181b51` · **merge-consistent — the user may
merge this** (supersedes marker-0133). BEHAVIORAL golden re-record (user
go 2026-10-30, alerted as human-workitems C2a). Saves keep loading; a game
whose treasury goes negative plays differently from a pre-P4 replay of it.

The tag is local only (no GitHub credentials in the agent shell):
`git push origin dev_night marker-0133 marker-0134`.

## Delta since marker-0133

| Commit | What |
|---|---|
| `220b5c5` | P4: bankruptcy sells the cheapest building (engine + Luau twin, re-record) |
| `7613a7f` | human-workitems: the re-record alert (C2a) |
| `6181b51` | pedia upkeep concept states the rule; marker skill push fallback; Roblox item 8 |

## P4 — what changed and why

Civ 1 force-sells a building when the treasury cannot pay maintenance; the
engine clamped gold at 0 instead, so over-building had no consequence
(`plan-version-1-patch.md` P4; a documented docs/01 §11 deviation). Now a
negative treasury at the turn wrap sells ONE building per turn: the
cheapest non-Palace building the player owns, ties to the earlier city in
cityOrder, then the lower building id. The credit (cost x sellPriceRatio)
goes through the shared `sellBuildingFrom`; the event is `buildingSold`
with reason `bankrupt`. Gold is clamped to 0 only when nothing is left to
sell. `sellForBankruptcy` in `engine/tech.js` and `luau/tech.luau`.

Fixture first: `test/scenarios/070-bankruptcy-sells.json` (red: gold 0,
temple kept; green: temple sold, gold 37; `0xe69221c4`), cross-language in
the twins list. None of the 69 existing scenarios moved.

Client: the turn log shows ", treasury empty"; the encyclopedia's upkeep
concept states the rule. Roblox: queue item 8 (that client has no turn-log
line for any building sale yet).

## Golden re-record

Round 100 byte-identical; both hash families move from round 200 (AIs do
go bankrupt in the long games). No new state fields.

| Pin | Old | New |
|---|---|---|
| GOLDEN_SOAK 200 / 300 / 400 | 0xee94526b / 0xc071aa36 / 0x7fee3918 | 0xd87202c1 / 0x124a4b4a / 0x4d3aa5ab |
| GOLDEN_NATURAL | 0x0877dae9 | 0xa571278e (545 rounds, p2 — tenth consecutive hold) |
| BEHAVIOR_SOAK 400 | 0x18b4976c | 0xc7b0d0b5 |
| BEHAVIOR_NATURAL | 0x42fb3338 | 0x0c5f1b2b |
| age-snapshot CANONICAL_PIN | 0x5efbd6f8 | 0xb1dc493e (rebaked) |

Luau `sim-smoke.luau 400` and `natural` reproduce every new pin.

## Breaking notes

- Goldens re-recorded (above). Replays of recordings made before P4
  diverge at the first turn a player's treasury goes negative.
- fastengine mirrors `engine/tech.js`: named in the `220b5c5` message.

## Test state

- `node --test test/`: 1079 tests. The full run flagged two pins (the
  age-snapshot hash, the twins scenario count/list); both fixed, and those
  files re-ran green (89/89). lune installed: twins run, no Luau skips.
- Playwright lane at `6181b51`: 65 passed, 2 skipped.
- Luau goldens: 400 and natural equal the new pins.
