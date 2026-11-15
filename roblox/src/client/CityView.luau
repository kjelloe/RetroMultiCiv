-- City screen rules (pure: no Instances) - plan step 1 (specs/
-- roblox-parity-plan.md): the food / growth line, specialists, capital mark,
-- trade route lines, previous / next city. The figures mirror the browser's
-- client/ui/panels.js city view and the engine's processCities.
-- roblox/selftest/city-view.luau (gate 59).
local M = {}

M.FOOD_PER_CITIZEN = 2 -- engine: city.food += yields.food - pop * 2 - settlerFood
M.SPECIALIST_MIN_POP = 5 -- engine setWorkers: taxmen / scientists need pop >= 5

function M.settlersHomed(view, cityId)
	local n = 0
	for _, u in pairs(view.units or {}) do
		if u.home == cityId and u.type == "settlers" then
			n += 1
		end
	end
	return n
end

-- made = the worked tiles' food; threshold = the engine's growthThreshold
-- -> { made, eaten, settlers, settlerFood, surplus, box, threshold, state, turns, line, warn }
function M.food(city, made, settlers, rules, threshold)
	local upkeep = rules.settlerFoodUpkeep or 0
	local eaten = (city.pop or 1) * M.FOOD_PER_CITIZEN
	local settlerFood = settlers * upkeep
	local surplus = made - eaten - settlerFood
	local box = city.food or 0
	local f = { made = made, eaten = eaten, settlers = settlers, settlerFood = settlerFood, surplus = surplus,
		box = box, threshold = threshold }
	if surplus > 0 then
		f.state = "growing"
		f.turns = math.max(1, math.ceil((threshold - box) / surplus))
		f.line = ("grows in %d %s"):format(f.turns, f.turns == 1 and "turn" or "turns")
	elseif surplus < 0 then
		f.state = "starving"
		-- the box empties, then the city loses a citizen
		f.turns = math.max(1, math.ceil((box + 1) / -surplus))
		f.line = ("STARVING: %d food a turn short, the box is empty in %d %s"):format(-surplus, f.turns, f.turns == 1 and "turn" or "turns")
		f.warn = settlerFood > 0 and "Settlers supported here eat food: found a city with them or move their home."
			or "Work tiles with more food, or irrigate."
	else
		f.state = "stalled"
		f.line = "no growth: the city eats all it makes"
		f.warn = "Work tiles with more food, or irrigate."
	end
	return f
end

-- mood: the engine's cityMood ({ entertainers, taxmen, scientists, ... })
-- -> { entertainers, taxmen, scientists, canAdd, canClear, why }
function M.specialists(city, mood)
	local s = { entertainers = mood.entertainers or 0, taxmen = mood.taxmen or 0, scientists = mood.scientists or 0 }
	s.canAdd = s.entertainers > 0 and (city.pop or 1) >= M.SPECIALIST_MIN_POP
	s.canClear = s.taxmen + s.scientists > 0
	if (city.pop or 1) < M.SPECIALIST_MIN_POP then
		s.why = ("Tax collectors and scientists need a city of size %d."):format(M.SPECIALIST_MIN_POP)
	elseif s.entertainers == 0 then
		s.why = "Every citizen works a tile. Take a worker off a tile (click it on the map) to free one."
	end
	return s
end

-- the setWorkers command that turns one entertainer into a taxman /
-- scientist, or sends every specialist back; nil when the engine would
-- refuse it. workers = the tile indices worked now (kept as they are).
function M.specialistCommand(city, mood, workers, action)
	local s = M.specialists(city, mood)
	local taxmen, scientists = s.taxmen, s.scientists
	if action == "taxman" or action == "scientist" then
		if not s.canAdd then
			return nil
		end
		if action == "taxman" then
			taxmen += 1
		else
			scientists += 1
		end
	elseif action == "clear" then
		if not s.canClear then
			return nil
		end
		taxmen, scientists = 0, 0
	else
		return nil
	end
	if #workers + taxmen + scientists > (city.pop or 1) then
		return nil
	end
	local sorted = table.clone(workers)
	table.sort(sorted)
	return { type = "setWorkers", cityId = city.id, workers = sorted, taxmen = taxmen, scientists = scientists }
end

function M.isCapital(city, rs)
	for _, b in ipairs(city.buildings or {}) do
		local def = rs.buildings[b]
		if def ~= nil and def.effect ~= nil and def.effect.isPalace == true then
			return true
		end
	end
	return false
end

-- report: the engine's tradeRouteReport rows { partnerCityId, arrows, counted }
function M.routes(report, view)
	local out = {}
	for _, r in ipairs(report or {}) do
		local partner = view.cities ~= nil and view.cities[r.partnerCityId] or nil
		out[#out + 1] = { name = partner ~= nil and partner.name or "a distant city", arrows = r.arrows or 0,
			counted = r.counted ~= false }
	end
	return out
end

-- the own city before (dir = -1) or after (dir = 1) this one, in cityOrder,
-- wrapping; nil when there is no other own city
function M.neighbour(view, cityId, dir)
	local own = {}
	for _, id in ipairs(view.cityOrder or {}) do
		local c = view.cities[id]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			own[#own + 1] = id
		end
	end
	local at = table.find(own, cityId)
	if at == nil or #own < 2 then
		return nil
	end
	return own[(at - 1 + dir) % #own + 1]
end

-- the line under the city name
function M.subtitle(city, rs)
	if city.disorder == true then
		return "CIVIL DISORDER - no production or taxes until the mood improves", "bad"
	end
	if city.celebrating == true then
		return "We Love the King Day - no corruption while it lasts", "good"
	end
	return ("population %d%s"):format(city.pop or 1, M.isCapital(city, rs) and "  -  capital" or ""), "plain"
end

return M
