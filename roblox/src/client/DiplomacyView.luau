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

-- reputationOf: player's standing (0 default), engine/diplomacy.js parity.
function M.reputationOf(view, pid)
	local p = view.players[pid]
	return (p ~= nil and p.reputation ~= nil) and p.reputation or 0
end

return M
