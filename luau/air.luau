--!strict
-- Luau twin of engine/air.js (A72): air fuel, processed once per game turn at
-- the wrap. Air units (data `fuel`: turns aloft allowed) must END the turn on a
-- friendly base -- a city, or a carrier they are aboard (A69) -- or they burn a
-- turn of fuel; past their fuel they crash. Omit-safe `aloft` counter (present
-- only while airborne), so crafted-state hashes and the air-free sim are
-- untouched. No RNG. EXPORTS (stable): processAir(state, ruleset, events).

local combat = require("./combat")

local function processAir(state: any, ruleset: any, events: any)
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local u = state.units[id]
		local def = ruleset.units[u.type]
		if def ~= nil and def.domain == "air" and def.fuel ~= nil then
			if u.aboard ~= nil then
				u.aloft = nil -- based on a carrier (A69)
			else
				local city = combat.cityAt(state, u.x, u.y)
				if city ~= nil and city.owner == u.owner then
					u.aloft = nil -- refuelled in a friendly city
				else
					local aloft = (if u.aloft == nil then 0 else u.aloft) + 1
					if aloft > def.fuel then
						state.units[id] = nil
						table.insert(events, { type = "airCrashed", unitId = id, owner = u.owner, x = u.x, y = u.y })
					else
						u.aloft = aloft
					end
				end
			end
		end
	end
end

return {
	processAir = processAir,
}
