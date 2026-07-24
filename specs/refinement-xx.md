# Refinement XX — live-box batch (user, 2026-07-25 evening)

(The user labeled this XIX; XIX shipped — recorded as XX.) Testing on
the live box; recording: `debugging/logs/retromulticiv-turn888.json`
(a turn-888 marathon game — also useful late-game AI evidence for §3).

## 1. Pedia rename (helper; TRADEMARK FLAG for the user first)

Rename "Civilopedia" → user suggests **"Gamepedia"**. Two facts before
the string lands:
- Dropping "Civilopedia" is RIGHT — it is a Civilization-franchise
  term (same hygiene as the title work). The Roblox side already
  moved to "Gamepedia" in runL.
- BUT **"Gamepedia" is itself a Fandom brand** (gamepedia.com, the
  wiki farm) — trading one collision for another. RECOMMENDATION:
  implement the rename behind ONE constant (PEDIA_NAME) now, default
  it to the user's "Gamepedia" pending their call, and offer
  alternatives that tie to the sanctioned naming family:
  **"Founder's Guide"** (pairs with Founder's Record), or neutral
  "Encyclopedia"/"Guide". USER RULES the final string; the constant
  makes it a one-line swap (title-swappable discipline, same as the
  game title).
- Scope: pedia.js UI strings, the 📖 button tooltip, advisor/pedia
  link copy, pedia-concepts self-references. Roblox already done.

## 2. Game-start civ splash (helper)

Before the first turn, a discovery-card-style splash (the §26/§48
frame): "You lead the [Civ]" + the civ's pedia entry — leader,
personality/specialty (data/civs.json specialty + A59 leader), with
§22 hover-cards and links into the pedia for more. NOTE (accuracy):
Civ 1 has NO civ-unique units/buildings — the splash presents the
civ's SPECIALTY (the discount identity) and leader personality, not
invented unique units. Dismiss = Continue (the Founder's Record
Continue-gate idiom); shown once per game start incl. loads into
turn 0; suppressed under AUTOMATION.

## 3. AI/Regency city-role build doctrine (ENGINE — design captured
   verbatim-in-substance; measure-first before the window)

The user's directive: the AI (and regency) builds too few buildings
and plans badly — "there is no reason to have so much discontent,
only bad planning not building happiness buildings."

The doctrine, as ruled by the user:
- EARLY: granaries + barracks in food/production cities; libraries
  in a SELECT FEW good trade cities.
- FACTORY ERA: concentrate builders on a FEW good production cities
  (factory + hydro plant, nuclear later, coal plant worst-case);
  universities in science-priority cities; city walls ONLY in
  frontline cities.
- ALWAYS: happiness buildings (temple, colosseum) in every city that
  needs them — happiness is never optional.
- SPECIALIZE: a few production cities, a few science cities; a
  high-food/low-production city becomes a SETTLER SPAWNER.

Shape: city ROLE assignment (production / science / frontline /
spawner / default) derived deterministically from city geography +
empire context, driving the existing build-priority lever (extends
the archetype/N9 machinery — role beats generic priority). This is
an axis-3 REOPENING by user directive (axis 3 closed at v1 targets;
this raises the bar) — a full behavioral engine window with sweeps.

ROUTING: (a) sim-runner FIRST — a baseline measurement (buildings
per city by era + happiness-building coverage + discontent rates
from the canonical stats + the user's turn-888 recording) so the
window opens measure-first; (b) the engine window queues AFTER the
D4–D6 spine (axis-2 critical path holds priority) unless the user
promotes it; (c) the ally gets the doctrine FYI in the next update
(city personality is their territory too).

BASELINE DELIVERED (sim-runner #2547, 25 canonical seeds @1ff9e5a):
the AI builds ~0 city buildings of EVERY type at EVERY era (only
barracks/walls at 0.01/city); happiness-building coverage 0%
everywhere (disorder is held entirely by the lux-first playbook);
avgPop stuck ~3.1; era attrition 705 ancient → 75 industrial → 0
modernSpace cities. Build queues are effectively
{settler, defender, attacker}. Implication: the role-assignment
slice starts from an EMPTY baseline — highest leverage is
library/university (science role — attacks the research-depth
ceiling directly) and granary/temple (growth/happiness roles).
Harness: gaming-PC ~/sim-lab/build-doctrine-probe.mjs; the
river-world --stats sample is banked as a second reference world.

§1 RESOLVED (user, 2026-07-25): PEDIA_NAME = "Encyclopedia" —
generic, no brand collision. Applied @91fb9ee; Roblox swap queued
(#2612). The constant machinery stays (swappable discipline).
