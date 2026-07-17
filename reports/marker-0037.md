# marker-0037 — H1: M-floor nightly RATCHET enforcement (golden-neutral)

- **Commit:** 83c4a4f (tag marker-0037)
- **Base:** marker-0036.
- **Type:** CI/tooling, golden-neutral (no engine/twin files).
- **Tests:** 454/454 zero-skip (full suite, integrated with marker-0036).
- **Status:** consistent, standalone-shippable.

## What this delivers

A93 asked to flip the nightly soak's M-floor checks from report-only to
enforcing. A plain flip would permanently red the nightly: 3 of 6 floors are
breached today (M2-cities 6 vs ≥8, M3-pop 35 vs ≥50, M4-impr 72 vs ≥75) — and
those are exactly the N-track's LIVE AI-quality targets (the economy/expansion
gap N9-fix is chasing). A permanent-red nightly trains everyone to ignore the
lane — the failure the reporting ruling exists to prevent.

Shipped instead as a RATCHET (helper's design, blessed #1058):

1. `tools/soak.js --enforce-floors <id,...>` — a pure `splitBreaches(results,
   enforced)` divides measured breaches into run-FAILING (listed ids, or ALL
   when the flag is absent so LOCAL runs stay strict) and ADVISORY (⚠ line).
   Only failing breaches count toward the exit. Unknown ids error out BEFORE any
   work, naming the valid ids.
2. `.github/workflows/nightly-soak.yml` drops `continue-on-error` and passes
   `--enforce-floors M10-buys,M10-treasury,M-resourceCov` — the three floors the
   AI clears today (51 / 0.13 / 100) become real gates (no silent regression);
   M2/M3/M4 stay ⚠ advisory in the summary.
3. The pinned comment now states THE RATCHET RULE verbatim: when the N-track
   clears a floor, ADD its id to `--enforce-floors` IN THE SAME COMMIT as that
   change's golden re-record. Each earned floor becomes permanent immediately.

## Coupling to N9-fix

This is the enforcement mechanism that will lock in the N9-fix gains. N9-fix
(production reorder) is chasing exactly M2-cities/M3-pop/M4-impr; when marker-0038
activates and the sim-runner confirms pop/bldgPct up, whichever of those floors
crosses its threshold gets added to the enforce list in that same re-record
commit — captured floor-by-floor, made permanent the moment earned.

## Tests

test/soak-floors.test.js: 10/10 (splitBreaches gating — enforced fails / unlisted
advises / null = all strict / pending never breaches / clean world empty; plus a
spawn test proving `--enforce-floors M99-bogus` exits 1 pre-run with the helpful
error). YAML parse-validated. Live-fire proof = tonight's scheduled nightly (goes
green with 3 advisories; a regression in any ratcheted floor now reds it).

## Files

tools/soak.js, test/soak-floors.test.js, .github/workflows/nightly-soak.yml.
