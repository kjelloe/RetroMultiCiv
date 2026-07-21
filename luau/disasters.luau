--!strict
-- Luau twin of engine/disasters.js (CIV1 disasters): 7 per-city calamities (meltdown is
-- A91's, engine/pollution.js). Deterministic: every roll through engine/rng.js, iterating
-- cityOrder; RNG drawn ONLY for a city with an ELIGIBLE disaster (triremeLossPct
-- discipline) — a fully-protected empire AND disastersEnabled=false both draw ZERO rng.
-- Matches engine/disasters.js. EXPORTS (stable): process(state, ruleset, events).

local rng = require("./rng")
local cities = require("./cities")
local statehash = require("./statehash")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local ADJ8 = {
	{ dx = 0, dy = -1 }, { dx = 1, dy = -1 }, { dx = 1, dy = 0 }, { dx = 1, dy = 1 },
	{ dx = 0, dy = 1 }, { dx = -1, dy = 1 }, { dx = -1, dy = 0 }, { dx = -1, dy = -1 },
}

-- does the city tile (when includeSelf) OR a neighbor satisfy pred(tile)?
local function nearTile(state: any, cx: number, cy: number, includeSelf: boolean, pred: any): boolean
	local W, H = state.map.width, state.map.height
	if includeSelf and pred(state.map.tiles[cy * W + cx + 1]) then
		return true
	end
	for _, o in ipairs(ADJ8) do
		local x = cx + o.dx
		if x < 0 or x >= W then
			if state.map.wrapX ~= true then
				continue
			end
			x = ((x % W) + W) % W
		end
		local y = cy + o.dy
		if y < 0 or y >= H then
			continue
		end
		if pred(state.map.tiles[y * W + x + 1]) then
			return true
		end
	end
	return false
end

local DISASTER_ORDER = { "pirate", "flood", "fire", "plague", "famine", "volcano", "earthquake" }

-- is `kind` POSSIBLE for this city (terrain/river gate met) AND not prevented?
local function eligible(state: any, city: any, kind: string, ruleset: any): boolean
	local d = ruleset.rules.disasters[kind]
	local player = state.players[city.owner]
	if d.prevent ~= nil and cities.hasBuilding(city, d.prevent) then
		return false
	end
	if d.preventTech ~= nil and table.find(player.techs, d.preventTech) ~= nil then
		return false
	end
	if d.river == true then
		return nearTile(state, city.x, city.y, true, function(t)
			return t.river == true
		end)
	end
	if d.terrain ~= nil then
		local includeSelf = d.terrain == "mountains"
		return nearTile(state, city.x, city.y, includeSelf, function(t)
			return t.t == d.terrain
		end)
	end
	return true
end

-- apply one disaster's effect. Pop loss floors (a size-1 city is immune); building-
-- destroy rng-picks one; pirate loots gold + zeroes the food and shield stocks.
local function strike(state: any, city: any, kind: string, ruleset: any, events: any)
	local d = ruleset.rules.disasters[kind]
	local popLost = 0
	local buildingLost = ""
	if d.popPct ~= nil then
		popLost = idiv(city.pop * d.popPct, 100)
		if popLost > 0 then
			city.pop = city.pop - popLost
		end
	end
	if d.destroyBuilding == true and city.buildings ~= nil and #city.buildings > 0 then
		local bi = rng.rollRange(state.rngState, #city.buildings)
		state.rngState = bi.rngState
		buildingLost = city.buildings[bi.value + 1]
		local kept = setmetatable({}, statehash.ARRAY_MT)
		for i = 1, #city.buildings do
			if i - 1 ~= bi.value then
				table.insert(kept, city.buildings[i])
			end
		end
		city.buildings = kept
	end
	if kind == "pirate" then
		local player = state.players[city.owner]
		local stolen = idiv(player.gold * ruleset.rules.disasters.pirateGoldPct, 100)
		player.gold = player.gold - stolen
		city.food = 0
		city.shields = 0
	end
	table.insert(events, { type = "disasterStruck", kind = kind, cityId = city.id, x = city.x, y = city.y, popLost = popLost, buildingLost = buildingLost })
end

-- once per game turn: each city with an eligible disaster rolls baseChancePct; on a hit,
-- ONE eligible disaster (a second roll) strikes. Runs after pollution.process.
local function process(state: any, ruleset: any, events: any)
	if ruleset.rules.disastersEnabled ~= true then
		return
	end
	local d = ruleset.rules.disasters
	if d == nil then
		return
	end
	local order = if state.cityOrder == nil then {} else state.cityOrder
	for _, cityId in ipairs(order) do
		local city = state.cities[cityId]
		if city == nil then
			continue
		end
		local elig = {}
		for _, kind in ipairs(DISASTER_ORDER) do
			if eligible(state, city, kind, ruleset) then
				table.insert(elig, kind)
			end
		end
		if #elig == 0 then
			continue
		end
		local roll = rng.rollRange(state.rngState, 100)
		state.rngState = roll.rngState
		if roll.value >= d.baseChancePct then
			continue
		end
		local pick = rng.rollRange(state.rngState, #elig)
		state.rngState = pick.rngState
		strike(state, city, elig[pick.value + 1], ruleset, events)
	end
end

return {
	process = process,
}
