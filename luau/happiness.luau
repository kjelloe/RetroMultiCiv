--!strict
-- Luau twin of engine/happiness.js (phase 5 — rides the P5-5 batch: the
-- turn wrap runs updateDisorder before the harvest, so the 004/005 pins
-- force the mood math in with cities). Citizens are happy/content/unhappy;
-- luxuries and content bonuses repair the mood worst-first; unhappy > happy
-- = DISORDER.
-- EXPORTS (stable): cityMood(state, city, ruleset), updateDisorder(state,
-- ruleset, events), specialistsOf(city, workedCount).

local cities = require("./cities")
local combat = require("./combat")
local government = require("./government")
local difficulty = require("./difficulty")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

-- Explicit specialists are stored on the city; entertainers are the rest of
-- the citizens who work no tile.
local function specialistsOf(city: any, workedCount: number)
	local taxmen = if city.taxmen == nil then 0 else city.taxmen
	local scientists = if city.scientists == nil then 0 else city.scientists
	local entertainers = city.pop - workedCount - taxmen - scientists
	if entertainers < 0 then
		entertainers = 0
	end
	return { entertainers = entertainers, taxmen = taxmen, scientists = scientists }
end

local function cityMood(state: any, city: any, ruleset: any): any
	local rules = ruleset.rules
	local player = state.players[city.owner]
	local workedCount = #cities.workedTiles(state, city, ruleset) - 1 -- minus center
	local s = specialistsOf(city, workedCount)
	local workers = city.pop - s.entertainers - s.taxmen - s.scientists

	-- contentCitizens is a WORLD difficulty knob (applies all-AI too); falls back to
	-- rules.contentCitizens when the game carries no difficulty (crafted scenarios).
	local dOf = difficulty.difficultyOf(state, ruleset)
	local contentCitizens = if dOf ~= nil then dOf.contentCitizens else rules.contentCitizens
	local unhappy = workers - contentCitizens
	if unhappy < 0 then
		unhappy = 0
	end
	local content = workers - unhappy
	local happy = 0

	-- war unhappiness (Republic/Democracy): each military unit from this
	-- city that is away from any of the player's city tiles upsets citizens
	local gov = government.governmentOf(state, city.owner, ruleset)
	-- #29 women's-suffrage: reduce the per-unit war unhappiness by 1 for its owner's cities
	-- (Republic 1->0, Democracy 2->1), floored at 0. NOT a full cancel.
	local warReduce = 0
	local wsKeys = {}
	for id in pairs(state.wonders or {}) do
		table.insert(wsKeys, id)
	end
	for _, wid in ipairs(combat.sortIds(wsKeys)) do
		if cities.wonderActive(state, wid, ruleset) then
			local wh = state.cities[state.wonders[wid]]
			if wh ~= nil and wh.owner == city.owner then
				local wr = ruleset.wonders[wid].effect.warUnhappyReduce
				if wr ~= nil then
					warReduce += wr
				end
			end
		end
	end
	local warPerUnit = gov.warUnhappiness - warReduce
	if warPerUnit < 0 then
		warPerUnit = 0
	end
	if warPerUnit > 0 then
		local abroad = 0
		local unitKeys = {}
		for id in pairs(state.units) do
			table.insert(unitKeys, id)
		end
		for _, uid in ipairs(combat.sortIds(unitKeys)) do
			local u = state.units[uid]
			-- air-truth: freeSupport units (diplomat, caravan) never cause away war-unhappiness
			if u.home == city.id and ruleset.units[u.type].attack > 0
				and ruleset.units[u.type].freeSupport ~= true then
				local atHome = false
				for _, cid in ipairs(state.cityOrder) do
					local c = state.cities[cid]
					if c ~= nil and c.owner == city.owner and c.x == u.x and c.y == u.y then
						atHome = true
					end
				end
				if not atHome then
					abroad += 1
				end
			end
		end
		local war = abroad * warPerUnit
		while war > 0 and content > 0 do
			content -= 1
			unhappy += 1
			war -= 1
		end
		while war > 0 and happy > 0 do
			happy -= 1
			unhappy += 1
			war -= 1
		end
	end

	-- luxuries: every luxPerStep upgrades one citizen one step, worst first
	local luxRate = if player.luxRate == nil then 0 else player.luxRate
	local lux = idiv(cities.cityYields(state, city, ruleset).trade * luxRate, 100)
	lux += idiv(lux * cities.effectPct(city, ruleset, "luxBonus"), 100)
	lux += s.entertainers * rules.specialistOutput
	local steps = idiv(lux, rules.luxPerStep)
	while steps > 0 and unhappy > 0 do
		unhappy -= 1
		content += 1
		steps -= 1
	end
	while steps > 0 and content > 0 do
		content -= 1
		happy += 1
		steps -= 1
	end

	-- buildings: content bonuses calm unhappy citizens
	local bonus = 0
	for _, id in ipairs(city.buildings or {}) do
		local eff = ruleset.buildings[id].effect
		if eff.contentBonus ~= nil then
			local b = eff.contentBonus
			if eff.contentDoubleTech ~= nil and table.find(player.techs, eff.contentDoubleTech) ~= nil then
				b *= 2
			end
			if id == "temple" and cities.wonderActive(state, "oracle", ruleset) then
				local oracleHome = state.cities[state.wonders["oracle"]]
				if oracleHome ~= nil and oracleHome.owner == city.owner then
					b *= 2
				end
			end
			bonus += b
		end
	end
	-- wonders owned by this player: empire-wide and in-city moods
	local happyBonus = 0
	local allContent = false
	local wonderKeys = {}
	for id in pairs(state.wonders or {}) do
		table.insert(wonderKeys, id)
	end
	for _, wid in ipairs(combat.sortIds(wonderKeys)) do
		if cities.wonderActive(state, wid, ruleset) then
			local home = state.cities[state.wonders[wid]]
			if home ~= nil and home.owner == city.owner then
				local eff = ruleset.wonders[wid].effect
				if eff.contentEverywhere ~= nil then
					bonus += eff.contentEverywhere
				end
				if eff.happyEverywhere ~= nil then
					happyBonus += eff.happyEverywhere
				end
				if eff.allContentInCity == true and home.id == city.id then
					allContent = true
				end
			end
		end
	end
	-- martial law: garrisoned military units pacify (government-limited)
	if gov.martialLawMax > 0 then
		local martial = 0
		for _, u in pairs(state.units) do
			if u.owner == city.owner and u.x == city.x and u.y == city.y
				and ruleset.units[u.type].attack > 0 then
				martial += 1
			end
		end
		if martial > gov.martialLawMax then
			martial = gov.martialLawMax
		end
		bonus += martial
	end
	while bonus > 0 and unhappy > 0 do
		unhappy -= 1
		content += 1
		bonus -= 1
	end
	if allContent then
		content += unhappy
		unhappy = 0
	end
	while happyBonus > 0 and content > 0 do
		content -= 1
		happy += 1
		happyBonus -= 1
	end

	return {
		happy = happy, content = content, unhappy = unhappy, workers = workers, lux = lux,
		entertainers = s.entertainers, taxmen = s.taxmen, scientists = s.scientists,
		disorder = unhappy > happy,
	}
end

-- Turn wrap (before cities harvest): store/refresh each city's disorder flag
-- so processCities and playerIncome read one consistent verdict all turn.
local function updateDisorder(state: any, ruleset: any, events: any)
	for _, cityId in ipairs(state.cityOrder or {}) do
		local city = state.cities[cityId]
		if city ~= nil then
			local disorder = cityMood(state, city, ruleset).disorder
			if disorder and city.disorder ~= true then
				city.disorder = true
				table.insert(events, { type = "cityDisorder", cityId = cityId })
			elseif not disorder and city.disorder == true then
				city.disorder = nil
				table.insert(events, { type = "cityOrderRestored", cityId = cityId })
			end
		end
	end
end

return {
	cityMood = cityMood,
	updateDisorder = updateDisorder,
	specialistsOf = specialistsOf,
}
