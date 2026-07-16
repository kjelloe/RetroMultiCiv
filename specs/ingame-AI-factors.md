Great discussion topic. The current test set covers the core resource-allocation dials well. Here are the additional factor groups I would argue should be included, roughly in priority order.

---

### 1. Technology path strategy

The research order is arguably the highest-leverage AI decision after city founding. Test:

- **Beeline vs. broad-front research** — does rushing one key tech (e.g. Monarchy for happiness, or Iron Working for legions) outperform balanced advancement?
- **Military-first vs. economy-first vs. science-first** research ordering
- **Era-gating thresholds** — at what science rate does the AI fall behind human-speed advancement and lose by tech gap rather than by army?
- **Luxury/happiness tech priority** — how early must the AI research happiness techs before city growth stalls?

This matters especially because your war lab already found that AI tech counts tripled when settlers started funding research — the research path itself is the next variable to isolate.

---

### 2. City placement quality

Beyond settler count and land/sea ratios, test:

- **Minimum city spacing** — 2 vs. 3 vs. 4 tile separation and its effect on long-run food/production yields
- **Coastal vs. inland founding preference** — especially on island maps where coastal cities unlock naval units and trade
- **Resource coverage rate** — what percentage of special resources fall inside a city's working radius by turn 50/100/200?
- **Capital distance** — how far from the capital does corruption make new cities unproductive, and does the AI account for this?
- **Chokepoint founding** — does placing a city at a land bridge or river crossing produce a measurable defensive advantage?

---

### 3. Economic management

- **Tax vs. science slider position** — the AI currently has a fixed or simple slider policy; test whether dynamic adjustment (high science early, high tax when at war) outperforms static settings
- **Luxury rate** — when does raising the luxury slider to prevent disorder outperform building temples/colosseums?
- **Rush-buy threshold** — at what gold reserve does rush-buying a unit or building produce a net positive outcome vs. saving?
- **Trade route exploitation** — does the AI prioritize road/railroad connectivity between cities to maximize trade income?

---

### 4. Government and revolution timing

- **Revolution timing** — at what turn/score threshold does switching from Despotism to Monarchy/Republic/Democracy produce a net gain after anarchy cost?
- **Government matching to strategy** — Despotism for early aggression, Republic for science/economy, Democracy for late-game happiness; does the AI switch at the right moment?
- **Anarchy risk tolerance** — how many turns of anarchy are acceptable given the current military situation?

---

### 5. Defensive posture and wall-building

Your war lab already identified this gap. Test specifically:

- **Wall build priority threshold** — at what threat level (nearby enemy cities, enemy unit count) should the AI queue walls before other buildings?
- **Garrison ratio** — units per city vs. distance from the front line; interior cities are over-garrisoned in most 4X AIs
- **Fortress placement** — does building fortresses at chokepoints reduce city captures measurably?
- **Zone of control exploitation** — does the AI use ZOC to slow enemy advances, or does it ignore it?

---

### 6. Diplomatic and threat assessment

Even before diplomacy is implemented, the AI makes implicit diplomatic decisions. Test:

- **Threat detection radius** — how far away must an enemy stack be before the AI shifts from expansion to defense mode?
- **Target selection** — does the AI correctly identify the weakest rival to attack rather than the nearest?
- **Alliance-equivalent behavior** — does the AI avoid attacking two rivals simultaneously, or does it overextend?
- **Barbarian response** — at what barbarian density does the AI divert military production from expansion to barbarian suppression?

---

### 7. Naval strategy (especially island maps)

This is currently underweighted in the test set. Test:

- **Transport build timing** — at what turn does the AI build its first transport, and does it correlate with available landing targets?
- **Naval escort ratio** — transports without escorts are trivially sunk; what escort ratio prevents transport losses?
- **Amphibious landing site selection** — does the AI land near weak cities or near resources?
- **Blockade behavior** — does controlling sea lanes around an island rival produce a measurable economic effect?
- **Island isolation** — on pure island maps, how does the AI's land-optimized expansion logic degrade, and at what water percentage does it need a separate policy?

---

### 8. Late-game and victory path awareness

- **Score vs. conquest victory pathing** — does the AI recognize when it cannot win by conquest and shift to score optimization?
- **Wonder priority** — which wonders produce measurable AI advantage vs. which are traps that delay military production?
- **Spaceship component priority** — once designed, does the AI correctly queue spaceship parts above other production?
- **End-game army composition** — does the AI correctly transition from ancient/medieval units to modern ones, or does it maintain obsolete stacks?

---

### 9. Terrain and movement efficiency

- **Road network investment** — at what city count does building roads between all cities produce a measurable military response-time advantage?
- **River crossing awareness** — does the AI avoid attacking across rivers when odds are unfavorable?
- **Mountain/forest chokepoint exploitation** — does the AI route armies through open terrain or use terrain for defense?
- **Movement point efficiency** — does the AI waste movement points by stopping units short of their optimal position?

---

### 10. Difficulty scaling levers

Rather than testing a single AI behavior, test **which levers produce the most human-perceived fairness at each difficulty**:

- Production bonus vs. starting units vs. tech head-start vs. faster growth
- At Trainer difficulty: does the AI deliberately make suboptimal choices, or just play with fewer bonuses?
- At God-Emperor: which combination of bonuses produces the hardest game without feeling arbitrary?

---

### Suggested experiment structure

For each factor group, the cleanest experiment design is:

```
Control:    current AI baseline, 100 games, fixed seed range
Variable:   one factor changed, same 100 seeds
Metrics:    win rate, game length, city count at turn 100/200,
            tech count at turn 100/200, unit losses, city captures,
            gold at end of game, happiness events, disorder turns
```

The most valuable cross-factor experiments are:

| Combination | Why |
|---|---|
| Research path × government timing | These two interact strongly — Republic needs science investment to pay off |
| Wall priority × garrison ratio × attack unit count | The siege warfare triangle your lab already identified |
| Coastal founding × naval build timing × transport ratio | The island map policy question |
| Tax slider × rush-buy threshold × wonder priority | Economic coherence under pressure |

---

### One meta-recommendation

Consider adding a **"human benchmark" baseline** to the simulation: record a set of real human playthroughs at each difficulty and measure the AI's metrics against those, not just against other AI configurations. The goal is not to maximize AI win rate against itself — it is to produce an opponent that a human finds challenging, legible, and fair. Those are different optimization targets.
