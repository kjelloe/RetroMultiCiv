-- check.sh gate 71: Options sound level (SoundLevel) - effects switch and volume.
local L = require("../src/client/SoundLevel")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

check("defaults to the approved mix", L.master({}) == 1 and L.master(nil) == 1 and L.volume({}) == L.DEFAULT)
check("switch off silences", L.master({ sound = false, soundVolume = 80 }) == 0)
check("volume scales", L.master({ soundVolume = 70 }) == 0.7)
check("volume snaps to the step", L.volume({ soundVolume = 64 }) == 60 and L.volume({ soundVolume = 65 }) == 70)
check("volume clamped", L.volume({ soundVolume = 140 }) == 100 and L.volume({ soundVolume = -5 }) == 0)
check("zero volume is silent", L.master({ soundVolume = 0 }) == 0)
check("steps", L.step({ soundVolume = 50 }, 1) == 60 and L.step({ soundVolume = 50 }, -1) == 40)
check("steps stop at the ends", L.step({ soundVolume = 100 }, 1) == 100 and L.step({ soundVolume = 0 }, -1) == 0)

if fails > 0 then
	error(("sound-level: %d failure(s)"):format(fails))
end
print("sound-level: ok")
