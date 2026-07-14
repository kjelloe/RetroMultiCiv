--!strict
-- P5-3 static-data gate harness (lune-side): canonical-hash every
-- data/*.json ruleset file — the Node side of test/luau-twins.test.js
-- computes the same eight hashes from the same files and asserts equality.
-- Ruleset data crossing json2lua identically is what makes every engine
-- twin's rule lookups trustworthy.

local fs = require("@lune/fs")
local json2lua = require("./json2lua")
local statehash = require("./statehash")

local names = fs.readDir("data")
table.sort(names)
for _, name in names do
	if string.sub(name, -5) == ".json" then
		local value = json2lua.parse(fs.readFile("data/" .. name))
		json2lua.assertState(value)
		print(name .. ": " .. statehash.hashState(value))
	end
end
