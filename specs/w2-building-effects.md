# W2 — Mfg. Plant + SDI Defense effects (engine window, architect)

Wiki-authoritative Civ1 semantics (dump-verified, not guessed):

## Mfg. Plant
Wiki `Mfg. Plant (Civ1)`: **"Production increased by 100%. Makes Factory obsolete.
Power Plants increase production."** (cost 320 / req Robotics / maint 6 — matches the
existing `data/buildings.json` entry, effect currently `{}`). Factory page confirms: "If
a Mfg. Plant is built in a city with a Factory, the Factory becomes redundant; it no
longer increases production and can be sold off."

Engine model (`engine/cities.js cityShieldOutput`, lines 796–814): `shieldBonus` is
SUMMED across buildings via `effectPct`, then DOUBLED if any `boostsFactory` plant (or
Hoover) powers the city. Factory = `shieldBonus:50` → +50%, powered → +100%.

**W2 change:**
- Mfg. Plant effect → `{ "shieldBonus": 100, "obsoletesFactory": true }`.
- In `cityShieldOutput`: if the city has a building with `obsoletesFactory:true`, EXCLUDE
  the Factory's shieldBonus from the sum (Civ1 "Factory redundant") — so Mfg alone = 100,
  Mfg+Factory = 100 (not 150), Mfg+plant = 200 (doubling still applies; "Power Plants
  increase production"). Keeps the doubling convention already used for Factory.
- Twin: `luau/cities.luau` mirrors byte-shaped.

## SDI Defense — DONE (2026-07-25)
Wiki `SDI Defense (Civ1)`: **"the only protection from the Nuclear Missile. With a 70% hit
rate… The SDI is actually a building and must be constructed within one of your cities;
each city requires one SDI Defense in order to be protected."** So Civ1 SDI protects ONLY
the city it stands in, at a **70% intercept roll**.

Engine (`engine/combat.js resolveAttack`, before the combat roll): when the attacker is a
nuke (`atype.nuclearBlast`) and the TARGET tile holds a city with a `blocksNuke:true`
building, roll `rollRange(state.rngState, 100)` — if `value < rules.sdiInterceptPct` (70)
the missile is intercepted: no detonation/area-kill/pollution, the garrison survives, the
one-shot attacker is still consumed. Emits `nukeIntercepted` (+ `unitConsumed`). The roll
draws the shared RNG ONLY when a nuke actually targets an SDI city → behaviour-neutral at
the sim seeds.

**W2 change:** `sdi-defense` effect → `{ "blocksNuke": true }`; new `rules.sdiInterceptPct`
= 70 (knob in data, per the "no hardcoded numbers" rule). Twin `luau/combat.luau` mirrors
byte-shaped. Fixture-first: `test/combat.test.js` 2 tests (pct-100 clone → intercept, no
halve, garrison survives, missile consumed; pct-0 clone → detonates through). Sabotage-
immunity for SDI/Palace stays a separate smaller item (not expanded here).

## Golden classification — STAMP-ONLY, combined W1+W2 re-record (2026-07-25)
Both Mfg. Plant and SDI are **STAMP-ONLY**: buildings.json + rules.json are in the
rulesetHash, so the createGame stamp ripples to every GOLDEN_* / scenario / age-snapshot /
ff-parity hash, but the TRAJECTORY is byte-identical (the soak never reaches Robotics or
Superconductor, and never fires a nuke at the sim seeds). VERIFIED via the #28 behaviour
discriminator on the FINAL combined re-record:
- BEHAVIOR_SOAK 0x7d88a531/0x47486030/0xd7aee69b/0xef6bf46c — UNCHANGED
- BEHAVIOR_NATURAL 0x8d3c2153 — UNCHANGED
- rounds 400/545 + winner p2 — UNCHANGED
So it is a paste-back STAMP re-record, not a trajectory change.

Re-recorded goldens (combined W1-already-landed + W2 stamp):
- `test/simulation.test.js` GOLDEN_SOAK {100 0x484da93c, 200 0xe40d5a2b, 300 0x529a0dec,
  400 0xa7c3a1b5} / GOLDEN_NATURAL finalHash 0xb6232e74.
- `test/scenarios/002-mapgen-determinism.json` final.hash 0x03465e9c.
- `test/age-snapshots.test.js` CANONICAL_PIN 0x67171377.
- `test/luau-twins.test.js` sim-smoke checkpoint 100 → 0x484da93c; FF_PARITY_PIN
  ff-parity 0xc247f5e7. (Data-file checksums are self-maintaining live JS==Luau.)

Unit fixtures: `test/cities.test.js` Mfg. Plant (fixture-first red→green); `test/combat.test.js`
SDI intercept + pct-0 control. Files: engine/cities.js, engine/combat.js, data/buildings.json,
data/rules.json, luau/cities.luau, luau/combat.luau, test/cities.test.js, test/combat.test.js
+ the re-recorded goldens. Reviewer gate + sim-runner STAMP-verify on the pushed sha.
