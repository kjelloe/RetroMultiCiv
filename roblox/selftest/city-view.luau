-- check.sh gate 59: city screen rules (CityView): food and growth, the
-- specialist commands the engine accepts, capital, routes, city cycling.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local V = require("../src/client/CityView")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end
local rules = serde.decode("json", fs.readFile("data/rules.json"))
local buildings = serde.decode("json", fs.readFile("data/buildings.json"))
local rs = { rules = rules, buildings = buildings.buildings or buildings }

-- the constants are the engine's
local engine = fs.readFile("luau/cities.luau")
check("engine eats pop * 2", engine:find("yields.food - city.pop * 2 - settlerFood", 1, true) ~= nil and V.FOOD_PER_CITIZEN == 2)
check("engine: specialists need pop 5", engine:find("city.pop < 5", 1, true) ~= nil and V.SPECIALIST_MIN_POP == 5)
check("rules carry settlerFoodUpkeep", type(rules.settlerFoodUpkeep) == "number")

-- food
local f = V.food({ pop = 3, food = 10 }, 9, 0, rules, 40)
check("growing: surplus", f.state == "growing" and f.surplus == 3 and f.eaten == 6)
check("growing: turns = ceil((40-10)/3)", f.turns == 10 and f.line == "grows in 10 turns", f.line)
check("growing: no warning", f.warn == nil)
f = V.food({ pop = 3, food = 39 }, 9, 0, rules, 40)
check("one turn, singular", f.turns == 1 and f.line == "grows in 1 turn", f.line)
f = V.food({ pop = 3, food = 45 }, 9, 0, rules, 40)
check("a full box still says one turn", f.turns == 1)
f = V.food({ pop = 3, food = 10 }, 6, 0, rules, 40)
check("stalled", f.state == "stalled" and f.surplus == 0 and f.warn ~= nil and f.turns == nil)
f = V.food({ pop = 3, food = 5 }, 4, 0, rules, 40)
check("starving", f.state == "starving" and f.surplus == -2 and f.turns == 3, f.turns)
check("starving line", f.line:find("STARVING: 2 food a turn short", 1, true) ~= nil, f.line)
f = V.food({ pop = 3, food = 5 }, 7, 2, rules, 40)
check("settlers eat", f.settlerFood == 2 * rules.settlerFoodUpkeep and f.surplus == 7 - 6 - 2 * rules.settlerFoodUpkeep)
check("settlers named as the cause", f.state == "starving" and f.warn:find("Settlers", 1, true) ~= nil, f.warn)
check("settlers homed", V.settlersHomed({ units = { a = { home = "c1", type = "settlers" }, b = { home = "c1", type = "militia" },
	c = { home = "c2", type = "settlers" }, d = { type = "settlers" } } }, "c1") == 1)

-- specialists: what the engine's setWorkers accepts
local big = { id = "c1", pop = 6 }
local s = V.specialists(big, { entertainers = 2, taxmen = 1, scientists = 0 })
check("can add and clear", s.canAdd and s.canClear and s.why == nil)
s = V.specialists({ id = "c1", pop = 4 }, { entertainers = 2, taxmen = 0, scientists = 0 })
check("too small", not s.canAdd and not s.canClear and s.why:find("size 5", 1, true) ~= nil)
s = V.specialists(big, { entertainers = 0, taxmen = 0, scientists = 0 })
check("nobody free", not s.canAdd and s.why:find("Take a worker off", 1, true) ~= nil)
local cmd = V.specialistCommand(big, { entertainers = 2, taxmen = 1, scientists = 0 }, { 30, 12, 21 }, "scientist")
check("scientist command", cmd ~= nil and cmd.type == "setWorkers" and cmd.cityId == "c1" and cmd.taxmen == 1 and cmd.scientists == 1)
check("workers kept, sorted", table.concat(cmd.workers, ",") == "12,21,30")
check("within the population", #cmd.workers + cmd.taxmen + cmd.scientists <= big.pop)
cmd = V.specialistCommand(big, { entertainers = 2, taxmen = 1, scientists = 0 }, { 30, 12, 21 }, "taxman")
check("taxman command", cmd.taxmen == 2 and cmd.scientists == 0)
cmd = V.specialistCommand(big, { entertainers = 0, taxmen = 2, scientists = 1 }, { 30, 12, 21 }, "clear")
check("clear command", cmd.taxmen == 0 and cmd.scientists == 0)
check("no entertainer: no command", V.specialistCommand(big, { entertainers = 0, taxmen = 1, scientists = 0 }, { 1, 2, 3, 4, 5 }, "taxman") == nil)
check("small city: no command", V.specialistCommand({ id = "c", pop = 4 }, { entertainers = 3, taxmen = 0, scientists = 0 }, { 1 }, "taxman") == nil)
check("nothing to clear: no command", V.specialistCommand(big, { entertainers = 2, taxmen = 0, scientists = 0 }, {}, "clear") == nil)
check("never more people than the city has", V.specialistCommand(big, { entertainers = 1, taxmen = 0, scientists = 0 }, { 1, 2, 3, 4, 5, 6 }, "taxman") == nil)
check("unknown action", V.specialistCommand(big, { entertainers = 2, taxmen = 0, scientists = 0 }, {}, "dance") == nil)

-- capital: the building whose effect says palace, from the real ruleset
local palace = nil
for id, def in pairs(rs.buildings) do
	if def.effect ~= nil and def.effect.isPalace == true then
		palace = id
	end
end
check("the ruleset has a palace", palace ~= nil)
check("capital", V.isCapital({ buildings = { "temple", palace } }, rs) and not V.isCapital({ buildings = { "temple" } }, rs) and not V.isCapital({}, rs))
do
	local v = { cityOrder = { "c1", "c2" }, cities = { c1 = { id = "c1", owner = "p1" }, c2 = { id = "c2", owner = "p1" } } }
	check("capital falls back to the first city", V.isCapital(v.cities.c1, rs, v) and not V.isCapital(v.cities.c2, rs, v))
	v.cities.c2.buildings = { palace }
	check("a palace elsewhere wins over the first city", V.isCapital(v.cities.c2, rs, v) and not V.isCapital(v.cities.c1, rs, v))
end
local text, tone = V.subtitle({ pop = 7, buildings = { palace } }, rs)
check("subtitle: capital", text == "population 7  -  capital" and tone == "plain", text)
text, tone = V.subtitle({ pop = 7, disorder = true, celebrating = true }, rs)
check("subtitle: disorder wins", tone == "bad" and text:find("CIVIL DISORDER", 1, true) ~= nil)
text, tone = V.subtitle({ pop = 7, celebrating = true }, rs)
check("subtitle: celebration", tone == "good")

-- routes
local routes = V.routes({ { partnerCityId = "c2", arrows = 4, counted = true }, { partnerCityId = "c9", arrows = 1, counted = false } },
	{ cities = { c2 = { name = "Ur" } } })
check("routes", #routes == 2 and routes[1].name == "Ur" and routes[1].arrows == 4 and routes[1].counted and routes[2].name == "a distant city" and not routes[2].counted)
check("no routes", #V.routes(nil, {}) == 0)

-- cycling
local view = { you = "p1", cityOrder = { "c1", "c2", "c3", "c4" },
	cities = { c1 = { owner = "p1", pop = 1 }, c2 = { owner = "p2", pop = 1 }, c3 = { owner = "p1", pop = 2 }, c4 = { owner = "p1", pop = 3 } } }
check("next skips rival cities", V.neighbour(view, "c1", 1) == "c3")
check("next wraps", V.neighbour(view, "c4", 1) == "c1")
check("previous wraps", V.neighbour(view, "c1", -1) == "c4")
check("previous", V.neighbour(view, "c4", -1) == "c3")
view.cities.c3, view.cities.c4 = nil, nil
check("one city: no neighbour", V.neighbour(view, "c1", 1) == nil)
check("unknown city: no neighbour", V.neighbour(view, "zz", 1) == nil)

-- build queue reorder
local q = { "a", "b", "c" }
local moved = V.queueMove(q, 2, -1)
check("earlier", moved ~= nil and table.concat(moved) == "bac" and table.concat(q) == "abc")
moved = V.queueMove(q, 2, 1)
check("later", moved ~= nil and table.concat(moved) == "acb")
check("first cannot go earlier", V.queueMove(q, 1, -1) == nil)
check("last cannot go later", V.queueMove(q, 3, 1) == nil)
check("no such item", V.queueMove(q, 9, -1) == nil)

-- row pictures
local size, nameX = V.thumb("building", 28, true)
check("building row picture", size == 22 and nameX == 10 + 22 + V.THUMB_GAP)
size = V.thumb("wonder", 46, true)
check("two-line row picture is taller", size == 40)
size, nameX = V.thumb("unit", 46, true)
check("unit rows have no picture", size == 0 and nameX == 12)
size, nameX = V.thumb("building", 28, false)
check("no model, no picture", size == 0 and nameX == 12)

if fails > 0 then
	error(fails .. " city view pin(s) failed")
end
print("city-view: food, specialists, capital, routes, cycling")
