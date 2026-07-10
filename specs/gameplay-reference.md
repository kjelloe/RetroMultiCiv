### The essential Civilization gameplay loop

The lasting appeal of Civilization is not any single system; it is a chain of **small, consequential decisions** that produces an unfolding empire story:

> **Reveal land → choose where to settle → grow cities → decide what to build/research → position units → react to rivals → repeat.**

For a POC, prioritize the decisions that make the player say: **“Just one more turn.”**

## Priority 1 — Must feel good in the POC

### 1. Explore unknown territory

Exploration is the initial hook.

The player needs to:

- Move an early scout/warrior/settler.
- Reveal fog of war.
- Find valuable terrain: rivers, coast, forests, hills, resources, chokepoints.
- Discover a rival civilization eventually.

**UI importance**

- Unexplored territory should be visually distinct.
- Newly revealed tiles should feel satisfying: short reveal animation, sound later, or subtle highlight.
- Hover/selection should show terrain name, yields, movement cost, feature, and resource.
- The player must instantly understand where a unit can move this turn.

**POC test:** At turn 1, does the player immediately have a reason to move in several different directions?

---

### 2. Found a city and select a location

This is probably the most important early-game decision in Civilization.

A city location determines:

- Nearby food and production
- Access to rivers/coast/resources
- Defensive terrain
- Future expansion room
- Whether the player has a strong or weak opening

For the POC, let players found a city quickly—but make the location meaningful.

**UI importance**

When a settler is selected, display a city-site preview:

- Valid / invalid settlement tiles
- Expected city yields
- Nearby workable tiles
- River/coast indicator
- A simple rating such as `Poor`, `Fair`, `Good`, `Excellent`
- The projected city footprint/radius

Avoid hiding why a location is good. Civilization is strategic because players can understand and compare options.

**POC test:** Can a new player answer “why is this location better than that one?” without reading a manual?

---

### 3. City growth and tile yields

The player needs a clear connection between map terrain and city success:

```text
Better land
  → more food / production / trade
  → faster growth and construction
  → more choices and power
```

This is the engine under the entire game.

At minimum, every city should visibly show:

- Population
- Food this turn
- Food surplus/deficit
- Growth progress
- Production per turn
- Current production and turns remaining
- Science or commerce contribution
- Worked tiles

**UI importance**

When selecting a city, make this information obvious in one compact panel. A player should never have to guess why a city is not growing or why production is slow.

Suggested city summary:

```text
New Haven — Population 2

Food:       5 produced − 4 consumed = +1 / turn
Production: 3 / turn
Research:   2 / turn

Growth:     7 / 20 food     (13 turns)
Building:   Warrior         9 / 20 production (4 turns)
```

**POC test:** Can the player understand a city’s output in under five seconds?

---

### 4. Choose what a city produces

City production is the recurring decision loop that makes the player feel like they are directing an empire.

Early choices should be simple but meaningful:

| Choice | Player intention |
|---|---|
| Settler | Expand to another city |
| Warrior | Explore and defend |
| Archer / Phalanx | Defend or fight |
| Granary | Grow faster |
| Library | Reach technologies faster |
| City Walls | Defend a vulnerable city |

A strong early choice is not always obvious:

- Build a settler now and delay defense?
- Build a warrior to explore?
- Build a granary and invest in future growth?
- Build a library to race toward a technology?

**UI importance**

Production selection should show:

- Cost
- Turns remaining
- Prerequisite technology, if locked
- What it does, in plain language
- A short recommendation for beginners, optionally

Example:

```text
Granary
Cost: 60 production
Estimated completion: 12 turns
Effect: Retains food after city growth.
Best for: high-food cities planning to expand.
```

**POC test:** Does selecting production feel like a strategic choice rather than an administrative menu?

---

### 5. Research and technological progression

Research gives players a medium-term goal. It turns basic actions into a plan:

```text
Research Bronze Working
  → unlock Phalanx
  → better defend frontier city
  → safely expand
```

For an early POC, use a small visible technology tree rather than a huge hidden list.

Start with perhaps 6–10 technologies:

- Pottery → Granary
- Bronze Working → Phalanx
- Alphabet → Writing
- Writing → Library
- Masonry → City Walls
- The Wheel → Chariot
- Map Making → Trireme

**UI importance**

The research panel should clearly show:

- Current research
- Progress and turns remaining
- Available choices
- Locked technologies and prerequisites
- Exact unlocks

Avoid technology choices that do not visibly matter.

**POC test:** When a player discovers a technology, do they immediately have a new action, unit, building, or strategic option?

---

### 6. Unit movement, positioning, and basic combat

Combat is important, but early Civilization’s magic is more about **positioning** than fighting every turn.

The player should be able to:

- Move a unit
- See movement range
- See terrain movement cost
- Fortify a unit
- Attack enemies
- Defend cities
- Understand why combat was won or lost

For the initial POC, simple one-unit-per-tile movement is ideal.

**UI importance**

When a unit is selected, show:

```text
Warrior
Health: 3 / 3
Movement: 1 / 1
Attack: 1
Defense: 1
Status: Ready
```

When targeting an enemy, show a simple combat prediction:

```text
Attack Warrior?
Your chance: Favorable
Your strength: 1.0
Enemy defense: 0.8
Terrain: Grassland
```

You do not need to expose exact percentages at first, but players should understand terrain and fortification effects.

**POC test:** Does the player understand that a defender on hills/forest/inside a city is harder to defeat?

---

### 7. End turn and consequences

The “End Turn” button is central to the Civilization experience. The player ends a turn and expects the world to react.

Each turn should produce visible outcomes:

- Cities grow
- Production progresses or completes
- Research advances
- Units refresh movement
- Fog reveals through moved units
- AI moves
- Events occur
- Notifications appear

If ending a turn does not create meaningful new information, the game will feel empty.

**UI importance**

The End Turn button should:

- Be prominent.
- Indicate if units still need orders.
- Explain why end turn is blocked, if you choose to block it.
- Summarize important results afterward.

Example notification feed:

```text
Turn 12 — 3760 BCE
• New Haven completed a Warrior.
• New Haven will grow in 4 turns.
• Your research into Pottery advanced: 14 / 25.
• An unknown civilization has been sighted to the east.
```

**POC test:** Does the player want to press End Turn because they are anticipating an outcome?

---

## Priority 2 — Add shortly after the basic loop works

### 8. Rival civilization contact

Meeting another civilization changes the game from optimization to competition.

At first contact, players should feel:

- Surprise
- Territorial tension
- Uncertainty
- Opportunity or threat

For MVP, a rival needs only:

- Different color and identity
- Cities and units
- Basic aggression/defense
- The ability to attack or be attacked

Diplomacy can initially be just:

- Unknown
- Peace
- War

Even this makes the map matter far more.

---

### 9. Territorial expansion and city spacing

Civilization is fundamentally about land. Players need to think about:

- Where the next city goes
- How close cities should be
- Blocking the AI from key terrain
- Defending a border
- Securing resources

For the POC, display city ownership/working radius clearly. You can add formal culture borders later.

---

### 10. Terrain improvements and settlers as workers

Settlers are especially satisfying when they can improve the world.

Classic actions:

- Build roads
- Irrigate for food
- Mine for production
- Clear forests
- Build railroads later

For your first playable build, start with just two:

| Action | Effect | Strategic purpose |
|---|---|---|
| Irrigate | `+1 Food` on valid tiles | Faster city growth |
| Mine | `+1 Production` on valid tiles | Faster building/unit creation |

Then add roads:

| Action | Effect |
|---|---|
| Road | Lower movement cost and/or `+1 Trade` |

This gives the player a satisfying “improve the empire” activity between wars and city choices.

---

## Priority 3 — Important for a fuller Civilization-style game

These systems make the game richer but should not delay the core POC:

- Diplomacy: treaties, tribute, alliances, ceasefires
- Trade and caravans
- Happiness, disorder, entertainers, luxuries
- Governments
- Wonders
- Naval exploration and transport
- Resources and strategic resource dependencies
- Barbarians
- Espionage
- Pollution and environmental effects
- Air units and nuclear weapons
- Multiple victory conditions
- Detailed city specialization
- Advanced AI personalities

---

## A recommended POC action set

If you are refining the UI now, these should be the complete player-facing actions to polish first:

| Category | Essential action |
|---|---|
| Map | Pan, zoom, inspect tile |
| Units | Select, move, fortify, skip, attack |
| Settler | Found city |
| Cities | Open city, select production |
| Research | Select research |
| Turn | End turn |
| Information | Inspect terrain, unit, city, and research |
| AI | Observe AI moves and encounters |
| Save | Save/load local session, once the loop is stable |

Then add:

| Category | Next action |
|---|---|
| Settler | Irrigate, mine, road |
| Cities | Select worked tiles |
| Diplomacy | Declare war / offer peace |
| Units | Disband, pillage, sentry |
| Empire | Change research rate / tax rate |

---

## UI refinement priorities

For the POC, I would focus UI work on **clarity, speed, and feedback**, rather than ornate panels.

### Main map needs to answer these questions instantly

1. **Where am I?**
   - Map position, turn/year, player color, explored territory.

2. **What is selected?**
   - Strong selected-unit/tile/city state.

3. **What can I do now?**
   - Contextual unit/city actions.

4. **Why would I do it?**
   - Yields, costs, turns, combat odds, and unlocks.

5. **What happened last turn?**
   - Clear notification log.

6. **What should I pay attention to?**
   - City completed production, unit awaiting orders, research finished, enemy spotted, city under threat.

### Suggested screen layout

```text
┌─────────────────────────────────────────────────────────────────┐
│ Turn 12 · 3760 BCE      Gold 24   Science 6   Pottery: 14 / 25 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         3D WORLD MAP                            │
│                                                                 │
│                                                                 │
├───────────────────────────────┬─────────────────────────────────┤
│ Selected Unit / Tile / City   │ Actions                         │
│ Warrior                       │ [Move] [Fortify] [Skip]         │
│ Attack 1 · Defense 1          │                                 │
│ Movement 1 / 1                │                                 │
│ Grassland · Food 2            │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│ Notifications                              [ End Turn ]         │
│ • New Haven is building a Settler — 5 turns remaining.          │
└─────────────────────────────────────────────────────────────────┘
```

For a desktop POC, this is more valuable than trying to recreate an old-game menu structure exactly.

---

## The key Civilization design principle

Every prominent action should create a meaningful tradeoff:

| Decision | Tradeoff |
|---|---|
| Settle here or explore farther? | Immediate city vs better location |
| Build settler or military unit? | Expansion vs safety |
| Build a building or a unit? | Long-term value vs immediate power |
| Research military or economy? | Defense/conquest vs development |
| Attack or fortify? | Risk vs map control |
| Improve food or production? | Growth vs construction speed |
| Expand wide or improve existing cities? | More territory vs stronger core |

If the POC consistently produces these tradeoffs, it will feel Civilization-like even with primitive town and unit models.

### Best next playtest checklist

Ask your coding ally and playtesters these questions after a 15–20 turn session:

1. Did you know what to do on turn one?
2. Was it clear why one city location was better than another?
3. Could you understand food, production, and research without explanation?
4. Did choosing production feel meaningful?
5. Did research unlock something that changed your plan?
6. Did terrain influence your movement or combat decisions?
7. Did you notice the AI and care what it was doing?
8. Did ending a turn produce useful or exciting feedback?
9. At any moment, were you unsure what was selected or which actions were available?
10. Did you want to continue playing after the planned test session?

The answers to those are more important right now than adding a large technology tree, wonders, governments, or advanced diplomacy.
