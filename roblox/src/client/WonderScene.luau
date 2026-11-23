-- The wonder completion scene's rules (pure; specs/roblox-pedia-art.md 2.6).
-- WonderScene.client plays what plan() returns. roblox/selftest/
-- wonder-scene.luau, gate 67.
local M = {}

-- seconds: letterbox closes, the model assembles, the camera orbits, then
-- the card stays until dismissed
M.BEATS = { open = 0.6, build = 3.4, reveal = 3.5 }
M.CARD_AT = M.BEATS.open + M.BEATS.build + M.BEATS.reveal
M.RISE = 0.5 -- seconds one part takes to rise into place
M.DROP = 2.2 -- model units a part starts below its place
M.ORBIT = 90 -- degrees turned during the reveal
M.RIVAL_SECONDS = 6 -- a rival's card closes itself

-- when part group i of n starts rising: spread over the build beat so the
-- last one lands as the reveal starts
function M.riseStart(i, n)
	if n <= 1 then
		return M.BEATS.open
	end
	return M.BEATS.open + (i - 1) / (n - 1) * (M.BEATS.build - M.RISE)
end

-- 0..1 -> how far the part has risen; passes 1 briefly (the overshoot)
function M.rise(u)
	if u <= 0 then
		return 0
	elseif u >= 1 then
		return 1
	end
	local c = 1.70158
	local v = u - 1
	return 1 + (c + 1) * v * v * v + c * v * v
end

local function smooth(u)
	u = math.clamp(u, 0, 1)
	return u * u * (3 - 2 * u)
end

-- the camera at scene time t, from the model's own camera: yaw and pitch
-- in degrees, zoom = a multiple of the fitted distance
function M.camera(t, cam)
	local buildEnd = M.BEATS.open + M.BEATS.build
	local build = smooth(t / buildEnd)
	local reveal = smooth((t - buildEnd) / M.BEATS.reveal)
	return {
		yaw = (cam.yaw - M.ORBIT + 12 * build + (M.ORBIT - 12) * reveal) % 360,
		pitch = cam.pitch + 6 * (1 - reveal),
		zoom = 1.3 - 0.3 * build,
	}
end

function M.beatAt(t)
	if t < M.BEATS.open then
		return "open"
	elseif t < M.BEATS.open + M.BEATS.build then
		return "build"
	elseif t < M.CARD_AT then
		return "reveal"
	end
	return "card"
end

-- events = one view push's events; ctx = { you, cities = view.cities,
-- models = id -> model, scenes = the Options switch, away, tour,
-- fastForward, theater, gameOver }
-- -> { { mode = "scene" | "card" | "rival", wonder, cityId }, ... } in order.
-- Nothing is shown while the seat is not in the player's hands or another
-- full-screen surface owns the view: the turn log line is the record then.
function M.plan(events, ctx)
	local out = {}
	if ctx.away or ctx.tour or ctx.fastForward or ctx.theater or ctx.gameOver then
		return out
	end
	for _, e in ipairs(events) do
		if e.type == "wonderBuilt" and e.wonder ~= nil then
			local city = ctx.cities ~= nil and ctx.cities[e.cityId] or nil
			local mine = city ~= nil and city.owner == ctx.you
			local mode = "rival"
			if mine then
				mode = (ctx.scenes ~= false and ctx.models[e.wonder] ~= nil) and "scene" or "card"
			end
			out[#out + 1] = { mode = mode, wonder = e.wonder, cityId = e.cityId }
		end
	end
	return out
end

function M.yearText(year)
	return year < 0 and (-year .. " BC") or (year .. " AD")
end

-- the line under the name on the card
function M.caption(mode, cityName, ownerName, year)
	if mode == "rival" then
		if ownerName == nil then
			return ("Completed in a distant land, %s"):format(M.yearText(year))
		end
		return ("Completed by the %s, %s"):format(ownerName, M.yearText(year))
	end
	return ("Completed in %s, %s"):format(cityName or "your city", M.yearText(year))
end

-- one original line per wonder (never wiki text); the encyclopedia entry
-- leads with it too
M.BLURB = {
	["pyramids"] = "Stone raised course on course until a king's tomb outgrew the horizon. A people that can build this can organise anything.",
	["colossus"] = "A bronze giant stands over the harbour mouth. Every ship that passes beneath it carries the city's name to another port.",
	["great-library"] = "Every scroll that reaches the city is copied and shelved here. What one people learns, this hall remembers.",
	["great-wall"] = "A line of stone and watchtowers follows the ridges from sea to desert. Raiders now meet walls where they once met farms.",
	["hanging-gardens"] = "Terraces of green rise above the dry plain, watered by hand and by cunning. The city looks up and is content.",
	["lighthouse"] = "A fire burns at the top of the tallest tower on the coast. Sailors steer by it and come home.",
	["oracle"] = "On the mountain a voice answers questions no council can. Pilgrims climb with doubts and descend with purpose.",
	["copernicus-observatory"] = "Under a turning dome the heavens are measured night after night. The numbers say the Earth is not where it was thought to be.",
	["darwin-s-voyage"] = "A small ship returns from the far islands with crates of notes and specimens. The ideas inside will not stay small.",
	["magellan-s-expedition"] = "A fleet sails west and keeps sailing until it comes home from the east. The oceans turn out to be one road.",
	["isaac-newton-s-college"] = "Quiet courts and long tables where falling apples become laws. Scholars arrive with questions and leave with methods.",
	["j-s-bach-s-cathedral"] = "The organ fills the nave and spills into the square. For the length of a fugue, a whole continent agrees.",
	["michelangelo-s-chapel"] = "A ceiling painted by one stubborn hand over long years. People enter in a hurry and stand still.",
	["shakespeare-s-theatre"] = "A wooden ring, an open roof and a full house. For an afternoon the city forgets its troubles and watches kings fall.",
	["leonardo-s-workshop"] = "Sketches of wings, gears and engines cover every wall. Old tools leave this room as new ones.",
	["women-s-suffrage"] = "The ballot box opens to every citizen. A government that hears everyone can ask more of everyone.",
	["hoover-dam"] = "A curved wall of concrete holds back a river and turns its weight into light for a continent.",
	["manhattan-project"] = "In a guarded desert camp, theory becomes a device. After the first test no war will be planned the same way.",
	["apollo-program"] = "A white rocket stands on the pad, fuelled and counted down. The next frontier is straight up.",
	["seti-program"] = "A field of dishes listens to the sky in shifts. Whatever the answer, the search itself sharpens every science.",
	["united-nations"] = "A hall with a seat for every nation and a rule that all may speak. Wars now have somewhere else to end.",
	["cure-for-cancer"] = "Years of patient work in bright laboratories end in a single vial. Every city wakes a little lighter.",
}

return M
