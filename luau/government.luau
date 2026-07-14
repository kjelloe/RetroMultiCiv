--!strict
-- PARTIAL twin of engine/government.js (phase 5, P5-5): the pure helpers
-- cities/tech/happiness import. setGovernment, processRevolutions and
-- clampRates are the P5-6 batch — the dispatcher rejects setGovernment as
-- notPorted:government and the revolutions hook stays guarded until then.
-- EXPORTS (stable): governmentOf(state, playerId, ruleset),
-- capitalOf(state, playerId, ruleset), corruptionFor(state, city, trade,
-- ruleset).

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

return {
	governmentOf = governmentOf,
	capitalOf = capitalOf,
	corruptionFor = corruptionFor,
}
