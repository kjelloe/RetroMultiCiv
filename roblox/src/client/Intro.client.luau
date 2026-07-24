-- runL: a brief intro animation on client boot — a full-screen title card that
-- fades/rises in, holds, then fades out to reveal the observation deck. Runs
-- ONCE per join (ResetOnSpawn=false; the script destroys its gui when done, so a
-- later respawn never replays it). Tap anywhere to skip.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local gui = Instance.new("ScreenGui")
gui.Name = "RMCIntro"
gui.ResetOnSpawn = false
gui.DisplayOrder = 100
gui.IgnoreGuiInset = true
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local backdrop = Instance.new("TextButton") -- a button so a tap can skip
backdrop.Size = UDim2.new(1, 0, 1, 0)
backdrop.BackgroundColor3 = Color3.fromRGB(8, 10, 16)
backdrop.BorderSizePixel = 0
backdrop.AutoButtonColor = false
backdrop.Text = ""
backdrop.ZIndex = 100
backdrop.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 96)
title.Position = UDim2.new(0, 0, 0.40, -30) -- animates UP to 0.40,-48
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBlack
title.TextColor3 = Color3.fromRGB(240, 225, 170)
title.TextSize = 64
title.TextTransparency = 1
title.Text = "RETROMULTICIV"
title.ZIndex = 101
title.Parent = gui

local sub = Instance.new("TextLabel")
sub.Size = UDim2.new(1, 0, 0, 30)
sub.Position = UDim2.new(0, 0, 0.40, 56)
sub.BackgroundTransparency = 1
sub.Font = Enum.Font.Gotham
sub.TextColor3 = Color3.fromRGB(170, 185, 205)
sub.TextSize = 22
sub.TextTransparency = 1
sub.Text = "a browser-born 4X, reborn in Roblox"
sub.ZIndex = 101
sub.Parent = gui

local done = false
local function finish(fast)
	if done then
		return
	end
	done = true
	local t = TweenInfo.new(fast and 0.25 or 0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	TweenService:Create(title, t, { TextTransparency = 1 }):Play()
	TweenService:Create(sub, t, { TextTransparency = 1 }):Play()
	TweenService:Create(backdrop, t, { BackgroundTransparency = 1 }):Play()
	task.delay(fast and 0.3 or 1.0, function()
		gui:Destroy()
	end)
end

backdrop.Activated:Connect(function()
	finish(true) -- tap to skip
end)

task.spawn(function()
	local ease = TweenInfo.new(1.0, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(title, ease, {
		TextTransparency = 0,
		Position = UDim2.new(0, 0, 0.40, -48), -- a slight rise as it fades in
	}):Play()
	task.wait(0.45)
	TweenService:Create(sub, ease, { TextTransparency = 0 }):Play()
	task.wait(2.2)
	finish(false)
end)

print("[Intro] runL boot intro up (tap to skip)")
