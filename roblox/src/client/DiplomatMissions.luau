-- Diplomat missions (plan R3; the browser's input.js D6 menu): which missions
-- a Diplomat beside a rival city or unit offers, the gold each one costs, and
-- the line each outcome reads. Pure. roblox/selftest/diplomat-missions.luau
-- (gate 72) holds the prices to luau/diplomat-missions (the engine charges).
local M = {}

M.BARB = "barb"
M.DEFAULT_DEMAND_PCT = 20
M.INCITE_GOLD_PER_POP = 100
M.BRIBE_GOLD_PER_COST = 10

-- the browser's labels and one-line explanations, in menu order
M.MISSIONS = {
	{ id = "establishEmbassy", label = "Establish Embassy", target = "city",
		title = "Shows a rival capital's government, treasury, advance count and where it is" },
	{ id = "investigateCity", label = "Investigate", target = "city",
		title = "A one-time look at the city's size, production and shields" },
	{ id = "stealTech", label = "Steal Tech", target = "city",
		title = "A chance to steal one advance - once per city" },
	{ id = "sabotage", label = "Sabotage", target = "city",
		title = "A chance to wreck the production in progress" },
	{ id = "inciteRevolt", label = "Incite Revolt", target = "city", paid = true,
		title = "Pay gold to turn a city that is not a capital to your side" },
	{ id = "bribeUnit", label = "Bribe Unit", target = "unit", paid = true,
		title = "Pay gold to turn a rival unit to your side" },
}

function M.within1(map, ax, ay, bx, by)
	local dx = math.abs(ax - bx)
	if map.wrapX and map.width - dx < dx then
		dx = map.width - dx
	end
	return math.max(dx, math.abs(ay - by)) <= 1
end

-- the first rival (not barbarian) city and unit beside the diplomat, in the
-- view's order (cityOrder; units by id)
function M.adjacent(view, unit)
	local city, rival = nil, nil
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner ~= view.you and c.owner ~= M.BARB and M.within1(view.map, unit.x, unit.y, c.x, c.y) then
			city = c
			break
		end
	end
	local ids = {}
	for id, u in pairs(view.units) do
		if u.owner ~= view.you and u.owner ~= M.BARB and M.within1(view.map, unit.x, unit.y, u.x, u.y) then
			ids[#ids + 1] = id
		end
	end
	table.sort(ids)
	if ids[1] ~= nil then
		rival = view.units[ids[1]]
	end
	return city, rival
end

function M.demandPct(view, rs)
	local levels = rs.rules.difficulties
	local row = view.difficulty ~= nil and levels ~= nil and levels[view.difficulty] or nil
	return row ~= nil and row.parleyDemandPct ~= nil and row.parleyDemandPct or M.DEFAULT_DEMAND_PCT
end

function M.inciteCost(pop, pct)
	return math.floor(pop * M.INCITE_GOLD_PER_POP * pct / 20)
end

function M.bribeCost(unitCost, pct)
	return math.floor(unitCost * M.BRIBE_GOLD_PER_COST * pct / 20)
end

-- -> { { id, label, title, cost (paid ones), affordable, cmd } } for the
-- selected diplomat; empty when nothing rival is beside it
function M.menu(view, unit, rs)
	local out = {}
	if unit == nil or unit.type ~= "diplomat" then
		return out
	end
	local city, rival = M.adjacent(view, unit)
	local pct = M.demandPct(view, rs)
	local gold = (view.players[view.you] or {}).gold or 0
	for _, m in ipairs(M.MISSIONS) do
		local entry = nil
		if m.target == "city" and city ~= nil then
			entry = { id = m.id, label = m.label, title = m.title, targetName = city.name,
				cmd = { type = "diplomatMission", unitId = unit.id, mission = m.id, targetCityId = city.id } }
			if m.id == "inciteRevolt" then
				entry.cost = M.inciteCost(city.pop or 1, pct)
			end
		elseif m.target == "unit" and rival ~= nil then
			local def = rs.units[rival.type]
			entry = { id = m.id, label = m.label, title = m.title, targetName = def ~= nil and def.name or rival.type,
				cost = M.bribeCost(def ~= nil and def.cost or 0, pct),
				cmd = { type = "diplomatMission", unitId = unit.id, mission = m.id, targetUnitId = rival.id } }
		end
		if entry ~= nil then
			entry.affordable = entry.cost == nil or gold >= entry.cost
			out[#out + 1] = entry
		end
	end
	return out
end

-- the button text: label, then the price when there is one
function M.buttonText(entry)
	if entry.cost ~= nil then
		return ("%s  (%d gold)"):format(entry.label, entry.cost)
	end
	return entry.label
end

-- the engine's refusals for a mission, in the browser's words
M.REASONS = {
	notADiplomat = "only a Diplomat can run these missions",
	notACapital = "an embassy is established only in a rival capital",
	cannotInciteCapital = "a capital cannot be incited - it must be taken by force",
	alreadyStolen = "this city has already been robbed of an advance",
	noMoves = "this Diplomat has no moves left this turn",
	noSuchTarget = "move the Diplomat beside the rival city or unit first",
	notEnoughGold = "not enough gold for this mission",
}

-- one outcome event -> the turn log line for the acting player, or nil
function M.outcome(e, view, rs)
	local function civName(pid)
		local p = view.players ~= nil and view.players[pid] or nil
		return p ~= nil and p.name or tostring(pid)
	end
	local function cityName(id)
		local c = view.cities ~= nil and view.cities[id] or nil
		return c ~= nil and c.name or "the city"
	end
	if e.type == "EMBASSY_ESTABLISHED" then
		return ("[spy] embassy established with %s"):format(civName(e.atCivId))
	elseif e.type == "TECH_STOLEN" then
		if e.tech ~= nil and rs.techs[e.tech] ~= nil then
			return ("[spy] stole %s from %s"):format(rs.techs[e.tech].name, civName(e.fromCivId))
		end
		return "[spy] the theft was thwarted - nothing gained"
	elseif e.type == "SABOTAGE" then
		return e.success and "[spy] sabotage succeeded - their production is wrecked" or "[spy] the sabotage was foiled"
	elseif e.type == "CITY_INCITED" then
		return ("[spy] %s incited to revolt (-%d gold)"):format(cityName(e.cityId), e.gold or 0)
	elseif e.type == "UNIT_BRIBED" then
		return ("[spy] a rival unit bribed to your side (-%d gold)"):format(e.gold or 0)
	elseif e.type == "CITY_INVESTIGATED" then
		local building = e.producing ~= nil and e.producing ~= "" and (" - building " .. tostring(e.producing)) or ""
		return ("[spy] %s: population %d, %d shields%s"):format(cityName(e.cityId), e.pop or 0, e.shields or 0, building)
	elseif e.type == "ESPIONAGE_EXPOSED" then
		return ("[spy] %s traced the %s mission back to %s"):format(civName(e.atCivId), tostring(e.mission), civName(e.byCivId))
	end
	return nil
end

return M
