--!strict
-- Luau twin of engine/government.js (phase 5 — helpers P5-5, completed
-- P5-6): rate caps, corruption, revolutions (anarchy countdown), and the
-- Pyramids instant-switch — the first wonder EFFECT to run cross-language.
-- No RNG anywhere in this module; no sorts (tie audit trivially clean).
-- EXPORTS (stable): governmentOf, capitalOf, corruptionFor, clampRates,
-- setGovernment, processRevolutions.

local function governmentOf(state: any, playerId: string, ruleset: any): any
	-- an unknown player (e.g. a pseudo-city probe) is treated as despotism
	local player = state.players[playerId]
	local id = if player == nil or player.government == nil then "despotism" else player.government
	return ruleset.governments[id]
end

-- The capital: the city holding a Palace, else the player's oldest city.
local function capitalOf(state: any, playerId: string, ruleset: any): any
	local first = nil
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId then
			if first == nil then
				first = city
			end
			for _, b in ipairs(city.buildings or {}) do
				if ruleset.buildings[b].effect.isPalace == true then
					return city
				end
			end
		end
	end
	return first
end

-- Trade lost to corruption for one city (0 at the capital; Courthouse helps).
local function corruptionFor(state: any, city: any, trade: number, ruleset: any): number
	local gov = governmentOf(state, city.owner, ruleset)
	if gov.corruptionFactor == 0 then
		return 0
	end
	local capital = capitalOf(state, city.owner, ruleset)
	if capital == nil or capital.id == city.id then
		return 0
	end
	local dist
	if gov.fixedCorruptionDist ~= nil then
		dist = gov.fixedCorruptionDist
	else
		local dx = capital.x - city.x
		if dx < 0 then
			dx = -dx
		end
		if state.map.wrapX and state.map.width - dx < dx then
			dx = state.map.width - dx
		end
		local dy = capital.y - city.y
		if dy < 0 then
			dy = -dy
		end
		dist = if dx > dy then dx else dy
	end
	local corruption = math.floor((trade * dist * gov.corruptionFactor) / 200)
	if corruption > trade then
		corruption = trade
	end
	-- Courthouse (corruptionReduction percent)
	for _, b in ipairs(city.buildings or {}) do
		local cut = ruleset.buildings[b].effect.corruptionReduction
		if cut ~= nil then
			corruption = corruption - math.floor((corruption * cut) / 100)
		end
	end
	return corruption
end

-- Clamp a player's rates to the government's cap; overflow goes to tax
-- first, then luxuries (caps are >= 60, so a fit always exists).
local function clampRates(player: any, gov: any, rules: any)
	local tax = if player.taxRate == nil then rules.defaultTaxRate else player.taxRate
	local sci = if player.sciRate == nil then rules.defaultSciRate else player.sciRate
	local lux = if player.luxRate == nil then 0 else player.luxRate
	if sci > gov.maxRate then
		sci = gov.maxRate
	end
	if tax > gov.maxRate then
		tax = gov.maxRate
	end
	if lux > gov.maxRate then
		lux = gov.maxRate
	end
	local rest = 100 - tax - sci - lux
	local taxRoom = gov.maxRate - tax
	local taxAdd = if rest < taxRoom then rest else taxRoom
	tax += taxAdd
	rest -= taxAdd
	lux += rest
	player.taxRate = tax
	player.sciRate = sci
	if lux > 0 then
		player.luxRate = lux
	else
		player.luxRate = nil
	end
end

-- #35 the government wonder active for a player: scans their ACTIVE, non-obsolete wonders for
-- the government-effect fields (unlockAnyGov / revolutionAnarchyTurns) and returns the merged
-- effect, or nil. Inlined active-check (twin of the JS; not routed through cities.wonderActive).
local function pyramidsGov(state: any, pid: string, ruleset: any): any
	if state.wonders == nil then
		return nil
	end
	local out = nil
	for wid in pairs(state.wonders) do
		local eff = ruleset.wonders[wid].effect
		if eff.unlockAnyGov ~= nil or eff.revolutionAnarchyTurns ~= nil then
			local home = state.cities[state.wonders[wid]]
			if home ~= nil and home.owner == pid then
				local obsoleteBy = ruleset.wonders[wid].obsoleteBy
				local active = true
				if obsoleteBy ~= "" then
					for _, p in ipairs(state.playerOrder) do
						local techs = state.players[p].techs
						if techs ~= nil and table.find(techs, obsoleteBy) ~= nil then
							active = false
						end
					end
				end
				if active then
					if out == nil then
						out = {}
					end
					if eff.unlockAnyGov ~= nil then
						out.unlockAnyGov = eff.unlockAnyGov
					end
					if eff.revolutionAnarchyTurns ~= nil then
						out.revolutionAnarchyTurns = eff.revolutionAnarchyTurns
					end
				end
			end
		end
	end
	return out
end

-- Command: start a revolution toward a known government.
local function setGovernment(state: any, cmd: any, ruleset: any): any
	local player = state.players[cmd.playerId]
	if player == nil then
		return { ok = false, reason = "unknownPlayer" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local gov = ruleset.governments[cmd.government]
	if gov == nil or cmd.government == "anarchy" then
		return { ok = false, reason = "badGovernment" }
	end
	-- #35 the Pyramids government wonder (effect fields on its owner's active wonder):
	-- unlockAnyGov bypasses the tech requirement; revolutionAnarchyTurns shortens the anarchy.
	local pyr = pyramidsGov(state, cmd.playerId, ruleset)
	if gov.tech ~= "" and table.find(player.techs, gov.tech) == nil
		and not (pyr ~= nil and pyr.unlockAnyGov == true) then
		return { ok = false, reason = "techRequired" }
	end
	local current = if player.government == nil then "despotism" else player.government
	if current == cmd.government then
		return { ok = false, reason = "alreadyGovernment" }
	end
	if player.revolutionTurns ~= nil then
		return { ok = false, reason = "inRevolution" }
	end

	-- the Pyramids caps the interregnum at revolutionAnarchyTurns (Civ 1: one turn); 0 = instant.
	local anarchyTurns = ruleset.rules.revolutionTurns
	if pyr ~= nil and pyr.revolutionAnarchyTurns ~= nil then
		anarchyTurns = pyr.revolutionAnarchyTurns
	end
	if anarchyTurns <= 0 then
		player.government = cmd.government
		clampRates(player, gov, ruleset.rules)
		return { ok = true, events = { { type = "governmentChanged", playerId = cmd.playerId, government = cmd.government } } }
	end
	player.government = "anarchy"
	player.pendingGovernment = cmd.government
	player.revolutionTurns = anarchyTurns
	-- anarchy caps rates too — a Monarchy running 70% science must drop to
	-- the interregnum's 60 immediately (found organically by the sim net)
	clampRates(player, ruleset.governments.anarchy, ruleset.rules)
	return { ok = true, events = { { type = "revolutionStarted", playerId = cmd.playerId, government = cmd.government } } }
end

-- Turn wrap: revolutions tick down; the new government arrives with
-- clamped rates.
local function processRevolutions(state: any, ruleset: any, events: any)
	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player.revolutionTurns ~= nil then
			player.revolutionTurns -= 1
			if player.revolutionTurns <= 0 then
				local next_ = player.pendingGovernment
				player.government = next_
				player.pendingGovernment = nil
				player.revolutionTurns = nil
				clampRates(player, ruleset.governments[next_], ruleset.rules)
				table.insert(events, { type = "governmentChanged", playerId = pid, government = next_ })
			end
		end
	end
end

return {
	governmentOf = governmentOf,
	capitalOf = capitalOf,
	corruptionFor = corruptionFor,
	clampRates = clampRates,
	setGovernment = setGovernment,
	processRevolutions = processRevolutions,
}
