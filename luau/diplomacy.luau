--!strict
-- D1 diplomacy twin of engine/diplomacy.js: war/peace per PLAYER-pair + reputation
-- and the seams the combat reframe reads. OMIT-SAFE: an absent pair reads as war
-- (the default), so a world with no treaty (the whole soak) is byte-identical to
-- pre-D1. state.relations is a plain OBJECT (no t[1]); entries + offers are objects.

-- BARB_ID inlined (not required from barbarians) to avoid the require cycle
-- diplomacy -> barbarians -> combat -> cities -> diplomacy. Must match barbarians.BARB_ID.
local BARB_ID = "barb"

-- D1 reputation penalty for breaking a treaty (RECORD-ONLY; the weight moves to
-- data/*.json in D3).
local TREATY_BREAK_PENALTY = 1

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

local function diplomacyCommand(state: any, cmd: any, _ruleset: any): any
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
		state.relations[key] = { state = "war", treatyTurn = state.turn }
		table.insert(events, { type = "WAR_DECLARED", attackerCivId = eventCiv(state, pid), defenderCivId = eventCiv(state, target), turn = state.turn, reason = "border_pressure" })
		if wasPeace then
			state.players[pid].reputation = reputationOf(state, pid) - TREATY_BREAK_PENALTY
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
		local nextEntry = { state = "peace", treatyTurn = state.turn }
		if offer.duration ~= nil then nextEntry.expiresTurn = state.turn + offer.duration end
		state.relations[key] = nextEntry -- clears the pending offer
		table.insert(events, { type = "PEACE_TREATY_SIGNED", civAId = eventCiv(state, pid), civBId = eventCiv(state, target), turn = state.turn, expiresTurn = if nextEntry.expiresTurn == nil then 0 else nextEntry.expiresTurn })
		return { ok = true, events = events }
	end

	if cmd.kind == "reject" then
		if entry == nil or entry.offer == nil then return { ok = false, reason = "noSuchOffer" } end
		entry.offer = nil -- no state change beyond clearing the offer
		return { ok = true, events = events }
	end

	return { ok = false, reason = "unknownKind" }
end

return {
	relationOf = relationOf,
	reputationOf = reputationOf,
	pruneDiplomacy = pruneDiplomacy,
	diplomacyCommand = diplomacyCommand,
	pairKey = pairKey,
}
