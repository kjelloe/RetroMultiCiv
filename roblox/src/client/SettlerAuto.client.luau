-- CP20 settler AUTOMATION (ruling @6679e9c0; browser client/ui/automate.js
-- twin, CLIENT-SIDE like GoTo/sentry - the engine stays the sole arbiter,
-- every step is an ORDINARY move/startWork command, so it is golden-safe by
-- construction). An auto settler picks the nearest un-improved own-city tile
-- and drives itself there to road / mine / irrigate / railroad. Per-view
-- RE-CHECK (fog lifts, jobs vanish → re-plan); manual orders cancel it
-- (ClientState.send clears the flag); auto settlers sleep out of N/end-turn.
-- The view is ALREADY filterView output on Roblox, so no filter call here.

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local function wrapDx(map, ax, bx)
	local dx = bx - ax
	if map.wrapX then
		if dx > map.width / 2 then
			dx -= map.width
		end
		if dx < -map.width / 2 then
			dx += map.width
		end
	end
	return dx
end

local function dist(map, ax, ay, bx, by)
	return math.max(math.abs(wrapDx(map, ax, bx)), math.abs(by - ay))
end

local function tileAt(map, x, y)
	if y < 0 or y >= map.height then
		return nil
	end
	if x < 0 or x >= map.width then
		if not map.wrapX then
			return nil
		end
		x = ((x % map.width) + map.width) % map.width
	end
	return map.tiles[y * map.width + x + 1], x
end

-- nearest un-improved own-city working tile with a legal job (browser findJob:
-- road-first, then mine-vs-irrigate by yield, then railroad; fog never)
local function findJob(view, unit, rs)
	local map = view.map
	local me = view.players[view.you]
	local terrains = rs.terrain.terrains
	local knowsRail = me ~= nil and me.techs ~= nil
		and table.find(me.techs, rs.rules.railroadTech) ~= nil
	local knowsBridge = me ~= nil and me.techs ~= nil
		and table.find(me.techs, rs.rules.bridgeTech) ~= nil
	local best, bestD = nil, 9999
	for _, city in pairs(view.cities) do
		if city.owner == view.you and dist(map, unit.x, unit.y, city.x, city.y) <= 6 then
			for dy = -2, 2 do
				for dx = -2, 2 do
					local corner = math.abs(dx) == 2 and math.abs(dy) == 2
					if not corner and not (dx == 0 and dy == 0) then
						local tile, tx = tileAt(map, city.x + dx, city.y + dy)
						local ty = city.y + dy
						if tile ~= nil and tile.t ~= "unknown" then
							local terr = terrains[tile.t]
							if terr ~= nil and terr.domain == "land" then
								local blocked = false
								for _, oc in pairs(view.cities) do
									if oc.x == tx and oc.y == ty then
										blocked = true
									end
								end
								for _, e in pairs(view.units) do
									if e.owner ~= view.you and e.x == tx and e.y == ty then
										blocked = true
									end
								end
								if not blocked then
									-- water proximity for irrigation
									local water = tile.river == true
									if not water then
										for ny = -1, 1 do
											for nx = -1, 1 do
												if not (nx == 0 and ny == 0) then
													local nt = tileAt(map, tx + nx, ty + ny)
													if nt ~= nil and (nt.t == "ocean"
														or nt.river == true or nt.irrigation == true) then
														water = true
													end
												end
											end
										end
									end
									local improved = tile.irrigation == true or tile.mine == true
									local canIrrigate = not improved and terr.irrigate ~= nil and water
									local canMine = not improved and terr.mine ~= nil and tile.river ~= true
									local mineBetter = canMine and (not canIrrigate
										or terr.mine.shields > terr.irrigate.food)
									local canRail = knowsRail and tile.road == true and tile.railroad ~= true
									local roadNeedsBridge = tile.river == true and not knowsBridge
									local work = nil
									if tile.road ~= true and not roadNeedsBridge then
										work = "road"
									elseif mineBetter then
										work = "mine"
									elseif canIrrigate then
										work = "irrigate"
									elseif canRail then
										work = "railroad"
									end
									if work ~= nil then
										local dd = dist(map, unit.x, unit.y, tx, ty)
										if dd < bestD then
											bestD = dd
											best = { x = tx, y = ty, work = work }
										end
									end
								end
							end
						end
					end
				end
			end
		end
	end
	return best
end

local function stepDir(map, unit, tx, ty)
	local dx = wrapDx(map, unit.x, tx)
	dx = dx > 0 and 1 or (dx < 0 and -1 or 0)
	local dy = ty > unit.y and 1 or (ty < unit.y and -1 or 0)
	local ns = dy == -1 and "N" or (dy == 1 and "S" or "")
	local ew = dx == 1 and "E" or (dx == -1 and "W" or "")
	local name = ns .. ew
	return name ~= "" and name or nil
end

-- drive one step per auto settler per view push (per-unit turn re-check; the
-- engine arbitrates every command, a rejection just retires that unit's step)
local function drive(view)
	if view.activePlayer ~= view.you or ClientState.gameOver then
		return
	end
	local rs = ClientState.rulesets()
	ClientState.autoDriving = true
	for id in pairs(ClientState.autoSettlers) do
		local u = view.units[id]
		if u == nil or u.owner ~= view.you or u.type ~= "settlers" then
			ClientState.autoSettlers[id] = nil -- gone / not a settler anymore
		elseif u.moves > 0 and u.working == nil then
			local job = findJob(view, u, rs)
			if job ~= nil then
				if u.x == job.x and u.y == job.y then
					print(("[SettlerAuto] %s starts %s at (%d,%d)"):format(id, job.work, job.x, job.y))
					ClientState.send({ type = "startWork", unitId = id, work = job.work })
				else
					local dir = stepDir(view.map, u, job.x, job.y)
					if dir ~= nil then
						ClientState.send({ type = "moveUnit", unitId = id, dir = dir })
					end
				end
			end
		end
	end
	ClientState.autoDriving = false
end

ClientState.onView(drive)

print("[SettlerAuto] CP20 settler automation up (Au card toggle; manual order cancels)")
