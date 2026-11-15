-- Roblox-native look, phase T2 (specs/roblox-native-look.md): slope skirts.
-- Tile blocks meet at vertical walls; wherever a tile stands at least
-- MIN_STEP studs above an explored neighbour, a wedge leans against that wall
-- so the step reads as a slope. ENHANCED look only. edges() is the pure half
-- (lune-pinned by roblox/selftest/terrain-skirts.luau, check.sh gate 37);
-- update() builds/refreshes the wedges incrementally — a tile's skirts are
-- rebuilt only when its own key (its type, its four neighbours' types, its
-- fog state, the look) changes.

local M = {}

M.MIN_STEP = 1 -- studs; smaller steps (flat-to-flat palette jitter) stay walls
M.MAX_RUN = 0.3 -- of a tile: how far a skirt reaches onto the lower neighbour
M.RUN_PER_DROP = 0.7

local DIRS = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
M.DIRS = DIRS

local function neighbour(map, x, y, d)
	local nx, ny = x + d[1], y + d[2]
	if ny < 0 or ny >= map.height then
		return nil
	end
	if nx < 0 or nx >= map.width then
		if map.wrapX ~= true then
			return nil
		end
		nx = nx % map.width
	end
	return map.tiles[ny * map.width + nx + 1], nx, ny
end

-- the skirts tile (x,y) owns: one per orthogonal neighbour that is explored
-- and at least MIN_STEP lower. topOf(terrainId) -> studs.
function M.edges(map, x, y, topOf)
	local t = map.tiles[y * map.width + x + 1]
	local out = {}
	if t == nil or t.t == "unknown" then
		return out
	end
	local top = topOf(t.t)
	for i, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		if n ~= nil and n.t ~= "unknown" then
			local drop = top - topOf(n.t)
			if drop >= M.MIN_STEP then
				out[#out + 1] = { dir = i, dx = d[1], dy = d[2], drop = drop, low = top - drop }
			end
		end
	end
	return out
end

function M.runOf(drop, TILE)
	return math.min(TILE * M.MAX_RUN, drop * M.RUN_PER_DROP)
end

-- T2b corner fills (shot20: two skirts meeting at a tile corner left a
-- square notch). A tile owns a fill at corner (cx, cy) when it has a skirt
-- on BOTH sides of that corner and the diagonal tile is explored and at
-- least MIN_STEP lower. The fill stands on the diagonal tile: full height at
-- the tile's corner, falling to nothing over runX (the cx-side skirt's run)
-- and runY (the cy-side skirt's run).
local CORNERS = { { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } }
function M.corners(map, x, y, topOf)
	local out = {}
	local edges = M.edges(map, x, y, topOf)
	if #edges < 2 then
		return out
	end
	local dropOf = {}
	for _, e in ipairs(edges) do
		dropOf[e.dx .. "," .. e.dy] = e.drop
	end
	local top = topOf(map.tiles[y * map.width + x + 1].t)
	for _, c in ipairs(CORNERS) do
		local dropX, dropY = dropOf[c[1] .. ",0"], dropOf["0," .. c[2]]
		if dropX ~= nil and dropY ~= nil then
			local n = neighbour(map, x, y, c)
			if n ~= nil and n.t ~= "unknown" then
				local drop = top - topOf(n.t)
				if drop >= M.MIN_STEP then
					out[#out + 1] = { cx = c[1], cy = c[2], drop = drop, low = top - drop, dropX = dropX, dropY = dropY }
				end
			end
		end
	end
	return out
end

-- k quarter turns about Y, as CFrame.Angles(0, k * pi / 2, 0) moves a local
-- (x, z) offset: one turn sends (x, z) to (z, -x)
function M.quarterTurn(x, z, k)
	for _ = 1, k % 4 do
		x, z = z, -x
	end
	return x, z
end

-- how many quarter turns bring the part's own full-height corner (apexX,
-- apexZ: signs in the part's local space) to the wanted world corner
function M.turnsFor(apexX, apexZ, wantX, wantZ)
	for k = 0, 3 do
		local x, z = M.quarterTurn(apexX, apexZ, k)
		if x == wantX and z == wantZ then
			return k
		end
	end
	return nil
end

-- the cache key for tile (x,y): everything edges(), corners() and the wedge look read
function M.keyOf(map, x, y, look)
	local t = map.tiles[y * map.width + x + 1]
	local parts = { t.t, tostring(t.visible), look }
	for _, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		parts[#parts + 1] = n ~= nil and n.t or "-"
	end
	for _, c in ipairs(CORNERS) do
		local n = neighbour(map, x, y, c)
		parts[#parts + 1] = n ~= nil and n.t or "-"
	end
	return table.concat(parts, "|")
end

local shown = {} -- [tile index] = key
local models = {} -- [tile index] = Model holding that tile's wedges

-- Which local corner of a CornerWedgePart carries the full-height edge is
-- not stated in the engine reference, so it is MEASURED once: four rays
-- straight down onto a probe part, the highest hit names the corner. Until
-- that succeeds no fill is built (the notch stays, nothing wrong is drawn).
local apex = nil -- { x = +-1, z = +-1 }
local probeTries = 0
local function probeApex(folder)
	if apex ~= nil or probeTries >= 6 then
		return
	end
	probeTries += 1
	local Diag = require(script.Parent:WaitForChild("Diag"))
	local part = Instance.new("CornerWedgePart")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = true
	part.Transparency = 1
	part.Size = Vector3.new(4, 4, 4)
	part.CFrame = CFrame.new(0, -2000, 0)
	part.Parent = folder
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { part }
	local best, bestY, secondY = nil, -math.huge, -math.huge
	for _, c in ipairs(CORNERS) do
		local hit = workspace:Raycast(Vector3.new(c[1] * 1.6, -1990, c[2] * 1.6), Vector3.new(0, -20, 0), params)
		local hy = hit ~= nil and hit.Position.Y or -math.huge
		if hy > bestY then
			best, secondY, bestY = c, bestY, hy
		elseif hy > secondY then
			secondY = hy
		end
	end
	part:Destroy()
	if best ~= nil and bestY > -2002 and bestY - secondY > 1 then
		apex = { x = best[1], z = best[2] }
		Diag.note("terrain", ("corner wedge apex measured at local (%d, %d) on try %d"):format(apex.x, apex.z, probeTries))
	elseif probeTries >= 6 then
		Diag.fail("terrain", "corner wedge apex not measurable (slope corners stay notched)",
			("best %.2f second %.2f"):format(bestY, secondY))
	end
end

function M.reset(folder)
	shown = {}
	models = {}
	folder:ClearAllChildren()
end

-- tileParts[i] is the tile's block (its Color/Material already carry the fog
-- dim and the look); topOf as in edges().
function M.update(folder, view, tileParts, look, TILE, topOf)
	local map = view.map
	if look ~= "enhanced" then
		if next(shown) ~= nil then
			M.reset(folder)
		end
		return
	end
	if apex == nil then
		local ok = pcall(probeApex, folder)
		if ok and apex ~= nil and next(shown) ~= nil then
			M.reset(folder) -- tiles drawn before the measurement get their corners
		end
	end
	for i, tile in ipairs(map.tiles) do
		local x = (i - 1) % map.width
		local y = math.floor((i - 1) / map.width)
		local key = tile.t == "unknown" and "" or M.keyOf(map, x, y, look)
		if shown[i] ~= key then
			shown[i] = key
			if models[i] ~= nil then
				models[i]:Destroy()
				models[i] = nil
			end
			local block = tileParts[i]
			local edges = key ~= "" and block ~= nil and M.edges(map, x, y, topOf) or {}
			if #edges > 0 then
				local model = Instance.new("Model")
				model.Name = ("Skirt_%d_%d"):format(x, y)
				for _, e in ipairs(edges) do
					local run = M.runOf(e.drop, TILE)
					local w = Instance.new("WedgePart")
					w.Anchored = true
					w.CanCollide = false
					w.CanQuery = false
					w.CanTouch = false
					w.CastShadow = false
					w.TopSurface = Enum.SurfaceType.Smooth
					w.BottomSurface = Enum.SurfaceType.Smooth
					w.Size = Vector3.new(TILE, e.drop, run)
					w.Color = block.Color
					w.Material = block.Material
					-- a WedgePart's tall face is +Z and its ramp falls toward -Z
					-- (LookVector): face the ramp outward, back against the wall
					local out = Vector3.new(e.dx, 0, e.dy)
					local pos = Vector3.new(x * TILE, e.low + e.drop / 2, y * TILE) + out * (TILE / 2 + run / 2)
					w.CFrame = CFrame.lookAt(pos, pos + out)
					w.Parent = model
				end
				if apex ~= nil then
					for _, c in ipairs(M.corners(map, x, y, topOf)) do
						local runX, runZ = M.runOf(c.dropX, TILE), M.runOf(c.dropY, TILE)
						-- full height at the tile's corner = the fill's corner toward the tile
						local k = M.turnsFor(apex.x, apex.z, -c.cx, -c.cy)
						local w = Instance.new("CornerWedgePart")
						w.Name = "Corner"
						w.Anchored = true
						w.CanCollide = false
						w.CanQuery = false
						w.CanTouch = false
						w.CastShadow = false
						w.Color = block.Color
						w.Material = block.Material
						-- an odd turn swaps which local axis lies along world X
						w.Size = k % 2 == 0 and Vector3.new(runX, c.drop, runZ) or Vector3.new(runZ, c.drop, runX)
						w.CFrame = CFrame.new(x * TILE + c.cx * (TILE / 2 + runX / 2), c.low + c.drop / 2,
							y * TILE + c.cy * (TILE / 2 + runZ / 2)) * CFrame.Angles(0, k * math.pi / 2, 0)
						w.Parent = model
					end
				end
				model.Parent = folder
				models[i] = model
			end
		end
	end
end

return M
