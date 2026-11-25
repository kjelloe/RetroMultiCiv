-- check.sh gate 61: the bottom action bar never shares pixels with the corner
-- toggles at any viewport width (BarFit).
local B = require("../src/client/BarFit")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local p = B.plan(1920, 900)
check("wide: full size on the bottom strip", p.scale == 1 and p.lift == 0 and p.fits)
p = B.plan(1920, 1716)
check("shrinks between the corners", p.lift == 0 and math.abs(p.scale - (1920 - 2 * B.SIDE) / 1716) < 1e-9)
-- the session's case: 1222 px, a unit with every order
p = B.plan(1222, 1716)
check("1222 px: own strip above the corners", p.lift == B.LIFT and p.fits and p.scale >= 0.58, p.scale)
check("the corner reserve holds End Turn and AI", B.SIDE >= 150 + 44 + 8 + 4 + 8)
check("empty bar", B.plan(800, 0).scale == 1)

for _, natural in ipairs({ 300, 700, 1100, 1436, 1716, 2100 }) do
	for vw = 480, 2600, 7 do
		local plan = B.plan(vw, natural)
		local left, right = B.span(vw, natural, plan)
		check("scale in range", plan.scale >= B.MIN_SCALE and plan.scale <= 1)
		if plan.lift == 0 then
			check(("bottom strip clears the corners at %d / %d"):format(vw, natural),
				left >= B.SIDE - 1e-6 and right <= vw - B.SIDE + 1e-6 and plan.scale >= B.MIN_BETWEEN)
		elseif plan.fits then
			check(("lifted bar right of the toggle column at %d / %d"):format(vw, natural), left >= B.SIDE - 1e-6 and right <= vw - B.EDGE + 1e-6)
			local pp = B.plan(vw, natural, true)
			local pl, pr = B.span(vw, natural, pp)
			check(("phone: lifted bar inside the screen at %d / %d"):format(vw, natural), not pp.fits or (pl >= B.EDGE - 1e-6 and pr <= vw - B.EDGE + 1e-6))
		end
		check("lift clears the corner buttons", plan.lift == 0 or plan.lift >= 44 + B.BOTTOM)
	end
end
check("too narrow is reported, not hidden", B.plan(480, 2100).fits == false)

print("bar-fit: bottom bar vs corner toggles")
if fails > 0 then
	error(fails .. " bar-fit check(s) failed")
end
