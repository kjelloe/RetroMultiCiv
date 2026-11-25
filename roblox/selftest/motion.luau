-- check.sh gate 76: motion options (Motion, plan R6.4).
local M = require("../src/client/Motion")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

check("GoTo paced by default", M.gotoDelay({}) == M.GOTO_PACE and M.gotoDelay(nil) == M.GOTO_PACE)
check("GoTo at once when switched off", M.gotoDelay({ showUnitMove = false }) == 0)
check("GoTo at once when reduced", M.gotoDelay({ reduceAnimation = true }) == 0)
check("blink unless reduced", M.blink({}) and not M.blink({ reduceAnimation = true }))
check("scene switch passes through", M.scenes({ wonderScenes = false }) == false and M.scenes({}) == nil)
check("reduced turns scenes off", M.scenes({ reduceAnimation = true, wonderScenes = true }) == false)

if fails > 0 then
	error(("motion: %d failure(s)"):format(fails))
end
print("motion: ok")
