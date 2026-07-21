# marker-0082 — naval-truth (Bundle 2): the naval subsystem matches Civ1 (MERGE-CONSISTENT)

Tagged at `e1c69a9` (2026-07-21 evening). **MERGE-CONSISTENT — supersedes
0081. This is the current merge candidate** (14th consecutive consistent
marker, 0069–0082).

## What changed (delta since 0081)

The four naval-truth items from `specs/unit-truth-bundles.md` Bundle 2,
built by the engine lane against fact-pack #2135 and ruling #2137, in one
FULL golden window (per-unit sight ripples exploration; trireme rng):

1. **Per-unit sight**: `units.json` gains a `sight` field (2 for
   submarine/carrier/battleship/cruiser/bomber — the wiki-verified A71
   list; default 1). `engine/visibility.js` `unitSight` feeds
   `computeVisible`; the movement-reveal and diplomacy contact paths read
   the same value.
2. **Submarine stealth**: a rival submarine is hidden by `filterView`
   unless one of the viewer's SEA or AIR units is adjacent; land units
   never spot it. Server-side too (`server/game.js` threads the ruleset),
   so a `?server=1` client never receives a hidden sub. A stealth unit
   cannot attack land (combat canReach guard — polarity hand-verified by
   the reviewer in full-condition context).
3. **Trireme open-sea gamble**: NEW `engine/naval.js` (+ byte-shaped
   `luau/naval.luau`). At turn wrap, each `openSeaLoss` unit not adjacent
   to land rolls `rollRange(100) < 50` → lost, cargo drowns. Applies to
   ALL civs including AI (the Civ2 human-only shape was flagged as a
   drift trap and excluded). RNG-when-eligible: a game with no trireme on
   open water draws zero naval rng.
4. **Lighthouse + Magellan +1 ship move each**: `wonders.json`
   `shipMoveBonus`, additive +2 when both are held, labeled
   `original-pending-sourcing` (Civ1 sourcing for stacking unverified).

## The regen-wipe catch (process finding)

`node tools/mapdata.js` regenerates `units.json` — and the regen WIPED
fields prior windows had hand-edited into the JSON (`popCost`,
`attacksAir`, `ignoresWalls`, `freeSupport`). All restored via
`UNIT_OVERLAY` in `tools/mapdata.js`, which is now authoritative for
these fields; scenarios 046/049/050/051 reverted to their original pins.
Rule reaffirmed: generated JSON is never hand-edited — effects go in the
mapdata overlay tables.

## Golden re-record

Behavioral + rulesetHash. New pins: soak checkpoints ending
400=`0x037bcda6`; natural 545 rounds / winner p2 / `0x761ecb24`;
scenario 002=`0x3543d7d0`; NEW scenario 053-trireme-loss=`0xa84cdbb2`
(count 52→53, lossChancePct 100 override pins the loss deterministically).
Note: the author's build report quotes a different hash notation for the
same runs; the TREE pins above are the contract and the reviewer
reproduced the 400-pin byte-exact from Luau execution.

## Gates

- **Reviewer clean-clone + engine-diff GREEN** (#2141): 724 tests / 720
  pass / 1 fail / 3 env-skip, the lone fail being the known SIGTERM
  parallel-load flake (17/17 isolated re-run, path untouched by
  naval-truth). Luau 400-turn golden reproduces `0x037bcda6` == the JS
  pin. All six declared checks pass, including the regen no-op check and
  the sub-guard polarity read.
- **Gate-B**: the documented fallback (sim-runner session down) —
  author heavy Luau self-witness byte-exact (turn-100/400/natural all
  JS==Luau) + architect landing suites (full 724/724 + naval 8 +
  event-catalog 3 + luau-twins 9 + scenarios 54). Real Gate-B re-run
  invited on wake (queue item covers tags 0078–0082).

## Test state

Full suite green at the tag: 724/724 local (0 fail, 0 skip), pinned
counts consistent (`sync-check.sh`: README/plan-update/agent-workitems
all 724). Tree at tag holds only the next window's uncommitted work.

## Also in this marker's span (untagged commits since 0081)

- `63c80a1` agent-mail MAILBOX FLAG — the 10-minute poll floor
  (check/raise/lower + board 🚩 + guard-hook extension; user directive).
- `098be18` agent-mail.md deployment topologies + coordinator setup +
  new-agent onboarding templates (user request).

## For agents

Naval-truth locks released at the tag. Next per #2138 sequence:
danger-based abandon (the streak-field removal slice — landed separately
after this tag; fourth re-witness mandatory) → difficulty →
manhattan-gate → naval-loop.
