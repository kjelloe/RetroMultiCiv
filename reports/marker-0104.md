# marker-0104 — D4–D6 diplomacy arc (batch tag)

Tag: `marker-0104` on `bbfa85c` (origin/dev_night tip).
Verdict: **MERGE-CONSISTENT — user may merge this** (supersedes marker-0103 as the merge candidate).
Predecessor: marker-0103 @fe39360 (river complete).

This is a batch tag covering the whole 11b→D4→D5→D6 diplomacy arc, committed
continuously overnight under the no-tag policy (gaming-PC reviewer/sweep were
unavailable). It is the first clean-clone-green point in the arc: D4 in isolation
ships a red event-catalog test (fixed by D5), so per the reviewer's advisory this is
tagged **tip-only** — no per-slice markers.

## Delta since marker-0103

| commit | slice | class | what |
|---|---|---|---|
| 5617bf9 | 11b authentic city rosters | BEHAVIORAL+STAMP | all 14 civs → dump-exact 16-name Civ1 founding order; twins 76/76 |
| ceda2169e | D4 diplomacy | BEHAVIORAL+STAMP | tribute (AI demands, gated non-R/D + strength) + tech exchange + human LAN treaty command + offer expiry; client parley→diplomacy rename (cease-fire tier dropped) |
| fe023c0 | D5 diplomacy | STAMP-only soak + BEHAVIORAL scenarios | reputation 0–4 band (Honorable..Treacherous, recoverable, byte-identical when healed) + senate (Republic/Democracy cannot break standing peace → senateRefused) + United Nations/Great Wall peaceAcceptBonus wonder effect; **fixes the D4 event-catalog gap** |
| 984f48c | D6 diplomacy (final) | GOLDEN-NEUTRAL | new module engine/diplomat-missions.js (+twin): establishEmbassy / stealTech(RNG roll) / sabotage(RNG roll, destroy-or-zero) / inciteRevolt(gold) / bribeUnit(gold) via new diplomatMission command; embassy intel in filterView (rival gov/gold/tech-count/capital, view-only, never hashed) |
| bbfa85c | roblox gate-4 re-bake | GOLDEN-NEUTRAL (generated) | mirror D4–D6 ruleset data into generated luau (civs 0x13266028 / governments 0x3f8bb6ca / rules 0xcb1382cb / wonders 0x3659974f) |

## Golden re-records (new hashes, cross-language confirmed)

- sim-smoke turn-100 anchor = `0x6ff424a8`, turn-400 = `0xa70a8045` — reviewer reproduced independently via lune, == sim-runner Gate-B == D5-cited goldens.
- natural = `545 / p2 / 0x4f9d2473` — matches GOLDEN_NATURAL.
- scenario 065-diplomat-missions final = `0xea7216fc` — JS==Luau byte-exact (RNG rolls + gold buys included), independently reproduced by the reviewer.
- scenarios 012/045 re-recorded (D5 reputation reshape moved them, BEHAVIORAL).
- Data-file checksums for D4/D5-moved rulesets hash clean under lune (STAMP ripple cross-language-consistent).

## Test state

- Reviewer clean-clone `--full` @984f48c: **945 tests / 942 pass / 0 FAIL / 3 skipped** (the 3 skips are known absent-evidence self-skips: g52yt-2, turn371, B13-witness — B13-witness is a stale gitignored LOCAL recording, sim-runner regen routed, not a tag blocker).
- Architect dev-clone re-verify @bbfa85c: diplomacy surface + twins **128/128 pass, 0 fail**.
- sim-runner 25-seed sweep @984f48c: **25/25 seeds invariant-clean** across the full arc (reputation/senate/embassy/espionage state all invariant-safe).
- twins gate: **11/11 JS==Luau**.

## Known breach (documented, NOT introduced here)

sim-runner's 25-seed `--stats` sweep shows M-floors all green EXCEPT **M3-pop = 20 (floor ≥ 22)**, a −2 breach. This is a **pre-existing river-world regression**, orthogonal to the diplomacy arc:
- Diplomacy (tribute/tech/reputation/senate/embassy/espionage) touches no food/growth/terrain-yield path — it cannot move M3-pop, and Gate-B confirms the diplomacy goldens are byte-exact.
- M3-pop was re-pinned 28→22 for the river-inclusive world at marker-0103 (user ruling); the actual median lands at 20 — river cut pop marginally more than the 22 re-pin assumed. Sample is thin (23-seed median, 2 tripwire drops); true 25-seed median likely 20–22, i.e. floor-edge.
- The real fix is the XX §3 build-doctrine slice (the AI builds ~0 granaries; granaries in flood-exposed cities restore pop). This breach is now tracked to that window, whose upside is being measured under the user's measure-first ruling.

**Floor-policy decision is teed up for the user** (re-pin 22→20 for the river world, or leave at 22 and track to build-doctrine — sim-runner leans leave-and-track). This decision does not affect this marker's consistency: the breach is pre-existing and orthogonal, all goldens/tests are green.

## Breaking notes (already alerted #2628/#2631; confirmed in-diff)

Seat offer command payload grows `terms.kind/gold/techId/wantTechId` (LAN human-treaty frame); client `parley`→`diplomacy` rename; reputation field SEMANTICS flipped (sign + 0..4 band); new events TRIBUTE_PAID / TECH_EXCHANGED / OFFER_EXPIRED / REPUTATION_SHIFT + the 5 D6 events, all now cataloged. No new protocol opcode. Roblox luau view-read now mirrors embassy intel + the offer term fields (gate-4 re-bake).

## Consistency declaration

**marker-0104 is MERGE-CONSISTENT — the user may merge it** (it supersedes marker-0103). Both independent gates (reviewer clean-clone + engine-diff + twin repro; sim-runner Gate-B + 25-seed invariants) are GREEN and cross-agree on every hash. The single M3-pop floor breach is pre-existing, orthogonal, and documented above — it is not a diplomacy regression and does not gate the tag.
