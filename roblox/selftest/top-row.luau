-- check.sh gate 54: the top-centre button row never shares pixels with the
-- turn chip or the menu row, at any width from a phone to a wide desktop.
local T = require("../src/client/TopRowPlan")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

check("five buttons", #T.BUTTONS == 5)
check("full width", T.width(false) == 166 + 136 + 170 + 136 + 170 + 4 * T.GAP + 2 * T.PAD, T.width(false))
check("compact width", T.width(true) == 5 * T.COMPACT_W + 4 * T.GAP + 2 * T.PAD, T.width(true))

local want = { [667] = "compact/centre/1", [844] = "compact/left/0", [1280] = "compact/left/0", [1920] = "full/centre/0", [2208] = "full/centre/0" }
for vw, sig in pairs(want) do
	local p = T.plan(vw)
	check("plan @" .. vw, ("%s/%s/%d"):format(p.compact and "compact" or "full", p.align, p.row) == sig,
		("%s/%s/%d"):format(p.compact and "compact" or "full", p.align, p.row))
end
local lastFull = false
for vw = 320, 2600, 7 do
	local p = T.plan(vw)
	check("width matches the mode @" .. vw, p.w == T.width(p.compact))
	check("inside the viewport @" .. vw, p.x >= 0 and (p.x + p.w <= vw or p.row == 1), p.x + p.w)
	if p.row == 0 then
		check("clear of the turn chip @" .. vw, p.x >= T.LEFT, p.x)
		check("clear of the menu row @" .. vw, p.x + p.w <= vw - T.rightReserve(vw), p.x + p.w)
	end
	if p.align == "centre" then
		check("centred @" .. vw, math.abs((p.x + p.w / 2) - vw / 2) <= 1 or p.x == 0)
	end
	-- widening the window never takes labels away again
	check("full stays full as the window grows @" .. vw, not (lastFull and p.compact))
	lastFull = not p.compact
end
check("menu row reserve: full on a desktop", T.rightReserve(1280) == T.RIGHT_FULL)
check("menu row reserve: compact on a phone", T.rightReserve(844) == T.RIGHT_COMPACT)

if fails > 0 then
	error(fails .. " top row pin(s) failed")
end
print("top-row: plans at 667 / 844 / 1280 / 1920 / 2208 and a sweep 320-2600")
