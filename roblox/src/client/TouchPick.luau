-- Touch on the map (uo-21, plan R5.3; the browser's input.js doLongPress): a
-- short touch is a tap (the click's select / move), a held one is a long
-- press - beside an enemy it shows the odds (no attack), further away it
-- sets a GoTo for the selected unit. Pure; roblox/selftest/touch-pick.luau,
-- gate 79.
local M = {}

M.LONG = 0.5 -- seconds; Tooltip's long-press uses the same
M.DRAG = 12 -- px a finger may wander and still tap

function M.kind(held, moved)
	if moved > M.DRAG then
		return "drag"
	end
	return held >= M.LONG and "long" or "tap"
end

local function cheb(map, ax, ay, bx, by)
	local dx = math.abs(ax - bx)
	if map.wrapX and map.width - dx < dx then
		dx = map.width - dx
	end
	return math.max(dx, math.abs(ay - by))
end

-- what a long press on (tx, ty) does for the selected unit u:
-- "odds" | "goto" | nil (no own unit, not your turn, or the unit's own /
-- an empty neighbouring tile: a tap moves there)
function M.longAction(view, u, tx, ty, myTurn)
	if u == nil or view == nil or u.owner ~= view.you or not myTurn or view.gameOver == true then
		return nil
	end
	local d = cheb(view.map, u.x, u.y, tx, ty)
	if d == 0 then
		return nil
	end
	if d == 1 then
		for _, o in pairs(view.units) do
			if o.owner ~= view.you and o.x == tx and o.y == ty then
				return "odds"
			end
		end
		return nil
	end
	return "goto"
end

return M
