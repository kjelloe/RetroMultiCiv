-- R4: renders the VIEW (roblox/SPEC.md §3e) — the R2 static scene's live
-- successor. Input is always ClientState.view (filterView output): unknown
-- tiles render as the void palette, explored-but-not-visible tiles render
-- dimmed, and units/cities exist only if the view carries them. Render-only:
-- no randomness, shade picks stay position-hashed (screenshot-stable).
-- R7b (8): per-unit billboard (name + att/def + move pips) — fog-respecting
-- by construction (rivals are only ever in the view while visible, and the
-- stats shown are ruleset facts by type + the view's own moves field).
-- R7b (10): own settlers carry a site line — legality via the read-only
-- luau ai.goodCitySpot on a view shim (fog-approximate like move hints),
-- stars are a PRESENTATIONAL heuristic (documented in SPEC §3i).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))
local TerrainPalette = require(ReplicatedStorage:WaitForChild("GameData"):WaitForChild("TerrainPalette"))
local aiModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("ai"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

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
local tileShown = {} -- [i] = "t|visible|look"

-- Visual-fidelity workstream (#1100): the ENHANCED look is a PRESENTATION
-- LAYER only — per-terrain built-in materials over the SAME shared palette
-- colors and recipe geometry (the source stays unforked; the browser is
-- WebGL1-locked to flat, Roblox is not). options.look = "retro"|"enhanced";
-- the soundboard pattern: both looks live, the user picks by screenshot.
local ENHANCED_MATERIAL = {
	grassland = Enum.Material.Grass, plains = Enum.Material.Grass,
	forest = Enum.Material.LeafyGrass, jungle = Enum.Material.LeafyGrass,
	desert = Enum.Material.Sand, hills = Enum.Material.Ground,
	mountains = Enum.Material.Slate, tundra = Enum.Material.Ground,
	arctic = Enum.Material.Snow, swamp = Enum.Material.Mud,
	ocean = Enum.Material.Glass, river = Enum.Material.Glass,
}

local function lookOf()
	return ClientState.options.look == "enhanced" and "enhanced" or "retro"
end

local function renderTerrain(view)
	local map = view.map
	local look = lookOf()
	for i, tile in ipairs(map.tiles) do
		local key = tile.t .. "|" .. tostring(tile.visible) .. "|" .. look
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
			if look == "enhanced" then
				part.Material = ENHANCED_MATERIAL[tile.t] or Enum.Material.SmoothPlastic
				part.Transparency = (tile.t == "ocean" and tile.visible == true) and 0.15 or 0
			else
				part.Material = Enum.Material.SmoothPlastic
				part.Transparency = 0
			end
		end
	end
end

-- (the look-change watcher lives at the file bottom — it needs renderCities
-- in scope, which is defined below)

-- (10) site stars, own settlers only. Legality is the engine's own
-- goodCitySpot (read-only require, view shim). Stars on a legal spot are
-- display-only: 1 base, +1 for a strong center tile (grassland/plains/
-- river), +1 when 3+ neighbors are strong too.
local STRONG = { grassland = true, plains = true }
local function siteLine(view, u)
	local shim = { map = view.map, cityOrder = view.cityOrder, cities = view.cities }
	local ok, legal = pcall(aiModule.goodCitySpot, shim, u, ClientState.rulesets())
	if not ok or legal ~= true then
		return "site: x"
	end
	local map = view.map
	local center = map.tiles[u.y * map.width + u.x + 1]
	local stars = 1
	if STRONG[center.t] == true or center.river == true then
		stars += 1
	end
	local strongNear = 0
	for dy = -1, 1 do
		for dx = -1, 1 do
			if dx ~= 0 or dy ~= 0 then
				local nx, ny = u.x + dx, u.y + dy
				if map.wrapX then
					nx = nx % map.width
				end
				if nx >= 0 and nx < map.width and ny >= 0 and ny < map.height then
					local t = map.tiles[ny * map.width + nx + 1]
					if STRONG[t.t] == true or t.river == true then
						strongNear += 1
					end
				end
			end
		end
	end
	if strongNear >= 3 then
		stars += 1
	end
	return "site: " .. string.rep("*", stars)
end

-- (8) the unit billboard: "<Name> a/d" + move pips (own settlers add the
-- site line). Adornee'd to the base disc so it rides the model.
local function unitBillboard(model, adornee, view, u)
	local def = ClientState.rulesets().units[u.type] or {}
	local mine = u.owner == view.you
	local lines = { ("%s %d/%d"):format(def.name or u.type, def.attack or 0, def.defense or 0) }
	if u.moves ~= nil and u.moves > 0 then
		table.insert(lines, string.rep("|", math.min(u.moves, 9)))
	else
		table.insert(lines, "-")
	end
	if mine and u.type == "settlers" then
		table.insert(lines, siteLine(view, u))
	end
	-- R12 (3): 2x size, bold, wider face (SourceSansBold vs the old Code 11)
	local bb = Instance.new("BillboardGui")
	bb.Name = "Label"
	bb.Adornee = adornee
	bb.Size = UDim2.new(0, 200, 0, 24 * #lines)
	bb.StudsOffset = Vector3.new(0, 3.6 + #lines * 0.6, 0)
	bb.MaxDistance = 180
	local text = Instance.new("TextLabel")
	text.Size = UDim2.new(1, 0, 1, 0)
	text.BackgroundTransparency = 1
	text.TextColor3 = mine and Color3.fromRGB(235, 235, 235) or Color3.fromRGB(240, 190, 180)
	text.TextStrokeTransparency = 0.4
	text.Font = Enum.Font.SourceSansBold
	text.TextSize = 22
	text.Text = table.concat(lines, "\n")
	text.Parent = bb
	bb.Parent = model
end

-- R12 (4): always-on city billboard — name + pop + production + turns left.
-- Fog-honest by construction: every line reads the view's own city fields
-- (rival cities carry whatever filterView granted, and lines simply drop
-- when a field is absent); turns-left is presentational math via the
-- read-only cities.cityYields on a view shim, pcall'd (own cities have
-- their whole radius explored; anything less just omits the estimate).
local function cityBillboard(model, adornee, view, c)
	local mine = c.owner == view.you
	local rs = ClientState.rulesets()
	local lines = { ("%s  (pop %d)"):format(c.name or "city", c.pop or 1) }
	if c.disorder == true then -- A68 parity: the disorder banner
		table.insert(lines, '<font color="#ff8878"><b>CIVIL DISORDER</b></font>')
	end
	if c.producing ~= nil then
		local def = (rs[c.producing.kind .. "s"] or {})[c.producing.id]
		local cost = def and def.cost or 0
		local turns = ""
		local shim = { map = view.map, cities = view.cities, cityOrder = view.cityOrder,
			units = view.units, players = view.players, wonders = view.wonders }
		local ok, y = pcall(citiesModule.cityYields, shim, c, rs)
		if ok and y ~= nil and (y.shields or 0) > 0 then
			turns = (" ~%d t"):format(math.ceil(math.max(0, cost - (c.shields or 0)) / y.shields))
		end
		table.insert(lines, ("%s %d/%d%s"):format(def and def.name or c.producing.id,
			c.shields or 0, cost, turns))
	end
	local bb = Instance.new("BillboardGui")
	bb.Name = "CityLabel"
	bb.Adornee = adornee
	bb.Size = UDim2.new(0, 220, 0, 24 * #lines)
	bb.StudsOffset = Vector3.new(0, 4.5, 0)
	bb.MaxDistance = 240
	local text = Instance.new("TextLabel")
	text.Size = UDim2.new(1, 0, 1, 0)
	text.BackgroundTransparency = 1
	text.RichText = true -- the A68 disorder banner uses a color tag
	text.TextColor3 = mine and Color3.fromRGB(235, 235, 235) or Color3.fromRGB(240, 190, 180)
	text.TextStrokeTransparency = 0.3
	text.Font = Enum.Font.SourceSansBold
	text.TextSize = 20
	text.Text = table.concat(lines, "\n")
	text.Parent = bb
	bb.Parent = model
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

		-- R8: the body is DATA — the same recipe table the browser renders;
		-- primary/secondary are the color-role slots (A88 contract). Faction
		-- identity stays procedural on top (disc, rampart, billboard).
		local built = pcall(AssetFactory.buildUnit, model, u.type,
			{ primary = ownerColor, secondary = ownerColor:Lerp(Color3.new(1, 1, 1), 0.35) },
			CFrame.new(cx, top + 0.1, cz))
		if not built then -- recipes gate failed or bad recipe: old placeholder
			block(model, "Body", Vector3.new(0.9, 1.6, 0.9),
				Vector3.new(cx, top + 1.1, cz), Color3.fromRGB(120, 120, 126))
			block(model, "Head", Vector3.new(0.6, 0.5, 0.6),
				Vector3.new(cx, top + 2.15, cz), Color3.fromRGB(199, 172, 140))
		end
		if u.fortified == true then
			block(model, "Rampart", Vector3.new(TILE * 0.8, 0.4, TILE * 0.8),
				Vector3.new(cx, top + 0.45, cz), Color3.fromRGB(90, 90, 96), Enum.Material.Concrete)
		end
		unitBillboard(model, disc, view, u)
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

		-- pop scales the skyline a little so growth is visible; the enhanced
		-- look upgrades the materials (Brick skyline on a Marble plaza)
		local enhanced = lookOf() == "enhanced"
		if enhanced then
			plaza.Material = Enum.Material.Marble
		end
		local scale = 1 + math.min(c.pop or 1, 8) * 0.08
		for i, b in ipairs(CITY_BLOCKS) do
			block(model, "Block" .. i, Vector3.new(b[3], b[4] * scale, b[3]),
				Vector3.new(cx + b[1], top + 0.3 + b[4] * scale / 2, cz + b[2]),
				Color3.fromRGB(214, 205, 188),
				enhanced and Enum.Material.Brick or Enum.Material.Concrete)
		end
		cityBillboard(model, plaza, view, c)
		model.Parent = citiesFolder
	end
end

-- session-E round 15 (user): DANGER overlay — any visible enemy unit standing
-- adjacent (king-move) to an own city or own unit gets a transparent red
-- quad on its tile. Pure view read; fog is respected by construction (only
-- units the filter shows can threaten).
local dangerFolder = Instance.new("Folder")
dangerFolder.Name = "DangerTiles"
dangerFolder.Parent = world

local function adjacentWrap(map, ax, ay, bx, by)
	local dx = math.abs(ax - bx)
	if map.wrapX then
		dx = math.min(dx, map.width - dx)
	end
	return dx <= 1 and math.abs(ay - by) <= 1
end

local function renderDanger(view)
	dangerFolder:ClearAllChildren()
	local own = {} -- own units + cities, the assets a neighbor can threaten
	for _, u in pairs(view.units) do
		if u.owner == view.you then
			table.insert(own, u)
		end
	end
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			table.insert(own, c)
		end
	end
	local marked = {}
	for _, u in pairs(view.units) do
		if u.owner ~= view.you then
			local key = u.y * view.map.width + u.x
			if marked[key] == nil then
				for _, a in ipairs(own) do
					if adjacentWrap(view.map, u.x, u.y, a.x, a.y) then
						marked[key] = true
						local quad = Instance.new("Part")
						quad.Anchored = true
						quad.CanCollide = false
						quad.CanQuery = false
						quad.Size = Vector3.new(TILE * 0.95, 0.15, TILE * 0.95)
						quad.CFrame = CFrame.new(u.x * TILE,
							tileTop(view.map.tiles[u.y * view.map.width + u.x + 1].t) + 0.35,
							u.y * TILE)
						quad.Color = Color3.fromRGB(220, 50, 40)
						quad.Material = Enum.Material.Neon
						quad.Transparency = 0.65
						quad.Parent = dangerFolder
						break
					end
				end
			end
		end
	end
end

ClientState.onView(function(view)
	renderTerrain(view)
	renderUnits(view)
	renderCities(view)
	renderDanger(view)
end)

-- R20: the enhanced look owns a subtle Atmosphere (depth haze) — removed
-- cleanly in retro; procedural, no assets
local Lighting = game:GetService("Lighting")
local atmosphere = Instance.new("Atmosphere")
atmosphere.Density = 0.28
atmosphere.Offset = 0.2
atmosphere.Haze = 1.4
atmosphere.Color = Color3.fromRGB(215, 225, 240)

local function applyLookExtras(look)
	atmosphere.Parent = look == "enhanced" and Lighting or nil
end
applyLookExtras(lookOf())

-- a look change repaints terrain + cities + units on the next frame
local lastLook = nil
game:GetService("RunService").Heartbeat:Connect(function()
	local look = lookOf()
	if lastLook ~= nil and look ~= lastLook and ClientState.view ~= nil then
		renderTerrain(ClientState.view)
		renderCities(ClientState.view)
		renderUnits(ClientState.view) -- unit materials come from AssetFactory's look map
		applyLookExtras(look)
	end
	lastLook = look
end)

print("[ViewRenderer] R4 view renderer up: waiting for the first view push")
