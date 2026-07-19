-- check.sh gate 15, Luau side: must print the IDENTICAL output as
-- beeline-parity.mjs. Requires the ACTUAL Roblox client Beeline.luau (it is
-- pure/dependency-free) so this is a true port-parity check.
-- Run from repo root: lune run roblox/selftest/beeline-parity.luau
local fs = require("@lune/fs")

local json2lua = require("../../luau/json2lua")
local Beeline = require("../src/client/Beeline")

local techs = json2lua.parse(fs.readFile("data/techs.json"))
local ids = {}
for id in pairs(techs) do
	table.insert(ids, id)
end
table.sort(ids)

local lines = {}
for _, g in ipairs(ids) do
	local step = Beeline.nextBeelineStep(techs, {}, g)
	table.insert(lines, g .. "=" .. (step ~= nil and step or "null"))
end
print(table.concat(lines, "\n"))
