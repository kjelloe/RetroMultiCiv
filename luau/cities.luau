--!strict
-- PARTIAL twin of engine/cities.js (phase 5, P5-4): only the pure helpers
-- combat.luau imports. The full module (founding, yields, growth,
-- production) is the P5-5 batch — until then the dispatcher rejects city
-- commands as notPorted:cities and the endTurn hook guards on cities
-- existing. The R-lane must not treat this surface as final API.
-- EXPORTS (stable): hasBuilding(city, buildingId), wonderActive(state,
-- wonderId, ruleset).

local function hasBuilding(city: any, buildingId: string): boolean
	return city.buildings ~= nil and table.find(city.buildings, buildingId) ~= nil
end

-- A wonder is active while built and its obsoleting tech is unknown to ALL
-- players (Civ 1: anyone's discovery retires it).
local function wonderActive(state: any, wonderId: string, ruleset: any): boolean
	if state.wonders == nil or state.wonders[wonderId] == nil then
		return false
	end
	local obsoleteBy = ruleset.wonders[wonderId].obsoleteBy
	if obsoleteBy == "" then
		return true
	end
	for _, pid in ipairs(state.playerOrder) do
		-- filtered VIEWS hide rival techs — treat unknown as not-yet-discovered
		local techs = state.players[pid].techs
		if techs ~= nil and table.find(techs, obsoleteBy) ~= nil then
			return false
		end
	end
	return true
end

return {
	hasBuilding = hasBuilding,
	wonderActive = wonderActive,
}
