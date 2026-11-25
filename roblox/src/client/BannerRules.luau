-- Centre banners (plan R6.3; the browser's hud.js makeBanner + turnBanner):
-- a message for HOLD seconds, a "Go to" button when it has a map tile, and
-- the your-turn banner in games with two or more human players (mutable from
-- the banner or Options). Pure; roblox/selftest/banner-rules.luau, gate 75.
local M = {}

M.HOLD = 5 -- seconds; the browser's timer

function M.humans(view)
	local n = 0
	for _, p in pairs(view.players or {}) do
		if p.human == true then
			n += 1
		end
	end
	return n
end

-- the hand-back moment: the seat just came back to this player
function M.yourTurn(prevActive, view, options)
	if view == nil or view.gameOver == true or options == nil or options.muteTurnBanner == true then
		return false
	end
	return view.activePlayer == view.you and prevActive ~= nil and prevActive ~= view.you and M.humans(view) > 1
end

-- a banner location must be a whole tile on the map
function M.hasLoc(loc, map)
	return loc ~= nil and type(loc.x) == "number" and type(loc.y) == "number"
		and loc.x == math.floor(loc.x) and loc.y == math.floor(loc.y)
		and (map == nil or (loc.x >= 0 and loc.y >= 0 and loc.x < map.width and loc.y < map.height))
end

return M
