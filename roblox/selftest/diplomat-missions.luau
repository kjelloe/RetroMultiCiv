-- check.sh gate 72: diplomat missions (DiplomatMissions, plan R3). The prices
-- the menu shows are the prices luau/diplomat-missions charges: at the shown
-- price the mission goes through, one gold short it is refused notEnoughGold,
-- for every difficulty. Menu, adjacency and outcome lines are pinned too.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local D = require("../src/client/DiplomatMissions")
local engine = require("../../luau/diplomat-missions")

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
local rs = { units = load("units"), buildings = load("buildings"), techs = load("techs"),
	rules = serde.decode("json", fs.readFile("data/rules.json")) }

-- p1's diplomat at (5,5); p2's capital far away, its city c1 and a warrior beside the diplomat
local function world(difficulty, gold)
	return {
		turn = 10, activePlayer = "p1", difficulty = difficulty, rngState = 12345,
		map = { width = 20, height = 20, wrapX = false },
		players = { p1 = { gold = gold, name = "Romans" }, p2 = { gold = 0, name = "Greeks" } },
		cityOrder = { "c0", "c1" },
		cities = {
			c0 = { id = "c0", owner = "p2", name = "Athens", x = 15, y = 15, pop = 4, buildings = {} },
			c1 = { id = "c1", owner = "p2", name = "Sparta", x = 6, y = 5, pop = 3, buildings = {} },
		},
		units = {
			d1 = { id = "d1", owner = "p1", type = "diplomat", x = 5, y = 5, moves = 1 },
			w1 = { id = "w1", owner = "p2", type = "militia", x = 4, y = 6, moves = 1 },
		},
	}
end
local function view(st)
	return { you = "p1", difficulty = st.difficulty, map = st.map, players = st.players,
		cityOrder = st.cityOrder, cities = st.cities, units = st.units }
end

local levels = 0
for diff in pairs(rs.rules.difficulties) do
	levels += 1
	local menu = D.menu(view(world(diff, 0)), world(diff, 0).units.d1, rs)
	local price = {}
	for _, m in ipairs(menu) do
		price[m.id] = m.cost
	end
	for _, pair in ipairs({ { "inciteRevolt", { targetCityId = "c1" } }, { "bribeUnit", { targetUnitId = "w1" } } }) do
		local id, extra = pair[1], pair[2]
		local cost = price[id]
		check(diff .. " " .. id .. " has a price", cost ~= nil and cost > 0, cost)
		if cost ~= nil then
			local function run(gold)
				local cmd = { type = "diplomatMission", playerId = "p1", unitId = "d1", mission = id }
				for k, v in pairs(extra) do
					cmd[k] = v
				end
				return engine.diplomatMissionCommand(world(diff, gold), cmd, rs)
			end
			local ok = run(cost)
			local short = run(cost - 1)
			check(("%s %s goes through at the shown %d gold"):format(diff, id, cost), ok.ok == true, ok.reason)
			check(("%s %s is refused one gold short"):format(diff, id), short.ok == false and short.reason == "notEnoughGold", short.reason)
		end
	end
	check(diff .. " incite price = engine inciteCost", price.inciteRevolt == engine.inciteCost(world(diff, 0), world(diff, 0).cities.c1, rs))
end
check("every difficulty checked", levels >= 5, levels)

-- menu and adjacency
local st = world("prince", 5000)
local menu = D.menu(view(st), st.units.d1, rs)
check("six missions beside a city and a unit", #menu == 6, #menu)
check("menu order", menu[1].id == "establishEmbassy" and menu[6].id == "bribeUnit")
check("city missions aim at the city", menu[1].cmd.targetCityId == "c1" and menu[1].targetName == "Sparta")
check("bribe aims at the unit", menu[6].cmd.targetUnitId == "w1" and menu[6].cmd.type == "diplomatMission")
check("affordable with 5000 gold", menu[5].affordable and menu[6].affordable)
check("price on the button", D.buttonText(menu[5]):find("gold", 1, true) ~= nil and D.buttonText(menu[1]) == "Establish Embassy")
st.players.p1.gold = 0
check("not affordable with 0 gold", not D.menu(view(st), st.units.d1, rs)[5].affordable)
st.units.d1.x, st.units.d1.y = 1, 1
check("nothing beside: no missions", #D.menu(view(st), st.units.d1, rs) == 0)
st.units.d1.x, st.units.d1.y = 5, 5
st.cities.c1.owner = "barb"
st.units.w1.owner = "barb"
check("barbarians are not targets", #D.menu(view(st), st.units.d1, rs) == 0)
check("not a diplomat: no missions", #D.menu(view(world("prince", 0)), { type = "settlers", x = 5, y = 5 }, rs) == 0)
check("wraps across the date line", D.within1({ width = 20, wrapX = true }, 0, 3, 19, 4) and not D.within1({ width = 20, wrapX = false }, 0, 3, 19, 4))

-- outcome lines
local v = view(world("prince", 0))
check("embassy line", D.outcome({ type = "EMBASSY_ESTABLISHED", atCivId = "p2" }, v, rs) == "[spy] embassy established with Greeks")
check("incite line", D.outcome({ type = "CITY_INCITED", cityId = "c1", gold = 225 }, v, rs):find("Sparta", 1, true) ~= nil)
check("thwarted theft", D.outcome({ type = "TECH_STOLEN", fromCivId = "p2" }, v, rs):find("thwarted", 1, true) ~= nil)
check("other events pass", D.outcome({ type = "cityGrew" }, v, rs) == nil)
for _, r in pairs(D.REASONS) do
	check("reason text " .. r, #r > 10)
end

if fails > 0 then
	error(("diplomat-missions: %d failure(s)"):format(fails))
end
print(("diplomat-missions: prices match the engine on %d difficulties; menu, adjacency, outcomes"):format(levels))
