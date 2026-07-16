--!strict
-- Luau twin of engine/air.js (A72): air fuel, processed once per game turn at
-- the wrap. Air units (data `fuel`: turns aloft allowed) must END the turn on a
-- friendly base -- a city, or a carrier they are aboard (A69) -- or they burn a
-- turn of fuel; past their fuel they crash. Omit-safe `aloft` counter (present
-- only while airborne), so crafted-state hashes and the air-free sim are
-- untouched. No RNG. EXPORTS (stable): processAir(state, ruleset, events).

local combat = require("./combat")

-- A72: a friendly carrier at (x, y) with a free air slot -- a mobile airbase.
-- Deterministic (first by sorted id). Keys off airCapacity (distinct from the
-- A69 land `transport`), so land units never board a carrier. Twin of air.js.
local function friendlyCarrierAt(state: any, x: number, y: number, owner: string, ruleset: any): any
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local s = state.units[id]
		if s.owner == owner and s.x == x and s.y == y and s.aboard == nil then
			local cap = ruleset.units[s.type].airCapacity
			if cap ~= nil and cap > 0 then
				local load = 0
				for _, c in pairs(state.units) do
					if c.aboard == s.id then
						load += 1
					end
				end
				if load < cap then
					return s
				end
			end
		end
	end
	return nil
end

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
					-- A72 slice 3: base on a friendly carrier with a free slot
					local carrier = friendlyCarrierAt(state, u.x, u.y, u.owner, ruleset)
					if carrier ~= nil then
						u.aboard = carrier.id
						u.aloft = nil
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
end

return {
	processAir = processAir,
}
