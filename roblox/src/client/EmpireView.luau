-- Empire overview rules (plan step 2; pure — roblox/selftest/empire-view.luau,
-- gate 60): the per-city figures of the Cities list and the Economy statement.
-- Twins of client/ui/city-overview.js, econ-overview.js and upkeep.js. Every
-- number comes from the engine helpers handed in as `deps` ({ tech, cities,
-- government }), so the net can not drift from the gold chip
-- (tech.playerIncome). `state` is the engine state or a view shim (M.shim).
local M = {}

-- The view as the engine helpers want it. Own cities only: a rival city shell
-- sits among unexplored tiles the yield code can not read, so a rival's claim
-- on a shared tile is not counted here (the server's turn still counts it).
function M.shim(view)
	local cities, order = {}, {}
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			cities[cid] = c
			order[#order + 1] = cid
		end
	end
	return { map = view.map, players = view.players, cities = cities,
		cityOrder = order, units = view.units, wonders = view.wonders,
		difficulty = view.difficulty, playerOrder = view.playerOrder }
end

local function ownCities(state, pid)
	local out = {}
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == pid and c.pop ~= nil then
			out[#out + 1] = c
		end
	end
	return out
end

local function rates(state, pid, rs)
	local p = state.players[pid]
	return p.taxRate == nil and rs.rules.defaultTaxRate or p.taxRate,
		p.sciRate == nil and rs.rules.defaultSciRate or p.sciRate
end

-- what the city pays each turn: buildings in gold, units in shields, settlers
-- in food (the engine's processCities block; unit upkeep is never gold)
function M.upkeep(state, city, rs, deps)
	local gold = 0
	for _, b in ipairs(city.buildings or {}) do
		local def = rs.buildings[b]
		gold += def ~= nil and def.maintenance or 0
	end
	local gov = deps.government.governmentOf(state, city.owner, rs)
	local supported, settlers = 0, 0
	for _, u in pairs(state.units or {}) do
		if u.home == city.id then
			local def = rs.units[u.type]
			if def ~= nil and def.freeSupport ~= true then
				supported += 1
			end
			if u.type == "settlers" then
				settlers += 1
			end
		end
	end
	local shields = 0
	if (gov.upkeepShields or 0) > 0 then
		shields = math.max(0, (supported - (gov.freeUnitsPerCity or 0)) * gov.upkeepShields)
	end
	return { gold = gold, shields = shields, food = settlers * (rs.rules.settlerFoodUpkeep or 0) }
end

local function isCapital(state, city, rs)
	local first = nil
	for _, c in ipairs(ownCities(state, city.owner)) do
		first = first or c
		for _, b in ipairs(c.buildings or {}) do
			local def = rs.buildings[b]
			if def ~= nil and def.effect ~= nil and def.effect.isPalace == true then
				return c.id == city.id
			end
		end
	end
	return first ~= nil and first.id == city.id
end

function M.upkeepText(up)
	local parts = {}
	if up.gold > 0 then
		parts[#parts + 1] = ("%d gold"):format(up.gold)
	end
	if up.shields > 0 then
		parts[#parts + 1] = ("%d shield%s"):format(up.shields, up.shields == 1 and "" or "s")
	end
	if up.food > 0 then
		parts[#parts + 1] = ("%d food"):format(up.food)
	end
	return #parts > 0 and table.concat(parts, ", ") or "none"
end

-- one Cities-list row: yields, what the city pays in, what it costs.
-- worked: deps.cities.resolveAllWorked(state, rs), taken once per list (the
-- engine's own snapshot: cities sharing tiles are counted as the turn counts them)
function M.cityRow(state, city, rs, deps, worked)
	local tax, sci = rates(state, city.owner, rs)
	local idx = (worked or deps.cities.resolveAllWorked(state, rs))[city.id]
	local y = deps.cities.cityYields(state, city, rs, idx)
	local eco = deps.tech.cityEconOutput(state, city, tax, sci, rs.rules.specialistOutput, rs, idx)
	local quiet = city.disorder == true or deps.government.governmentOf(state, city.owner, rs).id == "anarchy"
	local up = M.upkeep(state, city, rs, deps)
	local row = {
		id = city.id, capital = isCapital(state, city, rs),
		food = y.food, shields = y.shields, trade = y.trade,
		gold = quiet and 0 or eco.gold, bulbs = quiet and 0 or eco.bulbs,
		upkeep = up, upkeepText = M.upkeepText(up),
	}
	-- ov-01 (plan R4.1): the specialists, from the engine's cityMood
	if deps.happiness ~= nil then
		local mood = deps.happiness.cityMood(state, city, rs)
		row.entertainers, row.taxmen, row.scientists = mood.entertainers or 0, mood.taxmen or 0, mood.scientists or 0
	end
	return row
end

-- "2 entertainers, 1 tax collector" / "no specialists"; nil without the figures
function M.specialistText(row)
	if row.entertainers == nil then
		return nil
	end
	local bits = {}
	local function add(n, one, many)
		if n > 0 then
			bits[#bits + 1] = ("%d %s"):format(n, n == 1 and one or many)
		end
	end
	add(row.entertainers, "entertainer", "entertainers")
	add(row.taxmen, "tax collector", "tax collectors")
	add(row.scientists, "scientist", "scientists")
	return #bits > 0 and table.concat(bits, ", ") or "no specialists"
end

-- the Economy statement. rows: { kind, label, amount, unit }
--   kind: "income" | "cost" | "note" | "total" | "upkeep"
-- income rows sum to playerIncome.gold, cost rows to .maintenance
function M.economy(state, pid, rs, deps)
	local p = state.players[pid]
	local tax, sci = rates(state, pid, rs)
	local anarchy = deps.government.governmentOf(state, pid, rs).id == "anarchy"
	local own = ownCities(state, pid)
	local rows = {}
	local function add(kind, label, amount, unit)
		rows[#rows + 1] = { kind = kind, label = label, amount = amount, unit = unit or "gold" }
	end
	if #own == 0 then
		return { rows = rows, net = 0, treasury = p.gold or 0, empty = "You have no cities - no economy yet." }
	end
	local corrupt = 0
	local worked = deps.cities.resolveAllWorked(state, rs)
	for _, c in ipairs(own) do
		if not anarchy and c.disorder ~= true then
			local eco = deps.tech.cityEconOutput(state, c, tax, sci, rs.rules.specialistOutput, rs, worked[c.id])
			if eco.gold > 0 then
				add("income", c.name .. " - taxes", eco.gold)
			end
			corrupt += deps.government.corruptionFor(state, c, deps.cities.cityYields(state, c, rs, worked[c.id]).trade, rs)
		elseif c.disorder == true and not anarchy then
			add("note", c.name .. " - civil disorder, no taxes")
		end
	end
	if anarchy then
		add("note", "Anarchy - the state collects no taxes")
	end
	if corrupt > 0 then
		add("note", "Corruption (already taken out of the taxes above)", -corrupt, "trade")
	end
	for _, c in ipairs(own) do
		for _, b in ipairs(c.buildings or {}) do
			local def = rs.buildings[b]
			if def ~= nil and (def.maintenance or 0) > 0 then
				add("cost", c.name .. " - " .. def.name, -def.maintenance)
			end
		end
	end
	local inc = deps.tech.playerIncome(state, pid, rs)
	local net = inc.gold - inc.maintenance
	add("total", ("Net gold per turn  (treasury %d)"):format(p.gold or 0), net)
	local shields, food = 0, 0
	for _, c in ipairs(own) do
		local up = M.upkeep(state, c, rs, deps)
		shields += up.shields
		food += up.food
	end
	if shields > 0 then
		add("upkeep", "Unit upkeep (paid in production, not gold)", -shields, "shields")
	end
	if food > 0 then
		add("upkeep", "Settlers (eat from their home city)", -food, "food")
	end
	return { rows = rows, net = net, treasury = p.gold or 0, income = inc.gold, maintenance = inc.maintenance,
		tax = tax, sci = sci }
end

function M.amountText(row)
	if row.amount == nil then
		return ""
	end
	local s = (row.amount >= 0 and "+" or "") .. tostring(row.amount)
	return row.unit == "gold" and s or (s .. " " .. row.unit)
end

return M
