-- check.sh gate 68: tile yield icon rows (YieldIcons) - the city view labels
-- and the map's Resources overlay.
local Y = require("../src/client/YieldIcons")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local rows = Y.rows({ food = 2, shields = 1, trade = 0 })
check("a row per resource the tile gives", #rows == 2 and rows[1].key == "food" and rows[1].n == 2 and rows[2].key == "shields")
check("nothing for an empty tile", #Y.rows({ food = 0, shields = 0, trade = 0 }) == 0 and Y.text({}) == "" and Y.text(nil) == "")
local t = Y.text({ food = 3, shields = 2, trade = 3 })
local _, lines = t:gsub("\n", "")
check("three resources, three lines", lines == 2, lines)
check("one glyph per point", select(2, t:gsub("\u{25CF}", "")) == 3 and select(2, t:gsub("\u{25AE}", "")) == 2
	and select(2, t:gsub("\u{25C6}", "")) == 3)
local seen = {}
for _, k in ipairs(Y.KINDS) do
	check("glyph and colour distinct: " .. k.key, not seen[k.glyph] and not seen[k.color] and k.color:match("^#%x%x%x%x%x%x$") ~= nil)
	seen[k.glyph], seen[k.color] = true, true
end
check("the label stays inside its tile", Y.LABEL.w <= 1 and Y.LABEL.h <= 1 and Y.LABEL.w >= 0.8 and Y.LABEL.h >= 0.7)

local x0, x1, y0, y1 = Y.window(20, 12, 40, 25)
check("window around the focus", x0 == 20 - Y.RADIUS and x1 == 20 + Y.RADIUS and y0 == 12 - Y.RADIUS and y1 == 12 + Y.RADIUS)
x0, x1, y0, y1 = Y.window(1, 24, 40, 25)
check("window clamped to the map", x0 == 0 and x1 == 1 + Y.RADIUS and y1 == 24 and y0 == 24 - Y.RADIUS)
check("label budget", (2 * Y.RADIUS + 1) ^ 2 <= 400, (2 * Y.RADIUS + 1) ^ 2)
check("first draw always builds", Y.moved(nil, nil, 3, 3))
check("a small pan keeps the window", not Y.moved(10, 10, 11, 9))
check("a pan of STEP tiles rebuilds it", Y.moved(10, 10, 10 + Y.STEP, 10) and Y.moved(10, 10, 10, 10 - Y.STEP))

-- the drawn icons: one per resource, known primitives, inside the 0..100 box
local fs = require("@lune/fs")
local glyphSrc = fs.readFile("roblox/src/client/EditableGlyph.luau")
for _, k in ipairs(Y.KINDS) do
	local prims = Y.ICONS[k.key]
	check("icon exists: " .. k.key, type(prims) == "table" and #prims >= 3)
	for i, pr in ipairs(prims or {}) do
		local tag = ("%s[%d]"):format(k.key, i)
		check(tag .. " kind is drawn", glyphSrc:find('k == "' .. pr.p .. '"', 1, true) ~= nil, pr.p)
		local pts = pr.pts
		if pts == nil then
			local rx = pr.r or pr.rx or pr.w / 2
			local ry = pr.r or pr.ry or pr.h / 2
			local reach = (pr.rot or 0) ~= 0 and math.max(rx, ry) or nil
			pts = { { pr.x - (reach or rx), pr.y - (reach or ry) }, { pr.x + (reach or rx), pr.y + (reach or ry) } }
		end
		for _, p in ipairs(pts) do
			check(tag .. " inside the box", p[1] >= 0 and p[1] <= 100 and p[2] >= 0 and p[2] <= 100, ("%s,%s"):format(p[1], p[2]))
		end
	end
end
check("the coin has a second tone", Y.ICONS.shields[2].shade == true)
check("the arrows point opposite ways", Y.ICONS.trade[2].pts[2][1] > 90 and Y.ICONS.trade[4].pts[2][1] < 10)

-- label rows: a third of the height each, centred, n icons wide
local lay = Y.layout({ food = 3, shields = 2, trade = 3 })
check("three rows fill the label", #lay == 3 and lay[1].y == 0 and math.abs(lay[3].y + lay[3].h - 1) < 1e-9 and lay[2].n == 2)
lay = Y.layout({ food = 1, shields = 0, trade = 0 })
check("one row sits in the middle", #lay == 1 and math.abs(lay[1].y - 1 / 3) < 1e-9)
check("signature follows the yields", Y.signature({ food = 2, shields = 0, trade = 1 }) == "2/0/1" and Y.signature(nil) == "0/0/0")
check("inline text is one line", Y.inline({ food = 2, shields = 1, trade = 1 }):find("\n") == nil and Y.inline({}) == "")
check("AUTO is 60 % of the label height", Y.AUTO_SCALE == 0.6)

if fails > 0 then
	error(("yield-icons: %d failure(s)"):format(fails))
end
print("yield-icons: ok")
