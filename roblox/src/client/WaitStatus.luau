-- Tier-3 (docs/13) wait-status: the Roblox port of client/ui/wait-status.js
-- (A26). Pure timer/threshold logic — the tracker watches whose turn it is,
-- the elapsed clock resets on every turn change, and the slow-poke note fires
-- ONCE per player-turn once the threshold is crossed. Client-side narration
-- only; nothing enters game state (golden-neutral). Mirrors createWaitTracker
-- 1:1 (gate 20 pins the parity).
local M = {}

-- returns a tracker whose update(activePid, viewerPid, nowMs, thresholdSec)
-- yields { waitingFor, elapsedSec, note } — waitingFor nil when it is the
-- viewer's own turn (or nobody's); note true exactly once per wait that
-- crosses thresholdSec (0 disables the note).
function M.createWaitTracker()
	local pid = nil
	local since = 0
	local noted = false
	return {
		update = function(activePid, viewerPid, nowMs, thresholdSec)
			if activePid ~= pid then
				pid = activePid
				since = nowMs
				noted = false
			end
			if activePid == nil or activePid == viewerPid then
				return { waitingFor = nil, elapsedSec = 0, note = false }
			end
			local elapsedSec = math.floor((nowMs - since) / 1000)
			local note = false
			if not noted and thresholdSec > 0 and elapsedSec >= thresholdSec then
				noted = true
				note = true
			end
			return { waitingFor = activePid, elapsedSec = elapsedSec, note = note }
		end,
	}
end

function M.formatWait(name, elapsedSec)
	return ("⏳ %s is moving · %ds"):format(name, elapsedSec)
end

function M.formatSlowNote(name, elapsedSec)
	return ("⏱ Waited %ds for %s"):format(elapsedSec, name)
end

return M
