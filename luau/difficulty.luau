--!strict
-- Difficulty twin of engine/difficulty.js: the per-level knob table
-- (data/rules.json `difficulties`) keyed by state.difficulty (ascii id). WORLD
-- knobs (contentCitizens/startGold/barbAtkPct) apply always; ASYMMETRIC
-- AI-vs-human knobs (aiCostPct/aiFoodRows/bulb split) apply only when a human
-- seat exists. Absent difficulty => difficultyOf returns nil and every hook
-- falls back to today's value (crafted scenarios stay byte-identical).

local function difficultyOf(state: any, ruleset: any): any
	if state.difficulty == nil then
		return nil
	end
	local levels = ruleset.rules.difficulties
	if levels == nil then
		return nil
	end
	local row = levels[state.difficulty]
	if row == nil then
		return nil
	end
	return row
end

local function hasHumanSeat(state: any): boolean
	local order = state.playerOrder
	if order == nil then
		return false
	end
	for i = 1, #order do
		local p = state.players[order[i]]
		if p ~= nil and p.human == true then
			return true
		end
	end
	return false
end

return {
	difficultyOf = difficultyOf,
	hasHumanSeat = hasHumanSeat,
}
