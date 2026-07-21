--!strict
-- P5-2 gate harness (lune-side; the modules it drives are Studio-clean):
-- prints `scenario-file: 0xhash` for every test/scenarios/*.json, using
-- json2lua + scenario-runner + statehash — the Node side of
-- test/luau-twins.test.js computes the same hashes from the same files and
-- asserts equality per scenario. Extra file arguments are hashed as SAVE
-- states (`save:<name>: 0xhash`) — real saves are the mess that finds bugs.

local fs = require("@lune/fs")
local process = require("@lune/process")

local json2lua = require("./json2lua")
local runner = require("./scenario-runner")
local statehash = require("./statehash")

local engineModule = require("./index")
local RULESET_FILES = { "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }
local ruleset = {}
for _, f in ipairs(RULESET_FILES) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end
ruleset.rules.disastersEnabled = false -- scenarios default disasters OFF (opt-in via rulesOverrides)
local engine = engineModule.createEngine(ruleset)

local names = fs.readDir("test/scenarios")
table.sort(names)
for _, name in names do
	if string.sub(name, -5) == ".json" then
		local scenario = json2lua.parse(fs.readFile("test/scenarios/" .. name))
		print(name .. ": " .. runner.hashSetup(scenario))
		-- P5-3: RUN the scenario; pass prints the final hash, failure prints
		-- the docs/09 first-divergence report block
		local scEngine = engine
		if scenario.rulesOverrides ~= nil then
			local mergedRules = table.clone(ruleset.rules)
			for k, v in pairs(scenario.rulesOverrides) do
				mergedRules[k] = v
			end
			local mergedRuleset = table.clone(ruleset)
			mergedRuleset.rules = mergedRules
			scEngine = engineModule.createEngine(mergedRuleset)
		end
		local result = runner.runScenario(scEngine, scenario, name)
		if result.pass then
			print("run:" .. name .. ": " .. result.finalHash)
		else
			local r = result.report
			print(string.format("DIVERGENCE fixture=%s command=%d turn=%s actor=%s",
				r.fixture, r.commandIndex, tostring(r.turn), tostring(r.actor)))
			print("  payload=" .. tostring(r.payload))
			print("  luauHash=" .. tostring(r.luauHash) .. " rngBefore=" .. tostring(r.rngBefore) .. " rngAfter=" .. tostring(r.rngAfter))
			for _, f in ipairs(r.failures) do
				print("  fail: " .. f)
			end
			if r.canon ~= nil then
				print("  canon=" .. r.canon)
			end
		end
	end
end

for _, arg in process.args do
	local save = json2lua.parse(fs.readFile(arg))
	local state = if save.state ~= nil then save.state else save
	json2lua.assertState(state)
	local base = string.match(arg, "([^/\\]+)$") or arg
	print("save:" .. base .. ": " .. statehash.hashState(state))
end
