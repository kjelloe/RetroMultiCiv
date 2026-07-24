--!strict
-- Luau twin of engine/pollution.js (A91): per-city smokestack pollution + nuclear
-- meltdown, and A91b global warming. Runs after cities.processCities (reads the SAME
-- gross shield output). RNG discipline: one smokestack roll per polluting city (+ a
-- placement pick on a hit), one meltdown roll per eligible city, greenhouse transform
-- picks. Global warming (A91b) rides the same tile.polluted flag. Matches
-- engine/pollution.js. EXPORTS (stable): process(state, ruleset, events).

local rng = require("./rng")
local cow = require("./cow")
local cities = require("./cities")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

-- the 8 neighbor offsets -- a meltdown fouls one ADJACENT square.
local ADJ = {
	{ dx = 0, dy = -1 }, { dx = 1, dy = -1 }, { dx = 1, dy = 0 }, { dx = 1, dy = 1 },
	{ dx = 0, dy = 1 }, { dx = -1, dy = 1 }, { dx = -1, dy = 0 }, { dx = -1, dy = -1 },
}
-- a fouled square + its 8 neighbors -- the greenhouse degrades terrain in this reach.
local SELF_ADJ = {
	{ dx = 0, dy = 0 }, { dx = 0, dy = -1 }, { dx = 1, dy = -1 }, { dx = 1, dy = 0 }, { dx = 1, dy = 1 },
	{ dx = 0, dy = 1 }, { dx = -1, dy = 1 }, { dx = -1, dy = 0 }, { dx = -1, dy = -1 },
}

-- the population pollution modifier %: the HIGHEST tech-gated tier the owner knows
-- (cumulative-latest, not additive) -- 0 with no industrial tech. Max is order-free.
local function popModifierPct(player: any, poll: any): number
	local pct = 0
	for tech, val in pairs(poll.popModifierPctByTech) do
		if table.find(player.techs, tech) ~= nil and val > pct then
			pct = val
		end
	end
	return pct
end

-- the land tiles among `offsets` around (cx, cy) that can still be fouled: in-bounds,
-- land domain, not already polluted. Deterministic order (the offset list).
local function pollutableTiles(state: any, cx: number, cy: number, offsets: any, ruleset: any): any
	local out = {}
	local W, H = state.map.width, state.map.height
	for _, o in ipairs(offsets) do
		local x = cx + o.dx
		if x < 0 or x >= W then
			if state.map.wrapX ~= true then
				continue
			end
			x = ((x % W) + W) % W
		end
		local y = cy + o.dy
		if y < 0 or y >= H then
			continue
		end
		local tile = state.map.tiles[y * W + x + 1]
		if ruleset.terrain.terrains[tile.t].domain ~= "land" then
			continue
		end
		if tile.polluted == true then
			continue
		end
		table.insert(out, { x = x, y = y })
	end
	return out
end

-- foul one random tile from `cands` (rng-pick), returning the fouled {x,y} or nil --
-- the placement roll is consumed ONLY when there is a candidate. Caller emits the event.
local function foulOne(state: any, cands: any): any
	if #cands == 0 then
		return nil
	end
	local roll = rng.rollRange(state.rngState, #cands)
	state.rngState = roll.rngState
	local t = cands[roll.value + 1]
	cow.cowTile(state, t.y * state.map.width + t.x).polluted = true
	return t
end

-- the greenhouse event: for each fouled square (in index order), degrade one matching
-- tile in its reach (self + neighbors) per warmingTransforms, then clear that square's
-- pollution -- so warming self-limits (it eats the pollution that drove it).
local function greenhouse(state: any, ruleset: any, polluted: any, events: any)
	local poll = ruleset.rules.pollution
	local W, H = state.map.width, state.map.height
	for _, idx in ipairs(polluted) do
		local ex = idx % W
		local ey = idiv(idx, W)
		local cands = {}
		for _, o in ipairs(SELF_ADJ) do
			local x = ex + o.dx
			if x < 0 or x >= W then
				if state.map.wrapX ~= true then
					continue
				end
				x = ((x % W) + W) % W
			end
			local y = ey + o.dy
			if y < 0 or y >= H then
				continue
			end
			if poll.warmingTransforms[state.map.tiles[y * W + x + 1].t] ~= nil then
				table.insert(cands, { x = x, y = y })
			end
		end
		if #cands > 0 then
			local pick = rng.rollRange(state.rngState, #cands)
			state.rngState = pick.rngState
			local c = cands[pick.value + 1]
			local tt = cow.cowTile(state, c.y * W + c.x)
			tt.t = poll.warmingTransforms[tt.t]
			if tt.polluted == true then
				tt.polluted = nil
			end
			table.insert(events, { type = "terrainWarmed", x = c.x, y = c.y })
		end
		cow.cowTile(state, idx).polluted = nil
	end
end

-- A91b global warming: while enough of the map stays fouled, a staged clock advances;
-- on the last stage a greenhouse event degrades terrain near the fouled squares and
-- consumes that pollution, then the clock resets. state.warmingStage/warmingTimer stay
-- absent until the first threshold crossing (omit-when-default). Deterministic.
local function processWarming(state: any, ruleset: any, events: any)
	local poll = ruleset.rules.pollution
	if poll == nil then
		return
	end
	local tiles = state.map.tiles
	local polluted = {}
	for i = 0, #tiles - 1 do
		if tiles[i + 1].polluted == true then
			table.insert(polluted, i)
		end
	end
	if #polluted < poll.warmingThreshold then
		return
	end
	local stage = if state.warmingStage == nil then 0 else state.warmingStage
	local timer = (if state.warmingTimer == nil then 0 else state.warmingTimer) + 1
	if timer >= poll.warmingStageTurns then
		timer = 0
		stage = stage + 1
		if stage >= poll.warmingStages then
			stage = 0
			greenhouse(state, ruleset, polluted, events)
		end
	end
	state.warmingStage = stage
	state.warmingTimer = timer
end

-- A91: per-city smokestack pollution + nuclear meltdown, once per turn; then warming.
local function process(state: any, ruleset: any, events: any)
	local poll = ruleset.rules.pollution
	if poll == nil then
		return
	end
	local order = if state.cityOrder == nil then {} else state.cityOrder
	local workedMap = cities.resolveAllWorked(state, ruleset) -- A8: one snapshot for the loop
	for _, cityId in ipairs(order) do
		local city = state.cities[cityId]
		if city == nil then
			continue
		end
		local owner = state.players[city.owner]
		-- industrial pollution: gross shields / divisor (a power plant halves it, a
		-- recycling centre thirds it and takes precedence).
		local divisor = 1
		if cities.hasBuilding(city, "recycling-center") then
			divisor = poll.industrialDivisorRecycling
		elseif cities.hasBuilding(city, "hydro-plant") or cities.hasBuilding(city, "nuclear-plant") then
			divisor = poll.industrialDivisorPower
		end
		local industrial = idiv(cities.cityShieldOutput(state, city, ruleset, workedMap[cityId]), divisor)
		-- population pollution: citySize * the tech modifier %, zeroed by Mass Transit.
		local popPoll = 0
		if not cities.hasBuilding(city, "mass-transit") then
			popPoll = idiv(city.pop * popModifierPct(owner, poll), 100)
		end
		local points = (industrial + popPoll) - poll.tolerance
		if points > 0 then
			local chance = points * poll.smokestackPctPerPoint
			if chance > 100 then
				chance = 100
			end
			local roll = rng.rollRange(state.rngState, 100)
			state.rngState = roll.rngState
			if roll.value < chance then
				local t = foulOne(state, pollutableTiles(state, city.x, city.y, cities.FAT_CROSS, ruleset))
				if t ~= nil then
					table.insert(events, { type = "pollutionSpread", x = t.x, y = t.y })
				end
			end
		end
		-- A91 meltdown (#2110): a nuclear-plant city in civil disorder, BEFORE Fusion
		-- Power, risks a meltdown that fouls one adjacent square (pollution only).
		if cities.hasBuilding(city, "nuclear-plant") and city.disorder == true
			and table.find(owner.techs, "fusion-power") == nil then
			local roll = rng.rollRange(state.rngState, poll.meltdownChance)
			state.rngState = roll.rngState
			if roll.value == 0 then
				local t = foulOne(state, pollutableTiles(state, city.x, city.y, ADJ, ruleset))
				if t ~= nil then
					table.insert(events, { type = "cityMeltdown", cityId = cityId, x = t.x, y = t.y })
				end
			end
		end
	end
	processWarming(state, ruleset, events)
end

return {
	process = process,
}
