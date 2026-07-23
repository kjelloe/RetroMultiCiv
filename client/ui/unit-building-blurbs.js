// UNIT_BLURBS + BUILDING_BLURBS — one ORIGINAL 1-2 sentence flavor line per
// buildable unit (28; the barb-only barbleader is excluded) and per building
// (21), shown in the Civilopedia entry (ui/pedia.js) and as the build-catalog
// option tooltip (ui/panels.js). Mirrors the TECH_BLURBS shape (ui/tech-blurbs.js)
// so the Roblox parity gate can consume the SAME id->string tables. CONTENT
// RULES (the license boundary, CLAUDE.md): original prose only, never wiki
// sentences; the UI sources name/stats/requirements from the rulesets — only the
// flavor lives here, looked up by exact id (all ids verified vs data/units.json +
// data/buildings.json). Authored by the designer ally, verbatim from
// specs/ally-unit-building-blurb-response-2026-07-19.md (curly quotes normalized
// to ASCII), committable (NOT wiki-extract).

export const UNIT_BLURBS = {
  militia: "Local citizens called to defend their homes. Their training may be limited, but their resolve can decide a city's first crisis.",
  phalanx: "Spearmen fighting shoulder to shoulder behind overlapping shields. Discipline and formation make the phalanx hard to break from the front.",
  legion: "Professional heavy infantry built for endurance, order, and hard campaigning. A legion carries its civilization's authority wherever it marches.",
  musketeers: "Soldiers armed with early firearms and drilled to fire in ranks. Gunpowder begins to challenge the battlefield dominance of armor.",
  riflemen: "Infantry equipped with more accurate, longer-ranged rifles. Modern armies increasingly rely on trained citizens carrying industrial weapons.",
  "mech-inf": "Infantry carried and supported by armored machines. They combine a foot soldier's presence with the mobility of modern warfare.",
  cavalry: "Fast mounted troops able to scout, raid, and exploit an opening. For centuries, the sound of hooves announced sudden danger.",
  knights: "Armored mounted warriors trained for the shock of close combat. Their charge became a defining image of feudal warfare.",
  chariot: "A fast fighting platform drawn by horses. Chariots gave early armies speed, prestige, and striking power on open ground.",
  catapult: "A torsion or counterweight engine that throws heavy projectiles. Siege warfare turns walls from a final answer into a target.",
  cannon: "A gunpowder artillery piece built to batter defenses. Its arrival forces fortifications and battlefield tactics to change.",
  artillery: "Long-range heavy guns delivering force from beyond direct combat. Modern battles are often shaped before opposing lines even meet.",
  armor: "Heavily protected fighting vehicles built around powerful guns. Armored formations unite speed, protection, and concentrated firepower.",
  settlers: "Pioneers carrying the tools to establish a new community. Their journey turns empty land into a future city.",
  diplomat: "An envoy entrusted with messages, negotiation, and delicate observation. A quiet agreement can alter history as surely as a battle.",
  caravan: "Merchants and pack animals moving valuable goods between settlements. Trade routes carry wealth, ideas, and distant influence.",
  trireme: "An oared warship driven by banks of rowers. Its bronze-beaked ram made close naval combat swift and brutal.",
  sail: "A wind-powered vessel built for travel and commerce. Sail ships turned coasts and seas into the roads of earlier worlds.",
  frigate: "A swift warship combining sails, guns, and long-range endurance. Frigates protected trade and carried power far from home waters.",
  ironclad: "A steam-driven warship protected by iron armor. Wooden fleets suddenly faced a new and unsettling kind of opponent.",
  cruiser: "A versatile long-range warship for patrol, escort, and independent action. Cruisers extend a navy's reach across the oceans.",
  battleship: "A capital warship built around immense guns and heavy armor. Its silhouette once represented the full weight of national sea power.",
  submarine: "A vessel that moves beneath the surface, striking from concealment. It makes even familiar waters uncertain and dangerous.",
  transport: "A large vessel designed to carry people and equipment across water. Amphibious operations depend on ships that can move an army's weight.",
  carrier: "A warship that carries aircraft to distant seas. Its deck becomes a floating airfield wherever the fleet must operate.",
  fighter: "A fast military aircraft built to challenge enemy aircraft. Control of the sky begins with pilots able to seize and hold it.",
  bomber: "An aircraft designed to deliver heavy ordnance at range. It brings the consequences of war far beyond the front line.",
  nuclear: "A weapon drawing terrible force from atomic reactions. Its existence changes strategy long before it is ever used."
};

export const BUILDING_BLURBS = {
  palace: "Your CAPITAL and seat of government. Corruption and waste rise with distance from it, so a central capital keeps more trade. Build one elsewhere to move it; with none, your oldest city serves.",
  barracks: "Permanent quarters where soldiers live, train, and organize. A standing force depends on routine as much as courage.",
  granary: "A storehouse that protects food against poor harvests and hard seasons. Surplus grain gives a city resilience and room to grow.",
  temple: "A shared place of worship and ceremony. Its presence gives spiritual life a permanent home within the city.",
  marketplace: "A public place where buyers, sellers, and news meet. Commerce thrives when exchange has a regular center.",
  library: "A collection of written knowledge kept for public use. Each preserved text lets future minds begin farther ahead.",
  courthouse: "A civic building where law is administered and disputes are judged. Order becomes more dependable when justice has a place to work.",
  "city-walls": "Stone or earth defenses surrounding a settlement. Walls buy time, shelter citizens, and force attackers to work for every entrance.",
  aqueduct: "An engineered channel carrying reliable water into the city. Clean supply supports larger populations and more ambitious urban life.",
  bank: "An institution for holding wealth, extending credit, and supporting enterprise. Money can now be directed as deliberately as labor.",
  cathedral: "A great house of worship built to inspire a whole community. Its scale turns faith into part of the city skyline.",
  university: "A permanent community of teachers and scholars. Learning becomes a civic institution rather than a scattered private pursuit.",
  colosseum: "A large public arena for spectacle and gathering. Shared entertainment can unite a city as surely as shared work.",
  factory: "A workplace where machines and organized labor produce at scale. Industry turns raw materials into the strength of a modern city.",
  "power-plant": "A facility that converts fuel into usable energy. Reliable power allows industry and urban life to operate at a larger scale.",
  "hydro-plant": "A power station driven by moving water. Rivers become a steady source of energy as well as transport and irrigation.",
  "nuclear-plant": "A facility that uses atomic reactions to generate electricity. It offers immense output while demanding careful stewardship.",
  "mfg-plant": "An advanced manufacturing complex built for heavy, efficient output. Specialized machinery pushes industrial capacity still further.",
  "recycling-center": "A facility that recovers useful materials from discarded goods. A city can reduce waste by treating old resources as new inputs.",
  "mass-transit": "A shared network for moving many people through a city. Efficient public travel helps a dense urban population keep moving.",
  "sdi-defense": "A strategic defense network intended to detect and intercept incoming missiles. It reflects the hope that vigilance can blunt catastrophe."
};
