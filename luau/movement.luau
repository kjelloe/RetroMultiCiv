--!strict
-- Luau twin of engine/movement.js (phase 5, P5-3 batch 1): 8-directional
-- movement, terrain costs, the Civ 1 partial-move rule, road/rail free
-- steps, zone of control, attack-by-moving (delegated to combat — batch 2
-- stub for now). Stored coordinates and index VALUES stay 0-based
-- (docs/09 trap 1); only table access adds the +1.
-- EXPORTS (stable): moveUnit, fortify, wait, disband, tileAt, wrapX, DIRS.

local statehash = require("./statehash")
local visibility = require("./visibility")
local combat = require("./combat")
local huts = require("./huts") -- N13: goody-hut roll on move-into-hut

local DIRS: { [string]: { dx: number, dy: number } } = {
	N = { dx = 0, dy = -1 }, NE = { dx = 1, dy = -1 }, E = { dx = 1, dy = 0 },
	SE = { dx = 1, dy = 1 }, S = { dx = 0, dy = 1 }, SW = { dx = -1, dy = 1 },
	W = { dx = -1, dy = 0 }, NW = { dx = -1, dy = -1 },
}

local function tileAt(map: any, x: number, y: number): any
	return map.tiles[y * map.width + x + 1]
end

local function wrapX(map: any, x: number): number
	if not map.wrapX then
		return x
	end
	return ((x % map.width) + map.width) % map.width
end

-- Is any enemy unit OR CITY adjacent to (x, y)? Order-independent boolean, so
-- plain iteration is fine (docs/09 §7). B18: enemy CITIES exert ZOC too (twin
-- of engine/movement.js — the wiki's "adjacent to an enemy unit OR CITY").
local function inEnemyZoc(state: any, x: number, y: number, owner: string): boolean
	for _, u in pairs(state.units) do
		if u.owner ~= owner and u.aboard == nil then -- A69: cargo exerts no ZOC
			local dx = math.abs(u.x - x)
			if state.map.wrapX and state.map.width - dx < dx then
				dx = state.map.width - dx
			end
			local dy = math.abs(u.y - y)
			if dx <= 1 and dy <= 1 and (dx + dy) > 0 then
				return true
			end
		end
	end
	for _, c in pairs(state.cities) do
		if c.owner ~= owner then
			local dx = math.abs(c.x - x)
			if state.map.wrapX and state.map.width - dx < dx then
				dx = state.map.width - dx
			end
			local dy = math.abs(c.y - y)
			if dx <= 1 and dy <= 1 and (dx + dy) > 0 then
				return true
			end
		end
	end
	return false
end

-- A69: the friendly transport at (x, y) with a free cargo slot -- deterministic
-- (first by sorted id). Returns the ship, "full" if transports exist but all are
-- laden, or nil if no transport is here at all. Twin of engine/movement.js.
local function pickTransport(state: any, x: number, y: number, owner: string, ruleset: any): any
	local anyTransport = false
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local s = state.units[id]
		if s.owner == owner and s.x == x and s.y == y and s.aboard == nil then
			local cap = ruleset.units[s.type].transport
			if cap ~= nil and cap > 0 then
				anyTransport = true
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
	return if anyTransport then "full" else nil
end

-- Mutates `state` (the dispatcher hands a fresh clone). Returns
-- { ok, reason?, events }.
local function moveUnit(state: any, cmd: any, ruleset: any): any
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
	local dir = DIRS[cmd.dir]
	if dir == nil then
		return { ok = false, reason = "badDirection" }
	end
	-- NOTE: the moves check happens after the cost is known — free road/rail
	-- steps are legal at 0 moves; attacks and paid steps are not

	local map = state.map
	local nx = wrapX(map, unit.x + dir.dx)
	local ny = unit.y + dir.dy
	if nx < 0 or nx >= map.width or ny < 0 or ny >= map.height then
		return { ok = false, reason = "outOfBounds" }
	end

	-- enemy units on the target tile: this move is an attack, not a move
	local hostile = false
	for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
		if u.owner ~= unit.owner then
			hostile = true
			break
		end
	end
	if hostile then
		-- A69: Civ 1 has no Marines -- a unit cannot attack straight off a ship;
		-- unload to open land first, then attack next turn.
		if unit.aboard ~= nil then
			return { ok = false, reason = "noAmphibiousAssault" }
		end
		return combat.resolveAttack(state, unit, nx, ny, ruleset) -- rejects at 0 moves
	end

	local terrain = ruleset.terrain.terrains[tileAt(map, nx, ny).t]
	local unitType = ruleset.units[unit.type]
	if terrain == nil or unitType == nil then
		return { ok = false, reason = "badRuleset" }
	end
	-- A72: air units (domain 'air') fly over ANY tile; non-air keep the rule.
	if terrain.domain ~= unitType.domain and unitType.domain ~= "air" then
		-- A69: a land unit stepping onto a sea tile LOADS onto a friendly transport
		-- there (with a free slot); otherwise the sea stays impassable to it.
		if unitType.domain == "land" and terrain.domain == "sea" then
			local ship = pickTransport(state, nx, ny, unit.owner, ruleset)
			if ship == "full" then
				return { ok = false, reason = "transportFull" }
			end
			if ship ~= nil then
				if unit.moves <= 0 then
					return { ok = false, reason = "noMovesLeft" }
				end
				unit.aboard = ship.id
				unit.x = nx
				unit.y = ny
				unit.fortified = false
				unit.working = nil
				unit.workLeft = nil
				unit.moves = unit.moves - 1
				if unit.moves < 0 then
					unit.moves = 0
				end
				visibility.reveal(state, unit.owner, nx, ny, 1)
				local ev = setmetatable({}, statehash.ARRAY_MT)
				table.insert(ev, { type = "unitLoaded", unitId = unit.id, owner = unit.owner, shipId = ship.id, x = nx, y = ny })
				return { ok = true, events = ev }
			end
		end
		return { ok = false, reason = "impassable" }
	end

	local targetCity = combat.cityAt(state, nx, ny)
	local ownAtTarget = #combat.unitsAt(state, nx, ny) > 0
		or (targetCity ~= nil and targetCity.owner == unit.owner)
	-- B18: Diplomats, Caravans, and nuclear weapons ignore ZOC (units.json
	-- ignoresZoc) — they walk between enemy-controlled tiles freely.
	-- B27: entering ANY city square is ZOC-exempt (targetCity == nil to reject) —
	-- an undefended enemy city must be capturable-by-moving even in ZOC. Civ2
	-- provenance (user ruling 2026-07-17). Matches engine/movement.js.
	if not ownAtTarget and targetCity == nil and unitType.ignoresZoc ~= true
		and inEnemyZoc(state, unit.x, unit.y, unit.owner)
		and inEnemyZoc(state, nx, ny, unit.owner) then
		return { ok = false, reason = "zoc" }
	end

	local fromX, fromY = unit.x, unit.y
	-- rail-to-rail is free; road-to-road grants moves*2 FREE steps per turn
	-- (unit.roadSteps, transient integer, cleared at the turn wrap)
	local cost = terrain.move
	if unitType.domain == "air" then
		cost = 1 -- A72: air units spend 1 movement per tile, terrain-blind
	else
		local from = tileAt(map, fromX, fromY)
		local to = tileAt(map, nx, ny)
		if from.railroad == true and to.railroad == true then
			cost = 0
		elseif from.road == true and to.road == true then
			local used = if unit.roadSteps == nil then 0 else unit.roadSteps
			if used < ruleset.units[unit.type].moves * 2 then
				cost = 0
				unit.roadSteps = used + 1
			else
				cost = 1
			end
		end
	end
	if cost > 0 and unit.moves <= 0 then
		return { ok = false, reason = "noMovesLeft" }
	end
	unit.x = nx
	unit.y = ny
	unit.fortified = false
	unit.working = nil -- moving abandons any improvement in progress
	unit.workLeft = nil
	unit.moves = unit.moves - cost
	if unit.moves < 0 then
		unit.moves = 0
	end
	-- B23: the mover may record a heading (omit-safe unit.scoutDir) -- a generic
	-- reducer field the caller gives meaning to (the wallfollow scout persists its
	-- hand-rule facing; a plain move without a heading clears it).
	if cmd.heading ~= nil then
		unit.scoutDir = cmd.heading
	elseif unit.scoutDir ~= nil then
		unit.scoutDir = nil
	end
	visibility.reveal(state, unit.owner, nx, ny, 1)

	local events = setmetatable({}, statehash.ARRAY_MT)
	table.insert(events, { type = "unitMoved", unitId = unit.id, fromX = fromX, fromY = fromY, toX = nx, toY = ny })
	-- A69: a unit that was aboard and has stepped onto land has disembarked
	if unit.aboard ~= nil then
		unit.aboard = nil
		table.insert(events, { type = "unitUnloaded", unitId = unit.id, owner = unit.owner, x = nx, y = ny })
	end
	-- A69: a ship that moved drags its cargo along (x/y tracks the ship)
	for _, v in pairs(state.units) do
		if v.aboard == unit.id then
			v.x = nx
			v.y = ny
		end
	end
	if targetCity ~= nil and targetCity.owner ~= unit.owner then
		combat.captureCity(state, unit, targetCity, events, ruleset)
	end
	-- N13: a village on the destination tile. A GROUND non-barbarian unit rolls;
	-- an AIR unit (or barbarian, defensively) is a NULLIFIER (removed, no reward).
	local landed = tileAt(map, nx, ny)
	if landed.hut == true then
		if unitType.domain == "air" or unit.owner == "barb" then
			landed.hut = nil
			table.insert(events, { type = "hutEntered", playerId = unit.owner, x = nx, y = ny, result = "nothing" })
		else
			huts.rollHut(state, unit, ruleset, events)
		end
	end
	return { ok = true, events = events }
end

local function disband(state: any, cmd: any, _ruleset: any): any
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
	state.units[cmd.unitId] = nil
	return { ok = true, events = { { type = "unitDisbanded", unitId = cmd.unitId, x = unit.x, y = unit.y } } }
end

local function wait(state: any, cmd: any, _ruleset: any): any
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
	unit.moves = 0
	return { ok = true, events = { { type = "unitWaited", unitId = unit.id } } }
end

local function fortify(state: any, cmd: any, _ruleset: any): any
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
	if unit.fortified then
		return { ok = false, reason = "alreadyFortified" }
	end
	unit.fortified = true
	unit.working = nil -- fortifying abandons any improvement in progress
	unit.workLeft = nil
	unit.moves = 0
	return { ok = true, events = { { type = "unitFortified", unitId = unit.id } } }
end

return {
	moveUnit = moveUnit,
	fortify = fortify,
	wait = wait,
	disband = disband,
	tileAt = tileAt,
	wrapX = wrapX,
	DIRS = DIRS,
}
