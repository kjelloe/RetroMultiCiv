# Designer-ally deliverables — cover-note reply (2026-07-18)

Captured from the ally's reply to `specs/ally-cover-note-2026-07-17-evening.md`.
Routing: client batch → helper (golden-neutral); data-label fixes → bugfixer
(tiny golden window, after D3); design rulings → memory + specs (below).
All ally prose here is ORIGINAL (ally-authored, "no copied/paraphrased wiki
text") so it is committable — it is NOT wiki-extract.

---

## A. Design rulings (RATIFIED — capture, no build)

### A1. Provenance labels (ratified, use in mail/commits/marks/specs)
| Label | Meaning |
|---|---|
| `Civ1-authentic` | Directly preserves the original Civ1 rule shape. |
| `Civ2-shape` | Deliberate adaptation from Civ2's structural idea. |
| `Civ4-shape` | Deliberate adaptation from Civ4's structural idea. |
| `original` | RetroMultiCiv-specific, for clarity/determinism/modern multiplayer. |
| `hybrid` | Intentionally combines >1 lineage; list both sources in the note. |
- **Monarchy free-units rule = `Civ2-shape`.**

### A2. Aggression return criteria — "personality supplies a preference; the world supplies permission" (KEY principle)
Perfectionist naming ratified. Aggressive-archetype deferral is correct
(spawn geometry + random seat assignment, not leadership, currently decides
viability — don't tune around that noise). Bring aggression back only when at
least one holds:
- **Spawn-aware assignment:** aggressive leaders placed where they have
  reachable, meaningful early targets WITHOUT instantly deleting a neighboring
  Perfectionist.
- **Diplomatic protection:** a non-aggression / early-peace layer gives
  economic/wonder civs room to exist. (← D3 provides exactly this.)
- **Dynamic mode entry:** an aggressive leader becomes active because a REAL
  LOCAL OPPORTUNITY exists, not because the seat drew an aggressive flag at
  setup. (← D3 scoreWarIntent [weakness+borderPressure+grievance] and XII.5
  conquest targeting [weakest/closest REACHABLE] ARE this "permission" gate.)
This shapes D3, XII.5, and any future personality-driven stance ASSIGNMENT.

---

## B. Client batch → HELPER (golden-neutral) — LANDED 2026-07-18 (#1714, commit ffd34e1)

> B1 (68 blurbs — ids 68/68 verified, gate warn→assert), B3 (Movement +
> Regency concepts), B4 (Recordings entry), and B2 CORE (Oracle card
> Mysticism-stacking text + the city happiness breakdown reading `Temple +4`)
> all DONE + committed golden-neutral. 6/6 + 24/24 green.
> **OPEN — B2b (low-priority polish, deferred):** the Temple CATALOG card
> "Makes N citizens content" (item 1) and the Mysticism card "doubles Temple"
> note (item 2) need `effectText(def)` to become PLAYER-AWARE (it is
> context-free today, called across catalog/pedia/discovery). The CORE
> confusion is resolved (the `+4` is legible in the breakdown; item 1's info
> also lives there), so this is polish — prefer a minimal-risk approach
> (Temple special-case in the card renderer) over a broad effectText refactor;
> not urgent, available for the helper when it wants a task.

### B1. 68 tech-discovery-card blurbs (the empty slots on browser + Roblox)
Wire into `client/ui/tech-blurbs.js` as `id → flavor` DATA (ally's
implementation note: flavor is data, separate from rules; UI sources
name/era from `data/techs.json`, unlocks from rule data, flavor from this
table; look up by exact `id`). Roblox consumes the same table later.

```
advanced-flight | The sky becomes a true battlefield and highway. Aircraft now range farther, strike harder, and connect distant fronts.
alphabet | Speech can vanish with its speaker; writing lets ideas outlive a single voice. Knowledge can now be shared, stored, and built upon.
astronomy | The heavens become a chart rather than a mystery. Distant stars and wandering worlds sharpen the art of navigation.
atomic-theory | Matter is revealed as a restless architecture of unseen parts. Great power—and grave responsibility—lies within the smallest things.
automobile | Personal machines carry people and goods farther than muscle or horse ever could. Roads become arteries of a faster civilization.
banking | Wealth can now be gathered, lent, and directed at a larger scale. Commerce gains institutions built to survive individual fortunes.
bridge-building | Rivers no longer have to divide your realm. Strong crossings carry workers, armies, and trade toward new opportunities.
bronze-working | Copper and tin become a stronger tool in skilled hands. Better blades and implements give your people a durable advantage.
ceremonial-burial | Honoring the dead binds the living together. Shared rites give communities memory, meaning, and a sense of order.
chemistry | Careful experiment turns substances into knowledge. Materials can now be understood, transformed, and put to new purposes.
chivalry | Armored riders become the emblem of a warrior elite. Their charge can decide a field before foot soldiers can recover.
code-of-laws | Rule no longer rests only on a ruler's memory or mood. Written law makes authority more predictable across a growing realm.
combustion | Controlled fire can drive engines with immense force. Fuel becomes motion, and motion reshapes industry and war.
communism | The question of who owns work and wealth becomes a question of state. Society can now be organized around collective purpose.
computers | Machines begin to process information at a scale beyond any clerk's desk. Calculation, coordination, and design accelerate together.
conscription | The defense of the state becomes a duty shared by its citizens. Armies can grow rapidly when danger demands it.
construction | Organized labor and durable materials raise works beyond the reach of a single household. Cities can now build for generations.
corporation | Enterprises gain lives larger than their founders. Capital, risk, and ambition can now be gathered under one enduring banner.
currency | A trusted measure of value makes exchange easier between strangers. Trade no longer depends on finding the perfect barter.
democracy | Government draws its authority from the consent of citizens. Debate becomes a strength when institutions can carry it.
electricity | Invisible current becomes useful power. Light, industry, and communication can now reach farther and work faster.
electronics | Tiny signals can be shaped into useful work. Control, communication, and calculation become more precise than ever before.
engineering | Practical knowledge becomes organized craft. Roads, works, and machines can be planned to serve an entire civilization.
explosives | Stored force can break stone, open earth, and shatter defenses. It is a tool of industry as readily as war.
feudalism | Land, service, and protection bind society into a strict hierarchy. Local lords can hold a realm together—or pull it apart.
flight | Humanity leaves the ground by craft rather than myth. The map gains a new dimension, and distance loses some of its power.
fusion-power | The force that lights the stars is brought within human reach. Energy becomes abundant enough to transform every grand project.
future-tech | Your civilization has reached beyond the known tree of knowledge. Each new answer reveals a still larger frontier.
genetic-engineering | Life's instructions can now be read and altered with care. Medicine, food, and the future itself enter a new age of choice.
gunpowder | A spark now carries the force of thunder. Old fortifications and old warrior traditions must adapt or be swept aside.
horseback-riding | A rider and mount become faster than either could be alone. Open land now favors those who can move before an enemy responds.
industrialization | Workshops give way to systems of machines, fuel, and labor. Production expands from skilled craft to national power.
invention | Practical curiosity becomes a force in its own right. New devices turn familiar materials and motions toward unexpected ends.
iron-working | Iron yields tools and weapons that outlast bronze. A civilization that masters it can work harder land and field stronger armies.
labor-union | Workers discover strength in common cause. Industry must now reckon with organized voices as well as organized capital.
literacy | Reading is no longer the preserve of a few scribes. A people who can learn from records can advance together.
magnetism | A needle that seeks direction becomes a guide across uncertain waters. Invisible forces begin to serve practical navigation.
map-making | The world becomes something that can be drawn, compared, and remembered. Explorers can now turn journeys into shared knowledge.
masonry | Stone is shaped from shelter into monument. Walls, temples, and cities can now stand against time and attack.
mass-production | Standard parts and organized lines turn great output into routine work. A nation can now equip itself at remarkable speed.
mathematics | Number and pattern reveal order beneath the world's confusion. Builders, traders, and scholars gain a common language of measure.
medicine | Illness becomes a problem to study rather than merely endure. Care, observation, and treatment preserve more lives.
metallurgy | Metals are no longer simply found and forged; their qualities can be deliberately controlled. Stronger tools and weapons follow.
monarchy | Authority is gathered into a single crown. A ruler can now command a realm with greater unity, splendor, and burden.
mysticism | The unseen world is sought through ritual, contemplation, and symbol. Faith gives people comfort beyond what law alone can offer.
navigation | Sailors learn to trust instruments, charts, and the stars. Oceans become routes to knowledge, wealth, and distant rivals.
nuclear-fission | The atom can be split, releasing power on an unimaginable scale. A new age begins beneath the shadow of its own creation.
nuclear-power | Atomic energy is harnessed for sustained work. The promise is vast, but safety and stewardship become matters of national importance.
philosophy | Questions about truth, justice, and nature become disciplines of their own. A civilization learns to examine the ideas guiding it.
physics | Motion, force, and matter yield to systematic inquiry. Nature becomes not less wondrous, but more deeply understandable.
plastics | New materials can be molded for nearly any task. Light, durable manufacture reaches into homes, laboratories, and industry.
pottery | Clay becomes a vessel for food, water, and memory. Settlements gain the means to store plenty through leaner seasons.
railroad | Iron tracks bind distant cities to a common rhythm. Goods, people, and armies cross the land with unprecedented speed.
recycling | Waste becomes a resource when materials are recovered and used again. Prosperity need not always leave ruin behind it.
refining | Raw resources are separated into more useful forms. What once seemed crude and limited becomes fuel for a changing world.
religion | Belief is shaped into institutions, teachings, and communities that reach beyond a single city. Faith becomes a force in public life.
republic | Citizens share in governing through offices and law. Power becomes a public trust, though it still demands vigilance.
robotics | Machines gain the precision to act on the world directly. Labor, industry, and exploration enter a new partnership with automation.
rocketry | Engines can now throw machines beyond the pull of ordinary travel. The upper sky becomes a frontier waiting to be crossed.
space-flight | Your civilization can now send vessels beyond Earth itself. The greatest journey begins with engineering, courage, and a destination.
steam-engine | Heated water becomes reliable mechanical power. Mines, mills, ships, and factories can work beyond the limits of wind and muscle.
steel | Iron is strengthened into a material fit for railways, engines, and towering works. Industry gains a tougher backbone.
superconductor | Electricity moves with almost no resistance. Once-impractical machines and immense projects become newly possible.
theory-of-gravity | The same laws that guide a falling stone also govern the heavens. Earth and sky are revealed as one physical order.
trade | Exchange links cities that may never share a border. Surplus becomes wealth when it can travel to where it is wanted.
university | Learning gathers into a lasting institution. Scholars can preserve knowledge, challenge it, and pass it to new generations.
wheel | A simple turning circle changes how burdens move. Carts and machines make distance less costly to cross.
writing | Words can now travel across time and distance without changing. Records give rulers, merchants, and scholars a longer memory.
```
NOTE: verify the 68 ids match `data/techs.json` exactly (the ally keyed by
id but could not see the file); flag any id mismatch rather than guessing.

### B2. Oracle×4 LEGIBILITY (mechanic UNCHANGED — Civ1-authentic, retained)
Ally confirms the ×4 is authentic (Temple=1, +Mysticism=2, +Oracle=2, all
three=4) — keep it. The work is making it LEGIBLE (client only, no engine):
- Temple card: state the CURRENT effect for the player's civ ("Makes 4
  citizens content" when both apply).
- Mysticism card: "doubles Temple effectiveness".
- Oracle card: "doubles the current Temple effect, including Mysticism's".
- City happiness breakdown: show the actual contribution, e.g. `Temple +4`.

### B3. Two Civilopedia concepts (exact ally copy) — client/ui/pedia-concepts.js
**Movement** — Each unit has movement points to spend during its turn.
Terrain, roads, railroads, and special actions affect how far it can travel.
Moving into unknown territory reveals it, but your units cannot use
information hidden by fog of war. A unit that has no movement left must wait
until your next turn. Fortifying, improving land, or performing other actions
may also end its movement.

**Regency** — You may place your civilization under an AI regent when you need
to step away. The regent takes legal turns using the same rules and fog of war
as any other player; it does not receive hidden information or special
advantages. You can reclaim control whenever your seat is available. A
regent's decisions are recorded in the game history, so replays show exactly
what happened while it governed. (Roblox: platform-neutral wording — reclaim
via the Roblox interface, not a browser button.)

### B4. Recordings pedia entry (shared core + platform notes)
**Recordings** — A recording preserves the commands that shaped a game. You
can replay it from the beginning, review important moments, and verify that
the recorded history reaches the same final game state.
- Browser: `Shift+D` downloads a diagnostics recording of the current session.
- Roblox: use the Theater controls to review recordings; save/resume uses the
  game's resume code where supported.

---

## C. Data-label fixes → BUGFIXER (tiny golden window, after D3)

Both move a ruleset-file checksum → rulesetHash ripple → A82a/002 re-record,
but are BEHAVIORALLY NEUTRAL (names/favoriteWonder don't touch the AI path;
favoriteModifier is inert). Bundle into ONE tiny window; verify rounds/winner
unchanged.

### C1. Caesar favoriteWonder: `great-wall` → `colossus` (civs.json)
Ally's substitute (Great Wall stays Frederick's defensive signature). AI
interpretation for the later favorite-wiring window: "Caesar prefers The
Colossus when he has a productive coastal capital / secure homeland — a
preference, not an obligation; yields to frontier defense, active war, or a
better local objective." Provenance: `Civ1-authentic` (wonder selection) +
`original` (leader-preference association).

### C2. `railroad` display name `RailRoad` → `Railroad` (techs.json)
Ally flagged the odd capitalization; standardize unless intentional. Also
fixes the B1 card name.

---

## D. Priority order (ally's) + status
1. Oracle×4 legibility + surface in UI breakdown — B2 (helper).
2. Caesar → Colossus — C1 (bugfixer).
3. Movement + Regency concepts — B3 (helper).
4. N9b selective build/wonder policy — DONE (marker-0059).
5. techs.json → 68 cards — DELIVERED (B1); wire in.
