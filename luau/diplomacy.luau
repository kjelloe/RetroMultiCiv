--!strict
-- D1 diplomacy twin of engine/diplomacy.js: war/peace per PLAYER-pair + reputation
-- and the seams the combat reframe reads. OMIT-SAFE: an absent pair reads as war
-- (the default), so a world with no treaty (the whole soak) is byte-identical to
-- pre-D1. state.relations is a plain OBJECT (no t[1]); entries + offers are objects.

-- BARB_ID inlined (not required from barbarians) to avoid the require cycle
-- diplomacy -> barbarians -> combat -> cities -> diplomacy. Must match barbarians.BARB_ID.
local BARB_ID = "barb"

local visibility = require("./visibility")

-- D1 reputation penalty for breaking a treaty (RECORD-ONLY; the weight moves to
-- data/*.json in D3).
local TREATY_BREAK_PENALTY = 1

-- D3 relationship-value defaults (structural neutral points): trust 50, grievance 0.
local TRUST_DEFAULT = 50
local GRIEVANCE_DEFAULT = 0

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function pairKey(a: string, b: string): string
	return if a < b then a .. "|" .. b else b .. "|" .. a
end

local function relationOf(state: any, a: string, b: string): string
	if state.relations == nil then return "war" end
	local entry = state.relations[pairKey(a, b)]
	if entry == nil then return "war" end
	if entry.state == "peace" and entry.expiresTurn ~= nil and state.turn >= entry.expiresTurn then return "war" end
	return entry.state
end

local function reputationOf(state: any, pid: string): number
	local p = state.players[pid]
	return if p ~= nil and p.reputation ~= nil then p.reputation else 0
end

local function eventCiv(state: any, pid: string): string
	local p = state.players[pid]
	if p == nil then return pid end
	if p.civ ~= nil then return p.civ end
	if p.name ~= nil then return p.name end
	return pid
end

-- prune every relation + pending offer touching an eliminated player (called from
-- score.luau). Omit-safe: a no-op when relations is empty (the soak).
local function pruneDiplomacy(state: any, pid: string)
	if state.relations == nil then return end
	local keys = {}
	for k in pairs(state.relations) do
		table.insert(keys, k)
	end
	for _, key in ipairs(keys) do
		local parts = string.split(key, "|")
		-- an entry (treaty + any pending offer) is dropped whenever either side of
		-- its pair is the eliminated civ (an offer's `from` is always a pair member).
		if parts[1] == pid or parts[2] == pid then
			state.relations[key] = nil
		end
	end
end

-- D3: grievance + trust are DIRECTED; ride the sorted-pair entry as <key>_lo/_hi.
local function dirField(key: string, holder: string, toward: string): string
	local lo = if holder < toward then holder else toward
	return if holder == lo then key .. "_lo" else key .. "_hi"
end

local function grievanceOf(state: any, holder: string, toward: string): number
	if state.relations == nil then return GRIEVANCE_DEFAULT end
	local entry = state.relations[pairKey(holder, toward)]
	if entry == nil then return GRIEVANCE_DEFAULT end
	local v = entry[dirField("grievance", holder, toward)]
	return if v == nil then GRIEVANCE_DEFAULT else v
end

local function trustOf(state: any, holder: string, toward: string): number
	if state.relations == nil then return TRUST_DEFAULT end
	local entry = state.relations[pairKey(holder, toward)]
	if entry == nil then return TRUST_DEFAULT end
	local v = entry[dirField("trust", holder, toward)]
	return if v == nil then TRUST_DEFAULT else v
end

local function bumpRel(state: any, holder: string, toward: string, key: string, delta: number)
	if state.relations == nil then state.relations = {} end
	local k = pairKey(holder, toward)
	if state.relations[k] == nil then state.relations[k] = { state = "war" } end
	local entry = state.relations[k]
	local f = dirField(key, holder, toward)
	local def = if key == "trust" then TRUST_DEFAULT else GRIEVANCE_DEFAULT
	local cur = if entry[f] == nil then def else entry[f]
	local v = cur + delta
	if v < 0 then v = 0 end
	if v > 100 then v = 100 end
	entry[f] = v
end

local function metOf(state: any, a: string, b: string): boolean
	if state.relations == nil then return false end
	local entry = state.relations[pairKey(a, b)]
	return entry ~= nil and entry.met == true
end

local function diplomacyCommand(state: any, cmd: any, ruleset: any): any
	if state.activePlayer ~= cmd.playerId then return { ok = false, reason = "notYourTurn" } end
	local pid = cmd.playerId
	local target = cmd.target
	if target == pid then return { ok = false, reason = "selfTarget" } end
	if pid == BARB_ID or target == BARB_ID then return { ok = false, reason = "cannotDiplomacyBarbarians" } end
	if state.players[target] == nil then return { ok = false, reason = "noSuchTarget" } end
	local key = pairKey(pid, target)
	if state.relations == nil then state.relations = {} end
	local entry = state.relations[key]
	local rel = relationOf(state, pid, target)
	local events = {}

	if cmd.kind == "declare" then
		if entry ~= nil and entry.state == "war" then return { ok = false, reason = "alreadyWar" } end
		local wasPeace = rel == "peace"
		-- D3: MODIFY in place — preserve met/grievance/trust.
		local e = if entry == nil then {} else entry
		if entry == nil then state.relations[key] = e end
		e.state = "war"
		e.treatyTurn = state.turn
		e.expiresTurn = nil
		e.offer = nil
		table.insert(events, { type = "WAR_DECLARED", attackerCivId = eventCiv(state, pid), defenderCivId = eventCiv(state, target), turn = state.turn, reason = "border_pressure" })
		if wasPeace then
			state.players[pid].reputation = reputationOf(state, pid) - TREATY_BREAK_PENALTY
			local d = ruleset.rules.diplomacy
			bumpRel(state, target, pid, "grievance", d.relGrievanceOnBetray)
			bumpRel(state, target, pid, "trust", -d.relTrustOnBetray)
			table.insert(events, { type = "TREATY_BROKEN", breakerCivId = eventCiv(state, pid), injuredCivId = eventCiv(state, target), turn = state.turn, penalty = "reputation_loss" })
		end
		return { ok = true, events = events }
	end

	if cmd.kind == "offer" then
		local terms = if cmd.terms == nil then {} else cmd.terms
		local offer = { from = pid, turn = state.turn }
		if terms.duration ~= nil then offer.duration = terms.duration end -- absent = perpetual
		if entry == nil then
			state.relations[key] = { state = "war", offer = offer }
		else
			entry.offer = offer -- a new offer OVERWRITES a standing one
		end
		return { ok = true, events = events } -- an offer emits nothing until answered
	end

	if cmd.kind == "accept" then
		if entry == nil or entry.offer == nil then return { ok = false, reason = "noSuchOffer" } end
		local offer = entry.offer
		-- D3: MODIFY in place — preserve met/grievance/trust.
		entry.state = "peace"
		entry.treatyTurn = state.turn
		if offer.duration ~= nil then entry.expiresTurn = state.turn + offer.duration else entry.expiresTurn = nil end
		entry.offer = nil
		-- D3: peace decays grievance both ways (integer halving).
		local gp = grievanceOf(state, pid, target)
		if gp > 0 then bumpRel(state, pid, target, "grievance", idiv(gp, 2) - gp) end
		local gt = grievanceOf(state, target, pid)
		if gt > 0 then bumpRel(state, target, pid, "grievance", idiv(gt, 2) - gt) end
		table.insert(events, { type = "PEACE_TREATY_SIGNED", civAId = eventCiv(state, pid), civBId = eventCiv(state, target), turn = state.turn, expiresTurn = if entry.expiresTurn == nil then 0 else entry.expiresTurn })
		return { ok = true, events = events }
	end

	if cmd.kind == "reject" then
		if entry == nil or entry.offer == nil then return { ok = false, reason = "noSuchOffer" } end
		entry.offer = nil
		-- §14 F1: stamp the reject so the offerer does not immediately re-offer
		-- (rel stays "war"); diplomacyStep gates on rules.diplomacy.offerCooldown.
		entry.offerRejectedTurn = state.turn
		return { ok = true, events = events }
	end

	return { ok = false, reason = "unknownKind" }
end

-- D3 contact pass (turn loop, every seat): computeVisible for pid; any rival
-- unit/city on a visible tile -> flip met (symmetric pair flag) + push FIRST_CONTACT.
local function contactPass(state: any, pid: string, events: any)
	local player = state.players[pid]
	if player == nil then return end
	local mask = visibility.computeVisible(state, pid)
	local width = state.map.width
	local seen = {}
	for _, u in pairs(state.units) do
		if u.owner ~= pid and u.owner ~= BARB_ID and mask[u.y * width + u.x + 1] == 1 then
			seen[u.owner] = true
		end
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner ~= pid and c.owner ~= BARB_ID and mask[c.y * width + c.x + 1] == 1 then
			seen[c.owner] = true
		end
	end
	for other in pairs(seen) do
		local key = pairKey(pid, other)
		if state.relations == nil then state.relations = {} end
		local entry = state.relations[key]
		if entry == nil then
			entry = { state = "war" }
			state.relations[key] = entry
		end
		if entry.met ~= true then
			entry.met = true
			table.insert(events, { type = "FIRST_CONTACT", aCivId = eventCiv(state, pid), bCivId = eventCiv(state, other), turn = state.turn })
		end
	end
end

-- D3 per-turn grievance decay (engine processing, replayable). Floored 0; only
-- existing entries. Omit-safe (no-op when relations empty).
local function processDecay(state: any, ruleset: any)
	if state.relations == nil then return end
	local d = ruleset.rules.diplomacy
	local dec = if d == nil then 0 else d.relGrievanceDecay
	if dec <= 0 then return end
	for _, e in pairs(state.relations) do
		if e.grievance_lo ~= nil and e.grievance_lo > 0 then
			e.grievance_lo -= dec
			if e.grievance_lo < 0 then e.grievance_lo = 0 end
		end
		if e.grievance_hi ~= nil and e.grievance_hi > 0 then
			e.grievance_hi -= dec
			if e.grievance_hi < 0 then e.grievance_hi = 0 end
		end
	end
end

return {
	relationOf = relationOf,
	reputationOf = reputationOf,
	pruneDiplomacy = pruneDiplomacy,
	diplomacyCommand = diplomacyCommand,
	pairKey = pairKey,
	grievanceOf = grievanceOf,
	trustOf = trustOf,
	bumpRel = bumpRel,
	metOf = metOf,
	contactPass = contactPass,
	processDecay = processDecay,
}
