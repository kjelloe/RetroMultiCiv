-- The Options panel in sections (plan R7.4): rows grouped under a heading
-- each, in a fixed order. Pure; roblox/selftest/options-layout.luau, gate 80.
local M = {}

M.ROW = 24 -- px per row (a 22 px button + 2)
M.HEAD = 24 -- px per section heading
M.TOP = 6
M.BOTTOM = 8

M.SECTIONS = {
	{ title = "TURN", rows = { "autoNext", "autoEnd", "autoResearch", "hideHint", "unitMove" } },
	{ title = "MAP AND LOOK", rows = { "look", "voidArt", "palette", "minimap", "ridePad", "reduce", "wonder" } },
	{ title = "MESSAGES", rows = { "discovery", "advice", "turnBanner", "hideFuture", "clock" } },
	{ title = "SOUND", rows = { "sound", "volume" } },
}

-- -> { rows = id -> y, heads = { { title, y } }, height }
function M.plan()
	local rows, heads = {}, {}
	local y = M.TOP
	for _, s in ipairs(M.SECTIONS) do
		heads[#heads + 1] = { title = s.title, y = y }
		y += M.HEAD
		for _, id in ipairs(s.rows) do
			rows[id] = y
			y += M.ROW
		end
	end
	return { rows = rows, heads = heads, height = y + M.BOTTOM }
end

return M
