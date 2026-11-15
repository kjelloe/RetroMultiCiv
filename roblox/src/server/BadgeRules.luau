-- Badges as data + the rules that earn them (pure: no services, no
-- Instances). specs/roblox-parity-plan.md step 8. The server keeps one
-- `progress` table per player for the session (never in game state, so
-- hashes and replays are untouched) and asks this module what a round's
-- events and the end of the game have earned. BadgeAward (step 8.3) turns
-- keys into BadgeService awards. roblox/selftest/badge-rules.luau, gate 56.
local M = {}

M.DIFFICULTIES = { "trainer", "chieftain", "warlord", "prince", "king", "emperor", "godemperor" } -- rules.difficulties, easiest first
M.ERAS = { "ancient", "renaissance", "industrial", "modern" }
M.MAX_CIVS = 14

-- kind: count  = progress[field] >= n
--       flag   = progress[field] is set
--       win    = the game ended with this player the winner, and `when(info)` holds
-- tier 1 (first steps) .. 5 (hardest); icon = the motif the artwork should carry
local function count(key, name, text, tier, field, n, icon)
	return { key = key, name = name, text = text, tier = tier, kind = "count", field = field, n = n, icon = icon }
end
local function flag(key, name, text, tier, field, icon)
	return { key = key, name = name, text = text, tier = tier, kind = "flag", field = field, icon = icon }
end
local function win(key, name, text, tier, when, icon)
	return { key = key, name = name, text = text, tier = tier, kind = "win", when = when, icon = icon }
end
local function atLeast(level)
	local need = table.find(M.DIFFICULTIES, level)
	return function(info)
		return (table.find(M.DIFFICULTIES, info.difficulty) or 0) >= need
	end
end

M.BADGES = {
	-- first steps
	count("first-city", "Founder", "Found your first city.", 1, "citiesFounded", 1, "city"),
	count("first-unit", "Call to Arms", "Complete your first unit.", 1, "unitsBuilt", 1, "unit"),
	count("first-building", "Mason", "Complete your first building.", 1, "buildingsBuilt", 1, "building"),
	count("first-tech", "Spark", "Discover your first advance.", 1, "techs", 1, "flask"),
	count("first-wonder", "Wonder Worker", "Complete your first wonder.", 1, "wonders", 1, "wonder"),
	count("first-route", "Merchant", "Establish your first trade route.", 1, "routes", 1, "caravan"),
	count("first-hut", "Explorer", "Enter a tribal village.", 1, "huts", 1, "hut"),
	count("first-win", "First Blood", "Win your first battle.", 1, "battlesWon", 1, "sword"),
	count("first-capture", "Conqueror", "Capture a city.", 1, "captures", 1, "flag"),
	count("first-gov", "Reformer", "Change your form of government.", 1, "govChanges", 1, "scroll"),
	-- growth and economy
	count("cities-5", "Settled Land", "Found 5 cities in one game.", 2, "citiesFounded", 5, "city"),
	count("cities-10", "Realm", "Found 10 cities in one game.", 3, "citiesFounded", 10, "city"),
	count("cities-20", "Empire", "Found 20 cities in one game.", 4, "citiesFounded", 20, "city"),
	count("pop-10", "Town to City", "Grow a city to size 10.", 2, "largestCity", 10, "people"),
	count("pop-20", "Metropolis", "Grow a city to size 20.", 4, "largestCity", 20, "people"),
	count("gold-1000", "Full Coffers", "Hold 1,000 gold.", 2, "peakGold", 1000, "coin"),
	count("gold-5000", "Treasure House", "Hold 5,000 gold.", 4, "peakGold", 5000, "coin"),
	count("wltkd", "Beloved", "Have a city celebrate We Love the King Day.", 2, "celebrations", 1, "crown"),
	count("buildings-25", "Builder", "Complete 25 buildings in one game.", 3, "buildingsBuilt", 25, "building"),
	-- science
	flag("era-ancient", "Age of Bronze", "Know every ancient advance.", 2, "era_ancient", "flask"),
	flag("era-renaissance", "Rebirth", "Know every renaissance advance.", 3, "era_renaissance", "flask"),
	flag("era-industrial", "Age of Steam", "Know every industrial advance.", 3, "era_industrial", "flask"),
	flag("era-modern", "Atomic Age", "Know every modern advance.", 4, "era_modern", "flask"),
	count("techs-34", "Half the Tree", "Discover 34 advances in one game.", 2, "techs", 34, "flask"),
	count("future-1", "Beyond the Tree", "Discover a future technology.", 5, "futureTechs", 1, "star"),
	-- wonders
	count("wonders-3", "Three Marvels", "Complete 3 wonders in one game.", 2, "wonders", 3, "wonder"),
	count("wonders-7", "Seven Wonders", "Complete 7 wonders in one game.", 3, "wonders", 7, "wonder"),
	count("wonders-14", "Wonder of Wonders", "Complete 14 wonders in one game.", 5, "wonders", 14, "wonder"),
	-- military
	count("battles-10", "Veteran Commander", "Win 10 battles in one game.", 2, "battlesWon", 10, "sword"),
	count("battles-50", "Warlord", "Win 50 battles in one game.", 3, "battlesWon", 50, "sword"),
	count("battles-100", "Scourge", "Win 100 battles in one game.", 4, "battlesWon", 100, "sword"),
	count("captures-5", "Besieger", "Capture 5 cities in one game.", 3, "captures", 5, "flag"),
	count("captures-10", "Unstoppable", "Capture 10 cities in one game.", 4, "captures", 10, "flag"),
	count("defences-10", "Shield Wall", "Repel 10 attacks in one game.", 3, "defencesWon", 10, "shield"),
	count("units-50", "Standing Army", "Complete 50 units in one game.", 3, "unitsBuilt", 50, "unit"),
	-- space
	count("ship-part", "Rocket Science", "Build a spaceship part.", 3, "shipParts", 1, "rocket"),
	count("ship-launch", "Lift-off", "Launch your spaceship.", 4, "launches", 1, "rocket"),
	win("win-space", "Alpha Centauri", "Win by reaching Alpha Centauri.", 5, function(info)
		return info.victory == "space"
	end, "rocket"),
	-- victories
	win("win-any", "Victory", "Win a game.", 2, function()
		return true
	end, "laurel"),
	win("win-conquest", "World Conqueror", "Win by conquest.", 3, function(info)
		return info.victory == "conquest"
	end, "laurel"),
	win("win-chieftain", "Chieftain", "Win on Chieftain or harder.", 2, atLeast("chieftain"), "laurel"),
	win("win-warlord", "Warlord's Crown", "Win on Warlord or harder.", 3, atLeast("warlord"), "laurel"),
	win("win-prince", "Prince", "Win on Prince or harder.", 3, atLeast("prince"), "laurel"),
	win("win-king", "King", "Win on King or harder.", 4, atLeast("king"), "laurel"),
	win("win-emperor", "Emperor", "Win on Emperor or harder.", 4, atLeast("emperor"), "laurel"),
	win("win-godemperor", "God-Emperor", "Win on God-Emperor.", 5, atLeast("godemperor"), "laurel"),
	win("win-civs-7", "Crowded World", "Win a game with 7 or more civilizations.", 3, function(info)
		return info.civs >= 7
	end, "globe"),
	win("win-civs-14", "Full House", "Win a game with 14 civilizations.", 4, function(info)
		return info.civs >= M.MAX_CIVS
	end, "globe"),
	win("win-authentic", "By the Old Rules", "Win under the authentic single-roll combat rule.", 3, function(info)
		return info.combat == "authentic"
	end, "dice"),
	win("win-ultimate", "Master of the World", "Win on God-Emperor with 14 civilizations.", 5, function(info)
		return info.difficulty == "godemperor" and info.civs >= M.MAX_CIVS
	end, "crown"),
}

M.byKey = {}
for _, b in ipairs(M.BADGES) do
	M.byKey[b.key] = b
end

function M.newProgress()
	return { earned = {} }
end

local function bump(progress, field, by)
	progress[field] = (progress[field] or 0) + (by or 1)
end
local function atMost(progress, field, value)
	if value > (progress[field] or 0) then
		progress[field] = value
	end
end

-- fold one round's engine events into the player's progress.
-- state is read for ownership only (city owner, treasury, known advances).
function M.onEvents(progress, events, state, pid, rs)
	for _, e in ipairs(events) do
		local t = e.type
		local city = e.cityId ~= nil and state.cities ~= nil and state.cities[e.cityId] or nil
		local mine = city ~= nil and city.owner == pid
		if t == "cityFounded" and mine then
			bump(progress, "citiesFounded")
		elseif t == "unitBuilt" and mine then
			bump(progress, "unitsBuilt")
		elseif t == "buildingBuilt" and mine then
			bump(progress, "buildingsBuilt")
		elseif t == "wonderBuilt" and mine then
			bump(progress, "wonders")
		elseif t == "cityGrew" and mine then
			atMost(progress, "largestCity", e.pop or 0)
		elseif t == "cityCelebrating" and mine then
			bump(progress, "celebrations")
		elseif t == "techDiscovered" and e.playerId == pid then
			if e.tech == "future-tech" then
				bump(progress, "futureTechs")
			else
				bump(progress, "techs")
			end
		elseif t == "tradeRouteEstablished" and e.playerId == pid then
			bump(progress, "routes")
		elseif t == "hutEntered" and e.playerId == pid then
			bump(progress, "huts")
		elseif t == "governmentChanged" and e.playerId == pid then
			bump(progress, "govChanges")
		elseif t == "ssPartBuilt" and e.playerId == pid then
			bump(progress, "shipParts")
		elseif t == "shipLaunched" and e.playerId == pid then
			bump(progress, "launches")
		elseif t == "cityCaptured" and e.to == pid then
			bump(progress, "captures")
		elseif t == "combatResolved" then
			if e.attackerOwner == pid and e.winner == "attacker" then
				bump(progress, "battlesWon")
			elseif e.defenderOwner == pid and e.winner ~= "attacker" then
				bump(progress, "battlesWon")
				bump(progress, "defencesWon")
			end
		end
	end
	local me = state.players ~= nil and state.players[pid] or nil
	if me ~= nil then
		atMost(progress, "peakGold", me.gold or 0)
		-- an era is complete when every advance of that era is known
		local known = {}
		for _, id in ipairs(me.techs or {}) do
			known[id] = true
		end
		local missing = {}
		for id, def in pairs(rs.techs) do
			if not known[id] then
				missing[def.era] = true
			end
		end
		for _, era in ipairs(M.ERAS) do
			if not missing[era] and #(me.techs or {}) > 0 then
				progress["era_" .. era] = true
			end
		end
	end
end

local function holds(b, progress, info)
	if b.kind == "count" then
		return (progress[b.field] or 0) >= b.n
	elseif b.kind == "flag" then
		return progress[b.field] == true
	end
	return info ~= nil and info.won == true and b.when(info)
end

-- keys earned since the last call (each key is returned once per progress).
-- info = nil during play; at game over { won, victory, difficulty, civs,
-- combat, debugUsed, heldShare } (heldShare: 0..1 of turns the player, not
-- the regent, held the seat).
-- Nothing is earned in a debug game; victories need heldShare >= MIN_HELD.
M.MIN_HELD = 0.5
function M.newlyEarned(progress, info)
	local out = {}
	if info ~= nil and info.debugUsed == true then
		return out
	end
	if progress.debug == true then
		return out
	end
	for _, b in ipairs(M.BADGES) do
		if not progress.earned[b.key] then
			local okWin = b.kind ~= "win" or (info ~= nil and (info.heldShare or 0) >= M.MIN_HELD)
			if okWin and holds(b, progress, info) then
				progress.earned[b.key] = true
				out[#out + 1] = b.key
			end
		end
	end
	return out
end

return M
