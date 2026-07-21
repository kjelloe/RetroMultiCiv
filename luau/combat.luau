--!strict
-- Luau twin of engine/combat.js (phase 5, P5-4 batch 2 — replaces the P5-3
-- stub). Civ 1 one-shot combat: strengths are integer PRODUCTS (percent
-- scale x100 per factor) so the probability roll needs no division.
-- RNG CALL ORDER IS PART OF THE CONTRACT: combat roll(s) first (one per
-- round under rules.combatRounds), then exactly one promotion roll for the
-- surviving non-veteran — a stray roll diverges every hash after it.
-- EXPORTS (stable): resolveAttack, captureCity, bestDefender, unitsAt,
-- cityAt, attackStrength, defenseStrength, tileDefensePct, sortIds.

local rng = require("./rng")
local statehash = require("./statehash")
local visibility = require("./visibility")
local cities = require("./cities")
local government = require("./government")
local diplomacy = require("./diplomacy") -- D3: attack-grievance

-- Deterministic id ordering that needs no key order: shorter first, then
-- lexicographic — so u2 < u10.
local function sortIds(ids: { string }): { string }
	local out = table.clone(ids)
	table.sort(out, function(a, b)
		if #a ~= #b then
			return #a < #b
		end
		return a < b
	end)
	return out
end

local function unitsAt(state: any, x: number, y: number): { any }
	local out = {}
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in sortIds(keys) do
		local u = state.units[id]
		-- A69: cargo aboard a ship is hidden -- it occupies no tile of its own
		if u.aboard == nil and u.x == x and u.y == y then
			table.insert(out, u)
		end
	end
	return out
end

local function cityAt(state: any, x: number, y: number): any
	for _, id in ipairs(state.cityOrder or {}) do
		local c = state.cities[id]
		if c ~= nil and c.x == x and c.y == y then
			return c
		end
	end
	return nil
end

local function tileDefensePct(state: any, x: number, y: number, ruleset: any): number
	local tile = state.map.tiles[y * state.map.width + x + 1]
	local terrain = ruleset.terrain.terrains[tile.t]
	local pct = 100 + terrain.defenseBonus
	if tile.river then
		pct += ruleset.terrain.riverModifier.defenseBonus
	end
	return pct
end

local function attackStrength(unit: any, ruleset: any): number
	return ruleset.units[unit.type].attack * (if unit.veteran then 150 else 100) * 100
end

-- City Walls (or an active Great Wall) triple the defense of units in the city.
local function cityWallsAt(state: any, x: number, y: number, ruleset: any): boolean
	local city = cityAt(state, x, y)
	if city == nil then
		return false
	end
	if cities.hasBuilding(city, "city-walls") then
		return true
	end
	if ruleset.wonders ~= nil and cities.wonderActive(state, "great-wall", ruleset) then
		local wonderHome = state.cities[state.wonders["great-wall"]]
		if wonderHome ~= nil and wonderHome.owner == city.owner then
			return true
		end
	end
	return false
end

-- A fortress doubles defense (city walls take precedence, they don't stack).
local function fortressAt(state: any, x: number, y: number): boolean
	return state.map.tiles[y * state.map.width + x + 1].fortress == true
		and cityAt(state, x, y) == nil
end

-- air-truth: a bomber (ignoresWalls) skips the City Walls / Great Wall 3x
-- multiplier (but NOT a fortress). No attacker passed = walls count as before.
local function defenseStrength(state: any, unit: any, ruleset: any, attacker: any?): number
	local ignoresWalls = attacker ~= nil and ruleset.units[attacker.type].ignoresWalls == true
	local mult = if not ignoresWalls and cityWallsAt(state, unit.x, unit.y, ruleset) then 3
		elseif fortressAt(state, unit.x, unit.y) then 2
		else 1
	return ruleset.units[unit.type].defense
		* tileDefensePct(state, unit.x, unit.y, ruleset)
		* (if unit.fortified then 150 else 100)
		* mult
end

-- Civ 1: the strongest defender on the tile fights. Strict > keeps the
-- first of any tie in unitsAt's sorted order, like JS.
local function bestDefender(state: any, x: number, y: number, ruleset: any): any
	local here = unitsAt(state, x, y)
	local best = nil
	local bestScore = -1
	for _, u in ipairs(here) do
		-- R1 (N13): a barbarian leader hides behind its escort — never the chosen
		-- defender while another unit shares its tile.
		if #here > 1 and ruleset.units[u.type].barbLeader == true then
			continue
		end
		local score = defenseStrength(state, u, ruleset)
		if score > bestScore then
			best = u
			bestScore = score
		end
	end
	return best
end

local function maybePromote(state: any, unit: any, events: any)
	if unit.veteran then
		return
	end
	local roll = rng.rollRange(state.rngState, 2)
	state.rngState = roll.rngState
	if roll.value == 0 then
		unit.veteran = true
		table.insert(events, { type = "promoted", unitId = unit.id })
	end
end

-- Attacker on (attacker.x/y) strikes the defended tile (tx, ty). Mutates state.
local function resolveAttack(state: any, attacker: any, tx: number, ty: number, ruleset: any): any
	local atype = ruleset.units[attacker.type]
	if atype.attack <= 0 then
		return { ok = false, reason = "cannotAttack" }
	end
	if attacker.moves <= 0 then
		return { ok = false, reason = "noMovesLeft" }
	end

	local tileDomain = ruleset.terrain.terrains[state.map.tiles[ty * state.map.width + tx + 1].t].domain
	-- A72: air units strike targets on any tile; sea units bombard coastal land.
	local canReach = atype.domain == "air" or tileDomain == atype.domain
		or (atype.domain == "sea" and tileDomain == "land")
	if not canReach then
		return { ok = false, reason = "cannotAttackThere" } -- e.g. land unit vs ships at sea
	end

	local defender = bestDefender(state, tx, ty, ruleset)
	if defender == nil then
		return { ok = false, reason = "nothingToAttack" }
	end
	-- air-truth: an air-domain unit IN FLIGHT (not in a city, not aboard a carrier)
	-- may be attacked ONLY by a Fighter (attacksAir). No defensive ground fire.
	if ruleset.units[defender.type].domain == "air" and defender.aboard == nil
		and cityAt(state, defender.x, defender.y) == nil and atype.attacksAir ~= true then
		return { ok = false, reason = "needsFighter" }
	end
	-- D3: the DEFENDER's owner gains grievance toward the ATTACKER (directed). Skip
	-- barbarians. Omit-safe when no diplomacy ruleset.
	if attacker.owner ~= "barb" and defender.owner ~= "barb" and ruleset.rules.diplomacy ~= nil then
		diplomacy.bumpRel(state, defender.owner, attacker.owner, "grievance", ruleset.rules.diplomacy.relGrievanceOnAttack)
	end

	local att = attackStrength(attacker, ruleset)
	local def = defenseStrength(state, defender, ruleset, attacker)
	-- rules.combatRounds 1 = authentic Civ 1 one-shot (exactly one roll);
	-- 3 = best-of-three, a setup option
	local rounds = if ruleset.rules.combatRounds == nil then 1 else ruleset.rules.combatRounds
	local need = math.floor(rounds / 2) + 1
	local attWins, defWins = 0, 0
	while attWins < need and defWins < need do
		local roll = rng.rollRange(state.rngState, att + def)
		state.rngState = roll.rngState
		if roll.value < att then
			attWins += 1
		else
			defWins += 1
		end
	end
	local attackerWins = attWins == need

	attacker.moves = attacker.moves - 1
	attacker.fortified = false

	local events = setmetatable({}, statehash.ARRAY_MT)
	if attackerWins then
		-- stacks die on open ground; cities AND fortresses lose one at a time
		local sheltered = cityAt(state, tx, ty) ~= nil or fortressAt(state, tx, ty)
		local casualties = if sheltered then { defender } else unitsAt(state, tx, ty)
		-- R1 (N13): a barbarian leader survives open-ground annihilation of its
		-- escort — it dies only as the SOLE defender.
		if not sheltered and #casualties > 1 then
			local filtered = {}
			for _, u in ipairs(casualties) do
				if ruleset.units[u.type].barbLeader ~= true then
					table.insert(filtered, u)
				end
			end
			casualties = filtered
		end
		for _, u in ipairs(casualties) do
			state.units[u.id] = nil
			-- A69: a sunk ship drowns its cargo (deterministic id order)
			local cargoKeys = {}
			for id in pairs(state.units) do
				table.insert(cargoKeys, id)
			end
			for _, cid in sortIds(cargoKeys) do
				local c = state.units[cid]
				if c ~= nil and c.aboard == u.id then
					state.units[cid] = nil
					table.insert(events, { type = "cargoLost", unitId = cid, owner = c.owner, shipId = u.id, x = u.x, y = u.y })
				end
			end
			-- N13: killing a LONE barbarian leader pays the killing civ a ransom.
			if ruleset.units[u.type].barbLeader == true then
				local killer = state.players[attacker.owner]
				if killer ~= nil then
					killer.gold = killer.gold + ruleset.rules.barb.leaderRansom
				end
				table.insert(events, { type = "ransomPaid", playerId = attacker.owner, gold = ruleset.rules.barb.leaderRansom, x = tx, y = ty })
			end
		end
		table.insert(events, {
			type = "combatResolved", winner = "attacker",
			attackerId = attacker.id, attackerType = attacker.type, attackerOwner = attacker.owner,
			defenderId = defender.id, defenderType = defender.type, defenderOwner = defender.owner,
			x = tx, y = ty, unitsLost = #casualties,
		})
		-- A72: a one-shot attacker (nuclear) is consumed by its strike and does
		-- not promote; a normal attacker rolls for veteran promotion.
		if atype.oneShot == true then
			state.units[attacker.id] = nil
			table.insert(events, { type = "unitConsumed", unitId = attacker.id, owner = attacker.owner, x = attacker.x, y = attacker.y })
		else
			maybePromote(state, attacker, events)
		end
	else
		state.units[attacker.id] = nil
		table.insert(events, {
			type = "combatResolved", winner = "defender",
			attackerId = attacker.id, attackerType = attacker.type, attackerOwner = attacker.owner,
			defenderId = defender.id, defenderType = defender.type, defenderOwner = defender.owner,
			x = tx, y = ty, unitsLost = 1,
		})
		maybePromote(state, defender, events)
	end
	return { ok = true, events = events }
end

-- A unit entering an undefended enemy city: ownership flips, population
-- drops, a share of the loser's treasury is plundered.
local function captureCity(state: any, unit: any, city: any, events: any, ruleset: any)
	local loserId = city.owner
	-- A76: was this the loser's capital? (checked BEFORE reassigning owner)
	local loserCapital = if ruleset == nil then nil else government.capitalOf(state, loserId, ruleset)
	city.owner = unit.owner
	if city.pop > 1 then
		city.pop = city.pop - 1
	end
	-- the new ruler reshuffles the citizenry
	city.workers = nil
	city.taxmen = nil
	city.scientists = nil
	city.producing = { kind = "unit", id = "militia" }
	city.shields = 0

	local plunder = city.pop * 10
	local loser = state.players[loserId]
	if loser ~= nil then
		if plunder > loser.gold then
			plunder = loser.gold
		end
		loser.gold = loser.gold - plunder
	else
		plunder = 0
	end
	local winner = state.players[unit.owner]
	if winner ~= nil then
		winner.gold = winner.gold + plunder
	end

	visibility.reveal(state, unit.owner, city.x, city.y, 2)
	table.insert(events, { type = "cityCaptured", cityId = city.id, from = loserId, to = unit.owner, plunder = plunder })

	-- A76: capital lost — the spaceship in flight or under construction is destroyed
	if loserCapital ~= nil and loserCapital.id == city.id then
		local loserP = state.players[loserId]
		if loserP ~= nil and loserP.spaceship ~= nil then
			loserP.spaceship = nil
			table.insert(events, { type = "shipDestroyed", playerId = loserId })
		end
	end
end

return {
	resolveAttack = resolveAttack,
	captureCity = captureCity,
	bestDefender = bestDefender,
	unitsAt = unitsAt,
	cityAt = cityAt,
	attackStrength = attackStrength,
	defenseStrength = defenseStrength,
	tileDefensePct = tileDefensePct,
	sortIds = sortIds,
}
