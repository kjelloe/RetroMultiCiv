--!strict
-- Luau twin of engine/tech.js (phase 5, P5-5): trade splits into gold/bulbs
-- by per-player rates; advances cost techBaseCost * (known + 1). The real
-- module now OWNS the lazy default writes the P5-3 hook carried — same
-- writes, same order, so 001's pin must not move.
-- EXPORTS (stable): researchCost, availableTechs, setResearch, setRates,
-- processResearch, playerIncome, prereqsMet.

local cities = require("./cities")
local government = require("./government")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function researchCost(state: any, playerId: string, ruleset: any): number
	local known = #state.players[playerId].techs
	return ruleset.rules.techBaseCost * (known + 1)
end

local function knows(player: any, techId: string): boolean
	return table.find(player.techs, techId) ~= nil
end

local function prereqsMet(player: any, techId: string, ruleset: any): boolean
	local tech = ruleset.techs[techId]
	if tech == nil then
		return false
	end
	for _, p in ipairs(tech.prereqs) do
		if not knows(player, p) then
			return false
		end
	end
	return true
end

-- Sorted for deterministic order in every language.
local function availableTechs(state: any, playerId: string, ruleset: any): { string }
	local player = state.players[playerId]
	local ids = {}
	for id in pairs(ruleset.techs) do
		table.insert(ids, id)
	end
	table.sort(ids)
	local out = {}
	for _, id in ipairs(ids) do
		if not knows(player, id) and prereqsMet(player, id, ruleset) then
			table.insert(out, id)
		end
	end
	return out
end

local function setResearch(state: any, cmd: any, ruleset: any): any
	local player = state.players[cmd.playerId]
	if player == nil then
		return { ok = false, reason = "unknownPlayer" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	if ruleset.techs[cmd.tech] == nil then
		return { ok = false, reason = "unknownTech" }
	end
	if knows(player, cmd.tech) then
		return { ok = false, reason = "alreadyKnown" }
	end
	if not prereqsMet(player, cmd.tech, ruleset) then
		return { ok = false, reason = "prereqsMissing" }
	end
	player.researching = cmd.tech
	return { ok = true, events = { { type = "researchSet", playerId = cmd.playerId, tech = cmd.tech } } }
end

local function setRates(state: any, cmd: any, ruleset: any): any
	local player = state.players[cmd.playerId]
	if player == nil then
		return { ok = false, reason = "unknownPlayer" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local tax = cmd.tax
	local sci = cmd.sci
	local lux = if cmd.lux == nil then 0 else cmd.lux
	local isInt = function(n: any): boolean
		return typeof(n) == "number" and n % 1 == 0
	end
	local valid = isInt(tax) and isInt(sci) and isInt(lux)
		and tax >= 0 and sci >= 0 and lux >= 0 and tax + sci + lux == 100
		and tax % 10 == 0 and sci % 10 == 0 and lux % 10 == 0
	if not valid then
		return { ok = false, reason = "badRates" }
	end
	local cap = government.governmentOf(state, cmd.playerId, ruleset).maxRate
	if tax > cap or sci > cap or lux > cap then
		return { ok = false, reason = "rateTooHigh" }
	end
	player.taxRate = tax
	player.sciRate = sci
	if lux > 0 then
		player.luxRate = lux
	else
		player.luxRate = nil
	end
	return { ok = true, events = { { type = "ratesSet", playerId = cmd.playerId, tax = tax, sci = sci, lux = lux } } }
end

-- Per-turn income for one player, before it is applied. Pure.
local function playerIncome(state: any, playerId: string, ruleset: any)
	local player = state.players[playerId]
	local taxRate = if player.taxRate == nil then ruleset.rules.defaultTaxRate else player.taxRate
	local sciRate = if player.sciRate == nil then ruleset.rules.defaultSciRate else player.sciRate
	local perSpecialist = ruleset.rules.specialistOutput
	local anarchy = government.governmentOf(state, playerId, ruleset).id == "anarchy"
	local gold, bulbs, maintenance = 0, 0, 0
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city == nil or city.owner ~= playerId then
			continue
		end
		for _, b in ipairs(city.buildings or {}) do
			maintenance += ruleset.buildings[b].maintenance
		end
		if city.disorder == true then
			continue -- civil disorder: no taxes, no research
		end
		if anarchy then
			continue -- anarchy: the state collects nothing
		end
		local trade = cities.cityYields(state, city, ruleset).trade
		trade -= government.corruptionFor(state, city, trade, ruleset)
		local cityTax = idiv(trade * taxRate, 100)
		local citySci = idiv(trade * sciRate, 100)
		gold += cityTax + idiv(cityTax * cities.effectPct(city, ruleset, "taxBonus"), 100)
		bulbs += citySci + idiv(citySci * cities.effectPct(city, ruleset, "sciBonus"), 100)
		if city.taxmen ~= nil then
			gold += city.taxmen * perSpecialist
		end
		if city.scientists ~= nil then
			bulbs += city.scientists * perSpecialist
		end
	end
	return { gold = gold, bulbs = bulbs, maintenance = maintenance }
end

-- Runs once per game turn (turn wrap): collect trade, split, maybe discover.
local function processResearch(state: any, ruleset: any, events: any)
	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player.taxRate == nil then
			player.taxRate = ruleset.rules.defaultTaxRate
		end
		if player.sciRate == nil then
			player.sciRate = ruleset.rules.defaultSciRate
		end
		if player.bulbs == nil then
			player.bulbs = 0
		end

		local income = playerIncome(state, pid, ruleset)
		player.gold = player.gold + income.gold - income.maintenance
		if player.gold < 0 then
			player.gold = 0 -- Civ 1 sells buildings; clamped for now
		end
		player.bulbs += income.bulbs

		if player.researching ~= "" and player.researching ~= nil then
			local cost = researchCost(state, pid, ruleset)
			if player.bulbs >= cost then
				player.bulbs -= cost -- overflow carries into the next advance
				table.insert(player.techs, player.researching)
				table.insert(events, { type = "techDiscovered", playerId = pid, tech = player.researching })
				player.researching = ""
			end
		end
	end
end

return {
	researchCost = researchCost,
	availableTechs = availableTechs,
	setResearch = setResearch,
	setRates = setRates,
	processResearch = processResearch,
	playerIncome = playerIncome,
	prereqsMet = prereqsMet,
}
