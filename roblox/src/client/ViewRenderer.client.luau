-- R4: renders the VIEW (roblox/SPEC.md §3e) — the R2 static scene's live
-- successor. Input is always ClientState.view (filterView output): unknown
-- tiles render as the void palette, explored-but-not-visible tiles render
-- dimmed, and units/cities exist only if the view carries them. Render-only:
-- no randomness, shade picks stay position-hashed (screenshot-stable).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local TerrainPalette = require(ReplicatedStorage:WaitForChild("GameData"):WaitForChild("TerrainPalette"))

local TILE = ClientState.TILE
local HEIGHT = 6 -- studs per 1.0 of TERRAIN base height
local BASIN = 2 -- studs below zero every tile column extends
local DIM = 0.55 -- explored-but-fogged tiles darken toward black by this factor

local world = Instance.new("Folder")
world.Name = "ClientWorld"
local terrainFolder = Instance.new("Folder")
terrainFolder.Name = "Terrain"
terrainFolder.Parent = world
local unitsFolder = Instance.new("Folder")
unitsFolder.Name = "Units"
unitsFolder.Parent = world
local citiesFolder = Instance.new("Folder")
citiesFolder.Name = "Cities"
citiesFolder.Parent = world
world.Parent = workspace

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
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

local function specFor(id)
	return TerrainPalette[id] or TerrainPalette.grassland
end

local function tileTop(id)
	local spec = specFor(id)
	return (spec.base + spec.peak * 0.5) * HEIGHT
end

-- terrain parts persist and mutate in place (no 1000-part churn per push);
-- cache what each index last showed so only changes touch instances
local tileParts = {}
local tileShown = {} -- [i] = "t|visible"

local function renderTerrain(view)
	local map = view.map
	for i, tile in ipairs(map.tiles) do
		local key = tile.t .. "|" .. tostring(tile.visible)
		if tileShown[i] ~= key then
			tileShown[i] = key
			local x = (i - 1) % map.width
			local y = math.floor((i - 1) / map.width)
			local spec = specFor(tile.t)
			local top = tileTop(tile.t)
			local shade = spec.palette[(x * 7 + y * 13) % #spec.palette + 1]
			if tile.t ~= "unknown" and tile.visible ~= true then
				shade = shade:Lerp(Color3.new(0, 0, 0), DIM)
			end
			local part = tileParts[i]
			if part == nil then
				part = block(terrainFolder, ("Tile_%d_%d"):format(x, y),
					Vector3.new(TILE, top + BASIN, TILE),
					Vector3.new(x * TILE, (top - BASIN) / 2, y * TILE), shade)
				tileParts[i] = part
			else
				part.Size = Vector3.new(TILE, top + BASIN, TILE)
				part.Position = Vector3.new(x * TILE, (top - BASIN) / 2, y * TILE)
				part.Color = shade
			end
		end
	end
end

local function renderUnits(view)
	unitsFolder:ClearAllChildren()
	for id, u in pairs(view.units) do
		local model = Instance.new("Model")
		model.Name = id .. "_" .. u.type
		local top = tileTop(view.map.tiles[u.y * view.map.width + u.x + 1].t)
		local cx, cz = u.x * TILE, u.y * TILE
		local ownerColor = hexColor(view.players[u.owner].color)

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
			block(model, "Body", Vector3.new(2.0, 0.9, 1.2),
				Vector3.new(cx, top + 0.75, cz), Color3.fromRGB(150, 111, 51))
			block(model, "Canopy", Vector3.new(1.4, 0.6, 1.0),
				Vector3.new(cx, top + 1.5, cz), Color3.fromRGB(222, 214, 190))
		else
			block(model, "Body", Vector3.new(0.9, 1.6, 0.9),
				Vector3.new(cx, top + 1.1, cz), Color3.fromRGB(120, 120, 126))
			block(model, "Head", Vector3.new(0.6, 0.5, 0.6),
				Vector3.new(cx, top + 2.15, cz), Color3.fromRGB(199, 172, 140))
		end
		if u.fortified == true then
			block(model, "Rampart", Vector3.new(TILE * 0.8, 0.4, TILE * 0.8),
				Vector3.new(cx, top + 0.45, cz), Color3.fromRGB(90, 90, 96), Enum.Material.Concrete)
		end
		model.Parent = unitsFolder
	end
end

local CITY_BLOCKS = { -- dx, dz, width, height — the R2 skyline, kept
	{ -1.0, -0.8, 1.1, 1.6 },
	{ 0.6, -0.6, 0.9, 2.4 },
	{ -0.4, 0.8, 1.3, 1.2 },
	{ 0.9, 0.9, 0.8, 1.8 },
}

local function renderCities(view)
	citiesFolder:ClearAllChildren()
	for id, c in pairs(view.cities) do
		local model = Instance.new("Model")
		model.Name = id .. "_" .. c.owner
		local top = tileTop(view.map.tiles[c.y * view.map.width + c.x + 1].t)
		local cx, cz = c.x * TILE, c.y * TILE

		local plaza = Instance.new("Part")
		plaza.Anchored = true
		plaza.Shape = Enum.PartType.Cylinder
		plaza.Name = "Plaza"
		plaza.Size = Vector3.new(0.3, TILE * 0.95, TILE * 0.95)
		plaza.CFrame = CFrame.new(cx, top + 0.15, cz) * CFrame.Angles(0, 0, math.rad(90))
		plaza.Color = hexColor(view.players[c.owner].color)
		plaza.Material = Enum.Material.SmoothPlastic
		plaza.Parent = model

		-- pop scales the skyline a little so growth is visible
		local scale = 1 + math.min(c.pop or 1, 8) * 0.08
		for i, b in ipairs(CITY_BLOCKS) do
			block(model, "Block" .. i, Vector3.new(b[3], b[4] * scale, b[3]),
				Vector3.new(cx + b[1], top + 0.3 + b[4] * scale / 2, cz + b[2]),
				Color3.fromRGB(214, 205, 188), Enum.Material.Concrete)
		end
		model.Parent = citiesFolder
	end
end

ClientState.onView(function(view)
	renderTerrain(view)
	renderUnits(view)
	renderCities(view)
end)

print("[ViewRenderer] R4 view renderer up: waiting for the first view push")
