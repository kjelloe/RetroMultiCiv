--!strict
-- P5-8 Gate A harness (lune-side): the golden-seed sim to a given round —
-- default 100 (the turn-100 checkpoint golden 0x560088f5). Pass a round
-- count as the first argument for longer runs (the sim-runner's Gate B
-- uses 400 + the natural-end configuration). Prints checkpoint hashes and
-- ms/turn (Gate B sizing).

local fs = require("@lune/fs")
local process = require("@lune/process")

local json2lua = require("./json2lua")
local simDriver = require("./sim-driver")

local ruleset = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end

-- args: [rounds] or "natural" (standard endYear, CHAOS OFF — the exact
-- GOLDEN_NATURAL configuration in test/simulation.test.js:
-- expect rounds 519, winner p2, finalHash 0xa17099f5 — Calendar-545 curve)
local turns = 100
local natural = false
if process.args[1] == "natural" then
	natural = true
	turns = 545
elseif process.args[1] ~= nil then
	turns = tonumber(process.args[1]) :: number
end
-- naval witness: an optional 2nd arg selects the map type (e.g. "archipelago") so the
-- twins gate can exercise the naval code paths cross-language on a seed where they FIRE.
local mapType = process.args[2]
local deepAt = {}
if not natural then -- soak checkpoints are the chaos-on trajectory only
	for _, cp in ipairs({ 100, 200, 300, 400 }) do
		if cp <= turns then
			table.insert(deepAt, cp)
		end
	end
end

local t0 = os.clock()
local result = simDriver.runSim({
	ruleset = ruleset,
	seed = 20260712, civs = 4, width = 56, height = 35,
	turns = turns,
	-- disasters OFF in the pinned goldens (ruled #2133) -- must MATCH the JS sim-driver
	-- override or the twin diverges. Ship default stays authentic-ON.
	rulesOverrides = if natural then { disastersEnabled = false } else { endYear = 9999, disastersEnabled = false },
	chaos = not natural, -- the natural golden is a chaos-OFF run (JS SIM defaults)
	deepAt = deepAt,
	mapType = mapType, -- nil = default (continents); "archipelago" = the naval witness
})
local elapsed = os.clock() - t0

for _, cp in ipairs(deepAt) do
	print("checkpoint " .. cp .. ": " .. tostring(result.checkpoints[cp]))
	-- #28: the stamp-excluded behaviorHash alongside — a re-record reads both to tell a
	-- cosmetic rulesetHash-stamp move (behavior unchanged) from a real behavioral one.
	print("behavior " .. cp .. ": " .. tostring(result.behaviorCheckpoints[cp]))
end
print("rounds: " .. result.rounds .. " finalHash: " .. result.finalHash)
print("behaviorFinalHash: " .. tostring(result.behaviorFinalHash))
if natural then
	print("winner: " .. tostring(result.state.winner))
end
print(string.format("ms/turn: %.1f (total %.1fs)", elapsed * 1000 / result.rounds, elapsed))
