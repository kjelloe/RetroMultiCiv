--!strict
-- Luau twin of engine/cities.js (phase 5, P5-5 — replaces the P5-4 partial):
-- founding, worked-tile yields, growth/starvation, production/buy, manual
-- workers, spacing. TWO PORT HAZARDS handled here:
--   * candidateTiles: JS Array.sort is STABLE (ties keep fat-cross order);
--     Luau table.sort is NOT — the comparator tie-breaks on the original
--     fat-cross position (docs/09 trap-list addition, P5-5)
--   * every array CREATED here (buildings, workers slices) carries
--     statehash.ARRAY_MT so empty ones serialize as [] not {}
-- EXPORTS (stable): foundCity, setProduction, setWorkers, buyProduction,
-- helpWonder, processCities, cityYields, workedTiles, candidateTiles, tileYields,
-- FAT_CROSS, hasBuilding, wonderActive, wonderInCity, effectPct, itemCost,
-- civVeteran, citySpacingOk.

local statehash = require("./statehash")
local visibility = require("./visibility")
local government = require("./government")

-- 21-tile "fat cross" offsets (5x5 minus corners), excluding the center.
local FAT_CROSS = {}
for dy = -2, 2 do
	for dx = -2, 2 do
		if not (dx == 0 and dy == 0) and not (math.abs(dx) == 2 and math.abs(dy) == 2) then
			table.insert(FAT_CROSS, { dx = dx, dy = dy })
		end
	end
end

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function tileYields(tile: any, ruleset: any)
	local terrain = ruleset.terrain.terrains[tile.t]
	local base = if tile.special then terrain.special.yields else terrain.yields
	local food = base.food
	local shields = base.shields
	local trade = base.trade
	if tile.river then
		trade += ruleset.terrain.riverModifier.tradeBonus
	end
	if tile.irrigation == true and terrain.irrigate ~= nil then
		food += terrain.irrigate.food
		shields += terrain.irrigate.shields
		trade += terrain.irrigate.trade
	end
	if tile.mine == true and terrain.mine ~= nil then
		food += terrain.mine.food
		shields += terrain.mine.shields
		trade += terrain.mine.trade
	end
	-- Civ 1: no road trade bonus on river tiles
	if tile.road == true and terrain.road ~= nil and tile.river ~= true then
		food += terrain.road.food
		shields += terrain.road.shields
		trade += terrain.road.trade
	end
	if tile.railroad == true then
		shields += math.floor(shields / 2) -- +50% shields (Civ 1)
	end
	return { food = food, shields = shields, trade = trade }
end

local function hasBuilding(city: any, buildingId: string): boolean
	return city.buildings ~= nil and table.find(city.buildings, buildingId) ~= nil
end

-- B13a/A63 twin: a unit leaves the production catalog once its obsoletedBy
-- tech is known. Pure; shared by setProduction and the AI's unit choice.
local function unitObsolete(def: any, techs: { string }): boolean
	return def.obsoletedBy ~= nil and def.obsoletedBy ~= ""
		and table.find(techs, def.obsoletedBy) ~= nil
end

-- A wonder is active while built and its obsoleting tech is unknown to ALL
-- players (Civ 1: anyone's discovery retires it).
local function wonderActive(state: any, wonderId: string, ruleset: any): boolean
	if state.wonders == nil or state.wonders[wonderId] == nil then
		return false
	end
	local obsoleteBy = ruleset.wonders[wonderId].obsoleteBy
	if obsoleteBy == "" then
		return true
	end
	for _, pid in ipairs(state.playerOrder) do
		local techs = state.players[pid].techs
		if techs ~= nil and table.find(techs, obsoleteBy) ~= nil then
			return false
		end
	end
	return true
end

local function wonderInCity(state: any, city: any, wonderId: string, ruleset: any): boolean
	return wonderActive(state, wonderId, ruleset) and state.wonders[wonderId] == city.id
end

-- The effective shield cost of an item for a player — civ specialties.
local function itemCost(kind: string, id: string, def: any, player: any, ruleset: any): number
	if player == nil or player.civ == nil or ruleset.civs == nil then
		return def.cost
	end
	local civ = ruleset.civs[player.civ]
	local spec = if civ == nil then nil else civ.specialty
	if spec == nil then
		return def.cost
	end
	if kind == "unit" and spec.type == "cheapUnit" and spec.unit == id then
		return def.cost - idiv(def.cost * spec.pct, 100)
	end
	if kind == "building" and spec.type == "cheapBuilding" and spec.building == id then
		return def.cost - idiv(def.cost * spec.pct, 100)
	end
	return def.cost
end

local function civVeteran(player: any, unitId: string, ruleset: any): boolean
	if player == nil or player.civ == nil or ruleset.civs == nil then
		return false
	end
	local civ = ruleset.civs[player.civ]
	local spec = if civ == nil then nil else civ.specialty
	return spec ~= nil and spec.type == "veteranUnit" and spec.unit == unitId
end

-- Sum a percentage effect (e.g. taxBonus, sciBonus) over a city's buildings.
local function effectPct(city: any, ruleset: any, key: string): number
	local total = 0
	for _, id in ipairs(city.buildings or {}) do
		local val = ruleset.buildings[id].effect[key]
		if val ~= nil then
			total += val
		end
	end
	return total
end

-- Government adjustments per worked tile: despotism -1 on 3+, Republic/
-- Democracy +1 trade on trade-producing tiles.
local function govAdjustYields(y: any, gov: any)
	local out = { food = y.food, shields = y.shields, trade = y.trade }
	if gov.tilePenalty == true then
		if out.food >= 3 then
			out.food -= 1
		end
		if out.shields >= 3 then
			out.shields -= 1
		end
		if out.trade >= 3 then
			out.trade -= 1
		end
	end
	if gov.tradeBonus > 0 and out.trade > 0 then
		out.trade += gov.tradeBonus
	end
	return out
end

-- All workable fat-cross tiles, greedy-sorted; idx = y*width + x is the
-- STORED 0-based id (docs/09 trap 1). STABLE sort via fat-cross position.
local function candidateTiles(state: any, city: any, ruleset: any): { any }
	local width, height, wrapX = state.map.width, state.map.height, state.map.wrapX
	local tiles = state.map.tiles
	local gov = government.governmentOf(state, city.owner, ruleset)
	local candidates = {}
	for order, o in ipairs(FAT_CROSS) do
		local x = city.x + o.dx
		local y = city.y + o.dy
		local keep = y >= 0 and y < height
		if keep and (x < 0 or x >= width) then
			if not wrapX then
				keep = false
			else
				x = ((x % width) + width) % width
			end
		end
		if keep then
			local y_ = govAdjustYields(tileYields(tiles[y * width + x + 1], ruleset), gov)
			table.insert(candidates, {
				idx = y * width + x, x = x, y = y,
				score = y_.food * 3 + y_.shields * 2 + y_.trade, yields = y_,
				order = order, -- JS sort is stable; table.sort is not (trap)
			})
		end
	end
	table.sort(candidates, function(a, b)
		if a.score ~= b.score then
			return a.score > b.score
		end
		return a.order < b.order
	end)
	return candidates
end

-- Center tile (always worked, free) + up to pop worked tiles.
local function workedTiles(state: any, city: any, ruleset: any): { any }
	local width = state.map.width
	local tiles = state.map.tiles
	local gov = government.governmentOf(state, city.owner, ruleset)
	-- Civ 1: the city tile produces as if ROADED & IRRIGATED (irrigation
	-- skipped when a mine occupies the tile). Copy; never mutate state.
	local centerSrc = tiles[city.y * width + city.x + 1]
	local centerTile: any = { t = centerSrc.t }
	if centerSrc.special == true then
		centerTile.special = true
	end
	if centerSrc.river == true then
		centerTile.river = true
	end
	if centerSrc.mine == true then
		centerTile.mine = true
	else
		centerTile.irrigation = true
	end
	centerTile.road = true
	if centerSrc.railroad == true then
		centerTile.railroad = true
	end
	local centerYields = govAdjustYields(tileYields(centerTile, ruleset), gov)
	-- VI.2: the CAPITAL's city square carries a trade bonus, applied after
	-- the government adjustment so despotism cannot erase it.
	local capBonus = if ruleset.rules.capitalCenterTradeBonus == nil then 0
		else ruleset.rules.capitalCenterTradeBonus
	if capBonus > 0 then
		local cap = government.capitalOf(state, city.owner, ruleset)
		if cap ~= nil and cap.id == city.id then
			centerYields.trade += capBonus
		end
	end
	local worked = { { x = city.x, y = city.y, center = true, yields = centerYields } }
	local candidates = candidateTiles(state, city, ruleset)
	if city.workers ~= nil then
		local byIdx = {}
		for _, c in ipairs(candidates) do
			byIdx[c.idx] = c
		end
		local count = 0
		for _, idx in ipairs(city.workers) do
			if count >= city.pop then
				break
			end
			local c = byIdx[idx]
			if c ~= nil then
				table.insert(worked, { x = c.x, y = c.y, center = false, yields = c.yields })
				count += 1
			end
		end
		return worked
	end
	for i = 1, math.min(city.pop, #candidates) do
		table.insert(worked, { x = candidates[i].x, y = candidates[i].y, center = false, yields = candidates[i].yields })
	end
	return worked
end

-- Manual worker placement; auto: true returns to greedy and clears
-- explicit specialists.
local function setWorkers(state: any, cmd: any, ruleset: any): any
	local city = state.cities[cmd.cityId]
	if city == nil then
		return { ok = false, reason = "unknownCity" }
	end
	if city.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourCity" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end

	if cmd.auto == true then
		city.workers = nil
		city.taxmen = nil
		city.scientists = nil
		return { ok = true, events = { { type = "workersSet", cityId = city.id, auto = true } } }
	end
	local workers = cmd.workers
	if typeof(workers) ~= "table" or #workers > city.pop then
		return { ok = false, reason = "badWorkers" }
	end
	local valid = {}
	for _, c in ipairs(candidateTiles(state, city, ruleset)) do
		valid[c.idx] = true
	end
	local seen = {}
	for _, idx in ipairs(workers) do
		if typeof(idx) ~= "number" or idx % 1 ~= 0 or valid[idx] ~= true or seen[idx] == true then
			return { ok = false, reason = "badWorkers" }
		end
		seen[idx] = true
	end
	local taxmen = if cmd.taxmen == nil then (if city.taxmen == nil then 0 else city.taxmen) else cmd.taxmen
	local scientists = if cmd.scientists == nil then (if city.scientists == nil then 0 else city.scientists) else cmd.scientists
	if typeof(taxmen) ~= "number" or taxmen % 1 ~= 0
		or typeof(scientists) ~= "number" or scientists % 1 ~= 0
		or taxmen < 0 or scientists < 0 then
		return { ok = false, reason = "badSpecialists" }
	end
	if (taxmen > 0 or scientists > 0) and city.pop < 5 then
		return { ok = false, reason = "badSpecialists" } -- Civ 1: pop >= 5
	end
	if #workers + taxmen + scientists > city.pop then
		return { ok = false, reason = "badSpecialists" }
	end
	local copy = setmetatable(table.clone(workers), statehash.ARRAY_MT)
	city.workers = copy
	if taxmen > 0 then
		city.taxmen = taxmen
	else
		city.taxmen = nil
	end
	if scientists > 0 then
		city.scientists = scientists
	else
		city.scientists = nil
	end
	return { ok = true, events = { { type = "workersSet", cityId = city.id, auto = false } } }
end

local function cityYields(state: any, city: any, ruleset: any)
	local worked = workedTiles(state, city, ruleset)
	local total = { food = 0, shields = 0, trade = 0 }
	local tradeTiles = 0
	for _, w in ipairs(worked) do
		total.food += w.yields.food
		total.shields += w.yields.shields
		total.trade += w.yields.trade
		if w.yields.trade > 0 then
			tradeTiles += 1
		end
	end
	-- Colossus: +1 trade on every worked trade-producing tile in its city
	if wonderInCity(state, city, "colossus", ruleset) then
		total.trade += tradeTiles
	end
	return total
end

-- VI.5 spacing metric: legal iff Chebyshev >= minCityDistance OR fully
-- diagonal at >= minCityDiagonal on BOTH axes.
local function citySpacingOk(map: any, x: number, y: number, cx: number, cy: number, rules: any): boolean
	local dx = cx - x
	if dx < 0 then
		dx = -dx
	end
	if map.wrapX and map.width - dx < dx then
		dx = map.width - dx
	end
	local dy = cy - y
	if dy < 0 then
		dy = -dy
	end
	local cheb = if dx > dy then dx else dy
	local minDist = if rules.minCityDistance == nil then 1 else rules.minCityDistance
	if cheb >= minDist then
		return true
	end
	local diag = rules.minCityDiagonal
	if diag == nil then
		return false
	end
	return dx >= diag and dy >= diag
end

-- A60: name a newly-founded city. An explicit cmd.name wins (the human prompt;
-- '' is FALSY here, matching the old `cmd.name ||`). Otherwise, for a civ'd
-- player, walk that civ's city list for the first name not already used by ANY
-- current city (global uniqueness — two Romes read as a bug; iterate cityOrder
-- for determinism), then a "New <name>" cycle, then "<CivName> Outpost <id>".
-- A player with no civ (crafted states) keeps the old "City <cityId>" fallback,
-- so scenario hashes built without civs are untouched.
local function cityName(state: any, cmd: any, ruleset: any, cityId: string, idNum: number): string
	if cmd.name ~= nil and cmd.name ~= "" then
		return cmd.name
	end
	local player = state.players[cmd.playerId]
	if player == nil or player.civ == nil or ruleset.civs == nil then
		return "City " .. cityId
	end
	local civ = ruleset.civs[player.civ]
	if civ == nil or civ.cities == nil then
		return "City " .. cityId
	end

	local used = {}
	for _, id in ipairs(state.cityOrder) do
		used[state.cities[id].name] = true
	end
	local list = civ.cities
	for k = 1, #list do
		if used[list[k]] ~= true then
			return list[k]
		end
	end
	for k = 1, #list do
		if used["New " .. list[k]] ~= true then
			return "New " .. list[k]
		end
	end
	return civ.name .. " Outpost " .. idNum
end

local function foundCity(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then
		return { ok = false, reason = "unknownUnit" }
	end
	if unit.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourUnit" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	if unit.type ~= "settlers" then
		return { ok = false, reason = "notSettlers" }
	end
	if unit.moves <= 0 then
		return { ok = false, reason = "noMovesLeft" }
	end

	local terrain = ruleset.terrain.terrains[state.map.tiles[unit.y * state.map.width + unit.x + 1].t]
	if terrain.domain ~= "land" then
		return { ok = false, reason = "badTerrain" }
	end
	for _, id in ipairs(state.cityOrder) do
		local c = state.cities[id]
		if c.x == unit.x and c.y == unit.y then
			return { ok = false, reason = "cityExists" }
		end
		if not citySpacingOk(state.map, unit.x, unit.y, c.x, c.y, ruleset.rules) then
			return { ok = false, reason = "tooCloseToCity" }
		end
	end

	local idNum = state.nextCityId
	local cityId = "c" .. idNum
	state.nextCityId += 1
	local name = cityName(state, cmd, ruleset, cityId, idNum)
	state.cities[cityId] = {
		id = cityId,
		name = name,
		owner = cmd.playerId,
		x = unit.x,
		y = unit.y,
		pop = 1,
		food = 0,
		shields = 0,
		buildings = setmetatable({}, statehash.ARRAY_MT), -- EMPTY array, marked
		producing = { kind = "unit", id = "militia" },
	}
	table.insert(state.cityOrder, cityId)
	state.units[cmd.unitId] = nil
	visibility.reveal(state, cmd.playerId, state.cities[cityId].x, state.cities[cityId].y, 2)

	return { ok = true, events = { { type = "cityFounded", cityId = cityId, x = state.cities[cityId].x, y = state.cities[cityId].y } } }
end

local function setProduction(state: any, cmd: any, ruleset: any): any
	local city = state.cities[cmd.cityId]
	if city == nil then
		return { ok = false, reason = "unknownCity" }
	end
	if city.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourCity" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local item = cmd.item
	if item == nil then
		return { ok = false, reason = "badItem" }
	end

	local def = nil
	if item.kind == "unit" then
		def = ruleset.units[item.id]
	elseif item.kind == "building" then
		def = ruleset.buildings[item.id]
	elseif item.kind == "wonder" then
		def = ruleset.wonders[item.id]
	end
	if def == nil then
		return { ok = false, reason = "badItem" }
	end

	if def.tech ~= "" and table.find(state.players[cmd.playerId].techs, def.tech) == nil then
		return { ok = false, reason = "techRequired" }
	end
	-- B13a/A63: a unit obsoleted by a known tech has left the catalog
	if item.kind == "unit" and unitObsolete(def, state.players[cmd.playerId].techs) then
		return { ok = false, reason = "obsolete" }
	end
	if item.kind == "building" and hasBuilding(city, item.id) then
		return { ok = false, reason = "alreadyBuilt" }
	end
	if item.kind == "wonder" and state.wonders ~= nil and state.wonders[item.id] ~= nil then
		return { ok = false, reason = "wonderTaken" }
	end

	-- Civ 1: switching production category forfeits half the shields
	if city.producing.kind ~= item.kind then
		city.shields = idiv(city.shields, 2)
	end
	city.producing = { kind = item.kind, id = item.id }
	return { ok = true, events = { { type = "productionSet", cityId = city.id, item = city.producing } } }
end

-- Buy: pay gold to fill the shield box; completes at the next wrap.
local function buyProduction(state: any, cmd: any, ruleset: any): any
	local city = state.cities[cmd.cityId]
	if city == nil then
		return { ok = false, reason = "unknownCity" }
	end
	if city.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourCity" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local prod = city.producing
	local def = nil
	if prod.kind == "unit" then
		def = ruleset.units[prod.id]
	elseif prod.kind == "building" then
		def = ruleset.buildings[prod.id]
	elseif prod.kind == "wonder" then
		def = ruleset.wonders[prod.id]
	end
	if def == nil then
		return { ok = false, reason = "badItem" }
	end
	local cost = itemCost(prod.kind, prod.id, def, state.players[cmd.playerId], ruleset)
	local missing = cost - city.shields
	if missing <= 0 then
		return { ok = false, reason = "alreadyComplete" }
	end
	local rate = if prod.kind == "wonder" then ruleset.rules.buyGoldPerShieldWonder
		else ruleset.rules.buyGoldPerShield
	local price = missing * rate
	local player = state.players[cmd.playerId]
	if player.gold < price then
		return { ok = false, reason = "notEnoughGold" }
	end
	player.gold -= price
	city.shields = cost -- civ-effective cost, so completion triggers at the wrap
	return { ok = true, events = { { type = "productionBought", cityId = city.id, price = price, item = prod } } }
end

-- A83: a caravan (units.json helpsWonder) standing in one of the player's own
-- cities that is building a wonder pours its build cost into the shield box and
-- is consumed -- Civ 1's "help build wonder?" prompt. The shields only FILL the
-- box; the wonder completes at the turn wrap in processCities, exactly like buy.
-- Human-only: the AI never fields caravans, so the sim goldens are untouched.
local function helpWonder(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then
		return { ok = false, reason = "unknownUnit" }
	end
	if unit.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourUnit" }
	end
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local def = ruleset.units[unit.type]
	if def == nil or def.helpsWonder ~= true then
		return { ok = false, reason = "cannotHelpWonder" }
	end
	local city = nil
	for _, cid in ipairs(state.cityOrder) do
		local c = state.cities[cid]
		if c ~= nil and c.x == unit.x and c.y == unit.y then
			city = c
			break
		end
	end
	if city == nil then
		return { ok = false, reason = "noCityHere" }
	end
	if city.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourCity" }
	end
	if city.producing.kind ~= "wonder" then
		return { ok = false, reason = "notBuildingWonder" }
	end
	local added = def.cost
	city.shields += added
	state.units[cmd.unitId] = nil
	return { ok = true, events = { {
		type = "wonderHelped", cityId = city.id, unitId = cmd.unitId,
		wonder = city.producing.id, shields = added, playerId = cmd.playerId,
	} } }
end

-- Runs once per game turn (when the last player ends): food box + production.
local function processCities(state: any, ruleset: any, events: any)
	local order = state.cityOrder
	if order == nil then
		return
	end
	for _, cityId in ipairs(order) do
		local city = state.cities[cityId]
		if city == nil then
			continue
		end
		local yields = cityYields(state, city, ruleset)
		if city.disorder == true then
			yields.shields = 0 -- civil disorder halts production
		end

		-- Factory chain: +50% shields, doubled by any power source
		local shieldPct = effectPct(city, ruleset, "shieldBonus")
		if shieldPct > 0 then
			for _, b in ipairs(city.buildings or {}) do
				if ruleset.buildings[b].effect.boostsFactory == true then
					shieldPct *= 2
					break
				end
			end
			yields.shields += idiv(yields.shields * shieldPct, 100)
		end

		-- unit upkeep in shields (government-dependent)
		local gov = government.governmentOf(state, city.owner, ruleset)
		if gov.upkeepShields > 0 then
			local supported = 0
			for _, u in pairs(state.units) do
				if u.home == cityId then
					supported += 1
				end
			end
			local owed = (supported - gov.freeUnitsPerCity) * gov.upkeepShields
			if owed > 0 then
				yields.shields -= owed
				if yields.shields < 0 then
					yields.shields = 0 -- deviation: nothing disbands
				end
			end
		end

		city.food = city.food + yields.food - city.pop * 2
		local threshold = 10 * (city.pop + 1)
		if city.food >= threshold then
			if city.pop >= 10 and not hasBuilding(city, "aqueduct") then
				city.food = threshold -- growth stalls without an Aqueduct
			else
				city.pop += 1
				city.food = if hasBuilding(city, "granary") then idiv(threshold, 2) else 0
				-- under manual placement the new citizen takes the best free tile
				if city.workers ~= nil then
					for _, c in ipairs(candidateTiles(state, city, ruleset)) do
						if table.find(city.workers, c.idx) == nil then
							table.insert(city.workers, c.idx)
							break
						end
					end
				end
				table.insert(events, { type = "cityGrew", cityId = cityId, pop = city.pop })
			end
		elseif city.food < 0 then
			city.food = 0
			if city.pop > 1 then
				city.pop -= 1
				if city.workers ~= nil and #city.workers > city.pop then
					local trimmed = setmetatable({}, statehash.ARRAY_MT)
					for i = 1, city.pop do
						trimmed[i] = city.workers[i]
					end
					city.workers = trimmed
				end
				-- specialists can't outnumber the shrunken citizenry either
				while (if city.taxmen ~= nil then city.taxmen else 0)
					+ (if city.scientists ~= nil then city.scientists else 0) > city.pop do
					if city.scientists ~= nil and city.scientists > 0 then
						city.scientists -= 1
						if city.scientists == 0 then
							city.scientists = nil
						end
					else
						city.taxmen -= 1
						if city.taxmen == 0 then
							city.taxmen = nil
						end
					end
				end
				table.insert(events, { type = "cityStarved", cityId = cityId, pop = city.pop })
			end
		end

		city.shields += yields.shields
		local prod = city.producing
		local owner = state.players[city.owner]
		if prod.kind == "unit" then
			local unitType = ruleset.units[prod.id]
			local cost = itemCost("unit", prod.id, unitType, owner, ruleset)
			if city.shields >= cost then
				city.shields -= cost
				local unitId = "u" .. state.nextUnitId
				state.nextUnitId += 1
				state.units[unitId] = {
					id = unitId, type = prod.id, owner = city.owner,
					x = city.x, y = city.y, moves = unitType.moves,
					fortified = false,
					veteran = hasBuilding(city, "barracks") or civVeteran(owner, prod.id, ruleset),
					home = cityId,
				}
				visibility.reveal(state, city.owner, city.x, city.y, 1)
				table.insert(events, { type = "unitBuilt", cityId = cityId, unitId = unitId, unitType = prod.id })
			end
		elseif prod.kind == "building" then
			local def = ruleset.buildings[prod.id]
			local cost = itemCost("building", prod.id, def, owner, ruleset)
			if city.shields >= cost then
				city.shields -= cost
				if city.buildings == nil then
					city.buildings = setmetatable({}, statehash.ARRAY_MT)
				end
				table.insert(city.buildings, prod.id)
				city.producing = { kind = "unit", id = "militia" }
				table.insert(events, { type = "buildingBuilt", cityId = cityId, building = prod.id })
			end
		elseif prod.kind == "wonder" then
			local def = ruleset.wonders[prod.id]
			if city.shields >= def.cost then
				if state.wonders ~= nil and state.wonders[prod.id] ~= nil then
					-- another civilization finished it first — shields kept
					city.producing = { kind = "unit", id = "militia" }
					table.insert(events, { type = "wonderLost", cityId = cityId, wonder = prod.id })
				else
					city.shields -= def.cost
					if state.wonders == nil then
						state.wonders = {}
					end
					state.wonders[prod.id] = city.id
					city.producing = { kind = "unit", id = "militia" }
					table.insert(events, { type = "wonderBuilt", cityId = cityId, wonder = prod.id })
				end
			end
		end
	end
end

return {
	foundCity = foundCity,
	setProduction = setProduction,
	setWorkers = setWorkers,
	buyProduction = buyProduction,
	helpWonder = helpWonder,
	processCities = processCities,
	cityYields = cityYields,
	workedTiles = workedTiles,
	candidateTiles = candidateTiles,
	tileYields = tileYields,
	FAT_CROSS = FAT_CROSS,
	hasBuilding = hasBuilding,
	wonderActive = wonderActive,
	wonderInCity = wonderInCity,
	effectPct = effectPct,
	itemCost = itemCost,
	civVeteran = civVeteran,
	citySpacingOk = citySpacingOk,
	unitObsolete = unitObsolete,
}
