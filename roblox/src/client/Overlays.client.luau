-- runI item 8: MAP OVERLAYS — a left-side button + a 3-toggle panel (all default
-- OFF, session-persisted) that tint the map. Render-only + FOG-HONEST: reads only
-- the filtered client view and tints only tiles the viewer has SEEN.
--   1. City influence  — owner-color tint over each KNOWN city's workable radius.
--   2. Unit presence   — owner-color tint over tiles holding KNOWN units.
--   3. Hide unit labels — unit text labels off (the 3D markers stay); coordinates
--      with the item-9 zoom LOD via ClientState.hideUnitLabels.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local state = { cityInfluence = false, unitPresence = false, hideLabels = false }

local folder = Instance.new("Folder")
folder.Name = "MapOverlays"
folder.Parent = workspace

local gui = Instance.new("ScreenGui")
gui.Name = "RMCOverlays"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local btn = Instance.new("TextButton")
-- runJ item 2: match the Legend button (190x40, TextSize 18) and sit just above
-- Legend, in the slot Diplomacy used to hold (Diplomacy moved up 44px).
btn.Size = UDim2.new(0, 190, 0, 40)
btn.Position = UDim2.new(0, 8, 1, -120)
btn.BackgroundColor3 = Color3.fromRGB(30, 40, 54)
btn.BackgroundTransparency = 0.25
btn.TextColor3 = Color3.fromRGB(235, 235, 235)
btn.Font = Enum.Font.Code
btn.TextSize = 18
btn.Text = "  Map overlays"
btn.TextXAlignment = Enum.TextXAlignment.Left
btn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = btn
end

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 232, 0, 116)
panel.Position = UDim2.new(0, 8, 1, -240) -- runJ item 2: just above the Map-overlays button
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = panel
end

local function tileTopY(x, y)
	local p = world:WaitForChild("Terrain"):FindFirstChild(("Tile_%d_%d"):format(x, y))
	return p and (p.Position.Y + p.Size.Y / 2) or 0
end

local function known(view, x, y)
	if x < 0 or y < 0 or x >= view.map.width or y >= view.map.height then
		return false
	end
	local t = view.map.tiles[y * view.map.width + x + 1]
	return t ~= nil and t.t ~= "unknown"
end

local function tint(view, x, y, color)
	if not known(view, x, y) then
		return -- fog-honest: never tint an unseen tile
	end
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.Size = Vector3.new(TILE * 0.98, 0.12, TILE * 0.98)
	part.CFrame = CFrame.new(x * TILE, tileTopY(x, y) + 0.28, y * TILE)
	part.Color = color
	part.Material = Enum.Material.Neon
	part.Transparency = 0.62
	part.Parent = folder
end

local function ownerCol(view, owner)
	local p = view.players[owner]
	return p and hexColor(Palette.displayColor(p.color)) or Color3.fromRGB(200, 200, 200)
end

local function redraw()
	folder:ClearAllChildren()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	-- runJ item 3: the city-influence tint is suppressed while a city view is
	-- open (its fat-cross already shows that city's radius; the map tint clutters)
	if state.cityInfluence and not ClientState.cityViewOpen then
		local shim = { map = view.map, players = view.players, cities = view.cities,
			cityOrder = view.cityOrder, units = view.units, wonders = view.wonders }
		for _, c in pairs(view.cities) do
			local col = ownerCol(view, c.owner)
			tint(view, c.x, c.y, col)
			local ok, cand = pcall(citiesModule.candidateTiles, shim, c, rs)
			if ok and cand ~= nil then
				for _, t in ipairs(cand) do
					tint(view, t.x, t.y, col)
				end
			end
		end
	end
	if state.unitPresence then
		for _, u in pairs(view.units) do
			tint(view, u.x, u.y, ownerCol(view, u.owner))
		end
	end
end

-- one toggle row: a checkbox button (green when on) + a label; flips state[key],
-- redraws, and (for hideLabels) signals the renderer.
local function toggleRow(y, key, text, onChange)
	local box = Instance.new("TextButton")
	box.Size = UDim2.new(0, 24, 0, 24)
	box.Position = UDim2.new(0, 10, 0, y)
	box.BackgroundColor3 = Color3.fromRGB(60, 66, 82)
	box.BorderSizePixel = 0
	box.Text = ""
	box.Parent = panel
	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.new(1, -44, 0, 24)
	lbl.Position = UDim2.new(0, 40, 0, y)
	lbl.BackgroundTransparency = 1
	lbl.TextColor3 = Color3.fromRGB(235, 235, 235)
	lbl.Font = Enum.Font.Code
	lbl.TextSize = 15
	lbl.TextXAlignment = Enum.TextXAlignment.Left
	lbl.Text = text
	lbl.Parent = panel
	local function paint()
		box.BackgroundColor3 = state[key] and Color3.fromRGB(56, 138, 74) or Color3.fromRGB(60, 66, 82)
		box.Text = state[key] and "\u{2713}" or ""
		box.TextColor3 = Color3.fromRGB(240, 245, 240)
	end
	box.Activated:Connect(function()
		state[key] = not state[key]
		paint()
		if onChange then
			onChange()
		end
	end)
	paint()
end

toggleRow(10, "cityInfluence", "City influence", redraw)
toggleRow(44, "unitPresence", "Unit presence", redraw)
toggleRow(78, "hideLabels", "Hide unit labels", function()
	ClientState.hideUnitLabels = state.hideLabels -- item-9 LOD respects this
end)

btn.Activated:Connect(function()
	panel.Visible = not panel.Visible
	if panel.Visible then
		ClientState.panelOpened("overlays") -- runI item 14: close the other left-stack panels
	end
end)
ClientState.onPanelOpen(function(id)
	if id ~= "overlays" then
		panel.Visible = false
	end
end)

ClientState.onView(function()
	if state.cityInfluence or state.unitPresence then
		redraw()
	end
end)

-- runJ item 3: redraw when the city view opens/closes so the influence tint
-- disappears on open and returns on close (a cheap one-bool watch)
local lastCityView = false
RunService.Heartbeat:Connect(function()
	local cv = ClientState.cityViewOpen == true
	if cv ~= lastCityView then
		lastCityView = cv
		if state.cityInfluence then
			redraw()
		end
	end
end)

print("[Overlays] map-overlays panel up (item 8: city influence / unit presence / hide labels)")
