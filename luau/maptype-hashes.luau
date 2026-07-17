--!strict
-- A82a map-type anchor harness (lune-side): world hashes per rules.mapTypes
-- preset through the REAL committed ruleset — the Node side of
-- test/luau-twins.test.js computes the same worlds via engine/mapgen.js and
-- asserts equality against the pinned anchors. Fixed inputs: seed 42, 80x50,
-- the two-player crafted roster (mirrors test/mapgen.test.js).

local fs = require("@lune/fs")
local json2lua = require("./json2lua")
local mapgen = require("./mapgen")
local statehash = require("./statehash")

local ruleset = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end

local players = {
	{ id = "p1", name = "Romans", color = "#3b7dd8", human = true },
	{ id = "p2", name = "Zulus", color = "#d84a3b", human = false },
}

local function world(mapType: any): string
	local options: any = { width = 80, height = 50, players = players }
	if mapType ~= nil then
		options.mapType = mapType
	end
	local state = mapgen.createGame({ seed = 42, options = options }, ruleset)
	return statehash.hashState(state)
end

print("maptype:default: " .. world(nil))
for _, t in ipairs({ "continents", "pangaea", "archipelago", "islands" }) do
	print("maptype:" .. t .. ": " .. world(t))
end
print("maptype:unknown: " .. world("doughnut"))
