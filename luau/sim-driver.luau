--!strict
-- Luau twin of test/sim-driver.js's STATE-TRAJECTORY core (phase 5, P5-8):
-- the all-AI round loop with the deterministic chaos stream — everything
-- that TOUCHES STATE, in exact JS order. Deliberately NOT ported: the
-- invariant/deep-audit/artifact layers (pure verification, no state writes;
-- they stay JS-side — the goldens are the cross-language verdict).
-- RNG DISCIPLINE: the chaos stream (seedRng(seed + 999331)) is part of the
-- golden contract — every roll() JS consumes is consumed here, INCLUDING on
-- paths that then return null.
-- EXPORTS (stable): runSim(opts) -> { state, rounds, checkpoints, finalHash },
-- SIM_ROSTER.

local rng = require("./rng")
local statehash = require("./statehash")
local engineModule = require("./index")
local aiModule = require("./ai")
local cities = require("./cities")
local combat = require("./combat")

local SIM_ROSTER = {
	{ id = "p1", name = "Romans", color = "#3b7dd8", civ = "romans" },
	{ id = "p2", name = "Egyptians", color = "#d8b13b", civ = "egyptians" },
	{ id = "p3", name = "Greeks", color = "#3bd87d", civ = "greeks" },
	{ id = "p4", name = "Zulus", color = "#d84a3b", civ = "zulus" },
	{ id = "p5", name = "Babylonians", color = "#9b59d0", civ = "babylonians" },
	{ id = "p6", name = "Chinese", color = "#d07f3b", civ = "chinese" },
	{ id = "p7", name = "Mongols", color = "#4fd0c9", civ = "mongols" },
}

local RATE_COMBOS = {
	{ 40, 60, 0 }, { 60, 40, 0 }, { 30, 50, 20 }, { 50, 30, 20 }, { 20, 70, 10 }, { 10, 80, 10 },
}
local CHAOS_DIRS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local CHAOS_WORKS = { "irrigate", "mine", "fortress", "railroad", "mine" }
local CHAOS_NAMES = { "Chaosville", "Entropy", "Mayhem" }
local CHAOS_BASICS = { "militia", "settlers" }

local function sortedKeys(t: any): { string }
	local keys = {}
	for k in pairs(t) do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

local function ownCities(state: any, pid: string): { string }
	local out = {}
	for _, cid in ipairs(state.cityOrder) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == pid then
			table.insert(out, cid)
		end
	end
	return out
end

local function ownUnits(state: any, pid: string): { string }
	local out = {}
	for _, uid in ipairs(combat.sortIds(sortedKeys(state.units))) do
		if state.units[uid].owner == pid then
			table.insert(out, uid)
		end
	end
	return out
end

local function ownSettlers(state: any, pid: string): { string }
	local out = {}
	local spent = {}
	for _, uid in ipairs(combat.sortIds(sortedKeys(state.units))) do
		local u = state.units[uid]
		if u.owner == pid and u.type == "settlers" then
			if u.moves > 0 then
				table.insert(out, uid)
			else
				table.insert(spent, uid)
			end
		end
	end
	for _, uid in ipairs(spent) do
		table.insert(out, uid)
	end
	return out
end

-- roll() indexes below are the JS 0-based values +1 for table access; the
-- roll SEQUENCE is untouched.
local function pickChaosCommand(state: any, pid: string, roll: (number) -> number, ruleset: any): any
	local kind = roll(16)
	if kind == 13 then
		kind = 8
	elseif kind == 14 then
		kind = 10
	elseif kind == 15 then
		kind = 11
	end
	if kind == 0 or kind == 7 then -- buy, double weight
		local cs = ownCities(state, pid)
		if #cs == 0 then
			return nil
		end
		return { type = "buy", playerId = pid, cityId = cs[roll(#cs) + 1] }
	end
	if kind == 1 then -- pillage own ground
		local units = ownUnits(state, pid)
		if #units == 0 then
			return nil
		end
		return { type = "pillage", playerId = pid, unitId = units[roll(#units) + 1] }
	end
	if kind == 2 then -- disband
		local units = ownUnits(state, pid)
		if #units == 0 then
			return nil
		end
		return { type = "disband", playerId = pid, unitId = units[roll(#units) + 1] }
	end
	if kind == 3 then
		local c = RATE_COMBOS[roll(#RATE_COMBOS) + 1]
		return { type = "setRates", playerId = pid, tax = c[1], sci = c[2], lux = c[3] }
	end
	if kind == 4 then -- manual workers, or back to auto
		local cs = ownCities(state, pid)
		if #cs == 0 then
			return nil
		end
		local city = state.cities[cs[roll(#cs) + 1]]
		if roll(3) == 0 then
			return { type = "setWorkers", playerId = pid, cityId = city.id, auto = true }
		end
		local candidates = cities.candidateTiles(state, city, ruleset)
		local n = math.min(city.pop, #candidates, 1 + roll(4))
		local workers = setmetatable({}, statehash.ARRAY_MT) -- enters state; may be empty
		for i = 1, n do
			workers[i] = candidates[i].idx
		end
		return { type = "setWorkers", playerId = pid, cityId = city.id, workers = workers }
	end
	if kind == 5 then -- volatile government
		local gov = ({ "republic", "democracy", "communism" })[roll(3) + 1]
		return { type = "setGovernment", playerId = pid, government = gov }
	end
	if kind == 6 then -- research switch
		local techIds = sortedKeys(ruleset.techs)
		return { type = "setResearch", playerId = pid, tech = techIds[roll(#techIds) + 1] }
	end
	if kind == 8 then -- production switch
		local cs = ownCities(state, pid)
		if #cs == 0 then
			return nil
		end
		local cityId = cs[roll(#cs) + 1]
		local pools = {
			{ "unit", CHAOS_BASICS },
			{ "unit", sortedKeys(ruleset.units) },
			{ "building", sortedKeys(ruleset.buildings) },
			{ "wonder", sortedKeys(ruleset.wonders) },
		}
		local pool = pools[roll(4) + 1]
		local ids = pool[2] :: { string }
		return {
			type = "setProduction", playerId = pid, cityId = cityId,
			item = { kind = pool[1], id = ids[roll(#ids) + 1] },
		}
	end
	if kind == 9 then -- short random walk
		local units = ownUnits(state, pid)
		if #units == 0 then
			return nil
		end
		return {
			type = "moveUnit", playerId = pid, unitId = units[roll(#units) + 1],
			dir = CHAOS_DIRS[roll(8) + 1],
		}
	end
	if kind == 10 or kind == 11 then
		local settlers = ownSettlers(state, pid)
		if #settlers == 0 or roll(6) == 0 then
			local all = ownUnits(state, pid)
			if #settlers == 0 and #all > 0 and roll(2) == 0 then
				if kind == 10 then
					return { type = "foundCity", playerId = pid, unitId = all[roll(#all) + 1], name = CHAOS_NAMES[roll(#CHAOS_NAMES) + 1] }
				end
				return { type = "startWork", playerId = pid, unitId = all[roll(#all) + 1], work = CHAOS_WORKS[roll(#CHAOS_WORKS) + 1] }
			end
			local cs = ownCities(state, pid)
			if #cs == 0 then
				return nil
			end
			return {
				type = "setProduction", playerId = pid,
				cityId = cs[roll(#cs) + 1], item = { kind = "unit", id = "settlers" },
			}
		end
		if kind == 11 then
			return { type = "startWork", playerId = pid, unitId = settlers[roll(#settlers) + 1], work = CHAOS_WORKS[roll(#CHAOS_WORKS) + 1] }
		end
		-- foundCity: scan for a window; without one, walk the farthest
		-- settler outward (no rolls in this block — pure scan)
		local minDist = if ruleset.rules.minCityDistance == nil then 4 else ruleset.rules.minCityDistance
		local windowId, farId, farDist, farUnit = nil, nil, -1, nil
		for _, uid in ipairs(settlers) do
			local u = state.units[uid]
			local near = 1e9
			for _, cid in ipairs(state.cityOrder) do
				local c = state.cities[cid]
				local dx = math.abs(u.x - c.x)
				local dy = math.abs(u.y - c.y)
				local d = if dx > dy then dx else dy
				if d < near then
					near = d
				end
			end
			if near >= minDist and windowId == nil and u.moves > 0 then
				windowId = uid
			end
			if near > farDist then
				farDist = near
				farId = uid
				farUnit = u
			end
		end
		if windowId ~= nil then
			return { type = "foundCity", playerId = pid, unitId = windowId, name = CHAOS_NAMES[roll(#CHAOS_NAMES) + 1] }
		end
		local nx, ny, bestD = 0, 0, farDist
		local OUTWARD = {
			{ "N", 0, -1 }, { "NE", 1, -1 }, { "E", 1, 0 }, { "SE", 1, 1 },
			{ "S", 0, 1 }, { "SW", -1, 1 }, { "W", -1, 0 }, { "NW", -1, -1 },
		}
		for _, dv in ipairs(OUTWARD) do
			local near = 1e9
			for _, cid in ipairs(state.cityOrder) do
				local c = state.cities[cid]
				local ddx = math.abs((farUnit :: any).x + dv[2] - c.x)
				local ddy = math.abs((farUnit :: any).y + dv[3] - c.y)
				local d = if ddx > ddy then ddx else ddy
				if d < near then
					near = d
				end
			end
			if near > bestD then
				bestD = near
				nx = dv[2]
				ny = dv[3]
			end
		end
		local DIR_BY_VEC: { [string]: string } = {
			["0,-1"] = "N", ["1,-1"] = "NE", ["1,0"] = "E", ["1,1"] = "SE",
			["0,1"] = "S", ["-1,1"] = "SW", ["-1,0"] = "W", ["-1,-1"] = "NW",
		}
		local outward = DIR_BY_VEC[nx .. "," .. ny]
		if outward ~= nil then
			return { type = "moveUnit", playerId = pid, unitId = farId, dir = outward }
		end
		return { type = "foundCity", playerId = pid, unitId = farId, name = CHAOS_NAMES[roll(#CHAOS_NAMES) + 1] }
	end
	-- kind 12: the specialist arm
	local cs = ownCities(state, pid)
	if #cs == 0 then
		return nil
	end
	local city = state.cities[cs[roll(#cs) + 1]]
	local candidates = cities.candidateTiles(state, city, ruleset)
	local n = math.min(math.max(city.pop - 2, 0), #candidates, roll(3))
	local workers = setmetatable({}, statehash.ARRAY_MT) -- enters state; may be empty
	for i = 1, n do
		workers[i] = candidates[i].idx
	end
	return {
		type = "setWorkers", playerId = pid, cityId = city.id, workers = workers,
		taxmen = roll(3), scientists = roll(3),
	}
end

-- opts: { seed, civs=4, width=80, height=50, turns=400, rulesOverrides?,
--   chaos=false, chaosRate=6, deepAt={} (checkpoint rounds) }
local function runSim(opts: any): any
	local ruleset = opts.ruleset
	local civs = if opts.civs == nil then 4 else opts.civs
	local width = if opts.width == nil then 80 else opts.width
	local height = if opts.height == nil then 50 else opts.height
	local turns = if opts.turns == nil then 400 else opts.turns
	local deepAt = if opts.deepAt == nil then {} else opts.deepAt
	local overrides = opts.rulesOverrides
	if overrides ~= nil then
		local merged = {}
		for _, k in ipairs(sortedKeys(ruleset.rules)) do
			merged[k] = ruleset.rules[k]
		end
		for _, k in ipairs(sortedKeys(overrides)) do
			merged[k] = overrides[k]
		end
		local shallow = {}
		for _, k in ipairs(sortedKeys(ruleset)) do
			shallow[k] = ruleset[k]
		end
		shallow.rules = merged
		ruleset = shallow
	end
	local players = {}
	for i = 1, civs do
		local p = SIM_ROSTER[i]
		table.insert(players, { id = p.id, name = p.name, color = p.color, human = false, civ = p.civ })
	end

	local engine = engineModule.createEngine(ruleset)
	local options = { width = width, height = height, players = players }
	if opts.difficulty ~= nil then
		options.difficulty = opts.difficulty
	end
	if opts.mapType ~= nil then
		options.mapType = opts.mapType -- naval witness: archipelago seeds
	end
	local state = engine.createGame({ seed = opts.seed, options = options })
	if state.ok == false then
		error("createGame failed for seed " .. tostring(opts.seed) .. ": " .. tostring(state.reason))
	end

	local chaosRng = rng.seedRng(opts.seed + 999331) -- separate stream
	local function roll(n: number): number
		local r = rng.rollRange(chaosRng, n)
		chaosRng = r.rngState
		return r.value
	end

	local checkpoints = {}
	local behaviorCheckpoints = {} -- #28: behaviorHash (stamp-excluded) parallel to checkpoints
	local rounds = 0
	for round = 1, turns do
		local startTurn = state.turn
		local guard = #state.playerOrder + 2
		while state.turn == startTurn and not state.gameOver and guard > 0 do
			guard -= 1
			local pid = state.activePlayer
			if state.players[pid].alive ~= false then
				-- chaos injects BEFORE the AI turn (@9ba56f30)
				if opts.chaos == true and roll(if opts.chaosRate == nil then 6 else opts.chaosRate) == 0 then
					local cmd = pickChaosCommand(state, pid, roll, ruleset)
					if cmd ~= nil then
						local res = engine.applyCommand(state, cmd)
						if res.ok then
							state = res.state
						end
					end
				end
				state = aiModule.runAiTurn(engine, state, pid, ruleset, nil)
			end
			local res = engine.applyCommand(state, { type = "endTurn", playerId = pid })
			if not res.ok then
				error("endTurn rejected for " .. pid .. " on turn " .. startTurn .. " (" .. tostring(res.reason) .. ")")
			end
			state = res.state
		end
		if not state.gameOver and state.turn ~= startTurn + 1 then
			error("round " .. round .. " wedged: turn stuck at " .. state.turn)
		end
		rounds = round

		if table.find(deepAt, round) ~= nil then
			checkpoints[round] = statehash.hashState(state)
			behaviorCheckpoints[round] = statehash.behaviorHash(state) -- #28: stamp-excluded
		end
		if state.gameOver then
			break
		end
	end

	return {
		state = state,
		rounds = rounds,
		checkpoints = checkpoints,
		behaviorCheckpoints = behaviorCheckpoints,
		finalHash = statehash.hashState(state),
		behaviorFinalHash = statehash.behaviorHash(state),
	}
end

return {
	runSim = runSim,
	SIM_ROSTER = SIM_ROSTER,
	pickChaosCommand = pickChaosCommand,
}
