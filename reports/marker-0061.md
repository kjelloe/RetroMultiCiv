# marker-0061 — A59 leader personality (the D3 prerequisite)

Every civ now has a LEADER with a personality — the data foundation the
diplomacy AI (D3), and later the personality-driven stance/mode work,
read from. Scoped narrow and golden-neutral-in-behavior: the data +
the read seam ship; the AI does not yet *behave* by personality (D3
is the first consumer).

## What shipped

- **data/civs.json**: all 14 civs gain `leader` (name) + `personality`
  — four INTEGER axes summing to 100 (aggression/science/growth/
  defense; Caesar 75/10/10/5, Shaka 100/0/0/0) + `favoriteWonder`.
  Integers, not the ally's 0.0-1.0 floats — floats throw at the
  rulesetHash stamp and drift cross-language (the bugfixer's Finding-1
  catch, ruling #1657). The 14-civ axis table was architect-authored
  from the ally's stated identities (2 had explicit numbers). Stance
  distribution: 3 aggressive / 2 science / 5 growth/builder / 3
  defensive / 1 balanced — the heterogeneous mix the "some civs must
  build wonders" vision wants.
- **engine/leaders.js + luau twin**: `personalityOf` (a civ's axes,
  else the stance's implied fallback so stanceless crafted states
  reproduce today), `stanceFromPersonality` (dominant axis, flat →
  balanced, deterministic tie-break), `favoriteModifier` (inert 0 —
  the seam exists; wiring is a later window). Nothing in the AI reads
  it yet.

## Three build-time calls (all ratified)

1. **favoriteUnit/beelineTechs — Caesar only** (the ally sourced only
   his); the other 13 omit them (omit-safe, inert in A59; the ally
   provides them or the favorite-wiring window does). No placeholders.
2. **Montezuma → oracle**: my table said hanging-gardens *if* Oracle
   wasn't a Civ1 wonder; the data check found Oracle IS one, so the
   delegated conditional un-substituted to the ally's original
   (oracle, distinct from Egypt's Pyramids).
3. **Lincoln → 'balanced'**: a flat 25/25/25/25 derives 'balanced'
   (a real stance; reconciles my table's [balanced] annotation with
   the §1 mapping). All 14 derived labels match the table.

Cross-language via a luau HARNESS (leaders-check.luau), not a
command-scenario — the seam is a pure READ, so a scenario doesn't fit
(the SO17 precedent); the harness hashes the derivation JS==Luau
(0x2dc7981f).

## Goldens (rulesetHash ripple, behaviorally neutral)

civs.json's checksum moved → the standard createGame re-record: A82a
16fcbaa5/6cdb3cb6/157b0f89/f6232af0, scenario 002 0x4b8aba3f, soak
0x636a7be0/0x94a07593/0x19512478/0xf68d015b, natural r395/p2/
0xe4985936, turn-100 anchor 0x636a7be0, ff-parity 0x0fa110e7. **Rounds
and winner UNCHANGED** (soak 400, natural r395 p2) — the
behaviorally-neutral signature VERIFIED (nothing reads personality in
the AI path). JS==Luau on the full soak + natural, not just turn-100.
Suite 609/609 (the lone SIGTERM red is the documented parallel flake,
green isolated). Pins synced.

## What it unblocks

- **D3 (AI diplomacy negotiation)** — the first consumer: reads
  personalityOf for demand/accept thresholds (aggressive leaders
  demand more, accept less; Gandhi signs peace, Shaka doesn't). Now
  buildable (A59 was its prerequisite).
- A later **personality-driven stance assignment** window (the
  assignment is still random; making it personality-driven is a
  behavioral window with its own elim-band sweep).
- The favorite-wiring window (favoriteModifier is inert scaffolding).
