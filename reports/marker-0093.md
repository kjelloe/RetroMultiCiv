# marker-0093 — the two user-hit bugs die + the navy is proven (MERGE-CONSISTENT)

Tagged at `5b2d905` (2026-07-24, away window). **MERGE-CONSISTENT —
supersedes 0092. Current merge candidate** (25th consecutive,
0069–0093). Gates: reviewer both-fixes GREEN #2318 (194/194
engine-set, golden-neutrality confirmed both) + the FORMAL
invariant-checked naval acceptance PASS #2323 (25/25 archipelago
seeds, 0 violations) + the reviewer's own archipelago re-run 12/12
(was 0/12).

## What changed (delta since 0092)

1. **Regent-stall FIXED** (`ec0ade2`): the AI-round traversal guard
   was hardcoded to 10 — any game with ≥12 civs could strand the
   active player on an AI seat (the user's 14-civ hang, BOTH
   platforms). Now seats-derived, with a 12-civ round-completes repro
   test. Golden-neutral.
2. **workers>pop FIXED** (`00b95f2`): disaster pop-drops now call
   trimToPop (famine no longer leaves ghost workers). Cross-language
   scenario 058; golden-neutral on the golden seeds. This was the
   pre-existing archipelago wall — with it gone, the naval sweep
   went 0/12 → 12/12 and the formal acceptance passed.
3. **Perf fix 1** (`6ec3b98`, profile-first): the blockade scan now
   gates on the fat-cross bounding box before relationOf —
   hash-neutral proven, **~20% faster** on the 14-civ reference. The
   profile itself overturned all guessed suspects: the real costs are
   deepClone (23%) and this scan (22%); pollution/archetype/disband/
   naval are NOT in the top 22.
4. **Naval acceptance FORMAL PASS**: invade-B active at sweep scale
   (troops overseas median 10, captures 35, naval combats 144),
   zero invariant violations.
5. Rode along: the palace blurb trim (helper).

## Design rulings this window (architect authority, user-visible)

- **deepClone map-sharing (the 23% lever) SIGNED OFF as a design**
  with 5 mandatory conditions (single cow helper, permanent
  freeze-based aliasing test, byte-shaped twin, full hash-identity
  proof, sweep-gated review) + mechanism-A (module-transient with
  reset-at-entry contract). BUILDS IN A FRESH BUGFIXER SESSION —
  user-return item; the handoff (preopen + conditions + ruling) is
  complete.
- **gov-reeval reshaped by investigation**: the AI's gov problem is a
  RESEARCH gap (never researches republic/democracy), not gov logic;
  and the AI never issues upgradeUnit at all. Slices N1a (gov-tech
  beeline, IN BUILD) → N1b (democracy/era-war modulation) → N2
  (upgrade-in-city).

## Next

N1a lands → its gates → marker-0094; then N1b/N2, XV-engine, smalls.
User-return items: fork decision brief (bulb-tune RULED OUT #2309),
redeploy from THIS marker, roblox-helper restart (26-item batch
waiting), fresh bugfixer session for the deepClone window, publish
gates.
