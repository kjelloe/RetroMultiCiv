-- Settler automation's per-tile choice (pure; twin of chooseWork in the
-- browser's client/ui/automate.js). roblox/selftest/settler-jobs.luau checks
-- it against settler-jobs.json, which settler-jobs.mjs exports from the
-- browser function (gate 69).
local M = {}

M.PRIORITIES = { "balanced", "food", "shield", "trade" }
M.LABELS = { balanced = "Balanced", food = "Food", shield = "Shield", trade = "Trade" }

function M.valid(p)
	return table.find(M.PRIORITIES, p) ~= nil
end

function M.nextPriority(p)
	local i = table.find(M.PRIORITIES, p) or 1
	return M.PRIORITIES[i % #M.PRIORITIES + 1]
end

-- tile: the view tile; terrain: its ruleset row; opts = { water, knowsRail,
-- knowsBridge, priority } -> "road" | "mine" | "irrigate" | "railroad" | nil.
-- Road first, then the improvement the priority prefers, then rail. An
-- improved tile is left alone unless the priority asks for the other one.
function M.chooseWork(tile, terrain, opts)
	local pri = M.valid(opts.priority) and opts.priority or "balanced"
	local water = opts.water == true
	local roadNeedsBridge = tile.river == true and opts.knowsBridge ~= true
	if tile.road ~= true and not roadNeedsBridge then
		return "road"
	end

	local terrIrr = terrain.irrigate ~= nil and water
	local terrMine = terrain.mine ~= nil and tile.river ~= true
	local isIrr, isMine = tile.irrigation == true, tile.mine == true
	local canIrr = terrIrr and not isIrr and not isMine
	local canMine = terrMine and not isIrr and not isMine
	if pri == "food" then
		canIrr = terrIrr and not isIrr
	elseif pri == "shield" then
		canMine = terrMine and not isMine
	end

	local work = nil
	if pri == "food" then
		work = canIrr and "irrigate" or (canMine and "mine" or nil)
	elseif pri == "shield" then
		work = canMine and "mine" or (canIrr and "irrigate" or nil)
	elseif pri == "balanced" then
		local mineBetter = canMine and (not canIrr or terrain.mine.shields > terrain.irrigate.food)
		work = mineBetter and "mine" or (canIrr and "irrigate" or nil)
	end
	if work ~= nil then
		return work
	end
	if opts.knowsRail == true and tile.road == true and tile.railroad ~= true then
		return "railroad"
	end
	return nil
end

return M
