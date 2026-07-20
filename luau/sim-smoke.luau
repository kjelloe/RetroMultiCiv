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

-- args: [rounds] or "natural" (standard endYear, 545 rounds, CHAOS OFF —
-- the exact GOLDEN_NATURAL configuration in test/simulation.test.js:
-- expect rounds 545, winner p2, finalHash 0xd5a7d301 — Calendar-545)
local turns = 100
local natural = false
if process.args[1] == "natural" then
	natural = true
	turns = 545
elseif process.args[1] ~= nil then
	turns = tonumber(process.args[1]) :: number
end
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
	rulesOverrides = if natural then nil else { endYear = 9999 },
	chaos = not natural, -- the natural golden is a chaos-OFF run (JS SIM defaults)
	deepAt = deepAt,
})
local elapsed = os.clock() - t0

for _, cp in ipairs(deepAt) do
	print("checkpoint " .. cp .. ": " .. tostring(result.checkpoints[cp]))
end
print("rounds: " .. result.rounds .. " finalHash: " .. result.finalHash)
if natural then
	print("winner: " .. tostring(result.state.winner))
end
print(string.format("ms/turn: %.1f (total %.1fs)", elapsed * 1000 / result.rounds, elapsed))
