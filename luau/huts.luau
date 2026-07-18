--!strict
-- Luau twin of engine/huts.js (N13 / A4 goody huts). A GROUND unit entering a
-- tile.hut fires ONE eligibility-gated weighted roll over [advancedTribe, advance,
-- gold, mercs, ambush] (weights rules.hut.weights); the village then leaves the
-- map. Air/barbarian entry is a nullifier handled by the caller (movement.luau).
local rng = require("./rng")
local cities = require("./cities")
local tech = require("./tech")
local barbarians = require("./barbarians")
local combat = require("./combat")

local BARB_ID = barbarians.BARB_ID
-- 8 neighbours in a FIXED row-major order (the "sorted neighbor order").
local N8 = { { -1, -1 }, { 0, -1 }, { 1, -1 }, { -1, 0 }, { 1, 0 }, { -1, 1 }, { 0, 1 }, { 1, 1 } }

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

local function isLand(state: any, ruleset: any, x: number, y: number): boolean
	return ruleset.terrain.terrains[state.map.tiles[y * state.map.width + x + 1].t].domain == "land"
end

local function closestCity(state: any, x: number, y: number): any
	local best = nil
	local bestDist = 999999
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil then
			local d = chebyshev(state.map, x, y, c.x, c.y)
			if d < bestDist or (d == bestDist and (best == nil or cid < best.id)) then
				best = c
				bestDist = d
			end
		end
	end
	return best
end

local function ambushEligible(state: any, playerId: string, x: number, y: number, ruleset: any): boolean
	local hasCity = false
	for _, cid in ipairs(state.cityOrder or {}) do
		if state.cities[cid] ~= nil and state.cities[cid].owner == playerId then
			hasCity = true
			break
		end
	end
	if not hasCity then return false end
	local r = ruleset.rules.hut.ambushCityRadius
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and chebyshev(state.map, x, y, c.x, c.y) <= r then return false end
	end
	return true
end

local function spawnMerc(state: any, playerId: string, x: number, y: number, ruleset: any)
	local coin = rng.rollRange(state.rngState, 2)
	state.rngState = coin.rngState
	local ttype = if coin.value == 0 then "cavalry" else "legion"
	local unitId = "u" .. state.nextUnitId
	state.nextUnitId += 1
	local unit = {
		id = unitId, type = ttype, owner = playerId, x = x, y = y,
		moves = ruleset.units[ttype].moves, fortified = false, veteran = false,
	}
	local home = closestCity(state, x, y)
	if home ~= nil and home.owner == playerId then unit.home = home.id end
	state.units[unitId] = unit
end

local function spawnAmbush(state: any, x: number, y: number, ruleset: any)
	barbarians.ensureBarbPlayer(state)
	local ttype = barbarians.barbTier(state, ruleset)
	local map = state.map
	local cap = ruleset.rules.hut.ambushCount
	local placed = 0
	for _, d in ipairs(N8) do
		if placed >= cap then break end
		local ny = y + d[2]
		local skip = ny < 0 or ny >= map.height
		local nx = x + d[1]
		if not skip then
			if map.wrapX then
				nx = wrapX(map, nx)
			elseif nx < 0 or nx >= map.width then
				skip = true
			end
		end
		if not skip and isLand(state, ruleset, nx, ny)
			and #combat.unitsAt(state, nx, ny) == 0 and combat.cityAt(state, nx, ny) == nil then
			local unitId = "u" .. state.nextUnitId
			state.nextUnitId += 1
			state.units[unitId] = {
				id = unitId, type = ttype, owner = BARB_ID, x = nx, y = ny,
				moves = ruleset.units[ttype].moves, fortified = false, veteran = false,
			}
			placed += 1
		end
	end
end

local function rollHut(state: any, unit: any, ruleset: any, events: any)
	local x, y = unit.x, unit.y
	local playerId = unit.owner
	local hut = ruleset.rules.hut
	local w = hut.weights

	local outcomes = {}
	if cities.foundCityLegality(state, x, y, ruleset) == nil then
		table.insert(outcomes, { "advancedTribe", w.advancedTribe })
	end
	if state.turn > 1 and state.year <= 1000 and #tech.availableTechs(state, playerId, ruleset) > 0 then
		table.insert(outcomes, { "advance", w.advance })
	end
	table.insert(outcomes, { "gold", w.gold })
	table.insert(outcomes, { "mercs", w.mercs })
	if ambushEligible(state, playerId, x, y, ruleset) then
		table.insert(outcomes, { "ambush", w.ambush })
	end

	local result = "nothing"
	local total = 0
	for _, o in ipairs(outcomes) do total += o[2] end
	if total > 0 then
		local roll = rng.rollRange(state.rngState, total)
		state.rngState = roll.rngState
		local acc = 0
		for _, o in ipairs(outcomes) do
			acc += o[2]
			if roll.value < acc then
				result = o[1]
				break
			end
		end
	end

	if result == "advancedTribe" then
		cities.createCityAt(state, playerId, x, y, ruleset, events)
	elseif result == "advance" then
		local avail = tech.availableTechs(state, playerId, ruleset)
		local pick = rng.rollRange(state.rngState, #avail)
		state.rngState = pick.rngState
		tech.grantTech(state, playerId, avail[pick.value + 1], ruleset, events)
	elseif result == "gold" then
		state.players[playerId].gold = state.players[playerId].gold + hut.gold
	elseif result == "mercs" then
		spawnMerc(state, playerId, x, y, ruleset)
	elseif result == "ambush" then
		spawnAmbush(state, x, y, ruleset)
	end

	state.map.tiles[y * state.map.width + x + 1].hut = nil
	table.insert(events, { type = "hutEntered", playerId = playerId, x = x, y = y, result = result })
end

return {
	rollHut = rollHut,
}
