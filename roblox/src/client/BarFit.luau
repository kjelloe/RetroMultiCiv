-- Where the bottom action bar stands for a viewport width (pure;
-- roblox/selftest/bar-fit.luau, gate 61). The bar shares the bottom strip
-- with the corner toggles (Turn log left, AI / End Turn right). It shrinks to
-- fit between them; once that would take it under MIN_BETWEEN it moves to its
-- own strip above the corners and uses the whole width instead (session
-- 2026-11-15: at 1222 px a 20 px high bar still ran into both corners).
local M = {}

M.SIDE = 214 -- the wider bottom corner: End Turn 150 + AI 44 + gaps (design D, 2026-11-25: was 206, the AI button stands at 210)
M.EDGE = 8
M.MIN_BETWEEN = 0.7 -- below this the labels stop being readable
M.MIN_SCALE = 0.5
M.BOTTOM = 8 -- gap under the bar
M.LIFT = 52 -- clears the 44 px corner buttons

-- natural: the bar's unscaled width; phone: UiText.isPhone. -> { scale,
-- lift (px above the bottom strip), left / right (the room it is centred
-- in), fits (false: even that room at MIN_SCALE is too narrow) }. Lifted,
-- the bar clears End Turn and AI below it; on a desktop the left toggle
-- column (four 190 px buttons, 180 px high) stays beside it (design D,
-- 2026-11-25: the lifted bar ran into Legend and Map overlays at 1280 px);
-- a phone's toggles are one 44 px row, so it takes the whole width.
function M.plan(vw, natural, phone)
	if natural <= 0 then
		return { scale = 1, lift = 0, fits = true, left = 0, right = vw }
	end
	local between = (vw - 2 * M.SIDE) / natural
	if between >= M.MIN_BETWEEN then
		return { scale = math.min(1, between), lift = 0, fits = true, left = 0, right = vw }
	end
	local left = phone and M.EDGE or M.SIDE
	local room = (vw - left - M.EDGE) / natural
	return { scale = math.clamp(room, M.MIN_SCALE, 1), lift = M.LIFT, fits = room >= M.MIN_SCALE, left = left, right = vw - M.EDGE }
end

-- the bar's left and right edge on screen (centred in the plan's room)
function M.span(vw, natural, plan)
	local w = natural * plan.scale
	local l, r = plan.left or 0, plan.right or vw
	local c = (l + r) / 2
	return c - w / 2, c + w / 2
end

return M
