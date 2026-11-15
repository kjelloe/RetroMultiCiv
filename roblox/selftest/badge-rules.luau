-- check.sh gate 56: badge rules (BadgeRules) over the real rulesets and the
-- engine's own event names.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local B = require("../src/server/BadgeRules")

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
local techs, rules = load("techs"), serde.decode("json", fs.readFile("data/rules.json"))
local rs = { techs = techs }

-- the list
check("50 badges", #B.BADGES == 50, #B.BADGES)
local keys, names = {}, {}
for _, b in ipairs(B.BADGES) do
	check("key unique " .. b.key, not keys[b.key])
	check("name unique " .. b.name, not names[b.name])
	keys[b.key], names[b.name] = true, true
	check("key shape " .. b.key, b.key:match("^[a-z0-9%-]+$") ~= nil)
	-- Roblox badge limits: name <= 50, description <= 1000; keep both short
	check("name length " .. b.key, #b.name >= 3 and #b.name <= 40)
	check("text length " .. b.key, #b.text >= 10 and #b.text <= 120 and b.text:sub(-1) == ".")
	check("tier " .. b.key, b.tier >= 1 and b.tier <= 5 and b.tier == math.floor(b.tier))
	check("icon motif " .. b.key, type(b.icon) == "string" and #b.icon > 0)
	check("kind " .. b.key, (b.kind == "count" and b.n >= 1 and type(b.field) == "string")
		or (b.kind == "flag" and type(b.field) == "string") or (b.kind == "win" and type(b.when) == "function"))
end

-- ladders rise: the same counter at a higher threshold is never an easier tier
local ladders = {}
for _, b in ipairs(B.BADGES) do
	if b.kind == "count" then
		ladders[b.field] = ladders[b.field] or {}
		table.insert(ladders[b.field], b)
	end
end
for field, list in pairs(ladders) do
	table.sort(list, function(a, b) return a.n < b.n end)
	for i = 2, #list do
		check("ladder thresholds differ " .. field, list[i].n > list[i - 1].n)
		check("ladder tiers do not fall " .. field, list[i].tier >= list[i - 1].tier, list[i].key)
	end
end

-- the data the rules lean on is what the rulesets say
local diffs = {}
for id in pairs(rules.difficulties) do
	diffs[id] = true
end
check("seven difficulties", #B.DIFFICULTIES == 7)
for _, id in ipairs(B.DIFFICULTIES) do
	check("difficulty exists in rules.json " .. id, diffs[id])
end
local content = {}
for i, id in ipairs(B.DIFFICULTIES) do
	content[i] = rules.difficulties[id].contentCitizens
	if i > 1 then
		check("difficulties are listed easiest first " .. id, content[i] <= content[i - 1], content[i])
	end
end
local eras = {}
for _, def in pairs(techs) do
	eras[def.era] = true
end
for _, era in ipairs(B.ERAS) do
	check("era exists in techs.json " .. era, eras[era])
end
for era in pairs(eras) do
	check("era has a badge " .. era, B.byKey["era-" .. era] ~= nil)
end
check("max civs matches rules.maxCivsBySize", B.MAX_CIVS == rules.maxCivsBySize.medium, rules.maxCivsBySize.medium)
local nTech = 0
for _ in pairs(techs) do
	nTech += 1
end
check("half the tree is half", B.byKey["techs-34"].n == nTech / 2, nTech)

-- every event type the rules read is emitted by the engine port
local engine = {}
for _, name in ipairs(fs.readDir("luau")) do
	if name:match("%.luau$") then
		engine[#engine + 1] = fs.readFile("luau/" .. name)
	end
end
local engineText = table.concat(engine, "\n")
local src = fs.readFile("roblox/src/server/BadgeRules.luau")
local nEvents = 0
for ev in src:gmatch('[^%w]t == "(%a+)"') do
	nEvents += 1
	check("engine emits " .. ev, engineText:find('type = "' .. ev .. '"', 1, true) ~= nil)
end
check("event names were read", nEvents >= 14, nEvents)
check("future tech id matches the engine", engineText:find('FUTURE_TECH_ID = "future-tech"', 1, true) ~= nil)

-- earning
local state = { players = { p1 = { gold = 1200, techs = {} }, p2 = { gold = 9999, techs = {} } },
	cities = { c1 = { owner = "p1" }, c2 = { owner = "p2" } } }
local p = B.newProgress()
B.onEvents(p, {
	{ type = "cityFounded", cityId = "c1" }, { type = "cityFounded", cityId = "c2" },
	{ type = "unitBuilt", cityId = "c1" }, { type = "techDiscovered", playerId = "p1", tech = "alphabet" },
	{ type = "techDiscovered", playerId = "p2", tech = "alphabet" },
	{ type = "combatResolved", attackerOwner = "p1", defenderOwner = "p2", winner = "attacker" },
	{ type = "combatResolved", attackerOwner = "p2", defenderOwner = "p1", winner = "defender" },
	{ type = "combatResolved", attackerOwner = "p2", defenderOwner = "p1", winner = "attacker" },
	{ type = "cityCaptured", from = "p2", to = "p1" }, { type = "cityCaptured", from = "p1", to = "p2" },
	{ type = "cityGrew", cityId = "c1", pop = 7 }, { type = "cityGrew", cityId = "c2", pop = 30 },
}, state, "p1", rs)
check("own city founded only", p.citiesFounded == 1, p.citiesFounded)
check("own tech only", p.techs == 1)
check("battles: an attack won and a defence held", p.battlesWon == 2 and p.defencesWon == 1, p.battlesWon)
check("captures: only what this player took", p.captures == 1)
check("largest own city", p.largestCity == 7)
check("peak gold from the treasury", p.peakGold == 1200)
local got = B.newlyEarned(p, nil)
table.sort(got)
check("first batch", table.concat(got, ",") == "first-capture,first-city,first-tech,first-unit,first-win,gold-1000", table.concat(got, ","))
check("a badge is earned once", #B.newlyEarned(p, nil) == 0)
state.players.p1.gold = 10
B.onEvents(p, {}, state, "p1", rs)
check("peak gold does not fall", p.peakGold == 1200)

-- eras: complete when every advance of the era is known, not before
local ancient, all = {}, {}
for id, def in pairs(techs) do
	all[#all + 1] = id
	if def.era == "ancient" then
		ancient[#ancient + 1] = id
	end
end
local q = B.newProgress()
local st2 = { players = { p1 = { gold = 0, techs = ancient } }, cities = {} }
table.remove(st2.players.p1.techs)
B.onEvents(q, {}, st2, "p1", rs)
check("one ancient advance short: no badge", q.era_ancient ~= true)
st2.players.p1.techs = {}
for id, def in pairs(techs) do
	if def.era == "ancient" then
		table.insert(st2.players.p1.techs, id)
	end
end
B.onEvents(q, {}, st2, "p1", rs)
check("all ancient advances: badge", q.era_ancient == true and q.era_modern ~= true)
st2.players.p1.techs = all
B.onEvents(q, {}, st2, "p1", rs)
check("all advances: every era", q.era_renaissance and q.era_industrial and q.era_modern)
local fresh = B.newProgress()
B.onEvents(fresh, {}, { players = { p1 = { gold = 0, techs = {} } }, cities = {} }, "p1", rs)
check("no advances: no era", fresh.era_ancient ~= true)

-- victories
local function wins(info)
	local pr = B.newProgress()
	local out = {}
	for _, k in ipairs(B.newlyEarned(pr, info)) do
		out[k] = true
	end
	return out
end
local base = { won = true, victory = "score", difficulty = "prince", civs = 7, combat = "bestof3", heldShare = 1 }
local w = wins(base)
check("prince win: the ladder up to prince", w["win-any"] and w["win-chieftain"] and w["win-warlord"] and w["win-prince"] and not w["win-king"])
check("7 civs", w["win-civs-7"] and not w["win-civs-14"])
check("score win is not conquest or space", not w["win-conquest"] and not w["win-space"] and not w["win-authentic"])
w = wins({ won = true, victory = "space", difficulty = "godemperor", civs = 14, combat = "authentic", heldShare = 0.5 })
check("the hardest win takes everything", w["win-ultimate"] and w["win-godemperor"] and w["win-civs-14"] and w["win-space"] and w["win-authentic"])
w = wins({ won = true, victory = "conquest", difficulty = "godemperor", civs = 13, combat = "bestof3", heldShare = 1 })
check("13 civs is not the ultimate", not w["win-ultimate"] and w["win-conquest"])
w = wins({ won = false, victory = "score", difficulty = "godemperor", civs = 14, combat = "bestof3", heldShare = 1 })
check("losing earns no victory badge", next(w) == nil)
w = wins({ won = true, victory = "score", difficulty = "godemperor", civs = 14, combat = "bestof3", heldShare = 0.49 })
check("the regent's win is not the player's", next(w) == nil)
w = wins({ won = true, victory = "score", difficulty = "trainer", civs = 2, combat = "bestof3", heldShare = 1 })
check("trainer win: Victory only", w["win-any"] and not w["win-chieftain"])
w = wins({ won = true, victory = "score", difficulty = "easy", civs = 2, combat = "bestof3", heldShare = 1 })
check("an unknown difficulty id earns no difficulty badge", w["win-any"] and not w["win-chieftain"])
local dbg = B.newProgress()
dbg.citiesFounded = 30
check("a debug game earns nothing at the end", #B.newlyEarned(dbg, { won = true, debugUsed = true, heldShare = 1, difficulty = "king", civs = 7 }) == 0)
dbg.debug = true
check("a debug game earns nothing during play", #B.newlyEarned(dbg, nil) == 0)
local late = B.newProgress()
late.citiesFounded = 30
check("count badges still arrive at game over", #B.newlyEarned(late, { won = false, heldShare = 0 }) == 4)

if fails > 0 then
	error(fails .. " badge pin(s) failed")
end
print(("badge-rules: %d badges, %d event types"):format(#B.BADGES, nEvents))
