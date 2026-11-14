-- F2 (PLAYTHROUGH-UI): screen-space label collision. World billboards have a
-- fixed PIXEL size, so neighbouring city/unit labels run through each other at
-- close range. pick() is the pure half (lune-pinned by
-- roblox/selftest/label-declutter.luau, check.sh gate 34): greedy by priority,
-- a label shows only if its screen rect clears every label already shown.
-- The caller (ViewRenderer) projects anchors and toggles BillboardGui.Enabled.

local M = {}

M.CITY = 1000
M.SELECTED = 900
M.OWN_UNIT = 500
M.OTHER_UNIT = 300

M.SLACK = 4 -- px of overlap tolerated on each axis (text rarely fills its box)

-- items: array of { x, y, w, h, pri, depth } — x/y the rect CENTER in pixels,
-- depth the camera distance (nearer wins a priority tie). Returns an array of
-- booleans, same order as items.
function M.pick(items)
	local order = {}
	for i = 1, #items do
		order[i] = i
	end
	table.sort(order, function(a, b)
		local ia, ib = items[a], items[b]
		if ia.pri ~= ib.pri then
			return ia.pri > ib.pri
		end
		if ia.depth ~= ib.depth then
			return ia.depth < ib.depth
		end
		return a < b
	end)
	local shown = {}
	local kept = {}
	for _, i in ipairs(order) do
		local it = items[i]
		local ok = true
		for _, k in ipairs(kept) do
			if math.abs(it.x - k.x) * 2 < it.w + k.w - M.SLACK * 2
				and math.abs(it.y - k.y) * 2 < it.h + k.h - M.SLACK * 2 then
				ok = false
				break
			end
		end
		shown[i] = ok
		if ok then
			table.insert(kept, it)
		end
	end
	return shown
end

-- rough pixel width of a label's widest line (SourceSansBold averages about
-- half its text size per character)
function M.textWidth(chars, textSize)
	return math.ceil(chars * textSize * 0.5) + 8
end

return M
