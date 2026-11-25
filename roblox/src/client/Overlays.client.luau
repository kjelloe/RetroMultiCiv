-- runI item 8: MAP OVERLAYS — a left-side button + a 3-toggle panel (all default
-- OFF, session-persisted) that tint the map. Render-only + FOG-HONEST: reads only
-- the filtered client view and tints only tiles the viewer has SEEN.
--   1. City influence  — owner-color tint over each KNOWN city's workable radius.
--   2. Unit presence   — owner-color tint over tiles holding KNOWN units.
--   4. Resources       — food / shield / trade icon rows on every KNOWN tile
--      around the camera focus (YieldIcons; hidden while a city view is open,
--      which labels its own tiles).
--   3. Hide unit labels — unit text labels off (the 3D markers stay); coordinates
--      with the item-9 zoom LOD via ClientState.hideUnitLabels.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette"))
local YieldIcons = require(script.Parent:WaitForChild("YieldIcons"))
local YieldLabel = require(script.Parent:WaitForChild("YieldLabel"))
local Diag = require(script.Parent:WaitForChild("Diag"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local state = { cityInfluence = false, unitPresence = false, hideLabels = false, resources = false }

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
btn.Position = UDim2.new(0, 8, 1, -136)
btn.BackgroundColor3 = Color3.fromRGB(30, 40, 54)
btn.BackgroundTransparency = 0.25
btn.TextColor3 = Color3.fromRGB(235, 235, 235)
btn.Font = Enum.Font.Code
btn.TextSize = 18
btn.Text = "  Map overlays"
btn.TextXAlignment = Enum.TextXAlignment.Left
btn.Parent = gui
require(script.Parent:WaitForChild("UiTheme")).apply(btn, { color = "neutral", icon = "overlays" }) -- U2 dress
require(script.Parent:WaitForChild("LeftStack")).register(btn, 3) -- phone: one icon row, bottom-left
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = btn
end

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 232, 0, 150)
panel.Position = UDim2.new(0, 206, 1, -206) -- beside the 190 px button column (it sat over the buttons), above the action bar
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

-- Resources: one label per known tile in the window around the camera
-- focus, lying flat just above the tile (no backdrop); rebuilt when the focus has
-- moved YieldIcons.STEP tiles, refreshed on every view
local resHome = Instance.new("Folder")
resHome.Name = "ResourceLabels"
resHome.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
local resLabels = {} -- tile index -> { plate, gui, label, sig }
local resAt = nil -- { x, y } the window was built around
local folderRes = Instance.new("Folder")
folderRes.Name = "ResourcePlates"
folderRes.Parent = workspace
local function clearResources()
	resHome:ClearAllChildren()
	folderRes:ClearAllChildren()
	resLabels, resAt = {}, nil
end
local function drawResources()
	local view = ClientState.view
	if not state.resources or view == nil or ClientState.cityViewOpen then
		if resAt ~= nil then
			clearResources()
		end
		return
	end
	local f = ClientState.cameraFocus
	local fx = f ~= nil and math.floor(f.X / TILE + 0.5) or 0
	local fy = f ~= nil and math.floor(f.Z / TILE + 0.5) or 0
	local rs = ClientState.rulesets()
	local terrain = world:WaitForChild("Terrain")
	local x0, x1, y0, y1 = YieldIcons.window(fx, fy, view.map.width, view.map.height)
	local keep, n = {}, 0
	for y = y0, y1 do
		for x = x0, x1 do
			local idx = y * view.map.width + x + 1
			local tile = view.map.tiles[idx]
			local part = terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
			if tile ~= nil and tile.t ~= "unknown" and part ~= nil then -- fog-honest
				local ok, yl = pcall(citiesModule.tileYields, tile, rs)
				local e = resLabels[idx]
				if ok and #YieldIcons.rows(yl) > 0 then
					if e == nil then
						-- a clear plate just above the tile; the label is on its top face
						local plate = Instance.new("Part")
						plate.Anchored = true
						plate.CanCollide = false
						plate.CanQuery = false
						plate.CanTouch = false
						plate.CastShadow = false
						plate.Transparency = 1
						plate.Size = Vector3.new(TILE * YieldIcons.LABEL.w, 0.05, TILE * YieldIcons.LABEL.h)
						plate.Parent = folderRes
						local sg = Instance.new("SurfaceGui")
						sg.Face = Enum.NormalId.Top
						sg.SizingMode = Enum.SurfaceGuiSizingMode.FixedSize
						sg.CanvasSize = Vector2.new(YieldIcons.PIXELS, YieldIcons.PIXELS * YieldIcons.LABEL.h / YieldIcons.LABEL.w)
						sg.LightInfluence = 0
						sg.AlwaysOnTop = true -- trees and peaks do not hide a tile's label
						sg.MaxDistance = 600 -- not drawn from the wonder stage, far off the map
						sg.Adornee = plate
						local label = Instance.new("TextLabel")
						label.Size = UDim2.fromScale(1, 1)
						label.BackgroundTransparency = 1
						label.RichText = true
						label.TextScaled = true
						label.Font = Enum.Font.Code
						label.TextColor3 = Color3.fromRGB(235, 235, 235)
						label.TextStrokeTransparency = 0.25
						label.Text = ""
						label.Parent = sg
						sg.Parent = resHome
						e = { plate = plate, gui = sg, label = label }
						resLabels[idx] = e
					end
					e.plate.CFrame = CFrame.new(part.Position.X, part.Position.Y + part.Size.Y / 2 + YieldIcons.LIFT, part.Position.Z)
					local sig = YieldIcons.signature(yl)
					if e.sig ~= sig then
						e.sig = sig
						e.label.Text = YieldLabel.fill(e.label, yl, true) and "" or YieldIcons.text(yl)
					end
					keep[idx] = true
					n += 1
				end
			end
		end
	end
	for idx, e in pairs(resLabels) do
		if not keep[idx] then
			e.gui:Destroy()
			e.plate:Destroy()
			resLabels[idx] = nil
		end
	end
	if resAt == nil then
		print(("[Overlays] resources on: %d tile label(s) around %d,%d"):format(n, fx, fy))
	end
	resAt = { x = fx, y = fy }
end
local function refreshResources()
	local ok, err = pcall(drawResources)
	if not ok then
		Diag.fail("overlays", "resources (the labels are removed)", err)
		state.resources = false
		clearResources()
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
	box.Font = Enum.Font.GothamBold
	box.TextSize = 18 -- 2026-11-25 tour: the default 14 px tick failed the size check
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
toggleRow(78, "resources", "Resources", refreshResources)
toggleRow(112, "hideLabels", "Hide unit labels", function()
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
	if state.resources then
		refreshResources()
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
		if state.resources then
			refreshResources()
		end
	end
	if state.resources and not cv then -- follow the camera
		local f = ClientState.cameraFocus
		if f ~= nil and YieldIcons.moved(resAt and resAt.x, resAt and resAt.y, math.floor(f.X / TILE + 0.5), math.floor(f.Z / TILE + 0.5)) then
			refreshResources()
		end
	end
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("overlays", panel, function()
	panel.Visible = true
	ClientState.panelOpened("overlays")
end, function()
	panel.Visible = false
end)

print("[Overlays] map-overlays panel up (item 8: city influence / unit presence / resources / hide labels)")
