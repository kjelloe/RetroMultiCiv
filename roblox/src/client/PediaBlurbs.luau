-- run-F #9 (#1778): Civilopedia unit + building flavor blurbs — designer-ally
-- ORIGINAL prose, ported VERBATIM from the BROWSER canonical table
-- client/ui/unit-building-blurbs.js (the one authoring source; ASCII-
-- normalized, authored from specs/ally-unit-building-blurb-response-2026-07-19.md).
-- 28 units (barbleader excluded) + 21 buildings, id-verified. check.sh gate 16
-- keeps this 1:1 with that browser table (tech-blurbs.js/gate-11 precedent) +
-- ruleset coverage. License: original prose only, never wiki sentences.
-- Pedia.client reads these as the entry flavor line.

local M = {}

M.UNIT_BLURBS = {
	["armor"] = "Heavily protected fighting vehicles built around powerful guns. Armored formations unite speed, protection, and concentrated firepower.",
	["artillery"] = "Long-range heavy guns delivering force from beyond direct combat. Modern battles are often shaped before opposing lines even meet.",
	["battleship"] = "A capital warship built around immense guns and heavy armor. Its silhouette once represented the full weight of national sea power.",
	["bomber"] = "An aircraft designed to deliver heavy ordnance at range. It brings the consequences of war far beyond the front line.",
	["cannon"] = "A gunpowder artillery piece built to batter defenses. Its arrival forces fortifications and battlefield tactics to change.",
	["caravan"] = "Merchants and pack animals moving valuable goods between settlements. Trade routes carry wealth, ideas, and distant influence.",
	["carrier"] = "A warship that carries aircraft to distant seas. Its deck becomes a floating airfield wherever the fleet must operate.",
	["catapult"] = "A torsion or counterweight engine that throws heavy projectiles. Siege warfare turns walls from a final answer into a target.",
	["cavalry"] = "Fast mounted troops able to scout, raid, and exploit an opening. For centuries, the sound of hooves announced sudden danger.",
	["chariot"] = "A fast fighting platform drawn by horses. Chariots gave early armies speed, prestige, and striking power on open ground.",
	["cruiser"] = "A versatile long-range warship for patrol, escort, and independent action. Cruisers extend a navy's reach across the oceans.",
	["diplomat"] = "An envoy entrusted with messages, negotiation, and delicate observation. A quiet agreement can alter history as surely as a battle.",
	["fighter"] = "A fast military aircraft built to challenge enemy aircraft. Control of the sky begins with pilots able to seize and hold it.",
	["frigate"] = "A swift warship combining sails, guns, and long-range endurance. Frigates protected trade and carried power far from home waters.",
	["ironclad"] = "A steam-driven warship protected by iron armor. Wooden fleets suddenly faced a new and unsettling kind of opponent.",
	["knights"] = "Armored mounted warriors trained for the shock of close combat. Their charge became a defining image of feudal warfare.",
	["legion"] = "Professional heavy infantry built for endurance, order, and hard campaigning. A legion carries its civilization's authority wherever it marches.",
	["mech-inf"] = "Infantry carried and supported by armored machines. They combine a foot soldier's presence with the mobility of modern warfare.",
	["militia"] = "Local citizens called to defend their homes. Their training may be limited, but their resolve can decide a city's first crisis.",
	["musketeers"] = "Soldiers armed with early firearms and drilled to fire in ranks. Gunpowder begins to challenge the battlefield dominance of armor.",
	["nuclear"] = "A weapon drawing terrible force from atomic reactions. Its existence changes strategy long before it is ever used.",
	["phalanx"] = "Spearmen fighting shoulder to shoulder behind overlapping shields. Discipline and formation make the phalanx hard to break from the front.",
	["riflemen"] = "Infantry equipped with more accurate, longer-ranged rifles. Modern armies increasingly rely on trained citizens carrying industrial weapons.",
	["sail"] = "A wind-powered vessel built for travel and commerce. Sail ships turned coasts and seas into the roads of earlier worlds.",
	["settlers"] = "Pioneers carrying the tools to establish a new community. Their journey turns empty land into a future city.",
	["submarine"] = "A vessel that moves beneath the surface, striking from concealment. It makes even familiar waters uncertain and dangerous.",
	["transport"] = "A large vessel designed to carry people and equipment across water. Amphibious operations depend on ships that can move an army's weight.",
	["trireme"] = "An oared warship driven by banks of rowers. Its bronze-beaked ram made close naval combat swift and brutal.",
}

M.BUILDING_BLURBS = {
	["aqueduct"] = "An engineered channel carrying reliable water into the city. Clean supply supports larger populations and more ambitious urban life.",
	["bank"] = "An institution for holding wealth, extending credit, and supporting enterprise. Money can now be directed as deliberately as labor.",
	["barracks"] = "Permanent quarters where soldiers live, train, and organize. A standing force depends on routine as much as courage.",
	["cathedral"] = "A great house of worship built to inspire a whole community. Its scale turns faith into part of the city skyline.",
	["city-walls"] = "Stone or earth defenses surrounding a settlement. Walls buy time, shelter citizens, and force attackers to work for every entrance.",
	["colosseum"] = "A large public arena for spectacle and gathering. Shared entertainment can unite a city as surely as shared work.",
	["courthouse"] = "A civic building where law is administered and disputes are judged. Order becomes more dependable when justice has a place to work.",
	["factory"] = "A workplace where machines and organized labor produce at scale. Industry turns raw materials into the strength of a modern city.",
	["granary"] = "A storehouse that protects food against poor harvests and hard seasons. Surplus grain gives a city resilience and room to grow.",
	["hydro-plant"] = "A power station driven by moving water. Rivers become a steady source of energy as well as transport and irrigation.",
	["library"] = "A collection of written knowledge kept for public use. Each preserved text lets future minds begin farther ahead.",
	["marketplace"] = "A public place where buyers, sellers, and news meet. Commerce thrives when exchange has a regular center.",
	["mass-transit"] = "A shared network for moving many people through a city. Efficient public travel helps a dense urban population keep moving.",
	["mfg-plant"] = "An advanced manufacturing complex built for heavy, efficient output. Specialized machinery pushes industrial capacity still further.",
	["nuclear-plant"] = "A facility that uses atomic reactions to generate electricity. It offers immense output while demanding careful stewardship.",
	["palace"] = "Your CAPITAL and seat of government. Corruption and waste rise with distance from it, so a central capital keeps more trade. Build one elsewhere to move it; with none, your oldest city serves.",
	["power-plant"] = "A facility that converts fuel into usable energy. Reliable power allows industry and urban life to operate at a larger scale.",
	["recycling-center"] = "A facility that recovers useful materials from discarded goods. A city can reduce waste by treating old resources as new inputs.",
	["sdi-defense"] = "A strategic defense network intended to detect and intercept incoming missiles. It reflects the hope that vigilance can blunt catastrophe.",
	["temple"] = "A shared place of worship and ceremony. Its presence gives spiritual life a permanent home within the city.",
	["university"] = "A permanent community of teachers and scholars. Learning becomes a civic institution rather than a scattered private pursuit.",
}
return M
