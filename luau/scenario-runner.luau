--!strict
-- Luau twin of test/scenario-runner.js (phase 5, P5-2 slice). Scenarios are
-- engine-agnostic JSON; this runner consumes tables parsed by json2lua.
--
-- THIS SLICE implements what is checkable before the engine ports land:
-- setup handling + canonical hashing (the P5-2 gate: all ten scenarios'
-- setups hash identically in Node and Luau). Script execution, dotted-path
-- expectations, and final-hash checks arrive with the engine modules
-- (P5-3+), completing the runScenario twin against the same JSON files.
--
-- Pure Luau, Studio-consumable (no lune APIs — the harness does file I/O).
-- EXPORTS (public API, stable): buildSetup(scenario) ->
--   { kind = "state", state = t } for inline states (contract-asserted), or
--   { kind = "seed", setup = t } awaiting the engine's createGame (P5-3);
-- hashSetup(scenario) -> the cross-language gate value: hashState(state)
--   for inline setups, hashState(raw setup object) for seed setups.

local statehash = require("./statehash")
local json2lua = require("./json2lua")

local function buildSetup(scenario: any): { kind: string, state: any?, setup: any? }
	local setup = scenario.setup
	if setup == nil then
		error("scenario has no setup")
	end
	if setup.state ~= nil then
		-- inline state: enforce the contract before anyone hashes it
		json2lua.assertState(setup.state)
		return { kind = "state", state = setup.state }
	end
	-- seed-based (e.g. 002-mapgen-determinism): building the state needs the
	-- engine's createGame — P5-3. The raw setup object still crosses the
	-- language gate (json fidelity), see hashSetup.
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

return {
	buildSetup = buildSetup,
	hashSetup = hashSetup,
}
