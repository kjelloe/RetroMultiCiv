-- check.sh gate 70: encyclopedia search (PediaSearch), the browser's doSearch rule.
local S = require("../src/client/PediaSearch")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local groups = {
	{ key = "units", label = "Units", entries = { { id = "settlers", name = "Settlers" }, { id = "chariot", name = "Chariot" } } },
	{ key = "buildings", label = "Buildings", entries = { { id = "city-walls", name = "City Walls" } } },
	{ key = "techs", label = "Advances", entries = { { id = "the-wheel", name = "The Wheel" }, { id = "bronze", name = "Bronze Working" } } },
}

check("empty query shows the category", S.find(groups, "") == nil and S.find(groups, "   ") == nil and S.find(groups, nil) == nil)
local h = S.find(groups, "  WHEEL ")
check("case and spaces ignored", #h == 1 and h[1].id == "the-wheel" and h[1].cat == 3 and h[1].label == "Advances")
h = S.find(groups, "i")
check("across categories, in order", #h == 3 and h[1].id == "chariot" and h[2].id == "city-walls" and h[3].id == "bronze", #h)
check("no match is an empty list", #S.find(groups, "zzz") == 0)
check("pattern characters are plain text", #S.find(groups, "(") == 0 and #S.find(groups, "%a") == 0)
local many = { { key = "x", label = "X", entries = {} } }
for i = 1, 100 do
	many[1].entries[i] = { id = "e" .. i, name = "Entry " .. i }
end
check("hits capped", #S.find(many, "entry") == S.MAX_HITS)

if fails > 0 then
	error(("pedia-search: %d failure(s)"):format(fails))
end
print("pedia-search: ok")
