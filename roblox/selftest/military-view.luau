-- check.sh gate 50: military overview content (MilitaryView, the
-- client/ui/military-overview.js twin): own units only, stats from the
-- ruleset, home city / unsupported, where (in / near / field, wrap-aware),
-- ordering, the per-type summary, panel height.
local V = require("../src/client/MilitaryView")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local rs = { units = {
	militia = { name = "Militia", attack = 1, defense = 1, moves = 1 },
	settlers = { name = "Settlers", attack = 0, defense = 1, moves = 1 },
	legion = { name = "Legion", attack = 3, defense = 1, moves = 1 },
} }
local view = { you = "p1", map = { width = 40, height = 25, wrapX = true },
	cities = {
		c1 = { owner = "p1", name = "Rome", x = 2, y = 5 },
		c2 = { owner = "p1", name = "Ostia", x = 30, y = 5 },
		c3 = { owner = "p2", name = "Ur", x = 10, y = 10 },
	},
	units = {
		u10 = { owner = "p1", type = "militia", x = 2, y = 5, home = "c1" },
		u9 = { owner = "p1", type = "militia", x = 39, y = 5, home = "c2", veteran = true },
		u3 = { owner = "p1", type = "settlers", x = 10, y = 10 },
		u4 = { owner = "p2", type = "legion", x = 3, y = 5 },
		u5 = { owner = "p1", type = "legion", x = 20, y = 20, home = "c99" },
		u6 = { owner = "p1", type = "mystery", x = 0, y = 0 },
	} }

local rows = V.rows(view, rs)
check("own units only", #rows == 5, #rows)
local names = {}
for i, r in ipairs(rows) do
	names[i] = r.name .. ":" .. r.id
end
check("ordered by name then numeric id", table.concat(names, " ") == "Legion:u5 Militia:u9 Militia:u10 Settlers:u3 mystery:u6", table.concat(names, " "))
local by = {}
for _, r in ipairs(rows) do
	by[r.id] = r
end
check("stats from the ruleset", by.u5.attack == 3 and by.u5.defense == 1 and by.u5.moves == 1)
check("in a city", by.u10.where == "in Rome" and by.u10.home == "Rome")
-- (39,5): Ostia is 9 away, Rome is 3 away across the seam
check("near: wrap-aware nearest own city", by.u9.where == "near Rome", by.u9.where)
check("veteran flag", by.u9.veteran == true and by.u10.veteran == false)
check("a rival's city is still 'in'", by.u3.where == "in Ur", by.u3.where)
check("no home = unsupported", by.u3.home == nil)
check("unknown home city = unsupported", by.u5.home == nil)
check("unknown unit type keeps its id as the name", by.u6.name == "mystery" and by.u6.attack == 0)
check("kind", by.u5.kind == "combat" and by.u3.kind == "civil")
view.map.wrapX = false
check("no wrap: the seam is a wall", V.rows(view, rs)[2].where == "near Ostia", V.rows(view, rs)[2].where)
view.map.wrapX = true
local lonely = { you = "p1", map = view.map, cities = {}, units = { u1 = { owner = "p1", type = "militia", x = 1, y = 1 } } }
check("no cities: in the field", V.rows(lonely, rs)[1].where == "in the field")
check("no units: no rows", #V.rows({ you = "p1", units = {}, cities = {} }, rs) == 0)

local s = V.summary(rows)
check("summary totals", s.total == 5 and s.veterans == 1 and s.combat == 3 and s.civil == 2, s.combat .. "/" .. s.civil)
check("summary by type: most numerous first, then name", s.byType[1].name == "Militia" and s.byType[1].count == 2
	and s.byType[2].name == "Legion" and s.byType[3].name == "Settlers" and s.byType[4].name == "mystery")
check("summary of nothing", V.summary({}).total == 0 and #V.summary({}).byType == 0)

local h, content = V.panelHeight(3)
check("height: rows", content == 3 * (V.ROW_H + V.ROW_GAP) and h == V.HEAD_H + content + 8)
h, content = V.panelHeight(200)
check("height: capped, body scrolls", h == V.HEAD_H + V.BODY_MAX + 8 and content > V.BODY_MAX)
h = V.panelHeight(0)
check("height: empty still has one row of room", h == V.HEAD_H + V.ROW_H + V.ROW_GAP + 8)

if fails > 0 then
	error(fails .. " military view pin(s) failed")
end
print("military-view: rows, where, summary, height")
