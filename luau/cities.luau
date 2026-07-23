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
local diplomacy = require("./diplomacy") -- D1: war-gated blockade
local difficulty = require("./difficulty")

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

-- manhattan-gate (#16): nukes buildable once ANY active wonder grants nukesEnabled (the
-- Manhattan Project, GLOBAL gate) unless host-disabled (nukesDisabled). Matches engine/cities.js.
local function nukesEnabled(state: any, ruleset: any): boolean
	if ruleset.rules.nukesDisabled == true then
		return false
	end
	if state.wonders == nil then
		return false
	end
	for wid in pairs(state.wonders) do
		local w = ruleset.wonders[wid]
		if w ~= nil and w.effect ~= nil and w.effect.nukesEnabled == true and wonderActive(state, wid, ruleset) then
			return true
		end
	end
	return false
end

-- The effective shield cost of an item for a player — civ specialties.
-- aiCostPct is an ASYMMETRIC difficulty knob: an AI player build cost scales by
-- difficulties[level].aiCostPct, ONLY when a human seat exists. All-AI + crafted
-- states (no state) stay neutral. Matches engine/cities.js.
local function aiCostAdjust(cost: number, player: any, state: any, ruleset: any): number
	if state == nil or player == nil or player.human == true then
		return cost
	end
	local d = difficulty.difficultyOf(state, ruleset)
	if d == nil or not difficulty.hasHumanSeat(state) then
		return cost
	end
	return idiv(cost * d.aiCostPct, 100)
end

local function itemCost(kind: string, id: string, def: any, player: any, ruleset: any, state: any): number
	local cost = def.cost
	if player ~= nil and player.civ ~= nil and ruleset.civs ~= nil then
		local civ = ruleset.civs[player.civ]
		local spec = if civ == nil then nil else civ.specialty
		if spec ~= nil then
			if kind == "unit" and spec.type == "cheapUnit" and spec.unit == id then
				cost = def.cost - idiv(def.cost * spec.pct, 100)
			elseif kind == "building" and spec.type == "cheapBuilding" and spec.building == id then
				cost = def.cost - idiv(def.cost * spec.pct, 100)
			end
		end
	end
	return aiCostAdjust(cost, player, state, ruleset)
end

-- aiFoodRows is an ASYMMETRIC difficulty knob: an AI city growth food-box is
-- difficulties[level].aiFoodRows rows tall when a human seat exists; else 10.
local function growthThreshold(state: any, city: any, ruleset: any): number
	local rows = 10
	local d = difficulty.difficultyOf(state, ruleset)
	if d ~= nil and difficulty.hasHumanSeat(state) and state.players[city.owner].human ~= true then
		rows = d.aiFoodRows
	end
	return rows * (city.pop + 1)
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
	-- A79 blockade (house rule, NOT Civ 1 — enemy occupation blocks working;
	-- user war-doctrine 2026-07-16). An enemy unit on a tile drops it from the
	-- candidate set. Matches engine/cities.js.
	local blocked = {}
	for _, u in pairs(state.units or {}) do
		if u.owner ~= city.owner then
			-- #15 perf twin: only a unit inside the fat cross (cheb<=2) can blockade a worked tile —
			-- blocked[] is read only for fat-cross tiles, so this bounding-box gate is hash-neutral.
			local adx = u.x - city.x
			if adx < 0 then adx = -adx end
			if wrapX and adx > width - adx then adx = width - adx end
			local ady = u.y - city.y
			if ady < 0 then ady = -ady end
			if not (adx > 2 or ady > 2) then
				-- D1: a foreign unit blockades only at WAR (default). At PEACE trade flows.
				if diplomacy.relationOf(state, city.owner, u.owner) == "war" then
					blocked[u.y * width + u.x] = true
				end
			end
		end
	end
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
		if keep and blocked[y * width + x] == true then
			keep = false
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
	-- A54 off-turn pre-work: self-scoped (own city only, zero rng) — legal
	-- while a rival moves; no turn check

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

-- City-founding legality at (x, y): the reject reason, or nil. Shared by the
-- settler command AND the N13 hut advanced-tribe outcome (twin of engine/cities.js).
local function foundCityLegality(state: any, x: number, y: number, ruleset: any): string?
	local terrain = ruleset.terrain.terrains[state.map.tiles[y * state.map.width + x + 1].t]
	if terrain.domain ~= "land" then return "badTerrain" end
	for _, id in ipairs(state.cityOrder) do
		local c = state.cities[id]
		if c.x == x and c.y == y then return "cityExists" end
		if not citySpacingOk(state.map, x, y, c.x, c.y, ruleset.rules) then return "tooCloseToCity" end
	end
	return nil
end

-- The shared city-creation core: a pop-1 city at (x, y) for playerId. Pushes a
-- cityFounded event; callers handle any settler consumption. Returns the cityId.
local function createCityAt(state: any, playerId: string, x: number, y: number, ruleset: any, events: any, name: string?): string
	local idNum = state.nextCityId
	local cityId = "c" .. idNum
	state.nextCityId += 1
	state.cities[cityId] = {
		id = cityId,
		name = cityName(state, { playerId = playerId, name = name }, ruleset, cityId, idNum),
		owner = playerId,
		x = x,
		y = y,
		pop = 1,
		food = 0,
		shields = 0,
		buildings = setmetatable({}, statehash.ARRAY_MT), -- EMPTY array, marked
		producing = { kind = "unit", id = "militia" },
	}
	table.insert(state.cityOrder, cityId)
	visibility.reveal(state, playerId, x, y, 2)
	table.insert(events, { type = "cityFounded", cityId = cityId, x = x, y = y })
	return cityId
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
	local bad = foundCityLegality(state, unit.x, unit.y, ruleset)
	if bad ~= nil then
		return { ok = false, reason = bad }
	end
	local events = setmetatable({}, statehash.ARRAY_MT)
	createCityAt(state, cmd.playerId, unit.x, unit.y, ruleset, events, cmd.name)
	state.units[cmd.unitId] = nil
	return { ok = true, events = events }
end

local function setProduction(state: any, cmd: any, ruleset: any): any
	local city = state.cities[cmd.cityId]
	if city == nil then
		return { ok = false, reason = "unknownCity" }
	end
	if city.owner ~= cmd.playerId then
		return { ok = false, reason = "notYourCity" }
	end
	-- A54 off-turn pre-work: self-scoped (own city only, zero rng) — legal
	-- while a rival moves; no turn check
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
	elseif item.kind == "ss-part" then
		def = if ruleset.rules.ssParts == nil then nil else ruleset.rules.ssParts[item.id]
	end
	if def == nil then
		return { ok = false, reason = "badItem" }
	end

	if def.tech ~= "" and table.find(state.players[cmd.playerId].techs, def.tech) == nil then
		return { ok = false, reason = "techRequired" }
	end
	-- manhattan-gate (#16): a nuclear unit (nuclearBlast) needs nukes ENABLED.
	if item.kind == "unit" and def.nuclearBlast == true and not nukesEnabled(state, ruleset) then
		return { ok = false, reason = "noNukes" }
	end
	-- A76: spaceship parts need the Apollo Program (derived gate), and may not be
	-- built once the ship has launched or its per-type max is reached.
	if item.kind == "ss-part" then
		if not wonderActive(state, ruleset.rules.ssFlight.gateWonder, ruleset) then
			return { ok = false, reason = "noApollo" }
		end
		local ship = state.players[cmd.playerId].spaceship
		if ship ~= nil and ship.launched ~= nil and ship.launched ~= 0 then
			return { ok = false, reason = "shipLaunched" }
		end
		local have = if ship ~= nil and ship[item.id] ~= nil then ship[item.id] else 0
		if have >= def.max then
			return { ok = false, reason = "partMaxReached" }
		end
	end
	-- B13a/A63: a unit obsoleted by a known tech has left the catalog
	if item.kind == "unit" and unitObsolete(def, state.players[cmd.playerId].techs) then
		return { ok = false, reason = "obsolete" }
	end
	-- N13: barb-only units (the barbarian leader) are never buildable by a civ
	if item.kind == "unit" and def.barbOnly == true then
		return { ok = false, reason = "notBuildable" }
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
	elseif prod.kind == "ss-part" then
		def = ruleset.rules.ssParts[prod.id]
	end
	if def == nil then
		return { ok = false, reason = "badItem" }
	end
	local cost = itemCost(prod.kind, prod.id, def, state.players[cmd.playerId], ruleset, state)
	local missing = cost - city.shields
	if missing <= 0 then
		return { ok = false, reason = "alreadyComplete" }
	end
	local rate = if prod.kind == "wonder" then ruleset.rules.buyGoldPerShieldWonder
		elseif prod.kind == "ss-part" then ruleset.rules.buyGoldPerShieldSS
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

-- A86/A63 twin: remove a building and credit its sale price (cost x
-- sellPriceRatio) to the owner, with a buildingSold event carrying the trigger
-- `reason`. Shared by the tech-obsolescence auto-sell ('obsolete') and the manual
-- sellBuilding command ('manual'). Callers guarantee the building is present.
local function sellBuildingFrom(state: any, city: any, buildingId: string, ruleset: any, events: any, reason: string)
	local def = ruleset.buildings[buildingId]
	local idx = table.find(city.buildings, buildingId)
	table.remove(city.buildings, idx)
	local credit = def.cost * ruleset.rules.sellPriceRatio
	local owner = state.players[city.owner]
	owner.gold = owner.gold + credit
	table.insert(events, { type = "buildingSold", playerId = city.owner, cityId = city.id, building = buildingId, gold = credit, reason = reason })
end

-- A86 twin: the human sells one city improvement for gold. ONE sale per city per
-- turn (omit-safe soldThisTurn, cleared at the wrap); the Palace is not sellable.
local function sellBuilding(state: any, cmd: any, ruleset: any): any
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
	if city.soldThisTurn == true then
		return { ok = false, reason = "alreadySoldThisTurn" }
	end
	if city.buildings == nil or table.find(city.buildings, cmd.building) == nil then
		return { ok = false, reason = "noSuchBuilding" }
	end
	local def = ruleset.buildings[cmd.building]
	if def == nil then
		return { ok = false, reason = "badBuilding" }
	end
	if def.effect ~= nil and def.effect.isPalace == true then
		return { ok = false, reason = "cannotSellPalace" }
	end
	local events = {}
	sellBuildingFrom(state, city, cmd.building, ruleset, events, "manual")
	city.soldThisTurn = true
	return { ok = true, events = events }
end

-- §40: trim manual worker/specialist assignments that now exceed a shrunken
-- pop (starvation and the settler pop-cost both use it).
local function trimToPop(city: any)
	if city.workers ~= nil and #city.workers > city.pop then
		local trimmed = setmetatable({}, statehash.ARRAY_MT)
		for i = 1, city.pop do
			trimmed[i] = city.workers[i]
		end
		city.workers = trimmed
	end
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
end

-- §40: a size-1 city that completes a settler CEASES TO EXIST. Units homed here
-- go homeless (home field removed = the home==nil convention). A wonder here is
-- destroyed PERMANENTLY (state.wonders entry dropped -> wonderActive false).
-- Elimination is NOT special-cased: losing the last city routes through the
-- normal checkGameEnd/hasAssets path on the turn wrap. Value-mutation under pairs
-- is order-independent (all matching entries clear regardless of order).
local function disbandCity(state: any, cityId: string, events: any, ruleset: any)
	local city = state.cities[cityId]
	for uid in pairs(state.units) do
		if state.units[uid].home == cityId then
			state.units[uid].home = nil
		end
	end
	-- B27: a SEA unit docked in the vanishing coastal city loses its home port and is
	-- lost with any cargo aboard (mirrors naval open-sea loss) -- else it strands on the
	-- now-cityless LAND tile. Deleting a fixed SET => order-independent final state; the
	-- key snapshots avoid the pairs()+delete-non-current-key UB (JS Object.keys is a snapshot).
	if ruleset ~= nil and city ~= nil then
		local cx, cy = city.x, city.y
		local ids = {}
		for uid in pairs(state.units) do ids[#ids + 1] = uid end
		for _, uid in ipairs(ids) do
			local u = state.units[uid]
			if u ~= nil and u.x == cx and u.y == cy and ruleset.units[u.type].domain == "sea" then
				local cids = {}
				for cid in pairs(state.units) do cids[#cids + 1] = cid end
				for _, cid in ipairs(cids) do
					local c = state.units[cid]
					if c ~= nil and c.aboard == uid then
						state.units[cid] = nil
						table.insert(events, { type = "cargoLost", unitId = cid, owner = c.owner, shipId = uid, x = cx, y = cy })
					end
				end
				state.units[uid] = nil
				table.insert(events, { type = "triremeLost", unitId = uid, owner = u.owner, x = cx, y = cy })
			end
		end
	end
	if state.wonders ~= nil then
		for wid in pairs(state.wonders) do
			if state.wonders[wid] == cityId then
				state.wonders[wid] = nil
			end
		end
	end
	state.cities[cityId] = nil
	if state.cityOrder ~= nil then
		local kept = setmetatable({}, statehash.ARRAY_MT)
		local k = 0
		for _, id in ipairs(state.cityOrder) do
			if id ~= cityId then
				k += 1
				kept[k] = id
			end
		end
		state.cityOrder = kept
	end
	table.insert(events, { type = "cityDisbanded", cityId = cityId })
end

-- #29 hoover: are (ax,ay) and (bx,by) on the same contiguous LAND continent? A flood-fill
-- from (ax,ay) over 8-adjacent land tiles (wrapX honored) -- the same "contiguous land = one
-- continent" definition the naval AI uses (ai.luau landComponent); kept local so cities.luau
-- stays free of an ai cycle. The boolean result is fill-order-independent. (idx is 0-based for
-- the x/y math; tiles are 1-indexed, so tile access adds +1.)
local function sameContinent(state: any, ax: number, ay: number, bx: number, by: number, ruleset: any): boolean
	local W = state.map.width
	local H = state.map.height
	local startIdx = ay * W + ax
	local targetIdx = by * W + bx
	if startIdx == targetIdx then
		return true
	end
	if ruleset.terrain.terrains[state.map.tiles[startIdx + 1].t].domain ~= "land" then
		return false
	end
	local seen = {}
	seen[startIdx] = true
	local stack = { startIdx }
	while #stack > 0 do
		local idx = table.remove(stack)
		local x = idx % W
		local y = idiv(idx, W)
		for dy = -1, 1 do
			for dx = -1, 1 do
				if not (dx == 0 and dy == 0) then
					local ny = y + dy
					if ny >= 0 and ny < H then
						local nx = x + dx
						local skip = false
						if nx < 0 or nx >= W then
							if state.map.wrapX ~= true then
								skip = true
							else
								nx = ((nx % W) + W) % W
							end
						end
						if not skip then
							local nidx = ny * W + nx
							if seen[nidx] ~= true
								and ruleset.terrain.terrains[state.map.tiles[nidx + 1].t].domain == "land" then
								if nidx == targetIdx then
									return true
								end
								seen[nidx] = true
								table.insert(stack, nidx)
							end
						end
					end
				end
			end
		end
	end
	return false
end

-- #29 hoover-dam: does an active powerSameContinent wonder (Hydro Plant) power this city --
-- owned by the same player and on the wonder-city's continent? Boolean, so wonder-iteration
-- order does not matter (there is normally one such wonder in a game).
local function hooverPowersCity(state: any, city: any, ruleset: any): boolean
	for wid in pairs(state.wonders or {}) do
		if ruleset.wonders[wid].effect.powerSameContinent == true and wonderActive(state, wid, ruleset) then
			local home = state.cities[state.wonders[wid]]
			if home ~= nil and home.owner == city.owner then
				if sameContinent(state, home.x, home.y, city.x, city.y, ruleset) then
					return true
				end
			end
		end
	end
	return false
end

-- A91: a city's GROSS shield output this turn -- base worked-tile shields, zeroed by
-- civil disorder, then the Factory chain (+shieldBonus%, doubled by a power source).
-- PRE-upkeep (upkeep is a separate deduction in processCities). Shared so pollution.luau
-- reads the SAME production number processCities does (no drift). Pure, both engines.
local function cityShieldOutput(state: any, city: any, ruleset: any): number
	local shields = cityYields(state, city, ruleset).shields
	if city.disorder == true then
		shields = 0
	end
	local shieldPct = effectPct(city, ruleset, "shieldBonus")
	if shieldPct > 0 then
		local powered = false
		for _, b in ipairs(city.buildings or {}) do
			if ruleset.buildings[b].effect.boostsFactory == true then
				powered = true
				break
			end
		end
		-- #29 hoover-dam: a same-continent Hydro Plant powers the city, doubling the factory bonus.
		if not powered and hooverPowersCity(state, city, ruleset) then
			powered = true
		end
		if powered then
			shieldPct *= 2
		end
		shields += idiv(shields * shieldPct, 100)
	end
	return shields
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
		-- A91: gross shields (disorder-zero + Factory chain) via the shared helper, so
		-- pollution.luau and production read the identical number.
		yields.shields = cityShieldOutput(state, city, ruleset)

		-- unit upkeep in shields (government-dependent)
		local gov = government.governmentOf(state, city.owner, ruleset)
		if gov.upkeepShields > 0 then
			local supported = 0
			for _, u in pairs(state.units) do
				-- air-truth: freeSupport units (diplomat, caravan) never cost shield upkeep
				if u.home == cityId and ruleset.units[u.type].freeSupport ~= true then
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

		-- settler food upkeep (user ruling: flat 1 food/settler — original-shape
		-- simplification, NOT Civ per-government). Homed settlers eat it (homeless
		-- free), over-expansion starves via food<0 below. Matches engine/cities.js.
		local settlerUpkeep = if ruleset.rules.settlerFoodUpkeep == nil then 0 else ruleset.rules.settlerFoodUpkeep
		local settlerFood = 0
		if settlerUpkeep > 0 then
			for _, u in pairs(state.units) do
				if u.home == cityId and u.type == "settlers" then
					settlerFood += settlerUpkeep
				end
			end
		end
		city.food = city.food + yields.food - city.pop * 2 - settlerFood
		local threshold = growthThreshold(state, city, ruleset)
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
				trimToPop(city)
				table.insert(events, { type = "cityStarved", cityId = cityId, pop = city.pop })
			end
		end

		city.shields += yields.shields
		local prod = city.producing
		local owner = state.players[city.owner]
		if prod.kind == "unit" then
			local unitType = ruleset.units[prod.id]
			local cost = itemCost("unit", prod.id, unitType, owner, ruleset, state)
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
				-- §40: a unit with a pop cost (settlers) deducts pop on completion; a city
				-- dropping below 1 is DISBANDED (it became the unit; unit goes homeless).
				local popCost = if unitType.popCost == nil then 0 else unitType.popCost
				if popCost > 0 then
					city.pop -= popCost
					if city.pop < 1 then
						disbandCity(state, cityId, events, ruleset)
					else
						trimToPop(city)
					end
				end
			end
		elseif prod.kind == "building" then
			local def = ruleset.buildings[prod.id]
			local cost = itemCost("building", prod.id, def, owner, ruleset, state)
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
		elseif prod.kind == "ss-part" then
			-- A76: a completed part auto-attaches to the owner's ship (the counter
			-- increments; player.spaceship is created on the first part — omit-safe).
			-- A launched ship or a maxed part keeps the shields and reverts.
			local def = ruleset.rules.ssParts[prod.id]
			local cost = itemCost("ss-part", prod.id, def, owner, ruleset, state)
			if city.shields >= cost then
				local ship = owner.spaceship
				local launched = ship ~= nil and ship.launched ~= nil and ship.launched ~= 0
				local have = if ship ~= nil and ship[prod.id] ~= nil then ship[prod.id] else 0
				if launched or have >= def.max then
					city.producing = { kind = "unit", id = "militia" }
				else
					city.shields -= cost
					if owner.spaceship == nil then
						owner.spaceship = {}
					end
					owner.spaceship[prod.id] = have + 1
					city.producing = { kind = "unit", id = "militia" }
					table.insert(events, { type = "ssPartBuilt", cityId = cityId, playerId = city.owner, part = prod.id, count = owner.spaceship[prod.id] })
				end
			end
		end
	end
end

return {
	foundCity = foundCity,
	foundCityLegality = foundCityLegality,
	createCityAt = createCityAt,
	setProduction = setProduction,
	setWorkers = setWorkers,
	buyProduction = buyProduction,
	helpWonder = helpWonder,
	sellBuilding = sellBuilding,
	sellBuildingFrom = sellBuildingFrom,
	processCities = processCities,
	cityYields = cityYields,
	cityShieldOutput = cityShieldOutput,
	workedTiles = workedTiles,
	candidateTiles = candidateTiles,
	tileYields = tileYields,
	FAT_CROSS = FAT_CROSS,
	hasBuilding = hasBuilding,
	trimToPop = trimToPop,
	wonderActive = wonderActive,
	wonderInCity = wonderInCity,
	nukesEnabled = nukesEnabled,
	effectPct = effectPct,
	itemCost = itemCost,
	growthThreshold = growthThreshold,
	civVeteran = civVeteran,
	citySpacingOk = citySpacingOk,
	unitObsolete = unitObsolete,
}
