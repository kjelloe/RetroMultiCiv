--!strict
-- A59 leader-personality read seam, twin of engine/leaders.js. PURE reads; nothing
-- behaves by personality until D3. Axes are INTEGERS summing to 100 (floats break
-- statehash/rulesetHash). Byte-shaped with the JS.

-- the stance's implied axes — the fallback when a player has no leader personality
-- (crafted/stanceless states). Each sums to 100. Must match engine/leaders.js.
local STANCE_AXES: { [string]: any } = {
	balanced = { aggression = 25, science = 25, growth = 25, defense = 25 },
	aggressive = { aggression = 70, science = 10, growth = 10, defense = 10 },
	defensive = { aggression = 10, science = 10, growth = 10, defense = 70 },
	science = { aggression = 10, science = 70, growth = 10, defense = 10 },
	growth = { aggression = 10, science = 10, growth = 70, defense = 10 },
	builder = { aggression = 10, science = 10, growth = 70, defense = 10 },
}

local function personalityOf(state: any, pid: string, ruleset: any): any
	local player = state.players[pid]
	if player ~= nil and player.civ ~= nil and ruleset.civs ~= nil then
		local civ = ruleset.civs[player.civ]
		if civ ~= nil and civ.personality ~= nil then
			return civ.personality
		end
	end
	local stance = if player ~= nil and player.stance ~= nil then player.stance else "balanced"
	return if STANCE_AXES[stance] ~= nil then STANCE_AXES[stance] else STANCE_AXES.balanced
end

-- the axis->stance labels in the fixed order (deterministic partial-tie break); a
-- FLAT personality (all four equal) -> 'balanced' (no dominant axis).
local AXIS_STANCE = { { "aggression", "aggressive" }, { "science", "science" }, { "growth", "growth" }, { "defense", "defensive" } }

local function stanceFromPersonality(personality: any): string
	local maxVal = -1
	for _, pair in ipairs(AXIS_STANCE) do
		if personality[pair[1]] > maxVal then
			maxVal = personality[pair[1]]
		end
	end
	local count = 0
	for _, pair in ipairs(AXIS_STANCE) do
		if personality[pair[1]] == maxVal then
			count += 1
		end
	end
	if count == 4 then
		return "balanced"
	end
	for _, pair in ipairs(AXIS_STANCE) do
		if personality[pair[1]] == maxVal then
			return pair[2]
		end
	end
	return "balanced"
end

local function favoriteModifier(_kind: string, _id: string, _ruleset: any): number
	return 0
end

return {
	personalityOf = personalityOf,
	stanceFromPersonality = stanceFromPersonality,
	favoriteModifier = favoriteModifier,
	STANCE_AXES = STANCE_AXES,
}
