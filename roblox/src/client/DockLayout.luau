-- U3 (specs/roblox-native-look.md): the top-row menu bar as ONE planned row
-- instead of five hand-placed offsets. Pure (lune-pinned by
-- roblox/selftest/ui-dock.luau, check.sh gate 39); HudDock applies the plan.
--
-- Items sit right-to-left by `order` (1 = rightmost). A hidden item takes no
-- space, so the row closes up. When the full-width row would pass its share
-- of the viewport every item that can go icon-only does; if it still does not
-- fit, it wraps to a second row. Two items never share pixels.
local M = {}

M.GAP = 8
M.MARGIN = 8
M.TOP = 8
M.H_DESKTOP = 40
M.H_TOUCH = 44 -- the platform's minimum comfortable touch target
M.MAX_SHARE = 0.55 -- of the viewport width (status text owns the left, the wait label the centre)
M.CHAR_W = 10 -- FredokaOne at 18 px averages about this per character
M.ICON_PAD = 47 -- icon (h - 12) + its 7 px inset + 12 px gap, at h = 40

-- full width of an icon + label button
function M.widthFor(chars, h)
	return (h - 12) + 19 + chars * M.CHAR_W + 10
end

-- items: array of { id, order, w, compactW (nil = cannot go icon-only), visible }
-- returns { compact, rows, h, places = { [id] = { right, y, w, h, compact } } }
-- `right` = distance from the viewport's right edge to the button's right side
function M.plan(vw, items, opts)
	opts = opts or {}
	local h = opts.h or M.H_DESKTOP
	local gap = opts.gap or M.GAP
	local margin = opts.margin or M.MARGIN
	local top = opts.top or M.TOP
	local avail = math.max(h, math.floor(vw * (opts.maxShare or M.MAX_SHARE)) - margin)

	local shown = {}
	for _, it in ipairs(items) do
		if it.visible ~= false then
			table.insert(shown, it)
		end
	end
	table.sort(shown, function(a, b)
		if a.order ~= b.order then
			return a.order < b.order
		end
		return a.id < b.id
	end)

	local function total(compact)
		local sum = 0
		for i, it in ipairs(shown) do
			sum += ((compact and it.compactW) or it.w) + (i > 1 and gap or 0)
		end
		return sum
	end
	local compact = total(false) > avail

	local places = {}
	local right, row = margin, 0
	for _, it in ipairs(shown) do
		local isCompact = compact and it.compactW ~= nil
		local w = isCompact and it.compactW or it.w
		if right > margin and right + w > avail + margin then
			row += 1
			right = margin
		end
		places[it.id] = { right = right, y = top + row * (h + gap), w = w, h = h, compact = isCompact }
		right += w + gap
	end
	return { compact = compact, rows = (#shown > 0) and (row + 1) or 0, h = h, places = places }
end

return M
