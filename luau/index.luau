--!strict
-- Luau twin of engine/index.js (phase 5, P5-3): the pure deterministic
-- reducer. Input state never mutated; on failure the original returns.
-- Unported rule modules are explicit no-op hooks / notPorted rejections —
-- each batch replaces its hook, and the scenario gates flip green.
-- TRAP (docs/09 addition): data/rules.json yearSteps uses the field name
-- "until" — a Lua KEYWORD, so it needs bracket access, never dot access.
-- EXPORTS (stable): createEngine(ruleset) -> { applyCommand }, deepClone,
-- nextYear.

local statehash = require("./statehash")
local movement = require("./movement") -- batch 1 (P5-3)

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
local function hasCities(state: any): boolean
	return state.cityOrder ~= nil and #state.cityOrder > 0
end
local hooks = {}
hooks.processWork = function(state: any, _ruleset: any, _events: any)
	for _, u in pairs(state.units) do
		if u.working ~= nil then
			error("notPorted:improvements (a unit has work in progress)")
		end
	end
end
hooks.processRevolutions = function(state: any, _ruleset: any, _events: any)
	for _, pid in ipairs(state.playerOrder) do
		if state.players[pid].revolutionTurns ~= nil then
			error("notPorted:government (a revolution is ticking)")
		end
	end
end
hooks.updateDisorder = function(state: any, _ruleset: any, _events: any)
	if hasCities(state) then
		error("notPorted:happiness (cities exist)")
	end
end
hooks.processCities = function(state: any, _ruleset: any, _events: any)
	if hasCities(state) then
		error("notPorted:cities (cities exist)")
	end
end
hooks.processResearch = function(state: any, ruleset: any, _events: any)
	if hasCities(state) then
		error("notPorted:tech (cities exist - income math not ported)")
	end
	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player.taxRate == nil then player.taxRate = ruleset.rules.defaultTaxRate end
		if player.sciRate == nil then player.sciRate = ruleset.rules.defaultSciRate end
		if player.bulbs == nil then player.bulbs = 0 end
		-- city-less income is 0/0/0; gold += 0 and bulbs += 0 are no-ops, and
		-- researching '' never completes — the defaults are the whole effect
		if player.researching ~= "" and player.researching ~= nil then
			-- a pending discovery could complete only with bulbs income; with
			-- zero income it cannot — safe as long as no cities exist (guarded)
		end
	end
end
hooks.processBarbarians = function(state: any, _ruleset: any, _events: any)
	if state.turn >= 16 then
		error("notPorted:barbarians (turn >= 16 - spawn checks would roll RNG)")
	end
end
hooks.checkGameEnd = function(state: any, _ruleset: any, _events: any)
	for _, pid in ipairs(state.playerOrder) do
		if state.players[pid].alive == true then
			error("notPorted:score (alive flags present - eliminations possible)")
		end
	end
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
		hooks.processWork(state, ruleset, events)
		hooks.processRevolutions(state, ruleset, events)
		hooks.updateDisorder(state, ruleset, events)
		hooks.processCities(state, ruleset, events)
		hooks.processResearch(state, ruleset, events)
		hooks.processBarbarians(state, ruleset, events)
		hooks.checkGameEnd(state, ruleset, events)
		for _, id in sortedKeys(state.units) do
			local unit = state.units[id]
			unit.moves = ruleset.units[unit.type].moves
			unit.roadSteps = nil -- free road allowance resets with the turn
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
		elseif cmd.type == "foundCity" or cmd.type == "setProduction"
			or cmd.type == "setWorkers" or cmd.type == "buy" then
			result = { ok = false, reason = "notPorted:cities" }
		elseif cmd.type == "startWork" or cmd.type == "pillage" then
			result = { ok = false, reason = "notPorted:improvements" }
		elseif cmd.type == "setGovernment" then
			result = { ok = false, reason = "notPorted:government" }
		elseif cmd.type == "setResearch" or cmd.type == "setRates" then
			result = { ok = false, reason = "notPorted:tech" }
		else
			result = { ok = false, reason = "unknownCommand" }
		end

		if not result.ok then
			return { ok = false, reason = result.reason, state = state, events = {} }
		end
		return { ok = true, state = next_, events = result.events }
	end

	return { applyCommand = applyCommand }
end

return {
	createEngine = createEngine,
	deepClone = deepClone,
	nextYear = nextYear,
}
