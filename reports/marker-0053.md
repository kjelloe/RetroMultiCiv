# marker-0053 — B28: the deep-audit catches up with the blockade

A small, test-only marker that restores measurement capacity.

Sim-runner's government acceptance run (#1385) found 3 of 25 soak
seeds failing a deep-audit invariant ("manual worker tile is not a
candidate tile") identically before AND after the government change —
deterministic, pre-existing. The initial attribution (C4 settler
automation) was corrected before filing: C4 is client-only code and
never loads in a headless soak. The grep-verified mechanism: the A79
blockade (marker-0047) drops enemy-occupied tiles from candidateTiles
BY DESIGN while the manual assignment persists (the citizen idles
until the enemy leaves) — the invariant predated that rule and fired
falsely.

Fix (test/sim-driver.js checkDeep): the invariant now mirrors the
blockade condition — a manual tile absent from the candidate set is
ALLOWED iff an enemy unit stands on it, and STILL flagged otherwise;
the failure message is self-describing for both cases (B9 doctrine).
Fixture-first with a revert-proof: a crafted state pairs an allowed
blockaded manual tile with a still-forbidden plain non-candidate;
neutering the fix flips the test (verified). The three named repro
seeds (3, 14, 24) run clean over 400 rounds.

Test-only, golden-neutral (checkDeep audits, never mutates). Suite
524/524; count pins re-synced at the boundary. The floor soak returns
to 25/25 effective seeds ahead of the next ratchet round.

## Also in the span

The gaming-PC train rebased onto marker-0052 with the catalog conflict
resolved as ruled (4-column layout + CP17 re-split); batch-4 swept
(Minimap/Tooltip/Palette); the marker-0052 re-bake trio pending its
follow-up sweep; roblox batch 5 (SO7/SO9/SO5/SO8 + the CP17 client
slice + a spectate proposal) started. Next in the game stream: the
golden-neutral trade.js seam bundle, then N11 field upgrades/Leonardo.
