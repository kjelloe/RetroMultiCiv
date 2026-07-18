-- SO17 (catalog row; browser client/ui/strategic-overlay.js twin, ruled
-- @d969dd26): the live per-AI STRATEGIC OVERLAY - a debug/analysis window
-- showing each civ's inferred stance/mode/threat/units. The snapshot needs
-- FULL state (all players' units/cities), which a seated player's fog view
-- lacks - so the SERVER computes strategicSnapshot (the shared twin, one
-- computation) and answers a {t=strat} PULL only for SPECTATORS or a Studio
-- debug game. The 🧠 button shows only in those contexts. Pull on open +
-- re-pull each view push while open.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCStrategic"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- 🧠 button, top-right row (left of Ship/Pedia); shown only when the pull
-- will work: a Studio debug game or a spectator seat
local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 44, 0, 36)
openBtn.Position = UDim2.new(1, -418, 0, 8)
openBtn.BackgroundColor3 = Color3.fromRGB(48, 44, 66)
openBtn.TextColor3 = Color3.fromRGB(225, 220, 245)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 20
openBtn.Text = "🧠"
openBtn.Visible = false
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 560, 0, 320)
frame.Position = UDim2.new(0.5, -280, 0.2, 0)
frame.BackgroundColor3 = Color3.fromRGB(18, 16, 26)
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = frame
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(150, 130, 210)
	s.Transparency = 0.4
	s.Parent = frame
end

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -40, 0, 28)
title.Position = UDim2.new(0, 12, 0, 6)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(210, 195, 245)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 20
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "🧠 AI strategy (debug / spectator)"
title.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -30, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = frame

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -24, 1, -44)
list.Position = UDim2.new(0, 12, 0, 38)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = frame

local MODE_ICON = { warring = "⚔", expanding = "🌱", building = "🏛", defending = "🛡" }
local THREAT_COLOR = {
	none = Color3.fromRGB(150, 160, 175), low = Color3.fromRGB(120, 210, 130),
	med = Color3.fromRGB(230, 190, 90), high = Color3.fromRGB(235, 100, 90),
}

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function render(rows)
	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	if #rows == 0 then
		list.CanvasSize = UDim2.new(0, 0, 0, 0)
		return
	end
	for i, r in ipairs(rows) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, -8, 0, 40)
		row.Position = UDim2.new(0, 0, 0, (i - 1) * 44)
		row.BackgroundColor3 = r.human and Color3.fromRGB(30, 28, 42) or Color3.fromRGB(22, 20, 32)
		row.BorderSizePixel = 0
		row.Parent = list
		local chip = Instance.new("Frame")
		chip.Size = UDim2.new(0, 14, 0, 14)
		chip.Position = UDim2.new(0, 8, 0, 4)
		chip.BorderSizePixel = 0
		chip.BackgroundColor3 = hexColor(Palette.displayColor(r.color or "#888888"))
		chip.Parent = row
		local head = Instance.new("TextLabel")
		head.Size = UDim2.new(1, -30, 0, 18)
		head.Position = UDim2.new(0, 28, 0, 2)
		head.BackgroundTransparency = 1
		head.RichText = true
		head.TextColor3 = r.alive and Color3.fromRGB(230, 228, 240) or Color3.fromRGB(140, 140, 150)
		head.Font = Enum.Font.SourceSansBold
		head.TextSize = 15
		head.TextXAlignment = Enum.TextXAlignment.Left
		head.Text = ("%s%s  <font color=\"#b0a8d0\">[%s]</font>  %s %s"):format(
			r.name or r.pid, r.human and " (human)" or "",
			r.stance or "balanced", MODE_ICON[r.mode] or "", r.mode or "")
		head.Parent = row
		local sub = Instance.new("TextLabel")
		sub.Size = UDim2.new(1, -30, 0, 16)
		sub.Position = UDim2.new(0, 28, 0, 20)
		sub.BackgroundTransparency = 1
		sub.RichText = true
		sub.Font = Enum.Font.Code
		sub.TextSize = 13
		sub.TextColor3 = Color3.fromRGB(190, 196, 210)
		sub.TextXAlignment = Enum.TextXAlignment.Left
		local u = r.units or {}
		local tc = THREAT_COLOR[r.threat] or THREAT_COLOR.none
		sub.Text = ("<font color=\"rgb(%d,%d,%d)\">threat %s</font>  ·  mil %d settlers %d scouts %d naval %d  ·  gov %s")
			:format(math.floor(tc.R * 255), math.floor(tc.G * 255), math.floor(tc.B * 255),
				r.threat or "none", u.mil or 0, u.settlers or 0, u.scouts or 0, u.naval or 0,
				r.gov or "despotism")
		sub.Parent = row
	end
	list.CanvasSize = UDim2.new(0, 0, 0, #rows * 44)
end

ClientState.onStrat(render)

local function eligible()
	-- Studio debug game, or a spectator seat (server independently gates)
	return RunService:IsStudio()
		or (ClientState.view ~= nil and ClientState.view.you == "spectator")
end

closeBtn.Activated:Connect(function()
	frame.Visible = false
end)
openBtn.Activated:Connect(function()
	frame.Visible = not frame.Visible
	if frame.Visible then
		ClientState.requestStrat()
	end
end)

ClientState.onView(function()
	openBtn.Visible = eligible()
	if frame.Visible then
		ClientState.requestStrat() -- re-pull each round while open
	end
end)

print("[Strategic] SO17 AI-strategy overlay up (🧠; spectator/Studio only)")
