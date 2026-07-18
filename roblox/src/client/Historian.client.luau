-- SO9 (catalog row; browser A75 twin, client/ui/historian.js): the
-- historian's report — a dismissable interstitial when the world enters a
-- new age. Standings arrive PRE-RANKED-ABLE from the server's
-- {t="historian"} frame (world-public scores via the shared score twin);
-- shown once per age event, click-through or 12 s auto-dismiss.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCHistorian"
gui.ResetOnSpawn = false
gui.DisplayOrder = 12
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local card = nil
local gen = 0

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function ageName(id)
	for _, a in ipairs(ClientState.rulesets().rules.ages or {}) do
		if a.id == id then
			return a.name
		end
	end
	return tostring(id)
end

local function dismiss()
	gen += 1
	if card ~= nil then
		card:Destroy()
		card = nil
	end
end

local function show(msg)
	dismiss()
	local rows = {}
	for _, r in ipairs(msg.rows) do
		table.insert(rows, r)
	end
	table.sort(rows, function(a, b)
		return a.score > b.score
	end)
	local height = 74 + #rows * 24 + 22

	card = Instance.new("TextButton") -- whole card = dismiss
	card.Size = UDim2.new(0, 480, 0, height)
	card.Position = UDim2.new(0.5, -240, 0.18, 0)
	card.BackgroundColor3 = Color3.fromRGB(22, 20, 14)
	card.BackgroundTransparency = 0.04
	card.Text = ""
	card.AutoButtonColor = false
	card.Parent = gui
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = card
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(200, 170, 90)
	s.Transparency = 0.35
	s.Thickness = 2
	s.Parent = card

	local year = msg.year < 0 and (-msg.year .. " BC") or (msg.year .. " AD")
	local head = Instance.new("TextLabel")
	head.Size = UDim2.new(1, -20, 0, 54)
	head.Position = UDim2.new(0, 10, 0, 6)
	head.BackgroundTransparency = 1
	head.RichText = true
	head.TextColor3 = Color3.fromRGB(240, 215, 150)
	head.Font = Enum.Font.SourceSansBold
	head.TextSize = 21
	head.TextWrapped = true
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = ("The world enters the %s Age  <font size=\"14\" color=\"#9db2c8\">(%s) - the historian's standings:</font>")
		:format(ageName(msg.age), year)
	head.Parent = card

	for i, r in ipairs(rows) do
		local chip = Instance.new("Frame")
		chip.Size = UDim2.new(0, 12, 0, 12)
		chip.Position = UDim2.new(0, 12, 0, 64 + (i - 1) * 24)
		chip.BorderSizePixel = 0
		chip.BackgroundColor3 = hexColor(Palette.displayColor(r.color or "#888888"))
		chip.Parent = card
		local line = Instance.new("TextLabel")
		line.Size = UDim2.new(1, -44, 0, 20)
		line.Position = UDim2.new(0, 32, 0, 60 + (i - 1) * 24)
		line.BackgroundTransparency = 1
		line.TextColor3 = r.alive and Color3.fromRGB(228, 232, 240) or Color3.fromRGB(135, 140, 148)
		line.Font = Enum.Font.Code
		line.TextSize = 14
		line.TextXAlignment = Enum.TextXAlignment.Left
		line.Text = ("%d. %-14s score %d - %d cities, %d techs, pop %d%s")
			:format(i, r.name, r.score, r.cities, r.techs, r.pop, r.alive and "" or " (fallen)")
		line.Parent = card
	end

	local hint = Instance.new("TextLabel")
	hint.Size = UDim2.new(1, -20, 0, 14)
	hint.Position = UDim2.new(0, 10, 1, -18)
	hint.BackgroundTransparency = 1
	hint.TextColor3 = Color3.fromRGB(130, 140, 155)
	hint.Font = Enum.Font.Code
	hint.TextSize = 11
	hint.TextXAlignment = Enum.TextXAlignment.Left
	hint.Text = "click to dismiss"
	hint.Parent = card

	card.Activated:Connect(dismiss)
	gen += 1
	local myGen = gen
	task.delay(12, function()
		if gen == myGen then
			dismiss()
		end
	end)
end

ClientState.onHistorian(show)

print("[Historian] SO9 age interstitial up (server historian frames)")
