-- check.sh gate 77: the civilization card at game start (CivIntro). The stance
-- phrases are scanned from the browser's discovery-card.js; every civ in
-- civs.json gets a card with its leader's stance from luau/leaders.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local C = require("../src/client/CivIntro")
local leaders = require("../../luau/leaders")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end
local function load(name)
	local raw = serde.decode("json", fs.readFile("data/" .. name .. ".json"))
	return raw[name] or raw
end
local civs, units = load("civs"), load("units")

local js = fs.readFile("client/ui/discovery-card.js")
local literal = js:match("const LEADER_STANCE_PHRASE = (%b{})")
check("browser phrase table found", literal ~= nil)
local n = 0
for k, v in (literal or ""):gmatch("(%w+): '([^']+)'") do
	n += 1
	check("phrase " .. k, C.PHRASE[k] == v, C.PHRASE[k])
end
check("five phrases", n == 5, n)
check("kicker as the browser", js:find(C.KICKER, 1, true) ~= nil)

local count = 0
for id, civ in pairs(civs) do
	count += 1
	local stance = civ.personality ~= nil and leaders.stanceFromPersonality(civ.personality) or "balanced"
	local card = C.card(civ, stance, units)
	check(id .. " name", card.name == "You lead the " .. civ.name)
	check(id .. " leader line", card.blurb:find(civ.leader or "your ruler", 1, true) == 1 and card.blurb:find(C.PHRASE[stance], 1, true) ~= nil)
	check(id .. " strength", #card.strength > 5)
	check(id .. " colour", card.color:match("^#%x%x%x%x%x%x$") ~= nil, card.color)
	if civ.specialty ~= nil and civ.specialty.unit ~= nil then
		check(id .. " specialty unit", card.unit == civ.specialty.unit and card.unitName == units[civ.specialty.unit].name)
	end
end
check("every civ", count >= 14, count)
check("unknown stance falls back", C.card({ name = "X" }, "nope", units).blurb == "your ruler - a balanced, even-handed leader.")

local view = { you = "p1", turn = 1, players = { p1 = { civ = "romans" } } }
check("shows at the start", C.shouldShow(view, false, false))
check("once", not C.shouldShow(view, true, false))
check("not under the regent", not C.shouldShow(view, false, true))
view.turn = 2
check("not mid-game", not C.shouldShow(view, false, false))
view.turn = 0
view.players.p1.civ = nil
check("not without a civ", not C.shouldShow(view, false, false))

if fails > 0 then
	error(("civ-intro: %d failure(s)"):format(fails))
end
print(("civ-intro: %d civs, phrases match discovery-card.js"):format(count))
