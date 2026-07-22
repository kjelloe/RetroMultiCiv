// A58c: Civilopedia CONCEPT entries — the deep reference the ❓ quick-tips point
// into (coexist ruling: ❓ = 2-line tips, 📖 = depth; the two never duplicate
// prose). ORIGINAL text — the license boundary applies (never wiki sentences).
// Every mechanic here is VERIFIED present in engine/ before writing (ZoC in
// movement.js, corruption/upkeep/luxuries in government.js, veterancy in
// cities.js, martial law in happiness.js, worked tiles in cities.js, research
// in tech.js, wonders unique in the build catalog).
//
// EDITORIAL PASS APPLIED 2026-07-17 (designer ally, verbatim): revised prose
// for all 11 originals, 3 new concepts (cities, research, buildings), and the
// first-game learning-path order below (work land → grow → stay happy → build
// + research → defend → deeper systems → trust/replay tools). The game-code
// entry was corrected: the code is a state-MATCH check, not a password/access
// credential.
//
// Each entry: { id, name, body }. body is plain prose (rendered escaped).

export const CONCEPTS = [
  { id: 'cities', name: 'Cities & worked tiles', body:
    'A city can only use the land its citizens are working. Each citizen normally works one nearby tile, producing that tile\'s food, shields, and trade; you can also assign citizens as entertainers, tax collectors, or scientists instead. Food supports growth, shields fill the current production box, and trade feeds your treasury and research. The best city is not always the largest-looking one — it is the one whose workers are assigned to what your empire needs now.' },
  { id: 'terrain', name: 'Terrain, yields & specials', body:
    'Every tile produces some combination of food, shields, and trade. Food feeds your citizens; shields build your empire; trade becomes gold and science. Grassland is fertile, hills and mountains are productive, and ocean and rivers can be valuable sources of trade. Terrain also matters in battle: hills, mountains, and forests help defenders, while open ground offers little protection. Special resources such as Wheat, Coal, or Gold give extra yields, making the right city site worth seeking out.' },
  { id: 'happiness', name: 'Happiness & luxuries', body:
    'Every citizen in a city is content, happy, or unhappy. As a city grows, more citizens become unhappy. You keep order in three main ways: spend some trade on luxuries with the tax/science split, turn a citizen into an entertainer, or build improvements such as a Temple. A happy citizen can offset an unhappy one. Your city stays productive as long as unhappy citizens do not outnumber happy citizens.' },
  { id: 'entertainer', name: 'Entertainer', body:
    'An entertainer is a citizen you assign to make luxuries instead of working a tile. Luxuries make citizens happy, so entertainers are a quick way to calm a city that is near civil disorder — especially before you have Temples or other happiness buildings. The cost is output: an entertainer gathers no food, shields, or trade from the land while performing. Use entertainers to keep order now, and replace them with happiness improvements when you can afford to.' },
  { id: 'taxman', name: 'Tax collector', body:
    'A tax collector is a citizen assigned to raise gold for your treasury instead of working a tile. Like every specialist the citizen gathers nothing from the land; in return the city earns a fixed amount of gold each turn, set by the ruleset rather than by any tile. Tax collectors help most in a small or heavily corrupt city that cannot make good use of more worked tiles, or when you need cash more than growth. Cities need a population of at least five to appoint one.' },
  { id: 'scientist', name: 'Scientist', body:
    'A scientist is a citizen assigned to produce research instead of working a tile. The city gains a fixed number of beakers each turn toward your current advance and forgoes the food, shields, and trade that citizen would have gathered. Scientists let a city add to research even when its tiles are poor or already fully worked. When you are racing for a key advance, turning a spare citizen into a scientist can bring it a turn or two sooner. Cities need a population of at least five to appoint one.' },
  { id: 'disorder', name: 'Civil disorder', body:
    'When unhappy citizens outnumber happy citizens, the city falls into civil disorder. It produces no shields or taxes until you restore order, though it still consumes food and can still grow or starve. Raise the luxury rate, assign entertainers, build happiness improvements, or — under governments that allow it — station military units for martial law. Some governments also risk wider political trouble if disorder is allowed to continue.' },
  { id: 'research', name: 'Research & the tech tree', body:
    'Research turns part of your trade into scientific progress toward a new advance. Use the tax/science split to decide how much of your income becomes science, then choose an advance to pursue. New advances unlock units, buildings, wonders, governments, and later choices in the technology tree. A faster research rate is powerful, but spending everything on science can leave you without enough gold for maintenance, emergencies, or rush-buying.' },
  { id: 'upkeep', name: 'Upkeep & shields', body:
    'Cities produce shields: the material used to build units, improvements, and wonders. A standing army also has a cost. Each government supports a number of units for free, while extra units cost one shield of upkeep each turn from the city that built them. Too many units can leave their home cities with little production for anything else. Buildings cost gold maintenance from your treasury instead, so build an empire you can afford to maintain.' },
  { id: 'garrison', name: 'Fortify & garrisons', body:
    'A city with no military unit inside is captured as soon as an enemy enters it; its citizens cannot defend themselves. Move a defender into the city and fortify it with F to gain a defensive bonus. City walls make a fortified defender still harder to remove. A strong frontier garrison is cheap insurance: it forces an attacker to commit to a real siege instead of simply walking into an empty city.' },
  { id: 'zoc', name: 'Zones of control', body:
    'Military units project a zone of control onto the tiles around them. An enemy cannot move directly from one tile beside your unit to another tile beside it; it must first move away, enter an unthreatened tile, or attack. Entering your city or attacking your unit is still allowed. Zones of control let a small force screen a border, protect an approach, or hold a chokepoint. Civilian units such as settlers and diplomats neither exert nor are stopped by zones of control.' },
  { id: 'movement', name: 'Movement', body:
    'Each unit has movement points to spend during its turn. Terrain, roads, railroads, and special actions affect how far it can travel. Moving into unknown territory reveals it, but your units cannot use information hidden by fog of war. A unit that has no movement left must wait until your next turn. Fortifying, improving land, or performing other actions may also end its movement.' },
  { id: 'governments', name: 'Government types', body:
    'Your government sets the rules for your entire civilization: how high you can set tax and science, how severe corruption is, how many units receive free support, whether martial law works, and how much your people tolerate war. Despotism is a limited starting government. Monarchy and Republic offer different balances of order, trade, and military freedom, while Democracy can be highly productive but dislikes prolonged war. Changing government begins a period of Anarchy, so choose your moment carefully.' },
  { id: 'corruption', name: 'Corruption', body:
    'Part of a city\'s trade is lost to corruption before it can become gold or science. The loss usually grows with distance from your capital, the Palace. Despotism and Anarchy lose the most; Republic and Democracy lose the least. Your capital does not suffer corruption, and certain buildings and wonders can reduce it elsewhere. Corruption is why a large empire may earn less per city than its size suggests — and why the location of your capital matters.' },
  { id: 'veterancy', name: 'Veterancy', body:
    'A unit that wins a battle may become a veteran. Veterans receive bonuses in both attack and defense, so experience can decide the next battle before it begins. Barracks and certain wonders can produce veteran units immediately. Veteran status belongs to the unit, not the city that built it, so experienced survivors are worth protecting and using wisely.' },
  { id: 'buildings', name: 'Buildings & wonders', body:
    'Buildings belong to one city and usually provide a local benefit, such as happiness, defense, or better production. Wonders are unique: once one civilization completes a wonder, no other civilization can build it. Many wonders provide empire-wide effects or powerful long-term advantages. A wonder can be worth racing for, but it is also a major investment — while one city builds it, that city is not making settlers, defenders, or other improvements.' },
  { id: 'regency', name: 'Regency', body:
    'You may place your civilization under an AI regent when you need to step away. The regent takes legal turns using the same rules and fog of war as any other player; it does not receive hidden information or special advantages. You can reclaim control whenever your seat is available. A regent\'s decisions are recorded in the game history, so replays show exactly what happened while it governed.' },
  { id: 'recordings', name: 'Recordings', body:
    'A recording preserves the commands that shaped a game. You can replay it from the beginning, review important moments, and verify that the recorded history reaches the same final game state. Browser: Shift+D downloads a diagnostics recording of the current session. Roblox: use the Theater controls to review recordings; save/resume uses the game\'s resume code where supported.' },
  { id: 'gamecode', name: 'The game code', body:
    'Every save shows a short game code, a fingerprint of its exact game state. If two people load the same unaltered save, they should see the same code. This gives you a quick way to compare saves after loading, reconnecting, finishing a game, or sharing a bug report. The game code is not a password and does not grant access to a game; it is a check that two game states match.' }
];
