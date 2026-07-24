--!strict
-- Luau twin of engine/visibility.js (phase 5, P5-3 batch 1). Fog of war:
-- explored persists in state as per-player 0/1 arrays (STORED VALUES stay
-- byte-identical — docs/09 trap 1: 0-based tile INDEX VALUES, 1-based table
-- ITERATION); visibility is recomputed on demand. filterView is THE
-- per-player view; filterEvents is the fog policy for round events.
-- EXPORTS (stable): initExplored(state), reveal(state, playerId, x, y, r),
-- computeVisible(state, playerId), filterView(state, playerId),
-- filterEvents(state, events, playerId).

local statehash = require("./statehash")

local function initExplored(state: any)
	local size = state.map.width * state.map.height
	for _, pid in ipairs(state.playerOrder) do
		local arr = setmetatable({}, statehash.ARRAY_MT)
		for i = 1, size do
			arr[i] = 0
		end
		state.players[pid].explored = arr
	end
end

local function reveal(state: any, playerId: string, x: number, y: number, radius: number)
	local player = state.players[playerId]
	if player == nil or player.explored == nil then
		return
	end
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	for dy = -radius, radius do
		local yy = y + dy
		if yy >= 0 and yy < height then
			for dx = -radius, radius do
				local xx = x + dx
				if xx < 0 or xx >= width then
					if wrapX then
						xx = ((xx % width) + width) % width
						player.explored[yy * width + xx + 1] = 1
					end
				else
					player.explored[yy * width + xx + 1] = 1
				end
			end
		end
	end
end

local function markCircle(mask: { number }, map: any, x: number, y: number, radius: number)
	local width, height, wrapX = map.width, map.height, map.wrapX
	for dy = -radius, radius do
		local yy = y + dy
		if yy >= 0 and yy < height then
			for dx = -radius, radius do
				local xx = x + dx
				if xx < 0 or xx >= width then
					if wrapX then
						xx = ((xx % width) + width) % width
						mask[yy * width + xx + 1] = 1
					end
				else
					mask[yy * width + xx + 1] = 1
				end
			end
		end
	end
end

-- naval-truth (Bundle 2): a unit's sight radius (units.json sight; default 1, 2 for the
-- A71 set). ruleset optional -> radius-1 default. Matches engine/visibility.js.
local function unitSight(unit: any, ruleset: any): number
	if ruleset == nil then
		return 1
	end
	local s = ruleset.units[unit.type].sight
	return if s == nil then 1 else s
end

local function computeVisible(state: any, playerId: string, ruleset: any): { number }
	local size = state.map.width * state.map.height
	local mask = {}
	for i = 1, size do
		mask[i] = 0
	end
	for _, u in pairs(state.units) do
		if u.owner == playerId then
			markCircle(mask, state.map, u.x, u.y, unitSight(u, ruleset))
		end
	end
	for _, c in pairs(state.cities) do
		if c.owner == playerId then
			markCircle(mask, state.map, c.x, c.y, 2)
		end
	end
	return mask
end

-- sorted key iteration wherever JS used bare Object.keys (docs/09 §7 port
-- rule: harmless for order-insensitive writes, and removes all doubt)
local function sortedKeys(t: any): { string }
	local keys = {}
	for k in pairs(t) do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

-- naval-truth: is `sub` within range 1 of a SEA or AIR unit owned by viewerId? Land units
-- never spot a submarine. Wrap-aware chebyshev. Matches engine/visibility.js.
local function spottedByShipOrAir(state: any, viewerId: string, sub: any, ruleset: any): boolean
	local width, wrapX = state.map.width, state.map.wrapX
	for _, v in pairs(state.units) do
		if v.owner ~= viewerId then
			continue
		end
		local dom = ruleset.units[v.type].domain
		if dom ~= "sea" and dom ~= "air" then
			continue
		end
		local dx = v.x - sub.x
		if dx < 0 then dx = -dx end
		if wrapX and dx > width - dx then dx = width - dx end
		local dy = v.y - sub.y
		if dy < 0 then dy = -dy end
		if dx <= 1 and dy <= 1 then
			return true
		end
	end
	return false
end

local function filterView(state: any, playerId: string, ruleset: any): any
	local me = state.players[playerId]
	local omniscient = me == nil or me.explored == nil
	local visible = computeVisible(state, playerId, ruleset)
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX

	local tiles = setmetatable({}, statehash.ARRAY_MT)
	for i = 1, width * height do
		local explored = omniscient or me.explored[i] == 1
		if not explored then
			tiles[i] = { t = "unknown" }
		else
			local src = state.map.tiles[i]
			local tile: any = { t = src.t, visible = omniscient or visible[i] == 1 }
			if src.river then tile.river = true end
			if src.special then tile.special = true end
			if src.irrigation then tile.irrigation = true end
			if src.mine then tile.mine = true end
			if src.road then tile.road = true end
			if src.railroad then tile.railroad = true end
			if src.fortress then tile.fortress = true end
			tiles[i] = tile
		end
	end

	local units = {}
	for _, id in sortedKeys(state.units) do
		local u = state.units[id]
		if not (omniscient or visible[u.y * width + u.x + 1] == 1) then
			continue
		end
		-- naval-truth: a rival submarine (stealth) is hidden unless a viewer ship/plane is adjacent
		if not omniscient and u.owner ~= playerId and ruleset ~= nil
			and ruleset.units[u.type].stealth == true and not spottedByShipOrAir(state, playerId, u, ruleset) then
			continue
		end
		units[id] = u
	end

	-- Own cities come through whole; a rival city on explored ground is only
	-- its outside: name, owner, size, and visible structures (walls).
	local cities = {}
	for _, id in sortedKeys(state.cities) do
		local c = state.cities[id]
		local known = omniscient or me.explored[c.y * width + c.x + 1] == 1
		if known then
			if omniscient or c.owner == playerId then
				cities[id] = c
			else
				local shell: any = {
					id = c.id, name = c.name, owner = c.owner, x = c.x, y = c.y,
					pop = c.pop, buildings = setmetatable({}, statehash.ARRAY_MT),
				}
				if c.buildings ~= nil and table.find(c.buildings, "city-walls") ~= nil then
					table.insert(shell.buildings, "city-walls")
				end
				cities[id] = shell
			end
		end
	end

	local players = {}
	for _, pid in sortedKeys(state.players) do
		local p = state.players[pid]
		players[pid] = { id = p.id, name = p.name, color = p.color, human = p.human }
		-- stance-mix v1: a civ AI stance is public (R21 Statistics panel) — passed
		-- through for ALL players. Views are never hashed = golden-neutral. Matches engine/visibility.js.
		if p.stance ~= nil then players[pid].stance = p.stance end
		if pid == playerId then
			players[pid].gold = p.gold
			players[pid].techs = p.techs
			players[pid].researching = p.researching
			if p.bulbs ~= nil then players[pid].bulbs = p.bulbs end
			if p.taxRate ~= nil then players[pid].taxRate = p.taxRate end
			if p.sciRate ~= nil then players[pid].sciRate = p.sciRate end
			if p.luxRate ~= nil then players[pid].luxRate = p.luxRate end
			if p.government ~= nil then players[pid].government = p.government end
			if p.revolutionTurns ~= nil then players[pid].revolutionTurns = p.revolutionTurns end
			if p.pendingGovernment ~= nil then players[pid].pendingGovernment = p.pendingGovernment end
		end
	end
	if me ~= nil and me.explored ~= nil then
		players[playerId].explored = me.explored
	end

	local cityOrder = setmetatable({}, statehash.ARRAY_MT)
	for _, cid in ipairs(state.cityOrder or {}) do
		if cities[cid] ~= nil then
			table.insert(cityOrder, cid)
		end
	end

	local view = {
		you = playerId,
		turn = state.turn,
		year = state.year,
		activePlayer = state.activePlayer,
		playerOrder = state.playerOrder,
		map = { width = width, height = height, wrapX = wrapX, tiles = tiles },
		units = units,
		cities = cities,
		cityOrder = cityOrder,
		wonders = if state.wonders == nil then {} else state.wonders,
		players = players,
		-- D3: diplomacy relations are global/non-secret in Civ 1; passed whole
		-- (embassy-gated fog is D6's business)
		relations = if state.relations == nil then {} else state.relations,
	}
	-- D3 (#2591/#2592): at gameOver the result is world-public — surface gameOver +
	-- winner in every seat view (twin of engine/visibility.js). Keys added only when
	-- defined (no-null rule); view-only, never on the hash path.
	if state.gameOver == true then
		view.gameOver = true
		if state.winner ~= nil then view.winner = state.winner end
	end
	return view
end

-- Fog policy for round EVENTS (B5 twin) — classes pinned @9edac2e9:
-- world news to everyone, techDiscovered own-only, everything else by
-- visible-coordinate OR named-party; no-explored viewers hear everything.
-- D3: war/peace/treaty-break are Civ 1-authentic PUBLIC broadcasts; FIRST_CONTACT
-- is NOT here -- a third party learning two strangers met is fog-dishonest, so it
-- is party-scoped in filterEvents below.
local WORLD_NEWS: { [string]: boolean } =
	{
		wonderBuilt = true, wonderLost = true, gameOver = true, playerDefeated = true,
		WAR_DECLARED = true, TREATY_BROKEN = true, PEACE_TREATY_SIGNED = true,
	}

-- the viewer's civ id, resolved as diplomacy eventCiv builds the event's civ
-- fields (civ -> name -> pid) so FIRST_CONTACT party-matching lines up
local function playerCiv(state: any, pid: string): string
	local p = state.players[pid]
	if p == nil then return pid end
	if p.civ ~= nil then return p.civ end
	if p.name ~= nil then return p.name end
	return pid
end

local function eventParties(e: any): { string }
	local out = {}
	if e.playerId ~= nil then table.insert(out, e.playerId) end
	if e.owner ~= nil then table.insert(out, e.owner) end
	if e.attackerOwner ~= nil then table.insert(out, e.attackerOwner) end
	if e.defenderOwner ~= nil then table.insert(out, e.defenderOwner) end
	if e.type == "cityCaptured" then
		table.insert(out, e.from)
		table.insert(out, e.to)
	end
	return out
end

local function eventCoords(state: any, e: any): { { number } }
	local out = {}
	if e.x ~= nil and e.y ~= nil then table.insert(out, { e.x, e.y }) end
	if e.fromX ~= nil then table.insert(out, { e.fromX, e.fromY }) end
	if e.toX ~= nil then table.insert(out, { e.toX, e.toY }) end
	if e.unitId ~= nil and state.units[e.unitId] ~= nil then
		table.insert(out, { state.units[e.unitId].x, state.units[e.unitId].y })
	end
	if e.cityId ~= nil and state.cities[e.cityId] ~= nil then
		table.insert(out, { state.cities[e.cityId].x, state.cities[e.cityId].y })
	end
	return out
end

local function filterEvents(state: any, events: { any }, playerId: string, ruleset: any): { any }
	local me = state.players[playerId]
	if me == nil or me.explored == nil then
		return table.clone(events)
	end
	local visible = computeVisible(state, playerId, ruleset)
	local width = state.map.width
	local out = setmetatable({}, statehash.ARRAY_MT)
	for _, e in ipairs(events) do
		local keep = false
		if WORLD_NEWS[e.type] == true then
			keep = true
		elseif e.type == "techDiscovered" then
			keep = e.playerId == playerId
		elseif e.type == "FIRST_CONTACT" then
			-- party-only: only the two civs that just met hear it (fog-honest)
			local myCiv = playerCiv(state, playerId)
			keep = myCiv == e.aCivId or myCiv == e.bCivId
		else
			for _, pid in ipairs(eventParties(e)) do
				if pid == playerId then
					keep = true
					break
				end
			end
			if not keep then
				for _, c in ipairs(eventCoords(state, e)) do
					if visible[c[2] * width + c[1] + 1] == 1 then
						keep = true
						break
					end
				end
			end
		end
		if keep then
			table.insert(out, e)
		end
	end
	return out
end

return {
	initExplored = initExplored,
	reveal = reveal,
	computeVisible = computeVisible,
	unitSight = unitSight,
	filterView = filterView,
	filterEvents = filterEvents,
}
