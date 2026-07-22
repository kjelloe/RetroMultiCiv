# Ally deliverables 2026-07-22 — advisor card copy + 4 pedia concepts

Captured verbatim from the designer ally (via the user). The helper
wires FROM THIS FILE: 15 card texts into the advice.js trigger contract,
4 concept stubs into pedia-concepts.js. License: original ally prose.

ONE AMENDMENT (architect, branding compliance): the `concepts:victory`
stub says "A game of Founders ends…" — **Founders was WITHDRAWN** in
the branding round (Steam collision). Ship it as "A game ends in one of
four ways." — no title; everything else verbatim.

Engineering notes (ally's, adopted): all bodies ≤40 words; #13
diplo-audience + #14 pollution ship DORMANT (copy in place, trigger
fires when the D-line audience UI / A91 pollution event surface —
pollution events DO fire already since marker-0079, so #14 may be live
immediately; helper verifies); `[City]` in #6/#7 resolves to the real
city name at runtime; all cards neutral-client safe.

## The 15 cards

### #1 first-city — "Your first city"
This is where your civilization begins. Cities grow, produce units and
buildings, and generate research. Everything you build starts here.
→ concepts:cities

### #2 first-unit — "Units cost upkeep"
Every unit you build draws from your treasury each turn. A large army
on an empty budget causes disorder. Build what you can sustain.
→ concepts:upkeep

### #3 tech-choice — "Research is idle"
Your civilization is not advancing. Choose a technology now — every
turn without research is a turn your rivals are pulling ahead.
→ concepts:research

### #4 first-contact — "Another civilization"
You are not alone. Rivals expand, compete for land, and remember how
you treat them. Zones of control affect movement near their units.
→ concepts:zoc

### #5 first-war — "War has begun"
Undefended cities fall. Station at least one military unit in every
city you want to keep — an empty city is an open invitation.
→ concepts:garrison

### #6 disorder — "Civil disorder in [City]"
An unhappy city produces nothing. Build temples or colosseums, reduce
taxes, or change your government. Disorder left unaddressed spreads.
→ concepts:disorder

### #7 growth-stall — "[City] is starving"
A city that cannot feed itself stops growing and eventually shrinks.
Improve surrounding farmland or redirect production to food-generating
buildings.
→ concepts:cities

### #8 first-naval — "Your first ship"
Naval units move differently from land forces and open coastlines,
rivers, and eventually ocean crossings. Movement rules at sea reward
planning.
→ concepts:movement

### #9 goody-hut — "A tribal village"
Sending a unit into that hut may bring gold, a technology, a new unit,
or nothing at all. It may also disturb the locals. Worth the risk.
→ concepts:exploration (NEW stub below)

### #10 barbarian — "Barbarians spotted"
Barbarians attack undefended cities and settlers. Keep military units
close to your frontier — a garrisoned city is rarely their first
target.
→ concepts:garrison

### #11 wonder-available — "A wonder is within reach"
Wonders are built once in the world — whoever finishes first claims
it. If a rival completes it first, your production is lost. Decide
quickly.
→ concepts:buildings

### #12 new-government — "A new government"
Each government form changes how your civilization works — corruption,
unit upkeep, happiness, and war-making all shift. There is no
universally correct choice.
→ concepts:governments

### #13 diplo-audience (DORMANT until D-line) — "A rival seeks an audience"
Another civilization has sent terms. What you accept, reject, or
demand will be remembered. Reputation is slow to build and fast to
lose.
→ concepts:diplomacy (NEW stub below)

### #14 pollution (verify — A91 events fire since 0079) — "Pollution has appeared"
Industrial output leaves a mark. Pollution spreads, degrades tiles,
and — if ignored long enough — begins to warm the planet. Mass Transit
and recycling help.
→ concepts:pollution (NEW stub below)

### #15 endgame — "The end of the age approaches"
Roughly thirty turns remain. Your final score reflects every city,
technology, and wonder your civilization achieved. The history is
nearly complete.
→ concepts:victory (NEW stub below)

## The 4 pedia concept stubs (original ally prose)

### concepts:exploration — "Exploration and tribal villages"
The world beyond your borders contains tribal villages — remnants of
earlier peoples. A unit that enters one may receive gold, a technology
advance, a military unit, or nothing. Occasionally the village is
hostile. The outcome is not predictable, but the risk is usually worth
taking early in the game, when any advantage compounds. Villages do
not reappear once visited.

### concepts:diplomacy — "Diplomacy and audiences"
When a rival civilization wishes to negotiate, their envoy requests an
audience. You will be shown their terms — a peace offer, a tribute
demand, a technology exchange, or a declaration of war — and asked to
respond. You may accept, reject, or, where available, propose a
counter. Your reputation affects what rivals offer and whether they
trust your word. A civilization known to break agreements will find
future negotiations harder.

### concepts:pollution — "Pollution and global warming"
Industrial and nuclear production generates pollution on nearby tiles.
A polluted tile produces less food and resources until cleaned by a
worker. If pollution accumulates across the world without remedy,
global temperatures rise — coastlines and fertile land may convert to
desert or flood. Mass Transit reduces city pollution; recycling
centers help further. Nuclear detonations cause immediate, severe
local contamination. The effects are cumulative and shared across all
civilizations.

### concepts:victory — "Victory conditions" (AMENDED: no title name)
A game ends in one of four ways. Space victory: the first civilization
to launch a colony ship to Alpha Centauri wins outright. Conquest
victory: the last civilization to hold a city on the map wins. Score
victory: if the year 2100 is reached without a space launch or total
conquest, the civilization with the highest score wins. Defeat: if
your last city falls, your civilization's history ends — but the world
continues, and the full record remains available to replay.

## Also in the same reply (routed elsewhere)

- Space verdict ENDORSED: measure-first before pacing changes;
  "Emperor-tier spectacle" accepted as a legitimate outcome if the King
  sweep closes the gap (noted in specs/xii5b-space-project.md).
- Wonder-personality framework + 2 guardrails: adopted into
  specs/archetype-wonders.md; the wonder list the ally requested is
  specs/ally-ask-wonder-list.md (user relays).
