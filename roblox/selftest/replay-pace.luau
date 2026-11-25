-- check.sh gate 73: replay theater play / pause and speed (ReplayPace).
local P = require("../src/client/ReplayPace")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

check("default is a step", table.find(P.SPEEDS, P.DEFAULT) ~= nil)
check("speed cycles up and wraps", P.nextSpeed(1) == 2 and P.nextSpeed(8) == 1 and P.nextSpeed(99) == 2)
check("delay", P.delay(4) == 0.25 and P.delay(0) == 1)
check("labels", P.playText(true) == "Pause" and P.playText(false) == "Play" and P.speedText(4) == "4/s")
check("steps on", P.nextRound(3, 10) == 4 and P.nextRound(9, 10) == 10)
check("stops at the end", P.nextRound(10, 10) == nil)
check("play from the end starts over", P.startAt(10, 10) == 0 and P.startAt(4, 10) == 4)

if fails > 0 then
	error(("replay-pace: %d failure(s)"):format(fails))
end
print("replay-pace: ok")
