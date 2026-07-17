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
	balanced = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 0 },
	defensive = { marchRadiusPct = 0, garrisonAlways2 = true, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "city-walls", improveFirst = nil, sciRates = false, attackerPerCityPct = 0, attackerBasePct = 0, scoutSharePct = 40, econReserve = 0 },
	aggressive = { marchRadiusPct = 175, garrisonAlways2 = false, armyCapPerCity = 6, armyCapBase = 8, settlerBase = 2, settlerDiv = 2, buildPriority = nil, improveFirst = nil, sciRates = false, attackerPerCityPct = 200, attackerBasePct = 100, scoutSharePct = 150, econReserve = 0 },
	science = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 2, settlerDiv = 2, buildPriority = "library", improveFirst = nil, sciRates = true, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 99 },
	growth = { marchRadiusPct = 100, garrisonAlways2 = false, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 3, settlerDiv = 1, buildPriority = "granary", improveFirst = "irrigate", sciRates = false, attackerPerCityPct = 100, attackerBasePct = 0, scoutSharePct = 100, econReserve = 99 },
	builder = { marchRadiusPct = 80, garrisonAlways2 = true, armyCapPerCity = 4, armyCapBase = 4, settlerBase = 3, settlerDiv = 1, buildPriority = nil, improveFirst = "irrigate", sciRates = true, attackerPerCityPct = 0, attackerBasePct = 0, scoutSharePct = 80, econReserve = 99, defendFirst = true },
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
			local pool = avail
			local onPath = {}
			for _, id in ipairs(avail) do
				if monarchyPath[id] == true or atkPath[id] == true or navPath[id] == true then
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

	-- B21(c): rush-buy a threatened city's military production (one per turn)
	if done.buy ~= true then
		done.buy = true
		local cmd = rushBuyCommand(state, playerId, ruleset)
		if cmd ~= nil then
			return cmd
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
					local targetCity = nearestKnownEnemyCity(state, unit, playerId)
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
				local ward = nearestUnguardedSettler(state, unit, playerId, ruleset, 10)
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
