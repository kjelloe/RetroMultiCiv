# Leader config final + aggressive/defensive dialogue (user + designer, 2026-07-17) — VERBATIM APPENDIX

*(The completed editorial pass. Complements specs/leader-attributes.md
(science/growth/balanced sets). Architect slug reconciliations live in
the A59 item: Colosseum = preferredBuilding (building, not a Civ1
wonder); Warrior = militia; Sun Tzu's is Civ2, absent from Civ1.)*

## Part A — Leader config editorial pass

| Civ | Leader | Stance | Stance % (agg / sci / grw / def) | Beeline techs | Fav unit | Fav wonder | Editorial notes |
|---|---|---|---|---|---|---|---|
| Romans | Caesar | aggressive | 75 / 10 / 10 / 5 | Iron Working, Conscription | Legion | **Colosseum** | Great Wall is a defensive wonder — it fits Frederick better. Caesar's identity is rapid conquest + keeping conquered cities happy. Colosseum directly serves that: happiness in every city, lets him hold more territory without disorder. Conscription beeline is correct. |
| Babylonians | Hammurabi | science | 5 / 80 / 10 / 5 | Writing, **Code of Laws** | Catapult | Great Library | Writing → Code of Laws is the correct Babylonian beeline — it unlocks courthouses (corruption control) which is the real Babylonian advantage. University is too late-game for a beeline; it arrives naturally via the science slider. Catapult is fine — siege fits a science civ that wins by tech gap. |
| Germans | Frederick | defensive | 20 / 20 / 15 / 45 | Masonry, Gunpowder | Musketeers | **Great Wall** | Swap Great Wall here from Caesar. Frederick's defensive stance + Masonry beeline + Great Wall is a coherent identity: build walls early, hold territory, tech up behind them. Gunpowder beeline is correct — Musketeers are the payoff. |
| Egyptians | Ramesses | growth | 5 / 10 / 75 / 10 | Pottery, **Bronze Working** | Settler | Pyramids | Rename "Settler-heavy" to just Settler as the fav unit — cleaner for the data field. Pottery → Bronze → Irrigation path is the correct growth chain. Pyramids is perfect: granary in every city, doubles down on the growth identity. |
| Americans | Lincoln | balanced | 30 / 25 / 25 / 20 | Democracy, Industrialization | Riflemen | **Isaac Newton's** | Statue of Zeus is a war wonder — it does not fit Lincoln's balanced/diplomatic identity. Isaac Newton's fits better: science multiplier, suits a balanced civ that wins by late-game production and tech. Move Newton's from Elizabeth. |
| Greeks | Alexander | aggressive | 80 / 5 / 10 / 5 | Bronze Working, Horseback Riding | **Cavalry** | Colossus | Drop Phalanx from fav unit — pick one. Cavalry is the better choice: Alexander's historical identity and the payoff of the Horseback beeline. Colossus gives trade income which funds rapid expansion. |
| Indians | Gandhi | defensive | 5 / 20 / 30 / 45 | Ceremonial Burial, **Mysticism** | Musketeers | Michelangelo's Chapel | Mysticism is the correct second beeline — it unlocks temples, Gandhi's happiness path. Musketeers: Gandhi defends, does not attack, but needs a capable defender. |
| Russians | Catherine | growth | 10 / 15 / 60 / 15 | Bronze Working, Monarchy | Knights | **Colosseum** | Women's Suffrage requires Democracy — very late, does not fit early-growth identity. Colosseum fits better: many cities fast, happiness becomes the bottleneck. Knights = Russia's cavalry identity. |
| Zulus | Shaka | aggressive | 100 / 0 / 0 / 0 | Iron Working, Horseback Riding | **Impi / Warrior** | **None — keep blank** | Pure army — no wonder investment ever. 100/0/0/0 makes him the hardest aggressor, clearly distinct from Caesar at 75. Fav unit = Warrior equivalent (militia). |
| French | Napoleon | aggressive | 65 / 10 / 15 / 10 | Chivalry, Conscription | Knights | **J.S. Bach's Cathedral** | Bach's eliminates unhappiness on his continent — Napoleon holds conquered cities without building happiness infrastructure. |
| Aztecs | Montezuma | balanced | 40 / 15 / 30 / 15 | Bronze Working, Mysticism | Chariot | **Pyramids** | Mysticism beeline: temples are Montezuma's happiness solution. Pyramids shared with Ramesses — a wonder race between the two expansion civs is good AI drama. |
| Chinese | Qin Shi Huang | science | 10 / 70 / 10 / 10 | Writing, **Invention** | Catapult | Great Wall | Philosophy is mid-game — Invention is the correct Chinese science beeline. Great Wall shared with Frederick — first to build wins, early-game tension. |
| English | Elizabeth | science | 15 / 65 / 10 / 10 | Navigation, Magnetism | Frigate | **Copernicus' Observatory** | Newton's to Lincoln. Copernicus doubles science in its city — the correct payoff for a science-naval civ. Navigation + Magnetism + Frigate + Observatory is fully coherent. |
| Mongols | Genghis Khan | aggressive | 90 / 0 / 5 / 5 | Horseback Riding, **Iron Working** | Knights | **None — keep blank** | Genghis does not build, he takes. 90/0/5/5 — slightly less than Shaka: Genghis historically absorbed conquered cultures. |

### Wonder conflict summary
| Wonder | Contested by | Effect |
|---|---|---|
| Great Wall | Frederick, Qin Shi Huang | Early-game race between the defensive/science civs |
| Pyramids | Ramesses, Montezuma | Growth-race between the expansion civs |

## Part B — Voice profiles for the 5 stances

| Stance | Voice character | Sentence length | Register | Threat style |
|---|---|---|---|---|
| **Aggressive** | Blunt, imperial, no pleasantries | Short, declarative | Formal-archaic | Direct and immediate |
| **Defensive** | Cautious, measured, slightly suspicious | Medium, conditional | Formal | Implied, never explicit |
| **Science** | Precise, transactional, slightly cold | Medium, structured | Neutral-formal | Framed as logical consequence |
| **Growth** | Expansive, confident, paternalistic | Longer, flowing | Warm-formal | Territorial, not violent |
| **Balanced** | Diplomatic, pragmatic, face-saving | Medium, hedged | Neutral | Proportional, negotiable |

### The line types with design constraints

| # | Line type | Trigger | Max words | Must include | Must avoid |
|---|---|---|---|---|---|
| 1 | First-contact greeting | First tile adjacency or embassy | 25 | {leader}, {civ} | Threats, demands |
| 2 | Tribute demand | AI demands gold/tech | 20 | {demand} | Apology, hedging |
| 3 | Peace offer (AI initiates) | AI wants to end a war | 30 | Acknowledges war state | Grovelling |
| 4 | Response to accepted peace | Human accepts | 15 | Forward-looking | Rehashing the war |
| 5 | Response to rejected demand | Human refuses tribute | 20 | Specific consequence | Vague threats |
| 6 | War declaration | AI declares war | 20 | {reason} | Apology |
| 7 | Betrayal reaction | Treaty broken against AI | 25 | Names the broken treaty | Generic anger |
| 8 | Senate-forced peace | Senate overrides war | 30 | Not the leader's choice | Weakness framing |
| 9 (opt) | Tech exchange proposal | AI offers tech | 25 | {tech}, {offer} | Condescension |

### Aggressive stance lines (Caesar / Alexander / Napoleon / Shaka / Genghis)
1. "I am {leader} of the {civ}. You stand at the edge of our world. Choose your next move carefully."
2. "You will deliver {demand} to our treasury. This is not a request."
3. "The {civ} offers terms. Cease hostilities. We have other frontiers to attend to."
4. "Wise. Do not make us return."
5. "Then your cities will answer for your pride."
6. "The {civ} declares war on {civ2}. {reason}. Prepare yourself."
7. "You broke our treaty. There will be no second agreement — only consequences."
8. "Our senate has forced my hand. The war ends — for now. Do not mistake this for mercy."
9. "We possess {tech}. We will trade it for {offer}. Decide quickly."

### Defensive stance lines (Frederick / Gandhi)
1. "I am {leader}. The {civ} are a peaceful people — provided our borders are respected."
2. "We require {demand}. In return, our goodwill toward your people continues."
3. "This conflict serves neither of us. The {civ} propose an end to hostilities."
4. "A sound decision. May this peace endure."
5. "Then you leave us no choice but to defend what is ours."
6. "You have pushed the {civ} too far. We did not seek this war — but we will finish it."
7. "You violated our agreement. The {civ} do not forget broken faith."
8. "Our senate has compelled us to accept peace. The {civ} honor this — but our memory is long."
9. "We have mastered {tech}. We would share it, in exchange for {offer}."

### Validation checklist (before/while wiring the panel)
- No line exceeds 30 words (readability at game speed)
- Every line works with {leader} swapped to any of the 14 names
- Line 8 sounds like a leash the leader resents, never weakness
- Line 5 names a specific consequence
- Line 7 always names the broken treaty explicitly
- Aggressive and Defensive clearly distinguishable at a glance
