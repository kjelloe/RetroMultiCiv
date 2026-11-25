-- Motion options (plan R6.4; the browser's showUnitMove and reduceAnimation):
-- GoTo steps paced so the eye can follow them, and one switch that stills
-- what moves on its own. Pure; roblox/selftest/motion.luau, gate 76.
local M = {}

M.GOTO_PACE = 0.2 -- seconds per GoTo step (the browser's ~200 ms per unit)

function M.reduced(options)
	return options ~= nil and options.reduceAnimation == true
end

-- seconds to wait before a GoTo step: paced unless switched off or reduced
function M.gotoDelay(options)
	if M.reduced(options) or (options ~= nil and options.showUnitMove == false) then
		return 0
	end
	return M.GOTO_PACE
end

-- the Research button's attention blink
function M.blink(options)
	return not M.reduced(options)
end

-- the Options switch the wonder scene reads: off when animation is reduced
function M.scenes(options)
	if M.reduced(options) then
		return false
	end
	return options ~= nil and options.wonderScenes
end

return M
