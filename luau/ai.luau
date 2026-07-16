--!strict
-- Luau twin of engine/ai.js (phase 5, P5-8 — the summit): the AI must THINK
-- identically, not just replay. No RNG anywhere; determinism comes from
-- sortIds walks, fixed scan orders, and strict-comparison selects (first-of-
-- tie wins, matching JS iteration order — the §7/§4-audit contract).
-- Sort-tie audit: zero raw sorts in this module; every Object.keys walk in
-- JS is either order-insensitive (booleans/counts) or rides sortIds — the
-- Luau twin uses sorted key iteration throughout per the docs/09 port rule.
-- EXPORTS (stable): runAiTurn(engine, state, playerId, ruleset, eventsOut),
-- pickCommand(state, playerId, ruleset, done), goodCitySpot.

local statehash = require("./statehash")
local tech = require("./tech")
local combat = require("./combat")
local cities = require("./cities")
local improvements = require("./improvements")
local happiness = require("./happiness")

local DIR_KEYS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local DIR_VECS: { [string]: { number } } = {
	N = { 0, -1 }, NE = { 1, -1 }, E = { 1, 0 }, SE = { 1, 1 },
	S = { 0, 1 }, SW = { -1, 1 }, W = { -1, 0 }, NW = { -1, -1 },
}

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

-- A40 slice 1 TWIN of engine/ai.js STANCES. Behavior knobs; balanced (and the
-- omitted default) is the IDENTITY — its values equal the historical literals,
-- so every substitution is unchanged. Must match ai.js exactly (the twins).
local STANCES: { [string]: any } = {
	balanced = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCity = 1, attackerBase = 0 },
	defensive = { marchRadiusPct = 0, garrisonAlways2 = true, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "city-walls", improveFirst = nil, sciRates = false, attackerPerCity = 0, attackerBase = 0 },
	aggressive = { marchRadiusPct = 175, garrisonAlways2 = false, armyCapPerCity = 6, armyCapBase = 8, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCity = 2, attackerBase = 2 },
	science = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "library", improveFirst = nil, sciRates = true, attackerPerCity = 1, attackerBase = 0 },
	growth = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 3, settlerDiv = 1, buildPriority = "granary", improveFirst = "irrigate", sciRates = false, attackerPerCity = 1, attackerBase = 0 },
}
local function stanceOf(stance: any): any
	if stance ~= nil and STANCES[stance] ~= nil then
		return STANCES[stance]
	end
	return STANCES.balanced
end

-- B13f twin: march-vs-explore radius = rules.exploreMarchRadius x the stance's
-- marchRadiusPct (identity: idiv(8 * 100, 100) = 8). Sweepable via rulesOverrides.
local function marchRadiusOf(ruleset: any, S: any): number
	return idiv(ruleset.rules.exploreMarchRadius * S.marchRadiusPct, 100)
end

local function sortedKeys(t: any): { string }
	local keys = {}
	for k in pairs(t) do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

local function wrapDx(map: any, from: number, to: number): number
	local dx = to - from
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

local function sign(n: number): number
	return if n > 0 then 1 elseif n < 0 then -1 else 0
end

local function dirToward(map: any, fromX: number, fromY: number, toX: number, toY: number): string?
	local dx = sign(wrapDx(map, fromX, toX))
	local dy = sign(toY - fromY)
	if dx == 0 and dy == 0 then
		return nil
	end
	for _, key in ipairs(DIR_KEYS) do
		if DIR_VECS[key][1] == dx and DIR_VECS[key][2] == dy then
			return key
		end
	end
	return nil
end

local function isExplored(me: any, map: any, x: number, y: number): boolean
	if me.explored == nil then
		return true -- omniscient test states
	end
	return me.explored[y * map.width + x + 1] == 1
end

local FOUND_TERRAIN: { [string]: boolean } = { grassland = true, plains = true, hills = true }
local NEVER_FOUND: { [string]: boolean } = { arctic = true, mountains = true }

local function canFoundAt(state: any, x: number, y: number, ruleset: any): boolean
	local tile = state.map.tiles[y * state.map.width + x + 1]
	if ruleset.terrain.terrains[tile.t].domain ~= "land" then
		return false
	end
	if NEVER_FOUND[tile.t] == true then
		return false
	end
	if FOUND_TERRAIN[tile.t] ~= true and tile.river ~= true then
		return false
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and not cities.citySpacingOk(state.map, x, y, c.x, c.y, ruleset.rules) then
			return false
		end
	end
	return true
end

local function goodCitySpot(state: any, unit: any, ruleset: any): boolean
	return canFoundAt(state, unit.x, unit.y, ruleset)
end

-- Any KNOWN enemy unit within radius? Order-independent boolean.
local function enemyNear(state: any, me: any, playerId: string, x: number, y: number, radius: number): boolean
	for _, u in pairs(state.units) do
		if u.owner ~= playerId
			and isExplored(me, state.map, u.x, u.y)
			and chebyshev(state.map, x, y, u.x, u.y) <= radius then
			return true
		end
	end
	return false
end

-- A step toward (tx, ty) that a lone settler can survive.
local function safeDirToward(state: any, me: any, playerId: string, unit: any, tx: number, ty: number, ruleset: any): string?
	local map = state.map
	local best = nil
	local bestD = chebyshev(map, unit.x, unit.y, tx, ty)
	for _, key in ipairs(DIR_KEYS) do
		local nx = unit.x + DIR_VECS[key][1]
		local skip = false
		if nx < 0 or nx >= map.width then
			if not map.wrapX then
				skip = true
			else
				nx = ((nx % map.width) + map.width) % map.width
			end
		end
		local ny = unit.y + DIR_VECS[key][2]
		if not skip and (ny < 1 or ny >= map.height - 1) then
			skip = true
		end
		if not skip and ruleset.terrain.terrains[map.tiles[ny * map.width + nx + 1].t].domain ~= "land" then
			skip = true
		end
		if not skip then
			for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
				if u.owner ~= playerId then
					skip = true
				end
			end
		end
		if not skip and enemyNear(state, me, playerId, nx, ny, 1) then
			skip = true
		end
		if not skip then
			local d = chebyshev(map, nx, ny, tx, ty)
			if d < bestD then
				bestD = d
				best = key
			end
		end
	end
	return best
end

-- This settler's rank among the civ's settlers (sorted ids).
local function settlerRank(state: any, playerId: string, uid: string): number
	local rank = 0
	for _, id in ipairs(combat.sortIds(sortedKeys(state.units))) do
		local u = state.units[id]
		if u.owner == playerId and u.type == "settlers" then
			if id == uid then
				return rank
			end
			rank += 1
		end
	end
	return 0
end

-- The nearest unimproved WORKED tile of a nearby own city.
local function bestImprovementJob(state: any, unit: any, playerId: string, ruleset: any, improveFirst: any): any
	local map = state.map
	local me = state.players[playerId]
	local knowsRail = table.find(me.techs, ruleset.rules.railroadTech) ~= nil
	local best = nil
	local bestD = 9999
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId
			and chebyshev(map, unit.x, unit.y, city.x, city.y) <= 6 then
			for _, w in ipairs(cities.workedTiles(state, city, ruleset)) do
				if combat.cityAt(state, w.x, w.y) == nil then
					local tile = map.tiles[w.y * map.width + w.x + 1]
					local terrain = ruleset.terrain.terrains[tile.t]
					if terrain.domain == "land" then
						local canIrrigate = tile.irrigation ~= true and tile.mine ~= true
							and terrain.irrigate ~= nil
							and improvements.hasWaterSource(state, w.x, w.y)
						-- B13d: mine shield terrain (prefer over irrigation only
						-- where it yields MORE shields than the irrigation food)
						local canMine = tile.irrigation ~= true and tile.mine ~= true
							and terrain.mine ~= nil
						local mineBetter = canMine and (not canIrrigate or terrain.mine.shields > terrain.irrigate.food)
						-- B13b: upgrade a finished road to rail once Railroad known
						local canRail = knowsRail and tile.road == true and tile.railroad ~= true
						local work = nil
						-- A40 growth irrigates first; balanced keeps roads-first,
						-- then the terrain yield (mine/irrigate), then rail-upgrade
						if improveFirst == "irrigate" and canIrrigate then
							work = "irrigate"
						elseif tile.road ~= true then
							work = "road"
						elseif mineBetter then
							work = "mine"
						elseif canIrrigate then
							work = "irrigate"
						elseif canRail then
							work = "railroad"
						end
						if work ~= nil then
							local hostile = false
							for _, u in ipairs(combat.unitsAt(state, w.x, w.y)) do
								if u.owner ~= playerId then
									hostile = true
								end
							end
							if not hostile then
								local d = chebyshev(map, unit.x, unit.y, w.x, w.y)
								if d < bestD then
									bestD = d
									best = { x = w.x, y = w.y, work = work }
								end
							end
						end
					end
				end
			end
		end
	end
	return best
end

-- The best founding site within an explored radius. Deterministic: fixed
-- scan order, strict > keeps the first of any tie.
local function siteScan(state: any, unit: any, me: any, ruleset: any, radius: number, distPenalty: number): any
	local map = state.map
	local best = nil
	local bestScore = 0
	for dy = -radius, radius do
		local y = unit.y + dy
		if y >= 1 and y < map.height - 1 then
			for dx = -radius, radius do
				local x = unit.x + dx
				local skip = false
				if x < 0 or x >= map.width then
					if not map.wrapX then
						skip = true
					else
						x = ((x % map.width) + map.width) % map.width
					end
				end
				if not skip and not isExplored(me, map, x, y) then
					skip = true
				end
				if not skip and not canFoundAt(state, x, y, ruleset) then
					skip = true
				end
				if not skip and enemyNear(state, me, me.id, x, y, 2) then
					skip = true -- no cradles in war zones
				end
				if not skip then
					local tile = map.tiles[y * map.width + x + 1]
					local score = if tile.t == "grassland" then 30
						elseif tile.t == "plains" then 26
						elseif tile.t == "hills" then 22
						else 18
					if tile.river == true then
						score += 6
					end
					if tile.special == true then
						score += 3
					end
					score -= chebyshev(map, unit.x, unit.y, x, y) * distPenalty
					if score > bestScore then
						bestScore = score
						best = { x = x, y = y }
					end
				end
			end
		end
	end
	return best
end

local function bestCitySite(state: any, unit: any, playerId: string, ruleset: any): any
	local me = state.players[playerId]
	local local_ = siteScan(state, unit, me, ruleset, 7, 2)
	if local_ ~= nil then
		return local_
	end
	local far = if state.map.width > state.map.height then state.map.width else state.map.height
	return siteScan(state, unit, me, ruleset, far, 1)
end

-- Best adjacent tile for a wandering settler: prefer fertile open land.
local function towardBetterLand(state: any, unit: any, ruleset: any): string?
	local bestDir = nil
	local bestScore = 0
	for _, key in ipairs(DIR_KEYS) do
		local nx = ((unit.x + DIR_VECS[key][1]) % state.map.width + state.map.width) % state.map.width
		local ny = unit.y + DIR_VECS[key][2]
		if ny >= 1 and ny < state.map.height - 1 then
			local t = state.map.tiles[ny * state.map.width + nx + 1].t
			local score = if t == "grassland" then 3
				elseif t == "plains" then 2
				elseif ruleset.terrain.terrains[t].domain == "land" then 1
				else 0
			if combat.cityAt(state, nx, ny) ~= nil then
				score = 0
			end
			for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
				if u.owner ~= unit.owner then
					score = 0
				end
			end
			if score > bestScore then
				bestScore = score
				bestDir = key
			end
		end
	end
	return bestDir
end

-- mark a tech and its whole prerequisite closure in `out`
local function markTechPath(ruleset: any, techId: string, out: any)
	if out[techId] == true then
		return
	end
	out[techId] = true
	for _, req in ipairs(ruleset.techs[techId].prereqs) do
		markTechPath(ruleset, req, out)
	end
end

local function countSettlers(state: any, playerId: string): number
	local n = 0
	for _, u in pairs(state.units) do
		if u.owner == playerId and u.type == "settlers" then
			n += 1
		end
	end
	return n
end

local function countCities(state: any, playerId: string): number
	local n = 0
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId then
			n += 1
		end
	end
	return n
end

local function countMilitary(state: any, playerId: string, ruleset: any): number
	local n = 0
	for _, u in pairs(state.units) do
		if u.owner == playerId and ruleset.units[u.type].attack > 0 then
			n += 1
		end
	end
	return n
end

-- B13e twin: best OFFENSIVE land unit (attack > own defense), non-obsolete,
-- tech-known; attack desc, cost asc, id asc (matches engine/ai.js). nil if
-- none. Era-scales legion -> catapult -> knights -> cannon -> armor/artillery.
local function bestAttackerUnit(me: any, ruleset: any): string?
	local best, bestDef = nil, nil
	for _, id in ipairs(sortedKeys(ruleset.units)) do
		local def = ruleset.units[id]
		if def.domain == "land" and def.attack > def.defense
			and (def.tech == "" or table.find(me.techs, def.tech) ~= nil)
			and not cities.unitObsolete(def, me.techs) then
			if best == nil
				or def.attack > bestDef.attack
				or (def.attack == bestDef.attack and def.cost < bestDef.cost)
				or (def.attack == bestDef.attack and def.cost == bestDef.cost and id < best) then
				best = id
				bestDef = def
			end
		end
	end
	return best
end

-- B13e twin: the player's OFFENSIVE units (attack > defense).
local function countAttackers(state: any, playerId: string, ruleset: any): number
	local n = 0
	for _, u in pairs(state.units) do
		local def = ruleset.units[u.type]
		if u.owner == playerId and def.attack > def.defense then
			n += 1
		end
	end
	return n
end

-- Cheapest building the city lacks (never a Palace). Comparison-select with
-- an explicit id tie-break — independent of key iteration order.
-- B13a/B13e twin: best LAND defender the player can build now — highest
-- defense, then cheapest, then id (deterministic tie-breaks; matches
-- engine/ai.js). Skips obsolete units so the choice era-scales.
local function bestDefenderUnit(me: any, ruleset: any): string
	local best, bestDef = nil, nil
	for _, id in ipairs(sortedKeys(ruleset.units)) do
		local def = ruleset.units[id]
		if def.domain == "land" and def.defense > 0
			and (def.tech == "" or table.find(me.techs, def.tech) ~= nil)
			and not cities.unitObsolete(def, me.techs) then
			if best == nil
				or def.defense > bestDef.defense
				or (def.defense == bestDef.defense and def.cost < bestDef.cost)
				or (def.defense == bestDef.defense and def.cost == bestDef.cost and id < best) then
				best = id
				bestDef = def
			end
		end
	end
	return if best == nil then "militia" else best
end

local function nextBuilding(city: any, me: any, ruleset: any): string?
	local best = nil
	for _, id in ipairs(sortedKeys(ruleset.buildings)) do
		local def = ruleset.buildings[id]
		local skip = false
		if city.buildings ~= nil and table.find(city.buildings, id) ~= nil then
			skip = true
		end
		if not skip and def.effect.isPalace == true then
			skip = true
		end
		if not skip and def.tech ~= "" and table.find(me.techs, def.tech) == nil then
			skip = true
		end
		if not skip then
			if best == nil or def.cost < ruleset.buildings[best].cost
				or (def.cost == ruleset.buildings[best].cost and id < best) then
				best = id
			end
		end
	end
	return best
end

local function nextWonder(state: any, me: any, ruleset: any): string?
	local built = if state.wonders == nil then {} else state.wonders
	local best = nil
	for _, id in ipairs(sortedKeys(ruleset.wonders)) do
		local def = ruleset.wonders[id]
		local skip = false
		if built[id] ~= nil then
			skip = true
		end
		if not skip and def.tech ~= "" and table.find(me.techs, def.tech) == nil then
			skip = true
		end
		if not skip then
			if best == nil or def.cost < ruleset.wonders[best].cost
				or (def.cost == ruleset.wonders[best].cost and id < best) then
				best = id
			end
		end
	end
	return best
end

-- A40 stance build preference (TWIN of ai.js stanceBuilding): a specific
-- building if missing + tech-known, else the historical cheapest. balanced
-- (buildPriority nil) short-circuits to nextBuilding — byte-identical.
local function stanceBuilding(city: any, me: any, ruleset: any, S: any): string?
	if S.buildPriority ~= nil then
		local id = S.buildPriority
		local def = ruleset.buildings[id]
		local missing = city.buildings == nil or table.find(city.buildings, id) == nil
		if def ~= nil and missing and (def.tech == "" or table.find(me.techs, def.tech) ~= nil) then
			return id
		end
	end
	return nextBuilding(city, me, ruleset)
end

-- The nearest own settler in the open with no adjacent military guard.
local function nearestUnguardedSettler(state: any, unit: any, playerId: string, ruleset: any, radius: number): any
	local best = nil
	local bestD = radius + 1
	for _, uid in ipairs(combat.sortIds(sortedKeys(state.units))) do
		local s = state.units[uid]
		if s.owner == playerId and s.type == "settlers" and combat.cityAt(state, s.x, s.y) == nil then
			local guarded = false
			for _, g in pairs(state.units) do
				if g.id ~= unit.id and g.owner == playerId
					and ruleset.units[g.type].attack > 0
					and chebyshev(state.map, g.x, g.y, s.x, s.y) <= 1 then
					guarded = true
				end
			end
			if not guarded then
				local d = chebyshev(state.map, unit.x, unit.y, s.x, s.y)
				if d < bestD then
					bestD = d
					best = s
				end
			end
		end
	end
	return best
end

local function nearestKnownEnemy(state: any, unit: any, playerId: string): any
	local me = state.players[playerId]
	local best = nil
	local bestDist = 9999
	for _, uid in ipairs(combat.sortIds(sortedKeys(state.units))) do
		local u = state.units[uid]
		if u.owner ~= playerId and isExplored(me, state.map, u.x, u.y) then
			local d = chebyshev(state.map, unit.x, unit.y, u.x, u.y)
			if d < bestDist then
				best = u
				bestDist = d
			end
		end
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner ~= playerId and isExplored(me, state.map, c.x, c.y) then
			local d = chebyshev(state.map, unit.x, unit.y, c.x, c.y)
			if d < bestDist then
				best = c
				bestDist = d
			end
		end
	end
	return best
end

local function towardUnexplored(state: any, unit: any, me: any): string?
	if me.explored == nil then
		return nil
	end
	local width, height = state.map.width, state.map.height
	local best = nil
	local bestDist = 9999
	for y = 1, height - 2 do
		for x = 0, width - 1 do
			if me.explored[y * width + x + 1] ~= 1 then
				local d = chebyshev(state.map, unit.x, unit.y, x, y)
				if d < bestDist then
					best = { x = x, y = y }
					bestDist = d
				end
			end
		end
	end
	if best == nil then
		return nil
	end
	return dirToward(state.map, unit.x, unit.y, best.x, best.y)
end

-- Batch 4, iteration 3 (docs/04 ledger): entertainers-local disorder fix.
-- Revert only when a HYPOTHETICAL mood without manual assignment (a shallow
-- copy minus `workers` — cityMood then scores the auto layout) is
-- disorder-free, so the entertainer's own calm never causes a flap.
local function happinessCommand(state: any, playerId: string, ruleset: any): any
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId then
			local mood = happiness.cityMood(state, city, ruleset)
			if mood.disorder and city.pop >= 2 then
				local cands = cities.candidateTiles(state, city, ruleset)
				local target = city.pop - 1 - (if city.taxmen == nil then 0 else city.taxmen)
					- (if city.scientists == nil then 0 else city.scientists)
				local current = if city.workers ~= nil then #city.workers
					else (if city.pop < #cands then city.pop else #cands)
				if target < current and target >= 0 and #cands > 0 then
					-- keep enters STATE via setWorkers and may be EMPTY: marked
					local keep = setmetatable({}, statehash.ARRAY_MT)
					for i = 1, #cands do
						if #keep >= target then
							break
						end
						table.insert(keep, cands[i].idx)
					end
					return { type = "setWorkers", playerId = playerId, cityId = cid, workers = keep }
				end
			end
			if not mood.disorder and city.workers ~= nil and mood.entertainers > 0 then
				local probe = {}
				for _, k in ipairs(sortedKeys(city)) do
					if k ~= "workers" then
						probe[k] = city[k]
					end
				end
				if happiness.cityMood(state, probe, ruleset).disorder == false then
					return { type = "setWorkers", playerId = playerId, cityId = cid, auto = true }
				end
			end
		end
	end
	return nil
end

-- One decision at a time; `done` prevents re-considering an actor this turn.
local function pickCommand(state: any, playerId: string, ruleset: any, done: any, stance: any): any
	local me = state.players[playerId]
	local S = stanceOf(stance) -- balanced (or omitted) = the identity
	local marchR = marchRadiusOf(ruleset, S) -- B13f: sweepable via rules.json

	if done.happiness ~= true then
		done.happiness = true -- one assignment change per turn — gradual
		local cmd = happinessCommand(state, playerId, ruleset)
		if cmd ~= nil then
			return cmd
		end
	end

	if (me.researching == "" or me.researching == nil) and done.research ~= true then
		done.research = true
		local avail = tech.availableTechs(state, playerId, ruleset)
		if #avail > 0 then
			-- beeline Monarchy first (Civ 1 AIs rush a government)
			local pool = avail
			if table.find(me.techs, "monarchy") == nil then
				local path = {}
				markTechPath(ruleset, "monarchy", path)
				local onPath = {}
				for _, id in ipairs(avail) do
					if path[id] == true then
						table.insert(onPath, id)
					end
				end
				if #onPath > 0 then
					pool = onPath
				end
			end
			local best = pool[1]
			for _, id in ipairs(pool) do
				if ruleset.techs[id].level < ruleset.techs[best].level then
					best = id
				end
			end
			return { type = "setResearch", playerId = playerId, tech = best }
		end
	end

	-- A40 science stance ONLY: prefer science when disorder-free (a setRates
	-- the balanced AI never issues — gated on the stance, so balanced games
	-- never reach this branch). One rate change per turn.
	if S.sciRates == true and done.rates ~= true then
		done.rates = true
		local anyDisorder = false
		for _, cid in ipairs(state.cityOrder or {}) do
			local c = state.cities[cid]
			if c ~= nil and c.owner == playerId and c.disorder == true then
				anyDisorder = true
				break
			end
		end
		if not anyDisorder then
			local gov = ruleset.governments[if me.government == nil then "despotism" else me.government]
			local cap = if gov.maxRate == nil then 60 else gov.maxRate
			local sci = cap
			local tax = if 100 - sci <= cap then 100 - sci else cap
			if me.sciRate ~= sci then
				return { type = "setRates", playerId = playerId, tax = tax, sci = sci, lux = 100 - sci - tax }
			end
		end
	end

	-- one revolution, to Monarchy, once the advance is known
	if done.government ~= true
		and (me.government == nil or me.government == "despotism")
		and me.revolutionTurns == nil
		and table.find(me.techs, "monarchy") ~= nil then
		done.government = true
		return { type = "setGovernment", playerId = playerId, government = "monarchy" }
	end

	for _, cid in ipairs(state.cityOrder or {}) do
		if done["c:" .. cid] ~= true then
			local city = state.cities[cid]
			if city ~= nil and city.owner == playerId then
				done["c:" .. cid] = true
				local defenders = 0
				for _, u in ipairs(combat.unitsAt(state, city.x, city.y)) do
					if u.owner == playerId then
						defenders += 1
					end
				end
				local bestDefender = bestDefenderUnit(me, ruleset)
				-- A40 stance knobs (balanced = the historical literals): defensive
				-- always wants 2 guards; growth wants more settlers; aggressive
				-- raises the empire army cap.
				local threatened = enemyNear(state, me, playerId, city.x, city.y, ruleset.rules.threatRadius)
					local wantDefenders = if (S.garrisonAlways2 or threatened) then 2 else 1
				local want = { kind = "unit", id = bestDefender }
				if defenders >= wantDefenders then
					if countSettlers(state, playerId) < S.settlerBase + idiv(countCities(state, playerId), S.settlerDiv) then
						want = { kind = "unit", id = "settlers" }
					else
						-- B13g: a THREATENED city walls up first (masonry known, not
						-- already walled) before any other building.
						local wallsDef = ruleset.buildings["city-walls"]
						local canWall = threatened and wallsDef ~= nil
							and (city.buildings == nil or table.find(city.buildings, "city-walls") == nil)
							and (wallsDef.tech == "" or table.find(me.techs, wallsDef.tech) ~= nil)
						local building = if canWall then "city-walls" else stanceBuilding(city, me, ruleset, S)
						local wonder = if building == nil then nextWonder(state, me, ruleset) else nil
						-- B13e: buildings + wonders done — field an OFFENSIVE army up
						-- to the empire target before settler-pavers (twin of ai.js).
						local attacker = if building == nil and wonder == nil then bestAttackerUnit(me, ruleset) else nil
						local armyTarget = countCities(state, playerId) * S.attackerPerCity + S.attackerBase
						if building ~= nil then
							want = { kind = "building", id = building }
						elseif wonder ~= nil then
							want = { kind = "wonder", id = wonder }
						elseif attacker ~= nil and countAttackers(state, playerId, ruleset) < armyTarget then
							want = { kind = "unit", id = attacker }
						elseif defenders >= 3
							or countMilitary(state, playerId, ruleset) >= countCities(state, playerId) * S.armyCapPerCity + S.armyCapBase then
							want = { kind = "unit", id = "settlers" }
						end
					end
				end
				if city.producing.kind ~= want.kind or city.producing.id ~= want.id then
					return { type = "setProduction", playerId = playerId, cityId = cid, item = want }
				end
			end
			-- a foreign/missing city is skipped WITHOUT marking done (JS shape)
		end
	end

	for _, uid in ipairs(combat.sortIds(sortedKeys(state.units))) do
		if done["u:" .. uid] ~= true then
			local unit = state.units[uid]
			if unit ~= nil and unit.owner == playerId and unit.moves > 0 and unit.working == nil then
				done["u:" .. uid] = true

				if unit.type == "settlers" then
					if goodCitySpot(state, unit, ruleset)
						and not enemyNear(state, me, playerId, unit.x, unit.y, 2) then
						return { type = "foundCity", playerId = playerId, unitId = uid }
					end
					if settlerRank(state, playerId, uid) % 2 == 1 then
						local job = bestImprovementJob(state, unit, playerId, ruleset, S.improveFirst)
						if job ~= nil then
							if job.x == unit.x and job.y == unit.y then
								return { type = "startWork", playerId = playerId, unitId = uid, work = job.work }
							end
							local dir = safeDirToward(state, me, playerId, unit, job.x, job.y, ruleset)
							if dir ~= nil then
								return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
							end
						end
					end
					local site = bestCitySite(state, unit, playerId, ruleset)
					if site ~= nil then
						local dir = safeDirToward(state, me, playerId, unit, site.x, site.y, ruleset)
						if dir ~= nil then
							return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
						end
						continue
					end
					local tile = state.map.tiles[unit.y * state.map.width + unit.x + 1]
					if ruleset.terrain.terrains[tile.t].domain == "land" and tile.road ~= true then
						return { type = "startWork", playerId = playerId, unitId = uid, work = "road" }
					end
					local dir = towardBetterLand(state, unit, ruleset)
					if dir ~= nil then
						return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
					end
					continue
				end

				local enemy = nearestKnownEnemy(state, unit, playerId)
				local home = combat.cityAt(state, unit.x, unit.y)
				if home ~= nil and home.owner == playerId and not unit.fortified then
					local guards = 0
					for _, g in ipairs(combat.unitsAt(state, unit.x, unit.y)) do
						if g.owner == playerId and ruleset.units[g.type].attack > 0 then
							guards += 1
						end
					end
					local need = if enemyNear(state, me, playerId, home.x, home.y, ruleset.rules.threatRadius) then 2 else 1
					if guards <= need then
						return { type = "fortify", playerId = playerId, unitId = uid }
					end
				end
				-- A40: defensive never marches out (radius 0), aggressive ranges
				-- wider; balanced keeps the historical 8 — byte-identical.
				if enemy ~= nil and marchR > 0 and chebyshev(state.map, unit.x, unit.y, enemy.x, enemy.y) <= marchR then
					local dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y)
					if dir ~= nil then
						return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
					end
				end
				local ward = nearestUnguardedSettler(state, unit, playerId, ruleset, 10)
				if ward ~= nil then
					if chebyshev(state.map, unit.x, unit.y, ward.x, ward.y) <= 1 then
						return { type = "wait", playerId = playerId, unitId = uid }
					end
					local dir = dirToward(state.map, unit.x, unit.y, ward.x, ward.y)
					if dir ~= nil then
						return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
					end
				end
				local dir = nil
				-- balanced marches toward a known enemy; defensive (radius 0)
				-- explores instead — never leaves to attack
				if enemy ~= nil and marchR > 0 then
					dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y)
				else
					dir = towardUnexplored(state, unit, me)
				end
				if dir ~= nil then
					return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
				end
			end
		end
	end

	return nil
end

-- Host-level driver: ask for a command and apply until nothing is left.
-- Rejected commands just retire that actor — the AI can never wedge.
local function runAiTurn(engine: any, state: any, playerId: string, ruleset: any, eventsOut: any, stance: any): any
	local done = {}
	local guard = 500
	while guard > 0 do
		guard -= 1
		local cmd = pickCommand(state, playerId, ruleset, done, stance)
		if cmd == nil then
			break
		end
		local res = engine.applyCommand(state, cmd)
		if res.ok then
			state = res.state
			if eventsOut ~= nil then
				for _, e in ipairs(res.events) do
					table.insert(eventsOut, e)
				end
			end
		end
	end
	return state
end

return {
	runAiTurn = runAiTurn,
	pickCommand = pickCommand,
	goodCitySpot = goodCitySpot,
}
