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
-- river banks (T3 remainder): the same rim where low land meets a river tile,
-- narrower and in damp earth instead of sand
M.BANK = Color3 ~= nil and Color3.fromRGB(122, 104, 72) or nil
M.BANK_DEPTH = 0.09

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
			out[#out + 1] = { dx = d[1], dy = d[2], kind = "sand" }
		elseif n ~= nil and n.t == "river" then
			out[#out + 1] = { dx = d[1], dy = d[2], kind = "bank" }
		end
	end
	return out
end

function M.keyOf(map, x, y, look)
	local t = map.tiles[y * map.width + x + 1]
	local parts = { t.t, tostring(t.visible), look }
	for _, d in ipairs(DIRS) do
		local n = neighbour(map, x, y, d)
		parts[#parts + 1] = (n ~= nil and n.t == "ocean") and "o" or (n ~= nil and n.t == "river") and "r" or "-"
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
				local dim = tile.visible ~= true and M.FOG_DIM or 1
				for _, e in ipairs(edges) do
					local bank = e.kind == "bank"
					local depth = TILE * (bank and M.BANK_DEPTH or M.DEPTH)
					local base = bank and M.BANK or M.SAND
					local color = Color3.new(base.R * dim, base.G * dim, base.B * dim)
					local p = Instance.new("Part")
					p.Anchored = true
					p.CanCollide = false
					p.CanQuery = false
					p.CanTouch = false
					p.CastShadow = false
					p.TopSurface = Enum.SurfaceType.Smooth
					p.BottomSurface = Enum.SurfaceType.Smooth
					p.Material = bank and Enum.Material.Ground or Enum.Material.Sand
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
