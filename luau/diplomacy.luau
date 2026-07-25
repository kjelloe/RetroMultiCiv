--!strict
-- D1 diplomacy twin of engine/diplomacy.js: war/peace per PLAYER-pair + reputation
-- and the seams the combat reframe reads. OMIT-SAFE: an absent pair reads as war
-- (the default), so a world with no treaty (the whole soak) is byte-identical to
-- pre-D1. state.relations is a plain OBJECT (no t[1]); entries + offers are objects.

-- BARB_ID inlined (not required from barbarians) to avoid the require cycle
-- diplomacy -> barbarians -> combat -> cities -> diplomacy. Must match barbarians.BARB_ID.
local BARB_ID = "barb"

local visibility = require("./visibility")

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

-- D4: grant techId to pid (tech-exchange). MINIMAL — pushes the tech + finishes
-- matching research + emits techDiscovered, but NOT the obsolete-building/Leonardo
-- cascade (that lives in tech.luau -> cities.luau -> here, the require cycle the
-- eager require hangs on). No-op if the tech is empty or already held.
local function diploGrantTech(state: any, pid: string, techId: string, events: any)
	local player = state.players[pid]
	if player == nil or techId == "" or table.find(player.techs, techId) ~= nil then return end
	table.insert(player.techs, techId)
	if player.researching == techId then player.researching = "" end
	table.insert(events, { type = "techDiscovered", playerId = pid, tech = techId })
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
		-- D5 SENATE: a Republic/Democracy (govForbidsWar) cannot break a standing peace
		-- treaty — the senate refuses. Deterministic, a FIRST-CLASS reject (#2507).
		if wasPeace then
			local gov = ruleset.governments[if state.players[pid].government == nil then "despotism" else state.players[pid].government]
			if gov ~= nil and gov.govForbidsWar == true then return { ok = false, reason = "senateRefused" } end
		end
		-- D3: MODIFY in place — preserve met/grievance/trust.
		local e = if entry == nil then {} else entry
		if entry == nil then state.relations[key] = e end
		e.state = "war"
		e.treatyTurn = state.turn
		e.expiresTurn = nil
		e.offer = nil
		table.insert(events, { type = "WAR_DECLARED", attackerCivId = eventCiv(state, pid), defenderCivId = eventCiv(state, target), turn = state.turn, reason = "border_pressure" })
		if wasPeace then
			-- D5 REPUTATION: a treaty break INCREMENTS reputation toward Treacherous
			-- (0=Honorable .. repMax, clamped) + resets the recovery clock. REPUTATION_SHIFT.
			local d = ruleset.rules.diplomacy
			local bump = if d.repBetrayBump == nil then 1 else d.repBetrayBump
			local max = if d.repMax == nil then 4 else d.repMax
			local rep = reputationOf(state, pid) + bump
			if rep > max then rep = max end
			state.players[pid].reputation = rep
			state.players[pid].repCleanTurns = 0
			table.insert(events, { type = "REPUTATION_SHIFT", civId = eventCiv(state, pid), reputation = rep, direction = "worse", turn = state.turn })
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
		-- D4: a terms.kind carries the offer FLAVOUR (absent = peace, the D3 shape).
		-- Fields ride flat on the offer — hash-stable, Luau-friendly.
		if terms.kind == "tribute" then
			offer.kind = "tribute"
			offer.gold = if terms.gold == nil then 0 else terms.gold
		elseif terms.kind == "techExchange" then
			offer.kind = "techExchange"
			offer.techId = if terms.techId == nil then "" else terms.techId
			if terms.wantTechId ~= nil then offer.wantTechId = terms.wantTechId end -- absent = one-way gift
		end
		-- D4: every offer carries an expiry (offered + offerExpiryTurns); the sweep
		-- (processExpiry) deletes it + emits OFFER_EXPIRED. omit-safe (no knob -> none).
		local exp = if ruleset.rules.diplomacy == nil then nil else ruleset.rules.diplomacy.offerExpiryTurns
		if exp ~= nil and exp > 0 then offer.expiresTurn = state.turn + exp end
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
		local okind = if offer.kind == nil then "peace" else offer.kind
		-- D4: tribute — acceptor (pid) is the PAYER; offer.from is the demander. Gold
		-- flows payer -> demander, clamped to the payer's treasury. Treaty unchanged.
		if okind == "tribute" then
			local payer = state.players[pid]
			local demander = state.players[offer.from]
			local amt = if offer.gold == nil then 0 else offer.gold
			if payer.gold < amt then amt = payer.gold end
			payer.gold = payer.gold - amt
			demander.gold = demander.gold + amt
			entry.offer = nil
			entry.tributePaidTurn = state.turn -- gate re-demand (AI checks tributeReDemandCooldown)
			table.insert(events, { type = "TRIBUTE_PAID", payerCivId = eventCiv(state, pid), receiverCivId = eventCiv(state, offer.from), gold = amt, turn = state.turn })
			return { ok = true, events = events }
		end
		-- D4: tech exchange — offer.from GIVES techId to acceptor (pid); a wantTechId
		-- is given back (a swap). Whole techs only. Grants are MINIMAL (no cascade —
		-- the require cycle). Treaty state unchanged.
		if okind == "techExchange" then
			diploGrantTech(state, pid, if offer.techId == nil then "" else offer.techId, events)
			if offer.wantTechId ~= nil then diploGrantTech(state, offer.from, offer.wantTechId, events) end
			entry.offer = nil
			table.insert(events, { type = "TECH_EXCHANGED", giverCivId = eventCiv(state, offer.from), takerCivId = eventCiv(state, pid), turn = state.turn })
			return { ok = true, events = events }
		end
		-- peace (default) — the D3 behaviour.
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
local function contactPass(state: any, pid: string, events: any, ruleset: any)
	local player = state.players[pid]
	if player == nil then return end
	local mask = visibility.computeVisible(state, pid, ruleset)
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

-- D4 offer-expiry sweep (engine processing, replayable), run once per round-wrap
-- beside processDecay. An offer past its expiresTurn is deleted + OFFER_EXPIRED
-- emitted (neutral). Omit-safe (no-op when relations empty or no expiresTurn).
local function processExpiry(state: any, ruleset: any, events: any)
	if state.relations == nil then return end
	for key, e in pairs(state.relations) do
		local offer = e.offer
		if offer ~= nil and offer.expiresTurn ~= nil and state.turn >= offer.expiresTurn then
			local parts = string.split(key, "|")
			local other = if offer.from == parts[1] then parts[2] else parts[1]
			e.offer = nil
			table.insert(events, { type = "OFFER_EXPIRED", fromCivId = eventCiv(state, offer.from), toCivId = eventCiv(state, other), turn = state.turn })
		end
	end
end

-- D5 reputation RECOVERY (engine processing, replayable), run once per round-wrap
-- beside processDecay/processExpiry. A soiled civ (rep > 0) that keeps its treaties
-- heals one band every repRecoverTurns clean turns; the clock resets on a betrayal.
-- Fully-healed civs shed BOTH fields (reputation is stored 1..repMax or ABSENT, never
-- 0) so a recovered state is byte-identical to a never-soiled one. Omit-safe.
local function processReputation(state: any, ruleset: any, events: any)
	local d = ruleset.rules.diplomacy
	if d == nil then return end
	local recover = if d.repRecoverTurns == nil then 0 else d.repRecoverTurns
	if recover <= 0 then return end
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		if p ~= nil and p.reputation ~= nil and p.reputation > 0 then
			local clean = (if p.repCleanTurns == nil then 0 else p.repCleanTurns) + 1
			if clean >= recover then
				local rep = p.reputation - 1
				if rep <= 0 then
					p.reputation = nil
					p.repCleanTurns = nil
				else
					p.reputation = rep
					p.repCleanTurns = 0
				end
				table.insert(events, { type = "REPUTATION_SHIFT", civId = eventCiv(state, pid), reputation = if p.reputation == nil then 0 else p.reputation, direction = "better", turn = state.turn })
			else
				p.repCleanTurns = clean
			end
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
	processExpiry = processExpiry,
	processReputation = processReputation,
}
