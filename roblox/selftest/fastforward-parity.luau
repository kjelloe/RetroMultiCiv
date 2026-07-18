-- check.sh gate 9, luau side (architect grant @0acb4ef4 condition c): must
-- print the IDENTICAL ff-parity line as fastforward-parity.mjs. Run from
-- the repo root: lune run roblox/selftest/fastforward-parity.luau
local fs = require("@lune/fs")

local json2lua = require("../../luau/json2lua")
local index = require("../../luau/index")
local fastforward = require("../../luau/fastforward")
local statehash = require("../../luau/statehash")

local ruleset = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end

local CIVS = { "romans", "babylonians", "germans" }
local players = setmetatable({}, statehash.ARRAY_MT)
for i, id in ipairs(CIVS) do
	table.insert(players, {
		id = "p" .. i, name = ruleset.civs[id].name, color = ruleset.civs[id].color,
		human = i == 1,
	})
end

local engine = index.createEngine(ruleset)
local created = engine.createGame({
	seed = 20260718,
	options = { width = 40, height = 25, players = players, mapType = "continents" },
})
if created.ok == false then
	error("createGame failed: " .. tostring(created.reason))
end
-- createGame returns the state itself on success ({ok=false,...} on failure)

local PROBE_AGE = { id = "probe", turn = 25, grantEras = { "ancient" } }
local r = fastforward.fastForwardTo(ruleset, created, PROBE_AGE, { "p1" })
if r.aborted ~= nil then
	error("aborted: " .. tostring(r.aborted.reason))
end
local h = statehash.hashState(r.state)
print(string.format("ff-parity 0x%08x turn %d grant %d", h, r.state.turn, #r.grant))
