-- check.sh gate 80: the Options panel sections (OptionsLayout, plan R7.4).
-- Every row the panel builds is placed exactly once.
local fs = require("@lune/fs")
local L = require("../src/client/OptionsLayout")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local p = L.plan()
local seen, n = {}, 0
for _, s in ipairs(L.SECTIONS) do
	check("section has rows " .. s.title, #s.rows > 0)
	for _, id in ipairs(s.rows) do
		check("row once " .. id, not seen[id])
		seen[id] = true
		n += 1
	end
end
local ys = {}
for _, y in pairs(p.rows) do
	ys[#ys + 1] = y
end
for _, h in ipairs(p.heads) do
	ys[#ys + 1] = h.y
end
table.sort(ys)
for i = 2, #ys do
	check("no two lines share a slot", ys[i] - ys[i - 1] >= math.min(L.ROW, L.HEAD), ys[i])
end
check("height holds every line", p.height == L.TOP + #L.SECTIONS * L.HEAD + n * L.ROW + L.BOTTOM, p.height)
check("fits a 720 px screen under the top row", 50 + p.height <= 720 - 60, p.height)

-- the panel places every row id it builds, and builds every id it places
local src = fs.readFile("roblox/src/client/Options.client.luau")
local built = {}
for id in src:gmatch('row%("(%w+)"%)') do
	built[id] = true
	check("built row is placed " .. id, seen[id] == true)
end
for id in pairs(seen) do
	check("placed row is built " .. id, built[id] == true)
end

if fails > 0 then
	error(("options-layout: %d failure(s)"):format(fails))
end
print(("options-layout: %d rows in %d sections, %d px"):format(n, #L.SECTIONS, p.height))
