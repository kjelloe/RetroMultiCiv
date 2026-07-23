--!strict
-- Luau twin of engine/tech.js (phase 5, P5-5): trade splits into gold/bulbs
-- by per-player rates; advances cost techBaseCost * (known + 1). The real
-- module now OWNS the lazy default writes the P5-3 hook carried — same
-- writes, same order, so 001's pin must not move.
-- EXPORTS (stable): researchCost, availableTechs, setResearch, setRates,
-- processResearch, playerIncome, prereqsMet.

local cities = require("./cities")
local combat = require("./combat") -- #29 sortIds for the science-wonder scan
local government = require("./government")
local traderoutes = require("./trade") -- named to avoid shadowing the loop's `trade` local
local upgrade = require("./upgrade") -- N11 3b: Leonardo hook via the grantTech seam
local difficulty = require("./difficulty")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

-- XII.2 twin (specs/xii2-future-tech.md): the repeatable end-of-tree science sink.
-- A synthetic sentinel research target (never a real tech id / never in player.techs).
local FUTURE_TECH_ID = "future-tech"

local function researchCost(state: any, playerId: string, ruleset: any): number
	local player = state.players[playerId]
	-- XII.2: the escalation count includes futureTech levels (0 until the tree empties,
	-- so every real-tech cost is byte-identical). Lua nil -> 0.
	local known = #player.techs + (if player.futureTech == nil then 0 else player.futureTech)
	-- bulb escalation ASYMMETRIC: coefficient splits (AI aiBulbInc / human humanBulbInc)
	-- when a human seat exists; else techBaseCost. Matches engine/tech.js.
	local coeff = ruleset.rules.techBaseCost
	local d = difficulty.difficultyOf(state, ruleset)
	if d ~= nil and difficulty.hasHumanSeat(state) then
		coeff = if player.human == true then d.humanBulbInc else d.aiBulbInc
	end
	return coeff * (known + 1)
end

local function knows(player: any, techId: string): boolean
	return table.find(player.techs, techId) ~= nil
end

local function prereqsMet(player: any, techId: string, ruleset: any): boolean
	local tech = ruleset.techs[techId]
	if tech == nil then
		return false
	end
	for _, p in ipairs(tech.prereqs) do
		if not knows(player, p) then
			return false
		end
	end
	return true
end

-- Sorted for deterministic order in every language.
local function availableTechs(state: any, playerId: string, ruleset: any): { string }
	local player = state.players[playerId]
	local ids = {}
	for id in pairs(ruleset.techs) do
		table.insert(ids, id)
	end
	table.sort(ids)
	local out = {}
	for _, id in ipairs(ids) do
		if not knows(player, id) and prereqsMet(player, id, ruleset) then
			table.insert(out, id)
		end
	end
	-- XII.2: an exhausted real tree offers exactly the Future Tech sentinel (fires ONLY
	-- on empty, so a live tree returns the identical real list).
	if #out == 0 then
		table.insert(out, FUTURE_TECH_ID)
	end
	return out
end

local function setResearch(state: any, cmd: any, ruleset: any): any
	local player = state.players[cmd.playerId]
	if player == nil then
		return { ok = false, reason = "unknownPlayer" }
	end
	-- A54 off-turn pre-work: self-scoped (touches only the issuing player's
	-- state, zero rng) — legal while a rival moves; no turn check
	-- XII.2: the Future Tech sentinel is valid ONLY once the real tree is exhausted.
	if cmd.tech == FUTURE_TECH_ID then
		if table.find(availableTechs(state, cmd.playerId, ruleset), FUTURE_TECH_ID) == nil then
			return { ok = false, reason = "treeNotExhausted" }
		end
		player.researching = FUTURE_TECH_ID
		return { ok = true, events = { { type = "researchSet", playerId = cmd.playerId, tech = FUTURE_TECH_ID } } }
	end
	if ruleset.techs[cmd.tech] == nil then
		return { ok = false, reason = "unknownTech" }
	end
	if knows(player, cmd.tech) then
		return { ok = false, reason = "alreadyKnown" }
	end
	if not prereqsMet(player, cmd.tech, ruleset) then
		return { ok = false, reason = "prereqsMissing" }
	end
	player.researching = cmd.tech
	return { ok = true, events = { { type = "researchSet", playerId = cmd.playerId, tech = cmd.tech } } }
end

local function setRates(state: any, cmd: any, ruleset: any): any
	local player = state.players[cmd.playerId]
	if player == nil then
		return { ok = false, reason = "unknownPlayer" }
	end
	-- A54 off-turn pre-work: self-scoped — legal while a rival moves
	local tax = cmd.tax
	local sci = cmd.sci
	local lux = if cmd.lux == nil then 0 else cmd.lux
	local isInt = function(n: any): boolean
		return typeof(n) == "number" and n % 1 == 0
	end
	local valid = isInt(tax) and isInt(sci) and isInt(lux)
		and tax >= 0 and sci >= 0 and lux >= 0 and tax + sci + lux == 100
		and tax % 10 == 0 and sci % 10 == 0 and lux % 10 == 0
	if not valid then
		return { ok = false, reason = "badRates" }
	end
	local cap = government.governmentOf(state, cmd.playerId, ruleset).maxRate
	if tax > cap or sci > cap or lux > cap then
		return { ok = false, reason = "rateTooHigh" }
	end
	player.taxRate = tax
	player.sciRate = sci
	if lux > 0 then
		player.luxRate = lux
	else
		player.luxRate = nil
	end
	return { ok = true, events = { { type = "ratesSet", playerId = cmd.playerId, tax = tax, sci = sci, lux = lux } } }
end

-- N9b twin: one city's gold + science CONTRIBUTION (the tax/science split with
-- the building taxBonus/sciBonus multipliers applied). Extracted verbatim from
-- playerIncome so the AI build-payback lever values a building by the SAME math
-- the real income uses. Disordered city contributes nothing; maintenance/anarchy
-- are player-level. taxmen/scientists cancel in the lever's with/without delta.
local function cityEconOutput(state: any, city: any, taxRate: number, sciRate: number, perSpecialist: number, ruleset: any)
	if city.disorder == true then
		return { gold = 0, bulbs = 0 }
	end
	local trade = cities.cityYields(state, city, ruleset).trade
	trade -= government.corruptionFor(state, city, trade, ruleset)
	-- A89: the live permanent trade-route bonus adds ON TOP, post-corruption
	-- (R1). 0 for a city without routes; AI fields no caravans -> goldens untouched.
	trade += traderoutes.routeArrows(state, city, ruleset)
	local cityTax = idiv(trade * taxRate, 100)
	local citySci = idiv(trade * sciRate, 100)
	local gold = cityTax + idiv(cityTax * cities.effectPct(city, ruleset, "taxBonus"), 100)
	-- #29 science wonders (owner's active), additive % on the city's science on top of the
	-- building sciBonus: copernicus +100% in its own city; seti +50% every city; isaac-newton
	-- +66% OF the building science, owner's cities — but SUPPRESSED while seti is active (R3
	-- non-cumulative, seti supersedes).
	local sciPct = cities.effectPct(city, ruleset, "sciBonus")
	local wSci = 0
	local setiActive = false
	local newtonPct = 0
	local sciKeys = {}
	for id in pairs(state.wonders or {}) do
		table.insert(sciKeys, id)
	end
	for _, wid in ipairs(combat.sortIds(sciKeys)) do
		if cities.wonderActive(state, wid, ruleset) then
			local wh = state.cities[state.wonders[wid]]
			if wh ~= nil and wh.owner == city.owner then
				local eff = ruleset.wonders[wid].effect
				if eff.cityScienceBonusPct ~= nil and wh.id == city.id then
					wSci += eff.cityScienceBonusPct
				end
				if eff.scienceEverywherePct ~= nil then
					wSci += eff.scienceEverywherePct
					setiActive = true
				end
				if eff.sciBldgBonusPct ~= nil then
					newtonPct = eff.sciBldgBonusPct
				end
			end
		end
	end
	if newtonPct > 0 and not setiActive then
		wSci += idiv(sciPct * newtonPct, 100)
	end
	local bulbs = citySci + idiv(citySci * (sciPct + wSci), 100)
	if city.taxmen ~= nil then
		gold += city.taxmen * perSpecialist
	end
	if city.scientists ~= nil then
		bulbs += city.scientists * perSpecialist
	end
	return { gold = gold, bulbs = bulbs }
end

-- Per-turn income for one player, before it is applied. Pure.
local function playerIncome(state: any, playerId: string, ruleset: any)
	local player = state.players[playerId]
	local taxRate = if player.taxRate == nil then ruleset.rules.defaultTaxRate else player.taxRate
	local sciRate = if player.sciRate == nil then ruleset.rules.defaultSciRate else player.sciRate
	local perSpecialist = ruleset.rules.specialistOutput
	local anarchy = government.governmentOf(state, playerId, ruleset).id == "anarchy"
	local gold, bulbs, maintenance = 0, 0, 0
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city == nil or city.owner ~= playerId then
			continue
		end
		for _, b in ipairs(city.buildings or {}) do
			maintenance += ruleset.buildings[b].maintenance
		end
		if city.disorder == true then
			continue -- civil disorder: no taxes, no research
		end
		if anarchy then
			continue -- anarchy: the state collects nothing
		end
		local eco = cityEconOutput(state, city, taxRate, sciRate, perSpecialist, ruleset)
		gold += eco.gold
		bulbs += eco.bulbs
	end
	return { gold = gold, bulbs = bulbs, maintenance = maintenance }
end

-- B13/A63 twin: discovering a tech SELLS every building it obsoletes from the
-- player's cities (barracks at Gunpowder, again at Combustion). Removed and its
-- full build cost x rules.sellPriceRatio credited, buildingSold event per city.
-- Deterministic: cityOrder x sorted building ids (matches engine/tech.js).
local function sellObsoletedBuildings(state: any, pid: string, discoveredTech: string, ruleset: any, events: any)
	local buildingIds = {}
	for id in pairs(ruleset.buildings) do
		table.insert(buildingIds, id)
	end
	table.sort(buildingIds)
	local order = if state.cityOrder == nil then {} else state.cityOrder
	for _, cid in ipairs(order) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == pid and city.buildings ~= nil then
			for _, bid in ipairs(buildingIds) do
				local def = ruleset.buildings[bid]
				if def.obsoletedByTechs ~= nil and table.find(def.obsoletedByTechs, discoveredTech) ~= nil then
					if table.find(city.buildings, bid) ~= nil then
						-- A86: shared removal+credit helper (the manual sell uses the same path)
						cities.sellBuildingFrom(state, city, bid, ruleset, events, "obsolete")
					end
				end
			end
		end
	end
end

-- R3 (N11 3b): the single tech-acquisition seam (twin of engine/tech.js grantTech).
-- Every grant path routes here; Leonardo is a no-op without an owned active one.
local function grantTech(state: any, pid: string, techId: string, ruleset: any, events: any)
	local player = state.players[pid]
	table.insert(player.techs, techId)
	-- acquiring a tech finishes any in-progress research of that same tech, so a
	-- free grant (hut advance, Leonardo, debug) never double-completes it in
	-- processResearch (would push a duplicate). Bulbs carry to the next pick.
	if player.researching == techId then player.researching = "" end
	table.insert(events, { type = "techDiscovered", playerId = pid, tech = techId })
	sellObsoletedBuildings(state, pid, techId, ruleset, events)
	upgrade.leonardoUpgrade(state, pid, ruleset, events)
end

-- Runs once per game turn (turn wrap): collect trade, split, maybe discover.
local function processResearch(state: any, ruleset: any, events: any)
	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player.taxRate == nil then
			player.taxRate = ruleset.rules.defaultTaxRate
		end
		if player.sciRate == nil then
			player.sciRate = ruleset.rules.defaultSciRate
		end
		if player.bulbs == nil then
			player.bulbs = 0
		end

		local income = playerIncome(state, pid, ruleset)
		player.gold = player.gold + income.gold - income.maintenance
		if player.gold < 0 then
			player.gold = 0 -- Civ 1 sells buildings; clamped for now
		end
		player.bulbs += income.bulbs

		if player.researching ~= "" and player.researching ~= nil then
			local cost = researchCost(state, pid, ruleset)
			if player.bulbs >= cost then
				player.bulbs -= cost -- overflow carries into the next advance
				local got = player.researching
				if got == FUTURE_TECH_ID then
					-- XII.2: a Future Tech level — bump the counter (score-only), keep the
					-- sentinel (repeatable, no cap). Never enters techs.
					player.futureTech = (if player.futureTech == nil then 0 else player.futureTech) + 1
					player.researching = FUTURE_TECH_ID
					table.insert(events, { type = "futureTechResearched", playerId = pid, n = player.futureTech })
				else
					player.researching = ""
					grantTech(state, pid, got, ruleset, events)
				end
			end
		end
	end
end

-- #29 great-library grant: the lowest sorted tech id a player LACKS that >=2 OTHER
-- civilizations know (Civ1 catch-up — prereq-free, one per turn). '' if none.
local function libraryCatchUpTech(state: any, pid: string, ruleset: any): string
	local player = state.players[pid]
	local techKeys = {}
	for id in pairs(ruleset.techs) do
		table.insert(techKeys, id)
	end
	for _, tid in ipairs(combat.sortIds(techKeys)) do
		if not knows(player, tid) then
			local others = 0
			for _, oid in ipairs(state.playerOrder) do
				if oid ~= pid and knows(state.players[oid], tid) then
					others += 1
				end
			end
			if others >= 2 then
				return tid
			end
		end
	end
	return ""
end

-- #29 darwin grant: the lowest-LEVEL researchable tech a player lacks (prereqs met,
-- sorted-id tie-break). '' if none.
local function lowestAvailableTech(state: any, pid: string, ruleset: any): string
	local player = state.players[pid]
	local best = ""
	local techKeys = {}
	for id in pairs(ruleset.techs) do
		table.insert(techKeys, id)
	end
	for _, tid in ipairs(combat.sortIds(techKeys)) do
		if not knows(player, tid) and prereqsMet(player, tid, ruleset) then
			if best == "" or ruleset.techs[tid].level < ruleset.techs[best].level then
				best = tid
			end
		end
	end
	return best
end

-- #29 wonder tech grants (after research resolves): darwin's one-shot on THIS turn's
-- wonderBuilt event, then great-library's per-turn catch-up. Both go through grantTech
-- so obsolete-building sales + Leonardo upgrades + the techDiscovered event fire.
local function processWonderTechs(state: any, ruleset: any, events: any)
	for _, ev in ipairs(events) do
		if ev.type == "wonderBuilt" then
			local n = ruleset.wonders[ev.wonder].effect.freeTechsOnBuild
			if n ~= nil and n > 0 then
				local city = state.cities[ev.cityId]
				if city ~= nil then
					for _ = 1, n do
						local tid = lowestAvailableTech(state, city.owner, ruleset)
						if tid == "" then
							break
						end
						grantTech(state, city.owner, tid, ruleset, events)
					end
				end
			end
		end
	end
	local wonderKeys = {}
	for id in pairs(state.wonders or {}) do
		table.insert(wonderKeys, id)
	end
	for _, wid in ipairs(combat.sortIds(wonderKeys)) do
		if ruleset.wonders[wid].effect.libraryCatchUp == true and cities.wonderActive(state, wid, ruleset) then
			local home = state.cities[state.wonders[wid]]
			if home ~= nil then
				local tid = libraryCatchUpTech(state, home.owner, ruleset)
				if tid ~= "" then
					grantTech(state, home.owner, tid, ruleset, events)
				end
			end
		end
	end
end

return {
	researchCost = researchCost,
	availableTechs = availableTechs,
	setResearch = setResearch,
	setRates = setRates,
	processResearch = processResearch,
	FUTURE_TECH_ID = FUTURE_TECH_ID,
	playerIncome = playerIncome,
	cityEconOutput = cityEconOutput,
	grantTech = grantTech,
	prereqsMet = prereqsMet,
	processWonderTechs = processWonderTechs,
}
