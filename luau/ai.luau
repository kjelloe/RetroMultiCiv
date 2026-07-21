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
local government = require("./government")
local diplomacy = require("./diplomacy") -- D3: met/relation reads
local aiDiplomacy = require("./ai-diplomacy") -- D3: score models
local strategic = require("./strategic") -- XII.5b: commit snapshot

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
	balanced = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 0, pbMult = 100, escortRadiusPct = 100, govTarget = "republic-if-safe" },
	defensive = { marchRadiusPct = 0, garrisonAlways2 = true, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "city-walls", improveFirst = nil, sciRates = false, attackerPerCityPct = 0, attackerBasePct = 0, scoutSharePct = 40, econReserve = 0, pbMult = 125, escortRadiusPct = 150, govTarget = "republic" },
	aggressive = { marchRadiusPct = 175, garrisonAlways2 = false, armyCapPerCity = 6, armyCapBase = 8, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCityPct = 200, attackerBasePct = 100, scoutSharePct = 150, econReserve = 0, pbMult = 50, escortRadiusPct = 150, govTarget = "monarchy" },
	science = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "library", improveFirst = nil, sciRates = true, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 99, pbMult = 125, escortRadiusPct = 60, govTarget = "republic" },
	growth = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 3, settlerDiv = 1, buildPriority = "granary", improveFirst = "irrigate", sciRates = false, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 99, pbMult = 125, escortRadiusPct = 60, govTarget = "republic" },
	builder = { marchRadiusPct = 80, garrisonAlways2 = true, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 3, settlerDiv = 1, buildPriority = nil, improveFirst = "irrigate", sciRates = true, attackerPerCityPct = 0, attackerBasePct = 0, scoutSharePct = 80, econReserve = 99, pbMult = 150, wonderDrive = true, defendFirst = true, escortRadiusPct = 80, govTarget = "republic" },
}
-- N9b build-priority lever constants (provisional — sim-swept, two-phase close;
-- NOT rules.json). Twin of engine/ai.js BUILD_LEVER.
local BUILD_LEVER = { pbMax = 40, wonderMinShields = 5 }
-- Government re-eval adoption rank (behavior knob, matches engine/ai.js GOV_RANK):
-- a revolt only ever moves UP this ladder, so there is no republic<->monarchy
-- thrash. Democracy is DEFERRED to phase 6; no stance targets it.
local GOV_RANK: { [string]: number } = { despotism = 0, anarchy = 0, monarchy = 1, communism = 1, republic = 2, democracy = 3 }
local function govRank(g: string): number
	return if GOV_RANK[g] == nil then 0 else GOV_RANK[g]
end
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

-- B21(a) twin: offensive-army target = rules.json base x stance pct (the
-- marchRadiusOf passthrough shape). Defaults reproduce the B13e resolved values.
local function attackerPerCityOf(ruleset: any, S: any): number
	return idiv(ruleset.rules.attackerPerCity * S.attackerPerCityPct, 100)
end
local function attackerBaseOf(ruleset: any, S: any): number
	return idiv(ruleset.rules.attackerBase * S.attackerBasePct, 100)
end
-- B21(d) twin: share of a civ's military that scouts (rules base x stance pct).
local function scoutShareOf(ruleset: any, S: any): number
	return idiv(ruleset.rules.aiScoutSharePct * S.scoutSharePct, 100)
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

-- Government re-eval (specs/government-reeval.md): is the civ safe to bear
-- Republic's away-only war unhappiness — no VISIBLE enemy within the threat
-- radius of any own city (fog-honest). Only consulted for 'republic-if-safe'.
local function govSafe(state: any, playerId: string, ruleset: any): boolean
	local me = state.players[playerId]
	local radius = ruleset.rules.threatRadius
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId and enemyNear(state, me, playerId, c.x, c.y, radius) then
			return false
		end
	end
	return true
end

-- The government this civ should hold now: the best it has the tech for toward
-- its stance's govTarget. 'republic-if-safe' reaches Republic only when govSafe.
local function pickGovernment(state: any, playerId: string, ruleset: any, S: any): string
	local me = state.players[playerId]
	local target = if S.govTarget == nil then "monarchy" else S.govTarget
	local hasMonarchy = table.find(me.techs, "monarchy") ~= nil
	local hasRepublic = table.find(me.techs, "republic") ~= nil
	if target == "republic" or target == "republic-if-safe" then
		if hasRepublic and (target == "republic" or govSafe(state, playerId, ruleset)) then
			return "republic"
		end
	end
	return if hasMonarchy then "monarchy" else "despotism"
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

-- §12: a bounded land-only BFS from the settler to a SPECIFIC target, returning
-- the first step of the shortest SAFE path — routes AROUND concave coasts / ocean
-- inlets where safeDirToward greedy-chebyshev dead-ends. Same passability; bounded
-- by rules.settlerPathRadius. Deterministic (DIR_KEYS order, BFS layer order).
local function bfsStepToward(state: any, me: any, playerId: string, unit: any, tx: number, ty: number, ruleset: any): string?
	local map = state.map
	local width, height, wrapX = map.width, map.height, map.wrapX
	local maxR = if ruleset.rules.settlerPathRadius == nil then 12 else ruleset.rules.settlerPathRadius
	local visited = {}
	visited[unit.y * width + unit.x] = true
	local queue = { { x = unit.x, y = unit.y, first = nil } }
	local qi = 1
	while qi <= #queue do
		local cur = queue[qi]
		qi += 1
		for _, key in ipairs(DIR_KEYS) do
			local nx = cur.x + DIR_VECS[key][1]
			if nx < 0 or nx >= width then
				if not wrapX then
					continue
				end
				nx = ((nx % width) + width) % width
			end
			local ny = cur.y + DIR_VECS[key][2]
			if ny < 1 or ny >= height - 1 then
				continue
			end
			local idx = ny * width + nx
			if visited[idx] == true then
				continue
			end
			visited[idx] = true
			if chebyshev(map, unit.x, unit.y, nx, ny) > maxR then
				continue
			end
			local first = if cur.first == nil then key else cur.first
			if nx == tx and ny == ty then
				return first
			end
			if ruleset.terrain.terrains[map.tiles[idx + 1].t].domain ~= "land" then
				continue
			end
			local hostile = false
			for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
				if u.owner ~= playerId then
					hostile = true
				end
			end
			if hostile then
				continue
			end
			if enemyNear(state, me, playerId, nx, ny, 1) then
				continue
			end
			table.insert(queue, { x = nx, y = ny, first = first })
		end
	end
	return nil
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

-- B21(b) twin: the tech that unlocks the earliest OFFENSIVE unit (lowest tech
-- LEVEL among land attack>defense units; tech-id tie-break). Data-driven, no
-- hardcoded id. "" when no offensive unit needs a tech. Matches engine/ai.js.
local function attackerTech(ruleset: any): string
	local best, bestLevel = nil, 0
	for _, id in ipairs(sortedKeys(ruleset.units)) do
		local def = ruleset.units[id]
		if def.domain == "land" and def.attack > def.defense and def.tech ~= "" then
			local lvl = if ruleset.techs[def.tech] == nil then 0 else ruleset.techs[def.tech].level
			if best == nil or lvl < bestLevel or (lvl == bestLevel and def.tech < best) then
				best = def.tech
				bestLevel = lvl
			end
		end
	end
	return if best == nil then "" else best
end

-- N3 twin: the tech that unlocks the earliest SEA unit (the naval-beeline term).
local function seaTech(ruleset: any): string
	local best, bestLevel = nil, 0
	for _, id in ipairs(sortedKeys(ruleset.units)) do
		local def = ruleset.units[id]
		if def.domain == "sea" and def.tech ~= "" then
			local lvl = if ruleset.techs[def.tech] == nil then 0 else ruleset.techs[def.tech].level
			if best == nil or lvl < bestLevel or (lvl == bestLevel and def.tech < best) then
				best = def.tech
				bestLevel = lvl
			end
		end
	end
	return if best == nil then "" else best
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

-- N3 twin: land military (the "first N land units" floor) and ships.
local function countLandMilitary(state: any, playerId: string, ruleset: any): number
	local n = 0
	for _, u in pairs(state.units) do
		local def = ruleset.units[u.type]
		if u.owner == playerId and def.domain == "land" and def.attack > 0 then
			n += 1
		end
	end
	return n
end
local function countShips(state: any, playerId: string, ruleset: any): number
	local n = 0
	for _, u in pairs(state.units) do
		if u.owner == playerId and ruleset.units[u.type].domain == "sea" then
			n += 1
		end
	end
	return n
end

-- N3 twin: is this civ NAVAL? Water ratio in a Chebyshev box (radius
-- rules.aiNavyRadius) around the civ cities vs rules.aiNavyWaterPct. Derived.
local function navyPriorityOf(state: any, playerId: string, ruleset: any): boolean
	local pct = ruleset.rules.aiNavyWaterPct
	if pct == nil then
		return false
	end
	local radius = if ruleset.rules.aiNavyRadius == nil then 6 else ruleset.rules.aiNavyRadius
	local map = state.map
	local seen = {}
	local water = 0
	local total = 0
	for _, cid in ipairs(combat.sortIds(state.cityOrder or {})) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId then
			for dy = -radius, radius do
				local ny = c.y + dy
				if ny >= 0 and ny < map.height then
					for dx = -radius, radius do
						local nx = c.x + dx
						local ok = true
						if nx < 0 or nx >= map.width then
							if not map.wrapX then
								ok = false
							else
								nx = ((nx % map.width) + map.width) % map.width
							end
						end
						if ok then
							local idx = ny * map.width + nx
							if seen[idx] ~= true then
								seen[idx] = true
								total += 1
								if ruleset.terrain.terrains[map.tiles[idx + 1].t].domain == "sea" then
									water += 1
								end
							end
						end
					end
				end
			end
		end
	end
	return total > 0 and water * 100 > pct * total
end

-- B24 twin: the per-combat-rule war doctrine (rules.aiWarDoctrine keyed by
-- combatRounds as a STRING -- tostring so JSON string keys match). Mass default.
local function warDoctrineOf(ruleset: any): any
	local doctrine = ruleset.rules.aiWarDoctrine
	local cr = if ruleset.rules.combatRounds == nil then 1 else ruleset.rules.combatRounds
	local d = if doctrine == nil then nil else doctrine[tostring(cr)]
	if d == nil then
		return { massSize = 4, oddsGatePct = 0, defenderGatePct = 100 }
	end
	-- B26b: PERCENT gates (100 = the old integer 1) for fractional M11 sweeps
	-- without floats (att*100 >= pct*def). Old integer fields resolve via *100.
	local oddsGatePct = d.oddsGatePct
	if oddsGatePct == nil then
		oddsGatePct = (if d.oddsGate == nil then 0 else d.oddsGate) * 100
	end
	local defenderGatePct = d.defenderGatePct
	if defenderGatePct == nil then
		if d.defenderGate ~= nil then
			defenderGatePct = d.defenderGate * 100
		elseif oddsGatePct > 0 then
			defenderGatePct = oddsGatePct
		else
			defenderGatePct = 100
		end
	end
	return { massSize = d.massSize, oddsGatePct = oddsGatePct, defenderGatePct = defenderGatePct }
end

-- B24 twin: nearest KNOWN enemy city (fog-honest -- explored tiles only). The
-- army group's shared objective; clustered attackers pick the same nearby city.
local function nearestKnownEnemyCity(state: any, unit: any, playerId: string): any
	local me = state.players[playerId]
	local best = nil
	local bestDist = 9999
	for _, cid in ipairs(combat.sortIds(state.cityOrder or {})) do
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

-- A76: is the space race OPEN for this civ — Apollo built (derived) and all part
-- techs known? Gates every AI ship action (dormant until a civ reaches space).
local function apolloReady(state: any, me: any, ruleset: any): boolean
	local f = ruleset.rules.ssFlight
	if f == nil then return false end
	if not cities.wonderActive(state, f.gateWonder, ruleset) then return false end
	local parts = ruleset.rules.ssParts
	for k in pairs(parts) do
		if table.find(me.techs, parts[k].tech) == nil then return false end
	end
	return true
end

-- XII.5: the late-game space victory-drive gate. A civ COMMITS to the space path
-- when its stance is in rules.victoryDrive.spaceStances (DATA-DRIVEN, sweepable) --
-- science/builder/balanced/defensive per the ruling; aggressive pursues conquest
-- in a later slice. Omit-safe: no victoryDrive block => off (golden-neutral).
local function spaceDriveOn(ruleset: any, stance: any): boolean
	local vd = ruleset.rules.victoryDrive
	if vd == nil or vd.spaceStances == nil then return false end
	-- resolve the effective stance NAME the way stanceOf resolves the config:
	-- an omitted/unknown stance is the 'balanced' identity (so a default civ drives).
	local st = if stance ~= nil and STANCES[stance] ~= nil then stance else "balanced"
	return table.find(vd.spaceStances, st) ~= nil
end

-- XII.5: eligible to DRIVE the space race -- the civ can build Apollo (holds its
-- tech) AND holds every ssPart tech. This is end-tier, so the drive self-gates to
-- the late game: no early/mid/crafted civ qualifies, so those games stay
-- byte-identical (the S5 golden-neutral-for-non-late guard, by construction).
local function spaceDriveEligible(state: any, me: any, ruleset: any): boolean
	local f = ruleset.rules.ssFlight
	if f == nil then return false end
	local apollo = ruleset.wonders[f.gateWonder]
	if apollo == nil then return false end
	if apollo.tech ~= "" and table.find(me.techs, apollo.tech) == nil then return false end
	local parts = ruleset.rules.ssParts
	for k in pairs(parts) do
		if table.find(me.techs, parts[k].tech) == nil then return false end
	end
	return true
end

-- XII.5b: a tech era rank = its index in ruleset.rules.ages (0-based, matching JS).
local function techEraRank(ruleset: any, era: string): number
	local ages = ruleset.rules.ages
	if ages == nil then return 0 end
	for i = 1, #ages do
		if ages[i].id == era then return i - 1 end
	end
	return 0
end

-- the civ's OWN most-advanced tech era rank (reads its own techs, never world age).
local function ownTechEraRank(state: any, me: any, ruleset: any): number
	local best = 0
	for _, tid in ipairs(me.techs) do
		local def = ruleset.techs[tid]
		if def ~= nil then
			local r = techEraRank(ruleset, def.era)
			if r > best then best = r end
		end
	end
	return best
end

-- XII.5b: eligible to COMMIT to the space PROJECT (early gate for path-research):
-- own tech era >= industrial + research-leader-or-within-gap + secure core + game
-- has time. Stance gate (not conquest) is spaceDriveOn, applied by the caller.
local function spaceCommitEligible(state: any, playerId: string, ruleset: any): boolean
	local me = state.players[playerId]
	if me == nil or me.alive == false then return false end
	local vd = ruleset.rules.victoryDrive
	if vd == nil then return false end
	if ownTechEraRank(state, me, ruleset) < techEraRank(ruleset, "industrial") then return false end
	local gap = if vd.spaceCommitTechGap == nil then 3 else vd.spaceCommitTechGap
	local lead = 0
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		if p ~= nil and p.alive ~= false then
			if #p.techs > lead then lead = #p.techs end
		end
	end
	if #me.techs < lead - gap then return false end
	local cap = government.capitalOf(state, playerId, ruleset)
	-- danger-abandon (#2138): CONCRETE capital danger -- an enemy unit ADJACENT (cheb 1),
	-- NOT the radius-8 threat metric (that signal misfired, #2125).
	if cap ~= nil and enemyNear(state, me, playerId, cap.x, cap.y, 1) then return false end
	if ruleset.rules.endYear ~= nil and state.year >= ruleset.rules.endYear then return false end
	return true
end

-- danger-abandon (#2138): a player's owned-city count -- the concrete input to the
-- city-loss abandon trigger. Pure, both engines.
local function ownedCities(state: any, playerId: string): number
	local n = 0
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId then
			n += 1
		end
	end
	return n
end

-- XII.5b (Q2 ruled B): COMMITTED = spaceDriveOn && spaceCommitEligible && the
-- strategic snapshot is not offensive/besieged (XII.5b-tune #2117: not warring
-- mode, not high threat). Snapshot runs past the cheap eligibility gates. Pure.
local function spaceCommitted(state: any, playerId: string, ruleset: any): boolean
	local me = state.players[playerId]
	if me == nil then return false end
	if not spaceDriveOn(ruleset, me.stance) then return false end
	if not spaceCommitEligible(state, playerId, ruleset) then return false end
	local snap = strategic.strategicSnapshot(state, playerId, ruleset)
	-- danger-abandon (#2138, user-ruled): MAINTAIN through a border skirmish ANYWHERE;
	-- abandon ONLY on CONCRETE danger -- mode "warring", an enemy adjacent to the capital
	-- (spaceCommitEligible cheb-1), or a CITY LOST since last turn (ownedCities < record).
	-- The threat-metric streak was REMOVED. Recommit possible once danger clears.
	if snap.mode == "warring" then return false end
	if me.spaceCities ~= nil and ownedCities(state, playerId) < me.spaceCities then return false end
	return true
end

-- danger-abandon (#2138): record a space-driving civ's owned-city count at the END of its
-- turn (from runAiTurn -- replay-safe). Next turn spaceCommitted abandons if the count
-- DROPPED (a city captured between turns). Stance-gated; rides only space-driving civs.
local function updateSpaceCityRecord(state: any, playerId: string, ruleset: any)
	local me = state.players[playerId]
	if me == nil then return end
	if not spaceDriveOn(ruleset, me.stance) then return end
	me.spaceCities = ownedCities(state, playerId)
end

-- A76: the next part to build toward a minimum-viable ship, or nil when ready to
-- launch. 7 structural supports the 5 non-structural parts (idiv(7*28,39)=5).
local function nextSsPart(ship: any, ruleset: any): any
	-- XII.5b: build the 5 functional parts SOLAR FIRST as the hull supports each
	-- (supported = idiv(structural*28,39)), structural just-in-time; fixes #1916.
	local funcOrder = { "solar", "propulsion", "fuel", "habitation", "lifeSupport" }
	local function have(k: string): number return if ship ~= nil and ship[k] ~= nil then ship[k] else 0 end
	local structural = have("structural")
	local supported = idiv(structural * 28, 39)
	local funcBuilt = 0
	for _, k in ipairs(funcOrder) do
		if have(k) >= 1 then funcBuilt = funcBuilt + 1 end
	end
	if funcBuilt < #funcOrder and supported <= funcBuilt then return "structural" end
	for _, k in ipairs(funcOrder) do
		if have(k) < 1 then return k end
	end
	if structural < 7 then return "structural" end
	return nil
end

-- A76: a visible rival's launched ship makes THAT civ's capital the top march
-- target. Returns the capital city if explored, else nil. First launcher by order.
local function launchRushTarget(state: any, me: any, playerId: string, ruleset: any): any
	for _, pid in ipairs(state.playerOrder) do
		if pid ~= playerId then
			local p = state.players[pid]
			if p ~= nil and p.alive ~= false and p.spaceship ~= nil then
				local ship = p.spaceship
				if ship.launched ~= nil and ship.launched ~= 0 then
					local cap = government.capitalOf(state, pid, ruleset)
					if cap ~= nil and isExplored(me, state.map, cap.x, cap.y) then return cap end
				end
			end
		end
	end
	return nil
end

-- B24 twin: how many of the civ's OFFENSIVE units sit adjacent to (x, y).
local function attackersAdjacentTo(state: any, playerId: string, ruleset: any, x: number, y: number): number
	local n = 0
	for _, u in pairs(state.units) do
		local def = ruleset.units[u.type]
		if u.owner == playerId and def.attack > def.defense
			and chebyshev(state.map, u.x, u.y, x, y) <= 1 then
			n += 1
		end
	end
	return n
end

-- B24 twin: the per-unit odds gate (undefended = capture; else att >= gate*def).
local function assaultOddsOk(state: any, unit: any, x: number, y: number, ruleset: any, gatePct: number): boolean
	local defender = combat.bestDefender(state, x, y, ruleset)
	if defender == nil then
		return true
	end
	return combat.attackStrength(unit, ruleset) * 100 >= gatePct * combat.defenseStrength(state, defender, ruleset)
end

-- B26 twin: would stepping `dir` initiate an attack the doctrine gate FORBIDS?
-- True only when the step lands on an enemy-occupied tile AND the odds fail
-- `gate` (attack-INITIATION only; defending in place is never gated).
local function stepAttackBlocked(state: any, unit: any, dir: string, playerId: string, ruleset: any, gate: number): boolean
	local v = DIR_VECS[dir]
	if v == nil then
		return false
	end
	local nx = ((unit.x + v[1]) % state.map.width + state.map.width) % state.map.width
	local ny = unit.y + v[2]
	if ny < 0 or ny >= state.map.height then
		return false
	end
	local hostile = false
	for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
		if u.owner ~= playerId then
			hostile = true
		end
	end
	if not hostile then
		return false
	end
	return not assaultOddsOk(state, unit, nx, ny, ruleset, gate)
end

-- N3 (guard, @#741) twin: would stepping `dir` put a LAND unit onto a sea tile?
-- Decision-layer only; engine legality (A69 auto-load) is untouched. N3b relaxes it.
local function stepEntersSea(state: any, unit: any, dir: string, ruleset: any): boolean
	if ruleset.units[unit.type].domain ~= "land" then
		return false
	end
	local v = DIR_VECS[dir]
	if v == nil then
		return false
	end
	local nx = ((unit.x + v[1]) % state.map.width + state.map.width) % state.map.width
	local ny = unit.y + v[2]
	if ny < 0 or ny >= state.map.height then
		return false
	end
	return ruleset.terrain.terrains[state.map.tiles[ny * state.map.width + nx + 1].t].domain == "sea"
end

-- B23b twin: the nearest OWN city to a unit (deterministic sortIds walk).
local function nearestOwnCity(state: any, unit: any, playerId: string): any
	local best = nil
	local bestDist = 9999
	for _, cid in ipairs(combat.sortIds(state.cityOrder or {})) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId then
			local d = chebyshev(state.map, unit.x, unit.y, c.x, c.y)
			if d < bestDist then
				best = c
				bestDist = d
			end
		end
	end
	return best
end

-- B23b twin: is `uid` among the NEWEST `n` ids of `list`? (1-based len-n+1..len)
local function inNewestRank(list: { string }, n: number, uid: string): boolean
	for i = #list - n + 1, #list do
		if i >= 1 and list[i] == uid then
			return true
		end
	end
	return false
end

-- B23b twin: PHASED SCOUT ALLOCATION. Matches engine/ai.js. Quota keys are city
-- COUNTS (clamped to the max key); "1" is the opener. Fast = LAND moves>=2 units;
-- boats = sea. Threat veto by nearest own city. Absent table -> flat share.
local function isScout(state: any, playerId: string, ruleset: any, uid: string, S: any): boolean
	local u = state.units[uid]
	if u == nil or u.owner ~= playerId then
		return false
	end
	local mil = {}
	local fast = {}
	local sea = {}
	for _, id in ipairs(combat.sortIds(sortedKeys(state.units))) do
		local su = state.units[id]
		if su.owner == playerId then
			local def = ruleset.units[su.type]
			if def.attack > 0 then
				table.insert(mil, id)
			end
			if def.attack > 0 and def.moves >= 2 and def.domain == "land" then
				table.insert(fast, id)
			end
			if def.domain == "sea" then
				table.insert(sea, id)
			end
		end
	end
	local tableQ = ruleset.rules.aiScoutQuotaByCities
	local quota
	if tableQ == nil then
		quota = idiv(#mil * scoutShareOf(ruleset, S), 100)
	else
		local maxKey = 1
		for k in pairs(tableQ) do
			local nn = tonumber(k)
			if nn ~= nil and nn > maxKey then
				maxKey = nn
			end
		end
		local key = countCities(state, playerId)
		if key < 1 then
			key = 1
		end
		if key > maxKey then
			key = maxKey
		end
		local q = tableQ[tostring(key)]
		quota = if q == nil then 0 else q
	end
	local fastN = if ruleset.rules.aiFastScoutCount == nil then 0 else ruleset.rules.aiFastScoutCount
	local boatN = if ruleset.rules.aiBoatScoutCount == nil then 0 else ruleset.rules.aiBoatScoutCount
	if not (inNewestRank(mil, quota, uid) or inNewestRank(fast, fastN, uid) or inNewestRank(sea, boatN, uid)) then
		return false
	end
	if ruleset.rules.aiScoutThreatVeto == true then
		local c = nearestOwnCity(state, u, playerId)
		if c ~= nil and enemyNear(state, state.players[playerId], playerId, c.x, c.y, ruleset.rules.threatRadius) then
			return false
		end
	end
	return true
end

-- B21(c) twin: rush-buy a THREATENED own city's defender/walls/attacker when the
-- treasury sits above rules.aiBuyThreshold and the buy is affordable. One buy per
-- turn, cityOrder = deterministic. Matches engine/ai.js.
local function rushBuyCommand(state: any, playerId: string, ruleset: any): any
	local me = state.players[playerId]
	local threshold = if ruleset.rules.aiBuyThreshold == nil then -1 else ruleset.rules.aiBuyThreshold
	if threshold < 0 or me.gold <= threshold then
		return nil
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId
			and enemyNear(state, me, playerId, city.x, city.y, ruleset.rules.threatRadius) then
			local prod = city.producing
			local def = nil
			if prod.kind == "building" and prod.id == "city-walls" then
				def = ruleset.buildings[prod.id]
			elseif prod.kind == "unit" and prod.id ~= "settlers" then
				local u = ruleset.units[prod.id]
				if u ~= nil and (u.attack > 0 or u.defense > 0) then
					def = u
				end
			end
			if def ~= nil then
				local missing = def.cost - city.shields
				if missing > 0 then
					local price = missing * ruleset.rules.buyGoldPerShield
					if me.gold >= price then
						return { type = "buy", playerId = playerId, cityId = cid }
					end
				end
			end
		end
	end
	-- §14 surplus lever: with a large treasury (> aiSurplusBuyThreshold), rush a
	-- non-defensive build -- a settler or an offensive unit -- so the AI spends
	-- its hoard. kind "unit" only (never wonders/buildings, never ss-parts until
	-- the xii5b GO; wonders never gold-rushed). cityOrder-deterministic, 1/turn.
	local surplus = if ruleset.rules.aiSurplusBuyThreshold == nil then -1 else ruleset.rules.aiSurplusBuyThreshold
	if surplus >= 0 and me.gold > surplus then
		local committed = nil -- XII.5b Q5: lazily computed (per player)
		for _, cid in ipairs(state.cityOrder or {}) do
			local city = state.cities[cid]
			if city ~= nil and city.owner == playerId then
				local prod = city.producing
				if prod.kind == "ss-part" then
					-- XII.5b Q5: a space-COMMITTED civ rushes its CURRENT ss-part (#1901
					-- unlocks here). Apollo is a WONDER -- NEVER gold-rushed (#1899).
					if committed == nil then committed = spaceCommitted(state, playerId, ruleset) end
					if committed then
						local part = ruleset.rules.ssParts[prod.id]
						if part ~= nil then
							local missing = part.cost - city.shields
							if missing > 0 then
								local rate = if ruleset.rules.buyGoldPerShieldSS == nil then ruleset.rules.buyGoldPerShield else ruleset.rules.buyGoldPerShieldSS
								if me.gold >= missing * rate then return { type = "buy", playerId = playerId, cityId = cid } end
							end
						end
					end
				elseif prod.kind == "unit" then
					local u = ruleset.units[prod.id]
					if u ~= nil and (prod.id == "settlers" or u.attack > 0) then
						local missing = u.cost - city.shields
						if missing > 0 then
							local price = missing * ruleset.rules.buyGoldPerShield
							if me.gold >= price then
								return { type = "buy", playerId = playerId, cityId = cid }
							end
						end
					end
				end
			end
		end
	end
	return nil
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

-- N3 twin: the best SEA unit the civ can build now (mirror of bestAttackerUnit;
-- attack>0 excludes the transport -- naval presence + scouts, not logistics).
local function bestSeaUnit(me: any, ruleset: any): string?
	local best, bestDef = nil, nil
	for _, id in ipairs(sortedKeys(ruleset.units)) do
		local def = ruleset.units[id]
		if def.domain == "sea" and def.attack > 0
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
		if def.domain == "land" and def.defense > 0 and def.barbOnly ~= true
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

-- N9b TWIN: a shallow city copy with one building appended — for valuing a
-- candidate via tech.cityEconOutput WITHOUT mutating the real city.
local function withBuilding(city: any, id: string): any
	local clone = {}
	for k, v in pairs(city) do
		clone[k] = v
	end
	local b = if city.buildings == nil then {} else city.buildings
	local nb = setmetatable({}, statehash.ARRAY_MT)
	for i = 1, #b do
		table.insert(nb, b[i])
	end
	table.insert(nb, id)
	clone.buildings = nb
	return clone
end

-- N9b TWIN of ai.js bestPaybackBuilding: the lowest-payback buildable building
-- under pbMax (tie-break lowest cost then catalog order), payback via the shared
-- cityEconOutput. Zero-delta (non-yield) buildings skipped (R2). id or nil.
local function bestPaybackBuilding(state: any, city: any, me: any, ruleset: any, pbMax: number): string?
	local taxRate = if me.taxRate == nil then ruleset.rules.defaultTaxRate else me.taxRate
	local sciRate = if me.sciRate == nil then ruleset.rules.defaultSciRate else me.sciRate
	local perSpecialist = ruleset.rules.specialistOutput
	local base = tech.cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset)
	local baseEcon = base.gold + base.bulbs
	local best = nil
	local bestPayback = 0
	local bestCost = 0
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
			local eco = tech.cityEconOutput(state, withBuilding(city, id), taxRate, sciRate, perSpecialist, ruleset)
			local delta = (eco.gold + eco.bulbs) - baseEcon
			if delta <= 0 then
				skip = true
			else
				local payback = idiv(def.cost, delta)
				if payback >= pbMax then
					skip = true
				elseif best == nil or payback < bestPayback
					or (payback == bestPayback and def.cost < bestCost)
					or (payback == bestPayback and def.cost == bestCost and id < best) then
					best = id
					bestPayback = payback
					bestCost = def.cost
				end
			end
		end
	end
	return best
end

-- N9b TWIN: is the civ already committed to a wonder somewhere (one-in-flight)?
local function civWonderInFlight(state: any, playerId: string): boolean
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId and c.producing ~= nil and c.producing.kind == "wonder" then
			return true
		end
	end
	return false
end

-- N9b TWIN: the wonder-drive's fallback target when no palace exists — the
-- highest-shield city, tie-break lowest cityId.
local function highestShieldCity(state: any, playerId: string, ruleset: any): any
	local best = nil
	local bestSh = -1
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == playerId then
			local sh = cities.cityYields(state, c, ruleset).shields
			if sh > bestSh or (sh == bestSh and (best == nil or cid < best.id)) then
				best = c
				bestSh = sh
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

-- B23 twin: a LAND tile with at least one SEA neighbour (8-dir).
local function isCoastal(state: any, x: number, y: number, ruleset: any): boolean
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	if ruleset.terrain.terrains[state.map.tiles[y * width + x + 1].t].domain ~= "land" then
		return false
	end
	for _, key in ipairs(DIR_KEYS) do
		local nx = x + DIR_VECS[key][1]
		if nx < 0 or nx >= width then
			if not wrapX then
				continue
			end
			nx = ((nx % width) + width) % width
		end
		local ny = y + DIR_VECS[key][2]
		if ny < 0 or ny >= height then
			continue
		end
		if ruleset.terrain.terrains[state.map.tiles[ny * width + nx + 1].t].domain == "sea" then
			return true
		end
	end
	return false
end

-- B23 twin: memoryless coastal step-preference (unexplored coastal land; hand by
-- unit-id parity picks the fork). null when no adjacent unexplored coast.
local function coastalScoutDir(state: any, unit: any, me: any, ruleset: any): string?
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	local cands = {}
	for _, key in ipairs(DIR_KEYS) do
		local nx = unit.x + DIR_VECS[key][1]
		if nx < 0 or nx >= width then
			if not wrapX then
				continue
			end
			nx = ((nx % width) + width) % width
		end
		local ny = unit.y + DIR_VECS[key][2]
		if ny < 0 or ny >= height then
			continue
		end
		if ruleset.terrain.terrains[state.map.tiles[ny * width + nx + 1].t].domain ~= "land" then
			continue
		end
		if isExplored(me, state.map, nx, ny) then
			continue
		end
		if not isCoastal(state, nx, ny, ruleset) then
			continue
		end
		table.insert(cands, key)
	end
	if #cands == 0 then
		return nil
	end
	local num = tonumber(string.sub(unit.id, 2))
	if num % 2 == 0 then
		return cands[1]
	end
	return cands[#cands]
end

-- B23 twin: the BFS ROUTER. Breadth-first over passable land; first unexplored
-- land tile reached (DIR_KEYS expansion order = the scan-order contract) returns
-- its first-step dir. Routes around bays. null when the landmass is fully charted.
local function bfsStepToNearestUnexplored(state: any, unit: any, me: any, ruleset: any): string?
	if me.explored == nil then
		return nil
	end
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	local visited = {}
	visited[unit.y * width + unit.x] = true
	local queue = { { x = unit.x, y = unit.y, first = nil } }
	local qi = 1
	while qi <= #queue do
		local cur = queue[qi]
		qi += 1
		for _, key in ipairs(DIR_KEYS) do
			local nx = cur.x + DIR_VECS[key][1]
			if nx < 0 or nx >= width then
				if not wrapX then
					continue
				end
				nx = ((nx % width) + width) % width
			end
			local ny = cur.y + DIR_VECS[key][2]
			if ny < 1 or ny >= height - 1 then
				continue
			end
			local idx = ny * width + nx
			if visited[idx] == true then
				continue
			end
			if ruleset.terrain.terrains[state.map.tiles[idx + 1].t].domain ~= "land" then
				continue
			end
			visited[idx] = true
			local first = if cur.first == nil then key else cur.first
			if me.explored[idx + 1] ~= 1 then
				return first
			end
			table.insert(queue, { x = nx, y = ny, first = first })
		end
	end
	return nil
end

-- B23 twin: the user's literal wall-follower (rules.aiExploreMode wallfollow).
-- Keeps water on a hand (parity); persisted heading unit.scoutDir. { dir, heading }.
local function wallFollowDir(state: any, unit: any, me: any, ruleset: any): any
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	local hand = if tonumber(string.sub(unit.id, 2)) % 2 == 0 then -1 else 1
	local function nbr(k: number): any
		local nx = unit.x + DIR_VECS[DIR_KEYS[k + 1]][1]
		if nx < 0 or nx >= width then
			if not wrapX then
				return nil
			end
			nx = ((nx % width) + width) % width
		end
		local ny = unit.y + DIR_VECS[DIR_KEYS[k + 1]][2]
		if ny < 1 or ny >= height - 1 then
			return nil
		end
		return { nx = nx, ny = ny, land = ruleset.terrain.terrains[state.map.tiles[ny * width + nx + 1].t].domain == "land" }
	end
	local h = if unit.scoutDir == nil then -1 else (table.find(DIR_KEYS, unit.scoutDir) :: number) - 1
	if h < 0 then
		for k = 0, 7 do
			local n = nbr(k)
			if n ~= nil and not n.land then
				h = ((k + hand * 2) % 8 + 8) % 8
				break
			end
		end
		if h < 0 then
			h = 0
		end
	end
	local startk = ((h - hand * 2) % 8 + 8) % 8
	for i = 0, 7 do
		local k = ((startk + hand * i) % 8 + 8) % 8
		local n = nbr(k)
		if n ~= nil and n.land then
			return { dir = DIR_KEYS[k + 1], heading = DIR_KEYS[k + 1] }
		end
	end
	return { dir = nil, heading = nil }
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
				local current = if city.workers ~= nil then #city.workers
					else (if city.pop < #cands then city.pop else #cands)
				-- B22: ESCALATE -- one more entertainer each disorder turn (the old
				-- fixed pop-1 cap stalled at one, drowning cities needing 2+); the
				-- auto-revert still snaps a recovering city back, so no flap.
				local target = current - 1
				if target >= 0 and #cands > 0 then
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
-- D3: the AI diplomacy step (twin of engine/ai.js). Returns ONE diplomacy command
-- per call; doneSet tracks processed rivals. Declare only fires peace->war (never
-- double-issues on the default-war baseline).
local function diplomacyStep(state: any, playerId: string, ruleset: any, doneSet: any): any
	local d = ruleset.rules.diplomacy
	if d == nil then return nil end
	for _, other in ipairs(state.playerOrder) do
		if other == playerId or doneSet[other] then
			continue
		end
		local op = state.players[other]
		if op == nil or op.alive == false or other == "barb" or not diplomacy.metOf(state, playerId, other) then
			doneSet[other] = true
			continue
		end
		doneSet[other] = true
		local rel = diplomacy.relationOf(state, playerId, other)
		local entry = if state.relations == nil then nil else state.relations[diplomacy.pairKey(playerId, other)]
		if entry ~= nil and entry.offer ~= nil and entry.offer.from == other then
			local accept = aiDiplomacy.scorePeaceAccept(state, playerId, other, ruleset) > d.peaceAcceptThreshold
			return { type = "diplomacy", kind = if accept then "accept" else "reject", playerId = playerId, target = other }
		end
		if rel == "peace" and aiDiplomacy.scoreWarIntent(state, playerId, other, ruleset) > d.warIntentThreshold then
			return { type = "diplomacy", kind = "declare", playerId = playerId, target = other }
		end
		-- §14 F1: the reject cooldown stops the offer/reject spam loop (reject
		-- clears the offer but keeps war). Gate on rules.diplomacy.offerCooldown.
		local cooldown = if d.offerCooldown == nil then 0 else d.offerCooldown
		local offerCooled = entry == nil or entry.offerRejectedTurn == nil
			or state.turn - entry.offerRejectedTurn >= cooldown
		if rel == "war" and (entry == nil or entry.offer == nil) and offerCooled
			and aiDiplomacy.scorePeaceAccept(state, playerId, other, ruleset) > d.peaceAcceptThreshold then
			return { type = "diplomacy", kind = "offer", playerId = playerId, target = other, terms = { peace = true } }
		end
	end
	return nil
end

-- xiv-ai §13 (regency economics): the deficit ladder -- cheapest-first levers to
-- stop a gold drain (net income < 0) before it bleeds to 0 and disorder. Runs for
-- ALL stances. Step 1: raise tax one step, taking it from SCIENCE not luxury
-- (luxury unchanged = no new disorder; the disorder-free cap = science exhausted).
local function deficitTaxBump(state: any, playerId: string, ruleset: any): any
	local me = state.players[playerId]
	local gov = ruleset.governments[if me.government == nil then "despotism" else me.government]
	local cap = if gov.maxRate == nil then 60 else gov.maxRate
	local step = if ruleset.rules.taxBumpStep == nil then 10 else ruleset.rules.taxBumpStep
	local tax = if me.taxRate == nil then ruleset.rules.defaultTaxRate else me.taxRate
	local sci = if me.sciRate == nil then ruleset.rules.defaultSciRate else me.sciRate
	local lux = 100 - tax - sci
	local raise = step
	if cap - tax < raise then raise = cap - tax end
	if sci < raise then raise = sci end -- never cut luxury (would risk disorder)
	if raise <= 0 then return nil end -- tax maxed or no science to give -> next lever
	return { type = "setRates", playerId = playerId, tax = tax + raise, sci = sci - raise, lux = lux }
end

-- Step 2: when the rate lever is spent, pull one worked citizen in a pop>=5 city
-- into a taxman (flat gold). cityOrder scan = deterministic; one city per turn.
local function deficitTaxmen(state: any, playerId: string, ruleset: any): any
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId and city.pop >= 5 then
			local cands = cities.candidateTiles(state, city, ruleset)
			local worked = if city.workers ~= nil then #city.workers else (if city.pop < #cands then city.pop else #cands)
			local taxmen = if city.taxmen == nil then 0 else city.taxmen
			local scientists = if city.scientists == nil then 0 else city.scientists
			if worked >= 1 and worked + taxmen + scientists <= city.pop then
				local keep = setmetatable({}, statehash.ARRAY_MT)
				for i = 1, #cands do
					if #keep >= worked - 1 then
						break
					end
					table.insert(keep, cands[i].idx)
				end
				return { type = "setWorkers", playerId = playerId, cityId = cid, workers = keep, taxmen = taxmen + 1, scientists = scientists }
			end
		end
	end
	return nil
end

-- Step 3: rate + specialists spent -- switch to a government with a higher rate
-- cap if one is available and we are not mid-revolution. Reuses the monotonic
-- government picker; only fires when it yields a strictly better cap.
local function deficitGovernment(state: any, playerId: string, ruleset: any, S: any): any
	local me = state.players[playerId]
	if me.revolutionTurns ~= nil then return nil end
	local cur = if me.government == nil then "despotism" else me.government
	local curCap = if ruleset.governments[cur].maxRate == nil then 60 else ruleset.governments[cur].maxRate
	local want = pickGovernment(state, playerId, ruleset, S)
	if want == cur then return nil end
	local wantCap = if ruleset.governments[want].maxRate == nil then 60 else ruleset.governments[want].maxRate
	if wantCap > curCap and govRank(want) > govRank(cur) then
		return { type = "setGovernment", playerId = playerId, government = want }
	end
	return nil
end

local function pickCommand(state: any, playerId: string, ruleset: any, done: any, stance: any): any
	local me = state.players[playerId]
	local effStance = if stance ~= nil then stance else me.stance
	local S = stanceOf(effStance) -- balanced (or omitted/absent) = the identity
	local marchR = marchRadiusOf(ruleset, S) -- B13f: sweepable via rules.json

	if done.happiness ~= true then
		done.happiness = true -- one assignment change per turn — gradual
		local cmd = happinessCommand(state, playerId, ruleset)
		if cmd ~= nil then
			return cmd
		end
	end

	-- D3: the AI diplomacy step — negotiate with met rivals.
	if done.diplo == nil then
		done.diplo = {}
	end
	local diploCmd = diplomacyStep(state, playerId, ruleset, done.diplo)
	if diploCmd ~= nil then
		return diploCmd
	end

	if (me.researching == "" or me.researching == nil) and done.research ~= true then
		done.research = true
		local avail = tech.availableTechs(state, playerId, ruleset)
		if #avail > 0 then
			-- beeline Monarchy first (Civ 1 AIs rush a government)
			local monarchyPath = {}
			if table.find(me.techs, "monarchy") == nil then
				markTechPath(ruleset, "monarchy", monarchyPath)
			end
			-- B21(b): also pull the earliest attacker tech into the beeline while the
			-- civ has no offensive unit yet -- knob-weighted (rules.aiAttackerTechWeight;
			-- 0 = the old monarchy-only rush). The weight discounts attacker-path tech
			-- levels so a higher knob rushes them ahead of monarchy.
			local atkWeight = if ruleset.rules.aiAttackerTechWeight == nil then 0 else ruleset.rules.aiAttackerTechWeight
			local atkPath = {}
			if atkWeight > 0 and bestAttackerUnit(me, ruleset) == nil then
				local at = attackerTech(ruleset)
				if at ~= "" then
					markTechPath(ruleset, at, atkPath)
				end
			end
			-- N3: naval-tech beeline, AFTER the government beeline (economy first):
			-- only once monarchy is secured and the civ has no ship. No level discount.
			local navPath = {}
			if table.find(me.techs, "monarchy") ~= nil and bestSeaUnit(me, ruleset) == nil
				and navyPriorityOf(state, playerId, ruleset) then
				local nt = seaTech(ruleset)
				if nt ~= "" then
					markTechPath(ruleset, nt, navPath)
				end
			end
			-- XII.5b Q3: a committed civ prefers the space-flight prereq closure and
			-- SUPERSEDES monarchy/attacker/nav; empty-onPath falls back to all (escape).
			local spacePath = {}
			if spaceCommitted(state, playerId, ruleset) then
				local apolloTech = ruleset.wonders[ruleset.rules.ssFlight.gateWonder].tech
				if apolloTech ~= nil and apolloTech ~= "" then markTechPath(ruleset, apolloTech, spacePath) end
				local parts = ruleset.rules.ssParts
				for k in pairs(parts) do markTechPath(ruleset, parts[k].tech, spacePath) end
			end
			local committedSpace = next(spacePath) ~= nil
			local pool = avail
			local onPath = {}
			for _, id in ipairs(avail) do
				if spacePath[id] == true then
					table.insert(onPath, id)
				elseif not committedSpace and (monarchyPath[id] == true or atkPath[id] == true or navPath[id] == true) then
					table.insert(onPath, id)
				end
			end
			if #onPath > 0 then
				pool = onPath
			end
			local best = pool[1]
			local bestEff = ruleset.techs[best].level - (if atkPath[best] == true then atkWeight else 0)
			for _, id in ipairs(pool) do
				local eff = ruleset.techs[id].level - (if atkPath[id] == true then atkWeight else 0)
				if eff < bestEff then
					best = id
					bestEff = eff
				end
			end
			return { type = "setResearch", playerId = playerId, tech = best }
		end
	end

	-- xiv-ai §13: the deficit ladder -- BEFORE the science-max branch, for ALL
	-- stances. Net income < 0 and gold below the cushion -> climb tax-bump ->
	-- taxmen -> government; mark done.rates to suppress science-max for a
	-- struggling civ. Non-deficit civs skip this untouched.
	if done.rates ~= true then
		local inc = tech.playerIncome(state, playerId, ruleset)
		local net = inc.gold - inc.maintenance
		local cushion = if ruleset.rules.deficitGoldCushion == nil then 3 else ruleset.rules.deficitGoldCushion
		if net < 0 and me.gold < cushion * (-net) then
			done.rates = true
			local bump = deficitTaxBump(state, playerId, ruleset)
			if bump ~= nil then return bump end
			local tm = deficitTaxmen(state, playerId, ruleset)
			if tm ~= nil then return tm end
			local gv = deficitGovernment(state, playerId, ruleset, S)
			if gv ~= nil then return gv end
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

	-- Government re-eval (specs/government-reeval.md): advance toward the stance's
	-- govTarget (Despotism -> Monarchy -> Republic), only ever UP the rank ladder
	-- (no thrash). Skips once at Republic (nothing higher targeted in v1).
	if done.government ~= true and me.revolutionTurns == nil then
		done.government = true
		local cur = if me.government == nil then "despotism" else me.government
		if govRank(cur) < GOV_RANK.republic then
			local want = pickGovernment(state, playerId, ruleset, S)
			if want ~= cur and govRank(want) > govRank(cur) then
				return { type = "setGovernment", playerId = playerId, government = want }
			end
		end
	end

	-- B21(c): rush-buy a threatened city's military production (one per turn)
	if done.buy ~= true then
		done.buy = true
		local cmd = rushBuyCommand(state, playerId, ruleset)
		if cmd ~= nil then
			return cmd
		end
	end

	-- A76: launch a completed, un-launched ship — the win condition. Gated on the
	-- race being open (Apollo + techs), so this is dormant until a civ reaches space.
	if done.launch ~= true and apolloReady(state, me, ruleset) then
		done.launch = true
		local ship = me.spaceship
		local launched = ship ~= nil and ship.launched ~= nil and ship.launched ~= 0
		if ship ~= nil and not launched and nextSsPart(ship, ruleset) == nil then
			return { type = "launchShip", playerId = playerId }
		end
	end

	-- N3: naval doctrine, computed once (empire-wide). Ships in COASTAL cities
	-- once the civ has a land core, up to 1 per coastal city capped at
	-- rules.aiNavyTargetCap. The ships range as B23b boat-scouts.
	local navyPriority = navyPriorityOf(state, playerId, ruleset)
	local navySeaUnit = bestSeaUnit(me, ruleset)
	local navyAfterLand = if ruleset.rules.aiNavyAfterLandUnits == nil then 3 else ruleset.rules.aiNavyAfterLandUnits
	local navyCap = if ruleset.rules.aiNavyTargetCap == nil then 4 else ruleset.rules.aiNavyTargetCap
	local navyTarget = 0
	if navyPriority and navySeaUnit ~= nil then
		local coastal = 0
		for _, cid in ipairs(state.cityOrder or {}) do
			local c = state.cities[cid]
			if c ~= nil and c.owner == playerId and isCoastal(state, c.x, c.y, ruleset) then
				coastal += 1
			end
		end
		navyTarget = if coastal < navyCap then coastal else navyCap
	end
	local navyWant = navyPriority and navySeaUnit ~= nil
		and countLandMilitary(state, playerId, ruleset) >= navyAfterLand
		and countShips(state, playerId, ruleset) < navyTarget

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
				-- N9b HOIST (Finding-3 fix): the builder wonder-drive is CAPITAL-INTENT, a
				-- FIRST-CLASS check ABOVE the garrison/saturation cascade. Gate = NOT-THREATENED
				-- alone (min-garrison-1 never fired: militia scout away -> 0 defenders at the
				-- wonder window); a menaced capital reverts via the cascade. Persist = keep the id.
				local wonderDriven = false
				if S.wonderDrive == true and not threatened then
					local cap = government.capitalOf(state, playerId, ruleset)
					local driveCity = if cap ~= nil then cap else highestShieldCity(state, playerId, ruleset)
					if driveCity ~= nil and driveCity.id == cid
						and cities.cityYields(state, city, ruleset).shields >= BUILD_LEVER.wonderMinShields then
						local held = nil
						if city.producing.kind == "wonder"
							and (state.wonders == nil or state.wonders[city.producing.id] == nil) then
							held = city.producing.id
						end
						if held ~= nil then
							want = { kind = "wonder", id = held } -- persist own wonder
							wonderDriven = true
						elseif not civWonderInFlight(state, playerId) then
							local w = nextWonder(state, me, ruleset)
							if w ~= nil then
								want = { kind = "wonder", id = w } -- start new
								wonderDriven = true
							end
						end
					end
				end
				-- XII.5: the space victory drive is a FIRST-CLASS capital intent (mirrors the N9b
				-- wonder-drive hoist above) -- an eligible committed civ builds Apollo, then ship
				-- parts, in its CAPITAL, ABOVE the garrison/saturation cascade, so it fires even
				-- when the capital garrison roamed off (the 0/12 gap). not threatened = the
				-- frontier-safety guard (spec: build Apollo, then defend). End-tier eligibility
				-- gates it, so early/mid/crafted never reach it.
				if not wonderDriven and not threatened and spaceDriveOn(ruleset, effStance) and spaceDriveEligible(state, me, ruleset) then
					local scap = government.capitalOf(state, playerId, ruleset)
					if scap ~= nil and scap.id == cid then
						local ship = me.spaceship
						local launched = ship ~= nil and ship.launched ~= nil and ship.launched ~= 0
						if not launched then
							local part = nextSsPart(ship, ruleset)
							if not cities.wonderActive(state, ruleset.rules.ssFlight.gateWonder, ruleset) then
								want = { kind = "wonder", id = ruleset.rules.ssFlight.gateWonder }
								wonderDriven = true
							elseif part ~= nil then
								want = { kind = "ss-part", id = part }
								wonderDriven = true
							end
						end
					end
				end
				if not wonderDriven and defenders >= wantDefenders then
					-- §40: never queue a settler where completing it self-disbands the city
					-- (pop <= its pop cost) — the AI guard (a human MAY, deliberately).
					local settlerPopCost = if ruleset.units["settlers"].popCost == nil then 0 else ruleset.units["settlers"].popCost
					if city.pop > settlerPopCost and countSettlers(state, playerId) < S.settlerBase + idiv(countCities(state, playerId), S.settlerDiv) then
						want = { kind = "unit", id = "settlers" }
					else
						-- B13g: a THREATENED city walls up first (masonry known, not
						-- already walled) before any other building.
						local wallsDef = ruleset.buildings["city-walls"]
						local canWall = threatened and wallsDef ~= nil
							and (city.buildings == nil or table.find(city.buildings, "city-walls") == nil)
							and (wallsDef.tech == "" or table.find(me.techs, wallsDef.tech) ~= nil)
						-- B21(a): the offensive army gets a REAL build-order slot -- right after
						-- walls, ABOVE buildings/wonders (the re-baseline found attackers = 0
						-- because the old branch sat behind them, which never run dry). Empire-
						-- wide target = a standing army; sweepable via rules.attackerPerCity/Base.
						local attacker = bestAttackerUnit(me, ruleset)
						local armyTarget = countCities(state, playerId) * attackerPerCityOf(ruleset, S)
							+ attackerBaseOf(ruleset, S)
						local underArmy = attacker ~= nil and countAttackers(state, playerId, ruleset) < armyTarget
						-- N9 / stance-mix v1: the economy pick for the dead-last fallback PLUS the
						-- defending-builder RESERVE (defBuild). econReserve comes from the STANCE
						-- (S.econReserve): balanced 0 = inert (identity), the builder stance 99.
						-- Wonders concentrate in the capital (pop-2+) so they complete. Matches engine/ai.js.
						local econBuilding = stanceBuilding(city, me, ruleset, S)
						local econWonder = if econBuilding == nil then nextWonder(state, me, ruleset) else nil
						local econItem = if econBuilding ~= nil then { kind = "building", id = econBuilding } elseif econWonder ~= nil then { kind = "wonder", id = econWonder } else nil
						local econReserve = if S.econReserve == nil then 0 else S.econReserve
						local builtCount = if city.buildings == nil then 0 else #city.buildings
						local defBuild = nil
						if S.defendFirst == true and econReserve > 0 and builtCount < econReserve then
							local cap = government.capitalOf(state, playerId, ruleset)
							local isCap = cap ~= nil and cap.id == cid
							local pw = if ((isCap and builtCount >= 2) or econBuilding == nil) then nextWonder(state, me, ruleset) else nil
							defBuild = if (isCap and builtCount >= 2 and pw ~= nil) then { kind = "wonder", id = pw } elseif econBuilding ~= nil then { kind = "building", id = econBuilding } elseif pw ~= nil then { kind = "wonder", id = pw } else nil
						end
						if canWall then
							want = { kind = "building", id = "city-walls" }
						elseif defBuild ~= nil then
							want = defBuild
						elseif underArmy then
							want = { kind = "unit", id = attacker }
						elseif navyWant and isCoastal(state, city.x, city.y, ruleset) then
							want = { kind = "unit", id = navySeaUnit }
						elseif econItem ~= nil then
							want = econItem
						elseif defenders >= 3
							or countMilitary(state, playerId, ruleset) >= countCities(state, playerId) * S.armyCapPerCity + S.armyCapBase then
							want = { kind = "unit", id = "settlers" }
						end

						-- === N9b build-priority (spec a8fe1af) — past the garrison floor ===
						-- R1 stickiness: an in-progress, still-legal building/wonder is KEPT (never
						-- re-decided to a unit on flutter; enemyNear the only interrupt, garrison-gated).
						-- The builder wonder-drive is hoisted above the cascade (Finding-3 fix).
						local inProgId = city.producing.id
						local inProgKept = (city.producing.kind == "wonder"
								and (state.wonders == nil or state.wonders[inProgId] == nil))
							or (city.producing.kind == "building"
								and (city.buildings == nil or table.find(city.buildings, inProgId) == nil))
						if inProgKept then
							want = city.producing -- persist (R1)
						end
						if want.kind == "unit" and not threatened then
							-- the lever (R3: defers to defBuild — if defBuild fired, want is not a unit)
							local pbMax = idiv(BUILD_LEVER.pbMax * S.pbMult, 100)
							local pick = bestPaybackBuilding(state, city, me, ruleset, pbMax)
							if pick ~= nil then
								want = { kind = "building", id = pick }
							end
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
			-- §14 F2: a unit zoc-blocked 3x this turn is dropped (skip; re-plans next turn)
			if unit ~= nil and unit.owner == playerId and unit.moves > 0 and unit.working == nil
				and not (unit.zocBlocks ~= nil and unit.zocBlocks >= 3) then
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
						-- §12: BFS around inlets; greedy is the safe floor, then HOLD.
						local dir = bfsStepToward(state, me, playerId, unit, site.x, site.y, ruleset)
						if dir == nil then
							dir = safeDirToward(state, me, playerId, unit, site.x, site.y, ruleset)
						end
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
				local exploreMode = if ruleset.rules.aiExploreMode == nil then "bfs" else ruleset.rules.aiExploreMode
				local scouting = isScout(state, playerId, ruleset, uid, S)
				local home = combat.cityAt(state, unit.x, unit.y)
				if home ~= nil and home.owner == playerId and not unit.fortified then
					local guards = 0
					for _, g in ipairs(combat.unitsAt(state, unit.x, unit.y)) do
						if g.owner == playerId and ruleset.units[g.type].attack > 0 then
							guards += 1
						end
					end
					local need = if enemyNear(state, me, playerId, home.x, home.y, ruleset.rules.threatRadius) then 2 else 1
					-- B23: a scout departs to range only if the city keeps another
					-- defender (>= 2 guards); a sole defender stays. greedy = pre-B23.
					local scoutDepart = scouting and exploreMode ~= "greedy" and guards >= 2
					if guards <= need and not scoutDepart then
						return { type = "fortify", playerId = playerId, unitId = uid }
					end
				end
				-- B23: a scout ranges the fog by rules.aiExploreMode -- greedy (pre-B23
				-- nearest-fog), bfs (router through explored land around bays), or
				-- wallfollow (stored-heading hand-rule); coastal fast-path when adjacent.
				if scouting then
					local sdir = nil
					local heading = nil
					if exploreMode == "greedy" then
						sdir = towardUnexplored(state, unit, me)
					else
						if ruleset.rules.aiCoastFollow ~= false and isCoastal(state, unit.x, unit.y, ruleset) then
							sdir = coastalScoutDir(state, unit, me, ruleset)
						end
						if sdir == nil then
							if exploreMode == "wallfollow" then
								local wf = wallFollowDir(state, unit, me, ruleset)
								sdir = wf.dir
								heading = wf.heading
							else
								sdir = bfsStepToNearestUnexplored(state, unit, me, ruleset)
							end
						end
					end
					if sdir ~= nil and not stepEntersSea(state, unit, sdir, ruleset) then
						local cmd = { type = "moveUnit", playerId = playerId, unitId = uid, dir = sdir }
						if heading ~= nil then
							cmd.heading = heading
						end
						return cmd
					end
				end
				-- B24: OFFENSIVE units form derived army groups -- converge on the
				-- nearest known enemy city, HOLD at its edge until massSize attackers
				-- are massed, then assault together (each strike per-unit odds-gated
				-- under best-of-three; one-roll masses with no gate). marchR > 0 only.
				local attDef = ruleset.units[unit.type]
				-- B26: the doctrine gate for THIS unit -- offensive (attack>defense) by
				-- oddsGate (one-roll 0 = mass); defender-type by defenderGate (one-roll 1 =
				-- even-or-better). Attack-INITIATION is gated for EVERY unit (#646).
				local D = warDoctrineOf(ruleset)
				local engageGatePct = if attDef.attack > attDef.defense then D.oddsGatePct else D.defenderGatePct
				local enemyViable = enemy ~= nil
					and assaultOddsOk(state, unit, enemy.x, enemy.y, ruleset, engageGatePct)
				if marchR > 0 and attDef.attack > attDef.defense then
					-- A76: a visible rival launch redirects the assault to that civ's
					-- capital (destroying it kills the ship); else the nearest known city.
					local rushCity = launchRushTarget(state, me, playerId, ruleset)
					local targetCity = if rushCity ~= nil then rushCity else nearestKnownEnemyCity(state, unit, playerId)
					if targetCity ~= nil then
						local dist = chebyshev(state.map, unit.x, unit.y, targetCity.x, targetCity.y)
						if dist <= 1 then
							local massed = attackersAdjacentTo(state, playerId, ruleset, targetCity.x, targetCity.y)
							if massed >= D.massSize
								and assaultOddsOk(state, unit, targetCity.x, targetCity.y, ruleset, D.oddsGatePct) then
								local adir = dirToward(state.map, unit.x, unit.y, targetCity.x, targetCity.y)
								if adir ~= nil and not stepEntersSea(state, unit, adir, ruleset) then
									return { type = "moveUnit", playerId = playerId, unitId = uid, dir = adir }
								end
							end
							return { type = "wait", playerId = playerId, unitId = uid }
						end
						local cdir = dirToward(state.map, unit.x, unit.y, targetCity.x, targetCity.y)
						if cdir ~= nil then
							local v = DIR_VECS[cdir]
							local nx = ((unit.x + v[1]) % state.map.width + state.map.width) % state.map.width
							local ny = unit.y + v[2]
							local blocked = false
							for _, u in ipairs(combat.unitsAt(state, nx, ny)) do
								if u.owner ~= playerId then
									blocked = true
								end
							end
							if blocked and not assaultOddsOk(state, unit, nx, ny, ruleset, D.oddsGatePct) then
								return { type = "wait", playerId = playerId, unitId = uid }
							end
							if not stepEntersSea(state, unit, cdir, ruleset) then
								return { type = "moveUnit", playerId = playerId, unitId = uid, dir = cdir }
							end
						end
					end
				end
				-- A40: defensive never marches out (radius 0), aggressive ranges
				-- wider; balanced keeps the historical 8 — byte-identical.
				if enemy ~= nil and enemyViable and marchR > 0 and chebyshev(state.map, unit.x, unit.y, enemy.x, enemy.y) <= marchR then
					local dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y)
					if dir ~= nil and not stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGatePct)
						and not stepEntersSea(state, unit, dir, ruleset) then
						return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
					end
				end
				local escortR = if S.escortRadiusPct == nil then 100 else S.escortRadiusPct
				local ward = nearestUnguardedSettler(state, unit, playerId, ruleset, idiv(10 * escortR, 100))
				if ward ~= nil then
					if chebyshev(state.map, unit.x, unit.y, ward.x, ward.y) <= 1 then
						return { type = "wait", playerId = playerId, unitId = uid }
					end
					local dir = dirToward(state.map, unit.x, unit.y, ward.x, ward.y)
					if dir ~= nil and not stepEntersSea(state, unit, dir, ruleset) then
						return { type = "moveUnit", playerId = playerId, unitId = uid, dir = dir }
					end
				end
				local dir = nil
				-- B26: march on a known enemy only toward an ODDS-VIABLE target; a
				-- defender-type unit (attack<=defense) with nothing viable to strike HOLDS
				-- THE LINE (fortify) instead of a losing sortie. Offensive units keep
				-- roaming/exploring the fog (defensive stance, radius 0, only explores).
				if enemy ~= nil and enemyViable and marchR > 0 then
					dir = dirToward(state.map, unit.x, unit.y, enemy.x, enemy.y)
				elseif attDef.attack <= attDef.defense then
					if not unit.fortified then
						return { type = "fortify", playerId = playerId, unitId = uid }
					end
				else
					dir = towardUnexplored(state, unit, me)
				end
				-- B26: never let a fallback/explore step become an un-gated attack.
				if dir ~= nil and (stepAttackBlocked(state, unit, dir, playerId, ruleset, engageGatePct)
					or stepEntersSea(state, unit, dir, ruleset)) then
					dir = nil
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
	-- §14 F2: a fresh turn = re-plan -- clear last turn's zoc-block tallies.
	for _, uid in ipairs(sortedKeys(state.units)) do
		local u = state.units[uid]
		if u.owner == playerId and u.zocBlocks ~= nil then u.zocBlocks = nil end
	end
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
			-- §14 F2: a successful move breaks the consecutive-zoc streak
			if cmd.type == "moveUnit" then
				local mu = state.units[cmd.unitId]
				if mu ~= nil and mu.zocBlocks ~= nil then mu.zocBlocks = nil end
			end
			if eventsOut ~= nil then
				for _, e in ipairs(res.events) do
					table.insert(eventsOut, e)
				end
			end
		elseif cmd.type == "moveUnit" and res.reason == "zoc" then
			-- §14 F2: count consecutive zoc rejects; pickCommand drops at 3
			local bu = state.units[cmd.unitId]
			if bu ~= nil then bu.zocBlocks = (if bu.zocBlocks == nil then 0 else bu.zocBlocks) + 1 end
		end
	end
	updateSpaceCityRecord(state, playerId, ruleset) -- danger-abandon: record city count for next turn
	return state
end

return {
	runAiTurn = runAiTurn,
	pickCommand = pickCommand,
	goodCitySpot = goodCitySpot,
}
