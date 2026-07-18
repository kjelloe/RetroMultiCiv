-- SO1 (catalog row; browser C1 twin, ruled @38e36677: FLAT FRAME TILE GRID
-- v1 — fog-honest by construction, ViewportFrame parked as a docs/13
-- polish tier): the world minimap. One cell per map tile from the
-- FOG-FILTERED view (unknown = void color), cities on top in owner
-- colors, click or drag jumps the camera (ClientState.focusCamera).
-- Cell budget: big maps downsample (max-color cell wins are unnecessary —
-- the FIRST tile of the block paints it; coarse is fine at this size).
-- Diff-painted per view push: only cells whose color key changed repaint.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local TerrainPalette = require(game:GetService("ReplicatedStorage")
	:WaitForChild("GameData"):WaitForChild("TerrainPalette"))
local Palette = require(script.Parent:WaitForChild("Palette")) -- SO14

local MAX_CELLS = 1600 -- frame budget; downsample factor grows past it
local WIDTH_PX = 200

local gui = Instance.new("ScreenGui")
gui.Name = "RMCMinimap"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local box = Instance.new("Frame")
box.BackgroundColor3 = Color3.fromRGB(8, 10, 16)
box.BorderSizePixel = 0
box.Visible = false
box.Active = true
box.Parent = gui
do
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(90, 100, 120)
	s.Transparency = 0.4
	s.Parent = box
end

local cells = nil -- flat array of Frames, built once per map shape
local cellKeys = nil -- last painted key per cell (diff painting)
local gw, gh, step = 0, 0, 1

local function hexColor(hex)
	local r = tonumber(string.sub(hex, 2, 3), 16) or 128
	local g = tonumber(string.sub(hex, 4, 5), 16) or 128
	local b = tonumber(string.sub(hex, 6, 7), 16) or 128
	return Color3.fromRGB(r, g, b)
end

local function buildGrid(map)
	step = 1
	while math.ceil(map.width / step) * math.ceil(map.height / step) > MAX_CELLS do
		step += 1
	end
	gw = math.ceil(map.width / step)
	gh = math.ceil(map.height / step)
	local cellPx = math.max(2, math.floor(WIDTH_PX / gw))
	box.Size = UDim2.new(0, gw * cellPx, 0, gh * cellPx)
	box.Position = UDim2.new(1, -(gw * cellPx + 8), 1, -(gh * cellPx + 108))
	box:ClearAllChildren()
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(90, 100, 120)
	stroke.Transparency = 0.4
	stroke.Parent = box
	cells = table.create(gw * gh)
	cellKeys = table.create(gw * gh, "")
	for cy = 0, gh - 1 do
		for cx = 0, gw - 1 do
			local f = Instance.new("Frame")
			f.Size = UDim2.new(0, cellPx, 0, cellPx)
			f.Position = UDim2.new(0, cx * cellPx, 0, cy * cellPx)
			f.BorderSizePixel = 0
			f.BackgroundColor3 = Color3.fromRGB(10, 14, 22)
			f.Parent = box
			cells[cy * gw + cx + 1] = f
		end
	end
end

local function paint(view)
	local map = view.map
	if cells == nil or gw ~= math.ceil(map.width / step) then
		buildGrid(map)
	end
	-- city overlay index: block -> owner color key (cities win over terrain)
	local cityAt = {}
	for _, c in pairs(view.cities) do
		local ci = math.floor(c.y / step) * gw + math.floor(c.x / step) + 1
		local p = view.players[c.owner]
		cityAt[ci] = Palette.displayColor((p ~= nil and p.color) or "#ffffff")
	end
	for cy = 0, gh - 1 do
		for cx = 0, gw - 1 do
			local i = cy * gw + cx + 1
			local key, color
			if cityAt[i] ~= nil then
				key = "c" .. cityAt[i]
				color = hexColor(cityAt[i])
			else
				local tile = map.tiles[(cy * step) * map.width + (cx * step) + 1]
				local t = tile ~= nil and tile.t or "unknown"
				key = t
				local pal = TerrainPalette[t] or TerrainPalette.unknown
				color = pal.palette[1]
			end
			if cellKeys[i] ~= key then
				cellKeys[i] = key
				cells[i].BackgroundColor3 = color
			end
		end
	end
	box.Visible = true
end

ClientState.onView(paint)

-- click or drag jumps the camera (browser pointer contract)
local dragging = false
local function jump(inputPos)
	local view = ClientState.view
	if view == nil then
		return
	end
	local rel = Vector2.new(inputPos.X - box.AbsolutePosition.X, inputPos.Y - box.AbsolutePosition.Y)
	local tx = math.clamp(math.floor(rel.X / box.AbsoluteSize.X * view.map.width), 0, view.map.width - 1)
	local ty = math.clamp(math.floor(rel.Y / box.AbsoluteSize.Y * view.map.height), 0, view.map.height - 1)
	ClientState.focusCamera(tx, ty)
end

box.InputBegan:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1
		or input.UserInputType == Enum.UserInputType.Touch then
		dragging = true
		jump(input.Position)
	end
end)
box.InputEnded:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1
		or input.UserInputType == Enum.UserInputType.Touch then
		dragging = false
	end
end)
UserInputService.InputChanged:Connect(function(input)
	if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement
		or input.UserInputType == Enum.UserInputType.Touch) then
		jump(input.Position)
	end
end)

print("[Minimap] SO1 minimap up (flat grid, click/drag jumps the camera)")
