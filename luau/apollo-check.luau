--!strict
-- apollo-narrow (#2160) cross-language witness: run ai.runAiTurn on a crafted
-- space-COMMITTED state (passed as a save-shaped JSON, arg 1) and print the
-- resulting state hash for test/luau-twins.test.js to match the JS engine. The
-- soak goldens never reach a committed civ (space-flight tech) in 400/519 turns,
-- so this is the ONLY positive cross-language check of the apollo build branch.
local fs = require("@lune/fs")
local process = require("@lune/process")
local json2lua = require("./json2lua")
local index = require("./index")
local ai = require("./ai")
local statehash = require("./statehash")

local ruleset = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end

local state = json2lua.parse(fs.readFile(process.args[1]))
json2lua.assertState(state)
local engine = index.createEngine(ruleset)
local result = ai.runAiTurn(engine, state, "p1", ruleset)
print(string.format("apollo: 0x%08x", statehash.hashState(result)))
