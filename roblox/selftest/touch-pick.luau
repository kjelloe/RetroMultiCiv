-- check.sh gate 79: touch on the map (TouchPick, uo-21).
local T = require("../src/client/TouchPick")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

check("tap", T.kind(0.1, 3) == "tap")
check("long press", T.kind(0.6, 3) == "long")
check("drag wins", T.kind(0.9, 40) == "drag" and T.kind(0.1, 40) == "drag")

local view = { you = "p1", map = { width = 20, height = 20, wrapX = true },
	units = { a = { id = "a", owner = "p1", x = 5, y = 5 }, e = { id = "e", owner = "p2", x = 6, y = 5 } } }
local u = view.units.a
check("adjacent enemy: odds", T.longAction(view, u, 6, 5, true) == "odds")
check("adjacent empty: a tap moves", T.longAction(view, u, 4, 5, true) == nil)
check("own tile: nothing", T.longAction(view, u, 5, 5, true) == nil)
check("distant: GoTo", T.longAction(view, u, 9, 9, true) == "goto")
check("not your turn", T.longAction(view, u, 9, 9, false) == nil)
check("no unit", T.longAction(view, nil, 9, 9, true) == nil)
check("a rival's unit is not yours to send", T.longAction(view, view.units.e, 9, 9, true) == nil)
view.units.a.x = 0
check("wraps: across the edge is adjacent", T.longAction(view, u, 19, 5, true) == nil)
view.gameOver = true
check("not after the game", T.longAction(view, u, 9, 9, true) == nil)

if fails > 0 then
	error(("touch-pick: %d failure(s)"):format(fails))
end
print("touch-pick: ok")
