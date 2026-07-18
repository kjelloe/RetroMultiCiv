# marker-0057 — N12/A92 debug commands (engine half)

The recorded, taint-flagged debug surface, golden-neutral end to end.

One `debug` command with an action family — grantGold (negative
deltas allowed, clamped ≥0: that's how notEnoughGold paths get tested
from the debug surface), spawnUnit (mixed-owner stacks refused even
in god-mode — the core invariant outranks debug convenience),
grantTech (routed through the N11 grantTech seam, so it fires
Leonardo and obsolete-sell exactly like a real acquisition — and IS
the command path A4 goody huts will pin through), revealMap. Gated on
`state.debugEnabled`, stamped at createGame only when setup.debug is
true (omit-safe); no turn check (god-mode, any target player).

The trust-loop piece (user design, docs/07 family): the FIRST
successful debug command sets `state.debugUsed=true` PERMANENTLY, and
scenario 040 pins that the taint RIDES THE FINAL HASH — a debugged
game can never masquerade as a clean one. Rejected commands set no
taint.

Golden-neutral VERIFIED, not assumed: no ruleset change, both flags
omit-safe, debug never fires in the soak — the turn-100 anchor,
A82a, 002, and natural all byte-unchanged, no re-record. Scenario 040
= 0x678fe1c3 cross-language (PORTED 39); 5 unit-test rows. Suite
540/540; pins synced at the boundary.

## What it unblocks

- Roblox R17: the deck debug menu becomes a thin client of this
  engine surface.
- The browser --debug panel (client/server plumbing of setup.debug +
  the game-code DEBUG watermark + the gameOver/highscore flag) — the
  follow-up half of A92, routed to the helper lane.
- A4/N13 goody huts: the hut-trigger scenario path promised at
  marker-0056 now exists as a command.

docs/07's watermark note lands with the thin clients (no docs/01
change — dev tooling, not a game-spec mechanic).
