-- MP4 (docs/13 Tier-3): the regent STANCE picker — a 1:1 of client/ui/regency.js's
-- "Hand your seat to the AI" dialog. The Hud 🤖 button opens this (via the
-- ClientState.openRegent hook) instead of arming a bare balanced regent; picking
-- a stance sends it with the away message (ClientState.setAway(true, stance)),
-- the GameServer feeds it to pickCommand, and the engine plays that stance.
-- Regency is UI/session state, never game state (docs/08 §7) — golden-neutral.
local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

-- the browser STANCES table (client/ui/regency.js): id, name, blurb
local STANCES = {
	{ "balanced", "Balanced", "well-rounded play" },
	{ "defensive", "Defensive", "garrison and hold" },
	{ "aggressive", "Aggressive", "build armies, attack" },
	{ "science", "Science", "tech and libraries first" },
	{ "growth", "Growth", "settlers and food first" },
}

local gui = Instance.new("ScreenGui")
gui.Name = "RMCRegentDialog"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 320, 0, 40 + #STANCES * 34 + 16)
panel.Position = UDim2.new(0.5, -160, 0.5, -140)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = panel
end

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -40, 0, 30)
title.Position = UDim2.new(0, 10, 0, 6)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(255, 220, 120)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "🤖 Hand your seat to the AI"
title.Parent = panel

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 24, 0, 24)
closeBtn.Position = UDim2.new(1, -28, 0, 6)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "✕"
closeBtn.Parent = panel
closeBtn.Activated:Connect(function()
	gui.Enabled = false
end)

for i, s in ipairs(STANCES) do
	local id, name, blurb = s[1], s[2], s[3]
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(1, -20, 0, 30)
	b.Position = UDim2.new(0, 10, 0, 40 + (i - 1) * 34)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.Code
	b.TextSize = 14
	b.TextXAlignment = Enum.TextXAlignment.Left
	b.Text = ("  %s — %s"):format(name, blurb)
	b.Parent = panel
	do
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 6)
		c.Parent = b
	end
	b.Activated:Connect(function()
		ClientState.setAway(true, id) -- MP4: arm the regent with this stance
		gui.Enabled = false
	end)
end

-- the Hud 🤖 button calls this to open the picker (only when arming)
ClientState.openRegent = function()
	gui.Enabled = true
end

print("[RegentDialog] MP4 regent stance picker up (🤖 opens; 5 stances)")
