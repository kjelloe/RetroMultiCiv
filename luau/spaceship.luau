--!strict
-- Luau twin of engine/spaceship.js (A76 space race). player.spaceship is
-- OMIT-SAFE (absent until the first part). The Apollo gate is DERIVED
-- (wonderActive). Civ1-authentic except the flight-time model (original,
-- wiki-informed) whose constants (rules.ssFlight) the sim-runner sweeps.
-- EXPORTS (stable): shipStats, isViable, apolloActive, launchShip, processSpace,
-- functionalCounts.
local statehash = require("./statehash")
local cities = require("./cities")
local government = require("./government")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end
local function minInt(a: number, b: number): number
	return if a < b then a else b
end
local function maxInt(a: number, b: number): number
	return if a > b then a else b
end

-- Non-structural parts in the fixed canonical order the sufficiency cap fills.
local SS_NONSTRUCT = { "propulsion", "fuel", "habitation", "lifeSupport", "solar" }

local function partCount(spaceship: any, key: string): number
	if spaceship == nil or spaceship[key] == nil then
		return 0
	end
	return spaceship[key]
end

-- Is Apollo Program built by any civ? Derived, never stored.
local function apolloActive(state: any, ruleset: any): boolean
	local f = ruleset.rules.ssFlight
	if f == nil then return false end
	return cities.wonderActive(state, f.gateWonder, ruleset)
end

-- Structural sufficiency (spec S3): non-structural parts function only up to
-- `supported` = idiv(structural*28, 39) slots; the fill order (propulsion, fuel,
-- habitation, lifeSupport, solar) is a design choice flagged to the architect.
local function functionalCounts(spaceship: any, ruleset: any): any
	local f = ruleset.rules.ssFlight
	local structural = partCount(spaceship, "structural")
	local supported = idiv(structural * f.structuralSlotsNum, f.structuralSlotsDen)
	local fn = { propulsion = 0, fuel = 0, habitation = 0, lifeSupport = 0, solar = 0 }
	for _, k in ipairs(SS_NONSTRUCT) do
		local have = partCount(spaceship, k)
		local take = if have < supported then have else supported
		fn[k] = take
		supported = supported - take
		if supported < 0 then supported = 0 end
	end
	return fn
end

-- A minimum-viable ship: >=1 functional propulsion + fuel + one of each module.
local function isViable(spaceship: any, ruleset: any): boolean
	if spaceship == nil then return false end
	local fn = functionalCounts(spaceship, ruleset)
	return fn.propulsion >= 1 and fn.fuel >= 1 and fn.habitation >= 1
		and fn.lifeSupport >= 1 and fn.solar >= 1
end

-- Derived ship characteristics (pure, byte-shaped). mass counts ALL parts.
local function shipStats(spaceship: any, ruleset: any): any
	local f = ruleset.rules.ssFlight
	local s = spaceship
	local structural = partCount(s, "structural")
	local propulsion = partCount(s, "propulsion")
	local fuel = partCount(s, "fuel")
	local habitation = partCount(s, "habitation")
	local lifeSupport = partCount(s, "lifeSupport")
	local solar = partCount(s, "solar")
	local fn = functionalCounts(s, ruleset)

	local population = fn.habitation * f.colonistsPerHab
	local supportPct = idiv(fn.lifeSupport * 100, maxInt(1, fn.habitation))
	if supportPct > 100 then supportPct = 100 end
	local energyPct = idiv(fn.solar * 2 * 100, maxInt(1, fn.habitation + fn.lifeSupport))
	if energyPct > 100 then energyPct = 100 end

	local P = ruleset.rules.ssParts
	local mass = structural * P.structural.mass + propulsion * P.propulsion.mass
		+ fuel * P.fuel.mass + habitation * P.habitation.mass
		+ lifeSupport * P.lifeSupport.mass + solar * P.solar.mass
	local poweredEngines = minInt(fn.propulsion, fn.fuel)
	local fuelPct = if fn.propulsion == 0 then 0 else idiv(minInt(fn.fuel, fn.propulsion) * 100, fn.propulsion)

	local flightYears = idiv(mass * 10, maxInt(1, poweredEngines * f.flightMassPerEngine))
	if flightYears < f.flightYearsMin then flightYears = f.flightYearsMin end

	local successPct = 0
	if isViable(s, ruleset) then
		local raw = idiv(supportPct + energyPct, 2)
			- idiv(maxInt(0, flightYears - f.successFlightFreeYears), 2)
		if raw < 5 then raw = 5 end
		if raw > 100 then raw = 100 end
		successPct = raw
	end
	return {
		population = population, supportPct = supportPct, energyPct = energyPct,
		mass = mass, fuelPct = fuelPct, flightYears = flightYears, successPct = successPct,
	}
end

-- The current era's year step (mirrors index.nextYear; inlined to keep requires acyclic).
local function yearsPerTurn(year: number, rules: any): number
	local steps = rules.yearSteps
	if steps == nil or #steps == 0 then return 20 end
	for _, b in ipairs(steps) do
		if year < b["until"] then return b.step end -- "until" is a Lua keyword
	end
	return steps[#steps].step
end

local function launchShip(state: any, cmd: any, ruleset: any): any
	if state.activePlayer ~= cmd.playerId then
		return { ok = false, reason = "notYourTurn" }
	end
	local player = state.players[cmd.playerId]
	if player == nil then return { ok = false, reason = "unknownPlayer" } end
	local ship = player.spaceship
	if ship == nil then return { ok = false, reason = "noShip" } end
	if ship.launched ~= nil and ship.launched ~= 0 then
		return { ok = false, reason = "alreadyLaunched" }
	end
	if not apolloActive(state, ruleset) then return { ok = false, reason = "noApollo" } end
	if not isViable(ship, ruleset) then return { ok = false, reason = "shipNotViable" } end
	local stats = shipStats(ship, ruleset)
	local perTurn = yearsPerTurn(state.year, ruleset.rules)
	local turns = maxInt(1, idiv(stats.flightYears, perTurn))
	ship.launched = state.turn
	ship.arrivalTurn = state.turn + turns
	local events = setmetatable({}, statehash.ARRAY_MT)
	table.insert(events, {
		type = "shipLaunched", playerId = cmd.playerId,
		arrivalTurn = ship.arrivalTurn, flightYears = stats.flightYears,
	})
	return { ok = true, events = events }
end

-- Turn-wrap arrival check (before checkGameEnd). First launched ship to arrive
-- with the owner alive wins. A captured capital already deleted the ship.
local function processSpace(state: any, ruleset: any, events: any)
	if state.gameOver == true then return end
	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player ~= nil and player.alive ~= false then
			local ship = player.spaceship
			if ship ~= nil and ship.launched ~= nil and ship.launched ~= 0
				and ship.arrivalTurn ~= nil and state.turn >= ship.arrivalTurn then
				local capital = government.capitalOf(state, pid, ruleset)
				if capital ~= nil then
					local stats = shipStats(ship, ruleset)
					local bonus = idiv(stats.population, ruleset.rules.ssFlight.arrivalScoreDivisor) * stats.successPct
					state.gameOver = true
					state.winner = pid
					table.insert(events, {
						type = "spaceVictory", playerId = pid,
						population = stats.population, successPct = stats.successPct, bonus = bonus,
					})
					table.insert(events, { type = "gameOver", winner = pid, victory = "space" })
					return
				end
			end
		end
	end
end

return {
	shipStats = shipStats,
	isViable = isViable,
	apolloActive = apolloActive,
	launchShip = launchShip,
	processSpace = processSpace,
	functionalCounts = functionalCounts,
}
