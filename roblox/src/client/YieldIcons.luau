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

-- the drawn icons (EditableGlyph primitives, 0..100 box, y down; shade =
-- the darker tone): food an ear of wheat, shields a coin, trade two arrows
-- passing each other. The glyphs above are the fallback when images cannot
-- be drawn, and the tile info card's inline text.
local function ell(x, y, rot)
	return { p = "ell", x = x, y = y, rx = 7, ry = 13, rot = rot, fill = true }
end
local function bar(x, y, w, h, shade)
	return { p = "bar", x = x, y = y, w = w, h = h, r = 2, rot = 0, shade = shade }
end
local function tri(a, b, c)
	return { p = "poly", pts = { a, b, c }, fill = true, close = true }
end
M.ICONS = {
	food = { bar(50, 64, 5, 60), ell(50, 16, 0),
		ell(37, 34, -32), ell(63, 34, 32), ell(37, 52, -32), ell(63, 52, 32), ell(37, 70, -32), ell(63, 70, 32) },
	shields = { { p = "disc", x = 50, y = 50, r = 44 }, { p = "ring", x = 50, y = 50, r = 31, w = 5, shade = true },
		bar(50, 50, 9, 30, true) },
	trade = { bar(40, 32, 56, 11), tri({ 66, 14 }, { 96, 32 }, { 66, 50 }),
		bar(60, 68, 56, 11), tri({ 34, 50 }, { 4, 68 }, { 34, 86 }) },
}

-- the rows of one label, as shares of its box: each row a third of the
-- height, the block centred; a row is n icons wide (aspect n : 1)
-- -> { { key, n, y, h }, ... }
function M.layout(y)
	local rows = M.rows(y)
	local h = 1 / 3
	local top = (1 - #rows * h) / 2
	local out = {}
	for i, r in ipairs(rows) do
		out[i] = { key = r.key, n = r.n, y = top + (i - 1) * h, h = h }
	end
	return out
end

-- what a label was last drawn with (redraw only when it changes)
function M.signature(y)
	return ("%d/%d/%d"):format(y ~= nil and y.food or 0, y ~= nil and y.shields or 0, y ~= nil and y.trade or 0)
end

-- the city centre's AUTO word: this share of the label's height
M.AUTO_SCALE = 0.6

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

-- the same glyphs on one line (the tile info card)
function M.inline(y)
	local runs = {}
	for _, r in ipairs(M.rows(y)) do
		runs[#runs + 1] = ('<font color="%s">%s</font>'):format(r.color, string.rep(r.glyph, r.n))
	end
	return table.concat(runs, " ")
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
