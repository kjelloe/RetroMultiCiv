-- Replay theater play / pause and speed (gf-24, plan R4.3; the browser's
-- replay.js Play / Pause button and rounds-per-second tempo). Pure;
-- roblox/selftest/replay-pace.luau, gate 73.
local M = {}

-- rounds per second; the browser's slider runs 1..50 from 4, the theater
-- re-derives each round on the client, so the steps stay low
M.SPEEDS = { 1, 2, 4, 8 }
M.DEFAULT = 2

function M.nextSpeed(s)
	local i = table.find(M.SPEEDS, s) or 1
	return M.SPEEDS[i % #M.SPEEDS + 1]
end

function M.delay(s)
	return 1 / math.max(1, s)
end

function M.playText(playing)
	return playing and "Pause" or "Play"
end

function M.speedText(s)
	return ("%d/s"):format(s)
end

-- after a round is shown: the next round to show, or nil when playback stops
-- (the end reached). Play from the end starts over from round 0.
function M.nextRound(at, total)
	if at >= total then
		return nil
	end
	return at + 1
end

function M.startAt(at, total)
	return at >= total and 0 or at
end

return M
