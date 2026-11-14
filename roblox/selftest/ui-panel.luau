-- check.sh gate 42: headless (lune) pins for the panel fit rule (UiPanel).
local P = require("../src/client/UiPanel")

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

-- screen-wide scale
check("reference screen = 1", P.scaleFor(1280, 720), 1)
check("1080p below the top bar", P.scaleFor(1920, 1022), 1.4)
check("run-R Studio window", P.scaleFor(2208, 911), 1.25)
check("capped", P.scaleFor(3840, 2100), P.MAX_SCALE)
check("a small screen is not scaled down globally", P.scaleFor(844, 332), 1)
check("stepped to 0.05", P.scaleFor(1408, 800), 1.1)

-- right-pinned panel keeps its edge gap (CityPanel: 1,-328 / 320 wide)
local r = P.place(1, -328, 0, 48, 320, 420, 2208, 911, 1.25)
check("right-pinned scale", r.s, 1.25)
check("right-pinned offset scales", r.xo, -410)
check("right-pinned stays inside", 2208 + r.xo + 320 * r.s <= 2208 - P.MARGIN, true)
check("top offset scales", r.yo, 60)

-- centred panel stays centred (Pedia: 0.5,-380 / 760 wide)
local c = P.place(0.5, -380, 0.5, -220, 760, 440, 1920, 1022, 1.4)
check("centred left edge", 0.5 * 1920 + c.xo, 960 - 760 * 1.4 / 2)
check("centred top edge", 0.5 * 1022 + c.yo, 511 - 440 * 1.4 / 2)

-- bottom-pinned panel grows upward (Legend: 0,8 / 1,-540, 430x440)
local b = P.place(0, 8, 1, -540, 430, 440, 2208, 911, 1.25)
check("bottom-pinned offset", b.yo, -675)
check("bottom-pinned bottom edge above the toggles", 911 + b.yo + 440 * b.s, 911 - 125)

-- phone: cut until it fits, both axes on screen
local p = P.place(0.5, -380, 0.5, -220, 760, 440, 844, 332, 1)
check("phone scale cut by height", p.s, 0.73)
check("phone under the reading floor", p.s < P.READABLE, true)
local left, top = 0.5 * 844 + p.xo, 0.5 * 332 + p.yo
check("phone left on screen", left >= P.MARGIN, true)
check("phone right on screen", left + 760 * p.s <= 844 - P.MARGIN, true)
check("phone top on screen", top >= P.MARGIN, true)
check("phone bottom on screen", top + 440 * p.s <= 332 - P.MARGIN + 0.5, true)

-- a panel that would leave the screen at full scale is pulled back in
local o = P.place(0, 316, 0, 44, 280, 300, 600, 500, 1.4)
check("pulled back inside", 316 * 1.4 + 280 * o.s > 600 and (o.xo + 280 * o.s <= 600 - P.MARGIN), true)

check("an unsettled viewport is below the area floor", 1 < P.MIN_AREA and 332 >= P.MIN_AREA, true)

-- what counts as a panel
check("panel size", P.isPanelSize(0, 320, 0, 420), true)
check("a toggle is not a panel", P.isPanelSize(0, 190, 0, 40), false)
check("a scale-sized frame is not adopted", P.isPanelSize(1, 0, 0, 300), false)

if fails > 0 then
	error(("%d ui-panel pin(s) failed"):format(fails))
end
print("ui-panel: all pins hold")
