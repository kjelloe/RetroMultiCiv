# Civilopedia concept entries — v1 draft for the designer ally's editorial pass

*(2026-07-17. Same flow as the leader-dialogue pass: the architect drafts,
you voice/edit here in prose, hand it back, and the helper folds your final
text VERBATIM into `client/ui/pedia-concepts.js` — a golden-neutral client
edit, no engine/data change.)*

## What this is

The in-game Civilopedia (📖 / `?`) has DATA categories (units, buildings,
wonders, advances, governments, terrain — all rendered live from the
rulesets) plus these hand-written CONCEPT entries: the "how does this
mechanic work" prose a first-time player needs. The short ❓ quick-help
gives 2-line tips and deep-links here; these carry the depth.

## Constraints (please keep)

- **Original prose only** — this is an MIT repo; NEVER paste wiki sentences.
  Names and numbers (facts) are fine; sentences must be ours.
- **Length**: a readable card — deeper than the ❓ tip, but not a manual.
  Roughly the current length each (~4-7 sentences). Trim rather than grow.
- **Voice**: plain, direct, second-person ("you"), teaches by consequence
  ("a city stays productive as long as…"). Matches the A78 advice cards.
- **Accuracy**: every mechanic below is VERIFIED present in the engine
  (ZoC in movement.js, corruption/upkeep/luxuries in government.js,
  veterancy in cities.js, martial law in happiness.js). If anything reads
  wrong to you, flag it — do not describe a mechanic we don't have.
- **You may ADD or CUT concepts.** The module shape is stable; new entries
  drop in. Candidates you might want that aren't here: trade routes/caravans
  (deferred), pollution (deferred), the tech tree, wonders-vs-buildings.

## How to edit

Under each concept, either tweak the DRAFT in place or write your version
in the **ALLY:** block. Leave **ALLY:** empty = the draft ships as-is.
Reorder freely (the pedia lists them in array order — put the most
first-game-critical near the top).

---

### 1. happiness — "Happiness & luxuries"
DRAFT: Every citizen in a city is content, happy, or unhappy. Size alone
breeds unhappiness — the bigger the city, the more faces turn sour. You keep
the peace three ways: LUXURIES (spend part of your trade on entertainment via
the tax/science split), ENTERTAINERS (pull a citizen off the tiles so they
amuse the rest), and BUILDINGS like the Temple. A happy citizen can even
cancel out an unhappy one. A city stays productive as long as the unhappy
never outnumber the happy.
ALLY:

### 2. disorder — "Civil disorder"
DRAFT: When a city's unhappy citizens OUTNUMBER its happy ones, it falls into
civil disorder: it produces no shields and no taxes until you calm it (food
still grows, and the city can still starve or riot). Fixes: raise the
luxuries rate, convert citizens to entertainers, build happiness
improvements, or — under governments that allow it — station military units
for martial law. Leave a city in disorder too long under some governments and
it can topple your rule.
ALLY:

### 3. corruption — "Corruption"
DRAFT: A share of every city's TRADE is lost to corruption before it becomes
gold or science — and the loss grows with distance from your capital (the
Palace). Despotic and anarchic governments bleed the most; a Republic or
Democracy bleeds least. Your capital never suffers corruption, and the right
wonders and buildings cut it elsewhere. Corruption is why a sprawling empire
earns less per city than its size suggests, and why WHERE your capital sits
matters.
ALLY:

### 4. upkeep — "Upkeep & shields"
DRAFT: Cities produce SHIELDS (the hammer) — the raw material for units,
buildings, and wonders. But a standing army is not free: each government
grants a few free units per city, and every unit beyond that costs one shield
of upkeep per turn, drawn from the city that built it. An over-large army
starves its own cities' production. Buildings instead cost GOLD maintenance
each turn from the treasury. Balance what you build against what you can feed.
ALLY:

### 5. governments — "Government types"
DRAFT: Your government sets the rules your whole civilization plays by: how
high you can push tax or science, how badly corruption bites, how many units
you support for free, whether your people tire of war, and whether martial
law works. Despotism is the weak start; Monarchy and the Republic trade off
order against trade; Democracy earns the most but will not abide a long war.
Changing government means a spell of Anarchy first. See the Governments
category for each one's exact numbers.
ALLY:

### 6. veterancy — "Veterancy"
DRAFT: A unit that wins a battle can become a VETERAN, and veterans fight
harder — a bonus to both attack and defense that often decides the next
fight. Some barracks and wonders make every unit veteran the day it is built.
Veteran status is carried by the unit, not the city, so a hardened army is
worth protecting: those survivors are your best troops.
ALLY:

### 7. zoc — "Zones of control"
DRAFT: Every military unit projects a zone of control over the tiles around
it. An enemy unit cannot move directly from one tile next to your unit to
ANOTHER tile next to it — it must step away first, or into a tile you do not
threaten (moving onto your unit to attack, or into one of your cities, is
always allowed). Zones of control let a thin line of units screen a border or
a chokepoint far larger than their numbers. Civilian units like settlers and
diplomats ignore and exert no zone of control.
ALLY:

### 8. terrain — "Terrain, yields & specials"
DRAFT: Every tile yields some mix of FOOD (feeds citizens), SHIELDS (builds
things), and TRADE (becomes gold and science) — grassland feeds, hills and
mountains forge, ocean and rivers trade. Terrain also shapes war: hills,
mountains, and forest shelter a defender, open ground does not. Scattered
SPECIAL resources (a tile of Wheat, Coal, Gold…) pour out extra yield —
founding or working near them is worth the trip. See the Terrain category for
each type's numbers.
ALLY:

### 9. gamecode — "The game code"
DRAFT: Every saved game carries a short code — a fingerprint of the exact game
state. Anyone who loads that save should see the SAME code; if it differs, the
save was altered. The code lets a server, a friend, or your future self trust
that a game is genuine and untampered. It is verification, not a password:
knowing it proves a save is authentic, and (on a LAN) it doubles as the
passphrase to resume that specific game.
ALLY:

### 10. recordings — "Saving & recordings"
DRAFT: Press Shift+D at any time to download a REPLAYABLE recording of your
game — the starting state plus every command you gave. Re-run it through the
engine and it reproduces your game move for move, hash for hash; it is how a
game proves what happened. Hosted games autosave after every turn and resume
where they left off. Because the engine is fully deterministic, a recording is
a complete, verifiable account — not a video, but the real thing, re-playable.
ALLY:

### 11. garrison — "Fortify & garrisons"
DRAFT: A city with no military unit inside it is captured the moment an enemy
reaches it — your citizens will not fight. Move a defender in and FORTIFY it
(press F): a fortified unit digs in for a defensive bonus, and behind city
walls it is far harder to dislodge. Good defenders are cheap insurance; the
strongest defensive unit you can build, fortified in a frontier city, turns a
soft target into a costly siege.
ALLY:

---

## New concepts you'd like (add below, same shape)

ALLY:
