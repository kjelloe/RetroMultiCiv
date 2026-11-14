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

-- the cache key for tile (x,y): everything edges() and the wedge look read
function M.keyOf(map, x, y, look)
	local t = map.tiles[y * map.width + x + 1]
	local parts = { t.t, tostring(t.visible), look }
	for _, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		parts[#parts + 1] = n ~= nil and n.t or "-"
	end
	return table.concat(parts, "|")
end

local shown = {} -- [tile index] = key
local models = {} -- [tile index] = Model holding that tile's wedges

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
					local run = math.min(TILE * M.MAX_RUN, e.drop * M.RUN_PER_DROP)
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
				model.Parent = folder
				models[i] = model
			end
		end
	end
end

return M
