-- check.sh gate 69: SettlerJobs.chooseWork answers what the browser's
-- chooseWork answers. Run from the repo root with the file settler-jobs.mjs
-- wrote: lune run roblox/selftest/settler-jobs.luau OUT.json
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local process = require("@lune/process")
local J = require("../src/client/SettlerJobs")

local file = process.args[1]
assert(file ~= nil, "usage: lune run roblox/selftest/settler-jobs.luau OUT.json")
local data = serde.decode("json", fs.readFile(file))
local terrains = serde.decode("json", fs.readFile("data/terrain.json")).terrains

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		if fails <= 10 then
			print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
		end
	end
end

check("same priorities as the browser", table.concat(J.PRIORITIES, ",") == table.concat(data.priorities, ","))
for _, p in ipairs(J.PRIORITIES) do
	check("label for " .. p, type(J.LABELS[p]) == "string")
end
check("cycle", J.nextPriority("balanced") == "food" and J.nextPriority("trade") == "balanced" and J.nextPriority("x") == "food")

for _, c in ipairs(data.cases) do
	local got = J.chooseWork(c.tile, terrains[c.tile.t], c.opts) or "none"
	check(("%s %s"):format(serde.encode("json", c.tile), serde.encode("json", c.opts)), got == c.work,
		("browser %s, roblox %s"):format(c.work, got))
end

if fails > 0 then
	print(("settler-jobs: %d failure(s)"):format(fails))
	process.exit(1)
end
print(("settler-jobs: %d case(s) match the browser's chooseWork"):format(#data.cases))
