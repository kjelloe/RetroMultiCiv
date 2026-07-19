-- run-F #2 / SO12 (user): the AI FAST-FORWARD DIORAMA. When a game starts in a
-- later age the server fast-forwards the whole world as AI (R24) and the client
-- would otherwise sit on a blank lobby. This shows an animated 2D diorama — a
-- skyline that GROWS as the simulated centuries tick by — plus a progress bar,
-- driven by the server's {t=ffProgress} stream (ClientState.onFfProgress).
-- Presentation only: reads the progress messages, sends nothing.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCFastForward"
gui.ResetOnSpawn = false
gui.DisplayOrder = 50 -- above the lobby
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 520, 0, 300)
panel.Position = UDim2.new(0.5, -260, 0.5, -150)
panel.BackgroundColor3 = Color3.fromRGB(16, 18, 28)
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 12)
	c.Parent = panel
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(120, 150, 210)
	s.Transparency = 0.3
	s.Parent = panel
end

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -24, 0, 30)
title.Position = UDim2.new(0, 12, 0, 12)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(220, 225, 245)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 24
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Advancing the world..."
title.Parent = panel

local sub = Instance.new("TextLabel")
sub.Size = UDim2.new(1, -24, 0, 20)
sub.Position = UDim2.new(0, 12, 0, 42)
sub.BackgroundTransparency = 1
sub.TextColor3 = Color3.fromRGB(160, 175, 205)
sub.Font = Enum.Font.SourceSans
sub.TextSize = 16
sub.TextXAlignment = Enum.TextXAlignment.Left
sub.Text = "Simulating history..."
sub.Parent = panel

-- the diorama stage: a ground strip + a row of growing skyline towers
local stage = Instance.new("Frame")
stage.Size = UDim2.new(1, -24, 0, 150)
stage.Position = UDim2.new(0, 12, 0, 74)
stage.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
stage.BorderSizePixel = 0
stage.ClipsDescendants = true
stage.Parent = panel
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = stage
end

local sky = Instance.new("Frame") -- a gradient sky that warms as ages pass
sky.Size = UDim2.new(1, 0, 1, 0)
sky.BackgroundColor3 = Color3.fromRGB(40, 48, 78)
sky.BorderSizePixel = 0
sky.ZIndex = 1
sky.Parent = stage

local ground = Instance.new("Frame")
ground.Size = UDim2.new(1, 0, 0, 16)
ground.Position = UDim2.new(0, 0, 1, -16)
ground.BackgroundColor3 = Color3.fromRGB(60, 78, 54)
ground.BorderSizePixel = 0
ground.ZIndex = 3
ground.Parent = stage

local TOWERS = 12
local towers = {}
for i = 1, TOWERS do
	local t = Instance.new("Frame")
	t.AnchorPoint = Vector2.new(0.5, 1)
	t.Position = UDim2.new((i - 0.5) / TOWERS, 0, 1, -14)
	t.Size = UDim2.new(0, 24, 0, 2)
	t.BackgroundColor3 = Color3.fromRGB(150, 160, 180)
	t.BorderSizePixel = 0
	t.ZIndex = 2
	t.Parent = stage
	towers[i] = t
end

local bar = Instance.new("Frame")
bar.Size = UDim2.new(1, -24, 0, 14)
bar.Position = UDim2.new(0, 12, 1, -30)
bar.BackgroundColor3 = Color3.fromRGB(34, 40, 58)
bar.BorderSizePixel = 0
bar.Parent = panel
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 7)
	c.Parent = bar
end
local fill = Instance.new("Frame")
fill.Size = UDim2.new(0, 0, 1, 0)
fill.BackgroundColor3 = Color3.fromRGB(110, 180, 235)
fill.BorderSizePixel = 0
fill.Parent = bar
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 7)
	c.Parent = fill
end

local function titleCase(s)
	return (s:gsub("^%l", string.upper))
end

-- ERA palette: the sky + towers modernize as the fast-forward progresses
local ERA_SKY = {
	Color3.fromRGB(40, 48, 78), Color3.fromRGB(70, 66, 92), Color3.fromRGB(96, 84, 96),
}
local progress = 0 -- 0..1 target, eased each frame
local shown = false
local hideAt = 0

local function onProgress(msg)
	local target = msg.target or 1
	local turn = msg.turn or 0
	progress = target > 0 and math.clamp(turn / target, 0, 1) or 1
	title.Text = ("Advancing to the %s Age..."):format(titleCase(msg.age or "new"))
	sub.Text = ("Simulating history - turn %d of %d"):format(turn, target)
	panel.Visible = true
	shown = true
	if msg.done == true then
		title.Text = ("Entering the %s Age"):format(titleCase(msg.age or "new"))
		sub.Text = "The world is ready."
		hideAt = os.clock() + 1.5 -- l+ a beat before the game view takes over
	else
		hideAt = 0
	end
end

ClientState.onFfProgress(onProgress)

-- the first real view push means the game is live — clear the diorama
ClientState.onView(function()
	if shown then
		shown = false
		panel.Visible = false
	end
end)

local eased = 0
RunService.Heartbeat:Connect(function()
	if not panel.Visible then
		return
	end
	if hideAt > 0 and os.clock() >= hideAt then
		panel.Visible = false
		shown = false
		return
	end
	eased = eased + (progress - eased) * 0.08 -- smooth catch-up
	fill.Size = UDim2.new(eased, 0, 1, 0)
	-- era tint by eased progress
	local idx = math.clamp(math.floor(eased * (#ERA_SKY - 0)) + 1, 1, #ERA_SKY)
	sky.BackgroundColor3 = ERA_SKY[idx]
	local now = os.clock()
	for i, t in ipairs(towers) do
		-- each tower's max height scales with progress; a phase gives a lively
		-- "under construction" bob so the skyline reads as growing, not static
		local phase = (math.sin(now * 2 + i * 0.7) * 0.5 + 0.5)
		local grow = math.clamp(eased * 1.15 - (i % 4) * 0.05, 0, 1)
		local h = 6 + grow * (110 * (0.55 + 0.45 * ((i * 7) % 5) / 5)) + phase * 3 * grow
		t.Size = UDim2.new(0, 24, 0, h)
		local warm = math.clamp(eased, 0, 1)
		t.BackgroundColor3 = Color3.fromRGB(150, 160, 180):Lerp(Color3.fromRGB(210, 205, 190), warm)
	end
end)

print("[FastForward] SO12 diorama up (waits for {t=ffProgress})")
