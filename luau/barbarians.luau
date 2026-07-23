--!strict
-- Luau twin of engine/barbarians.js (phase 5, P5-7): the ownerless menace,
-- processed once per game turn at the wrap. RNG discipline: no roll before
-- FIRST_TURN; spawn check every EVERY turns consumes ONE roll (plus up to
-- 20 two-roll placement attempts); pathless wanderers roll one direction.
-- EXPORTS (stable): process(state, ruleset, events), BARB_ID, FIRST_TURN.

local rng = require("./rng")
local cow = require("./cow")
local statehash = require("./statehash")
local combat = require("./combat")

local BARB_ID = "barb"
local FIRST_TURN = 16 -- no barbarians before this game turn
local EVERY = 4 -- spawn check every N turns
local SPAWN_CHANCE = 3 -- 1-in-N on each check
local HUNT_RADIUS = 8

-- A66/B13 twin: barbarians era-scale — the spawn unit is the highest
-- rules.barbTiers entry whose trigger tech is known by >= barbTierThreshold%
-- of the ALIVE non-barb civs. Non-roster-owner safe. Matches engine/barbarians.js.
local function barbTier(state: any, ruleset: any): string
	local tiers = ruleset.rules.barbTiers
	local alive = 0
	for _, pid in ipairs(state.playerOrder) do
		if pid ~= BARB_ID then
			local p = state.players[pid]
			if p ~= nil and p.alive ~= false then
				alive += 1
			end
		end
	end
	local unit = tiers[1].unit
	for i = 2, #tiers do
		local know = 0
		for _, pid in ipairs(state.playerOrder) do
			if pid ~= BARB_ID then
				local p = state.players[pid]
				if p ~= nil and p.alive ~= false and table.find(p.techs, tiers[i].tech) ~= nil then
					know += 1
				end
			end
		end
		if alive > 0 and know * 100 >= alive * ruleset.rules.barbTierThreshold then
			unit = tiers[i].unit
		end
	end
	return unit
end

local function ensureBarbPlayer(state: any)
	if state.players[BARB_ID] == nil then
		state.players[BARB_ID] = {
			id = BARB_ID, name = "Barbarians", color = "#c03030",
			human = false, gold = 0,
			techs = setmetatable({}, statehash.ARRAY_MT), researching = "",
		}
	end
end

local function wrapDx(map: any, a: number, b: number): number
	local dx = b - a
	if map.wrapX then
		if dx > math.floor(map.width / 2) then
			dx -= map.width
		end
		if dx < -math.floor(map.width / 2) then
			dx += map.width
		end
	end
	return dx
end

local function chebyshev(map: any, ax: number, ay: number, bx: number, by: number): number
	local dx = math.abs(wrapDx(map, ax, bx))
	local dy = math.abs(ay - by)
	return if dx > dy then dx else dy
end

local function trySpawn(state: any, ruleset: any, events: any)
	local spawnRoll = rng.rollRange(state.rngState, SPAWN_CHANCE)
	state.rngState = spawnRoll.rngState
	if spawnRoll.value ~= 0 then
		return
	end

	local width, height, tiles = state.map.width, state.map.height, state.map.tiles
	for _ = 1, 20 do
		local roll = rng.rollRange(state.rngState, width)
		state.rngState = roll.rngState
		local x = roll.value
		roll = rng.rollRange(state.rngState, height - 4)
		state.rngState = roll.rngState
		local y = 2 + roll.value

		local ok = true
		local terrain = ruleset.terrain.terrains[tiles[y * width + x + 1].t]
		if terrain.domain ~= "land" then
			ok = false
		end
		if ok and (#combat.unitsAt(state, x, y) > 0 or combat.cityAt(state, x, y) ~= nil) then
			ok = false
		end
		if ok then
			for _, cid in ipairs(state.cityOrder or {}) do
				local c = state.cities[cid]
				if c ~= nil and chebyshev(state.map, x, y, c.x, c.y) < 4 then
					ok = false
					break
				end
			end
		end
		if ok then
			ensureBarbPlayer(state)
			local barbUnit = barbTier(state, ruleset)
			local unitId = "u" .. state.nextUnitId
			state.nextUnitId += 1
			state.units[unitId] = {
				id = unitId, type = barbUnit, owner = BARB_ID,
				x = x, y = y, moves = ruleset.units[barbUnit].moves,
				fortified = false, veteran = false,
			}
			table.insert(events, { type = "barbariansSpawned", unitId = unitId, x = x, y = y })
			-- N13: 1-in-rules.barb.leaderChance inland spawns bring a barbarian
			-- LEADER stacked ON the escort's tile ("under escort").
			local leaderRoll = rng.rollRange(state.rngState, ruleset.rules.barb.leaderChance)
			state.rngState = leaderRoll.rngState
			if leaderRoll.value == 0 then
				local lid = "u" .. state.nextUnitId
				state.nextUnitId += 1
				state.units[lid] = {
					id = lid, type = "barbleader", owner = BARB_ID,
					x = x, y = y, moves = ruleset.units.barbleader.moves,
					fortified = false, veteran = false,
				}
			end
			return
		end
	end
end

local function nearestTarget(state: any, unit: any): any
	local best = nil
	local bestDist = HUNT_RADIUS + 1
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local u = state.units[id]
		if u.owner ~= BARB_ID then
			local d = chebyshev(state.map, unit.x, unit.y, u.x, u.y)
			if d < bestDist then
				best = { x = u.x, y = u.y }
				bestDist = d
			end
		end
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner ~= BARB_ID then
			local d = chebyshev(state.map, unit.x, unit.y, c.x, c.y)
			if d < bestDist then
				best = { x = c.x, y = c.y }
				bestDist = d
			end
		end
	end
	return best
end

local function sign(n: number): number
	return if n > 0 then 1 elseif n < 0 then -1 else 0
end

-- 1-based constant; DIRS[roll.value + 1] translates the JS 0-based pick
local DIRS = { { 0, -1 }, { 1, -1 }, { 1, 0 }, { 1, 1 }, { 0, 1 }, { -1, 1 }, { -1, 0 }, { -1, -1 } }

local function act(state: any, unit: any, ruleset: any, events: any)
	local target = nearestTarget(state, unit)
	local dx, dy
	if target ~= nil then
		dx = sign(wrapDx(state.map, unit.x, target.x))
		dy = sign(target.y - unit.y)
	else
		local roll = rng.rollRange(state.rngState, 8)
		state.rngState = roll.rngState
		dx = DIRS[roll.value + 1][1]
		dy = DIRS[roll.value + 1][2]
	end
	if dx == 0 and dy == 0 then
		return
	end

	local width, height = state.map.width, state.map.height
	local nx = unit.x + dx
	if state.map.wrapX then
		nx = ((nx % width) + width) % width
	end
	local ny = unit.y + dy
	if nx < 0 or nx >= width or ny < 1 or ny >= height - 1 then
		return
	end

	local hostile = false
	for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
		if u.owner ~= BARB_ID then
			hostile = true
			break
		end
	end
	if hostile then
		unit.moves = 1 -- wrap processing runs after players spent their moves
		combat.resolveAttack(state, unit, nx, ny, ruleset)
		return
	end
	local terrain = ruleset.terrain.terrains[state.map.tiles[ny * width + nx + 1].t]
	if terrain.domain ~= "land" then
		return
	end

	unit.x = nx
	unit.y = ny
	-- N13: a barbarian entering a village is a nullifier — removed, no reward.
	local tile = state.map.tiles[ny * width + nx + 1]
	if tile.hut == true then
		cow.cowTile(state, ny * width + nx).hut = nil
		table.insert(events, { type = "hutEntered", playerId = BARB_ID, x = nx, y = ny, result = "nothing" })
	end
	local city = combat.cityAt(state, nx, ny)
	if city ~= nil and city.owner ~= BARB_ID then
		ensureBarbPlayer(state)
		combat.captureCity(state, unit, city, events, ruleset)
	end
end

-- Called once per game turn from endTurn's wrap.
-- barb-sea-raids: an ocean tile adjacent to (x, y), first-found in a fixed
-- neighbor order; nil when not coastal. Deterministic.
local SEA_NB = { {0, -1}, {1, -1}, {1, 0}, {1, 1}, {0, 1}, {-1, 1}, {-1, 0}, {-1, -1} }
local function oceanNeighbor(state: any, x: number, y: number, ruleset: any): any
	local width, height, tiles = state.map.width, state.map.height, state.map.tiles
	for _, d in ipairs(SEA_NB) do
		local nx = x + d[1]
		if nx < 0 or nx >= width then
			if not state.map.wrapX then
				continue
			end
			nx = ((nx % width) + width) % width
		end
		local ny = y + d[2]
		if ny < 0 or ny >= height then
			continue
		end
		if ruleset.terrain.terrains[tiles[ny * width + nx + 1].t].domain == "sea" then
			return { x = nx, y = ny }
		end
	end
	return nil
end

-- barb-sea-raids: for a target city, a beach to land on + the sea tile the
-- raiders cross. Landing = a free coastal LAND neighbor of the city; approach =
-- that beach's ocean neighbor. Deterministic; nil when no clear beach.
local function raidApproach(state: any, city: any, ruleset: any): any
	local width, height, tiles = state.map.width, state.map.height, state.map.tiles
	for _, d in ipairs(SEA_NB) do
		local nx = city.x + d[1]
		if nx < 0 or nx >= width then
			if not state.map.wrapX then
				continue
			end
			nx = ((nx % width) + width) % width
		end
		local ny = city.y + d[2]
		if ny < 1 or ny >= height - 1 then
			continue
		end
		if ruleset.terrain.terrains[tiles[ny * width + nx + 1].t].domain ~= "land" then
			continue
		end
		if #combat.unitsAt(state, nx, ny) > 0 or combat.cityAt(state, nx, ny) ~= nil then
			continue
		end
		local sea = oceanNeighbor(state, nx, ny, ruleset)
		if sea ~= nil then
			return { landX = nx, landY = ny, seaX = sea.x, seaY = sea.y }
		end
	end
	return nil
end

-- barb-sea-raids (Civ1 pirate landings): a SEPARATE rng sub-roll (runs after
-- trySpawn so the land-spawn stream is untouched). On a hit, pick a coastal
-- city + emit the T-1 sailsSpotted warning (visibility-gated by filterEvents on
-- the approach sea tile), scheduling the landing for next turn.
local function trySeaRaid(state: any, ruleset: any, events: any)
	local chance = ruleset.rules.barb.seaRaidChance
	if chance == nil then
		return
	end
	local roll = rng.rollRange(state.rngState, chance)
	state.rngState = roll.rngState
	if roll.value ~= 0 then
		return
	end
	local targets = {}
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner ~= BARB_ID then
			local ap = raidApproach(state, c, ruleset)
			if ap ~= nil then
				table.insert(targets, { cid = cid, ap = ap })
			end
		end
	end
	if #targets == 0 then
		return
	end
	local pick = rng.rollRange(state.rngState, #targets)
	state.rngState = pick.rngState
	local tgt = targets[pick.value + 1]
	table.insert(events, { type = "sailsSpotted", cityId = tgt.cid, x = tgt.ap.seaX, y = tgt.ap.seaY })
	ensureBarbPlayer(state)
	if state.pendingRaids == nil then
		state.pendingRaids = setmetatable({}, statehash.ARRAY_MT)
	end
	table.insert(state.pendingRaids, { x = tgt.ap.landX, y = tgt.ap.landY, turn = state.turn + 1 })
end

-- barb-sea-raids: land raids scheduled for THIS turn (raiders + maybe a leader
-- on the beach; act() then marches them to CAPTURE the city). A blocked beach
-- fizzles.
local function resolvePendingRaids(state: any, ruleset: any, events: any)
	if state.pendingRaids == nil then
		return
	end
	local keep = setmetatable({}, statehash.ARRAY_MT)
	for _, r in ipairs(state.pendingRaids) do
		if r.turn ~= state.turn then
			table.insert(keep, r)
		else
			local terrain = ruleset.terrain.terrains[state.map.tiles[r.y * state.map.width + r.x + 1].t]
			if terrain.domain == "land" and #combat.unitsAt(state, r.x, r.y) == 0 and combat.cityAt(state, r.x, r.y) == nil then
				ensureBarbPlayer(state)
				local barbUnit = barbTier(state, ruleset)
				local unitId = "u" .. state.nextUnitId
				state.nextUnitId += 1
				state.units[unitId] = {
					id = unitId, type = barbUnit, owner = BARB_ID,
					x = r.x, y = r.y, moves = ruleset.units[barbUnit].moves,
					fortified = false, veteran = false,
				}
				table.insert(events, { type = "barbariansLanded", unitId = unitId, x = r.x, y = r.y })
				local leaderRoll = rng.rollRange(state.rngState, ruleset.rules.barb.leaderChance)
				state.rngState = leaderRoll.rngState
				if leaderRoll.value == 0 then
					local leaderType = "barbleader"
					local lid = "u" .. state.nextUnitId
					state.nextUnitId += 1
					state.units[lid] = {
						id = lid, type = leaderType, owner = BARB_ID,
						x = r.x, y = r.y, moves = ruleset.units[leaderType].moves,
						fortified = false, veteran = false,
					}
				end
			end
		end
	end
	if #keep > 0 then
		state.pendingRaids = keep
	else
		state.pendingRaids = nil
	end
end

local function process(state: any, ruleset: any, events: any)
	if state.turn < FIRST_TURN then
		return
	end
	if state.turn % EVERY == 0 then
		trySpawn(state, ruleset, events)
	end
	resolvePendingRaids(state, ruleset, events)
	if state.turn % EVERY == 0 then
		trySeaRaid(state, ruleset, events)
	end
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in ipairs(combat.sortIds(keys)) do
		local unit = state.units[id]
		if unit ~= nil and unit.owner == BARB_ID then
			act(state, unit, ruleset, events)
		end
	end
end

return {
	process = process,
	BARB_ID = BARB_ID,
	FIRST_TURN = FIRST_TURN,
	barbTier = barbTier,
	ensureBarbPlayer = ensureBarbPlayer,
}
