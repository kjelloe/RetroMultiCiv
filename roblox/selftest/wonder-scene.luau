-- check.sh gate 67: the wonder completion scene's rules (WonderScene): what
-- plays for which event, when nothing plays, the beat timings, the part
-- rise, the camera path, the card lines, a model and a blurb per wonder.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local W = require("../src/client/WonderScene")
local S = require("../src/client/StructureModels")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local cities = { c1 = { owner = "p1", name = "Thebes" }, c2 = { owner = "p2", name = "Rome" } }
local function ctx(over)
	local c = { you = "p1", cities = cities, models = S.MODELS }
	for k, v in pairs(over or {}) do
		c[k] = v
	end
	return c
end
local own = { type = "wonderBuilt", cityId = "c1", wonder = "pyramids" }
local rival = { type = "wonderBuilt", cityId = "c2", wonder = "colossus" }
local unseen = { type = "wonderBuilt", cityId = "c9", wonder = "oracle" }

local p = W.plan({ own }, ctx())
check("own wonder plays the scene", #p == 1 and p[1].mode == "scene" and p[1].wonder == "pyramids" and p[1].cityId == "c1")
p = W.plan({ rival }, ctx())
check("a rival wonder shows the small card", #p == 1 and p[1].mode == "rival")
p = W.plan({ unseen }, ctx())
check("a wonder in a city out of sight is a rival card", #p == 1 and p[1].mode == "rival")
p = W.plan({ own }, ctx({ scenes = false }))
check("switch off: the card only", #p == 1 and p[1].mode == "card")
p = W.plan({ own }, ctx({ models = {} }))
check("no model: the card only", #p == 1 and p[1].mode == "card")
p = W.plan({ rival }, ctx({ scenes = false }))
check("switch off keeps the rival card", #p == 1 and p[1].mode == "rival")
p = W.plan({ { type = "cityGrew", cityId = "c1" }, own, rival, { type = "wonderBuilt", cityId = "c1", wonder = "oracle" } }, ctx())
check("several wonders play in order", #p == 3 and p[1].wonder == "pyramids" and p[2].mode == "rival" and p[3].wonder == "oracle")
for _, flag in ipairs({ "away", "tour", "fastForward", "theater", "gameOver" }) do
	check("nothing plays while " .. flag, #W.plan({ own, rival }, ctx({ [flag] = true })) == 0)
end
check("an event without a wonder id is ignored", #W.plan({ { type = "wonderBuilt", cityId = "c1" } }, ctx()) == 0)

-- beats
check("the card comes up at 7.5 s", math.abs(W.CARD_AT - 7.5) < 1e-9, W.CARD_AT)
check("beat names", W.beatAt(0) == "open" and W.beatAt(0.7) == "build" and W.beatAt(4.1) == "reveal" and W.beatAt(7.5) == "card"
	and W.beatAt(60) == "card")
for _, n in ipairs({ 1, 2, 20, 80 }) do
	check("first part starts as the bars close " .. n, W.riseStart(1, n) == W.BEATS.open)
	check("last part lands by the reveal " .. n, W.riseStart(n, n) + W.RISE <= W.BEATS.open + W.BEATS.build + 1e-9)
	for i = 2, n do
		check("parts start in order", W.riseStart(i, n) >= W.riseStart(i - 1, n))
	end
end
check("rise ends in place", W.rise(0) == 0 and W.rise(1) == 1 and W.rise(-3) == 0 and W.rise(9) == 1)
local peak = 0
for i = 0, 100 do
	peak = math.max(peak, W.rise(i / 100))
end
check("rise overshoots a little", peak > 1.02 and peak < 1.2, peak)

-- camera: ends on the model's own view after a quarter turn, never under the ground
local cam = { yaw = 35, pitch = 18, fit = 1.1 }
local first, last = W.camera(0, cam), W.camera(W.CARD_AT, cam)
check("camera ends on the model's view", math.abs(last.yaw - 35) < 1e-6 and math.abs(last.pitch - 18) < 1e-6 and math.abs(last.zoom - 1) < 1e-6)
check("camera starts a quarter turn away and further out", math.abs((35 - first.yaw) % 360 - W.ORBIT) < 1e-6 and first.zoom > 1.2)
for i = 0, 75 do
	local c = W.camera(i / 10, cam)
	check("camera stays above the ground", c.pitch >= 5 and c.pitch <= 60 and c.zoom >= 1 and c.yaw >= 0 and c.yaw < 360)
end

-- card lines
check("year text", W.yearText(-2400) == "2400 BC" and W.yearText(1850) == "1850 AD")
check("own caption", W.caption("scene", "Thebes", "Egyptians", -2400) == "Completed in Thebes, 2400 BC")
check("rival caption", W.caption("rival", "Rome", "Romans", 120) == "Completed by the Romans, 120 AD")
check("rival caption out of sight", W.caption("rival", nil, nil, 120) == "Completed in a distant land, 120 AD")

-- every wonder of the real ruleset has a model and a blurb
local raw = serde.decode("json", fs.readFile("data/wonders.json"))
local wonders = raw.wonders or raw
local n = 0
for id in pairs(wonders) do
	n += 1
	check("model for " .. id, S.MODELS[id] ~= nil)
	local b = W.BLURB[id]
	check("blurb for " .. id, type(b) == "string" and #b >= 40 and #b <= 200 and b:match("^[%w%p ]+$") ~= nil, b)
end
for id in pairs(W.BLURB) do
	check("blurb id is a wonder: " .. id, wonders[id] ~= nil)
end
check("22 wonders", n == 22, n)

if fails > 0 then
	error(("wonder-scene: %d failure(s)"):format(fails))
end
print(("wonder-scene: ok (%d wonders)"):format(n))
