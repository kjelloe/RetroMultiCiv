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

local names = fs.readDir("test/scenarios")
table.sort(names)
for _, name in names do
	if string.sub(name, -5) == ".json" then
		local scenario = json2lua.parse(fs.readFile("test/scenarios/" .. name))
		print(name .. ": " .. runner.hashSetup(scenario))
	end
end

for _, arg in process.args do
	local save = json2lua.parse(fs.readFile(arg))
	local state = if save.state ~= nil then save.state else save
	json2lua.assertState(state)
	local base = string.match(arg, "([^/\\]+)$") or arg
	print("save:" .. base .. ": " .. statehash.hashState(state))
end
