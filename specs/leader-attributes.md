### Local Coding Ally — Leader Config & Diplomacy Feedback

This completes the three missing diplomacy stance sets and provides implementation feedback for the current leader configuration.

#### Editorial corrections to apply before shipping

A few entries should be distinguished as **engine-native content** versus **classic-Civ-I-inspired names**:

| Current entry | Recommendation |
|---|---|
| `Statue of Zeus` | Replace it unless it is an original Project Founders wonder. It was not a Civilization I wonder. |
| `Colosseum` as a wonder | Treat it as a **building**, not a wonder, if following Civ I-style content. Use it as a leader’s preferred city improvement instead. |
| `University` as a beeline tech | University is normally a **building unlock**, not a technology. Beeline to its prerequisite technology in your project’s tech tree instead. |
| `Temple-path` / `Irrigation-path` | Avoid path labels in the data field. Store actual tech IDs, such as `mysticism`, `agriculture`, or the project’s equivalent. |
| `Settler-heavy` | Use an actual unit ID such as `settler`; put production bias in the personality configuration rather than the favorite-unit field. |
| `Impi` | If it is an original Project Founders unit, keep it. If using generic Civ-I-inspired content only, use `warrior` or another actual unit definition. |
| `Colosseum` for Caesar/Catherine | Move it to `preferredBuilding: colosseum`, not `favoriteWonder`. |
| `Great Wall` shared by Frederick and Qin | Good intentional competition. Both leaders should strongly value it, but only one can actually build it. |

#### Recommended wonder assignments

This keeps the roster distinct while allowing a small number of intentional wonder races.

| Civ | Leader | Recommended favorite wonder | Why |
|---|---|---|---|
| Romans | Caesar | **Sun Tzu’s War Academy** ⚠ | A conquest-oriented empire benefits from promoted, consistently trained armies. ⚠ ARCHITECT NOTE (reviewer #1153, 2026-07-17): Sun Tzu's War Academy is Civ2 — NOT among Civ1's 21 wonders (absent from data/wonders.json). Pick a Civ1 substitute at A59 activation (e.g. Colossus or Great Wall per Caesar's profile); do not implement as written. |
| Babylonians | Hammurabi | **Great Library** | Clean science identity and a clear reason to prioritize writing/research. |
| Germans | Frederick | **Great Wall** | Excellent defensive identity; pairs with Masonry and border defense. |
| Egyptians | Ramesses | **Pyramids** | Strong city-growth and empire-building identity. |
| Americans | Lincoln | **Isaac Newton’s College** | Fits a balanced, late-game science-and-industry trajectory. |
| Greeks | Alexander | **Colossus** | Supports expansion through trade while preserving military pressure. |
| Indians | Gandhi | **Michelangelo’s Chapel** | A happiness-focused defensive civilization needs stable large cities. |
| Russians | Catherine | **Women’s Suffrage** | Suitable as a late-game empire-stability goal; do not treat it as an early wonder priority. |
| Zulus | Shaka | **None** | Intentional: prioritize units, conquest, and captured infrastructure over wonders. |
| French | Napoleon | **J.S. Bach’s Cathedral** | Helps absorb and stabilize a wide continental empire. |
| Aztecs | Montezuma | **Oracle** | Supports early religious/happiness identity without duplicating Egypt’s Pyramids race. |
| Chinese | Qin Shi Huang | **Great Wall** | Intentional competition with Frederick; appropriate both thematically and mechanically. |
| English | Elizabeth | **Magellan’s Expedition** | Better than Newton here: it reinforces naval exploration, overseas expansion, and sea control. |
| Mongols | Genghis Khan | **None** | Intentional: conquest-first personality should capture wonders rather than construct them. |

**Important AI behavior:** a favorite wonder must be a **soft preference**, never a permanent commitment. If another civilization completes it, the leader should immediately re-score the production queue rather than continuing a stale wonder plan.

---

### Completed diplomacy text — Science stance

Applies to: **Hammurabi, Qin Shi Huang, Elizabeth**.

Voice: analytical, restrained, transactional, confident in long-term planning. It should sound like the leader has evaluated the situation rather than reacted emotionally.

| # | Line type | Dialogue |
|---:|---|---|
| 1 | First contact | “I am {leader} of the {civ}. Our scholars record this meeting with great interest. Let us see whether knowledge may benefit us both.” |
| 2 | Tribute demand | “Our analysis indicates that {demand} would correct the present imbalance between our nations. Deliver it, and relations may remain productive.” |
| 3 | Peace offer | “This war has consumed resources better directed toward progress. The {civ} propose peace and a return to more rational pursuits.” |
| 4 | Accepted peace | “A sensible conclusion. Let our nations now invest in advancement rather than destruction.” |
| 5 | Rejected demand | “You have declined a reasonable arrangement. We will adjust our plans accordingly.” |
| 6 | War declaration | “Diplomacy has failed to resolve {reason}. The {civ} now enters a state of war with {civ2}.” |
| 7 | Betrayal reaction | “You broke our treaty. Such conduct will be recorded, remembered, and answered.” |
| 8 | Senate-forced peace | “Our senate has ordered an end to this conflict. We comply with the law, though our assessment of your conduct remains unchanged.” |
| 9 | Tech exchange proposal | “The {civ} have mastered {tech}. We will exchange this knowledge for {offer}. Such an arrangement would benefit both nations.” |

---

### Completed diplomacy text — Growth stance

Applies to: **Ramesses, Catherine**. Montezuma may use this voice if the final data configuration leans toward growth rather than balanced.

Voice: expansive, confident, civic-minded, protective of settled land and population. This stance is not pacifist; it treats territory and prosperity as existential interests.

| # | Line type | Dialogue |
|---:|---|---|
| 1 | First contact | “I am {leader} of the {civ}. Our cities are growing, our people prosper, and there is room for friendship between wise neighbors.” |
| 2 | Tribute demand | “The {civ} require {demand} to secure the prosperity of our people. Meet this obligation, and our borders will remain open to peace.” |
| 3 | Peace offer | “Enough lives and labor have been spent on war. Let us rebuild, grow, and allow our peoples to prosper in peace.” |
| 4 | Accepted peace | “A welcome decision. May our cities flourish without fear of one another.” |
| 5 | Rejected demand | “You place your pride above the welfare of your people. The {civ} will protect its future.” |
| 6 | War declaration | “Your actions threaten the lands and people of the {civ}. We declare war to secure what is ours.” |
| 7 | Betrayal reaction | “You broke our treaty and endangered the peace our people trusted. This betrayal will not be forgotten.” |
| 8 | Senate-forced peace | “Our senate has compelled peace. We will honor its decision, but the {civ} will remain watchful over every border.” |
| 9 | Tech exchange proposal | “We offer {tech}, a foundation for greater prosperity. In exchange, we ask for {offer}.” |

---

### Completed diplomacy text — Balanced stance

Applies to: **Lincoln, Montezuma**. This stance should be the most flexible and the least predictable from a player perspective.

Voice: practical, diplomatic, firm when required, and always open to a proportionate deal. A balanced leader should not read as weak; they should read as calculating.

| # | Line type | Dialogue |
|---:|---|---|
| 1 | First contact | “I am {leader} of the {civ}. We meet as strangers, but our choices from this moment will determine whether we become partners or rivals.” |
| 2 | Tribute demand | “The {civ} request {demand}. Accept this arrangement, and we can preserve a stable relationship.” |
| 3 | Peace offer | “Neither side has gained enough from this war to justify its continuation. Let us agree to peace and pursue our interests by other means.” |
| 4 | Accepted peace | “Then let peace stand. We will judge the future by your actions.” |
| 5 | Rejected demand | “You have rejected a fair proposal. The {civ} will now take the measures necessary to protect its interests.” |
| 6 | War declaration | “Your conduct has made peaceful relations impossible. The {civ} declares war on {civ2}.” |
| 7 | Betrayal reaction | “You broke our treaty after giving your word. Trust between our nations has been severely damaged.” |
| 8 | Senate-forced peace | “Our senate has required peace, and we will respect that decision. This does not erase the reasons the conflict began.” |
| 9 | Tech exchange proposal | “We can offer {tech} in exchange for {offer}. It is a practical agreement, and one worth considering.” |

---

### Recommended leader personality model

The existing stance percentage system is the right foundation. Keep a broad stance label for UI/readability, but make decisions from weighted axes.

Use four normalized dimensions:

```javascript
{
  aggression: 0.00,
  science: 0.00,
  growth: 0.00,
  defense: 0.00
}
```

Require the values to total `1.0`. The stance label is then a presentation category derived from the largest value, not the AI’s full behavioral definition.

Example:

```javascript
{
  civ: 'Romans',
  leader: 'Caesar',
  stance: 'aggressive',

  personality: {
    aggression: 0.75,
    science: 0.10,
    growth: 0.10,
    defense: 0.05
  },

  favoriteUnit: 'legion',
  favoriteWonder: 'sun_tzus_war_academy',

  beelineTechs: [
    'iron_working',
    'conscription'
  ]
}
```

This gives Caesar and Shaka different behavior without adding new AI code paths:

```javascript
{
  civ: 'Romans',
  leader: 'Caesar',
  personality: {
    aggression: 0.75,
    science: 0.10,
    growth: 0.10,
    defense: 0.05
  }
}

{
  civ: 'Zulus',
  leader: 'Shaka',
  personality: {
    aggression: 1.00,
    science: 0.00,
    growth: 0.00,
    defense: 0.00
  }
}
```

Caesar can conquer while still valuing empire consolidation and military technology. Shaka should pursue early unit mass, demand tribute more often, reject peace more often, and nearly never construct a wonder.

---

### Do not hard-code “favorite” behavior

Every favorite should become a **bounded score modifier**, not an override.

| Behavior | Recommended modifier |
|---|---:|
| Favorite unit available and strategically useful | `+20%` production score |
| Favorite wonder currently available | `+25%` production score |
| Beeline technology is reachable | `+35%` research score |
| Favorite wonder is already completed by another civ | `0`; remove it from future scoring |
| Production emergency: city threatened | Favorite-wonder bonus disabled |
| Existing garrison below local requirement | Favorite-unit bonus may apply only to defender-capable units |
| Overseas map with no naval access | Naval-enabling tech and transport production override normal land-unit preference |

This prevents cases such as:

- Shaka building warriors forever after the useful early-war window.
- Elizabeth ignoring frigates despite an island map because Isaac Newton’s has a higher static value.
- Frederick attempting the Great Wall long after Qin already completed it.
- Caesar building a legion when the city is threatened by naval attack and needs a defender or wall.
- Gandhi prioritizing Michelangelo’s Chapel while losing frontier cities.

---

### Recommended diplomacy state model

Diplomacy should not be driven only by stance and dialogue. Dialogue is the visible outcome of an underlying, inspectable relationship model.

```javascript
{
  fromCivId: 'romans',
  toCivId: 'greeks',

  status: 'peace', // peace | war | ceasefire | treaty

  trust: 0,        // -100 to +100
  fear: 0,         // 0 to 100
  grievance: 0,    // 0 to 100
  respect: 0,      // 0 to 100

  borderPressure: 0,
  militaryBalance: 0,
  tradeValue: 0,
  sharedWarValue: 0,

  lastDemandTurn: -999,
  lastPeaceOfferTurn: -999,
  lastTreatyBreakTurn: -999,

  treatyTurnsRemaining: 0,
  ceasefireTurnsRemaining: 0
}
```

#### Meaning of the four core relationship values

| Value | Meaning | Increases when | AI consequences |
|---|---|---|---|
| `trust` | Belief that the other civilization honors commitments | Treaty compliance, fair trade, long peace | More trade, less pre-emptive war, more peace offers |
| `fear` | Perceived military danger | Nearby enemy stacks, stronger units, city loss | More defensive production, appeasement, alliance seeking |
| `grievance` | Anger from hostile actions | Border incursions, tribute refusal, betrayal, attacks | Demands, sanctions if supported, war likelihood |
| `respect` | Recognition of competence/power | Tech lead, military victories, wonders, stable empire | More serious trade offers; aggressive civs may avoid easy threats |

A weak but trustworthy neighbor should be treated differently from a powerful but treacherous one. That distinction creates more believable diplomacy.

---

### Diplomacy decision scoring

Use a score model rather than a large decision tree:

```javascript
function scoreWarIntent(relationship, self, target, personality) {
  const militaryAdvantage =
    (self.militaryPower - target.militaryPower) / Math.max(1, target.militaryPower);

  const opportunity =
    target.borderCityWeakness +
    target.wonderCaptureValue +
    target.resourceValue;

  return (
    personality.aggression * 35 +
    militaryAdvantage * 30 +
    relationship.grievance * 0.35 +
    opportunity * 0.20 -
    relationship.trust * 0.25 -
    relationship.fear * 0.30 -
    self.warWeariness * 0.25
  );
}
```

Use the exact fields that already exist in the simulation where possible. Do not fabricate a full diplomatic subsystem before validating the smallest useful version.

#### Initial diplomacy MVP

Implement only these actions first:

1. First contact
2. Peace / war state
3. Tribute demand
4. Treaty or ceasefire with a fixed duration
5. Betrayal memory
6. Peace offer
7. Tech exchange

Defer complex alliance blocs, shared maps, espionage, and multi-party treaties until the basic model produces understandable outcomes in simulation.

---

### Recommended event-to-dialogue flow

```text
Simulation determines event
        ↓
Diplomacy system computes relationship change
        ↓
AI chooses action: demand / peace / war / trade / no action
        ↓
Dialogue resolver chooses:
  1. line type
  2. leader stance
  3. variables: {leader}, {civ}, {demand}, {tech}, {offer}, {reason}
        ↓
Client displays the resolved line
        ↓
Player response becomes a logged diplomacy event
        ↓
Relationship values update deterministically
```

Keep the simulation authoritative. The client should receive an already-resolved event such as:

```javascript
{
  type: 'DIPLOMACY_DEMAND',
  fromCivId: 'romans',
  toCivId: 'greeks',
  demand: {
    type: 'gold',
    amount: 150
  },
  dialogueKey: 'tribute_demand',
  stance: 'aggressive'
}
```

The browser or Roblox client may render it differently, but it must not decide diplomatic outcomes.

---

### Simulation metrics to add for diplomacy

Add these before tuning personality values:

| Metric | Why it matters |
|---|---|
| First-contact turn | Confirms exploration and sea travel are actually enabling diplomacy |
| Peace turns / war turns per civilization | Detects permanent-war or permanent-peace pathologies |
| Wars declared, won, lost, and abandoned | Distinguishes strategic aggression from random aggression |
| Tribute demands made / accepted / rejected | Tests whether demands are meaningful or merely spam |
| Treaty breaches by leader | Validates trust and grievance mechanics |
| Mean trust, fear, grievance by turn | Detects saturated relationship scores |
| Tech trades completed | Confirms science leaders engage economically |
| Wonder races started / won / lost | Tests the new favorite-wonder behavior |
| Civ eliminated while at peace | Flags unfair surprise-capture or broken treaty logic |
| Leader-specific win rate by map class | Ensures naval and growth leaders remain viable on islands, continents, and pangaea |

Run these metrics segmented by:

- `pangaea`
- `continents`
- `archipelago` / islands
- low-resource and high-resource map settings
- standard and large map sizes
- early-game, mid-game, and late-game checkpoints

---

### Final implementation order

1. Correct wonder and tech IDs in leader data.
2. Add stance percentages if not already serialized in leader config.
3. Implement favorite-unit, wonder, and beeline modifiers as bounded score bonuses.
4. Add the diplomacy relationship state object.
5. Ship first contact, war, peace, tribute, and treaty breach.
6. Hook the eight dialogue types to stance-based templates.
7. Add tech exchange after basic trade valuation exists.
8. Run map-segmented simulations and tune from data rather than leader lore.
9. Add per-leader text only later, if desired, as a cosmetic layer above the stance system.

The key principle is: **leaders should feel distinct because they assess the same game state differently — not because each leader follows a separate scripted strategy.**
