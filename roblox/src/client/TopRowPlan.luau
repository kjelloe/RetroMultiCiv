-- The top-centre button row (Research, Cities, Government, Military,
-- Statistics) as a plan per viewport width (pure; roblox/selftest/
-- top-row.luau, gate 54). The row shares the top strip with the turn chip on
-- the left and the menu row on the right; it must never share pixels with
-- either. Full labels when they fit centred, else icon squares, centred if
-- that fits, else pushed against the turn chip, else on a second row.
local M = {}

M.BUTTONS = { -- in the order they stand; w = full width at 38 px height
	{ id = "research", w = 166 }, { id = "cities", w = 136 }, { id = "government", w = 170 },
	{ id = "military", w = 136 }, { id = "stats", w = 170 },
}
M.GAP = 4
M.PAD = 6 -- each side of the row's backing
M.COMPACT_W = 44
M.ROW_H = 46
M.ROW_STEP = 50 -- second row offset
M.LEFT = 340 -- the turn chip ("Turn 546 · 2100 AD · 4 gold · GAME OVER") + margin
-- the menu row (Tech Tree, ring, Encyclopedia, Options): full labels while
-- they fit DockLayout's share of the width, icon squares below that
M.RIGHT_FULL = 536
M.RIGHT_COMPACT = 216
M.DOCK_SHARE = 0.55

function M.width(compact)
	local w = 2 * M.PAD + (#M.BUTTONS - 1) * M.GAP
	for _, b in ipairs(M.BUTTONS) do
		w += compact and M.COMPACT_W or b.w
	end
	return w
end

function M.rightReserve(vw)
	return (M.RIGHT_FULL - 16) <= vw * M.DOCK_SHARE and M.RIGHT_FULL or M.RIGHT_COMPACT
end

-- -> { compact, align = "centre" | "left", x (left edge), w, row (0 | 1) }
function M.plan(vw)
	local right = vw - M.rightReserve(vw)
	for _, compact in ipairs({ false, true }) do
		local w = M.width(compact)
		local x = math.floor((vw - w) / 2)
		if x >= M.LEFT and x + w <= right then
			return { compact = compact, align = "centre", x = x, w = w, row = 0 }
		end
		if compact and M.LEFT + w <= right then
			return { compact = true, align = "left", x = M.LEFT, w = w, row = 0 }
		end
	end
	local w = M.width(true)
	return { compact = true, align = "centre", x = math.max(0, math.floor((vw - w) / 2)), w = w, row = 1 }
end

return M
