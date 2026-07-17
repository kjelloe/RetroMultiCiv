-- R14: the ONE tile-entry verdict (the A65 lesson: affordance + planner
-- share one source, never two implementations). MoveHints' green/red and
-- GoTo's canEnter both read here. PURE view math: known tile (fog!), domain
-- match, enemy occupancy — never cost/ZOC (those stay the engine's verdict
-- at command time). Mirrors client/ui/move-hints.js tileEnterable.

local M = {}

-- wrap-normalized x, or nil when off-map
function M.norm(map, x, y)
	if map.wrapX then
		x = x % map.width
	end
	if x < 0 or x >= map.width or y < 0 or y >= map.height then
		return nil
	end
	return x
end

-- known + walkable for the domain (enemy question handled separately)
function M.terrainOk(view, rs, domain, x, y)
	local nx = M.norm(view.map, x, y)
	if nx == nil then
		return false, nil
	end
	local tile = view.map.tiles[y * view.map.width + nx + 1]
	local terr = tile ~= nil and rs.terrain.terrains[tile.t]
	return terr ~= nil and terr.domain == domain, nx
end

function M.enemyAt(view, x, y)
	for _, u in pairs(view.units) do
		if u.x == x and u.y == y and u.owner ~= view.you then
			return true
		end
	end
	return false
end

-- the GoTo planner's injected legality: traversable = known + domain + free
function M.canEnter(view, rs, domain, x, y)
	local ok, nx = M.terrainOk(view, rs, domain, x, y)
	return ok and not M.enemyAt(view, nx, y)
end

-- runD: the mounted-step gate — an attempt is WORTH SENDING unless the view
-- KNOWS it is hopeless. Unknown tiles pass (Civ 1 explores into fog; the
-- engine judges the real terrain); enemy tiles pass (attacks); only a
-- known-wrong-domain tile is a guaranteed reject. Returns ok, reason.
function M.canAttempt(view, rs, domain, x, y)
	local nx = M.norm(view.map, x, y)
	if nx == nil then
		return false, "edge of the map"
	end
	local tile = view.map.tiles[y * view.map.width + nx + 1]
	if tile == nil or tile.t == "unknown" then
		return true, nil -- fog: the engine decides
	end
	local terr = rs.terrain.terrains[tile.t]
	if terr ~= nil and terr.domain ~= domain then
		return false, tile.t -- known impassable for this unit
	end
	return true, nil
end

return M
