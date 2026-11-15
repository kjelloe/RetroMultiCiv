-- Where the bottom action bar stands for a viewport width (pure;
-- roblox/selftest/bar-fit.luau, gate 61). The bar shares the bottom strip
-- with the corner toggles (Turn log left, AI / End Turn right). It shrinks to
-- fit between them; once that would take it under MIN_BETWEEN it moves to its
-- own strip above the corners and uses the whole width instead (session
-- 2026-11-15: at 1222 px a 20 px high bar still ran into both corners).
local M = {}

M.SIDE = 206 -- the wider bottom corner (190 px toggles + margins)
M.EDGE = 8
M.MIN_BETWEEN = 0.7 -- below this the labels stop being readable
M.MIN_SCALE = 0.5
M.BOTTOM = 8 -- gap under the bar
M.LIFT = 52 -- clears the 44 px corner buttons

-- natural: the bar's unscaled width. -> { scale, lift (px above the bottom
-- strip), fits (false: even the whole width at MIN_SCALE is too narrow) }
function M.plan(vw, natural)
	if natural <= 0 then
		return { scale = 1, lift = 0, fits = true }
	end
	local between = (vw - 2 * M.SIDE) / natural
	if between >= M.MIN_BETWEEN then
		return { scale = math.min(1, between), lift = 0, fits = true }
	end
	local whole = (vw - 2 * M.EDGE) / natural
	return { scale = math.clamp(whole, M.MIN_SCALE, 1), lift = M.LIFT, fits = whole >= M.MIN_SCALE }
end

-- the bar's left and right edge on screen (centred)
function M.span(vw, natural, plan)
	local w = natural * plan.scale
	return (vw - w) / 2, (vw + w) / 2
end

return M
