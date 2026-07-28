--!strict
-- Luau twin of engine/mapgen.js (phase 5, P5-7): seeded world generation.
-- THE HEAVIEST RNG CONSUMER in the engine — every rollRange call below sits
-- in exactly the JS order (continents walk, band assignment, rivers,
-- specials, starts); one stray or skipped roll shifts every tile after it.
-- Gate: scenario 002 — same seed, same world canonical hash, both engines.
-- EXPORTS (stable): createGame(setup, ruleset), tileDistance, pickWeighted.

local rng = require("./rng")
local statehash = require("./statehash")
local visibility = require("./visibility")

local DEFAULTS = { width = 80, height = 50, landPercent = 32, continents = 5 }

-- #36 river knobs (OURS — house tuning) + the fixed N,E,S,W neighbour order for the
-- river distance-field BFS + gradient tie-breaks (deterministic; matches engine/mapgen.js).
local RIVER_PCT = 11
local MEANDER_PCT = 25
local N4 = { { dx = 0, dy = -1 }, { dx = 1, dy = 0 }, { dx = 0, dy = 1 }, { dx = -1, dy = 0 } }

-- Terrain pick tables per latitude band: {terrainId, weight}
local BAND_POLAR = { { "tundra", 55 }, { "forest", 20 }, { "hills", 15 }, { "mountains", 10 } }
local BAND_TEMPERATE_FAR = { { "forest", 25 }, { "grassland", 30 }, { "plains", 20 }, { "hills", 15 }, { "mountains", 10 } }
local BAND_TEMPERATE = { { "grassland", 35 }, { "plains", 25 }, { "forest", 15 }, { "hills", 10 }, { "mountains", 10 }, { "swamp", 5 } }
local BAND_TROPIC = { { "desert", 20 }, { "plains", 20 }, { "grassland", 25 }, { "jungle", 20 }, { "swamp", 10 }, { "mountains", 5 } }

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function pickWeighted(rngState: number, entries: { { any } })
	local total = 0
	for _, e in ipairs(entries) do
		total += e[2]
	end
	local roll = rng.rollRange(rngState, total)
	local acc = 0
	for _, e in ipairs(entries) do
		acc += e[2]
		if roll.value < acc then
			return { rngState = roll.rngState, value = e[1] }
		end
	end
	return { rngState = roll.rngState, value = entries[#entries][1] }
end

local function wrap(x: number, width: number): number
	return ((x % width) + width) % width
end

-- Wrap-aware Chebyshev distance between two tiles.
local function tileDistance(ax: number, ay: number, bx: number, by: number, width: number, wrapX: boolean): number
	local dx = math.abs(ax - bx)
	if wrapX and width - dx < dx then
		dx = width - dx
	end
	local dy = math.abs(ay - by)
	return if dx > dy then dx else dy
end

-- W7 (specs/map-shapes-w7.md): the MASK STAGE. A named map type may confine the
-- land-blob budget to a shape -- the walk still wanders freely, it just cannot
-- leave land outside the mask. Pure integer math: offsets from the map centre are
-- expressed in PERCENT of the half-extent (doubled coordinates keep the centre
-- exact on even sizes), so a shape is size-independent. WRAP-AWARE in x -- the world
-- is a cylinder (map.wrapX is always true), so a ring must close across x=0 instead
-- of seaming there. No mask (the four pre-W7 types) => the legacy path, untouched.
local function maskAllows(mask: any, x: number, y: number, width: number, height: number): boolean
	if mask == nil then
		return true
	end
	local dx = x * 2 - (width - 1)
	if dx < 0 then
		dx = -dx
	end
	if width * 2 - dx < dx then
		dx = width * 2 - dx -- the short way round the cylinder
	end
	local dy = y * 2 - (height - 1)
	if dy < 0 then
		dy = -dy
	end
	local dxPct = idiv(dx * 100, width - 1)
	local dyPct = idiv(dy * 100, height - 1)
	local r2 = dxPct * dxPct + dyPct * dyPct
	-- CLOVER: four symmetric petals (one per quadrant) joined by a central hub, so
	-- every petal has a choke onto contested middle ground. petalPct = how far the
	-- petal centres sit from the map centre, lobePct = petal radius, hubPct = the
	-- radius of the connecting middle. Petals are mirrored, so testing the ABSOLUTE
	-- offset against one petal centre covers all four.
	if mask.lobePct ~= nil then
		if r2 <= mask.hubPct * mask.hubPct then
			return true
		end
		local px = dxPct - mask.petalPct
		local py = dyPct - mask.petalPct
		return px * px + py * py <= mask.lobePct * mask.lobePct
	end
	local inner = if mask.innerPct == nil then 0 else mask.innerPct
	local outer = if mask.outerPct == nil then 0 else mask.outerPct
	if inner > 0 and r2 < inner * inner then
		return false
	end
	if outer > 0 and r2 > outer * outer then
		return false
	end
	return true
end

local function generateTiles(r0: number, width: number, height: number, landPercent: number, continents: number, mask: any)
	local tiles = setmetatable({}, statehash.ARRAY_MT)
	for i = 1, width * height do
		tiles[i] = { t = "ocean" }
	end

	-- polar caps: top and bottom rows are Arctic land
	for x = 0, width - 1 do
		tiles[x + 1] = { t = "arctic" }
		tiles[(height - 1) * width + x + 1] = { t = "arctic" }
	end

	-- continents: drunkard's-walk blobs of placeholder land
	local targetLand = idiv(width * height * landPercent, 100)
	local r = r0
	for _ = 1, continents do
		local budget = idiv(targetLand, continents)
		local roll = rng.rollRange(r, width)
		r = roll.rngState
		local x = roll.value
		roll = rng.rollRange(r, height - 8)
		r = roll.rngState
		local y = 4 + roll.value
		-- a masked shape needs a start INSIDE the mask, or the blob spends its whole
		-- step budget wandering the forbidden sea. Bounded re-rolls keep the draw count
		-- finite (and identical in both engines); the fallback scan is deterministic.
		if mask ~= nil then
			local tries = 0
			while tries < 40 and not maskAllows(mask, x, y, width, height) do
				tries += 1
				roll = rng.rollRange(r, width)
				r = roll.rngState
				x = roll.value
				roll = rng.rollRange(r, height - 8)
				r = roll.rngState
				y = 4 + roll.value
			end
			if not maskAllows(mask, x, y, width, height) then
				local found = false
				for yy = 2, height - 3 do
					if not found then
						for xx = 0, width - 1 do
							if maskAllows(mask, xx, yy, width, height) then
								x = xx
								y = yy
								found = true
								break
							end
						end
					end
				end
			end
		end
		local steps = if mask == nil then budget * 10 else budget * 20
		while budget > 0 and steps > 0 do
			steps -= 1
			local i = y * width + x + 1
			if tiles[i].t == "ocean" and maskAllows(mask, x, y, width, height) then
				tiles[i].t = "land"
				budget -= 1
			end
			roll = rng.rollRange(r, 4)
			r = roll.rngState
			if roll.value == 0 then
				x = wrap(x + 1, width)
			elseif roll.value == 1 then
				x = wrap(x - 1, width)
			elseif roll.value == 2 then
				y += 1
			else
				y -= 1
			end
			if y < 2 then
				y = 2
			end
			if y > height - 3 then
				y = height - 3
			end
		end
	end

	-- terrain assignment by latitude band
	local equator2 = height - 1 -- compare against y*2 to stay in integers
	for y = 1, height - 2 do
		local latPct = idiv(math.abs(y * 2 - equator2) * 100, equator2)
		for x = 0, width - 1 do
			local i = y * width + x + 1
			if tiles[i].t == "land" then
				local band = if latPct >= 85 then BAND_POLAR
					elseif latPct >= 60 then BAND_TEMPERATE_FAR
					elseif latPct >= 30 then BAND_TEMPERATE
					else BAND_TROPIC
				local pick = pickWeighted(r, band)
				r = pick.rngState
				tiles[i].t = pick.value
			end
		end
	end

	-- rivers (#36, ruling A #2522): the `river` FLAG as meandering CONTINUOUS strips —
	-- springs in hills/mountains gradient-descend a distance-to-ocean field to the coast,
	-- ~RIVER_PCT% of land flagged, MEANDER_PCT free-wiggle. Byte-shaped twin of mapgen.js
	-- (fixed N4 order, ocean-index queue order, single rng sequence, order-based ties).
	-- Fix (A) #2573: FLAG never SET on hills (mountains already excluded) — B19 bans
	-- mining a river tile, so a river-hill would strand its +3 mine at 0 shields; the
	-- strip walks through hills unflagged, flags the first non-hills tile downstream.
	local landCount = 0
	for _, t in ipairs(tiles) do
		if t.t ~= "ocean" and t.t ~= "arctic" then
			landCount += 1
		end
	end
	local target = idiv(landCount * RIVER_PCT, 100)
	local dist = {}
	for i = 0, width * height - 1 do
		dist[i] = -1
	end
	local queue = {}
	for i = 0, width * height - 1 do
		if tiles[i + 1].t == "ocean" then
			dist[i] = 0
			table.insert(queue, i)
		end
	end
	local qh = 1
	while qh <= #queue do
		local i = queue[qh]
		qh += 1
		local cx = i % width
		local cy = idiv(i, width)
		for _, d in ipairs(N4) do
			local nx = wrap(cx + d.dx, width)
			local ny = cy + d.dy
			if ny >= 0 and ny < height then
				local ni = ny * width + nx
				if dist[ni] == -1 and tiles[ni + 1].t ~= "ocean" then
					dist[ni] = dist[i] + 1
					table.insert(queue, ni)
				end
			end
		end
	end
	local springs = {}
	for i = 0, width * height - 1 do
		local tt = tiles[i + 1].t
		if tt == "hills" or tt == "mountains" then
			table.insert(springs, i)
		end
	end
	local flagged = 0
	while flagged < target and #springs > 0 do
		local roll = rng.rollRange(r, #springs)
		r = roll.rngState
		local springIdx = springs[roll.value + 1]
		table.remove(springs, roll.value + 1)
		local x = springIdx % width
		local y = idiv(springIdx, width)
		local steps = 0
		local maxSteps = width + height
		while steps < maxSteps and flagged < target do
			local tile = tiles[y * width + x + 1]
			if tile.t == "ocean" then
				break
			end
			if tile.t ~= "arctic" and tile.t ~= "mountains" and tile.t ~= "hills" and tile.river ~= true then
				tile.river = true
				flagged += 1
			end
			local cand = {}
			for _, d in ipairs(N4) do
				local nx = wrap(x + d.dx, width)
				local ny = y + d.dy
				if ny >= 0 and ny < height then
					table.insert(cand, { nx = nx, ny = ny, dd = dist[ny * width + nx] })
				end
			end
			if #cand == 0 then
				break
			end
			roll = rng.rollRange(r, 100)
			r = roll.rngState
			if roll.value < MEANDER_PCT then
				roll = rng.rollRange(r, #cand)
				r = roll.rngState
				x = cand[roll.value + 1].nx
				y = cand[roll.value + 1].ny
			else
				local chosen = cand[1]
				for _, c in ipairs(cand) do
					if c.dd ~= -1 and (chosen.dd == -1 or c.dd < chosen.dd) then
						chosen = c
					end
				end
				x = chosen.nx
				y = chosen.ny
			end
			steps += 1
		end
	end

	-- special resources: grassland uses the fixed shield pattern (NO rng),
	-- everything else rolls sparsely — the per-tile branch decides whether a
	-- roll is consumed, so the scan order (y outer, x inner, full map
	-- including polar rows) is part of the rng contract
	for y = 0, height - 1 do
		for x = 0, width - 1 do
			local tile = tiles[y * width + x + 1]
			if tile.t == "grassland" then
				if (x + y) % 2 == 0 then
					tile.special = true
				end
			else
				local roll = rng.rollRange(r, 16)
				r = roll.rngState
				if roll.value == 0 then
					tile.special = true
				end
			end
		end
	end

	return { tiles = tiles, rngState = r }
end

-- W7 clover: which petal (quadrant) a tile sits in -- NE/NW/SE/SW as 0..3. Only
-- meaningful for the petal shapes; used to spread starts one civ per petal, which
-- is the whole point of the shape (without it civs pile into two lobes and the
-- contested centre never becomes contested -- measured: 2-3 distinct petals of 4).
local function petalOf(x: number, y: number, width: number, height: number): number
	local east = if x * 2 > width - 1 then 1 else 0
	local south = if y * 2 > height - 1 then 1 else 0
	return south * 2 + east
end

local function findStarts(r0: number, map: any, players: { any }, petals: boolean?)
	local width, height, tiles = map.width, map.height, map.tiles
	local starts = {}
	local r = r0
	local minDist = 12
	local GOOD: { [string]: boolean } = { grassland = true, plains = true }
	while #starts < #players and minDist >= 0 do
		local attempts = 300
		while #starts < #players and attempts > 0 do
			attempts -= 1
			local roll = rng.rollRange(r, width)
			r = roll.rngState
			local x = roll.value
			roll = rng.rollRange(r, height - 7)
			r = roll.rngState
			local y = 3 + roll.value -- starts keep 3 tiles from the polar edges
			local tile = tiles[y * width + x + 1]
			-- petal round-robin: the Nth civ wants the Nth petal. The demand RELAXES with
			-- the distance rule (the outer loop), so a cramped world still fills every
			-- seat instead of failing -- same shape as the existing minDist relaxation.
			local petalOk = true
			if petals == true and minDist > 0 and petalOf(x, y, width, height) ~= #starts % 4 then
				petalOk = false
			end
			if GOOD[tile.t] == true and petalOk then
				local clear = true
				for _, s in ipairs(starts) do
					if tileDistance(x, y, s.x, s.y, width, true) < minDist then
						clear = false
						break
					end
				end
				if clear then
					table.insert(starts, { x = x, y = y })
				end
			end
		end
		minDist -= 3 -- relax if the world is too cramped
	end
	return { starts = starts, rngState = r }
end

-- setup: { seed, options: { width?, height?, players: [{id,name,color,human}] } }
local function createGame(setup: any, ruleset: any): any
	local options = setup.options or {}
	-- JS `||`: 0 is falsy there too — transliterated, not tidied
	local width = if options.width == nil or options.width == 0 then DEFAULTS.width else options.width
	local height = if options.height == nil or options.height == 0 then DEFAULTS.height else options.height
	local playerDefs = options.players
	if playerDefs == nil or #playerDefs < 1 then
		return { ok = false, reason = "noPlayers" }
	end

	-- A82a: a named map-type preset (rules.mapTypes) supplies landPercent/
	-- continents when the caller didn't set them explicitly; unknown or absent
	-- type falls through to DEFAULTS — the 'continents' preset carries the
	-- DEFAULTS values, so the default world is byte-identical by construction.
	local presets = ruleset.rules.mapTypes
	local preset: any = {}
	if presets ~= nil and options.mapType ~= nil and presets[options.mapType] ~= nil then
		preset = presets[options.mapType]
	end

	local r = rng.seedRng(setup.seed)
	local landPercent = if options.landPercent == nil or options.landPercent == 0
		then (if preset.landPercent == nil or preset.landPercent == 0 then DEFAULTS.landPercent else preset.landPercent)
		else options.landPercent
	local continents = if options.continents == nil or options.continents == 0
		then (if preset.continents == nil or preset.continents == 0 then DEFAULTS.continents else preset.continents)
		else options.continents
	local mask: any = nil
	if preset.maskKind ~= nil then
		mask = {
			innerPct = preset.maskInnerPct, outerPct = preset.maskOuterPct,
			petalPct = preset.maskPetalPct, lobePct = preset.maskLobePct,
			hubPct = preset.maskHubPct,
		}
	end
	local gen = generateTiles(r, width, height, landPercent, continents, mask)
	local map = { width = width, height = height, wrapX = true, tiles = gen.tiles }

	local found = findStarts(gen.rngState, map, playerDefs, preset.maskLobePct ~= nil)
	if #found.starts < #playerDefs then
		return { ok = false, reason = "noStartPositions" }
	end

	-- difficulty ladder: resolve the level (ascii id) from setup, default 'prince';
	-- startGold is a WORLD knob (every player, all-AI too). Matches engine/mapgen.js.
	local difficulties = ruleset.rules.difficulties
	local dlevel: any = nil
	if difficulties ~= nil then
		if options.difficulty ~= nil and difficulties[options.difficulty] ~= nil then
			dlevel = options.difficulty
		elseif difficulties.prince ~= nil then
			dlevel = "prince"
		end
	end
	local startGold = if dlevel ~= nil then difficulties[dlevel].startGold else 0

	local players = {}
	local playerOrder = setmetatable({}, statehash.ARRAY_MT)
	local units = {}
	for i = 1, #playerDefs do
		local p = playerDefs[i]
		players[p.id] = {
			id = p.id, name = p.name, color = p.color,
			human = p.human == true, alive = true, gold = startGold,
			techs = setmetatable({}, statehash.ARRAY_MT), researching = "",
			bulbs = 0,
			taxRate = ruleset.rules.defaultTaxRate,
			sciRate = ruleset.rules.defaultSciRate,
		}
		-- civilization identity + starting specialty; defs without a civ
		-- (tests, older callers) get none — hash-stable
		if p.civ ~= nil and ruleset.civs ~= nil and ruleset.civs[p.civ] ~= nil then
			players[p.id].civ = p.civ
			local spec = ruleset.civs[p.civ].specialty
			if spec ~= nil then
				if spec.type == "startTech" then
					table.insert(players[p.id].techs, spec.tech)
				end
				if spec.type == "startGold" then
					players[p.id].gold += spec.gold
				end
			end
		end
		table.insert(playerOrder, p.id)
		local uid = "u" .. i
		units[uid] = {
			id = uid, type = "settlers", owner = p.id,
			x = found.starts[i].x, y = found.starts[i].y,
			moves = ruleset.units.settlers.moves, fortified = false, veteran = false,
		}
	end

	-- stance-mix v1: seed a fraction of the AI civs as 'builder' (heterogeneous
	-- economy). Deterministic + replay-identical: a Fisher-Yates shuffle through
	-- the game rng, threaded into rngState. aiBuilderPct=0 (or no AI) -> zero
	-- builders, NO stance field, NO rng draw => byte-identical to pre-stance.
	-- Matches engine/mapgen.js (JS 0-based order[i]/order[j] == luau order[i+1]/order[j+1]).
	local rngS = found.rngState
	local aiIds = {}
	for i = 1, #playerDefs do
		if playerDefs[i].human ~= true then
			table.insert(aiIds, playerDefs[i].id)
		end
	end
	local builderPct = if ruleset.rules.aiBuilderPct == nil then 0 else ruleset.rules.aiBuilderPct
	local nBuilders = if (builderPct == 0 or #aiIds == 0) then 0 else math.max(1, idiv(#aiIds * builderPct, 100))
	if nBuilders > 0 then
		local order = {}
		for i = 1, #aiIds do order[i] = aiIds[i] end
		for bi = #order, 2, -1 do
			local r = rng.rollRange(rngS, bi)
			rngS = r.rngState
			local j = r.value
			local tmp = order[bi]; order[bi] = order[j + 1]; order[j + 1] = tmp
		end
		for k = 1, nBuilders do
			players[order[k]].stance = "builder"
		end
	end

	local state = {
		version = 1,
		-- ruleset-compat pin: the statehash of the creation ruleset (docs/02 §7),
		-- so a save carries its rules; strict at LOAD, omit-safe. Matches engine/mapgen.js.
		rulesetHash = statehash.hashState(ruleset),
		turn = 1,
		year = -4000,
		activePlayer = playerOrder[1],
		playerOrder = playerOrder,
		map = map,
		units = units,
		cities = {},
		cityOrder = setmetatable({}, statehash.ARRAY_MT),
		wonders = {},
		nextUnitId = #playerDefs + 1,
		nextCityId = 1,
		players = players,
		rngState = rngS,
	}
	-- omit-safe: rulesets without a difficulties table carry no difficulty field.
	if dlevel ~= nil then
		state.difficulty = dlevel
	end

	visibility.initExplored(state)
	local unitIds = {}
	for id in pairs(units) do
		table.insert(unitIds, id)
	end
	table.sort(unitIds) -- reveal writes are idempotent; sorted per port rule
	for _, id in ipairs(unitIds) do
		local u = units[id]
		visibility.reveal(state, u.owner, u.x, u.y, 2)
	end
	-- N13: goody-hut sprinkle — the LAST createGame rng pass. Per-LAND-tile
	-- 1-in-rules.hut.density over the linear tile index, EXCLUDING every start tile
	-- + its 8 neighbours. Shifts the rng sequence -> full map/sim golden re-record.
	local hutExcl = {}
	for _, s in ipairs(found.starts) do
		for dy = -1, 1 do
			local ey = s.y + dy
			if ey >= 0 and ey < height then
				for dx = -1, 1 do
					local ex = (((s.x + dx) % width) + width) % width
					hutExcl[ey * width + ex] = true
				end
			end
		end
	end
	local hutDensity = ruleset.rules.hut.density
	for i = 0, width * height - 1 do
		if hutExcl[i] ~= true and ruleset.terrain.terrains[state.map.tiles[i + 1].t].domain == "land" then
			local roll = rng.rollRange(state.rngState, hutDensity)
			state.rngState = roll.rngState
			if roll.value == 0 then
				state.map.tiles[i + 1].hut = true
			end
		end
	end
	-- A92: debug games carry state.debugEnabled (OMIT-SAFE — normal games untouched).
	if setup.debug == true then
		state.debugEnabled = true
	end
	return state
end

return {
	createGame = createGame,
	tileDistance = tileDistance,
	pickWeighted = pickWeighted,
}
