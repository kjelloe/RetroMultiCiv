-- R2: static Parts world from the baked mock state (roblox/SPEC.md).
-- Render-only — no engine calls, no randomness: palette shade picks are
-- position-hashed so the scene is identical every run (screenshot-stable,
-- same discipline as the JS renderer's REST POSE).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local gameData = ReplicatedStorage:WaitForChild("GameData")
local MockState = require(gameData:WaitForChild("MockState"))
local TerrainPalette = require(gameData:WaitForChild("TerrainPalette"))

local TILE = 4 -- studs per tile edge
local HEIGHT = 6 -- studs per 1.0 of TERRAIN base height
local BASIN = 2 -- studs below zero every tile column extends (solid seabed)

local map = MockState.map

-- x/y are the STORED 0-based tile coords (docs/09 trap 1): arithmetic stays
-- JS-shaped, only the tiles{} access adds the +1.
local function terrainAt(x, y)
	return map.tiles[y * map.width + x + 1]
end

local function specAt(x, y)
	return TerrainPalette[terrainAt(x, y)] or TerrainPalette.grassland
end

local function tileTop(x, y)
	local spec = specAt(x, y)
	return (spec.base + spec.peak * 0.5) * HEIGHT
end

local function block(parent, name, size, position, color, material)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Name = name
	part.Size = size
	part.Position = position
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.Parent = parent
	return part
end

local world = Instance.new("Folder")
world.Name = "World"

-- terrain: one column per tile, top at the palette height, shade hashed
-- from the tile position (deterministic, mirrors the 3-shade facet idea)
local terrainFolder = Instance.new("Folder")
terrainFolder.Name = "Terrain"
terrainFolder.Parent = world
for y = 0, map.height - 1 do
	for x = 0, map.width - 1 do
		local id = terrainAt(x, y)
		local spec = TerrainPalette[id] or TerrainPalette.grassland
		local top = tileTop(x, y)
		local shade = spec.palette[(x * 7 + y * 13) % #spec.palette + 1]
		-- ocean stays SmoothPlastic: Glass washes out to grey on low
		-- graphics settings (R2 screenshot finding), losing the sea read
		block(terrainFolder, ("Tile_%d_%d"):format(x, y),
			Vector3.new(TILE, top + BASIN, TILE),
			Vector3.new(x * TILE, (top - BASIN) / 2, y * TILE),
			shade)
	end
end

-- units: owner-colored base disc + a type-shaped body on top
local unitsFolder = Instance.new("Folder")
unitsFolder.Name = "Units"
unitsFolder.Parent = world
for _, u in ipairs(MockState.units) do
	local model = Instance.new("Model")
	model.Name = u.id .. "_" .. u.type
	local top = tileTop(u.x, u.y)
	local cx, cz = u.x * TILE, u.y * TILE
	local ownerColor = MockState.players[u.owner].color

	local disc = Instance.new("Part")
	disc.Anchored = true
	disc.Shape = Enum.PartType.Cylinder
	disc.Name = "BaseDisc"
	disc.Size = Vector3.new(0.3, TILE * 0.7, TILE * 0.7)
	disc.CFrame = CFrame.new(cx, top + 0.15, cz) * CFrame.Angles(0, 0, math.rad(90))
	disc.Color = ownerColor
	disc.Material = Enum.Material.SmoothPlastic
	disc.Parent = model

	if u.type == "settlers" then
		-- wagon: low wide body + canopy (assets.js silhouette, simplified)
		block(model, "Body", Vector3.new(2.0, 0.9, 1.2),
			Vector3.new(cx, top + 0.75, cz), Color3.fromRGB(150, 111, 51))
		block(model, "Canopy", Vector3.new(1.4, 0.6, 1.0),
			Vector3.new(cx, top + 1.5, cz), Color3.fromRGB(222, 214, 190))
	else
		-- foot unit: upright body + head block
		block(model, "Body", Vector3.new(0.9, 1.6, 0.9),
			Vector3.new(cx, top + 1.1, cz), Color3.fromRGB(120, 120, 126))
		block(model, "Head", Vector3.new(0.6, 0.5, 0.6),
			Vector3.new(cx, top + 2.15, cz), Color3.fromRGB(199, 172, 140))
	end
	model.Parent = unitsFolder
end

-- cities: owner-colored plaza disc + a clustered skyline of blocks
local citiesFolder = Instance.new("Folder")
citiesFolder.Name = "Cities"
citiesFolder.Parent = world
local CITY_BLOCKS = { -- dx, dz (studs), width, height — a fixed little skyline
	{ -1.0, -0.8, 1.1, 1.6 },
	{ 0.6, -0.6, 0.9, 2.4 },
	{ -0.4, 0.8, 1.3, 1.2 },
	{ 0.9, 0.9, 0.8, 1.8 },
}
for _, c in ipairs(MockState.cities) do
	local model = Instance.new("Model")
	model.Name = c.id .. "_" .. c.owner
	local top = tileTop(c.x, c.y)
	local cx, cz = c.x * TILE, c.y * TILE
	local ownerColor = MockState.players[c.owner].color

	local plaza = Instance.new("Part")
	plaza.Anchored = true
	plaza.Shape = Enum.PartType.Cylinder
	plaza.Name = "Plaza"
	plaza.Size = Vector3.new(0.3, TILE * 0.95, TILE * 0.95)
	plaza.CFrame = CFrame.new(cx, top + 0.15, cz) * CFrame.Angles(0, 0, math.rad(90))
	plaza.Color = ownerColor
	plaza.Material = Enum.Material.SmoothPlastic
	plaza.Parent = model

	for i, b in ipairs(CITY_BLOCKS) do
		block(model, "Block" .. i, Vector3.new(b[3], b[4], b[3]),
			Vector3.new(cx + b[1], top + 0.3 + b[4] / 2, cz + b[2]),
			Color3.fromRGB(214, 205, 188), Enum.Material.Concrete)
	end
	model.Parent = citiesFolder
end

world.Parent = workspace
print(("[RenderWorld] R2 static scene: %dx%d tiles, %d units, %d cities")
	:format(map.width, map.height, #MockState.units, #MockState.cities))
