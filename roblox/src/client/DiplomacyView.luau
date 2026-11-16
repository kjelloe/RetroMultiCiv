-- D3 Tier-B: relation-legibility reads for the Foreign-relations panel — a
-- Luau port of shared/diplomacy-view.js (relationOf / relationEntry /
-- relationLabel / reputationOf), reading the FILTERED VIEW. The D3 filterView
-- twin (bb8ce1d) now exposes view.relations WHOLE ({} when absent), so this
-- reads the same authoritative map the browser panel does. Pure + fog-honest
-- (relations are global/non-secret in Civ 1); golden-neutral. Gate 19 pins
-- parity vs shared/diplomacy-view.js relationLabel.
--
-- `view` stands in for the browser's `state` here: it carries `.relations`,
-- `.turn`, and `.players` — the only fields these reads touch.
local M = {}

-- pairKey: sorted player-id pair (engine/diplomacy.js parity — relations are
-- keyed by the sorted pid pair).
local function pairKey(a, b)
	if a < b then
		return a .. "|" .. b
	end
	return b .. "|" .. a
end

local function relationEntry(view, a, b)
	local rel = view.relations
	if rel == nil then
		return nil
	end
	return rel[pairKey(a, b)]
end

-- relationOf: 'war' | 'peace'. Default (no map / no entry) = war, the Civ 1
-- permanent-war world; an expired peace treaty reverts to war.
function M.relationOf(view, a, b)
	local rel = view.relations
	if rel == nil then
		return "war"
	end
	local entry = rel[pairKey(a, b)]
	if entry == nil then
		return "war"
	end
	if entry.state == "peace" and entry.expiresTurn ~= nil and view.turn >= entry.expiresTurn then
		return "war"
	end
	return entry.state
end

-- relationLabel: the one-line status a civ row shows (1:1 with
-- shared/diplomacy-view.js relationLabel).
function M.relationLabel(view, me, them)
	local e = relationEntry(view, me, them)
	if M.relationOf(view, me, them) == "peace" then
		local since = (e ~= nil and e.treatyTurn ~= nil) and (" since turn " .. e.treatyTurn) or ""
		local untilTxt = (e ~= nil and e.expiresTurn ~= nil) and (" (until turn " .. e.expiresTurn .. ")") or " (perpetual)"
		return "🕊 at peace" .. since .. untilTxt
	end
	-- war: a treatyTurn on a war entry marks the declaration; absent = the
	-- default perpetual war (no "since" — it was always so).
	local since = (e ~= nil and e.state == "war" and e.treatyTurn ~= nil) and (" since turn " .. e.treatyTurn) or ""
	return "⚔ at war" .. since
end

-- haveMet: have these two MADE CONTACT? Twin of shared/diplomacy-view.js
-- haveMet (845a036) — same symmetric pair flag, same omit-safe reading
-- (absent = unmet), so a crafted or pre-D3 view reads "not met" rather than
-- erroring. The panel hides unmet civs behind an "unknown civilization" row.
function M.haveMet(view, a, b)
	local e = relationEntry(view, a, b)
	return e ~= nil and e.met == true
end

-- reputationOf: player's standing (0 default), engine/diplomacy.js parity.
function M.reputationOf(view, pid)
	local p = view.players[pid]
	return (p ~= nil and p.reputation ~= nil) and p.reputation or 0
end

-- ---------------------------------------------------------------------------
-- Treaty actions (dip-03..08; roblox/selftest/diplomacy-actions.luau, gate 63).
-- Twins of shared/diplomacy-view.js (pendingOfferFor, treatyActions) and of
-- the pure parts of client/ui/diplomacy.js (parleyCommand, describeParley,
-- offerPayload, DIPLO_REASON, REP_BANDS). Display only: the server judges.

M.REP_BANDS = { "Honorable", "Reliable", "Wary", "Dishonored", "Treacherous" }
M.TERMS = { "peace", "tribute", "techswap" }
M.TERM_LABEL = { peace = "Peace", tribute = "Demand tribute", techswap = "Tech swap" }
M.TRIBUTE_DEFAULT = 50
M.TRIBUTE_STEP = 10
M.CONFIRM_WINDOW = 3 -- seconds a first Declare war press stays armed

M.REASON = {
	selfTarget = "you cannot make a treaty with yourself",
	alreadyPeace = "you are already at peace with them",
	alreadyWar = "you are already at war with them",
	noSuchOffer = "there is no standing offer to answer",
	noSuchTarget = "no such civilization",
	atPeace = "a peace treaty stands - break it first to attack",
	senateRefused = "your senate refuses to break the peace treaty",
	notYourTurn = "wait for your turn",
	cannotDiplomacyBarbarians = "barbarians do not negotiate",
	unknownKind = "that is not a treaty action",
	notMet = "you have not met that civilization yet",
	unknownCommand = "diplomacy is not available in this game yet",
}

function M.reasonText(code)
	return M.REASON[code] or tostring(code)
end

-- the band a soiled civ shows (nil at 0, the clean default)
function M.repBand(rep)
	if rep <= 0 then
		return nil
	end
	return M.REP_BANDS[rep + 1] or M.REP_BANDS[#M.REP_BANDS]
end

function M.pendingOfferFor(view, a, b)
	local e = relationEntry(view, a, b)
	return e ~= nil and e.offer or nil
end

-- which buttons a row carries. offerSent: my own offer stands, nothing to press
function M.treatyActions(view, me, them)
	local rel = M.relationOf(view, me, them)
	local offer = M.pendingOfferFor(view, me, them)
	return {
		canDeclare = rel == "peace",
		canOffer = rel == "war",
		canAccept = offer ~= nil and offer.from == them,
		offerSent = offer ~= nil and offer.from == me,
	}
end

-- the engine `diplomacy` command for a pressed button (the server stamps the
-- player). term: declare | accept | reject | peace | tribute | techswap
function M.parleyCommand(target, term, opts)
	opts = opts or {}
	if term == "accept" or term == "reject" or term == "declare" then
		return { type = "diplomacy", kind = term, target = target }
	end
	local terms = {}
	if term == "tribute" then
		terms.kind = "tribute"
		terms.gold = math.max(0, math.floor(opts.gold or 0))
	elseif term == "techswap" then
		terms.kind = "techExchange"
		terms.techId = opts.giveTech or ""
		if opts.wantTech ~= nil and opts.wantTech ~= "" then
			terms.wantTechId = opts.wantTech
		end
	else
		terms.peace = true -- duration omitted = perpetual
	end
	return { type = "diplomacy", kind = "offer", target = target, terms = terms }
end

-- a standing engine offer (flat kind / gold / techId fields) as the payload
-- describeParley reads
function M.offerPayload(offer)
	if offer ~= nil and offer.kind == "tribute" then
		return { term = "tribute", gold = offer.gold }
	elseif offer ~= nil and offer.kind == "techExchange" then
		return { term = "techswap", giveTech = offer.techId, wantTech = offer.wantTechId }
	end
	return { term = "peace", duration = offer ~= nil and offer.duration or nil }
end

-- opts: { name, techName(id) }
function M.describeParley(payload, opts)
	opts = opts or {}
	local name = opts.name or "They"
	local function tn(id)
		local n = opts.techName ~= nil and opts.techName(id) or id
		return (n ~= nil and n ~= "") and n or "a technology"
	end
	local term = payload ~= nil and payload.term or nil
	if term == "peace" then
		return ("%s propose a %s peace treaty."):format(name,
			(payload.duration ~= nil and payload.duration ~= 0) and (payload.duration .. "-turn") or "lasting")
	elseif term == "tribute" then
		return ("%s demand a tribute of %d gold."):format(name, payload.gold or 0)
	elseif term == "techswap" then
		if payload.wantTech ~= nil and payload.wantTech ~= "" then
			return ("%s offer %s in exchange for your %s."):format(name, tn(payload.giveTech), tn(payload.wantTech))
		end
		return ("%s offer %s as a gift."):format(name, tn(payload.giveTech))
	end
	return ("%s propose terms."):format(name)
end

local function rivalIds(view, you)
	local ids = {}
	if view.playerOrder ~= nil then
		for _, pid in ipairs(view.playerOrder) do
			ids[#ids + 1] = pid
		end
	else
		for pid in pairs(view.players) do
			ids[#ids + 1] = pid
		end
		table.sort(ids)
	end
	local out = {}
	for _, pid in ipairs(ids) do
		local p = view.players[pid]
		if pid ~= you and pid ~= "barb" and p ~= nil and p.alive ~= false and p.barbarian ~= true then
			out[#out + 1] = pid
		end
	end
	return out
end

local function speaker(view, pid, rs)
	local p = view.players[pid]
	local civ = p ~= nil and p.civ ~= nil and rs ~= nil and rs.civs ~= nil and rs.civs[p.civ] or nil
	return civ ~= nil and ("The " .. civ.name) or (p ~= nil and p.name or pid)
end

local function offerText(view, pid, offer, rs)
	return M.describeParley(M.offerPayload(offer), {
		name = speaker(view, pid, rs),
		techName = function(id)
			local def = rs ~= nil and rs.techs ~= nil and rs.techs[id] or nil
			return def ~= nil and def.name or id
		end,
	})
end

-- the panel: one row per living rival. An unmet civ is a row without a name
-- and without buttons (its name would be a fog leak).
function M.rows(view, you, rs)
	local out = {}
	for _, pid in ipairs(rivalIds(view, you)) do
		if not M.haveMet(view, you, pid) then
			out[#out + 1] = { pid = pid, met = false, name = "unknown civilization", label = "you have not met them" }
		else
			local p = view.players[pid]
			local actions = M.treatyActions(view, you, pid)
			local offer = M.pendingOfferFor(view, you, pid)
			out[#out + 1] = {
				pid = pid, met = true, name = p.name or pid, color = p.color,
				rel = M.relationOf(view, you, pid), label = M.relationLabel(view, you, pid),
				repBand = M.repBand(M.reputationOf(view, pid)),
				actions = actions,
				offerText = actions.canAccept and offerText(view, pid, offer, rs) or nil,
			}
		end
	end
	return out
end

-- offers THEY made to me, each with the key "later" remembers it by
function M.incomingOffers(view, you, rs)
	local out = {}
	for _, pid in ipairs(rivalIds(view, you)) do
		local offer = M.pendingOfferFor(view, you, pid)
		if offer ~= nil and offer.from == pid then
			out[#out + 1] = { pid = pid, offer = offer, key = pid .. "|" .. tostring(offer.turn),
				text = offerText(view, pid, offer, rs) }
		end
	end
	return out
end

-- tech swap lists: give = what I know, want = everything I do not (as the
-- browser: not narrowed to what they know, which the view does not tell)
function M.swapChoices(view, you, rs)
	local mine = {}
	for _, t in ipairs(view.players[you].techs or {}) do
		mine[t] = true
	end
	local give, want = {}, {}
	for id, def in pairs(rs.techs) do
		local item = { id = id, name = def.name or id }
		if mine[id] then
			give[#give + 1] = item
		else
			want[#want + 1] = item
		end
	end
	local function byName(a, b)
		return a.name < b.name
	end
	table.sort(give, byName)
	table.sort(want, byName)
	return { give = give, want = want }
end

function M.tributeStep(gold, dir)
	return math.max(0, gold + dir * M.TRIBUTE_STEP)
end

-- Declare war asks once more: the first press arms it, a second inside the
-- window sends. -> "send" | "arm"
function M.confirmPress(armedId, armedAt, id, now)
	if armedId == id and armedAt ~= nil and now - armedAt <= M.CONFIRM_WINDOW then
		return "send"
	end
	return "arm"
end

return M
