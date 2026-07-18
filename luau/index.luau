--!strict
-- Luau twin of engine/index.js (phase 5, P5-3..P5-8 — COMPLETE): the pure
-- deterministic reducer. Input state never mutated; on failure the original
-- returns. Every command routes to its ported module and endTurn's process
-- chain runs unguarded end to end (the guarded-no-op era closed in P5-7).
-- TRAP (docs/09 addition): data/rules.json yearSteps uses the field name
-- "until" — a Lua KEYWORD, so it needs bracket access, never dot access.
-- EXPORTS (stable): createEngine(ruleset) -> { applyCommand }, deepClone,
-- nextYear.

local statehash = require("./statehash")
local movement = require("./movement") -- batch 1 (P5-3)
local improvements = require("./improvements") -- batch 2 (P5-4)
local cities = require("./cities") -- batch 3 (P5-5)
local tech = require("./tech") -- batch 3 (P5-5)
local happiness = require("./happiness") -- batch 3 (P5-5, pin dependency)
local government = require("./government") -- batch 4 (P5-6, completed)
local barbarians = require("./barbarians") -- batch 5 (P5-7)
local air = require("./air") -- A72: air fuel/crash
local score = require("./score") -- batch 5 (P5-7)
local spaceship = require("./spaceship") -- A76: space race
local trade = require("./trade") -- A89: caravan trade routes
local mapgen = require("./mapgen") -- batch 5 (P5-7)

local function isArrayLike(t: any): boolean
	return t[1] ~= nil or getmetatable(t) == statehash.ARRAY_MT
end

local function sortedKeys(t: any): { string }
	local keys = {}
	for k in pairs(t) do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

-- flat arrays of primitives (explored masks, worker lists) copy directly —
-- table.clone preserves the ARRAY_MT marker; nested values recurse
local function deepClone(value: any): any
	if typeof(value) ~= "table" then
		return value
	end
	if isArrayLike(value) then
		local flat = true
		for i = 1, #value do
			if typeof(value[i]) == "table" then
				flat = false
				break
			end
		end
		if flat then
			return table.clone(value)
		end
		local out = setmetatable({}, getmetatable(value))
		for i = 1, #value do
			out[i] = deepClone(value[i])
		end
		return out
	end
	local out = {}
	for _, k in sortedKeys(value) do
		out[k] = deepClone(value[k])
	end
	return out
end

-- Civ-1-style variable calendar (data/rules.json yearSteps): first bracket
-- with year < until supplies the step; past the last, its step keeps
-- applying. Rulesets without the table keep the flat +20.
local function nextYear(year: number, rules: any): number
	local steps = rules.yearSteps
	if steps == nil or #steps == 0 then
		return year + 20
	end
	for _, b in ipairs(steps) do
		if year < b["until"] then -- "until" is a Lua keyword: bracket access
			return year + b.step
		end
	end
	return year + steps[#steps].step
end

-- P5-3 batch-1 hooks (engine/index.js call order, FROZEN): each unported
-- process hook is a GUARDED no-op — it errors loudly the moment a state
-- could make the real JS hook do observable work, so a silent divergence is
-- impossible; each batch replaces its guard with the real module. The one
-- ported behavior batch 1 needs: processResearch's lazy default writes
-- (taxRate/sciRate/bulbs) — the first real cross-language divergence this
-- harness caught was exactly JS writing bulbs:0 where the no-op didn't.
local hooks = {}
hooks.processWork = improvements.processWork -- batch 2: guard deleted, module in
hooks.processRevolutions = government.processRevolutions -- batch 4: guard deleted
hooks.updateDisorder = happiness.updateDisorder -- batch 3: guard deleted
hooks.processCities = cities.processCities -- batch 3: guard deleted
hooks.processResearch = tech.processResearch -- batch 3: guard + ported defaults deleted (the module owns them)
hooks.processBarbarians = barbarians.process -- batch 5: guard deleted
hooks.processAir = air.processAir -- A72: fuel/crash for airborne units
hooks.processSpace = spaceship.processSpace -- A76: first launched ship to arrive wins
hooks.checkGameEnd = score.checkGameEnd -- batch 5: guard deleted — endTurn runs UNGUARDED

-- A75: the world's CURRENT AGE is DERIVED — the highest TECH ERA reached by at
-- least worldAgeThreshold% of ALIVE civs. "Reached era i" = knows >= 1 tech
-- whose era index >= i (cumulative-upward). Ranges over the FOUR TECH ERAS ONLY
-- (Space Age is a starting option, not a tech era). PURE READ — no state change.
local function worldEraOrder(ruleset: any): { string }
	local isEra = {}
	for id in pairs(ruleset.techs) do
		isEra[ruleset.techs[id].era] = true
	end
	local order = {}
	local ages = if ruleset.rules.ages == nil then {} else ruleset.rules.ages
	for _, age in ipairs(ages) do
		if isEra[age.id] == true then
			table.insert(order, age.id)
		end
	end
	return order
end

local function worldAge(state: any, ruleset: any): string
	local order = worldEraOrder(ruleset)
	if #order == 0 then return "" end
	local eraIdx = {}
	for i = 1, #order do eraIdx[order[i]] = i - 1 end -- 0-based to match the JS twin
	local alive = 0
	for _, pid in ipairs(state.playerOrder) do
		if state.players[pid].alive ~= false then alive += 1 end
	end
	if alive == 0 then return order[1] end
	local reachedCount = {}
	for i = 1, #order do reachedCount[i] = 0 end
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		if p.alive ~= false then
			local best = 0
			for _, t in ipairs(p.techs) do
				local def = ruleset.techs[t]
				local idx = if def == nil or eraIdx[def.era] == nil then 0 else eraIdx[def.era]
				if idx > best then best = idx end
			end
			for i = 0, best do reachedCount[i + 1] = reachedCount[i + 1] + 1 end
		end
	end
	local threshold = ruleset.rules.worldAgeThreshold
	local hi = 0
	for i = 0, #order - 1 do
		if reachedCount[i + 1] * 100 >= alive * threshold then hi = i end
	end
	return order[hi + 1]
end

local function endTurn(state: any, cmd: any, ruleset: any): any
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local order = state.playerOrder
	if order == nil or #order == 0 then
		return { ok = false, reason = "noPlayerOrder" }
	end

	local idx = table.find(order, cmd.playerId)
	local events = setmetatable({}, statehash.ARRAY_MT)
	table.insert(events, { type = "turnEnded", playerId = cmd.playerId })

	if idx == #order then
		state.turn = state.turn + 1
		state.year = nextYear(state.year, ruleset.rules)
		state.activePlayer = order[1]
		local ageBefore = worldAge(state, ruleset) -- A75: sample the age across the wrap
		hooks.processWork(state, ruleset, events)
		hooks.processRevolutions(state, ruleset, events)
		hooks.updateDisorder(state, ruleset, events)
		hooks.processCities(state, ruleset, events)
		hooks.processResearch(state, ruleset, events)
		hooks.processBarbarians(state, ruleset, events)
		hooks.processAir(state, ruleset, events)
		hooks.processSpace(state, ruleset, events) -- A76: first launched ship to arrive wins
		hooks.checkGameEnd(state, ruleset, events)
		local ageAfter = worldAge(state, ruleset)
		if ageAfter ~= ageBefore then
			local eo = worldEraOrder(ruleset)
			if (table.find(eo, ageAfter) :: number) > (table.find(eo, ageBefore) :: number) then
				table.insert(events, { type = "ageChanged", age = ageAfter, turn = state.turn })
			end
		end
		for _, id in sortedKeys(state.units) do
			local unit = state.units[id]
			unit.moves = ruleset.units[unit.type].moves
			unit.roadSteps = nil -- free road allowance resets with the turn
		end
		-- A86: the one-sale-per-turn flag resets with the game turn (omit-safe)
		for _, cid in ipairs(state.cityOrder or {}) do
			local c = state.cities[cid]
			if c ~= nil and c.soldThisTurn ~= nil then
				c.soldThisTurn = nil
			end
		end
		table.insert(events, { type = "turnStarted", turn = state.turn, activePlayer = state.activePlayer })
	else
		state.activePlayer = order[(idx :: number) + 1]
		table.insert(events, { type = "turnStarted", turn = state.turn, activePlayer = state.activePlayer })
	end
	return { ok = true, events = events }
end

local function createEngine(ruleset: any)
	local function applyCommand(state: any, cmd: any): any
		if state.gameOver == true then
			return { ok = false, reason = "gameOver", state = state, events = {} }
		end
		local next_ = deepClone(state)
		local result
		if cmd.type == "endTurn" then
			result = endTurn(next_, cmd, ruleset)
		elseif cmd.type == "moveUnit" then
			result = movement.moveUnit(next_, cmd, ruleset)
		elseif cmd.type == "fortify" then
			result = movement.fortify(next_, cmd, ruleset)
		elseif cmd.type == "wait" then
			result = movement.wait(next_, cmd, ruleset)
		elseif cmd.type == "disband" then
			result = movement.disband(next_, cmd, ruleset)
		elseif cmd.type == "foundCity" then
			result = cities.foundCity(next_, cmd, ruleset)
		elseif cmd.type == "setProduction" then
			result = cities.setProduction(next_, cmd, ruleset)
		elseif cmd.type == "setWorkers" then
			result = cities.setWorkers(next_, cmd, ruleset)
		elseif cmd.type == "buy" then
			result = cities.buyProduction(next_, cmd, ruleset)
		elseif cmd.type == "helpWonder" then
			result = cities.helpWonder(next_, cmd, ruleset)
		elseif cmd.type == "sellBuilding" then
			result = cities.sellBuilding(next_, cmd, ruleset)
		elseif cmd.type == "startWork" then
			result = improvements.startWork(next_, cmd, ruleset)
		elseif cmd.type == "pillage" then
			result = improvements.pillage(next_, cmd, ruleset)
		elseif cmd.type == "setGovernment" then
			result = government.setGovernment(next_, cmd, ruleset)
		elseif cmd.type == "setResearch" then
			result = tech.setResearch(next_, cmd, ruleset)
		elseif cmd.type == "setRates" then
			result = tech.setRates(next_, cmd, ruleset)
		elseif cmd.type == "launchShip" then
			result = spaceship.launchShip(next_, cmd, ruleset)
		elseif cmd.type == "establishTradeRoute" then
			result = trade.establishTradeRoute(next_, cmd, ruleset)
		else
			result = { ok = false, reason = "unknownCommand" }
		end

		if not result.ok then
			return { ok = false, reason = result.reason, state = state, events = {} }
		end
		return { ok = true, state = next_, events = result.events }
	end

	local function createGame(setup: any): any
		return mapgen.createGame(setup, ruleset)
	end

	return { applyCommand = applyCommand, createGame = createGame }
end

-- A54: the off-turn pre-work whitelist — twin of engine/index.js
-- OFFTURN_WHITELIST (self-scoped commands whose validation carries no turn
-- check; everything else keeps notYourTurn inside its own validation).
local OFFTURN_WHITELIST = setmetatable(
	{ "setRates", "setResearch", "setProduction", "setWorkers" },
	statehash.ARRAY_MT
)

return {
	createEngine = createEngine,
	deepClone = deepClone,
	nextYear = nextYear,
	OFFTURN_WHITELIST = OFFTURN_WHITELIST,
}
