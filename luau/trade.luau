--!strict
-- Luau twin of engine/trade.js (A89 / N10 caravan trade routes). A caravan in a
-- city establishes a route from its HOME city to that partner: one-time windfall
-- (cash AND bulbs, full each, to the sender) + a LIVE permanent trade bonus on
-- the home city (top routeCap routes count). All numbers in rules.tradeRoute.
-- R1: both formulas use BASE arrows (post-corruption, pre-split, EXCLUDING route
-- contributions) at both endpoints — no cross-city fixpoint.
local statehash = require("./statehash")
local cities = require("./cities")
local government = require("./government")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function wrapX(map: any, x: number): number
	if not map.wrapX then return x end
	return ((x % map.width) + map.width) % map.width
end

local function chebyshev(map: any, ax: number, ay: number, bx: number, by: number): number
	local dx = math.abs(ax - bx)
	if map.wrapX and map.width - dx < dx then dx = map.width - dx end
	local dy = math.abs(ay - by)
	return if dx > dy then dx else dy
end

-- The city on tile (x, y), or nil. Local scan (keeps trade.luau off combat.luau).
local function cityAtTile(state: any, x: number, y: number): any
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.x == x and c.y == y then return c end
	end
	return nil
end

-- BASE trade arrows for a city: post-corruption, pre-split, EXCLUDING routes.
local function tradeArrows(state: any, city: any, ruleset: any): number
	local raw = cities.cityYields(state, city, ruleset).trade
	return raw - government.corruptionFor(state, city, raw, ruleset)
end

local N8 = { { -1, -1 }, { 0, -1 }, { 1, -1 }, { -1, 0 }, { 1, 0 }, { -1, 1 }, { 0, 1 }, { 1, 1 } }

local function isLand(state: any, ruleset: any, x: number, y: number): boolean
	local t = state.map.tiles[y * state.map.width + x + 1]
	return ruleset.terrain.terrains[t.t].domain ~= "sea"
end

-- Are the two city tiles connected over LAND, 8-way, wrapX-aware? Iterative flood
-- fill; visited = plain table keyed by tile index; never recursion.
local function landConnected(state: any, x1: number, y1: number, x2: number, y2: number, ruleset: any): boolean
	local map = state.map
	local w = map.width
	local start = y1 * w + x1
	local target = y2 * w + x2
	if start == target then return true end
	local visited = {}
	visited[start] = true
	local queue = { start }
	local head = 1
	while head <= #queue do
		local cur = queue[head]
		head = head + 1
		local cx = cur % w
		local cy = idiv(cur, w)
		for _, d in ipairs(N8) do
			local ny = cy + d[2]
			if ny >= 0 and ny < map.height then
				local nx = cx + d[1]
				local skip = false
				if map.wrapX then
					nx = wrapX(map, nx)
				elseif nx < 0 or nx >= w then
					skip = true
				end
				if not skip and isLand(state, ruleset, nx, ny) then
					local ni = ny * w + nx
					if ni == target then return true end
					if visited[ni] ~= true then
						visited[ni] = true
						table.insert(queue, ni)
					end
				end
			end
		end
	end
	return false
end

local function applyMul(x: number, m: any): number
	return idiv(x * m.num, m.den)
end

-- One-time windfall to the sender — cash and bulbs, full each. Multipliers in the
-- FIXED order continent -> civ -> railroad -> flight (integer division: order matters).
local function windfall(state: any, home: any, partner: any, ruleset: any): number
	local tr = ruleset.rules.tradeRoute
	local dist = chebyshev(state.map, home.x, home.y, partner.x, partner.y)
	local arrows = tradeArrows(state, home, ruleset) + tradeArrows(state, partner, ruleset)
	local amt = idiv((dist + tr.windfallDistanceBonus) * arrows, tr.windfallDivisor)
	if landConnected(state, home.x, home.y, partner.x, partner.y, ruleset) then
		amt = applyMul(amt, tr.sameContinent)
	end
	if home.owner == partner.owner then
		amt = applyMul(amt, tr.sameCiv)
	end
	local sender = state.players[home.owner]
	if table.find(sender.techs, tr.railroad.tech) ~= nil then amt = applyMul(amt, tr.railroad) end
	if table.find(sender.techs, tr.flight.tech) ~= nil then amt = applyMul(amt, tr.flight) end
	return amt
end

local function routeContribution(state: any, home: any, partner: any, ruleset: any): number
	local tr = ruleset.rules.tradeRoute
	local a = tradeArrows(state, home, ruleset) + tradeArrows(state, partner, ruleset) + tr.permanentPad
	local c = idiv(a, tr.permanentDivisor)
	if home.owner == partner.owner then c = applyMul(c, tr.sameCiv) end
	return c
end

-- The permanent trade bonus added to `city`'s arrows: sum of the top routeCap
-- routes (ranked desc, ties by LOWER partnerCityId). Skips destroyed partners.
local function routeArrows(state: any, city: any, ruleset: any): number
	if city.tradeRoutes == nil or #city.tradeRoutes == 0 then return 0 end
	local tr = ruleset.rules.tradeRoute
	local list = {}
	for _, r in ipairs(city.tradeRoutes) do
		local partner = state.cities[r.partnerCityId]
		if partner ~= nil then
			table.insert(list, { pid = r.partnerCityId, c = routeContribution(state, city, partner, ruleset) })
		end
	end
	table.sort(list, function(p, q)
		if p.c ~= q.c then return p.c > q.c end
		return p.pid < q.pid
	end)
	local sum = 0
	local cap = tr.routeCap
	for i = 1, #list do
		if i > cap then break end
		sum = sum + list[i].c
	end
	return sum
end

-- The establishTradeRoute command (explicit; both endpoints derived).
local function establishTradeRoute(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then return { ok = false, reason = "unknownUnit" } end
	if unit.owner ~= cmd.playerId then return { ok = false, reason = "notYourUnit" } end
	if state.activePlayer ~= cmd.playerId then return { ok = false, reason = "notYourTurn" } end
	local def = ruleset.units[unit.type]
	if def == nil or def.tradeRoutes ~= true then return { ok = false, reason = "notCaravan" } end
	local partner = cityAtTile(state, unit.x, unit.y)
	if partner == nil then return { ok = false, reason = "cityRequired" } end
	local home = if unit.home == nil then nil else state.cities[unit.home]
	if home == nil or home.owner ~= unit.owner then return { ok = false, reason = "noHomeCity" } end
	if partner.id == home.id then return { ok = false, reason = "sameCity" } end
	local routes = if home.tradeRoutes == nil then {} else home.tradeRoutes
	for _, r in ipairs(routes) do
		if r.partnerCityId == partner.id then return { ok = false, reason = "duplicateRoute" } end
	end
	if partner.owner == home.owner then
		local dist = chebyshev(state.map, home.x, home.y, partner.x, partner.y)
		if dist < ruleset.rules.tradeRoute.minDomesticDistance then
			return { ok = false, reason = "ownCityTooClose" }
		end
	end
	local amt = windfall(state, home, partner, ruleset)
	local sender = state.players[home.owner]
	sender.gold = sender.gold + amt
	sender.bulbs = sender.bulbs + amt
	if home.tradeRoutes == nil then
		home.tradeRoutes = setmetatable({}, statehash.ARRAY_MT)
	end
	table.insert(home.tradeRoutes, { partnerCityId = partner.id })
	state.units[cmd.unitId] = nil
	local events = setmetatable({}, statehash.ARRAY_MT)
	table.insert(events, {
		type = "tradeRouteEstablished", playerId = home.owner,
		homeCityId = home.id, partnerCityId = partner.id, gold = amt, bulbs = amt,
	})
	return { ok = true, events = events }
end

return {
	establishTradeRoute = establishTradeRoute,
	routeArrows = routeArrows,
	tradeArrows = tradeArrows,
	windfall = windfall,
	landConnected = landConnected,
	cityAtTile = cityAtTile,
}
