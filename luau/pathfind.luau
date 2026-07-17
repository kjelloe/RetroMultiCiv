-- A65 cost-aware GoTo: a real least-cost path over movement costs so roads
-- and rails are preferred exactly as much as they are cheaper (Civ 1: rail
-- between railed tiles is free, road between roaded tiles is 1/3, else the
-- terrain's move cost). PURE — (state, ruleset, unit, target, canEnter) in,
-- a point list out. TWIN of shared/pathfind.js (R14; the A65 done-note
-- assigns this port to the roblox-helper: client-consumer, NOT gated —
-- it only chooses which ordinary move commands the client issues, the
-- engine still validates each, so it is golden-safe by construction).
--
-- LEGALITY is INJECTED, never re-implemented here: `canEnter(x, y)` is the
-- same tile-entry verdict the client's move affordance uses (domain, fog —
-- unexplored is untraversable, enemy occupancy). Fog honesty falls out of
-- canEnter; GoTo already replans each turn as fog lifts.
--
-- COSTS are scaled by 3 so thirds stay integers: rail-to-rail 0, road-to-road
-- 1 (=1/3), else terrain.move * 3.

local DIR_KEYS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local DIR_VECS = {
	N = { 0, -1 }, NE = { 1, -1 }, E = { 1, 0 }, SE = { 1, 1 },
	S = { 0, 1 }, SW = { -1, 1 }, W = { -1, 0 }, NW = { -1, -1 },
}

local function stepCost(fromTile: any, toTile: any, ruleset: any): number
	if fromTile.railroad == true and toTile.railroad == true then
		return 0
	end
	if fromTile.road == true and toTile.road == true then
		return 1 -- 1/3 * 3
	end
	local terr = ruleset.terrain.terrains[toTile.t]
	return (if terr ~= nil and terr.move ~= nil then terr.move else 1) * 3
end

-- Returns { points = {{x,y}, ...} from the unit through the target, cost } or
-- nil when the target is unreachable through explored, legal tiles.
local function findPath(state: any, ruleset: any, unit: any, target: any, canEnter: any): any
	local map = state.map
	local W, H = map.width, map.height
	if target.x < 0 or target.x >= W or target.y < 0 or target.y >= H then
		return nil
	end
	if not canEnter(target.x, target.y) then
		return nil -- fog / enemy / bad domain
	end
	local startIdx = unit.y * W + unit.x
	local goalIdx = target.y * W + target.x
	if startIdx == goalIdx then
		return { points = { { x = unit.x, y = unit.y } }, cost = 0 }
	end

	local dist = {}
	dist[startIdx] = 0
	local prev = {}
	local visited = {}
	local open = { { idx = startIdx, x = unit.x, y = unit.y, cost = 0 } }
	local expansions = 0
	local CAP = 8000 -- bound the worst case; GoTo distances are modest

	while #open > 0 and expansions < CAP do
		-- extract-min by linear scan; deterministic tie-break on tile index so
		-- equal-cost routes are stable (visual, not hashed — but stable is nice)
		local mi = 1
		for i = 2, #open do
			if open[i].cost < open[mi].cost
				or (open[i].cost == open[mi].cost and open[i].idx < open[mi].idx) then
				mi = i
			end
		end
		local cur = table.remove(open, mi)
		if visited[cur.idx] ~= true then
			visited[cur.idx] = true
			expansions = expansions + 1
			if cur.idx == goalIdx then
				break
			end
			local fromTile = map.tiles[cur.idx + 1]
			for _, key in ipairs(DIR_KEYS) do
				local v = DIR_VECS[key]
				local nx = cur.x + v[1]
				if map.wrapX == true then
					nx = ((nx % W) + W) % W
				end
				local ny = cur.y + v[2]
				if nx >= 0 and nx < W and ny >= 0 and ny < H then
					local nIdx = ny * W + nx
					if visited[nIdx] ~= true and canEnter(nx, ny) then
						local nd = cur.cost + stepCost(fromTile, map.tiles[nIdx + 1], ruleset)
						if dist[nIdx] == nil or nd < dist[nIdx] then
							dist[nIdx] = nd
							prev[nIdx] = { x = cur.x, y = cur.y }
							table.insert(open, { idx = nIdx, x = nx, y = ny, cost = nd })
						end
					end
				end
			end
		end
	end

	if dist[goalIdx] == nil then
		return nil -- boxed in / out of budget
	end
	local points = {}
	local cx, cy, guard = target.x, target.y, W * H
	while guard > 0 do
		guard = guard - 1
		table.insert(points, 1, { x = cx, y = cy })
		if cx == unit.x and cy == unit.y then
			break
		end
		local p = prev[cy * W + cx]
		if p == nil then
			return nil
		end
		cx = p.x
		cy = p.y
	end
	return { points = points, cost = dist[goalIdx] }
end

return {
	findPath = findPath,
}
