-- check.sh gate 60: empire overview rules (EmpireView) over a real game: the
-- Economy statement sums to tech.playerIncome for every civ, from the engine
-- state and from the player's own view; per-city upkeep and yields.
local fs = require("@lune/fs")
local json2lua = require("../../luau/json2lua")
local index = require("../../luau/index")
local fastforward = require("../../luau/fastforward")
local statehash = require("../../luau/statehash")
local visibility = require("../../luau/visibility")
local deps = { tech = require("../../luau/tech"), cities = require("../../luau/cities"),
	government = require("../../luau/government"), happiness = require("../../luau/happiness") }
local E = require("../src/client/EmpireView")

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
local players = setmetatable({}, statehash.ARRAY_MT)
for i, id in ipairs({ "romans", "babylonians", "germans" }) do
	table.insert(players, { id = "p" .. i, name = rs.civs[id].name, color = rs.civs[id].color, human = i == 1 })
end
local engine = index.createEngine(rs)
local created = engine.createGame({ seed = 20260718,
	options = { width = 40, height = 25, players = players, mapType = "continents" } })
local r = fastforward.fastForwardTo(rs, created, { id = "probe", turn = 120, grantEras = {} }, { "p1" })
assert(r.aborted == nil, "fast-forward aborted")
local state = r.state

local function sums(eco)
	local income, cost = 0, 0
	for _, row in ipairs(eco.rows) do
		if row.kind == "income" then
			income += row.amount
		elseif row.kind == "cost" then
			cost -= row.amount
		end
	end
	return income, cost
end

local cityCount, costRows, upkeepSeen, specialistsSeen = 0, 0, 0, 0
for _, pid in ipairs(state.playerOrder) do
	local inc = deps.tech.playerIncome(state, pid, rs)
	local eco = E.economy(state, pid, rs, deps)
	local income, cost = sums(eco)
	check(pid .. ": net is the engine's", eco.net == inc.gold - inc.maintenance)
	check(pid .. ": income rows sum to playerIncome.gold", income == inc.gold, ("%d vs %d"):format(income, inc.gold))
	check(pid .. ": cost rows sum to maintenance", cost == inc.maintenance, ("%d vs %d"):format(cost, inc.maintenance))
	costRows += cost
	-- the same statement from what the client holds
	local view = visibility.filterView(state, pid, rs)
	local shim = E.shim(view)
	local fromView = E.economy(shim, pid, rs, deps)
	check(pid .. ": view statement equals the state's", fromView.net == eco.net and #fromView.rows == #eco.rows,
		("%d vs %d"):format(fromView.net, eco.net))
	local total = fromView.rows[#fromView.rows]
	for _, row in ipairs(fromView.rows) do
		if row.kind == "total" then
			total = row
		end
	end
	check(pid .. ": total row carries the net", eco.empty ~= nil or total.kind == "total" and total.amount == eco.net)
	local goldSum, upGold = 0, 0
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == pid and c.pop ~= nil then
			cityCount += 1
			local row = E.cityRow(shim, c, rs, deps)
			local full = E.cityRow(state, state.cities[cid], rs, deps)
			check(cid .. ": row from the view equals the state's", row.food == full.food and row.shields == full.shields
				and row.trade == full.trade and row.gold == full.gold and row.upkeep.shields == full.upkeep.shields)
			local y = deps.cities.cityYields(state, state.cities[cid], rs, deps.cities.resolveAllWorked(state, rs)[cid])
			check(cid .. ": yields are the engine's", row.food == y.food and row.shields == y.shields and row.trade == y.trade)
			local mood = deps.happiness.cityMood(state, state.cities[cid], rs)
			check(cid .. ": specialists are the engine's", row.entertainers == mood.entertainers and row.taxmen == mood.taxmen
				and row.scientists == mood.scientists, ("%s/%s/%s"):format(tostring(row.entertainers), tostring(row.taxmen), tostring(row.scientists)))
			specialistsSeen += (row.entertainers or 0) + (row.taxmen or 0) + (row.scientists or 0)
			goldSum += row.gold
			upGold += row.upkeep.gold
			upkeepSeen += row.upkeep.shields + row.upkeep.food
		end
	end
	check(pid .. ": city rows sum to the income", goldSum == inc.gold and upGold == inc.maintenance)
	local capitals = 0
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == pid and c.pop ~= nil and E.cityRow(shim, c, rs, deps).capital then
			capitals += 1
			check(pid .. ": capital is the engine's", deps.government.capitalOf(state, pid, rs).id == cid)
		end
	end
	check(pid .. ": exactly one capital", capitals == (eco.empty == nil and 1 or 0), capitals)
end
-- activity: the game must actually exercise the figures
check("the game has cities", cityCount >= 6, cityCount)
check("the game has building costs", costRows > 0, costRows)
-- the sampled game is early (no specialists yet): a crafted city has some
do
	local pid = state.playerOrder[1]
	local view = visibility.filterView(state, pid, rs)
	local shim = E.shim(view)
	local cid = shim.cityOrder[1]
	local c = table.clone(shim.cities[cid])
	c.pop, c.workers, c.taxmen, c.scientists = 7, {}, 1, 1
	shim.cities[cid] = c
	local row = E.cityRow(shim, c, rs, deps)
	local mood = deps.happiness.cityMood(shim, c, rs)
	specialistsSeen += (row.entertainers or 0) + row.taxmen + row.scientists
	check("crafted city: specialists are the engine's", row.entertainers == mood.entertainers and row.taxmen == 1
		and row.scientists == 1, ("%s/%s/%s"):format(tostring(row.entertainers), tostring(row.taxmen), tostring(row.scientists)))
end
check("specialists exercised", specialistsSeen > 0, specialistsSeen)
check("specialist text", E.specialistText({ entertainers = 2, taxmen = 1, scientists = 0 }) == "2 entertainers, 1 tax collector"
	and E.specialistText({ entertainers = 0, taxmen = 0, scientists = 0 }) == "no specialists" and E.specialistText({}) == nil)

-- upkeep on a crafted city (despotism rules from the real ruleset)
local gov = rs.governments.despotism
local crafted = { players = { p1 = { government = "despotism" } }, cityOrder = { "c1" },
	cities = { c1 = { id = "c1", owner = "p1", pop = 3, buildings = { "temple", "barracks" } } }, units = {} }
for i = 1, gov.freeUnitsPerCity + 2 do
	crafted.units["u" .. i] = { type = "militia", home = "c1" }
end
crafted.units.s1 = { type = "settlers", home = "c1" }
crafted.units.far = { type = "militia", home = "c9" }
local settlersFree = rs.units.settlers.freeSupport == true
local up = E.upkeep(crafted, crafted.cities.c1, rs, deps)
check("building gold", up.gold == rs.buildings.temple.maintenance + rs.buildings.barracks.maintenance, up.gold)
check("unit shields above the free allowance", up.shields == (2 + (settlersFree and 0 or 1)) * gov.upkeepShields, up.shields)
check("settler food", up.food == (rs.rules.settlerFoodUpkeep or 0), up.food)
check("upkeep text", E.upkeepText({ gold = 2, shields = 1, food = 0 }) == "2 gold, 1 shield"
	and E.upkeepText({ gold = 0, shields = 0, food = 0 }) == "none"
	and E.upkeepText({ gold = 0, shields = 3, food = 1 }) == "3 shields, 1 food")
check("amount text", E.amountText({ amount = 4, unit = "gold" }) == "+4" and E.amountText({ amount = -2, unit = "shields" }) == "-2 shields"
	and E.amountText({ unit = "gold" }) == "")
local none = E.economy({ players = { p1 = { gold = 7 } }, cities = {}, cityOrder = {} }, "p1", rs, deps)
check("no cities: empty statement", none.empty ~= nil and #none.rows == 0 and none.treasury == 7)

print("empire-view: economy statement vs playerIncome, city rows, upkeep")
if fails > 0 then
	error(("%d empire-view check(s) failed"):format(fails))
end
