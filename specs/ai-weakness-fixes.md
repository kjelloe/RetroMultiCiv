# AI weakness fix strategies (user + designer ally, 2026-07-16 night) — VERBATIM APPENDIX

*(Ally+user joint table extending the sim-runner's N-ledger (#601)
with fix strategies; received from the user. The architect's
adopted slicing lives in agent-workitems "AI-QUALITY WAVE 2".)*

| Rank | Finding | The number | Suggested fix strategy |
|---|---|---|---|
| 1 | **Naval + air entirely absent** | Zero ships or aircraft ever built, any seed — the AI is physically trapped on its start continent; this is crossWater=0's root cause | Add a **map-type probe at game start**: count ocean tiles within 6 tiles of each AI city. If ratio exceeds a threshold (e.g. >30% water), set a `navyPriority` flag that injects `trireme` / `galley` into the production queue after the first 3 land units. Gate aircraft on a separate `airUnlocked` flag that fires when the relevant tech is researched. Without the probe, the production scorer never sees water as a threat vector and naval units score zero forever. |
| 2 | **Government monoculture** | 138/138 civs are Monarchy at t401 — one revolution, then never again; the whole economy capped at Monarchy's ceiling | Replace the one-shot revolution check with a **periodic government re-evaluation** every 20 turns. Score each available government against current city count, happiness, science rate, and war status. Add a `revolutionCooldown` counter (minimum 40 turns between revolutions) to prevent thrashing. Republic should score higher than Monarchy once city count > 6 and no active war; Democracy once happiness is stable and science is the win path. |
| 3 | **Tech ceiling ~medieval** | Median 27 techs; industrialization→modern→space essentially unreached (largely downstream of #2) | Fix #2 first (Republic/Democracy unlock the science slider). Then add a **tech-era urgency multiplier**: if the AI is more than one era behind the leading civ, double the weight of the cheapest tech in the next era. Also enforce a minimum science rate floor (e.g. never below 40% science slider) regardless of gold pressure — the AI should take a gold deficit before it takes a science deficit. |
| 6 | **Leader runaway** | Score spread to ~21× — the oldest finding, still no catch-up dynamic | Implement a **relative-score catch-up modifier**: if an AI civ's score is below 50% of the leader's score, boost its production weight for settlers and science by 1.3×, and reduce its war-initiation weight (stop wasting production on wars it cannot win). This is the standard 4X rubber-band approach. Do not apply it to the human player — only to AI-vs-AI gaps, so the human still feels pressure from the leader. |
| 7 | **Wonder failure** | The median civ completes zero wonders in 400 turns — the wonder race is uncontested | Add a **wonder opportunity window check**: each time a wonder becomes researchable, score it against current city production. If the capital can complete it within 15 turns, queue it immediately above normal buildings. Add a `wonderAttempted` flag per wonder so the AI does not re-queue a wonder it already lost. Prioritise wonders with economy or science effects (Colosseum, Library, Isaac Newton's) over military wonders in the early scoring pass. |
| 8 | **Defender bloat** | 7.9 units/city median, tails of 240+ phalanx — pure production sink | Add a **garrison cap per city**: `maxGarrison = 1 + ceil(threatLevel)` where `threatLevel` is the count of enemy units within 5 tiles divided by 4. Cap absolute garrison at 3 for interior cities, 5 for border cities. Once the cap is reached, the production scorer must pick something other than a military unit. Excess units beyond the cap should be flagged for disbanding or redeployment to the front. |
| 9 | **Gold hoarder tail** | Rush-buy only fires under threat, so safe civs sit on 5–10k gold doing nothing | Extend the rush-buy trigger beyond threat: add a **peacetime gold spend policy**. If gold > 2000 and no active war, evaluate the production queue and rush-buy the next item if it saves more than 10 turns. If gold > 4000, also evaluate raising the science slider by 10% per 1000 gold above 4000. If gold > 8000, force a wonder attempt in the highest-production city. This converts the hoard into compounding advantage rather than dead weight. |
| 10 | **Lopsided improvement** | Irrigation reflexive (14–45 tiles), mines 0–6, rails ~0 | Replace the reflexive irrigation rule with a **tile yield scorer**: for each unimproved tile, compute expected yield delta for irrigation vs. mine vs. road vs. railroad, weighted by the city's current bottleneck (food-limited → irrigation, production-limited → mine, connectivity-limited → road/rail). Set a minimum mine quota: at least 1 mine per 3 irrigated tiles. Gate railroad scoring on the Railroad tech being researched, and give it a high weight once available since it is the single largest production multiplier in the game. |

### Cross-fix dependency order

```
1 (naval probe)  →  immediately unblocks island maps
2 (gov re-eval)  →  unblocks 3 (tech ceiling) as a side effect
8 (garrison cap) →  immediately frees production for 7 (wonders) and 10 (improvements)
9 (gold policy)  →  converts idle gold into science/wonders, amplifies 3 and 7
6 (catch-up)     →  implement last, after the others tighten the baseline spread
```

Fixes 2 → 3 → 7 form a chain: better government unlocks science, science unlocks wonders. Fixing garrison bloat (#8) is the fastest single change to free up production capacity across all the other categories simultaneously.
