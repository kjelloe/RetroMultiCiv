--!strict
-- D6 diplomat missions, twin of engine/diplomat-missions.js. GOLDEN-NEUTRAL: the AI
-- never issues these, state.embassies is omit-safe, no data changes. Byte-shaped.
-- Cycle-safe: only index.luau requires this; its own requires are leaves.

local rng = require("./rng")
local government = require("./government")
local difficulty = require("./difficulty")
local diplomacy = require("./diplomacy")

local BARB_ID = "barb"
local DIPLOMAT = "diplomat"

local STEAL_SUCCESS_PCT = 50
local SABOTAGE_SUCCESS_PCT = 50
local INCITE_GOLD_PER_POP = 100
local BRIBE_GOLD_PER_COST = 10
local DEFAULT_DEMAND_PCT = 20

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function within1(map: any, ax: number, ay: number, bx: number, by: number): boolean
	local dx = math.abs(ax - bx)
	if map.wrapX and map.width - dx < dx then dx = map.width - dx end
	local dy = math.abs(ay - by)
	local cheb = if dx > dy then dx else dy
	return cheb <= 1
end

local function demandPct(state: any, ruleset: any): number
	local d = difficulty.difficultyOf(state, ruleset)
	return if d ~= nil and d.parleyDemandPct ~= nil then d.parleyDemandPct else DEFAULT_DEMAND_PCT
end

-- W8a: the AI needs the SAME price the mission charges, so it never issues an
-- unaffordable incite (a rejected command wastes the turn). One source of truth --
-- the mission calls this too.
local function inciteCost(state: any, city: any, ruleset: any): number
	return idiv(city.pop * INCITE_GOLD_PER_POP * demandPct(state, ruleset), 20)
end

local function targetCity(state: any, me: string, unit: any, cityId: any): any
	local city = if state.cities == nil then nil else state.cities[cityId]
	if city == nil or city.owner == me or city.owner == BARB_ID then return nil end
	if not within1(state.map, unit.x, unit.y, city.x, city.y) then return nil end
	return city
end

local function flipCity(city: any, me: string)
	city.owner = me
	if city.pop > 1 then city.pop = city.pop - 1 end
	city.workers = nil
	city.taxmen = nil
	city.scientists = nil
	city.producing = { kind = "unit", id = "militia" }
	city.shields = 0
end

-- W1 discovered-espionage: a discovery roll after steal/sabotage resolve. BOTCH-AMPLIFIED
-- (failed job likelier traced). On discovery: perp reputation soiled (shared treaty-break
-- machinery) + victim grievance + ESPIONAGE_EXPOSED. rngState-threaded. Matches engine JS.
local function rollDiscovery(state: any, perp: string, victim: string, missionKind: string, succeeded: boolean, ruleset: any, events: any)
	local d = ruleset.rules.diplomacy
	local pct = if succeeded then d.discoveryPctOnSuccess else d.discoveryPctOnFail
	local roll = rng.rollRange(state.rngState, 100)
	state.rngState = roll.rngState
	if roll.value >= pct then return end
	diplomacy.applyReputationHit(state, perp, ruleset, events)
	diplomacy.bumpRel(state, victim, perp, "grievance", d.relGrievanceOnBetray)
	table.insert(events, { type = "ESPIONAGE_EXPOSED", byCivId = perp, atCivId = victim, mission = missionKind, turn = state.turn })
end

local function diplomatMissionCommand(state: any, cmd: any, ruleset: any): any
	if state.activePlayer ~= cmd.playerId then return { ok = false, reason = "notYourTurn" } end
	local me = cmd.playerId
	local unit = if state.units == nil then nil else state.units[cmd.unitId]
	if unit == nil then return { ok = false, reason = "noSuchUnit" } end
	if unit.owner ~= me then return { ok = false, reason = "notYourUnit" } end
	if unit.type ~= DIPLOMAT then return { ok = false, reason = "notADiplomat" } end
	if unit.moves <= 0 then return { ok = false, reason = "noMoves" } end
	local events = {}

	if cmd.mission == "establishEmbassy" then
		local city = targetCity(state, me, unit, cmd.targetCityId)
		if city == nil then return { ok = false, reason = "noSuchTarget" } end
		local cap = government.capitalOf(state, city.owner, ruleset)
		if cap == nil or cap.id ~= city.id then return { ok = false, reason = "notACapital" } end
		if state.embassies == nil then state.embassies = {} end
		if state.embassies[me] == nil then state.embassies[me] = {} end
		state.embassies[me][city.owner] = state.turn
		state.units[cmd.unitId] = nil
		table.insert(events, { type = "EMBASSY_ESTABLISHED", byCivId = me, atCivId = city.owner, turn = state.turn })
		return { ok = true, events = events }
	end

	if cmd.mission == "investigateCity" then
		local city = targetCity(state, me, unit, cmd.targetCityId)
		if city == nil then return { ok = false, reason = "noSuchTarget" } end
		-- a READ-ONLY peek: the rival city is untouched. Snapshot rides the transient
		-- event; only the diplomat's consumption is state.
		state.units[cmd.unitId] = nil
		local prod = if city.producing == nil then "" else (if city.producing.id == nil then "" else city.producing.id)
		table.insert(events, { type = "CITY_INVESTIGATED", byCivId = me, atCivId = city.owner, cityId = city.id, pop = city.pop, shields = if city.shields == nil then 0 else city.shields, producing = prod, turn = state.turn })
		return { ok = true, events = events }
	end

	if cmd.mission == "stealTech" then
		local city = targetCity(state, me, unit, cmd.targetCityId)
		if city == nil then return { ok = false, reason = "noSuchTarget" } end
		if city.techStolen == true then return { ok = false, reason = "alreadyStolen" } end
		local owner = state.players[city.owner]
		local mine = state.players[me]
		local eligible = {}
		local ownerTechs = if owner.techs == nil then {} else owner.techs
		local myTechs = if mine.techs == nil then {} else mine.techs
		for _, t in ipairs(ownerTechs) do
			if table.find(myTechs, t) == nil then table.insert(eligible, t) end
		end
		table.sort(eligible)
		city.techStolen = true
		state.units[cmd.unitId] = nil
		local roll = rng.rollRange(state.rngState, 100)
		state.rngState = roll.rngState
		local succeeded = roll.value < STEAL_SUCCESS_PCT and #eligible > 0
		if succeeded then
			local pick = rng.rollRange(state.rngState, #eligible)
			state.rngState = pick.rngState
			local tech = eligible[pick.value + 1]
			table.insert(mine.techs, tech)
			table.insert(events, { type = "TECH_STOLEN", byCivId = me, fromCivId = city.owner, tech = tech, turn = state.turn })
		else
			table.insert(events, { type = "TECH_STOLEN", byCivId = me, fromCivId = city.owner, tech = "", turn = state.turn })
		end
		-- W1: the theft may be traced (after the success + pick rolls, so rngState order holds)
		rollDiscovery(state, me, city.owner, "stealTech", succeeded, ruleset, events)
		return { ok = true, events = events }
	end

	if cmd.mission == "sabotage" then
		local city = targetCity(state, me, unit, cmd.targetCityId)
		if city == nil then return { ok = false, reason = "noSuchTarget" } end
		state.units[cmd.unitId] = nil
		local roll = rng.rollRange(state.rngState, 100)
		state.rngState = roll.rngState
		local success = roll.value < SABOTAGE_SUCCESS_PCT
		if success and city.shields > 0 then city.shields = 0 end
		table.insert(events, { type = "SABOTAGE", byCivId = me, atCivId = city.owner, success = success, turn = state.turn })
		-- W1: the sabotage may be traced to the perpetrator
		rollDiscovery(state, me, city.owner, "sabotage", success, ruleset, events)
		return { ok = true, events = events }
	end

	if cmd.mission == "inciteRevolt" then
		local city = targetCity(state, me, unit, cmd.targetCityId)
		if city == nil then return { ok = false, reason = "noSuchTarget" } end
		local cap = government.capitalOf(state, city.owner, ruleset)
		if cap ~= nil and cap.id == city.id then return { ok = false, reason = "cannotInciteCapital" } end
		local cost = inciteCost(state, city, ruleset)
		local mine = state.players[me]
		if mine.gold < cost then return { ok = false, reason = "notEnoughGold" } end
		local formerOwner = city.owner
		mine.gold = mine.gold - cost
		flipCity(city, me)
		state.units[cmd.unitId] = nil
		table.insert(events, { type = "CITY_INCITED", byCivId = me, fromCivId = formerOwner, cityId = city.id, gold = cost, turn = state.turn })
		return { ok = true, events = events }
	end

	if cmd.mission == "bribeUnit" then
		local target = if state.units == nil then nil else state.units[cmd.targetUnitId]
		if target == nil or target.owner == me or target.owner == BARB_ID then return { ok = false, reason = "noSuchTarget" } end
		if not within1(state.map, unit.x, unit.y, target.x, target.y) then return { ok = false, reason = "noSuchTarget" } end
		local cost = idiv(ruleset.units[target.type].cost * BRIBE_GOLD_PER_COST * demandPct(state, ruleset), 20)
		local mine = state.players[me]
		if mine.gold < cost then return { ok = false, reason = "notEnoughGold" } end
		local formerOwner = target.owner
		mine.gold = mine.gold - cost
		target.owner = me
		target.moves = 0
		state.units[cmd.unitId] = nil
		table.insert(events, { type = "UNIT_BRIBED", byCivId = me, fromCivId = formerOwner, unitId = target.id, gold = cost, turn = state.turn })
		return { ok = true, events = events }
	end

	return { ok = false, reason = "unknownMission" }
end

local function hasEmbassy(state: any, viewer: string, civId: string): boolean
	return state.embassies ~= nil and state.embassies[viewer] ~= nil
		and state.embassies[viewer][civId] ~= nil
end

return {
	diplomatMissionCommand = diplomatMissionCommand,
	hasEmbassy = hasEmbassy,
	inciteCost = inciteCost,
}
