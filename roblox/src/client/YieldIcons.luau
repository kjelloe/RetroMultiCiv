-- Tile yields as icon rows (pure): one row per resource, one glyph per
-- point - food green dot, shields grey bar, trade gold diamond. Shared by
-- the city view's worked-tile labels and the map's Resources overlay, both
-- sized in studs so a label fills its tile at any zoom.
-- roblox/selftest/yield-icons.luau, gate 68.
local M = {}

M.KINDS = {
	{ key = "food", glyph = "\u{25CF}", color = "#7fd08a" },
	{ key = "shields", glyph = "\u{25AE}", color = "#d8d8d8" },
	{ key = "trade", glyph = "\u{25C6}", color = "#e0c060" },
}

-- label size as a share of the tile: three rows fill it
M.LABEL = { w = 0.92, h = 0.8 }

-- -> { { key, glyph, color, n }, ... } for the resources the tile gives
function M.rows(y)
	local out = {}
	for _, k in ipairs(M.KINDS) do
		local n = y ~= nil and y[k.key] or 0
		if n ~= nil and n > 0 then
			out[#out + 1] = { key = k.key, glyph = k.glyph, color = k.color, n = n }
		end
	end
	return out
end

-- RichText: one line per resource; "" for a tile that gives nothing
function M.text(y)
	local lines = {}
	for _, r in ipairs(M.rows(y)) do
		lines[#lines + 1] = ('<font color="%s">%s</font>'):format(r.color, string.rep(r.glyph, r.n))
	end
	return table.concat(lines, "\n")
end

-- the map overlay labels only the tiles around the camera focus
M.RADIUS = 9
M.STEP = 2 -- tiles the focus moves before the window is rebuilt

-- -> x0, x1, y0, y1 (inclusive tile bounds, inside the map)
function M.window(fx, fy, width, height)
	return math.max(0, fx - M.RADIUS), math.min(width - 1, fx + M.RADIUS),
		math.max(0, fy - M.RADIUS), math.min(height - 1, fy + M.RADIUS)
end

function M.moved(ax, ay, bx, by)
	return ax == nil or math.abs(ax - bx) >= M.STEP or math.abs(ay - by) >= M.STEP
end

return M
