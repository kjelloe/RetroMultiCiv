-- check.sh gate 62: unit order rules (UnitOrders) against the engine: every
-- settlers job the rules open is accepted by improvements.startWork and every
-- one they grey is refused, on every terrain; labels; Help Wonder; disband
-- confirm; route dots.
local fs = require("@lune/fs")
local json2lua = require("../../luau/json2lua")
local improvements = require("../../luau/improvements")
local cities = require("../../luau/cities")
local U = require("../src/client/UnitOrders")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end
local rs = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	rs[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end
local deps = { improvements = improvements }
local ALL = { rs.rules.railroadTech, rs.rules.fortressTech, rs.rules.bridgeTech }

-- a 3x3 world with the unit in the middle; around = the eight other tiles
local function world(centre, around, techs, unit)
	local tiles = {}
	for i = 1, 9 do
		tiles[i] = { t = around or "plains" }
	end
	tiles[5] = centre
	local u = unit or { id = "u1", owner = "p1", type = "settlers", x = 1, y = 1, moves = 1 }
	return { you = "p1", activePlayer = "p1", map = { width = 3, height = 3, wrapX = false, tiles = tiles },
		players = { p1 = { techs = techs or {} } }, units = { [u.id] = u }, cities = {}, cityOrder = {} }, u
end
local function copy(t)
	local out = {}
	for k, v in pairs(t) do
		out[k] = type(v) == "table" and copy(v) or v
	end
	return out
end
local ME = { myTurn = true }

-- the rules agree with the engine on every terrain x flag x tech x job
local agreed, opened = 0, 0
for terrainId in pairs(rs.terrain.terrains) do
	for _, flags in ipairs({ {}, { road = true }, { river = true }, { irrigation = true }, { mine = true },
		{ road = true, railroad = true }, { fortress = true }, { road = true, river = true } }) do
		for _, techs in ipairs({ {}, ALL }) do
			for _, around in ipairs({ "plains", "ocean" }) do
				for _, action in ipairs({ "irrigate", "mine", "road", "fortress" }) do
					local tile = copy(flags)
					tile.t = terrainId
					local view, u = world(tile, around, techs)
					local o = U.order(action, view, u, rs, ME, deps)
					local state = copy(view)
					local res = improvements.startWork(state, { type = "startWork", playerId = "p1", unitId = "u1", work = o.work or action }, rs)
					local tag = ("%s on %s %s techs=%d around=%s"):format(action, terrainId,
						(flags.road and "road " or "") .. (flags.river and "river " or "") .. (flags.railroad and "rail " or "")
							.. (flags.irrigation and "irr " or "") .. (flags.mine and "mine " or "") .. (flags.fortress and "fort" or ""), #techs, around)
					check("agrees with the engine: " .. tag, o.enabled == (res.ok == true), ("rules %s (%s), engine %s"):format(tostring(o.enabled), tostring(o.reason), tostring(res.reason)))
					check("a greyed order has a reason: " .. tag, o.enabled or (o.reason ~= nil and #o.reason > 8))
					agreed += 1
					opened += o.enabled and 1 or 0
				end
			end
		end
	end
end
check("the table exercises both outcomes", opened > 100 and agreed - opened > 100, ("%d of %d open"):format(opened, agreed))

-- labels follow the tile
local function label(action, tile, techs)
	local view, u = world(tile, "plains", techs)
	return U.order(action, view, u, rs, ME, deps)
end
check("irrigate on plains", label("irrigate", { t = "plains" }).label == "Irr (I)")
check("swamp drains", label("irrigate", { t = "swamp" }).label == "Drain (I)")
check("forest clears", label("irrigate", { t = "forest" }).label == "Clear (I)" and label("mine", { t = "forest" }).label == "Clear (M)")
check("grassland plants", label("mine", { t = "grassland" }).label == "Plant (M)")
check("hills mine", label("mine", { t = "hills" }).label == "Mine (M)")
check("road", label("road", { t = "plains" }, ALL).label == "Road (R)" and label("road", { t = "plains" }, ALL).work == "road")
local rail = label("road", { t = "plains", road = true }, ALL)
check("roaded tile with the tech: rail", rail.label == "Rail (R)" and rail.work == "railroad" and rail.enabled)
local noRail = label("road", { t = "plains", road = true }, {})
check("roaded tile without the tech: road, already built", noRail.label == "Road (R)" and not noRail.enabled and noRail.reason == "Already built on this tile.")
check("river road names the tech", label("road", { t = "plains", river = true }).reason == ("A road over a river needs %s."):format(rs.techs[rs.rules.bridgeTech].name))
check("dry irrigation names water", label("irrigate", { t = "desert" }).reason:find("water", 1, true) ~= nil)

-- who may do what
local view, u = world({ t = "plains" })
check("not your turn", U.order("fortify", view, u, rs, { myTurn = false }, deps).reason == "Not your turn.")
check("no unit", U.order("fortify", view, nil, rs, ME, deps).reason == "Select one of your units first.")
check("no game", U.order("fortify", nil, nil, rs, ME, deps).enabled == false)
u.moves = 0
check("spent settlers", U.order("road", view, u, rs, ME, deps).reason == "No moves left this turn." and U.order("found", view, u, rs, ME, deps).enabled == false)
check("disband and ride stay open", U.order("disband", view, u, rs, ME, deps).enabled and U.order("possess", view, u, rs, ME, deps).enabled)
local mView, m = world({ t = "plains" }, nil, nil, { id = "u1", owner = "p1", type = "militia", x = 1, y = 1, moves = 1 })
check("militia: no settlers jobs", U.order("mine", mView, m, rs, ME, deps).reason == "Only Settlers can do that.")
check("militia: fortify", U.order("fortify", mView, m, rs, ME, deps).enabled)
m.fortified = true
check("fortified: no fortify", U.order("fortify", mView, m, rs, ME, deps).reason == "Already fortified.")
check("trade needs a caravan", U.order("trade", mView, m, rs, ME, deps).enabled == false)
check("upgrade needs a city", U.order("upgrade", mView, m, rs, ME, deps).enabled == false)

-- GoTo: cancel while on a route
m.fortified = nil
check("goto opens", U.order("goto", mView, m, rs, ME, deps).enabled and U.order("goto", mView, m, rs, ME, deps).label == nil)
local onRoute = U.order("goto", mView, m, rs, { myTurn = true, hasPlan = true }, deps)
check("on a route the button cancels it", onRoute.enabled and onRoute.label == "Cancel route")
m.moves = 0
check("on a route with no moves it still cancels", U.order("goto", mView, m, rs, { myTurn = true, hasPlan = true }, deps).enabled)
check("no moves: goto greyed", U.order("goto", mView, m, rs, ME, deps).enabled == false)

-- Help Wonder, against the engine's helpWonder
local helper = nil
for id, def in pairs(rs.units) do
	if def.helpsWonder == true then
		helper = id
	end
end
check("the ruleset has a wonder helper", helper ~= nil)
local wonderId = next(rs.wonders)
local function helpCase(producing, cityOwner, unitType)
	local v, c = world({ t = "plains" }, nil, nil, { id = "u1", owner = "p1", type = unitType or helper, x = 1, y = 1, moves = 1 })
	if producing ~= nil then
		v.cities.c1 = { id = "c1", owner = cityOwner or "p1", x = 1, y = 1, pop = 3, shields = 0, producing = producing, buildings = {} }
		v.cityOrder = { "c1" }
	end
	v.players.p2 = { techs = {} }
	local o = U.order("helpWonder", v, c, rs, ME, deps)
	local res = cities.helpWonder(copy(v), { type = "helpWonder", playerId = "p1", unitId = "u1" }, rs)
	return o, res
end
local o, res = helpCase({ kind = "wonder", id = wonderId })
check("caravan in a wonder city: open, engine accepts", o.enabled and o.shown and res.ok == true, tostring(res.reason))
check("label carries the shields", o.label == ("Help Wonder +%d"):format(rs.units[helper].cost), o.label)
o, res = helpCase({ kind = "unit", id = "militia" })
check("not building a wonder: greyed, engine refuses", not o.enabled and o.shown and res.ok == false)
o, res = helpCase(nil)
check("no city: greyed, engine refuses", not o.enabled and res.ok == false)
o, res = helpCase({ kind = "wonder", id = wonderId }, "p2")
check("a rival city: greyed, engine refuses", not o.enabled and res.ok == false)
o, res = helpCase({ kind = "wonder", id = wonderId }, "p1", "militia")
check("militia: no button, engine refuses", not o.shown and not o.enabled and res.ok == false)

-- disband asks once more
check("first press arms", U.disbandPress(nil, nil, "u1", 10) == "arm")
check("second press inside the window sends", U.disbandPress("u1", 10, "u1", 10 + U.CONFIRM_WINDOW) == "send")
check("too late arms again", U.disbandPress("u1", 10, "u1", 10.1 + U.CONFIRM_WINDOW) == "arm")
check("another unit arms again", U.disbandPress("u1", 10, "u2", 10.5) == "arm")

-- route dots
local pts = {}
for i = 1, 80 do
	pts[i] = { x = i, y = 0 }
end
local dots = U.routeDots(pts, 32)
check("long route: capped, ends on the destination", #dots == 32 and dots[32].x == 80 and dots[1].x > 1)
for i = 2, #dots do
	check("dots advance", dots[i].x > dots[i - 1].x)
end
local short = U.routeDots({ pts[1], pts[2], pts[3] }, 32)
check("short route: every tile but the unit's", #short == 2 and short[1].x == 2 and short[2].x == 3)
check("no route", #U.routeDots({}, 32) == 0 and #U.routeDots({ pts[1] }, 32) == 0)

check("card: open order shows the title", U.card("Road", { enabled = true }) == "Road")
check("card: greyed order adds why", U.card("Road", { enabled = false, reason = "Needs a road first." }) == "Road\nNeeds a road first.")

print(("unit-orders: %d job cases vs the engine (%d open), labels, help wonder, disband, route"):format(agreed, opened))
if fails > 0 then
	error(fails .. " unit-orders check(s) failed")
end
