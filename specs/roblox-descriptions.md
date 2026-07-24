# Roblox experience descriptions (ally copy, 2026-07-25) + fact corrections

The ally's 500-char and 3000-char descriptions, captured VERBATIM
below for the publish session. Tone approved as-is (direct,
player-addressed, no superlatives). FOUR factual corrections are
required before publishing — numbers only, no tone change; apply
them in the published text and note back to the ally:

## Corrections (apply before publish)

1. **"14 terrain types including rivers" → 12** — the Civ1 set with
   River is TWELVE terrains (arctic, desert, forest, grassland,
   hills, jungle, mountains, ocean, plains, river, swamp, tundra).
   (Also: river ships in the ENGINE spine window — confirm it is
   live before the description goes up, or say "twelve terrain
   types" without the river call-out until it lands.)
2. **"21 civilizations" → 14 civilizations** — 21 is the WONDER
   count (likely the conflation). "14 civilizations and 21 wonders"
   preserves the ally's rhythm and is exactly true.
3. **"Up to 7 players/civilizations" → VERIFY against the actual
   Roblox seat cap** before publish (the browser build is
   size-capped up to 14 civs; the Roblox experience's server size
   may genuinely be 7 — whichever is true, print that number in
   both versions).
4. **"Founding Record" → "Founder's Record"** — the ally's own
   sanctioned in-product name (naming ruling 2026-07-24).

JOIN-STORY VERIFIED (user challenge, architect confirmed in
GameServer.server.luau — the earlier dependency flag was WRONG):
the Roblox experience ALREADY delivers the copy's promise natively —
Roblox servers are drop-in, the TAKE OVER pad seats a mid-game
joiner into a vacant regent-driven seat ("TAKE OVER AI CIV joins
it"), and the R22 regent-hold is exactly "your seat will be held"
(leave → the regent plays your stance → reclaim). Mechanism differs
from the Node late-join feature (random vacant human seat vs
second-strongest AI civ) but the player-facing promise is true
as written. No copy change needed on this point.

## 500-character version (verbatim)

> **A World Begun**
>
> Start with one city. Build a civilization that lasts.
>
> Settle new lands, discover technologies, and lead your people from
> ancient villages to the space age — while rival civilizations do
> the same. Every decision shapes a history that is yours alone.
>
> Up to 7 players. Full multiplayer, join mid-game. Every match is
> different. Every history can be replayed.
>
> *How far will your civilization go?*

## 3000-character version (verbatim)

> **A World Begun**
>
> Every great civilization started somewhere. Yours starts here.
>
> Place your first city on a world that has never been settled.
> Choose your ground carefully — rivers bring food, hills shelter
> mines, and the coast opens trade. What you build in the first
> turns will shape everything that follows.
>
> **Build across the ages**
> Guide your civilization from its earliest settlements through the
> ancient world, the age of empires, the industrial era, and into
> the modern age. Research technologies that change what your cities
> can build and what your armies can field. Each discovery opens new
> possibilities — and closes old ones.
>
> **Govern and grow**
> Your cities need food, production, and people who believe in what
> you are building. Manage happiness, expand your borders, and
> choose a government that fits the civilization you want to be. A
> republic governs differently from a monarchy. A democracy is
> powerful — but it demands stability to reach.
>
> **Compete with real players**
> Up to 7 civilizations share the world. Some will be rivals. Some
> may become partners. Negotiate, trade, threaten, or go to war —
> but remember that every other civilization is also building, also
> researching, and also watching the map. The player who reaches the
> space age first wins. So does the player who outlasts everyone
> else.
>
> **Join any game, any time**
> Games run continuously. Join mid-history and take command of a
> civilization already in motion. The world does not wait — but your
> seat will be held.
>
> **A world that remembers**
> When the game ends, your history does not disappear. The Founding
> Record captures the arc of your civilization: the cities you
> built, the wars you fought, the technologies you discovered, and
> the moment your story ended — or reached the stars. Every history
> can be replayed.
>
> **Faithful to the original**
> A World Begun is built on the rules of the 1991 classic that
> defined the civilization-building genre: 14 terrain types
> including rivers, 21 civilizations, a full technology tree,
> authentic combat, and a 545-turn calendar. Everything has been
> rebuilt for multiplayer from the ground up — but the game
> underneath is the one that started it all.
>
> *One city. One world. Every history can be replayed.*

## The "Play on Roblox" entry point (user-ruled, routed to the helper)

Setup screen: a **"Play on Roblox"** button next to "Join a LAN
game" — rendered ONLY once a Roblox experience URL is recorded
(a single client constant, empty until publish; one-line change at
publish time). Title text stays swappable with the naming constant.
