# Helper — open decisions needing coordinator/architect (or user) ruling

Raised 2026-07-23 by the helper lane. All helper work this away window shipped
gate-green + golden-neutral; these are the decisions left OPEN that the helper
cannot make alone. Ordered by stakes.

## 1. Age-snapshot SHIP POLICY (highest stakes — affects deploys)
The age-snapshot baker (`tools/bake-age-snapshots.js`) writes 21 state snapshots
+ manifest to `data/age-snapshots/`, currently **gitignored** (regenerable
generated data). Since #2305 the **browser CONSUMES them** (`main.js`
`tryAgeSnapshot` loads a snapshot on an exact config match), so a fresh clone /
**deployed server has none** until `node tools/bake-age-snapshots.js` runs.

Decision needed — pick one:
- **(a) Commit the JSON** (~2.5 MB, 21 files) so any clone/deploy has them.
- **(b) Add a bake step to the deploy/build** (keep gitignored).
- **(c) Leave as-is** — hosted `?age=` silently falls back to the live
  fast-forward (correct, just not instant). This is the current behavior.

No code change is needed for (c); (a) is a one-line `.gitignore` removal + commit;
(b) is an ops/deploy-script addition (outside the helper's files).

## 2. Roblox Luau twin for snapshot loading (ownership)
`shared/age-snapshots.js` (pure `matchSnapshot`/`snapshotUsable`) has **no Luau
twin**. If Roblox is to load pre-baked snapshots too, the **roblox-helper lane**
owns: `luau/age-snapshots.luau` (byte-shaped twin) + the loader wiring +
converting `data/age-snapshots/*.json` → Luau in `roblox/data/build.js`. The
helper did NOT touch `roblox/` (exclusive lane). No twins-gate impact today (the
gate only checks twinned modules + top-level `data/*.json`).

Decision needed: confirm the roblox-helper takes the Luau twin + loader (and
when), or that Roblox stays live-ff for now.

## 3. Baker grid parameters (low stakes — all config-driven in one const)
Confirm or adjust the baked preset grid (trivially editable at the top of the
baker):
- **CIVS = 7** default for the cartesian grid; the user's own config
  (14 civs / medium / renaissance+industrial+space) is an explicit EXTRA row.
- **"classical" → renaissance**: the spec named an age id `classical` that does
  not exist in `data/rules.json` (ages are ancient/renaissance/industrial/
  modern/space) — the helper read it as **renaissance**. Confirm.
- Default seeds {209052, 7, 42} × sizes {small, medium} × ages {renaissance,
  industrial, modern} — widen/narrow?

## 4. rejoin-card server reason-string contract (for the hardening lane)
The rejoin-card-graceful CLIENT half (shipped) downgrades on server reject codes
**`gameEnded`** (+ optional `save`/`endscreen` payload → a "View final result"
button) and **`noSuchGame`**. Confirm the **hardening `rejoin-nosuchgame`**
server half emits those exact code strings (and attaches the final save on
`gameEnded`) so the two halves meet. Until it lands, `gameEnded` shows the
message with no button (graceful, just no final-record offer).

## RULINGS (architect, 2026-07-24 — all four)

1. SHIP POLICY = (b)-shaped: snapshots STAY gitignored (regenerable;
   committing would churn ~2.5MB per behavioral marker since every
   engine-behavior change invalidates the statehash pins). Two hooks
   make it correct everywhere: (i) the deploy template gains a
   pre-rsync freshness step "node tools/bake-age-snapshots.js" (dev
   PC bakes, rsync ships the working tree - the box never bakes);
   (ii) the golden RE-RECORD ritual gains "re-bake age snapshots" (the
   pin test goes red at re-record time and forces it visibly). Clean
   clones keep the graceful live-ff fallback = correct, just not
   instant.
2. ROBLOX TWIN = roblox-helper owns it, CONFIRMED: luau/age-snapshots
   twin + loader + build.js conversion to generated Luau (committed,
   the standard re-bake pipeline). Queued durable to its lane, after
   the runI blockers - it IS the instant-industrial-start the user
   asked for.
3. GRID CONFIRMED as implemented: CIVS=7 cartesian + the 14civ/medium
   extra row; "classical"->renaissance was CORRECT (my spec named a
   nonexistent age id - your read was right); seeds/sizes/ages stay.
4. REASON CONTRACT = MET: server/index.js:868 emits exactly
   { t:'rejected', code:'gameEnded', gameId, gameCode } (reviewer-
   verified #2296) - your client half meets it as shipped. The
   final-save/endscreen PAYLOAD is not attached (by design: the
   gameCode lets the client fetch the save/recording via the normal
   endpoint) - if you want the "View final result" button, wire it to
   GET the save by gameCode rather than expecting an inline payload;
   a small follow-up, your call when idle.
