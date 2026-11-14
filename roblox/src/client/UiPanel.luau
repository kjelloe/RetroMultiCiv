-- Panel fit (specs/roblox-native-look.md §U6). Panels are authored in pixels
-- for a 1280x720 screen; this is the pure half of the rule that makes them
-- use a larger screen and fit a smaller one. Lune-pinned by
-- roblox/selftest/ui-panel.luau (check.sh gate 42); PanelDress applies it.
--
-- A panel scales about its screen anchor (the Position's Scale part), so one
-- pinned to the right or bottom edge keeps hugging it and a centred one stays
-- centred: offset' = offset * s, size' = size * s.
local M = {}

M.REF_W = 1280
M.REF_H = 720
M.MAX_SCALE = 1.4
M.MARGIN = 4
M.READABLE = 0.75 -- under this a 17 px body is below 13 px: flagged by the audit

-- screen-wide scale: never under 1 (a small screen is handled per panel by
-- place()'s fit), stepped to 0.05 so a window drag does not relayout per pixel
function M.scaleFor(vw, vh)
	local s = math.min(vw / M.REF_W, vh / M.REF_H)
	s = math.floor(s * 20) / 20
	return math.max(1, math.min(M.MAX_SCALE, s))
end

local function axis(posScale, posOffset, size, view, s)
	local at = posScale * view + posOffset * s
	local span = size * s
	local hi = view - span - M.MARGIN
	if hi < M.MARGIN then
		at = (view - span) / 2 -- cannot happen after the fit; centred if it does
	else
		at = math.max(M.MARGIN, math.min(hi, at))
	end
	return math.floor(at - posScale * view + 0.5)
end

-- home position (xs, xo, ys, yo), authored size (w, h), gui area (vw, vh),
-- wanted scale -> { s, xo, yo }: s is cut until the panel fits the area, the
-- offsets keep it fully on screen
function M.place(xs, xo, ys, yo, w, h, vw, vh, want)
	local s = want
	if w > 0 and h > 0 then
		s = math.min(s, (vw - 2 * M.MARGIN) / w, (vh - 2 * M.MARGIN) / h)
	end
	s = math.max(0.3, math.floor(s * 100) / 100)
	return { s = s, xo = axis(xs, xo, w, vw, s), yo = axis(ys, yo, h, vh, s) }
end

-- a ScreenGui's direct child is a panel when it is a pixel-sized frame at
-- least this big (toggles, chips and rows are smaller)
function M.isPanelSize(xScale, xOffset, yScale, yOffset)
	return xScale == 0 and yScale == 0 and xOffset >= 180 and yOffset >= 100
end

return M
