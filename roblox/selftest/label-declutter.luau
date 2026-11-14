-- check.sh gate 34: headless (lune) pinned verdicts for LabelDeclutter.pick —
-- the F2 screen-space label collision rule ViewRenderer applies.
local M = require("../src/client/LabelDeclutter")

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end
local function verdict(items)
	local out = {}
	for i, v in ipairs(M.pick(items)) do
		out[i] = v and "1" or "0"
	end
	return table.concat(out)
end
local function it(x, y, w, h, pri, depth)
	return { x = x, y = y, w = w, h = h, pri = pri, depth = depth or 50 }
end

check("empty", verdict({}), "")
check("apart: both show", verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(300, 0, 100, 40, M.OWN_UNIT) }), "11")
check("city beats an overlapping unit regardless of order",
	verdict({ it(10, 5, 100, 40, M.OWN_UNIT), it(0, 0, 200, 56, M.CITY) }), "01")
check("selected unit beats own unit", verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(20, 0, 100, 40, M.SELECTED) }), "01")
check("own beats other", verdict({ it(0, 0, 100, 40, M.OTHER_UNIT), it(20, 0, 100, 40, M.OWN_UNIT) }), "01")
check("tie: nearer wins", verdict({ it(0, 0, 100, 40, M.OWN_UNIT, 80), it(20, 0, 100, 40, M.OWN_UNIT, 30) }), "01")
check("full tie: first wins", verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(20, 0, 100, 40, M.OWN_UNIT) }), "10")
check("stacked on a city tile: city only", verdict({
	it(0, 0, 200, 56, M.CITY), it(0, 10, 100, 48, M.OWN_UNIT), it(0, 12, 100, 48, M.OWN_UNIT) }), "100")
check("a hidden label does not block a third", verdict({
	it(0, 0, 100, 40, M.CITY), it(80, 0, 100, 40, M.OWN_UNIT, 10), it(160, 0, 100, 40, M.OWN_UNIT, 20) }), "101")
check("x overlap without y overlap shows both",
	verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(10, 60, 100, 40, M.OWN_UNIT) }), "11")
check("overlap within SLACK shows both",
	verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(100 - M.SLACK, 0, 100, 40, M.OWN_UNIT) }), "11")
check("overlap past SLACK hides the later one",
	verdict({ it(0, 0, 100, 40, M.OWN_UNIT), it(100 - M.SLACK - 1, 0, 100, 40, M.OWN_UNIT) }), "10")
check("two colliding cities: nearer shows", verdict({ it(0, 0, 200, 56, M.CITY, 90), it(40, 10, 200, 56, M.CITY, 40) }), "01")
check("textWidth", M.textWidth(11, 22), 129)

if fails > 0 then
	error(("%d label-declutter pin(s) failed"):format(fails))
end
print("label-declutter: ALL PINS PASS")
