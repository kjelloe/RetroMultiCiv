-- Roblox-native look, phase T3 (specs/roblox-native-look.md): sand coasts.
-- Where low land meets explored ocean, a thin sand rim lies along that edge
-- of the LAND tile, so the order outward reads land -> sand -> foam (the
-- TileProps foam strip on the ocean tile) -> water. ENHANCED look only.
-- edges() is the pure half (lune-pinned by roblox/selftest/terrain-coast.luau,
-- check.sh gate 41); update() is incremental per tile like TerrainSkirts.

local M = {}

M.DEPTH = 0.14 -- of a tile: how far the rim reaches in from the edge
M.THICK = 0.06 -- studs
M.LIFT = 0.04 -- studs the rim's top stands above the land block (no z-fight)
M.SAND = Color3 ~= nil and Color3.fromRGB(216, 198, 144) or nil
M.FOG_DIM = 0.55

-- land that gets no beach: cliffs and ice (and water itself)
M.NO_BEACH = { ocean = true, unknown = true, hills = true, mountains = true, arctic = true, river = true }

local DIRS = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }

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
	return map.tiles[ny * map.width + nx + 1]
end

-- the rims tile (x,y) owns: one per orthogonal neighbour that is ocean
function M.edges(map, x, y)
	local t = map.tiles[y * map.width + x + 1]
	local out = {}
	if t == nil or M.NO_BEACH[t.t] == true then
		return out
	end
	for _, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		if n ~= nil and n.t == "ocean" then
			out[#out + 1] = { dx = d[1], dy = d[2] }
		end
	end
	return out
end

function M.keyOf(map, x, y, look)
	local t = map.tiles[y * map.width + x + 1]
	local parts = { t.t, tostring(t.visible), look }
	for _, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		parts[#parts + 1] = (n ~= nil and n.t == "ocean") and "o" or "-"
	end
	return table.concat(parts, "|")
end

local shown = {}
local models = {}

function M.reset(folder)
	shown = {}
	models = {}
	folder:ClearAllChildren()
end

function M.count()
	local n = 0
	for _ in pairs(models) do
		n += 1
	end
	return n
end

-- tileParts[i] is the tile's block; the rim sits on its real top face
function M.update(folder, view, tileParts, look, TILE)
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
		local key = M.NO_BEACH[tile.t] == true and "" or M.keyOf(map, x, y, look)
		if shown[i] ~= key then
			shown[i] = key
			if models[i] ~= nil then
				models[i]:Destroy()
				models[i] = nil
			end
			local block = tileParts[i]
			local edges = key ~= "" and block ~= nil and M.edges(map, x, y) or {}
			if #edges > 0 then
				local model = Instance.new("Model")
				model.Name = ("Coast_%d_%d"):format(x, y)
				local top = block.Position.Y + block.Size.Y / 2
				local depth = TILE * M.DEPTH
				local color = M.SAND
				if tile.visible ~= true then
					color = Color3.new(color.R * M.FOG_DIM, color.G * M.FOG_DIM, color.B * M.FOG_DIM)
				end
				for _, e in ipairs(edges) do
					local p = Instance.new("Part")
					p.Anchored = true
					p.CanCollide = false
					p.CanQuery = false
					p.CanTouch = false
					p.CastShadow = false
					p.TopSurface = Enum.SurfaceType.Smooth
					p.BottomSurface = Enum.SurfaceType.Smooth
					p.Material = Enum.Material.Sand
					p.Color = color
					-- long axis along the shared edge
					p.Size = e.dx ~= 0 and Vector3.new(depth, M.THICK, TILE) or Vector3.new(TILE, M.THICK, depth)
					p.Position = Vector3.new(block.Position.X, top + M.LIFT - M.THICK / 2, block.Position.Z)
						+ Vector3.new(e.dx, 0, e.dy) * (TILE / 2 - depth / 2)
					p.Parent = model
				end
				model.Parent = folder
				models[i] = model
			end
		end
	end
end

return M
