--!strict
-- Luau twin of engine/improvements.js (phase 5, P5-4 batch 2): settlers
-- spend whole turns building roads/irrigation/mines/fortresses/railroads;
-- irrigate/mine TRANSFORM unsupported terrains; pillage strips one
-- improvement (field works before the road, as in Civ 1).
-- EXPORTS (stable): startWork, processWork, pillage, hasWaterSource,
-- workFlag.

local combat = require("./combat")
local cow = require("./cow")
local statehash = require("./statehash")

-- tile flag written by each kind of work
local function workFlag(work: string): string
	return if work == "irrigate" then "irrigation" else work
end

-- Civ 1: irrigation needs a water source — a river on the tile, or an
-- ocean/river/irrigated tile among the 8 neighbors.
local function hasWaterSource(state: any, x: number, y: number): boolean
	local map = state.map
	if map.tiles[y * map.width + x + 1].river == true then
		return true
	end
	for dy = -1, 1 do
		local yy = y + dy
		if yy >= 0 and yy < map.height then
			for dx = -1, 1 do
				if not (dx == 0 and dy == 0) then
					local xx = x + dx
					local inRange = true
					if xx < 0 or xx >= map.width then
						if not map.wrapX then
							inRange = false
						else
							xx = ((xx % map.width) + map.width) % map.width
						end
					end
					if inRange then
						local t = map.tiles[yy * map.width + xx + 1]
						if t.t == "ocean" or t.river == true or t.irrigation == true then
							return true
						end
					end
				end
			end
		end
	end
	return false
end

-- Command: a settler starts (or switches to) a job on its tile. Consumes
-- the turn; the work advances at every turn wrap. Moving cancels it.
local function startWork(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then
		return { ok = false, reason = "unknownUnit" }
	end
	if unit.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourUnit" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	if unit.type ~= "settlers" then
		return { ok = false, reason = "notSettlers" }
	end
	if unit.moves <= 0 then
		return { ok = false, reason = "noMovesLeft" }
	end
	local work = cmd.work
	if work ~= "road" and work ~= "irrigate" and work ~= "mine"
		and work ~= "fortress" and work ~= "railroad" and work ~= "clean" then
		return { ok = false, reason = "badWork" }
	end

	local tile = state.map.tiles[unit.y * state.map.width + unit.x + 1]
	local terrain = ruleset.terrain.terrains[tile.t]
	local techs = state.players[cmd.playerId].techs
	if terrain.domain ~= "land" then
		return { ok = false, reason = "badTerrain" }
	end
	-- A91 clean: the settler scrubs pollution off its tile (Civ 1) -- survives, repeatable.
	if work == "clean" and tile.polluted ~= true then
		return { ok = false, reason = "notPolluted" }
	end
	if tile[workFlag(work)] == true then
		return { ok = false, reason = "alreadyImproved" }
	end

	-- B19: Civ 1 river rules — roads over rivers need Bridge Building; rivers
	-- cannot be mined (the grassland mine->forest transform must not apply on
	-- a river tile). Twin of engine/improvements.js.
	if tile.river == true then
		if work == "road" and table.find(techs, ruleset.rules.bridgeTech) == nil then
			return { ok = false, reason = "techRequired" }
		end
		if work == "mine" then
			return { ok = false, reason = "badTerrain" }
		end
	end

	if work == "fortress" then
		if table.find(techs, ruleset.rules.fortressTech) == nil then
			return { ok = false, reason = "techRequired" }
		end
		for _, cid in ipairs(state.cityOrder or {}) do
			local c = state.cities[cid]
			if c ~= nil and c.x == unit.x and c.y == unit.y then
				return { ok = false, reason = "badTerrain" }
			end
		end
	elseif work == "railroad" then
		if table.find(techs, ruleset.rules.railroadTech) == nil then
			return { ok = false, reason = "techRequired" }
		end
		if tile.road ~= true then
			return { ok = false, reason = "badTerrain" } -- rails need a road first
		end
	elseif work ~= "road" and work ~= "clean" then
		local transform = terrain.transforms ~= nil and terrain.transforms[work] ~= nil
		if terrain[work] == nil and not transform then
			return { ok = false, reason = "badTerrain" }
		end
		if work == "irrigate" and not transform and not hasWaterSource(state, unit.x, unit.y) then
			return { ok = false, reason = "noWater" }
		end
	end

	unit.working = work
	unit.workLeft = ruleset.rules.workTurns[work]
	unit.moves = 0
	return { ok = true, events = { { type = "workStarted", unitId = unit.id, work = work, x = unit.x, y = unit.y } } }
end

-- Pillage: a land unit destroys one improvement on its tile — field works
-- fall before the road, as in Civ 1. Costs the turn.
local function pillage(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then
		return { ok = false, reason = "unknownUnit" }
	end
	if unit.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourUnit" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	if unit.moves <= 0 then
		return { ok = false, reason = "noMovesLeft" }
	end
	if ruleset.units[unit.type].domain ~= "land" then
		return { ok = false, reason = "badTerrain" }
	end
	local pidx = unit.y * state.map.width + unit.x
	local rtile = state.map.tiles[pidx + 1] -- read-only: decide before cow'ing
	local destroyed = ""
	if rtile.irrigation == true then
		destroyed = "irrigation"
	elseif rtile.mine == true then
		destroyed = "mine"
	elseif rtile.railroad == true then
		destroyed = "railroad"
	elseif rtile.road == true then
		destroyed = "road"
	else
		return { ok = false, reason = "nothingToPillage" }
	end
	cow.cowTile(state, pidx)[destroyed] = nil -- #2320: cow only when actually pillaging
	unit.moves = 0
	return {
		ok = true,
		events = { { type = "pillaged", unitId = unit.id, owner = unit.owner, destroyed = destroyed, x = unit.x, y = unit.y } },
	}
end

-- Runs once per game turn (turn wrap), before cities harvest, so a finished
-- improvement feeds the same turn's yields.
local function processWork(state: any, ruleset: any, events: any)
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local unit = state.units[id]
		if unit.working ~= nil then
			unit.workLeft = unit.workLeft - 1
			if unit.workLeft <= 0 then
				local work = unit.working
				local tile = cow.cowTile(state, unit.y * state.map.width + unit.x) -- #2320 completing tile-write
				local terrain = ruleset.terrain.terrains[tile.t]
				local event: any = { type = "improvementBuilt", unitId = unit.id, owner = unit.owner, work = work, x = unit.x, y = unit.y }
				if work == "clean" then
					-- A91 clean: pollution scrubbed off; the settler survives (order clears, unit stays).
					tile.polluted = nil
				else
					local transform = (work == "irrigate" or work == "mine")
						and terrain[work] == nil
						and terrain.transforms ~= nil and terrain.transforms[work] ~= nil
					if transform then
						tile.t = terrain.transforms[work] -- clear/drain/plant: the terrain changes
						tile.irrigation = nil
						tile.mine = nil
						event.transformedTo = tile.t
					else
						tile[workFlag(work)] = true
						-- Civ 1: irrigation and mine replace each other on a tile
						if work == "irrigate" then
							tile.mine = nil
						end
						if work == "mine" then
							tile.irrigation = nil
						end
					end
				end
				unit.working = nil
				unit.workLeft = nil
				table.insert(events, event)
			end
		end
	end
end

return {
	startWork = startWork,
	processWork = processWork,
	pillage = pillage,
	hasWaterSource = hasWaterSource,
	workFlag = workFlag,
}
