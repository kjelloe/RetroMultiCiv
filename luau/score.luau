--!strict
-- Luau twin of engine/score.js (phase 5, P5-7): civilization score and
-- game-end detection. THE CRAFTED-STATE EXEMPTION transliterates exactly:
-- only players created with alive == true can be eliminated / end the game —
-- states without the flag are exempt, which keeps scenario hashes stable.
-- EXPORTS (stable): score(state, playerId, ruleset), checkGameEnd(state,
-- ruleset, events), hasAssets(state, playerId).

local function score(state: any, playerId: string, ruleset: any): number
	local player = state.players[playerId]
	local citizens = 0
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId then
			citizens += city.pop
		end
	end
	local wonders = 0
	if state.wonders ~= nil then
		for _, homeId in pairs(state.wonders) do
			local home = state.cities[homeId]
			if home ~= nil and home.owner == playerId then
				wonders += 1
			end
		end
	end
	local rules = ruleset.rules
	return citizens * rules.scorePerCitizen
		+ #player.techs * rules.scorePerTech
		+ wonders * rules.scorePerWonder
end

local function hasAssets(state: any, playerId: string): boolean
	for _, u in pairs(state.units) do
		if u.owner == playerId then
			return true
		end
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local city = state.cities[cid]
		if city ~= nil and city.owner == playerId then
			return true
		end
	end
	return false
end

-- Runs once per game turn (turn wrap), after cities/research/barbarians.
local function checkGameEnd(state: any, ruleset: any, events: any)
	if state.gameOver then
		return
	end

	for _, pid in ipairs(state.playerOrder) do
		local player = state.players[pid]
		if player.alive == true and not hasAssets(state, pid) then
			player.alive = false
			table.insert(events, { type = "playerDefeated", playerId = pid })
		end
	end

	local contenders = {}
	local defeated = 0
	for _, pid in ipairs(state.playerOrder) do
		if state.players[pid].alive == true then
			table.insert(contenders, pid)
		elseif state.players[pid].alive == false then
			defeated += 1
		end
	end
	local participating = #contenders + defeated
	if participating < 2 then
		return -- crafted states without alive flags: no game end
	end

	if #contenders == 1 then
		state.gameOver = true
		state.winner = contenders[1]
		table.insert(events, { type = "gameOver", winner = state.winner, victory = "conquest" })
		return
	end

	if state.year >= ruleset.rules.endYear and #contenders > 0 then
		local best = contenders[1]
		for _, pid in ipairs(contenders) do
			if score(state, pid, ruleset) > score(state, best, ruleset) then
				best = pid
			end
		end
		state.gameOver = true
		state.winner = best
		table.insert(events, { type = "gameOver", winner = best, victory = "score" })
	end
end

return {
	score = score,
	checkGameEnd = checkGameEnd,
	hasAssets = hasAssets,
}
