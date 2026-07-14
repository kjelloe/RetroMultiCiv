--!strict
-- Luau twin of test/scenario-runner.js (phase 5, P5-2 + P5-3). Scenarios are
-- engine-agnostic JSON; this runner consumes tables parsed by json2lua and
-- an engine with the JS adapter contract:
--   engine.applyCommand(state, cmd) -> { ok, state, reason?, events }
--
-- FAILURES follow the docs/09 first-divergence contract from the first red
-- run: fixture, command index (0-based, matching the JS runner's "step N"),
-- turn, acting seat, canonical payload, the Luau hash at failure, RNG state
-- before/after the failing command — plus the final canonical string so the
-- Node side can name the first differing state path. The harness prints it;
-- test/luau-twins.test.js enriches with the JS side.
--
-- Pure Luau, Studio-consumable (no lune APIs — the harness does file I/O).
-- EXPORTS (public API, stable):
--   buildSetup(scenario) -> { kind = "state"|"seed", ... }
--   hashSetup(scenario)  -> the P5-2 gate value
--   runScenario(engine, scenario, fixture) ->
--     { pass = true, finalHash, state } |
--     { pass = false, report = {...contract fields...} }

local statehash = require("./statehash")
local json2lua = require("./json2lua")

local function buildSetup(scenario: any): { kind: string, state: any?, setup: any? }
	local setup = scenario.setup
	if setup == nil then
		error("scenario has no setup")
	end
	if setup.state ~= nil then
		json2lua.assertState(setup.state)
		return { kind = "state", state = setup.state }
	end
	return { kind = "seed", setup = setup }
end

local function hashSetup(scenario: any): string
	local built = buildSetup(scenario)
	if built.kind == "state" then
		return statehash.hashState(built.state)
	end
	json2lua.assertState(built.setup)
	return statehash.hashState(built.setup)
end

local function getPath(obj: any, dotted: string): any
	local cur = obj
	for key in string.gmatch(dotted, "[^%.]+") do
		if cur == nil then
			return nil
		end
		-- dotted paths carry 0-BASED array indices (JS convention:
		-- "map.tiles.1" is the second tile) — numeric segments address
		-- array positions, so they get the +1; state object keys are never
		-- bare digits (docs/09 trap-list addition, P5-4)
		if string.match(key, "^%d+$") ~= nil then
			cur = cur[tonumber(key) :: number + 1]
		else
			cur = cur[key]
		end
	end
	return cur
end

local function sameValue(got: any, want: any): boolean
	if typeof(want) == "table" then
		if typeof(got) ~= "table" then
			return false
		end
		local okG, canonG = pcall(statehash.canonicalize, got)
		local okW, canonW = pcall(statehash.canonicalize, want)
		return okG and okW and canonG == canonW
	end
	return got == want
end

local function checkPaths(state: any, expected: any, label: string, failures: { string })
	for _, p in ipairs((function()
		local keys = {}
		for k in pairs(expected) do
			table.insert(keys, k)
		end
		table.sort(keys) -- deterministic failure ordering
		return keys
	end)()) do
		local want = expected[p]
		local got = getPath(state, p)
		if want == json2lua.NULL then
			-- null in a scenario means "this path must not exist"
			if got ~= nil then
				table.insert(failures, label .. ": " .. p .. " present, expected absent")
			end
		elseif not sameValue(got, want) then
			table.insert(failures, label .. ": " .. p .. " = " .. tostring(got) .. ", expected " .. tostring(want))
		end
	end
end

-- docs/09 first-divergence report: everything the Luau side can know
local function report(fixture: string, commandIndex: number, state: any, cmd: any?, rngBefore: any, failures: { string })
	local okHash, hash = pcall(statehash.hashState, state)
	local okCanon, canon = pcall(statehash.canonicalize, state)
	return {
		pass = false,
		report = {
			fixture = fixture,
			commandIndex = commandIndex, -- 0-based, the JS runner's "step N"
			turn = state.turn,
			actor = if cmd ~= nil then cmd.playerId else nil,
			payload = if cmd ~= nil then select(2, pcall(statehash.canonicalize, cmd)) else nil,
			luauHash = if okHash then hash else "unhashable",
			rngBefore = rngBefore,
			rngAfter = state.rngState,
			failures = failures,
			canon = if okCanon then canon else nil,
		},
	}
end

local function runScenario(engine: any, scenario: any, fixture: string): any
	local built = buildSetup(scenario)
	if built.kind ~= "state" then
		return report(fixture, -1, { turn = 0 }, nil, nil, { "setup: notPorted:mapgen (seed-based scenario)" })
	end
	local state = built.state

	local script = scenario.script or {}
	for i = 1, #script do
		local step = script[i]
		local failures = {}
		local rngBefore = state.rngState
		-- an engine error (e.g. a batch-guard's loud notPorted) is still an
		-- IN-CONTRACT divergence, never a harness crash
		local okCall, res = pcall(engine.applyCommand, state, step.cmd)
		if not okCall then
			table.insert(failures, string.format("step %d: engine error: %s", i - 1, tostring(res)))
			return report(fixture, i - 1, state, step.cmd, rngBefore, failures)
		end
		if res.state ~= nil then
			state = res.state
		end
		local exp = step.expect or {}
		if exp.ok ~= nil and res.ok ~= exp.ok then
			local why = if res.reason ~= nil then " (" .. res.reason .. ")" else ""
			table.insert(failures, string.format("step %d: ok=%s%s, expected ok=%s", i - 1, tostring(res.ok), why, tostring(exp.ok)))
		end
		if exp.state ~= nil then
			checkPaths(state, exp.state, "step " .. (i - 1), failures)
		end
		if #failures > 0 then
			return report(fixture, i - 1, state, step.cmd, rngBefore, failures)
		end
	end

	local failures = {}
	if scenario.final ~= nil then
		if scenario.final.state ~= nil then
			checkPaths(state, scenario.final.state, "final", failures)
		end
		local goldenHash = scenario.final.hash
		if goldenHash ~= nil and goldenHash ~= json2lua.NULL then
			local h = statehash.hashState(state)
			if h ~= goldenHash then
				table.insert(failures, "final hash " .. h .. ", expected " .. goldenHash)
			end
		end
	end
	if #failures > 0 then
		return report(fixture, #script, state, nil, state.rngState, failures)
	end

	return { pass = true, finalHash = statehash.hashState(state), state = state }
end

return {
	buildSetup = buildSetup,
	hashSetup = hashSetup,
	getPath = getPath,
	runScenario = runScenario,
}
