-- Per-game badge bookkeeping (pure: no services). One progress table per
-- seated user, never in game state. Rulings 2026-11-17: first steps and
-- milestones count whoever played the turn; victory badges need the user to
-- have ended at least half the game's turns themselves; a game where a debug
-- command was used earns nothing; only the user in the winning seat wins.
-- roblox/selftest/badge-track.luau, gate 64.
local M = {}

-- rules = BadgeRules; startTurn = the turn the game began at (1 for a resumed
-- save: turns played before the resume are not on record, so they count as
-- not held)
function M.new(rules, rs, startTurn)
	return { rules = rules, rs = rs, startTurn = startTurn, users = {}, victory = nil, done = false }
end

-- a user who changes seat starts over: progress belongs to one civ
local function userOf(t, userId, pid)
	local u = t.users[userId]
	if u == nil or u.pid ~= pid then
		u = { pid = pid, progress = t.rules.newProgress(), turns = 0 }
		t.users[userId] = u
	end
	return u
end

-- the user ended this turn themselves (the regent's turns are not reported)
function M.onTurn(t, userId, pid)
	local u = userOf(t, userId, pid)
	u.turns += 1
end

function M.heldShare(t, userId, state)
	local u = t.users[userId]
	if u == nil then
		return 0
	end
	return math.min(1, u.turns / math.max(1, state.turn - t.startTurn))
end

-- one batch of engine events, each batch exactly once. seats: userId -> pid.
-- Returns { { userId, key }, ... } earned by this batch.
function M.onEvents(t, events, state, seats)
	local out = {}
	for _, e in ipairs(events) do
		if e.type == "gameOver" then
			t.victory = e.victory
		end
	end
	if state.debugUsed == true then
		return out
	end
	for userId, pid in pairs(seats) do
		local u = userOf(t, userId, pid)
		t.rules.onEvents(u.progress, events, state, pid, t.rs)
		for _, key in ipairs(t.rules.newlyEarned(u.progress, nil)) do
			out[#out + 1] = { userId = userId, key = key }
		end
	end
	return out
end

-- the end of the game, once. setup: { difficulty, combat, civs }
function M.finish(t, state, seats, setup)
	local out = {}
	if t.done or state.gameOver ~= true then
		return out
	end
	t.done = true
	for userId, pid in pairs(seats) do
		local u = userOf(t, userId, pid)
		local info = {
			won = state.winner == pid,
			victory = t.victory,
			difficulty = setup.difficulty,
			combat = setup.combat,
			civs = setup.civs,
			debugUsed = state.debugUsed == true,
			heldShare = M.heldShare(t, userId, state),
		}
		for _, key in ipairs(t.rules.newlyEarned(u.progress, info)) do
			out[#out + 1] = { userId = userId, key = key }
		end
	end
	return out
end

return M
