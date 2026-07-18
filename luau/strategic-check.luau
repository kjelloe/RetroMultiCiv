-- SO17: prints the luau strategicSnapshot hash per player for the shared crafted
-- state (test/fixtures/strategic-state.json). luau-twins.test.js asserts these
-- equal the JS shared/strategic.js snapshots. Run from the repo root.
local fs = require("@lune/fs")
local json2lua = require("./json2lua")
local strategic = require("./strategic")
local statehash = require("./statehash")
local ruleset = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end
local state = json2lua.parse(fs.readFile("test/fixtures/strategic-state.json"))
for _, pid in ipairs(state.playerOrder) do
	local snap = strategic.strategicSnapshot(state, pid, ruleset)
	print(string.format("strat:%s: 0x%08x", pid, statehash.hashState(snap)))
end
