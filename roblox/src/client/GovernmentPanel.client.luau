-- R12 (2): the government panel (roblox/SPEC.md §3l) — opened by the
-- ActionBar's top-center Government button. Hosts the tax/lux/sci rate
-- steppers (MOVED here from the research picker, user runC ruling) and the
-- current government line; government SWITCHING lands here later (revolution
-- command once the browser shape ports). Steppers, not sliders (docs/13
-- review: sliders fight LMB-orbit). Acting stays commands through the
-- dispatcher: setRates {tax,sci,lux}; the server judges caps and bounds.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCGovernment"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 260, 0, 150)
panel.Position = UDim2.new(0.5, -130, 0, 44)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local function label(y, size, text)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -16, 0, size)
	l.Position = UDim2.new(0, 8, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = Color3.fromRGB(235, 235, 235)
	l.Font = Enum.Font.Code
	l.TextSize = size - 2
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Text = text
	l.Parent = panel
	return l
end

local title = label(6, 22, "Government")
local govLine = label(32, 16, "")
local ratesLine = label(52, 16, "")

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 24, 0, 24)
closeBtn.Position = UDim2.new(1, -28, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel

local function stepButton(x, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 30, 0, 24)
	b.Position = UDim2.new(0, x, 1, -34)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 16
	b.Text = text
	b.Parent = panel
	return b
end

local taxLabel = label(0, 16, "tax")
taxLabel.Position = UDim2.new(0, 8, 1, -54)
taxLabel.Size = UDim2.new(0, 60, 0, 16)
local taxDown = stepButton(8, "-")
local taxUp = stepButton(42, "+")
local luxLabel = label(0, 16, "lux")
luxLabel.Position = UDim2.new(0, 108, 1, -54)
luxLabel.Size = UDim2.new(0, 60, 0, 16)
local luxDown = stepButton(108, "-")
local luxUp = stepButton(142, "+")

local function me()
	local view = ClientState.view
	return view and view.players[view.you]
end

local function rates()
	local m = me()
	local tax = (m and m.taxRate) or 50
	local lux = (m and m.luxRate) or 0
	local sci = 100 - tax - lux
	return tax, sci, lux
end

-- a stepper click: move 10% between the stepped rate and science, then let
-- the SERVER be the judge (gov cap, bounds) — display clamps only to 0..100
local function sendRates(tax, lux)
	local sci = 100 - tax - lux
	if tax < 0 or lux < 0 or sci < 0 or tax > 100 or lux > 100 then
		return
	end
	print(("[Government] setRates tax=%d sci=%d lux=%d"):format(tax, sci, lux))
	ClientState.send({ type = "setRates", tax = tax, sci = sci, lux = lux })
end

taxDown.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax - 10, lux)
end)
taxUp.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax + 10, lux)
end)
luxDown.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux - 10)
end)
luxUp.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux + 10)
end)

local function refresh()
	local m = me()
	if m == nil then
		return
	end
	local rs = ClientState.rulesets()
	local gov = rs.governments[m.government or ""]
	govLine.Text = "government: " .. (gov and gov.name or m.government or "?")
	local tax, sci, lux = rates()
	ratesLine.Text = ("rates: tax %d%% sci %d%% lux %d%%%s"):format(tax, sci, lux,
		gov and (" (cap %d%%)"):format(gov.maxRate) or "")
end

local function setOpen(open)
	gui.Enabled = open
	if open then
		refresh()
	end
end

closeBtn.Activated:Connect(function()
	setOpen(false)
end)

ClientState.onGovernmentOpen(function()
	setOpen(not gui.Enabled)
end)

ClientState.onView(function()
	if gui.Enabled then
		refresh()
	end
end)

print("[Government] R12 government panel up (rate steppers live here now)")
