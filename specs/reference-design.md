I have all the necessary constraints to build the definitive **Project Founders Technical Specification**.

Before I dive into the generation, I will keep these "final guardrails" in mind to ensure the document is exactly what you need for a solo developer workflow:

1.  **Architecture First:** I will focus on the **Command-Dispatcher** pattern. In Node.js, this means your server is essentially a state-machine that accepts JSON commands. This is the "Golden Path" for porting to Roblox.
2.  **Data over Logic:** I will provide the tables (Units, Tech, Buildings) in a format that looks like **JavaScript Objects**, which are easy to convert to **Lua Tables**.
3.  **UI Separation:** I will treat the Three.js layer as a "dumb" view. It only knows how to move a unit mesh to `Map[x][y]` because the server told it to.
4.  **Reference Names:** Since we are making a Civ1-inspired game for local development, I will use familiar archetypes (Phalanx, Pyramids, Masonry) but structured for a modern engine.

**One final note on implementation:**
To keep the document readable, I will use **Level 3 and 4 headers** for easy navigation. I will include the **Tech Tree** as a logical graph and the **Units** as a balanced spreadsheet-style table.

I am ready. I will now generate the full comprehensive specification.

***

# Project Founders: Civilization-I Inspired Game Specification
**Project Code:** `founders-v1`  
**Architecture:** Node.js Backend / Three.js Frontend / Roblox-Ready Logic  

---

### 1. Vision & Engine Philosophy
Project Founders is a 4X turn-based strategy game designed to recreate the depth of early 1990s empire builders using modern web technologies.

#### 1.1 The "Logic-First" Rule
The game must be playable via a terminal (text-only) if necessary. The Three.js frontend is a visual plugin. All rules, combat, and growth happen in a **Pure Simulation Layer**.

#### 1.2 Determinism
The engine uses a seeded pseudo-random number generator (PRNG). This allows:
*   Perfect Replays.
*   Multiplayer synchronization by sending only user inputs (commands).
*   Identical behavior when logic is moved from Node.js to Roblox.

---

### 2. High-Level Architecture (The Roblox Bridge)

The project is split into three distinct modules:

#### 2.1 The State (Store)
A single, flat JSON object containing everything.
*   **Tiles:** Terrain type, improvements, owner.
*   **Units:** ID, type, location, status.
*   **Cities:** ID, population, production queue.
*   **Players:** Gold, science, discovered tech.

#### 2.2 The Action Reducers (The "Mind")
The logic is a set of functions that take `(State, Command)` and return `NewState`.
*   *JavaScript Pattern:* `function moveUnit(state, unitId, targetX, targetY) { ... }`
*   *Lua Equivalent:* `function GameState.MoveUnit(state, unitId, x, y) ... end`

#### 2.3 The Visualizer (The "Body")
Three.js listens for state changes.
*   When a unit is added to State, Three.js spawns a `Mesh`.
*   When `unit.x` changes, Three.js animates the `Mesh` position.

---

### 3. World Mechanics: Map & Terrain

#### 3.1 The Grid
*   **Size:** 64x64 (4,096 tiles).
*   **Topology:** Flat square grid. Map wraps on X-axis (East/West) but not Y-axis (North/South poles).

#### 3.2 Terrain Yield Table
Yields are calculated per-turn based on the tile being "worked" by a city.

| Terrain | Food | Prod | Trade | Move cost | Defense | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ocean** | 1 | 0 | 2 | 1 (Sea Only) | 0 | Needs Ship |
| **Grassland** | 2 | 0 | 0 | 1 | 0 | Can have Resources |
| **Plains** | 1 | 1 | 0 | 1 | 0 | Balanced |
| **Forest** | 1 | 2 | 0 | 2 | +25% | Good for production |
| **Hills** | 1 | 0 | 0 | 2 | +50% | High defense |
| **Mountains** | 0 | 1 | 0 | 3 | +100% | Barrier |
| **Desert** | 0 | 1 | 0 | 1 | 0 | Poor utility |
| **Tundra** | 1 | 0 | 0 | 1 | 0 | Arctic |

#### 3.3 Map Features
*   **Rivers:** Add +1 Trade to any tile they run through.
*   **Resources:** (e.g., Gold, Coal, Game) Add static bonuses to the tile yield.

---

### 4. The Technology Tree (Full Ancient & Classical)
Research is measured in **Science Flasks**. Each turn, a portion of the empire's Trade is converted to Science.

| Tech ID | Name | Cost | Prereqs | Unlocks |
| :--- | :--- | :--- | :--- | :--- |
| **alphabet** | Alphabet | 10 | None | Writing |
| **pottery** | Pottery | 10 | None | Granary |
| **bronze** | Bronze Working | 10 | None | Phalanx Unit |
| **masonry** | Masonry | 20 | None | Walls, Pyramids |
| **wheel** | The Wheel | 20 | None | Chariot |
| **writing** | Writing | 30 | Alphabet | Library, Diplomacy |
| **laws** | Code of Laws | 40 | Alphabet | Courthouse |
| **maps** | Map Making | 50 | Alphabet | Trireme |
| **iron** | Iron Working | 60 | Bronze | Legion Unit |
| **const** | Construction | 80 | Masonry | Aqueduct, Colosseum |

---

### 5. Unit Specification
Units have 3 main stats: **A/D/M** (Attack, Defense, Movement).

| Unit ID | Name | A | D | M | Cost | Tech Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **settler** | Settler | 0 | 1 | 1 | 40 | None |
| **militia** | Militia | 1 | 1 | 1 | 10 | None |
| **phalanx** | Phalanx | 1 | 2 | 1 | 20 | Bronze Working |
| **legion** | Legion | 3 | 1 | 1 | 20 | Iron Working |
| **chariot** | Chariot | 4 | 1 | 2 | 40 | The Wheel |
| **trireme** | Trireme | 1 | 0 | 3 | 40 | Map Making |
| **catapult** | Catapult | 6 | 1 | 1 | 40 | Mathematics |

**Unit Actions:**
*   **Settle:** (Settler only) Creates a new City.
*   **Fortify:** +50% Defense bonus.
*   **Wait:** Skip turn.
*   **Pillage:** Destroy an improvement on a tile.

---

### 6. City Management

#### 6.1 The City Screen Mechanics
*   **Center Tile:** Always worked for free.
*   **Worked Tiles:** A city works a number of tiles equal to its **Population**.
*   **Food:** Excess food (Total Food - 2 * Population) goes into the "Food Box."
*   **Growth:** When the Food Box fills, Population increases by 1.
*   **Production:** Total Shields generated by worked tiles are added to the city's current production item.

#### 6.2 Buildings
| Building | Cost | Maintenance | Effect |
| :--- | :--- | :--- | :--- |
| **Granary** | 60 | 1 | Retain 50% food after growth |
| **Library** | 80 | 1 | +50% Science in city |
| **Market** | 80 | 1 | +50% Gold in city |
| **Walls** | 80 | 2 | +200% Defense for units in city |
| **Temple** | 40 | 1 | Makes 2 unhappy citizens content |

---

### 7. Combat Mechanics (Deterministic Probabilistic)

Combat occurs when a unit enters a tile occupied by an enemy.

1.  **Calculate Total Attack Strength:** `A * VeteranModifier`.
2.  **Calculate Total Defense Strength:** `D * TerrainModifier * FortifyModifier * CityModifier`.
3.  **The Combat Resolution:**
    *   `P_win = A_total / (A_total + D_total)`
    *   Roll a random number `R`.
    *   If `R < P_win`, Attacker wins.
    *   **Result:** The loser is deleted from the game state. (Note: Civilization I combat is "death-matches.")

---

### 8. The AI (Simplistic Logic Controller)

The AI runs at the end of the Global Turn.

#### 8.1 Strategy: The "Expansionist"
1.  **Check Settlers:** If a Settler exists:
    *   If on a "Good" tile (Food > 2), Found a City.
    *   Else, move towards the nearest Coast or River.
2.  **Check Military:** If Unit is a Militia/Legion:
    *   If an enemy city is revealed, move toward it.
    *   Else, move toward the nearest Fog of War.
3.  **Check Economy:**
    *   Research: Pick the cheapest available tech.
    *   City Build: If city has no defender, build Phalanx. If city has defender, build Settler.

---

### 9. Frontend Rendering (Three.js Implementation)

#### 9.1 Data-to-Mesh Mapping
The frontend maintains a `Manager` class (or basic object) that stores:
*   `tileMeshes`: A grid of Low-Poly boxes.
*   `unitMeshes`: A dictionary of `unitId -> MeshInstance`.
*   `cityMeshes`: A dictionary of `cityId -> GroupInstance` (Label + Cube).

#### 9.2 The "Selection" Loop
1.  **Input:** User clicks a Mesh at `(X, Z)` in 3D space.
2.  **Lookup:** Find the tile at `(X, Z)`.
3.  **Action:**
    *   If `state.activeUnit` exists: Send `MOVE_UNIT` command to server.
    *   Else: Set `state.activeUnit` to the unit on that tile.

---

### 10. Development Roadmap (Next 10 Steps)

1.  **Mock State:** Create a static `state.json` with one map, one settler, and one AI.
2.  **The Renderer:** Make Three.js render the 64x64 grid from the JSON.
3.  **The Command Server:** A basic Node.js file using `ws` that reflects commands.
4.  **Movement Logic:** Implement the `moveUnit` function. Test it by clicking on the map.
5.  **City Founding:** Implement the `foundCity` function. Verify the map tile updates.
6.  **The Turn Cycle:** Add an "End Turn" button that triggers the AI and process growth.
7.  **Unit Production:** Add a UI overlay to pick what a city builds.
8.  **Research UI:** Add a technology selector.
9.  **Combat:** Add the ability for units to attack each other.
10. **Persistence:** Add `fs.writeFileSync('save.json')` to save the state.

---

### 11. Appendix: Roblox Porting Guide

| Feature | Node.js / JavaScript | Roblox / Luau |
| :--- | :--- | :--- |
| **Logic Storage** | `module.exports` | `ModuleScript` |
| **Game Loop** | `setInterval` / `setImmediate` | `RunService.Heartbeat` |
| **Data Sync** | `WebSocket.send(JSON)` | `RemoteEvent:FireClient(Table)` |
| **Visuals** | `THREE.Mesh` | `Instance.new("Part")` |
| **Map Grid** | Array of Objects | Array of Tables |
| **Randomness** | `seedrandom` library | `Random.new(seed)` |

---

### Final Project Structure Recommendation
```text
/founders-game
  /server
    - index.js        (Entry point)
    - engine.js       (The Reducers/Rules)
    - state.js        (The initial state & store)
    - data.json       (Tech, Unit, and Building tables)
  /client
    - index.html
    - style.css
    - app.js          (Three.js + UI Logic)
  /shared
    - constants.js    (Terrain types, Command types)
```

**Instruction:** 
To begin, start with **Step 1 and 2** from the Roadmap. Creating a static map and a Three.js viewer is the psychological breakthrough needed to see the game world for the first time.
