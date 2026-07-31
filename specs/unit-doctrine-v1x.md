# Unit-doctrine rulings (user, 2026-07-26) — diplomats, caravans, pillage-siege, air

The user's Civ-veteran doctrine for the concepts the coverage histogram showed
the AI never touches. Captured verbatim-in-substance for the design windows
that implement them (scheduling ruled separately — see the scope note at end).

## 1. Diplomats (the D6 AI gap)

- **Defensive**: the AI should keep at least one diplomat in an IMPORTANT
  BORDER CITY to thwart enemy diplomat attacks. **AUTHENTICITY VERDICT
  (reviewer #2798): counter-espionage is CIV 2** — Civ 1 diplomats are
  offense-only (the dump's Civ2 pages document the garrisoned-defender
  intercept: 20%/diplomat compounding, 40%/spy). Civ 1's only limiter is the
  once-per-city steal immunity, which our engine already implements. So the
  defensive half enters via the civ-mixing ruling AT THE v1.x WINDOW: label
  Civ2 provenance, copy the Civ2 shape (compounding per-garrison intercept,
  ALONGSIDE the Civ1 once-per-city immunity), user decides adoption.
- **Offensive (steal)**: a civ LAGGING IN TECH but with production capacity
  and sufficient garrison builds diplomats to steal tech from neighbors —
  especially when its reputation with that neighbor is already bad (nothing
  to lose).
- **Offensive (prep)**: incite-revolt or sabotage via diplomat as PREPARATION
  for an assault on a border city — weaken it before the attack lands.

## 2. Caravans (the A89 AI gap)

- **Peace economy**: PEACEFUL civs (at peace with neighbors) build caravans to
  establish trade routes and boost their own economy.
- **Wonder-help**: while a wonder is building, OTHER cities — once they have
  sufficient defenders and their important buildings in place — build caravans
  to speed the wonder (the classic caravan-chain).

## 5. Pillage-siege (authentic Civ 1 war doctrine)

In original Civ 1, the AI typically OPENED city assaults by pillaging roads/
railroads on the approach to the city, then around it — a siege posture that
cuts the defender's trade/production and reinforcement speed before the
assault. The current war doctrine (mass → odds-gated assault) skips this
entirely. PROVENANCE (reviewer #2798): plausible but NOT wiki-backed — the
dump doesn't document AI pillage patterns; this ships v1 on the user's
~1000h recall, labeled recalled-behavior (civ-mixing convention).

## 4. Air units (late-era war doctrine)

- **Fighters**: a civ in a LATE-ERA WAR keeps fighters for defense against
  enemy bombers (interception is the only counter).
- **Bombers**: used to reduce a besieged city's defender count before the
  ground assault (pairs with the pillage-siege posture).

## 6. Future Tech / rate posture (context, not a work item)

Future Tech is the end-game score sink once the tree is exhausted, beyond
what economy/lux need — more relevant in a PEACEFUL late game (high sci) than
a late-war game, where gold+lux fund the war and sci sits at 10–20%. The AI's
war/peace rate posture should reflect this when Future Tech becomes reachable
(long-horizon games; see the marathon measurement).

## 3. Nukes (user doctrine, added 2026-07-26 — was "as-is")

In Civ 1 nukes were RARELY deployed offensively — typically only by the most
aggressive civs/leaders, and only when trailing (2nd or 3rd place) with the
game drawing to a close: 2100 AD approaching, or a spaceship already launched
(the last-chance window). The trigger is therefore score-rank + endgame
proximity + aggression, not mere availability. RETALIATION is the other half:
once a civ uses nukes, the ATTACKED civ counter-attacks with its own — against
cities, or against very large attacking stacks. (Doctrine shape: a
desperation gate for first use; a retaliation flag that unlocks nuke-at-will
against the aggressor.)

## Confirmed as-is (user): spaceship launches (7) need no doctrine work now.

## Scope note — RULED (user, 2026-07-26)

**War pair = v1**: pillage-siege (§5) + air-war (§4) fold into W6's
war-adjacent slices (3/4) — small, authentic, visible in every game.
**Econ pair + nukes = v1.x**: diplomats (§1), caravans (§2), and the nuke
desperation/retaliation doctrine (§3 — near-unobservable before the marathon
measurements anyway) are new AI subsystems —
shelved to protect the 1.0 date; this spec is their opening backlog (the
diplomat-thwart authenticity check still runs now so the answer is banked).

## Scope note 2 — RE-RULED (user, 2026-07-27): econ pair PROMOTED to v1

The ECON PAIR (§1 offensive diplomat doctrine + §2 caravan doctrine) is
promoted into the v1 engine program as **W8**, sequenced AFTER W6
completes and after the W7 novelty-map-shapes window (W6 slices 3–5 →
W7 maps → W8 econ pair). Costed at ~2–4 days with full gates; the
mechanics all exist (D6 missions, A83/A89 caravans) — W8 is AI brain
only, one behavioral golden window.

Stays OUT of W8 / remains v1.x:
- §1's DEFENSIVE half (garrisoned-diplomat counter-espionage) — Civ 2
  mechanic (#2798), separate civ-mixing adoption decision.
- §3 nukes — v1.x pending the marathon measurement lane (user: "keep
  nukes v1.x pending the marathon lane").
Measurements (concept histogram, natural multi-seed, disasters-ON, and the
post-slice-2 additions: 14-civ scaling + endYear-9999 marathon) are all
approved — run them all, but they must NOT block the road to 1.0 if they drag.

## 8. Overseas expansion on saturation (v1.x — filed by user ruling 2026-07-31)

**The measured gap.** W7's naval acceptance found the AI treats ring,
inland-sea and oval as land maps: 0 overseas cities across 5×200t and 3×400t
runs, while the archipelago CONTROL reports 5 on the same probe (so the metric
fires when the behaviour happens). At 400 turns ring is saturated — ~117 cities
per game against ~112 of capacity — and the AI **stops expanding rather than
crossing**: only ~9 cities added between t200 and t400.

**Why the existing path misses it.** The naval settlement route triggers on a
STRANDED settler — a civ boxed in from turn one, which is the archipelago shape
and why that acceptance passed 25/25. On a ring each civ owns a generous arc and
always has a *local* site, so the stranded-settler condition never arises; when
the arc fills, expansion simply halts. The trigger is "no local site for THIS
settler", never "my landmass is full and there is land across the water".

**The doctrine to add.** When a civ's home landmass is saturated — no legal city
site left on its own land component — it should re-evaluate expansion across
water: pick the nearest known land component with room, ferry a settler, and
found there. The mechanics already exist (carrier ferry, disembark, overseas
site selection from the naval arc); this is a TRIGGER gap, the same shape as
W8's diplomat intent — the brain never asks the question, so a working mechanism
stays idle.

**How it must be verified** (the W6/W8 lesson, non-negotiable for this item):
not by a moved hash and not by a fixture alone. The acceptance number is
`debugging/probe-mapshape-naval.js` OVERSEAS CITIES on ring and inland-sea
rising above zero, with the archipelago control still non-zero and the canonical
floors unmoved. A fixture proves the AI *chose* to ferry; only the probe proves
the engine *accepted* the sequence end to end.

**Not a v1.0 blocker by ruling:** the shapes are opt-in and non-default, the gap
is opponent strength rather than correctness, and an unmeasured doctrine change
does not belong in a release candidate.
