# Unit-truth bundles — the A71 audit leftovers, ruled into v1 (user, 2026-07-20)

Ruling: the units that exist but lack their defining Civ 1 ability are v1
work under axis 1 ("every Civ 1 system faithful"), sliced as THREE bundles.
Source audit: docs/01 § "Special-units audit (A71)"; engine evidence gathered
2026-07-20 (this spec's line references). All engine-behavioral → each bundle
is a golden window in the engine lane, queued behind calendar-545.
Provenance: `Civ1-authentic` except where a row is explicitly labeled otherwise (the Lighthouse+Magellan STACK is `original` pending sourcing).

## Bundle 1 — AIR-TRUTH riders (small; can ride any open window)

Two one-guard combat rules + two data flags:

1. **Fighter air-vs-air exclusivity**: the Fighter is the ONLY unit that may
   attack an airborne unit. Today `combat.js:115` lets any attacker whose
   domain/tile matches reach an air unit. Add: a target in flight is
   attackable only by an attacker with `attacksAir` (new units.json flag,
   fighter only). Defensive ground fire is NOT Civ 1 — no counterattack path.
2. **Bomber ignores City Walls**: the walls defense multiplier
   (`combat.js:60` region) is skipped when the attacker has `ignoresWalls`
   (new flag, bomber only). Great Wall follows the same skip (it is
   walls-everywhere).
3. **Upkeep exemptions** (folded here — same "flags + one guard" shape):
   `freeSupport` flag on diplomat + caravan → excluded from the shield-upkeep
   count (`cities.js:522` loop) AND from Republic/Democracy away-from-home
   unhappiness. Wiki-verified Civ 1 behavior.

Scenarios (code-free, test/scenarios/): fighter-vs-bomber allowed;
militia-vs-bomber-in-flight rejected; bomber-vs-walled-city multiplier
absent vs militia-vs-walled-city present; upkeep count with/without caravan.
Golden expectation: flags are inert until read → likely golden-neutral for
existing pins EXCEPT any sim seed where an AI attacked an air unit or a
walled city with a bomber — assume a re-record, verify with the
golden-neutrality guard (crafted/early byte-identical proof).

## Bundle 2 — NAVAL-TRUTH (medium; own golden window; "the sea keeps secrets")

One theme, one shared surface (the visibility model):

1. **Per-unit sight**: `sight` field in units.json (default 1; 2 for
   submarine, carrier, battleship, cruiser, bomber — the wiki-verified set).
   `visibility.js` reads it instead of the hardcoded radius-1. Cities stay
   radius 2.
2. **Submarine invisibility**: invisible to LAND units at any range; visible
   to sea/air units only when ADJACENT (range 1) regardless of their sight.
   Implementation inside `filterView()`/visibility (fog-honest: a hidden sub
   simply isn't in the filtered view — reuses the server fog machinery, and
   the client renders nothing it doesn't receive). Submarine may not attack
   land tiles (one guard, mirror of the sea-bombard allowance).
   AI note: AI target selection reads the same filtered knowledge —
   determinism preserved because visibility is already state-derived.
3. **Trireme open-sea loss — PROBABILISTIC (user re-ruling 2026-07-21,
   overriding the earlier deterministic draft; fact-pack 4 confirmed Civ 1
   is probabilistic)**: at turn end, a trireme not adjacent to a land tile
   rolls for loss via `engine/rng.js` — replay-deterministic (xorshift32,
   state-seeded), Civ1-authentic in feel. Odds: the dump documents NO
   number (fact-pack 4), so the chance is a `rules.json` knob —
   `triremeLossPct`, default **50**, labeled PROVISIONAL pending better
   sourcing; sweepable like any ruleset number.
   **RNG-stream discipline**: the draw happens ONLY when a trireme actually
   ends at open sea, in the fixed turn-end unit order — no draw, no stream
   shift, so games without exposed triremes hash identically to today.
   Scenario pins must include one exposed-trireme case to lock the draw
   ordering.
   **Lighthouse CORRECTED (reviewer provenance catch #1976 + architect
   ruling, consistent with the user's authenticity-first trireme call):**
   "Lighthouse saves triremes" is CIV 2, not Civ 1 — dropped. Civ 1's
   actual Lighthouse effect (fact-pack 1): **+1 movement for the owner's
   ships** — that is what this bundle implements, alongside **Magellan's
   Expedition +1** (same pack). Stacking (Lighthouse+Magellan = +2) is
   UNSOURCED — implement additive, label the stack `original` pending
   sourcing. Trireme loss therefore has NO wonder exemption, exactly as
   1991: you hug the coast or you gamble. (If the user prefers the Civ2
   safety-net as a deliberate mix, it re-enters as a labeled
   `Civ2-shape` row — surfaced, not assumed.)

Scenarios: sub invisible to adjacent land unit / visible to adjacent ship;
sight-2 battleship reveals at range 2; trireme lost at open sea + safe with
Lighthouse + safe coastal. Re-record expected: visibility changes ripple
into sim goldens (exploration order) — full golden window, JS+Luau twins
together (visibility.js has a Luau twin).

## Bundle 3 — DIPLOMAT MISSIONS (large; lands INSIDE D6, not separately)

Ruled home stands: docs/14 D6 ("embassies + intel — pairs with the Diplomat
unit's activation from A71", now ruled IN). The mission suite: establish
embassy, investigate city, steal tech (once per city), industrial sabotage,
bribe enemy unit. Consumed-on-use like the caravan. Reputation interplay
(sabotage/bribe discovered → grievance) is exactly why this waits for the
D4/D5 substrate instead of shipping as an orphan. No separate queue item —
D6's spec work picks this file up as its unit-side inventory.

## Sequencing

Engine-lane queue (single golden holder), after calendar-545 (N+1) and the
already-queued d3-server-surfacing + xiv-ai-behavior:

1. `air-truth-riders` (Bundle 1) — small; may ride an adjacent window if the
   holder agrees.
2. `naval-truth` (Bundle 2) — own window.
3. Bundle 3 rides D6 when the diplomacy line resumes (D4 → D5 → D6).

plan-version1.md carries the nodes; this spec is the detail the queue bodies
point at.
