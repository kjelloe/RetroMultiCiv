-- A59: prints the luau leaders-seam hash for luau-twins.test.js to match the JS.
-- Hashes { civ:<id> -> stanceFromPersonality(personality) } + { stance:<s> ->
-- stanceFromPersonality(STANCE_AXES[s]) } — exercises the derivation + the fallback.
local fs = require("@lune/fs")
local json2lua = require("./json2lua")
local leaders = require("./leaders")
local statehash = require("./statehash")
local civs = json2lua.parse(fs.readFile("data/civs.json"))
local r = {}
for id, civ in pairs(civs) do
	r["civ:" .. id] = leaders.stanceFromPersonality(civ.personality)
end
for s, axes in pairs(leaders.STANCE_AXES) do
	r["stance:" .. s] = leaders.stanceFromPersonality(axes)
end
print(string.format("leaders: 0x%08x", statehash.hashState(r)))
