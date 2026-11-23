-- Draws the encyclopedia picture PediaArt resolved (specs/roblox-pedia-art.md
-- 2.5): a turning model in a ViewportFrame (unit, structure, terrain patch)
-- or a tech glyph on its era card. One picture at a time: show() destroys
-- the previous one. A drawing failure is a Diag.fail and an empty box.
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local PediaArt = require(script.Parent:WaitForChild("PediaArt"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))
local StructureModels = require(script.Parent:WaitForChild("StructureCatalog"))
local StructureBuilder = require(script.Parent:WaitForChild("StructureBuilder"))
local TileProps = require(script.Parent:WaitForChild("TileProps"))
local TileHeight = require(script.Parent:WaitForChild("TileHeight"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs"))
local EditableGlyph = require(script.Parent:WaitForChild("EditableGlyph"))
local GlyphData = require(script.Parent:WaitForChild("GlyphData"))
local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Diag = require(script.Parent:WaitForChild("Diag"))
local TerrainPalette = require(ReplicatedStorage:WaitForChild("GameData"):WaitForChild("TerrainPalette"))

local M = {}

function M.have()
	return { units = AssetFactory.data().unitSilhouette, structures = StructureModels.MODELS, emblems = StructureModels.EMBLEMS,
		glyphs = GlyphData.GLYPH, terrain = TerrainPalette }
end

local current = nil -- { root, conns }
function M.clear()
	if current ~= nil then
		for _, c in ipairs(current.conns) do
			c:Disconnect()
		end
		current.root:Destroy()
		current = nil
	end
end

local UNIT_COLORS = { primary = Color3.fromRGB(70, 120, 190), secondary = Color3.fromRGB(180, 205, 235) }

-- a ViewportFrame around `model` that turns slowly; drag turns it by hand
local function viewport(box, model, cam, conns)
	local vp = Instance.new("ViewportFrame")
	vp.Name = "Picture"
	vp.Size = UDim2.fromScale(1, 1)
	vp.BackgroundColor3 = Color3.fromRGB(18, 21, 29)
	vp.BorderSizePixel = 0
	vp.Active = true -- a drag turns the model instead of scrolling the pane
	vp.Ambient = Color3.fromRGB(150, 150, 156)
	vp.LightColor = Color3.fromRGB(255, 250, 240)
	vp.LightDirection = Vector3.new(0.4, -1, -0.6)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = vp
	model.Parent = vp
	local camera = Instance.new("Camera")
	camera.FieldOfView = 30
	camera.Parent = vp
	vp.CurrentCamera = camera

	local centre, size = model:GetBoundingBox()
	local radius = math.max(1, size.Magnitude / 2)
	local dist = radius * cam.fit
	local yaw, held, lastX = math.rad(cam.yaw), false, 0
	local function place()
		local pitch = math.rad(cam.pitch)
		local at = centre.Position
		local eye = at + Vector3.new(math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)) * dist
		camera.CFrame = CFrame.lookAt(eye, at)
	end
	place()
	conns[#conns + 1] = RunService.RenderStepped:Connect(function(dt)
		if not held then
			yaw += math.rad(cam.turn) * dt
		end
		place()
	end)
	conns[#conns + 1] = vp.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			held, lastX = true, input.Position.X
		end
	end)
	conns[#conns + 1] = UserInputService.InputChanged:Connect(function(input)
		if held and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			yaw -= (input.Position.X - lastX) * 0.012
			lastX = input.Position.X
		end
	end)
	conns[#conns + 1] = UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			held = false
		end
	end)
	vp.Parent = box
	return vp
end

local function drawUnit(box, art, conns)
	local model = Instance.new("Model")
	AssetFactory.buildUnit(model, art.id, UNIT_COLORS, CFrame.new())
	return viewport(box, model, PediaArt.CAMERA.unit, conns)
end

local function drawStructure(box, art, conns)
	local def = art.set ~= nil and StructureModels.EMBLEMS[art.set][art.id] or StructureModels.MODELS[art.id]
	local base = PediaArt.CAMERA.structure
	local model = Instance.new("Model")
	StructureBuilder.build(model, def, CFrame.new(), 1, art.tint)
	return viewport(box, model, { yaw = def.camera.yaw, pitch = def.camera.pitch, fit = base.fit, turn = base.turn }, conns)
end

local function drawTerrain(box, art, conns, rs)
	local def = rs.terrain.terrains[art.id]
	local map = PediaArt.terrainPatch(art.id, def ~= nil and def.special ~= nil)
	local TILE = ClientState.TILE
	local model = Instance.new("Model")
	local function top(id)
		return TileHeight.top(TerrainPalette, id)
	end
	for i, tile in ipairs(map.tiles) do
		local x, y = (i - 1) % 3, math.floor((i - 1) / 3)
		local spec = TerrainPalette[tile.t] or TerrainPalette.grassland
		local h = top(tile.t) + 2
		local p = Instance.new("Part")
		p.Anchored = true
		p.Material = Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth
		p.Size = Vector3.new(TILE, h, TILE)
		p.Position = Vector3.new(x * TILE, top(tile.t) - h / 2, y * TILE)
		p.Color = spec.palette[(x * 7 + y * 13) % #spec.palette + 1]
		p.Parent = model
	end
	local props = Instance.new("Folder")
	props.Parent = model
	local sculpt = TileProps.sculpt
	TileProps.sculpt = true
	local ok, err = pcall(TileProps.rebuild, props, { map = map, cities = {} }, top, TILE, 3, true)
	TileProps.sculpt = sculpt
	if not ok then
		Diag.fail("pedia", "terrain props (the bare tiles are shown)", err)
	end
	return viewport(box, model, PediaArt.CAMERA.terrain, conns)
end

local function drawPlate(box, art, layout, rs)
	local era = TechGlyphs.eraOf(rs.techs, art.id)
	local pal = TechGlyphs.colorOf(era)
	local card = Instance.new("Frame")
	card.Name = "Picture"
	card.Size = UDim2.fromScale(1, 1)
	card.BackgroundColor3 = pal.fill
	card.BorderSizePixel = 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = card
	local stroke = Instance.new("UIStroke")
	stroke.Color = pal.edge
	stroke.Thickness = 2
	stroke.Parent = card
	local glyph = EditableGlyph.render(card, rs.techs, art.id, layout.plate)
	glyph.AnchorPoint = Vector2.new(0.5, 0.5)
	glyph.Position = UDim2.fromScale(0.5, 0.5)
	card.Parent = box
	return card
end

-- draws `art` into box without touching the encyclopedia's own picture
-- (the wonder cards use it); the caller disconnects conns and destroys root
function M.draw(box, art, layout, rs)
	local conns = {}
	local ok, root = pcall(function()
		if art.kind == "unit" then
			return drawUnit(box, art, conns)
		elseif art.kind == "structure" then
			return drawStructure(box, art, conns)
		elseif art.kind == "terrain" then
			return drawTerrain(box, art, conns, rs)
		end
		return drawPlate(box, art, layout, rs)
	end)
	if not ok or root == nil then
		for _, c in ipairs(conns) do
			c:Disconnect()
		end
		return nil, root
	end
	return root, conns
end

-- box = the Frame PediaArt.layout sized; returns the art kind actually shown
function M.show(box, catKey, id, layout, rs)
	M.clear()
	local art = PediaArt.resolve(catKey, id, M.have())
	if art.kind == "none" then
		return "none"
	end
	local root, conns = M.draw(box, art, layout, rs)
	if root == nil then
		Diag.fail("pedia", ("picture %s/%s (%s; the box stays empty)"):format(catKey, id, art.kind), conns)
		return "failed"
	end
	current = { root = root, conns = conns }
	return art.kind
end

return M
