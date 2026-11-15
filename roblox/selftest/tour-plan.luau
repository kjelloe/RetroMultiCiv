-- check.sh gate 52: the UI tour's plan and judging rules (TourPlan).
-- Every ScreenGui the audit expects is toured or exempt with a reason, every
-- toured panel registers itself, and judge() finds what it must.
local fs = require("@lune/fs")
local T = require("../src/client/TourPlan")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

-- coverage: DiagAudit's gui lists vs stops + exemptions
local audit = fs.readFile("roblox/src/client/DiagAudit.client.luau")
local toured = {}
for _, s in ipairs(T.STOPS) do
	toured[s.gui] = true
end
local nGui = 0
for _, list in ipairs({ audit:match("local EXPECTED_GUIS = (%b{})"), audit:match("local LAZY_GUIS = (%b{})") }) do
	for name in list:gmatch('"(RMC%w+)"') do
		nGui += 1
		check("gui " .. name .. " is toured or EXEMPT", toured[name] or T.EXEMPT[name] ~= nil)
	end
end
check("the gui lists were read", nGui >= 30, nGui)
for name, why in pairs(T.EXEMPT) do
	check("exemption has a reason " .. name, #why > 10)
	check("exempt gui is known to the audit " .. name, audit:find('"' .. name .. '"', 1, true) ~= nil)
end

-- every toured panel id is registered by some client script
local sources = {}
for _, name in ipairs(fs.readDir("roblox/src/client")) do
	if name:match("%.luau$") then
		sources[#sources + 1] = fs.readFile("roblox/src/client/" .. name)
	end
end
local all = table.concat(sources, "\n")
local seenId = {}
for _, s in ipairs(T.STOPS) do
	check("stop id unique " .. s.id, not seenId[s.id])
	seenId[s.id] = true
	check("stop has a title " .. s.id, #s.title > 0 and (s.minTexts or 0) >= 1)
	if not s.always then
		check("panel " .. s.panel .. " registers itself", all:find('registerPanel("' .. s.panel .. '"', 1, true) ~= nil)
	end
end
for id in all:gmatch('registerPanel%("([%w%-]+)"') do
	local used = false
	for _, s in ipairs(T.STOPS) do
		used = used or s.panel == id
	end
	check("registered panel " .. id .. " has a stop", used)
end

-- judge()
local vp = { w = 1280, h = 720 }
local stop = { id = "x", minTexts = 2 }
local function item(text, size, fits, truncates, visible)
	return { text = text, size = size, fits = fits, truncates = truncates == true, visible = visible ~= false }
end
local good = { item("Cities", 22, true), item("Rome", 16, true) }
check("clean panel passes", #T.judge(stop, { x = 100, y = 50, w = 400, h = 300 }, vp, good) == 0)
check("not opened", T.judge(stop, nil, vp, good)[1] == "did not open")
check("off screen right", T.judge(stop, { x = 1000, y = 50, w = 400, h = 300 }, vp, good)[1]:find("off screen") ~= nil)
check("off screen top", T.judge(stop, { x = 10, y = -40, w = 400, h = 300 }, vp, good)[1]:find("off screen") ~= nil)
check("flush with the edge is on screen", #T.judge(stop, { x = 0, y = 0, w = 1280, h = 720 }, vp, good) == 0)
check("no size", T.judge(stop, { x = 10, y = 10, w = 0, h = 0 }, vp, good)[1] == "has no size")
check("empty", T.judge(stop, { x = 1, y = 1, w = 10, h = 10 }, vp, { item("Cities", 22, true) })[1]:find("only 1 text") ~= nil)
check("hidden and blank texts do not count", T.judge(stop, { x = 1, y = 1, w = 10, h = 10 }, vp,
	{ item("Cities", 22, true), item("x", 22, true, false, false), item("", 22, true) })[1]:find("only 1 text") ~= nil)
local f = T.judge(stop, { x = 1, y = 1, w = 10, h = 10 }, vp, { item("Cities", 22, true), item("A very long name", 16, false) })
check("clipped text", #f == 1 and f[1]:find("1 clipped") ~= nil and f[1]:find("A very long name", 1, true) ~= nil, f[1])
check("a truncating label is not clipped", #T.judge(stop, { x = 1, y = 1, w = 10, h = 10 }, vp,
	{ item("Cities", 22, true), item("A very long name", 16, false, true) }) == 0)
f = T.judge(stop, { x = 1, y = 1, w = 10, h = 10 }, vp, { item("Cities", 22, true), item("tiny", 12, true) })
check("small text", #f == 1 and f[1]:find("under 14 px") ~= nil)
f = T.judge(stop, { x = 1300, y = 1, w = 10, h = 10 }, vp, { item("tiny", 12, false) })
check("several findings are all reported", #f == 4, #f)

-- lines
check("pass line", T.line(3, 18, { id = "cities" }, {}) == "[RMC-TOUR] 03/18 cities PASS")
check("fail line", T.line(3, 18, { id = "cities" }, { "a", "b" }) == "[RMC-TOUR] 03/18 cities FAIL a; b")
check("skip line", T.line(4, 18, { id = "city" }, {}, "no city yet") == "[RMC-TOUR] 04/18 city SKIP no city yet")
local pass, fail, skip, line = T.summary({ { id = "a", findings = {} }, { id = "b", findings = { "x" } }, { id = "c", findings = {}, skipped = "why" } })
check("summary counts", pass == 1 and fail == 1 and skip == 1)
check("summary line", line == "[RMC-TOUR] DONE 3 stops: 1 pass, 1 fail, 1 skipped - failed: b", line)
check("clean summary has no tail", select(4, T.summary({ { id = "a", findings = {} } })) == "[RMC-TOUR] DONE 1 stops: 1 pass, 0 fail, 0 skipped")

for _, st in ipairs(T.STAGE) do
	check("stage step " .. st.id, st.cmd ~= nil or st.action ~= nil)
end

if fails > 0 then
	error(fails .. " tour pin(s) failed")
end
print(("tour-plan: %d stops, %d exempt, %d guis covered"):format(#T.STOPS, (function() local n = 0 for _ in pairs(T.EXEMPT) do n += 1 end return n end)(), nGui))
