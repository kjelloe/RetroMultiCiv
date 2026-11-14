-- check.sh gate 39: headless (lune) pins for the U3 top-row planner
-- (DockLayout) and the touch label rule (UiText).
local D = require("../src/client/DockLayout")
local T = require("../src/client/UiText")

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

check("strip single key", T.stripHint("Found (B)"), "Found")
check("strip 3-char key", T.stripHint("Wait (Spc)"), "Wait")
check("strip keeps leading pad", T.stripHint("  Turn log (L)"), "  Turn log")
check("no hint unchanged", T.stripHint("Pillage"), "Pillage")
check("a long parenthesis is label text", T.stripHint("Debug (Studio)"), "Debug (Studio)")
check("a bare hint is not emptied", T.stripHint("(B)"), "(B)")
check("stripped label is a fixed point", T.stripHint(T.stripHint("Ride (P)")), "Ride")
check("desktop keeps the hint", T.label("Research (T)", false), "Research (T)")
check("touch-only drops it", T.label("Research (T)", true), "Research")

local function items(shipVisible)
	return {
		{ id = "options", order = 1, w = 117, compactW = 44 },
		{ id = "pedia", order = 2, w = 167, compactW = 44 },
		{ id = "ship", order = 3, w = 87, compactW = 44, visible = shipVisible },
		{ id = "strategic", order = 4, w = 44, visible = false },
		{ id = "techtree", order = 5, w = 44 },
		{ id = "clock", order = 6, w = 150 },
	}
end
local function overlaps(plan)
	local list = {}
	for _, p in pairs(plan.places) do
		table.insert(list, p)
	end
	for i = 1, #list do
		for j = i + 1, #list do
			local a, b = list[i], list[j]
			if a.y == b.y and a.right < b.right + b.w and b.right < a.right + a.w then
				return true
			end
		end
	end
	return false
end

check("widthFor", D.widthFor(7, 40), 127)

local wide = D.plan(1920, items(false))
check("wide: full labels", wide.compact, false)
check("wide: one row", wide.rows, 1)
check("wide: rightmost at the margin", wide.places.options.right, 8)
check("wide: next clears it by the gap", wide.places.pedia.right, 8 + 117 + 8)
check("wide: a hidden member takes no space", wide.places.techtree.right, 8 + 117 + 8 + 167 + 8)
check("wide: hidden member has no place", wide.places.ship, nil)
check("wide: no overlap", overlaps(wide), false)

local withShip = D.plan(1920, items(true))
check("ship shown: the row opens up", withShip.places.techtree.right, 8 + 117 + 8 + 167 + 8 + 87 + 8)
check("ship shown: no overlap", overlaps(withShip), false)

local narrow = D.plan(900, items(true))
check("narrow: compact", narrow.compact, true)
check("narrow: icon-only width", narrow.places.pedia.w, 44)
check("narrow: flagged compact", narrow.places.pedia.compact, true)
check("narrow: a member without a compact form keeps its width", narrow.places.clock.w, 150)
check("narrow: one row", narrow.rows, 1)
check("narrow: no overlap", overlaps(narrow), false)

local tiny = D.plan(480, items(true))
check("tiny: wraps", tiny.rows > 1, true)
check("tiny: second row sits below the first", tiny.places.clock.y, D.TOP + D.H_DESKTOP + D.GAP)
check("tiny: no overlap", overlaps(tiny), false)
local inside = true
for _, p in pairs(tiny.places) do
	if p.right + p.w > 480 then
		inside = false
	end
end
check("tiny: every member inside the viewport", inside, true)

local touch = D.plan(1920, items(false), { h = D.H_TOUCH })
check("touch height", touch.places.options.h, 44)
check("empty", D.plan(1920, {}).rows, 0)

if fails > 0 then
	error(("%d ui-dock pin(s) failed"):format(fails))
end
print("ui-dock: ALL PINS PASS")
